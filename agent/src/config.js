/**
 * KS Sentinel 2.0 — Local Sentinel Agent Configuration
 * Module 3: Local Sentinel Agent
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env from agent root if present
dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
  gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:5000',
  agentId: process.env.AGENT_ID || `sentinel_agent_${process.platform}_${process.pid || 'local'}`,
  agentName: process.env.AGENT_NAME || 'Local Sentinel Host Service',
  heartbeatIntervalMs: Math.max(1000, parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 5000),
  nodeEnv: process.env.NODE_ENV || 'development'
};

module.exports = config;

