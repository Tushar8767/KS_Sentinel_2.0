/**
 * KS Sentinel 2.0 — Local Sentinel Agent Health Status
 * Module 3: Local Sentinel Agent
 *
 * Implements the Agent Health abstraction.
 *
 * NOTE: AGENT HEALTH is strictly distinct from MACHINE TELEMETRY.
 * Machine telemetry (CPU, RAM, Disk, Network, Process lists) belongs to Module 4.
 * This module reports only the health and status of the agent process itself.
 */

class AgentHealth {
  constructor(identity, lifecycle, capabilities, transport) {
    this.identity = identity;
    this.lifecycle = lifecycle;
    this.capabilities = capabilities;
    this.transport = transport;
    this.startedAt = Date.now();
  }

  getUptimeSeconds() {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  /**
   * Return a safe, non-sensitive health report of the agent process.
   */
  getHealthReport() {
    return {
      status: 'ok',
      agentId: this.identity.agentId,
      agentName: this.identity.agentName,
      agentVersion: this.identity.agentVersion,
      protocolVersion: this.identity.protocolVersion,
      platform: this.identity.platform,
      arch: this.identity.arch,
      lifecycleState: this.lifecycle.state,
      uptimeSeconds: this.getUptimeSeconds(),
      connected: this.transport ? this.transport.isConnected() : false,
      capabilitiesCount: this.capabilities.count,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  AgentHealth
};

