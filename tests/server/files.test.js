/**
 * KS Sentinel 2.0 — Secure Gateway File Manager API Integration Tests
 * Module 7A: Read-Only Sandboxed File Manager
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = require('../../server/src/app');
const { agentRegistry } = require('../../server/src/agentRegistry');
const { workspaceStore } = require('../../server/src/workspaceStore');
const { projectStore } = require('../../server/src/projectStore');
const {
  executeFileCapability,
  MAX_PREVIEW_BYTES
} = require('../../agent/src/filesystem/fileProvider');

test('Server Gateway Read-Only Filesystem Endpoints (Module 7A)', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  // Create isolated temporary workspace and project directories
  const testWsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-sentinel-gw-ws-'));
  const testProjDir = path.join(testWsDir, 'sample-project');
  fs.mkdirSync(testProjDir, { recursive: true });
  fs.mkdirSync(path.join(testProjDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(testWsDir, 'workspace-notes.txt'), 'Workspace level notes.\n');
  fs.writeFileSync(path.join(testProjDir, 'package.json'), JSON.stringify({ name: 'project-test', version: '2.0.0' }, null, 2));
  fs.writeFileSync(path.join(testProjDir, 'README.md'), '# Sample Project\nRead-only sandboxed file manager test.');
  fs.writeFileSync(path.join(testProjDir, 'src', 'app.js'), 'console.log("Gateway App");\n');

  // Create an oversized file (> 2 MB)
  const largeFilePath = path.join(testProjDir, 'oversized.txt');
  fs.writeFileSync(largeFilePath, Buffer.alloc(MAX_PREVIEW_BYTES + 4096, 'X'));

  // Seed test workspace and project in stores
  let testWorkspaceId = null;
  let testProjectId = null;

  t.before(() => {
    // Reset agent registry to disconnected for initial offline check
    agentRegistry.activeAgent = null;

    const ws = workspaceStore.createWorkspace({
      name: 'File Manager Test Workspace',
      rootPath: testWsDir,
      description: 'Test workspace for sandboxed file manager'
    });
    testWorkspaceId = ws.id;

    const proj = projectStore.createProject({
      name: 'Sample Project',
      workspaceId: testWorkspaceId,
      rootPath: testProjDir,
      description: 'Test project for sandboxed file manager'
    });
    testProjectId = proj.id;
  });

  t.after(() => {
    server.close();
    try {
      if (testWorkspaceId) workspaceStore.deleteWorkspace(testWorkspaceId);
      if (testProjectId) projectStore.deleteProject(testProjectId);
      fs.rmSync(testWsDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  await t.test('GET /api/files/list returns 409 when Agent is unavailable or offline', async () => {
    const res = await fetch(`${baseUrl}/api/files/list?workspaceId=${testWorkspaceId}`);
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.ok(data.error);
    assert.ok(data.message.includes('unavailable') || data.message.includes('offline'));
  });

  await t.test('Connect Agent with Module 7A capabilities', async () => {
    const registrationPayload = {
      agentId: 'mod7_test_agent',
      agentName: 'Module 7 Test Sentinel Agent',
      agentVersion: '2.0.0',
      protocolVersion: '1.0',
      platform: process.platform,
      arch: process.arch,
      capabilities: [
        { id: 'machine.info.read', name: 'Machine Info Read', version: '1.0.0', enabled: true },
        { id: 'workspace.file.list', name: 'Workspace File List', version: '1.0.0', enabled: true },
        { id: 'workspace.file.stat', name: 'Workspace File Stat', version: '1.0.0', enabled: true },
        { id: 'workspace.file.read', name: 'Workspace File Read', version: '1.0.0', enabled: true }
      ]
    };

    const regRes = await fetch(`${baseUrl}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationPayload)
    });
    assert.equal(regRes.status, 200);

    // Register capability execution handler directly on agentRegistry
    agentRegistry.setCapabilityHandler(async (capability, params) => {
      return executeFileCapability(capability, params);
    });
  });

  await t.test('GET /api/files/list returns directory listing for authorized workspace root', async () => {
    const res = await fetch(`${baseUrl}/api/files/list?workspaceId=${testWorkspaceId}`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.root);
    assert.equal(data.currentPath, '/');
    assert.ok(Array.isArray(data.items));

    const itemNames = data.items.map(i => i.name);
    assert.ok(itemNames.includes('sample-project'));
    assert.ok(itemNames.includes('workspace-notes.txt'));

    // Check directory sorting: directories come before files
    const firstItem = data.items[0];
    assert.equal(firstItem.type, 'directory');
    assert.equal(firstItem.name, 'sample-project');
  });

  await t.test('GET /api/files/list returns directory listing for scoped project root', async () => {
    const res = await fetch(`${baseUrl}/api/files/list?workspaceId=${testWorkspaceId}&projectId=${testProjectId}`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.currentPath, '/');
    const itemNames = data.items.map(i => i.name);
    assert.ok(itemNames.includes('src'));
    assert.ok(itemNames.includes('package.json'));
    assert.ok(itemNames.includes('README.md'));
  });

  await t.test('GET /api/files/list returns 404 for unknown workspace', async () => {
    const res = await fetch(`${baseUrl}/api/files/list?workspaceId=unknown-ws-404`);
    assert.equal(res.status, 404);
  });

  await t.test('GET /api/files/list rejects path traversal attempts with 403', async () => {
    const res1 = await fetch(`${baseUrl}/api/files/list?workspaceId=${testWorkspaceId}&subPath=../../Windows`);
    assert.equal(res1.status, 403);
    const data1 = await res1.json();
    assert.ok(data1.message.includes('outside') || data1.message.includes('escape'));

    const res2 = await fetch(`${baseUrl}/api/files/list?workspaceId=${testWorkspaceId}&subPath=..%2f..%2f`);
    assert.equal(res2.status, 403);
  });

  await t.test('GET /api/files/stat returns sanitized metadata for file and directory', async () => {
    const fileRes = await fetch(`${baseUrl}/api/files/stat?workspaceId=${testWorkspaceId}&projectId=${testProjectId}&filePath=package.json`);
    assert.equal(fileRes.status, 200);
    const fileData = await fileRes.json();
    assert.equal(fileData.name, 'package.json');
    assert.equal(fileData.type, 'file');
    assert.equal(fileData.extension, '.json');
    assert.ok(fileData.size > 0);
    assert.ok(fileData.modifiedAt);

    const dirRes = await fetch(`${baseUrl}/api/files/stat?workspaceId=${testWorkspaceId}&projectId=${testProjectId}&filePath=src`);
    assert.equal(dirRes.status, 200);
    const dirData = await dirRes.json();
    assert.equal(dirData.name, 'src');
    assert.equal(dirData.type, 'directory');
  });

  await t.test('GET /api/files/stat returns 404 for non-existent file', async () => {
    const res = await fetch(`${baseUrl}/api/files/stat?workspaceId=${testWorkspaceId}&projectId=${testProjectId}&filePath=missing.txt`);
    assert.equal(res.status, 404);
  });

  await t.test('GET /api/files/content returns file preview text content', async () => {
    const res = await fetch(`${baseUrl}/api/files/content?workspaceId=${testWorkspaceId}&projectId=${testProjectId}&filePath=README.md`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'README.md');
    assert.equal(data.extension, '.md');
    assert.ok(data.content.includes('# Sample Project'));
  });

  await t.test('GET /api/files/content rejects oversized files with 413', async () => {
    const res = await fetch(`${baseUrl}/api/files/content?workspaceId=${testWorkspaceId}&projectId=${testProjectId}&filePath=oversized.txt`);
    assert.equal(res.status, 413);
    const data = await res.json();
    assert.ok(data.message.includes('too large'));
  });

  await t.test('GET /api/files/content rejects traversal with 403', async () => {
    const res = await fetch(`${baseUrl}/api/files/content?workspaceId=${testWorkspaceId}&projectId=${testProjectId}&filePath=../../Windows/System32/cmd.exe`);
    assert.equal(res.status, 403);
  });

  await t.test('Security Boundary: Gateway fileService does not touch filesystem directly', () => {
    const serviceSource = fs.readFileSync(path.resolve(__dirname, '../../server/src/fileService.js'), 'utf8');

    // Asserts that fileService.js never imports fs or child_process
    assert.equal(serviceSource.includes("require('fs')"), false);
    assert.equal(serviceSource.includes('require("fs")'), false);
    assert.equal(serviceSource.includes("require('node:fs')"), false);
    assert.equal(serviceSource.includes("require('child_process')"), false);
    assert.equal(serviceSource.includes('require("child_process")'), false);
    assert.equal(serviceSource.includes("require('node:child_process')"), false);
  });
});

