/**
 * KS Sentinel 2.0 — Local Sentinel Agent Gateway Transport Client
 * Module 4: Remote Machine Information
 *
 * Handles HTTP/TLS transport communication between Local Agent and Server Gateway:
 * - Registration / Handshake (POST /api/agent/register) with capabilities & initial machine info
 * - Periodic Heartbeat (POST /api/agent/heartbeat) with liveness & telemetry payload
 * - Clean Disconnect Notification (POST /api/agent/disconnect)
 */

const { LifecycleState } = require('../lifecycle');

class GatewayClient {
  constructor(config, identity, lifecycle, capabilities, getUptimeFn, getMachineInfoFn = null, getEndpointFn = null) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/+$/, '');
    this.heartbeatIntervalMs = config.heartbeatIntervalMs;
    this.identity = identity;
    this.lifecycle = lifecycle;
    this.capabilities = capabilities;
    this.getUptimeFn = getUptimeFn;
    this.getMachineInfoFn = getMachineInfoFn;
    this.getEndpointFn = getEndpointFn;

    this.heartbeatTimer = null;
    this.connected = false;
    this.consecutiveFailures = 0;
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Perform handshake / registration with the Secure Gateway.
   */
  async register() {
    if (this.lifecycle.isStoppingOrStopped()) return false;

    this.lifecycle.transitionTo(LifecycleState.CONNECTING, 'Initiating gateway handshake');
    const endpoint = `${this.gatewayUrl}/api/agent/register`;

    const payload = {
      ...this.identity.toJSON(),
      capabilities: this.capabilities.getCapabilityDescriptors(),
      machineInfo: this.getMachineInfoFn ? this.getMachineInfoFn() : null,
      endpoint: this.getEndpointFn ? this.getEndpointFn() : null,
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'registered') {
        this.connected = true;
        this.consecutiveFailures = 0;
        this.lifecycle.transitionTo(LifecycleState.CONNECTED, 'Handshake acknowledged by Gateway');
        this.startHeartbeat();
        return true;
      } else {
        throw new Error(`Unexpected gateway response status: ${data.status}`);
      }
    } catch (err) {
      this.connected = false;
      this.consecutiveFailures++;
      if (this.lifecycle.state !== LifecycleState.READY && !this.lifecycle.isStoppingOrStopped()) {
        this.lifecycle.transitionTo(LifecycleState.READY, `Gateway connection failed: ${err.message}`);
      }
      return false;
    }
  }

  /**
   * Start periodic heartbeat loop.
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat loop.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send a single heartbeat to the gateway, including current machine info.
   */
  async sendHeartbeat() {
    if (this.lifecycle.isStoppingOrStopped()) return;

    const endpoint = `${this.gatewayUrl}/api/agent/heartbeat`;
    const payload = {
      agentId: this.identity.agentId,
      state: this.lifecycle.state,
      uptimeSeconds: this.getUptimeFn ? this.getUptimeFn() : 0,
      machineInfo: this.getMachineInfoFn ? this.getMachineInfoFn() : null,
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        this.connected = true;
        this.consecutiveFailures = 0;
        if (this.lifecycle.state !== LifecycleState.CONNECTED) {
          this.lifecycle.transitionTo(LifecycleState.CONNECTED, 'Heartbeat restored connection');
        }
      } else if (response.status === 404 || response.status === 401) {
        // Gateway lost agent session, trigger re-registration
        this.connected = false;
        await this.register();
      } else {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }
    } catch (err) {
      this.connected = false;
      this.consecutiveFailures++;
      if (this.lifecycle.state === LifecycleState.CONNECTED) {
        this.lifecycle.transitionTo(LifecycleState.READY, `Heartbeat missed: ${err.message}`);
      }
    }
  }

  /**
   * Cleanly notify the gateway of agent disconnection during shutdown.
   */
  async disconnect(reason = 'Normal shutdown') {
    this.stopHeartbeat();
    this.connected = false;

    const endpoint = `${this.gatewayUrl}/api/agent/disconnect`;
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.identity.agentId,
          reason,
          timestamp: new Date().toISOString()
        })
      });
    } catch {
      // Ignore network errors during shutdown
    }
  }
}

module.exports = {
  GatewayClient
};
