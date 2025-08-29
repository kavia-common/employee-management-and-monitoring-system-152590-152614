'use strict';

/**
 * Analytics Controller
 * Exposes handlers for analytics/reporting routes.
 */

const analyticsService = require('../services/analytics');

/**
 * Determine scope based on user role and query intent.
 * - self: current user
 * - user: specific user (if allowed)
 * - team/org: broader reports (manager/superadmin/team_leader with appropriate permissions)
 */
function resolveScope(req) {
  const roles = (req.user && req.user.roles) || []; // e.g., ['employee','manager']
  const isAdminLike = roles.includes('superadmin') || roles.includes('manager');
  const isLead = roles.includes('team_leader');

  // explicit scope query
  const scope = (req.query.scope || '').toLowerCase();
  if (scope === 'self') return 'self';
  if (scope === 'user') return 'user';
  if (scope === 'team') return isAdminLike || isLead ? 'team' : 'self';
  if (scope === 'org') return isAdminLike ? 'org' : (isLead ? 'team' : 'self');

  // default: employees get self, leads get team, admins get org
  if (isAdminLike) return 'org';
  if (isLead) return 'team';
  return 'self';
}

// PUBLIC_INTERFACE
async function attendanceSummary(req, res, next) {
  /** Returns attendance summaries for charts and tables. RBAC enforced via scope resolution. */
  try {
    const scope = resolveScope(req);
    // Additional RBAC strictness: if scope is 'user' but not admin-like/lead and target not self, forbid
    if (scope === 'user') {
      const target = Number(req.query.userId);
      if (!target || (req.user && target !== req.user.id)) {
        return res.status(403).json({ message: 'Forbidden: cannot access other user attendance' });
      }
    }
    const payload = await analyticsService.getAttendanceSummary({ scope, user: req.user, query: req.query });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

// PUBLIC_INTERFACE
async function projectTaskBreakdown(req, res, next) {
  /** Returns project and task status breakdowns for visualization. RBAC enforced via scope resolution. */
  try {
    const scope = resolveScope(req);
    const roles = (req.user && req.user.roles) || [];
    const isAdminLike = roles.includes('superadmin') || roles.includes('manager');
    const isLead = roles.includes('team_leader');

    // For org-level overviews, ensure admin-like
    if (scope === 'org' && !isAdminLike) {
      return res.status(403).json({ message: 'Forbidden: org reports require manager/superadmin' });
    }

    // Team scope allowed for team leaders
    if (scope === 'team' && !(isAdminLike || isLead)) {
      return res.status(403).json({ message: 'Forbidden: team reports require team_leader or higher' });
    }

    const payload = await analyticsService.getProjectTaskBreakdown({ scope, user: req.user, query: req.query });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

// PUBLIC_INTERFACE
async function leaveStats(req, res, next) {
  /** Returns leave statistics by status/type and optionally per-user. RBAC enforced via scope resolution. */
  try {
    const scope = resolveScope(req);
    const roles = (req.user && req.user.roles) || [];
    const isAdminLike = roles.includes('superadmin') || roles.includes('manager');
    const isLead = roles.includes('team_leader');

    // For org-level or per-user (other than self) reports, enforce role
    if (scope === 'org' && !isAdminLike) {
      return res.status(403).json({ message: 'Forbidden: org reports require manager/superadmin' });
    }
    if (scope === 'team' && !(isAdminLike || isLead)) {
      return res.status(403).json({ message: 'Forbidden: team reports require team_leader or higher' });
    }
    if (scope === 'user') {
      const target = Number(req.query.userId);
      if (!target || (req.user && target !== req.user.id && !(isAdminLike || isLead))) {
        return res.status(403).json({ message: 'Forbidden: cannot access other user leaves' });
      }
    }

    const payload = await analyticsService.getLeaveStats({ scope, user: req.user, query: req.query });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  attendanceSummary,
  projectTaskBreakdown,
  leaveStats,
};
