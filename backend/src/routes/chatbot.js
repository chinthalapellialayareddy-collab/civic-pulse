const express = require('express');
const config = require('../config/env');
const { optionalAuth } = require('../middleware/auth');
const { generateCivicBotResponse } = require('../services/aiService');

const router = express.Router();

// 1. Chatbot Health & Provider Status (Never exposes secrets!)
router.get('/health', (req, res) => {
  const hasGemini = Boolean(config.geminiApiKey && config.geminiApiKey.trim());
  const hasGroq = Boolean(config.groqApiKey && config.groqApiKey.trim());

  let activeProvider = 'Rule-Based Engine (Fallback)';
  if (hasGemini) {
    activeProvider = 'Google Gemini 1.5 Flash (Primary)';
  } else if (hasGroq) {
    activeProvider = 'Groq Llama 3.3 Versatile (Primary)';
  }

  return res.json({
    status: 'ONLINE',
    service: 'CivicBot Conversational AI',
    activeProvider,
    providers: {
      gemini: {
        configured: hasGemini,
        model: 'gemini-1.5-flash',
        role: 'Primary'
      },
      groq: {
        configured: hasGroq,
        model: 'llama-3.3-70b-versatile',
        role: hasGemini ? 'Backup' : 'Primary'
      },
      ruleBased: {
        configured: true,
        role: 'Offline / Built-in Fallback',
        languages: ['English', 'Telugu (తెలుగు)']
      }
    },
    capabilities: [
      'Potholes & Road Damage',
      'Garbage Overflow',
      'Water Leakage',
      'Streetlight Failure',
      'Drainage & Sewage Issues',
      'Personal Complaint Live Tracking',
      'Public Grievance Summaries',
      'Duplicate Detection Guidance',
      'Bilingual English & Telugu'
    ]
  });
});

// 2. Chatbot Message Endpoint
router.post('/message', optionalAuth, async (req, res) => {
  try {
    const { message, language = 'en', conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required.'
      });
    }

    const response = await generateCivicBotResponse({
      message: message.trim(),
      language: language || 'en',
      user: req.user || null,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : []
    });

    return res.json({
      success: true,
      reply: response.reply,
      provider: response.provider,
      language: response.language || language,
      userAuthenticated: Boolean(req.user),
      userName: req.user ? req.user.name : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CivicBot message processing error:', error);
    return res.status(500).json({
      success: false,
      reply: 'CivicBot encountered a temporary processing delay. Please try again or visit the Report Grievance page directly.',
      provider: 'Emergency Fallback'
    });
  }
});

module.exports = router;
