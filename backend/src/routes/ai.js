const express = require('express');
const { analyzeComplaint, improveDescription, ruleBasedClassify, ruleBasedSummarize } = require('../services/aiService');
const { findPotentialDuplicates } = require('../services/duplicateService');
const { dbAsync } = require('../database/db');

const router = express.Router();

// 1. Classify Category & Priority from Description
router.post('/classify', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!description && !title) {
      return res.status(400).json({ success: false, message: 'Title or description required.' });
    }

    const analysis = await analyzeComplaint(title, description);
    return res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('AI classify route error:', error);
    const fallback = ruleBasedClassify(req.body.description || req.body.title || '');
    return res.json({
      success: true,
      data: {
        isAiPowered: false,
        source: 'Rule-Based Engine (Fallback)',
        ...fallback
      }
    });
  }
});

// 2. Summarize Long Complaint
router.post('/summarize', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required to summarize.' });
    }

    const analysis = await analyzeComplaint('', text);
    return res.json({
      success: true,
      summary: analysis.summary,
      source: analysis.source
    });
  } catch (error) {
    const fallback = ruleBasedSummarize(req.body.text || '');
    return res.json({
      success: true,
      summary: fallback,
      source: 'Rule-Based Engine (Fallback)'
    });
  }
});

// 3. Priority Suggestion
router.post('/priority-suggestion', async (req, res) => {
  try {
    const { title, description } = req.body;
    const analysis = await analyzeComplaint(title, description);
    return res.json({
      success: true,
      priority: analysis.priority,
      reason: analysis.reason,
      source: analysis.source
    });
  } catch (error) {
    return res.json({
      success: true,
      priority: 'Medium',
      reason: 'Standard municipal turnaround.',
      source: 'Default Rule Fallback'
    });
  }
});

// 4. Duplicate Check
router.post('/duplicate-check', async (req, res) => {
  try {
    const { title, description, category, latitude, longitude } = req.body;
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
      latitude: parseFloat(latitude || 0),
      longitude: parseFloat(longitude || 0)
    }, activeComplaints, 600);

    return res.json({
      success: true,
      matches: duplicates
    });
  } catch (error) {
    console.error('Duplicate check AI route error:', error);
    return res.status(500).json({ success: false, message: 'Failed to perform similarity check.' });
  }
});

// 5. Improve Description with AI
router.post('/improve-description', async (req, res) => {
  try {
    const { description, category, title, language } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required to improve.' });
    }

    const result = await improveDescription({
      description,
      category,
      title,
      language
    });

    return res.json({
      success: true,
      improvedText: result.improvedText,
      source: result.source,
      language: result.language
    });
  } catch (error) {
    console.error('Improve description error:', error);
    return res.status(500).json({ success: false, message: 'Failed to polish description.' });
  }
});

module.exports = router;
