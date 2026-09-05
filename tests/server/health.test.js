const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server/src/app');

test('Server Gateway Health Endpoint', async (t) => {
  await t.test('GET /api/health returns 200 OK with service details', async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      assert.equal(response.status, 200);

      const data = await response.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.service, 'KS Sentinel Secure Gateway');
      assert.equal(data.module, '0 — Architecture Foundation');
      assert.ok(data.timestamp);
    } finally {
      server.close();
    }
  });

  await t.test('GET /api/execute returns 404 Not Found (No arbitrary execute endpoint)', async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const response = await fetch(`http://localhost:${port}/api/execute`);
      assert.equal(response.status, 404);

      const data = await response.json();
      assert.equal(data.error, 'Endpoint not found');
    } finally {
      server.close();
    }
  });
});

