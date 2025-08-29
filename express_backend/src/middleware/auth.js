'use strict';

const authService = require('../services/auth');

// PUBLIC_INTERFACE
function authenticate(req, res, next) {
  /** Express middleware to authenticate requests via Bearer token in Authorization header. */
  try {
    const header = req.headers['authorization'] || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    }
    const payload = authService.verifyToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

// PUBLIC_INTERFACE
function authorize(roles = []) {
  /** Express middleware to authorize based on user roles. roles can be a string or array. */
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
