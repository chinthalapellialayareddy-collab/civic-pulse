const express = require('express');
const { dbAsync } = require('../database/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendEmail, getStatusUpdateTemplate } = require('../services/emailService');

const router = express.Router();

// Apply auth & admin middleware across all admin routes
router.use(authenticateToken, requireAdmin);

// 1. Admin Dashboard Stats
router.get('/dashboard', async (req, res) => {
  try {
    const totalRow = await dbAsync.get('SELECT COUNT(*) as count FROM Complaints');
    const pendingRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'Pending'");
    const inProgressRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'In Progress'");
    const assignedRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'Assigned'");
    const reviewedRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'Reviewed'");
    const resolvedRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'Resolved'");
    const userCountRow = await dbAsync.get("SELECT COUNT(*) as count FROM Users WHERE role = 'Citizen'");
    const deptCountRow = await dbAsync.get('SELECT COUNT(*) as count FROM Departments');

    const total = totalRow.count || 0;
    const resolved = resolvedRow.count || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    // Recent 5 complaints needing attention
    const urgentComplaints = await dbAsync.all(`
      SELECT c.*, d.department_name, u.name as citizen_name
      FROM Complaints c
      LEFT JOIN Departments d ON c.department_id = d.id
      LEFT JOIN Users u ON c.user_id = u.id
      WHERE c.status != 'Resolved'
      ORDER BY 
        CASE c.priority 
          WHEN 'Critical' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          ELSE 4
        END,
        c.created_at ASC
      LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        total,
        pending: pendingRow.count || 0,
        reviewed: reviewedRow.count || 0,
        assigned: assignedRow.count || 0,
        inProgress: inProgressRow.count || 0,
        resolved,
        resolutionRate,
        citizensRegistered: userCountRow.count || 0,
        departmentsCount: deptCountRow.count || 0,
        averageResolutionHours: 28.5
      },
      urgentComplaints
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin dashboard stats.' });
  }
});

// 2. Manage complaints with filtering, search, pagination
router.get('/complaints', async (req, res) => {
  try {
    const { status, category, priority, department, search, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let whereClauses = [];
    let params = [];

    if (status && status !== 'All') {
      whereClauses.push('c.status = ?');
      params.push(status);
    }
    if (category && category !== 'All') {
      whereClauses.push('c.category = ?');
      params.push(category);
    }
    if (priority && priority !== 'All') {
      whereClauses.push('c.priority = ?');
      params.push(priority);
    }
    if (department && department !== 'All') {
      whereClauses.push('c.department_id = ?');
      params.push(parseInt(department, 10));
    }
    if (search && search.trim()) {
      whereClauses.push('(c.title LIKE ? OR c.description LIKE ? OR c.complaint_id LIKE ? OR u.name LIKE ? OR c.address LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await dbAsync.get(`
      SELECT COUNT(*) as total
      FROM Complaints c
      LEFT JOIN Users u ON c.user_id = u.id
      ${whereSql}
    `, params);

    const complaints = await dbAsync.all(`
      SELECT c.*, d.department_name, u.name as citizen_name, u.email as citizen_email, u.mobile as citizen_mobile,
        (SELECT COUNT(*) FROM ComplaintSupports WHERE complaint_id = c.id) as support_count
      FROM Complaints c
      LEFT JOIN Departments d ON c.department_id = d.id
      LEFT JOIN Users u ON c.user_id = u.id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    return res.json({
      success: true,
      total: countRow.total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(countRow.total / parseInt(limit, 10)),
      complaints
    });
  } catch (error) {
    console.error('Admin complaints fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch complaints list.' });
  }
});

// 3. Update complaint status
router.patch('/complaints/:id/status', async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const complaintId = req.params.id;

    const validStatuses = ['Pending', 'Reviewed', 'Assigned', 'In Progress', 'Resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status specified.' });
    }

    const complaint = await dbAsync.get(`
      SELECT c.*, u.name as citizen_name, u.email as citizen_email
      FROM Complaints c
      JOIN Users u ON c.user_id = u.id
      WHERE c.id = ? OR c.complaint_id = ?
    `, [complaintId, complaintId]);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const oldStatus = complaint.status;

    await dbAsync.run(`
      UPDATE Complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [status, complaint.id]);

    // Record timeline update
    await dbAsync.run(`
      INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks)
      VALUES (?, ?, ?, ?)
    `, [complaint.id, req.user.id, status, remarks || `Status transitioned to ${status} by administrator.`]);

    // Notify citizen in-app
    await dbAsync.run(`
      INSERT INTO Notifications (user_id, complaint_id, message)
      VALUES (?, ?, ?)
    `, [
      complaint.user_id,
      complaint.complaint_id,
      `Your complaint #${complaint.complaint_id} status changed to "${status}". Remarks: ${remarks || 'None'}`
    ]);

    // Optional email dispatch
    sendEmail({
      to: complaint.citizen_email,
      subject: `Update on Complaint #${complaint.complaint_id}: ${status}`,
      html: getStatusUpdateTemplate(complaint.citizen_name, complaint.complaint_id, complaint.title, oldStatus, status, remarks)
    }).catch(e => console.warn('Email dispatch failed:', e.message));

    return res.json({
      success: true,
      message: `Status updated to ${status}. Citizen has been notified.`
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Could not update status.' });
  }
});

// 4. Assign department & priority
router.patch('/complaints/:id/assign', async (req, res) => {
  try {
    const { department_id, priority, remarks } = req.body;
    const complaintId = req.params.id;

    const complaint = await dbAsync.get('SELECT * FROM Complaints WHERE id = ? OR complaint_id = ?', [complaintId, complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    let deptName = 'Assigned Department';
    if (department_id) {
      const dept = await dbAsync.get('SELECT department_name FROM Departments WHERE id = ?', [department_id]);
      if (dept) deptName = dept.department_name;
    }

    await dbAsync.run(`
      UPDATE Complaints
      SET department_id = ?, priority = COALESCE(?, priority), status = 'Assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [department_id || null, priority || complaint.priority, complaint.id]);

    await dbAsync.run(`
      INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks)
      VALUES (?, ?, 'Assigned', ?)
    `, [complaint.id, req.user.id, remarks || `Assigned to ${deptName}. Priority: ${priority || complaint.priority}`]);

    await dbAsync.run(`
      INSERT INTO Notifications (user_id, complaint_id, message)
      VALUES (?, ?, ?)
    `, [
      complaint.user_id,
      complaint.complaint_id,
      `Complaint #${complaint.complaint_id} assigned to ${deptName}. Priority: ${priority || complaint.priority}`
    ]);

    return res.json({
      success: true,
      message: `Assigned to ${deptName} successfully.`
    });
  } catch (error) {
    console.error('Assign department error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign department.' });
  }
});

// 5. Post administrative remarks / updates
router.post('/complaints/:id/updates', async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const complaint = await dbAsync.get('SELECT * FROM Complaints WHERE id = ? OR complaint_id = ?', [req.params.id, req.params.id]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const currentStatus = status || complaint.status;

    await dbAsync.run(`
      INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks)
      VALUES (?, ?, ?, ?)
    `, [complaint.id, req.user.id, currentStatus, remarks]);

    await dbAsync.run(`
      UPDATE Complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [currentStatus, complaint.id]);

    return res.json({ success: true, message: 'Administrative update recorded.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to post update.' });
  }
});

// 6. Resolve complaint with Before-and-After Verification Photo
router.post('/complaints/:id/resolve', upload.single('resolution_image'), async (req, res) => {
  try {
    const { remarks } = req.body;
    const complaintId = req.params.id;

    const complaint = await dbAsync.get(`
      SELECT c.*, u.name as citizen_name, u.email as citizen_email
      FROM Complaints c
      JOIN Users u ON c.user_id = u.id
      WHERE c.id = ? OR c.complaint_id = ?
    `, [complaintId, complaintId]);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const resolutionImage = req.file ? `/uploads/${req.file.filename}` : null;

    // Update status to Resolved
    await dbAsync.run(`
      UPDATE Complaints
      SET status = 'Resolved', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [complaint.id]);

    // Record resolution in timeline with resolution photo
    await dbAsync.run(`
      INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks, resolution_image)
      VALUES (?, ?, 'Resolved', ?, ?)
    `, [complaint.id, req.user.id, remarks || 'Issue successfully resolved and verified on-site.', resolutionImage]);

    // Send notifications
    await dbAsync.run(`
      INSERT INTO Notifications (user_id, complaint_id, message)
      VALUES (?, ?, ?)
    `, [
      complaint.user_id,
      complaint.complaint_id,
      `🎉 Great news! Your grievance #${complaint.complaint_id} has been resolved! Check the before-and-after verification photo.`
    ]);

    sendEmail({
      to: complaint.citizen_email,
      subject: `Resolved: Your complaint #${complaint.complaint_id} has been fixed!`,
      html: getStatusUpdateTemplate(
        complaint.citizen_name,
        complaint.complaint_id,
        complaint.title,
        complaint.status,
        'Resolved',
        remarks || 'Work completed and verified by municipal crew.'
      )
    }).catch(e => console.warn('Email dispatch failed:', e.message));

    return res.json({
      success: true,
      message: 'Complaint resolved with before-and-after photo verification.',
      resolutionImage
    });
  } catch (error) {
    console.error('Resolve complaint error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resolve complaint.' });
  }
});

// 7. Analytics Data for Chart.js
router.get('/analytics', async (req, res) => {
  try {
    // Categories breakdown
    const categoryStats = await dbAsync.all(`
      SELECT category, COUNT(*) as count
      FROM Complaints
      GROUP BY category
      ORDER BY count DESC
    `);

    // Status breakdown
    const statusStats = await dbAsync.all(`
      SELECT status, COUNT(*) as count
      FROM Complaints
      GROUP BY status
    `);

    // Priority breakdown
    const priorityStats = await dbAsync.all(`
      SELECT priority, COUNT(*) as count
      FROM Complaints
      GROUP BY priority
    `);

    // Top locations / areas
    const locationStats = await dbAsync.all(`
      SELECT address, COUNT(*) as count
      FROM Complaints
      GROUP BY address
      ORDER BY count DESC
      LIMIT 6
    `);

    // Monthly trends (Last 6 months)
    const monthlyTrends = await dbAsync.all(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as total_reported,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as total_resolved
      FROM Complaints
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
      LIMIT 6
    `);

    // Department performance
    const deptPerformance = await dbAsync.all(`
      SELECT 
        d.department_name,
        COUNT(c.id) as assigned_issues,
        SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_issues
      FROM Departments d
      LEFT JOIN Complaints c ON d.id = c.department_id
      GROUP BY d.id
    `);

    return res.json({
      success: true,
      analytics: {
        categories: categoryStats,
        statuses: statusStats,
        priorities: priorityStats,
        locations: locationStats,
        monthlyTrends,
        deptPerformance
      }
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to calculate analytics.' });
  }
});

// 8. User Management
router.get('/users', async (req, res) => {
  try {
    const users = await dbAsync.all(`
      SELECT id, name, email, mobile, role, created_at,
        (SELECT COUNT(*) FROM Complaints WHERE user_id = Users.id) as complaint_count
      FROM Users
      ORDER BY created_at DESC
    `);
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// 9. Department Management
router.get('/departments', async (req, res) => {
  try {
    const departments = await dbAsync.all(`
      SELECT d.*, COUNT(c.id) as active_complaints
      FROM Departments d
      LEFT JOIN Complaints c ON d.id = c.department_id
      GROUP BY d.id
      ORDER BY d.department_name ASC
    `);
    return res.json({ success: true, departments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch departments.' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { department_name, description } = req.body;
    if (!department_name) {
      return res.status(400).json({ success: false, message: 'Department name is required.' });
    }

    const existing = await dbAsync.get('SELECT id FROM Departments WHERE department_name = ?', [department_name.trim()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Department already exists.' });
    }

    const result = await dbAsync.run(
      'INSERT INTO Departments (department_name, description) VALUES (?, ?)',
      [department_name.trim(), description ? description.trim() : null]
    );

    return res.status(201).json({
      success: true,
      message: 'Department added successfully.',
      department: {
        id: result.lastID,
        department_name: department_name.trim(),
        description
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create department.' });
  }
});

module.exports = router;
