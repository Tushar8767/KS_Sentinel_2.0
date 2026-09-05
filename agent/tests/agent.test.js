const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const config = require('../src/config');
const { AgentIdentity, AGENT_VERSION, PROTOCOL_VERSION } = require('../src/identity');
const { AgentLifecycle, LifecycleState } = require('../src/lifecycle');
const { CapabilityRegistry } = require('../src/capabilities');
const { AgentHealth } = require('../src/health');
const { GatewayClient } = require('../src/transport/gatewayClient');
const { LocalSentinelAgent } = require('../src/agent');

test('Agent Identity', () => {
  const identity = new AgentIdentity({ agentId: 'test_id_123', agentName: 'Test Sentinel' });
  const json = identity.toJSON();

  assert.equal(json.agentId, 'test_id_123');
  assert.equal(json.agentName, 'Test Sentinel');
  assert.equal(json.agentVersion, AGENT_VERSION);
  assert.equal(json.protocolVersion, PROTOCOL_VERSION);
  assert.equal(json.platform, process.platform);
  assert.equal(json.arch, process.arch);
  assert.ok(json.nodeVersion);
  assert.ok(json.createdAt);

  // Security check: ensure no sensitive paths or secrets leaked in identity
  assert.equal(json.password, undefined);
  assert.equal(json.token, undefined);
  assert.equal(json.secret, undefined);
});

test('Agent Lifecycle State Machine', () => {
  const lifecycle = new AgentLifecycle();
  assert.equal(lifecycle.state, LifecycleState.STARTING);

  // Valid transition sequence
  lifecycle.transitionTo(LifecycleState.READY);
  assert.equal(lifecycle.state, LifecycleState.READY);

  lifecycle.transitionTo(LifecycleState.CONNECTING);
  assert.equal(lifecycle.state, LifecycleState.CONNECTING);

  lifecycle.transitionTo(LifecycleState.CONNECTED);
  assert.equal(lifecycle.state, LifecycleState.CONNECTED);

  lifecycle.transitionTo(LifecycleState.STOPPING);
  assert.equal(lifecycle.state, LifecycleState.STOPPING);

  lifecycle.transitionTo(LifecycleState.STOPPED);
  assert.equal(lifecycle.state, LifecycleState.STOPPED);

  // Invalid transition from STOPPED
  assert.throws(() => {
    lifecycle.transitionTo(LifecycleState.READY);
  }, /Invalid lifecycle transition/);
});

test('Capability Registry (Module 3 Boundary)', () => {
  const registry = new CapabilityRegistry();
  assert.equal(registry.count, 0);
  assert.deepEqual(registry.getCapabilityDescriptors(), []);

  // Security assertion: verify no dangerous executor methods exist
  assert.equal(registry.execute, undefined);
  assert.equal(registry.runShell, undefined);
  assert.equal(registry.runProcess, undefined);
});

test('Agent Health Report', () => {
  const identity = new AgentIdentity({ agentId: 'health_test_id' });
  const lifecycle = new AgentLifecycle();
  const capabilities = new CapabilityRegistry();
  const health = new AgentHealth(identity, lifecycle, capabilities, null);

  const report = health.getHealthReport();
  assert.equal(report.status, 'ok');
  assert.equal(report.agentId, 'health_test_id');
  assert.equal(report.lifecycleState, LifecycleState.STARTING);
  assert.equal(typeof report.uptimeSeconds, 'number');
  assert.equal(report.capabilitiesCount, 0);
  assert.equal(report.connected, false);

  // Health vs Machine Telemetry boundary check
  assert.equal(report.cpu, undefined);
  assert.equal(report.memory, undefined);
  assert.equal(report.disk, undefined);
  assert.equal(report.processes, undefined);
});

test('Gateway Transport & Agent Lifecycle with Mock Gateway', async (t) => {
  let receivedRegister = false;
  let receivedHeartbeat = false;
  let receivedDisconnect = false;

  const mockServer = http.createServer((req, res) => {
    if (req.url === '/api/agent/register' && req.method === 'POST') {
      receivedRegister = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'registered', gatewayVersion: '2.0.0', heartbeatIntervalMs: 50 }));
    } else if (req.url === '/api/agent/heartbeat' && req.method === 'POST') {
      receivedHeartbeat = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'acknowledged' }));
    } else if (req.url === '/api/agent/disconnect' && req.method === 'POST') {
      receivedDisconnect = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'disconnected' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => mockServer.listen(0, resolve));
  const mockPort = mockServer.address().port;
  const mockUrl = `http://localhost:${mockPort}`;

  t.after(() => {
    mockServer.close();
  });

  const agent = new LocalSentinelAgent({
    gatewayUrl: mockUrl,
    agentId: 'mock_agent_01',
    heartbeatIntervalMs: 50
  });

  // Start agent and verify registration
  await agent.start();
  assert.equal(receivedRegister, true);
  assert.equal(agent.lifecycle.state, LifecycleState.CONNECTED);
  assert.equal(agent.transport.isConnected(), true);

  // Wait for at least one heartbeat
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(receivedHeartbeat, true);

  // Stop agent and verify disconnect
  await agent.stop('Test complete');
  assert.equal(receivedDisconnect, true);
  assert.equal(agent.lifecycle.state, LifecycleState.STOPPED);
  assert.equal(agent.transport.isConnected(), false);
});

