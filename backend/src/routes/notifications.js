const express = require('express');
const { dbAsync } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Get current citizen's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await dbAsync.all(`
      SELECT * FROM Notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);

    const unreadRow = await dbAsync.get(`
      SELECT COUNT(*) as unread FROM Notifications
      WHERE user_id = ? AND is_read = 0
    `, [req.user.id]);

    return res.json({
      success: true,
      unreadCount: unreadRow ? unreadRow.unread : 0,
      notifications
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// 2. Mark specific notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    await dbAsync.run(`
      UPDATE Notifications SET is_read = 1
      WHERE id = ? AND user_id = ?
    `, [req.params.id, req.user.id]);

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

// 3. Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await dbAsync.run(`
      UPDATE Notifications SET is_read = 1
      WHERE user_id = ?
    `, [req.user.id]);

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
  }
});

module.exports = router;
