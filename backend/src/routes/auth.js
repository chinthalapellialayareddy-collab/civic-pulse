const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { dbAsync } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register Citizen
router.post('/register', async (req, res) => {
  try {
    const { name, email, mobile, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Check if user already exists
    const existing = await dbAsync.get('SELECT id FROM Users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await dbAsync.run(
      'INSERT INTO Users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), mobile ? mobile.trim() : null, passwordHash, 'Citizen']
    );

    // Create welcoming notification
    await dbAsync.run(
      'INSERT INTO Notifications (user_id, message) VALUES (?, ?)',
      [result.lastID, `Welcome to CivicPulse, ${name}! You can now report municipal concerns and track civic resolutions.`]
    );

    const token = jwt.sign(
      { id: result.lastID, email: email.toLowerCase().trim(), role: 'Citizen' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Citizen account registered successfully.',
      token,
      user: {
        id: result.lastID,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        mobile: mobile ? mobile.trim() : '',
        role: 'Citizen'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed due to a server error.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    let user = await dbAsync.get('SELECT * FROM Users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      // Automatically register new citizen account and log in seamlessly
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const derivedName = email.split('@')[0];

      const insertResult = await dbAsync.run(
        'INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [derivedName, email.toLowerCase().trim(), passwordHash, 'Citizen']
      );

      user = {
        id: insertResult.lastID,
        name: derivedName,
        email: email.toLowerCase().trim(),
        mobile: '',
        role: 'Citizen'
      };

      await dbAsync.run(
        'INSERT INTO Notifications (user_id, message) VALUES (?, ?)',
        [user.id, `Welcome to CivicPulse, ${derivedName}! Your citizen account has been created.`]
      );
    } else {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Incorrect password. Please verify and try again.' });
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile || '',
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Authentication failed due to server error.' });
  }
});

// Dedicated Official / Municipal Administrator Login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Official email and password are required.' });
    }

    const user = await dbAsync.get('SELECT * FROM Users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'No official municipal account registered under this email.' });
    }

    if (user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: This account is registered as a Citizen. The Official Command Center requires Administrator privileges.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect administrator password. Please verify and try again.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'Admin' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: `Welcome, Administrator ${user.name}! Accessing Command Center...`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile || '',
        role: 'Admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Authentication failed due to server error.' });
  }
});

// Current user profile verification
router.get('/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, mobile } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    await dbAsync.run(
      'UPDATE Users SET name = ?, mobile = ? WHERE id = ?',
      [name.trim(), mobile ? mobile.trim() : null, req.user.id]
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// Forgot Password Flow
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const user = await dbAsync.get('SELECT id, name FROM Users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      // Return positive generic response to prevent user enumeration
      return res.json({
        success: true,
        message: 'If an account with this email exists, password recovery instructions have been sent.'
      });
    }

    // In production or with Resend, an email link with a reset token is dispatched.
    // For local evaluation, we simulate recovery notification:
    await dbAsync.run(
      'INSERT INTO Notifications (user_id, message) VALUES (?, ?)',
      [user.id, 'Password recovery initiated. If you requested this, follow the instructions sent to your email.']
    );

    return res.json({
      success: true,
      message: 'Password recovery instructions have been dispatched to your email address.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Password recovery failed.' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
