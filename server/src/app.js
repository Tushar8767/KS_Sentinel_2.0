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

// --- Sentinel Workspace Management (Module 5) ---
const { workspaceStore } = require('./workspaceStore');
workspaceStore.setAgentRegistry(agentRegistry);

// List All Workspaces
app.get('/api/workspaces', (req, res) => {
  const list = workspaceStore.listWorkspaces();
  res.status(200).json(list);
});

// Get Active Workspace
app.get('/api/workspaces/active', (req, res) => {
  const active = workspaceStore.getActiveWorkspace();
  if (!active) {
    return res.status(200).json({ active: false, workspace: null });
  }
  res.status(200).json({ active: true, workspace: active });
});

// Create Workspace
app.post('/api/workspaces', (req, res) => {
  try {
    const ws = workspaceStore.createWorkspace(req.body || {});
    res.status(201).json(ws);
  } catch (err) {
    res.status(400).json({
      error: 'Workspace Creation Failed',
      message: err.message
    });
  }
});

// Get Workspace by ID
app.get('/api/workspaces/:id', (req, res) => {
  const ws = workspaceStore.getWorkspace(req.params.id);
  if (!ws) {
    return res.status(404).json({
      error: 'Workspace Not Found',
      message: `No workspace exists with id: ${req.params.id}`
    });
  }
  res.status(200).json(ws);
});

// Open / Activate Workspace
app.post('/api/workspaces/:id/open', (req, res) => {
  try {
    const ws = workspaceStore.openWorkspace(req.params.id);
    res.status(200).json(ws);
  } catch (err) {
    res.status(404).json({
      error: 'Cannot Open Workspace',
      message: err.message
    });
  }
});

// Alternate alias for activate
app.post('/api/workspaces/:id/activate', (req, res) => {
  try {
    const ws = workspaceStore.switchWorkspace(req.params.id);
    res.status(200).json(ws);
  } catch (err) {
    res.status(404).json({
      error: 'Cannot Activate Workspace',
      message: err.message
    });
  }
});

// Close Workspace
app.post('/api/workspaces/:id/close', (req, res) => {
  try {
    const ws = workspaceStore.closeWorkspace(req.params.id);
    res.status(200).json(ws);
  } catch (err) {
    res.status(404).json({
      error: 'Cannot Close Workspace',
      message: err.message
    });
  }
});

// Update Workspace Metadata
app.patch('/api/workspaces/:id', (req, res) => {
  try {
    const ws = workspaceStore.updateWorkspace(req.params.id, req.body || {});
    res.status(200).json(ws);
  } catch (err) {
    res.status(400).json({
      error: 'Workspace Update Failed',
      message: err.message
    });
  }
});

// Delete Workspace
app.delete('/api/workspaces/:id', (req, res) => {
  try {
    const result = workspaceStore.deleteWorkspace(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      error: 'Workspace Deletion Failed',
      message: err.message
    });
  }
});

// --- Sentinel Projects Management (Module 6) ---
const { projectStore } = require('./projectStore');
projectStore.setWorkspaceStore(workspaceStore);
workspaceStore.setProjectStore(projectStore);

// List Projects (Scoped to workspace)
app.get('/api/projects', (req, res) => {
  const wsId = req.query.workspaceId || null;
  const list = projectStore.listProjects(wsId);
  res.status(200).json(list);
});

// Get Active Project
app.get('/api/projects/active', (req, res) => {
  const wsId = req.query.workspaceId || null;
  const active = projectStore.getActiveProject(wsId);
  if (!active) {
    return res.status(200).json({ active: false, project: null });
  }
  res.status(200).json({ active: true, project: active });
});

// Create Project
app.post('/api/projects', (req, res) => {
  try {
    const proj = projectStore.createProject(req.body || {});
    res.status(201).json(proj);
  } catch (err) {
    res.status(400).json({
      error: 'Project Creation Failed',
      message: err.message
    });
  }
});

// Get Project by ID
app.get('/api/projects/:id', (req, res) => {
  const proj = projectStore.getProject(req.params.id);
  if (!proj) {
    return res.status(404).json({
      error: 'Project Not Found',
      message: `No project exists with id: ${req.params.id}`
    });
  }
  res.status(200).json(proj);
});

// Open / Activate Project
app.post('/api/projects/:id/open', (req, res) => {
  try {
    const proj = projectStore.openProject(req.params.id);
    res.status(200).json(proj);
  } catch (err) {
    res.status(404).json({
      error: 'Cannot Open Project',
      message: err.message
    });
  }
});

// Alternate alias for activate
app.post('/api/projects/:id/activate', (req, res) => {
  try {
    const proj = projectStore.switchProject(req.params.id);
    res.status(200).json(proj);
  } catch (err) {
    res.status(404).json({
      error: 'Cannot Activate Project',
      message: err.message
    });
  }
});

// Close Project
app.post('/api/projects/:id/close', (req, res) => {
  try {
    const proj = projectStore.closeProject(req.params.id);
    res.status(200).json(proj);
  } catch (err) {
    res.status(404).json({
      error: 'Cannot Close Project',
      message: err.message
    });
  }
});

// Update Project Metadata
app.patch('/api/projects/:id', (req, res) => {
  try {
    const proj = projectStore.updateProject(req.params.id, req.body || {});
    res.status(200).json(proj);
  } catch (err) {
    res.status(400).json({
      error: 'Project Update Failed',
      message: err.message
    });
  }
});

// Delete Project
app.delete('/api/projects/:id', (req, res) => {
  try {
    const result = projectStore.deleteProject(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      error: 'Project Deletion Failed',
      message: err.message
    });
  }
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

