/**
 * KS Sentinel 2.0 — Gateway Agent Registry
 * Module 3: Local Sentinel Agent
 *
 * In-memory state tracking for connected local agent instances.
 */

// Stale timeout: if no heartbeat received within 15 seconds, mark agent offline
const HEARTBEAT_TIMEOUT_MS = 15000;

class GatewayAgentRegistry {
  constructor() {
    this.activeAgent = null;
  }

  /**
   * Register or update an agent.
   */
  registerAgent(payload) {
    if (!payload || !payload.agentId || !payload.protocolVersion) {
      throw new Error('Invalid agent registration payload: agentId and protocolVersion required.');
    }

    this.activeAgent = {
      agentId: String(payload.agentId),
      agentName: String(payload.agentName || 'Local Sentinel Agent'),
      agentVersion: String(payload.agentVersion || '2.0.0'),
      protocolVersion: String(payload.protocolVersion),
      platform: String(payload.platform || 'unknown'),
      arch: String(payload.arch || 'unknown'),
      nodeVersion: String(payload.nodeVersion || 'unknown'),
      capabilities: Array.isArray(payload.capabilities) ? payload.capabilities : [],
      registeredAt: new Date().toISOString(),
      lastSeen: Date.now(),
      state: 'CONNECTED'
    };

    return {
      status: 'registered',
      gatewayVersion: '2.0.0',
      heartbeatIntervalMs: 5000,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process periodic heartbeat.
   */
  processHeartbeat(payload) {
    if (!this.activeAgent) {
      return { status: 'unregistered', message: 'Agent not registered' };
    }

    if (this.activeAgent.agentId !== payload.agentId) {
      return { status: 'mismatch', message: 'Agent ID mismatch' };
    }

    this.activeAgent.lastSeen = Date.now();
    this.activeAgent.state = payload.state === 'CONNECTED' ? 'CONNECTED' : payload.state || 'CONNECTED';
    this.activeAgent.uptimeSeconds = payload.uptimeSeconds || 0;

    return {
      status: 'acknowledged',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Mark agent as disconnected.
   */
  disconnectAgent(agentId, reason = '') {
    if (this.activeAgent && this.activeAgent.agentId === agentId) {
      this.activeAgent.state = 'OFFLINE';
      this.activeAgent.disconnectedAt = new Date().toISOString();
      this.activeAgent.disconnectReason = reason;
      return { status: 'disconnected', agentId };
    }
    return { status: 'not_found' };
  }

  /**
   * Get safe agent status report for Dashboard and client Web OS.
   */
  getStatus() {
    if (!this.activeAgent) {
      return {
        connected: false,
        state: 'NOT_CONNECTED',
        agent: null,
        timestamp: new Date().toISOString()
      };
    }

    // Check if heartbeat is stale
    const isStale = (Date.now() - this.activeAgent.lastSeen) > HEARTBEAT_TIMEOUT_MS;
    const currentState = isStale ? 'OFFLINE' : this.activeAgent.state;
    const isConnected = !isStale && currentState === 'CONNECTED';

    return {
      connected: isConnected,
      state: currentState,
      agent: {
        agentId: this.activeAgent.agentId,
        agentName: this.activeAgent.agentName,
        agentVersion: this.activeAgent.agentVersion,
        protocolVersion: this.activeAgent.protocolVersion,
        platform: this.activeAgent.platform,
        arch: this.activeAgent.arch,
        capabilitiesCount: this.activeAgent.capabilities.length,
        registeredAt: this.activeAgent.registeredAt,
        lastSeen: new Date(this.activeAgent.lastSeen).toISOString(),
        uptimeSeconds: this.activeAgent.uptimeSeconds || 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

const agentRegistry = new GatewayAgentRegistry();

module.exports = {
  agentRegistry,
  GatewayAgentRegistry
};

