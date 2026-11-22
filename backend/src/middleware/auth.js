const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { dbAsync } = require('../database/db');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await dbAsync.get('SELECT id, name, email, mobile, role FROM Users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid session or user not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access forbidden: Admin privilege required.' });
  }
  next();
}

// Optional auth for public views that can customize if logged in
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await dbAsync.get('SELECT id, name, email, role FROM Users WHERE id = ?', [decoded.id]);
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth
};
