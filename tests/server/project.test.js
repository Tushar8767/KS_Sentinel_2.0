/**
 * KS Sentinel 2.0 — Server Gateway Projects Endpoints & Persistence Tests
 * Module 6: Projects
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const app = require('../../server/src/app');
const { ProjectStore } = require('../../server/src/projectStore');

test('Server Gateway Project Management & Persistence (Module 6)', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(async () => {
    // Reset to default workspace and default project
    try {
      await fetch(`${baseUrl}/api/workspaces/ws_default_01/open`, { method: 'POST' });
      await fetch(`${baseUrl}/api/projects/proj_default_01/open`, { method: 'POST' });
    } catch {}
    server.close();
  });

  let createdProjectId = null;
  let testWorkspaceId = null;

  await t.test('GET /api/projects returns project list with seeded default project', async () => {
    // Ensure default workspace is active
    await fetch(`${baseUrl}/api/workspaces/ws_default_01/open`, { method: 'POST' });

    const res = await fetch(`${baseUrl}/api/projects?workspaceId=ws_default_01`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.projects));
    assert.ok(data.projects.length >= 1);
    assert.equal(data.workspaceId, 'ws_default_01');

    const defaultProj = data.projects.find((p) => p.id === 'proj_default_01');
    assert.ok(defaultProj, 'Seeded default project proj_default_01 should exist');
    assert.equal(defaultProj.name, 'KS Sentinel Core');
  });

  await t.test('GET /api/projects/active returns current active project', async () => {
    // Ensure default project is active as baseline
    await fetch(`${baseUrl}/api/projects/proj_default_01/open`, { method: 'POST' });

    const res = await fetch(`${baseUrl}/api/projects/active?workspaceId=ws_default_01`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.active, true);
    assert.ok(data.project);
    assert.equal(data.project.status, 'ACTIVE');
    assert.equal(data.project.workspaceId, 'ws_default_01');
  });

  await t.test('POST /api/projects creates a new project successfully', async () => {
    const payload = {
      workspaceId: 'ws_default_01',
      name: 'Sentinel Agent Subsystem',
      description: 'Host agent communication and telemetry pipeline',
      rootPath: 'D:\\.vscode\\Coding\\Projects\\antigravity\\KS_Sentinel_2.0\\agent',
      metadata: {
        type: 'agent',
        tags: ['agent', 'core', 'telemetry']
      }
    };

    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id.startsWith('proj_'));
    assert.equal(data.name, 'Sentinel Agent Subsystem');
    assert.equal(data.workspaceId, 'ws_default_01');
    assert.equal(data.status, 'INACTIVE');
    assert.ok(data.createdAt);
    assert.deepEqual(data.metadata.tags, ['agent', 'core', 'telemetry']);
    createdProjectId = data.id;
  });

  await t.test('POST /api/projects rejects invalid project names', async () => {
    // Missing name
    const res1 = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_default_01', description: 'No name' })
    });
    assert.equal(res1.status, 400);
    const err1 = await res1.json();
    assert.ok(err1.message.includes('required'));

    // Empty whitespace name
    const res2 = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_default_01', name: '   ' })
    });
    assert.equal(res2.status, 400);

    // Excessive name length
    const res3 = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_default_01', name: 'x'.repeat(85) })
    });
    assert.equal(res3.status, 400);
  });

  await t.test('POST /api/projects rejects path traversal attempts in rootPath', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws_default_01',
        name: 'Traversal Exploit Attempt',
        rootPath: 'C:\\Users\\admin\\..\\..\\Windows\\System32'
      })
    });
    assert.equal(res.status, 400);
    const err = await res.json();
    assert.ok(err.message.includes('traversal'));
  });

  await t.test('GET /api/projects/:id returns project by id', async () => {
    assert.ok(createdProjectId);
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, createdProjectId);
    assert.equal(data.name, 'Sentinel Agent Subsystem');
  });

  await t.test('GET /api/projects/:id returns 404 for unknown id', async () => {
    const res = await fetch(`${baseUrl}/api/projects/proj_non_existent`);
    assert.equal(res.status, 404);
  });

  await t.test('POST /api/projects/:id/open activates project and switches active', async () => {
    assert.ok(createdProjectId);
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/open`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, createdProjectId);
    assert.equal(data.status, 'ACTIVE');
    assert.equal(data.isActive, true);

    // Verify GET /api/projects/active reflects new active project
    const activeRes = await fetch(`${baseUrl}/api/projects/active?workspaceId=ws_default_01`);
    const activeData = await activeRes.json();
    assert.equal(activeData.project.id, createdProjectId);
  });

  await t.test('POST /api/projects/:id/close closes active project', async () => {
    assert.ok(createdProjectId);
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/close`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'CLOSED');

    // Verify GET /api/projects/active now returns no active project
    const activeRes = await fetch(`${baseUrl}/api/projects/active?workspaceId=ws_default_01`);
    const activeData = await activeRes.json();
    assert.equal(activeData.active, false);
  });

  await t.test('POST /api/projects/:id/activate reactivates project', async () => {
    assert.ok(createdProjectId);
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/activate`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ACTIVE');
  });

  await t.test('PATCH /api/projects/:id updates project metadata', async () => {
    assert.ok(createdProjectId);
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sentinel Agent Subsystem Renamed',
        description: 'Updated description for subsystem'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'Sentinel Agent Subsystem Renamed');
    assert.equal(data.description, 'Updated description for subsystem');
  });

  await t.test('DELETE /api/projects/:id deletes project safely', async () => {
    assert.ok(createdProjectId);
    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}`, {
      method: 'DELETE'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.deleted, true);
    assert.equal(data.id, createdProjectId);

    // Verify 404 when fetching deleted project
    const checkRes = await fetch(`${baseUrl}/api/projects/${createdProjectId}`);
    assert.equal(checkRes.status, 404);
  });

  await t.test('Workspace Isolation: Projects in Workspace A do not leak into Workspace B', async () => {
    // 1. Create temporary Workspace B
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Workspace Beta Isolation Test',
        rootPath: 'D:\\isolated\\beta'
      })
    });
    const wsData = await wsRes.json();
    testWorkspaceId = wsData.id;

    // 2. Create Project in Workspace B
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        name: 'Beta Project Isolated'
      })
    });
    const projData = await projRes.json();
    const betaProjId = projData.id;

    // 3. Query Workspace A projects — should NOT contain Beta Project
    const listA = await fetch(`${baseUrl}/api/projects?workspaceId=ws_default_01`).then((r) => r.json());
    assert.ok(!listA.projects.some((p) => p.id === betaProjId));

    // 4. Query Workspace B projects — SHOULD contain Beta Project and NOT contain Default Project
    const listB = await fetch(`${baseUrl}/api/projects?workspaceId=${testWorkspaceId}`).then((r) => r.json());
    assert.ok(listB.projects.some((p) => p.id === betaProjId));
    assert.ok(!listB.projects.some((p) => p.id === 'proj_default_01'));
  });

  await t.test('Cascading Deletion: Deleting workspace removes its associated projects', async () => {
    assert.ok(testWorkspaceId);

    // Delete Workspace B
    const delRes = await fetch(`${baseUrl}/api/workspaces/${testWorkspaceId}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    // Verify projects for Workspace B are now empty
    const listRes = await fetch(`${baseUrl}/api/projects?workspaceId=${testWorkspaceId}`);
    const listData = await listRes.json();
    assert.equal(listData.total, 0);
    assert.equal(listData.projects.length, 0);
  });

  await t.test('Isolated ProjectStore Persistence Test', async () => {
    const tempFile = path.join(os.tmpdir(), `sentinel_proj_test_${Date.now()}.json`);
    try {
      const store1 = new ProjectStore(tempFile);
      const proj = store1.createProject({
        workspaceId: 'ws_default_01',
        name: 'Disk Persistence Project',
        rootPath: 'D:\\persistence\\path',
        description: 'Tests project atomic persistence'
      });
      store1.openProject(proj.id);

      // Verify file was written
      assert.ok(fs.existsSync(tempFile));

      // Reload in fresh store instance
      const store2 = new ProjectStore(tempFile);
      const reloaded = store2.getProject(proj.id);
      assert.ok(reloaded);
      assert.equal(reloaded.name, 'Disk Persistence Project');
      assert.equal(reloaded.status, 'ACTIVE');
      assert.equal(store2.getActiveProject('ws_default_01').id, proj.id);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  await t.test('Security Boundary: No generic execution, shell, or arbitrary file endpoints under /api/projects', async () => {
    const forbiddenEndpoints = [
      '/api/projects/execute',
      '/api/projects/shell',
      '/api/projects/command',
      '/api/projects/files/read',
      '/api/projects/git/commit'
    ];

    for (const ep of forbiddenEndpoints) {
      const res = await fetch(`${baseUrl}${ep}`);
      assert.equal(res.status, 404, `Endpoint ${ep} should return 404 Not Found`);
    }
  });
});

