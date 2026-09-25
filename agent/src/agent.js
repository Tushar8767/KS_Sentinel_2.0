/**
 * KS Sentinel 2.0 — Local Sentinel Agent Main Controller
 * Module 3: Local Sentinel Agent
 *
 * Coordinates identity, lifecycle, health, capabilities, and transport.
 */

const { AgentIdentity } = require('./identity');
const { AgentLifecycle, LifecycleState } = require('./lifecycle');
const { CapabilityRegistry } = require('./capabilities');
const { AgentHealth } = require('./health');
const { GatewayClient } = require('./transport/gatewayClient');
const { CapabilityServer } = require('./transport/capabilityServer');
const { getMachineInfo } = require('./machine/machineInfo');
const defaultConfig = require('./config');

class LocalSentinelAgent {
  constructor(customConfig = {}) {
    this.config = { ...defaultConfig, ...customConfig };
    this.identity = new AgentIdentity(this.config);
    this.lifecycle = new AgentLifecycle();
    this.capabilities = new CapabilityRegistry({ includeFileCapabilities: true });
    this.capabilityServer = new CapabilityServer(this.identity.agentId, this.capabilities);
    this.transport = new GatewayClient(
      this.config,
      this.identity,
      this.lifecycle,
      this.capabilities,
      () => this.health.getUptimeSeconds(),
      () => getMachineInfo(this.identity),
      () => this.capabilityServer.endpoint
    );
    this.health = new AgentHealth(this.identity, this.lifecycle, this.capabilities, this.transport);
    this.reconnectTimer = null;

    // Log state changes
    this.lifecycle.on('stateChange', ({ previousState, currentState, reason }) => {
      this.log(`Lifecycle transition: [${previousState}] -> [${currentState}] ${reason ? `(${reason})` : ''}`);
    });
  }

  log(msg) {
    const ts = new Date().toISOString();
    console.log(`[SENTINEL AGENT ${ts}] ${msg}`);
  }

  error(msg, err) {
    const ts = new Date().toISOString();
    console.error(`[SENTINEL AGENT ERROR ${ts}] ${msg}`, err?.message || '');
  }

  /**
   * Start the agent process.
   */
  async start() {
    this.log(`Starting Local Sentinel Agent v${this.identity.agentVersion} (Protocol v${this.identity.protocolVersion})...`);

    // Start loopback capability server
    try {
      const endpoint = await this.capabilityServer.start(this.config.agentPort || 0);
      this.log(`Capability server listening on ${endpoint}`);
    } catch (err) {
      this.error('Failed to start capability server', err);
    }

    this.lifecycle.transitionTo(LifecycleState.READY, 'Agent initialization complete');

    // Attempt registration with Gateway
    const registered = await this.transport.register();
    if (!registered) {
      this.log(`Gateway at ${this.config.gatewayUrl} is currently offline. Will retry periodically.`);
      this.scheduleReconnect();
    } else {
      this.log(`Registered with Gateway at ${this.config.gatewayUrl}. Heartbeat active.`);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.lifecycle.isStoppingOrStopped()) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.transport.isConnected() && !this.lifecycle.isStoppingOrStopped()) {
        const ok = await this.transport.register();
        if (!ok) {
          this.scheduleReconnect();
        }
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Graceful shutdown.
   */
  async stop(reason = 'Shutdown initiated') {
    if (this.lifecycle.state === LifecycleState.STOPPED) return;

    this.log(`Stopping agent: ${reason}`);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.lifecycle.transitionTo(LifecycleState.STOPPING, reason);
      await this.capabilityServer.stop();
      await this.transport.disconnect(reason);
    } finally {
      this.lifecycle.transitionTo(LifecycleState.STOPPED, 'Agent stopped cleanly');
      this.log('Local Sentinel Agent stopped.');
    }
  }
}

module.exports = {
  LocalSentinelAgent
};

