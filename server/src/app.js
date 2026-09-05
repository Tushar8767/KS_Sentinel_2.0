const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Gateway Health Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'KS Sentinel Secure Gateway',
    module: '0 — Architecture Foundation',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'KS Sentinel Gateway only exposes authorized capability endpoints.'
  });
});

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error('[GATEWAY ERROR]:', err.stack || err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An internal gateway error occurred.'
  });
});

module.exports = app;

