/**
 * KS Sentinel 2.0 — Server Gateway Workspace Endpoints & Persistence Tests
 * Module 5: Sentinel Workspace
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const app = require('../../server/src/app');
const { WorkspaceStore } = require('../../server/src/workspaceStore');

test('Server Gateway Workspace Management & Persistence (Module 5)', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(async () => {
    try {
      await fetch(`${baseUrl}/api/workspaces/ws_default_01/open`, { method: 'POST' });
    } catch {}
    server.close();
  });

  let createdWorkspaceId = null;

  await t.test('GET /api/workspaces returns workspace list with default seeded workspace', async () => {
    // Ensure default workspace is activated as baseline
    await fetch(`${baseUrl}/api/workspaces/ws_default_01/open`, { method: 'POST' });

    const res = await fetch(`${baseUrl}/api/workspaces`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.workspaces));
    assert.ok(data.workspaces.length >= 1);
    assert.ok(data.activeWorkspaceId);
  });

  await t.test('GET /api/workspaces/active returns active workspace details', async () => {
    const res = await fetch(`${baseUrl}/api/workspaces/active`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.active, true);
    assert.ok(data.workspace);
    assert.equal(data.workspace.status, 'ACTIVE');
  });

  await t.test('POST /api/workspaces creates a new workspace successfully', async () => {
    const payload = {
      name: 'Project Alpha Workspace',
      description: 'Alpha workspace for subsystem integration',
      rootPath: 'D:\\projects\\alpha'
    };

    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id.startsWith('ws_'));
    assert.equal(data.name, 'Project Alpha Workspace');
    assert.equal(data.rootPath, 'D:\\projects\\alpha');
    assert.equal(data.status, 'INACTIVE');
    assert.ok(data.createdAt);
    assert.ok(data.bindingStatus);
    createdWorkspaceId = data.id;
  });

  await t.test('POST /api/workspaces rejects invalid workspace names', async () => {
    // Missing name
    const res1 = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'No name' })
    });
    assert.equal(res1.status, 400);
    const err1 = await res1.json();
    assert.ok(err1.message.includes('required'));

    // Empty whitespace name
    const res2 = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' })
    });
    assert.equal(res2.status, 400);

    // Excessive name length
    const res3 = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'a'.repeat(90) })
    });
    assert.equal(res3.status, 400);
  });

  await t.test('POST /api/workspaces rejects path traversal attempts in rootPath', async () => {
    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Exploit Attempt',
        rootPath: 'C:\\Users\\victim\\..\\..\\Windows\\System32'
      })
    });
    assert.equal(res.status, 400);
    const err = await res.json();
    assert.ok(err.message.includes('traversal'));
  });

  await t.test('GET /api/workspaces/:id returns workspace by id', async () => {
    assert.ok(createdWorkspaceId);
    const res = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, createdWorkspaceId);
    assert.equal(data.name, 'Project Alpha Workspace');
  });

  await t.test('GET /api/workspaces/:id returns 404 for unknown id', async () => {
    const res = await fetch(`${baseUrl}/api/workspaces/ws_non_existent`);
    assert.equal(res.status, 404);
  });

  await t.test('POST /api/workspaces/:id/open activates workspace and switches active', async () => {
    assert.ok(createdWorkspaceId);
    const res = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}/open`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, createdWorkspaceId);
    assert.equal(data.status, 'ACTIVE');
    assert.equal(data.isActive, true);

    // Verify GET /api/workspaces/active reflects new active workspace
    const activeRes = await fetch(`${baseUrl}/api/workspaces/active`);
    const activeData = await activeRes.json();
    assert.equal(activeData.workspace.id, createdWorkspaceId);
  });

  await t.test('POST /api/workspaces/:id/close closes active workspace', async () => {
    assert.ok(createdWorkspaceId);
    const res = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}/close`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'CLOSED');

    // Verify GET /api/workspaces/active now returns no active workspace
    const activeRes = await fetch(`${baseUrl}/api/workspaces/active`);
    const activeData = await activeRes.json();
    assert.equal(activeData.active, false);
  });

  await t.test('POST /api/workspaces/:id/activate reactivates workspace', async () => {
    assert.ok(createdWorkspaceId);
    const res = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}/activate`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ACTIVE');
  });

  await t.test('PATCH /api/workspaces/:id updates workspace metadata', async () => {
    assert.ok(createdWorkspaceId);
    const res = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Project Alpha Renamed',
        description: 'Updated description'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'Project Alpha Renamed');
    assert.equal(data.description, 'Updated description');
  });

  await t.test('DELETE /api/workspaces/:id deletes workspace safely', async () => {
    assert.ok(createdWorkspaceId);
    const res = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}`, {
      method: 'DELETE'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.deleted, true);
    assert.equal(data.id, createdWorkspaceId);

    // Verify 404 when fetching deleted workspace
    const checkRes = await fetch(`${baseUrl}/api/workspaces/${createdWorkspaceId}`);
    assert.equal(checkRes.status, 404);
  });

  await t.test('Isolated WorkspaceStore Persistence Test', async () => {
    const tempFile = path.join(os.tmpdir(), `sentinel_ws_test_${Date.now()}.json`);
    try {
      const store1 = new WorkspaceStore(tempFile);
      const ws = store1.createWorkspace({
        name: 'Persistence Verification Workspace',
        rootPath: 'D:\\safe\\path',
        description: 'Tests disk persistence'
      });
      store1.openWorkspace(ws.id);

      // Verify file was written
      assert.ok(fs.existsSync(tempFile));

      // Reload in fresh store instance
      const store2 = new WorkspaceStore(tempFile);
      const reloaded = store2.getWorkspace(ws.id);
      assert.ok(reloaded);
      assert.equal(reloaded.name, 'Persistence Verification Workspace');
      assert.equal(reloaded.status, 'ACTIVE');
      assert.equal(store2.activeWorkspaceId, ws.id);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  await t.test('Security Boundary: No generic execution, shell, or arbitrary file endpoints', async () => {
    const forbiddenEndpoints = [
      '/api/execute',
      '/api/shell',
      '/api/command',
      '/api/files/read',
      '/api/filesystem/browse'
    ];

    for (const ep of forbiddenEndpoints) {
      const res = await fetch(`${baseUrl}${ep}`);
      assert.equal(res.status, 404, `Endpoint ${ep} should return 404 Not Found`);
    }
  });
});

