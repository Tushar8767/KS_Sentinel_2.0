const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server/src/app');

test('Server Gateway Machine Information Endpoint (Module 4)', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('GET /api/machine/info returns unavailable when agent is not connected', async () => {
    const res = await fetch(`${baseUrl}/api/machine/info`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.available, false);
    assert.ok(data.message.includes('not connected') || data.message.includes('offline'));
  });

  await t.test('GET /api/machine/info returns real telemetry after agent registers', async () => {
    const registrationPayload = {
      agentId: 'mod4_test_agent',
      agentName: 'Module 4 Test Sentinel',
      agentVersion: '2.0.0',
      protocolVersion: '1.0',
      platform: 'win32',
      arch: 'x64',
      capabilities: [
        { id: 'machine.info.read', name: 'Machine Info Read', version: '1.0.0', enabled: true }
      ],
      machineInfo: {
        machine: {
          hostname: 'sentinel-test-host',
          platform: 'win32',
          architecture: 'x64',
          osType: 'Windows_NT',
          osRelease: '10.0.19045',
          osVersion: 'Windows 10 Pro',
          uptimeSeconds: 84000
        },
        cpu: {
          model: 'Intel(R) Core(TM) i7 Test CPU',
          cores: 8,
          speedMHz: 2400
        },
        memory: {
          totalBytes: 17179869184,
          freeBytes: 8589934592,
          usedBytes: 8589934592,
          usagePercent: 50.0
        },
        storage: {
          mount: 'C:\\',
          totalBytes: 512000000000,
          freeBytes: 256000000000,
          usedBytes: 256000000000,
          usagePercent: 50.0
        },
        network: [
          { name: 'Ethernet', family: 'IPv4', address: '192.168.1.50' }
        ],
        collectedAt: new Date().toISOString()
      }
    };

    // Register agent with telemetry
    const regRes = await fetch(`${baseUrl}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationPayload)
    });
    assert.equal(regRes.status, 200);

    // Fetch machine info
    const infoRes = await fetch(`${baseUrl}/api/machine/info`);
    assert.equal(infoRes.status, 200);
    const info = await infoRes.json();

    assert.equal(info.available, true);
    assert.equal(info.state, 'CONNECTED');
    assert.equal(info.machine.hostname, 'sentinel-test-host');
    assert.equal(info.cpu.model, 'Intel(R) Core(TM) i7 Test CPU');
    assert.equal(info.cpu.cores, 8);
    assert.equal(info.memory.totalBytes, 17179869184);
    assert.equal(info.memory.usagePercent, 50.0);
    assert.equal(info.storage.mount, 'C:\\');
    assert.equal(info.network[0].address, '192.168.1.50');
  });

  await t.test('GET /api/machine/info switches to unavailable when agent disconnects', async () => {
    // Disconnect agent
    await fetch(`${baseUrl}/api/agent/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'mod4_test_agent', reason: 'Test complete' })
    });

    const infoRes = await fetch(`${baseUrl}/api/machine/info`);
    assert.equal(infoRes.status, 200);
    const info = await infoRes.json();

    assert.equal(info.available, false);
    assert.equal(info.state, 'OFFLINE');
    assert.equal(info.machine, null);
  });
});

