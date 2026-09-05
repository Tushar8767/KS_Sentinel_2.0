const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server/src/app');

test('Server Gateway Agent Endpoints', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('GET /api/agent/status returns NOT_CONNECTED initially', async () => {
    const res = await fetch(`${baseUrl}/api/agent/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.connected, false);
    assert.equal(data.state, 'NOT_CONNECTED');
  });

  await t.test('POST /api/agent/register rejects invalid payload', async () => {
    const res = await fetch(`${baseUrl}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, 'Registration Failed');
  });

  await t.test('POST /api/agent/register succeeds with valid payload', async () => {
    const payload = {
      agentId: 'test_agent_01',
      agentName: 'Test Agent',
      agentVersion: '2.0.0',
      protocolVersion: '1.0',
      platform: 'win32',
      arch: 'x64',
      capabilities: []
    };

    const res = await fetch(`${baseUrl}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'registered');
    assert.equal(data.gatewayVersion, '2.0.0');
  });

  await t.test('GET /api/agent/status reflects CONNECTED after registration', async () => {
    const res = await fetch(`${baseUrl}/api/agent/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.connected, true);
    assert.equal(data.state, 'CONNECTED');
    assert.equal(data.agent.agentId, 'test_agent_01');
  });

  await t.test('POST /api/agent/heartbeat acknowledges liveness', async () => {
    const payload = {
      agentId: 'test_agent_01',
      state: 'CONNECTED',
      uptimeSeconds: 12
    };

    const res = await fetch(`${baseUrl}/api/agent/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'acknowledged');
  });

  await t.test('POST /api/agent/disconnect marks agent OFFLINE', async () => {
    const payload = {
      agentId: 'test_agent_01',
      reason: 'Test shutdown'
    };

    const res = await fetch(`${baseUrl}/api/agent/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res.status, 200);

    const statusRes = await fetch(`${baseUrl}/api/agent/status`);
    const statusData = await statusRes.json();
    assert.equal(statusData.connected, false);
    assert.equal(statusData.state, 'OFFLINE');
  });
});

