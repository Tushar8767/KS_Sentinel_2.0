const test = require('node:test');
const assert = require('node:assert/strict');
const { getMachineInfo } = require('../src/machine/machineInfo');
const { AgentIdentity } = require('../src/identity');

test('Machine Information Provider Schema & Normalization', () => {
  const identity = new AgentIdentity({ agentId: 'test_agent_schema' });
  const info = getMachineInfo(identity);

  // 1. Agent metadata
  assert.ok(info.agent);
  assert.equal(info.agent.agentId, 'test_agent_schema');
  assert.equal(typeof info.agent.agentVersion, 'string');
  assert.equal(typeof info.agent.protocolVersion, 'string');

  // 2. Machine specs
  assert.ok(info.machine);
  assert.equal(typeof info.machine.hostname, 'string');
  assert.ok(info.machine.hostname.length > 0);
  assert.equal(typeof info.machine.platform, 'string');
  assert.equal(typeof info.machine.architecture, 'string');
  assert.equal(typeof info.machine.osRelease, 'string');
  assert.equal(typeof info.machine.uptimeSeconds, 'number');
  assert.ok(info.machine.uptimeSeconds >= 0);

  // 3. CPU specs
  assert.ok(info.cpu);
  assert.equal(typeof info.cpu.model, 'string');
  assert.equal(typeof info.cpu.cores, 'number');
  assert.ok(info.cpu.cores > 0);
  assert.equal(typeof info.cpu.speedMHz, 'number');

  // 4. Memory specs
  assert.ok(info.memory);
  assert.equal(typeof info.memory.totalBytes, 'number');
  assert.ok(info.memory.totalBytes > 0);
  assert.equal(typeof info.memory.freeBytes, 'number');
  assert.ok(info.memory.freeBytes >= 0);
  assert.equal(typeof info.memory.usedBytes, 'number');
  assert.ok(info.memory.usedBytes >= 0);
  assert.equal(typeof info.memory.usagePercent, 'number');
  assert.ok(info.memory.usagePercent >= 0 && info.memory.usagePercent <= 100);

  // 5. Storage specs (safe fallback to null if statfs unavailable)
  if (info.storage !== null) {
    assert.equal(typeof info.storage.mount, 'string');
    assert.equal(typeof info.storage.totalBytes, 'number');
    assert.ok(info.storage.totalBytes > 0);
    assert.equal(typeof info.storage.freeBytes, 'number');
    assert.equal(typeof info.storage.usedBytes, 'number');
    assert.equal(typeof info.storage.usagePercent, 'number');
  }

  // 6. Network specs (safe non-internal interfaces only)
  assert.ok(Array.isArray(info.network));
  for (const iface of info.network) {
    assert.equal(typeof iface.name, 'string');
    assert.equal(typeof iface.family, 'string');
    assert.equal(typeof iface.address, 'string');
    // Ensure no sensitive MAC address leaked
    assert.equal(iface.mac, undefined);
  }

  // 7. Security: Absence of sensitive data
  assert.equal(info.password, undefined);
  assert.equal(info.token, undefined);
  assert.equal(info.secret, undefined);
  assert.equal(info.env, undefined);
  assert.equal(info.processList, undefined);
  assert.equal(info.files, undefined);

  // 8. Timestamp
  assert.ok(info.collectedAt);
  assert.ok(!isNaN(Date.parse(info.collectedAt)));
});

