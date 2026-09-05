/**
 * KS Sentinel 2.0 — Local Sentinel Agent Identity
 * Module 3: Local Sentinel Agent
 *
 * Provides a stable, non-sensitive identity for the local agent instance.
 * Strictly excludes any private credentials, user directories, or secrets.
 */

const config = require('./config');

const AGENT_VERSION = '2.0.0';
const PROTOCOL_VERSION = '1.0';

class AgentIdentity {
  constructor(customConfig = {}) {
    this.agentId = customConfig.agentId || config.agentId;
    this.agentName = customConfig.agentName || config.agentName;
    this.agentVersion = AGENT_VERSION;
    this.protocolVersion = PROTOCOL_VERSION;
    this.platform = process.platform;
    this.arch = process.arch;
    this.nodeVersion = process.version;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Return clean JSON serializable identity payload for gateway registration.
   */
  toJSON() {
    return {
      agentId: this.agentId,
      agentName: this.agentName,
      agentVersion: this.agentVersion,
      protocolVersion: this.protocolVersion,
      platform: this.platform,
      arch: this.arch,
      nodeVersion: this.nodeVersion,
      createdAt: this.createdAt
    };
  }
}

module.exports = {
  AgentIdentity,
  AGENT_VERSION,
  PROTOCOL_VERSION
};

