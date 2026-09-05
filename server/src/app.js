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

const { agentRegistry } = require('./agentRegistry');

// --- Agent Communication Foundation (Module 3) ---

// Get Agent Connection Status (Consumed by Dashboard / Web OS)
app.get('/api/agent/status', (req, res) => {
  const status = agentRegistry.getStatus();
  res.status(200).json(status);
});

// --- Remote Machine Information (Module 4) ---

// Safe Read-Only Machine Telemetry (Consumed by Dashboard / Web OS)
app.get('/api/machine/info', (req, res) => {
  const machineInfo = agentRegistry.getMachineInfo();
  res.status(200).json(machineInfo);
});

// Agent Handshake / Registration (Called by Local Sentinel Agent)
app.post('/api/agent/register', (req, res) => {
  try {
    const result = agentRegistry.registerAgent(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      error: 'Registration Failed',
      message: err.message
    });
  }
});

// Agent Periodic Heartbeat
app.post('/api/agent/heartbeat', (req, res) => {
  try {
    const result = agentRegistry.processHeartbeat(req.body);
    if (result.status === 'unregistered') {
      return res.status(404).json(result);
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      error: 'Heartbeat Failed',
      message: err.message
    });
  }
});

// Agent Disconnect Notification
app.post('/api/agent/disconnect', (req, res) => {
  const { agentId, reason } = req.body || {};
  const result = agentRegistry.disconnectAgent(agentId, reason);
  res.status(200).json(result);
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

