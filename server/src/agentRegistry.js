/**
 * KS Sentinel 2.0 — Gateway Agent Registry
 * Module 4: Remote Machine Information
 *
 * In-memory state tracking for connected local agent instances
 * and safe read-only machine telemetry caching.
 */

// Stale timeout: if no heartbeat received within window, mark agent offline
const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.HEARTBEAT_TIMEOUT_MS, 10) || 15000;

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
      machineInfo: payload.machineInfo || null,
      endpoint: payload.endpoint ? String(payload.endpoint) : null,
      capabilityHandler: typeof payload.capabilityHandler === 'function' ? payload.capabilityHandler : null,
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
   * Directly assign an in-process capability handler (useful for testing or direct IPC).
   */
  setCapabilityHandler(handler) {
    if (this.activeAgent) {
      this.activeAgent.capabilityHandler = handler;
    }
  }

  /**
   * Execute an explicit capability on the connected agent.
   * Dispatches via local loopback HTTP endpoint or direct capability handler.
   */
  async executeCapability(capability, params = {}) {
    const status = this.getStatus();
    if (!status.connected || !this.activeAgent) {
      const err = new Error('Local Sentinel Agent is unavailable or offline');
      err.status = 409;
      err.code = 'AGENT_UNAVAILABLE';
      throw err;
    }

    const hasCap = this.activeAgent.capabilities.some((c) => {
      const id = typeof c === 'string' ? c : c?.id;
      const enabled = typeof c === 'object' ? c.enabled !== false : true;
      return id === capability && enabled;
    });

    if (!hasCap) {
      const err = new Error(`Capability '${capability}' is not registered or supported by active agent`);
      err.status = 400;
      err.code = 'CAPABILITY_NOT_SUPPORTED';
      throw err;
    }

    // Prioritize direct in-process capability handler if registered
    if (typeof this.activeAgent.capabilityHandler === 'function') {
      return await this.activeAgent.capabilityHandler(capability, params);
    }

    // Otherwise dispatch via agent loopback HTTP endpoint
    if (this.activeAgent.endpoint) {
      const response = await fetch(`${this.activeAgent.endpoint}/api/capability/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.activeAgent.agentId,
          capability,
          params
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        const err = new Error(result.error || `Agent capability execution failed with HTTP ${response.status}`);
        err.status = result.code || response.status || 500;
        throw err;
      }

      return result.data;
    }

    const err = new Error('Local Sentinel Agent capability transport channel is unavailable');
    err.status = 503;
    err.code = 'TRANSPORT_UNAVAILABLE';
    throw err;
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
    if (payload.machineInfo) {
      this.activeAgent.machineInfo = payload.machineInfo;
    }

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

  /**
   * Get safe, read-only remote machine information.
   * Module 4: Remote Machine Information
   */
  getMachineInfo() {
    if (!this.activeAgent) {
      return {
        available: false,
        state: 'NOT_CONNECTED',
        machine: null,
        message: 'Machine information unavailable: Local Sentinel Agent is not connected.',
        timestamp: new Date().toISOString()
      };
    }

    const isStale = (Date.now() - this.activeAgent.lastSeen) > HEARTBEAT_TIMEOUT_MS;
    if (isStale || this.activeAgent.state === 'OFFLINE') {
      return {
        available: false,
        state: 'OFFLINE',
        machine: null,
        message: 'Machine information unavailable: Local Sentinel Agent is offline.',
        timestamp: new Date().toISOString()
      };
    }

    if (!this.activeAgent.machineInfo) {
      return {
        available: false,
        state: this.activeAgent.state,
        machine: null,
        message: 'Machine information pending collection.',
        timestamp: new Date().toISOString()
      };
    }

    return {
      available: true,
      state: 'CONNECTED',
      agent: {
        agentId: this.activeAgent.agentId,
        agentVersion: this.activeAgent.agentVersion
      },
      ...this.activeAgent.machineInfo,
      timestamp: new Date().toISOString()
    };
  }
}

const agentRegistry = new GatewayAgentRegistry();

module.exports = {
  agentRegistry,
  GatewayAgentRegistry
};
