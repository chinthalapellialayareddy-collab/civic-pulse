const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./src/config/env');
const { initDb } = require('./src/database/db');

// Route Handlers
const authRoutes = require('./src/routes/auth');
const complaintRoutes = require('./src/routes/complaints');
const publicRoutes = require('./src/routes/public');
const aiRoutes = require('./src/routes/ai');
const adminRoutes = require('./src/routes/admin');
const notificationRoutes = require('./src/routes/notifications');
const chatbotRoutes = require('./src/routes/chatbot');

const app = express();

// Initialize Database schema
initDb();

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allow Leaflet CDN maps, OSM tiles, unpkg, ChartJS, fontawesome
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Express Rate Limiter for general safety
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this client, please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// Serve Static Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend Files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routing Mounts
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'CivicPulse Platform API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Fallback route for SPA or Direct navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const targetFile = path.join(frontendPath, req.path.endsWith('.html') ? req.path : `${req.path}.html`);
  const fs = require('fs');
  if (fs.existsSync(targetFile)) {
    return res.sendFile(targetFile);
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CIVICPULSE BACKEND & STATIC SERVER RUNNING`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🏙️  Database: SQLite active at ${config.databasePath}`);
  console.log(`🤖 AI Engine: ${config.geminiApiKey ? 'Google Gemini 1.5' : config.groqApiKey ? 'Groq Llama 3.3' : 'Rule-Based Engine (Fallback Mode)'}`);
  console.log(`====================================================`);
});
