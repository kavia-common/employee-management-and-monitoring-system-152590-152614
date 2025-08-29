'use strict';

/**
 * Analytics Service
 * Provides aggregation utilities across Attendance, Projects/Tasks, and Leaves for reporting.
 * Returns outputs optimized for chart/table consumption on the frontend.
 */

const { Op, fn, col, literal } = require('sequelize');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Leave = require('../models/Leave');
const TaskAssignment = require('../models/TaskAssignment');
const ProjectMember = require('../models/ProjectMember');
const User = require('../models/User');

function parseDate(input) {
  const d = input ? new Date(input) : null;
  return d && !isNaN(d.valueOf()) ? d : null;
}

/**
 * Normalize pagination query params
 */
function normalizePagination({ page, pageSize }, defaults = { page: 1, pageSize: 50 }) {
  const p = parseInt(page, 10);
  const ps = parseInt(pageSize, 10);
  return {
    page: Number.isFinite(p) && p > 0 ? p : defaults.page,
    pageSize: Number.isFinite(ps) && ps > 0 && ps <= 500 ? ps : defaults.pageSize,
  };
}

/**
 * Build inclusive date range filter for createdAt or provided field.
 */
function buildDateRange({ from, to }, field = 'createdAt') {
  const f = parseDate(from);
  const t = parseDate(to);
  if (f && t) {
    // include whole "to" day by setting end to 23:59:59.999
    const end = new Date(t);
    end.setHours(23, 59, 59, 999);
    return { [field]: { [Op.between]: [f, end] } };
  }
  if (f) return { [field]: { [Op.gte]: f } };
  if (t) {
    const end = new Date(t);
    end.setHours(23, 59, 59, 999);
    return { [field]: { [Op.lte]: end } };
  }
  return {};
}

/**
 * PUBLIC_INTERFACE
 * Get attendance summary, either for the current user or for org/team (if RBAC allows).
 * Returns per-day stats: presentCount, avgHours, absentCount (estimation) and raw rows if requested.
 */
async function getAttendanceSummary({ scope, user, query }) {
  /** This is a public function that aggregates attendance records. */
  const { userId, from, to, groupBy = 'day', includeRaw = 'false' } = query || {};
  const forUserId = scope === 'self' ? user.id : (userId || null);

  const where = buildDateRange({ from, to }, 'date'); // Attendance likely has 'date' or 'createdAt'. Using 'date' here per typical schema.
  if (scope === 'user' && forUserId) {
    where.userId = forUserId;
  }
  if (scope === 'org') {
    // no extra condition; RBAC should ensure requester is allowed.
  }
  if (scope === 'team' && user && user.id) {
    // Optional: limit by team membership if your schema supports teams.
    // Placeholder: for now same as org (frontend can pass userId for targeted view).
  }

  // Group by daily buckets for charting; fallback to createdAt if date column not present
  const groupExpr = groupBy === 'month'
    ? fn('DATE_FORMAT', col('date'), '%Y-%m')
    : fn('DATE_FORMAT', col('date'), '%Y-%m-%d');

  // Calculate worked hours using checkInAt & checkOutAt if present; fallback to durationMinutes/60 if exists.
  // Many attendance schemas store checkInAt/checkOutAt per record. We'll compute hours at SQL layer where possible.
  const hoursExpr = literal(`CASE 
    WHEN checkOutAt IS NOT NULL AND checkInAt IS NOT NULL 
      THEN TIME_TO_SEC(TIMEDIFF(checkOutAt, checkInAt))/3600
    WHEN durationMinutes IS NOT NULL 
      THEN durationMinutes/60
    ELSE 0
  END`);

  const rows = await Attendance.findAll({
    attributes: [
      [groupExpr, 'bucket'],
      [fn('COUNT', col('id')), 'presentCount'],
      [fn('AVG', hoursExpr), 'avgHours'],
      [fn('SUM', hoursExpr), 'totalHours'],
    ],
    where,
    group: [literal('bucket')],
    order: [[literal('bucket'), 'ASC']],
    raw: true,
  });

  // Absent count estimation requires a working calendar; here we cannot know total expected workdays.
  // We'll just provide presentCount and avgHours by bucket for now.
  const series = rows.map(r => ({
    bucket: r.bucket,
    present: Number(r.presentCount) || 0,
    avgHours: r.avgHours !== null ? Number(Number(r.avgHours).toFixed(2)) : 0,
    totalHours: r.totalHours !== null ? Number(Number(r.totalHours).toFixed(2)) : 0,
  }));

  return {
    scope,
    userId: forUserId || null,
    groupBy,
    range: { from: from || null, to: to || null },
    series,
    ...(includeRaw === 'true' ? { raw: rows } : {}),
  };
}

/**
 * PUBLIC_INTERFACE
 * Get project status breakdown and tasks per status for either all accessible projects or a specific project.
 * Returns pie-friendly arrays and series per project if requested.
 */
async function getProjectTaskBreakdown({ scope, user, query }) {
  /** This is a public function that aggregates project and task statuses for visualization. */
  const { projectId, from, to, withPerProject = 'false' } = query || {};
  const projectWhere = buildDateRange({ from, to }, 'createdAt');

  if (projectId) {
    projectWhere.id = projectId;
  }

  // RBAC scope constraint (org/team/self) should be handled at caller-level by constraining accessible projects.
  // For simplicity we allow all and assume caller routes add restrictions if needed.

  // Project status breakdown
  const projectStatusRows = await Project.findAll({
    where: projectWhere,
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const projectStatus = projectStatusRows.map(r => ({
    status: r.status || 'unknown',
    count: Number(r.count) || 0,
  }));

  // Task status breakdown (across all or a single project)
  const taskWhere = buildDateRange({ from, to }, 'createdAt');
  if (projectId) taskWhere.projectId = projectId;

  const taskStatusRows = await Task.findAll({
    where: taskWhere,
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const taskStatus = taskStatusRows.map(r => ({
    status: r.status || 'unknown',
    count: Number(r.count) || 0,
  }));

  let perProject = undefined;
  if (withPerProject === 'true') {
    // aggregated tasks per project by status
    const perProjectRows = await Task.findAll({
      where: taskWhere,
      attributes: ['projectId', 'status', [fn('COUNT', col('id')), 'count']],
      group: ['projectId', 'status'],
      raw: true,
    });

    // reshape to array suitable for stacked bar chart:
    // [{ projectId, series: [{ status, count }, ...] }, ...]
    const grouped = {};
    for (const r of perProjectRows) {
      const pid = r.projectId;
      if (!grouped[pid]) grouped[pid] = {};
      grouped[pid][r.status || 'unknown'] = Number(r.count) || 0;
    }
    perProject = Object.entries(grouped).map(([pid, statuses]) => ({
      projectId: Number(pid),
      series: Object.entries(statuses).map(([status, count]) => ({ status, count })),
    }));
  }

  return {
    scope,
    projectId: projectId ? Number(projectId) : null,
    range: { from: from || null, to: to || null },
    projectStatus,
    taskStatus,
    ...(perProject ? { perProject } : {}),
  };
}

/**
 * PUBLIC_INTERFACE
 * Get leave statistics: by status (pending/approved/rejected), by type (if available), and utilization by user.
 */
async function getLeaveStats({ scope, user, query }) {
  /** This is a public function that aggregates leaves for visualization. */
  const { userId, from, to, includeUsers = 'false' } = query || {};
  const where = buildDateRange({ from, to }, 'createdAt');

  if (scope === 'self') {
    where.userId = user.id;
  } else if (scope === 'user' && userId) {
    where.userId = userId;
  } else {
    // org/team scope - no extra condition
  }

  // By status
  const byStatusRows = await Leave.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const byStatus = byStatusRows.map(r => ({
    status: r.status || 'unknown',
    count: Number(r.count) || 0,
  }));

  // If leave type column exists (common: type like 'sick', 'casual', 'vacation'), try to aggregate; otherwise safe fallback.
  let byType = [];
  try {
    const byTypeRows = await Leave.findAll({
      where,
      attributes: ['type', [fn('COUNT', col('id')), 'count']],
      group: ['type'],
      raw: true,
    });
    byType = byTypeRows.map(r => ({
      type: r.type || 'unknown',
      count: Number(r.count) || 0,
    }));
  } catch (e) {
    // likely no 'type' column; ignore
    byType = [];
  }

  let byUser = undefined;
  if (includeUsers === 'true' && (scope === 'org' || scope === 'team')) {
    const byUserRows = await Leave.findAll({
      where,
      attributes: ['userId', 'status', [fn('COUNT', col('id')), 'count']],
      group: ['userId', 'status'],
      raw: true,
    });
    const grouped = {};
    for (const r of byUserRows) {
      const uid = r.userId;
      if (!grouped[uid]) grouped[uid] = {};
      grouped[uid][r.status || 'unknown'] = Number(r.count) || 0;
    }
    byUser = Object.entries(grouped).map(([uid, statuses]) => ({
      userId: Number(uid),
      series: Object.entries(statuses).map(([status, count]) => ({ status, count })),
    }));
  }

  return {
    scope,
    range: { from: from || null, to: to || null },
    ...(userId ? { userId: Number(userId) } : {}),
    byStatus,
    ...(byType.length ? { byType } : {}),
    ...(byUser ? { byUser } : {}),
  };
}

module.exports = {
  getAttendanceSummary,
  getProjectTaskBreakdown,
  getLeaveStats,
};
