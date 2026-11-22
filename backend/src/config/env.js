require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'civicpulse_fallback_secret_key_2026',
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '../database/civicpulse.db'),
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@civicpulse.gov').toLowerCase().trim(),
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000'
};
