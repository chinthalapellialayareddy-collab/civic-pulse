const express = require('express');
const { dbAsync } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { findPotentialDuplicates } = require('../services/duplicateService');
const { sendEmail, getRegistrationConfirmationTemplate } = require('../services/emailService');
const { ruleBasedSummarize } = require('../services/aiService');

const router = express.Router();

// Generate readable unique complaint reference, e.g. CP-2026-83491
function generateComplaintId() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `CP-${year}-${randomNum}`;
}

// 1. Get logged-in citizen's complaints
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const complaints = await dbAsync.all(`
      SELECT c.*, d.department_name,
        (SELECT COUNT(*) FROM ComplaintSupports WHERE complaint_id = c.id) as support_count
      FROM Complaints c
      LEFT JOIN Departments d ON c.department_id = d.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('Fetch citizen complaints error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve your complaints.' });
  }
});

// 2. Submit a new civic complaint
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, category, description, address, latitude, longitude, priority } = req.body;

    if (!title || !category || !description || !address) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, description, and location address are mandatory.'
      });
    }

    const lat = latitude ? parseFloat(latitude) : 17.3850; // default Hyderabad central if not provided
    const lon = longitude ? parseFloat(longitude) : 78.4867;
    const complaintId = generateComplaintId();
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const assignedPriority = ['Low', 'Medium', 'High', 'Critical'].includes(priority) ? priority : 'Medium';
    const aiSummary = ruleBasedSummarize(description.trim());

    // Insert complaint
    const result = await dbAsync.run(`
      INSERT INTO Complaints (
        complaint_id, user_id, title, category, description,
        image_url, address, latitude, longitude, status, priority, ai_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
    `, [complaintId, req.user.id, title.trim(), category, description.trim(), imageUrl, address.trim(), lat, lon, assignedPriority, aiSummary]);

    const newId = result.lastID;

    // Record initial timeline entry
    await dbAsync.run(`
      INSERT INTO ComplaintUpdates (complaint_id, status, remarks)
      VALUES (?, 'Pending', 'Issue lodged by citizen. Awaiting municipal review.')
    `, [newId]);

    // Send in-app notification to the citizen
    await dbAsync.run(`
      INSERT INTO Notifications (user_id, complaint_id, message)
      VALUES (?, ?, ?)
    `, [
      req.user.id,
      complaintId,
      `Your grievance "${title}" has been registered (#${complaintId}). Our municipal team will inspect it soon.`
    ]);

    // Send email confirmation if configured
    sendEmail({
      to: req.user.email,
      subject: `Complaint Registered: ${complaintId} - CivicPulse`,
      html: getRegistrationConfirmationTemplate(req.user.name, complaintId, title, category)
    }).catch(e => console.warn('Email trigger notification error:', e.message));

    return res.status(201).json({
      success: true,
      message: 'Civic complaint registered successfully!',
      complaint: {
        id: newId,
        complaint_id: complaintId,
        title,
        category,
        status: 'Pending',
        priority: assignedPriority,
        address,
        imageUrl
      }
    });
  } catch (error) {
    console.error('Complaint submission error:', error);
    return res.status(500).json({ success: false, message: 'Could not register grievance due to server error.' });
  }
});

// 3. Check for duplicates before finalizing submission
router.post('/check-duplicate', authenticateToken, async (req, res) => {
  try {
    const { category, latitude, longitude, title, description } = req.body;
    
    if (!latitude || !longitude) {
      return res.json({ success: true, duplicates: [] });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // Fetch active complaints
    const activeComplaints = await dbAsync.all(`
      SELECT id, complaint_id, title, category, description, address, latitude, longitude, status, image_url, created_at,
        (SELECT COUNT(*) FROM ComplaintSupports WHERE complaint_id = Complaints.id) as support_count
      FROM Complaints
      WHERE status != 'Resolved'
    `);

    const duplicates = findPotentialDuplicates({
      title: title || '',
      category: category || '',
      description: description || '',
      latitude: lat,
      longitude: lon
    }, activeComplaints, 600); // 600m radius check

    return res.json({
      success: true,
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates.slice(0, 4) // Return top matches
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    return res.status(500).json({ success: false, message: 'Failed to evaluate potential duplicates.' });
  }
});

// 4. View single complaint details
router.get('/:id', async (req, res) => {
  try {
    const identifier = req.params.id;
    let query = 'SELECT c.*, d.department_name, u.name as citizen_name FROM Complaints c LEFT JOIN Departments d ON c.department_id = d.id LEFT JOIN Users u ON c.user_id = u.id WHERE ';
    
    let params = [];
    if (/^\d+$/.test(identifier)) {
      query += 'c.id = ?';
      params.push(parseInt(identifier, 10));
    } else {
      query += 'c.complaint_id = ?';
      params.push(identifier);
    }

    const complaint = await dbAsync.get(query, params);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Get upvotes / supports
    const supportRow = await dbAsync.get('SELECT COUNT(*) as count FROM ComplaintSupports WHERE complaint_id = ?', [complaint.id]);
    complaint.support_count = supportRow ? supportRow.count : 0;

    // Get timeline
    const timeline = await dbAsync.all(`
      SELECT cu.*, u.name as admin_name
      FROM ComplaintUpdates cu
      LEFT JOIN Users u ON cu.admin_id = u.id
      WHERE cu.complaint_id = ?
      ORDER BY cu.created_at ASC
    `, [complaint.id]);

    return res.json({
      success: true,
      complaint,
      timeline
    });
  } catch (error) {
    console.error('Complaint details error:', error);
    return res.status(500).json({ success: false, message: 'Error retrieving grievance details.' });
  }
});

// 5. Get timeline specifically
router.get('/:id/timeline', async (req, res) => {
  try {
    const identifier = req.params.id;
    const complaint = await dbAsync.get('SELECT id FROM Complaints WHERE id = ? OR complaint_id = ?', [identifier, identifier]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const timeline = await dbAsync.all(`
      SELECT cu.*, u.name as admin_name
      FROM ComplaintUpdates cu
      LEFT JOIN Users u ON cu.admin_id = u.id
      WHERE cu.complaint_id = ?
      ORDER BY cu.created_at ASC
    `, [complaint.id]);

    return res.json({ success: true, timeline });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch timeline.' });
  }
});

// 6. Upvote / Support an existing complaint
router.post('/:id/support', authenticateToken, async (req, res) => {
  try {
    const identifier = req.params.id;
    const complaint = await dbAsync.get('SELECT id, complaint_id, title FROM Complaints WHERE id = ? OR complaint_id = ?', [identifier, identifier]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Check if already supported
    const existing = await dbAsync.get('SELECT id FROM ComplaintSupports WHERE complaint_id = ? AND user_id = ?', [complaint.id, req.user.id]);
    
    if (existing) {
      // Toggle support: remove support
      await dbAsync.run('DELETE FROM ComplaintSupports WHERE id = ?', [existing.id]);
      const countRow = await dbAsync.get('SELECT COUNT(*) as count FROM ComplaintSupports WHERE complaint_id = ?', [complaint.id]);
      return res.json({
        success: true,
        supported: false,
        message: 'You have withdrawn your support for this issue.',
        supportCount: countRow.count
      });
    } else {
      // Add support
      await dbAsync.run('INSERT INTO ComplaintSupports (complaint_id, user_id) VALUES (?, ?)', [complaint.id, req.user.id]);
      const countRow = await dbAsync.get('SELECT COUNT(*) as count FROM ComplaintSupports WHERE complaint_id = ?', [complaint.id]);
      return res.json({
        success: true,
        supported: true,
        message: 'Thank you! You supported this civic issue. Prioritization weight increased.',
        supportCount: countRow.count
      });
    }
  } catch (error) {
    console.error('Support complaint error:', error);
    return res.status(500).json({ success: false, message: 'Could not process community support.' });
  }
});

module.exports = router;
