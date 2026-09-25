/**
 * KS Sentinel 2.0 — Local Sentinel Agent Filesystem Provider Tests
 * Module 7A: Read-Only Sandboxed File Manager
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  resolveSafePath,
  listDirectory,
  statPath,
  readFileContent,
  executeFileCapability,
  MAX_PREVIEW_BYTES
} = require('../src/filesystem/fileProvider');
const { CapabilityRegistry, FILE_CAPABILITIES } = require('../src/capabilities');

test('Agent Filesystem Provider & Capability Tests (Module 7A)', async (t) => {
  // Create an isolated temporary test sandbox directory
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-sentinel-test-fs-'));

  // Setup directory structure
  fs.mkdirSync(path.join(testRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(testRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(testRoot, 'empty-dir'), { recursive: true });

  fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'sandbox-test', version: '1.0.0' }, null, 2));
  fs.writeFileSync(path.join(testRoot, 'README.md'), '# Sandbox Test Repository\nSecure read-only testing.');
  fs.writeFileSync(path.join(testRoot, 'src', 'index.js'), 'console.log("Hello from sandbox");\n');
  fs.writeFileSync(path.join(testRoot, 'docs', 'guide.txt'), 'Step 1: Read-only access.\n');

  // Create an oversized file (> 2 MB)
  const largeFilePath = path.join(testRoot, 'large_file.txt');
  const largeBuffer = Buffer.alloc(MAX_PREVIEW_BYTES + 1024, 'A');
  fs.writeFileSync(largeFilePath, largeBuffer);

  t.after(() => {
    try {
      fs.rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  await t.test('Capability Registry: Registers Module 7A filesystem capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.registerFileCapabilities();

    assert.equal(registry.count, 4);
    assert.equal(registry.hasCapability('workspace.file.list'), true);
    assert.equal(registry.hasCapability('workspace.file.stat'), true);
    assert.equal(registry.hasCapability('workspace.file.read'), true);
    assert.equal(FILE_CAPABILITIES.length, 3);
  });

  await t.test('resolveSafePath: Valid subpaths resolve inside root', () => {
    const p1 = resolveSafePath('', testRoot);
    assert.equal(p1.toLowerCase(), path.resolve(testRoot).toLowerCase());

    const p2 = resolveSafePath('.', testRoot);
    assert.equal(p2.toLowerCase(), path.resolve(testRoot).toLowerCase());

    const p3 = resolveSafePath('src', testRoot);
    assert.equal(p3.toLowerCase(), path.resolve(testRoot, 'src').toLowerCase());

    const p4 = resolveSafePath('src/index.js', testRoot);
    assert.equal(p4.toLowerCase(), path.resolve(testRoot, 'src/index.js').toLowerCase());
  });

  await t.test('resolveSafePath: Blocks directory traversal attempts (.. and ..\\)', () => {
    assert.throws(() => {
      resolveSafePath('../', testRoot);
    }, (err) => err.status === 403);

    assert.throws(() => {
      resolveSafePath('../../etc/passwd', testRoot);
    }, (err) => err.status === 403);

    assert.throws(() => {
      resolveSafePath('..\\..\\Windows\\System32', testRoot);
    }, (err) => err.status === 403);

    assert.throws(() => {
      resolveSafePath('src/../../Windows/System32', testRoot);
    }, (err) => err.status === 403);
  });

  await t.test('resolveSafePath: Blocks absolute external paths', () => {
    const externalPath = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/shadow';
    assert.throws(() => {
      resolveSafePath(externalPath, testRoot);
    }, (err) => err.status === 403);
  });

  await t.test('resolveSafePath: Blocks UNC paths and null bytes', () => {
    assert.throws(() => {
      resolveSafePath('\\\\evil-host\\share\\file.txt', testRoot);
    }, (err) => err.status === 400);

    assert.throws(() => {
      resolveSafePath('src\0/index.js', testRoot);
    }, (err) => err.status === 400);
  });

  await t.test('resolveSafePath: Blocks URL-encoded traversal attempts', () => {
    assert.throws(() => {
      resolveSafePath('%2e%2e%2fsecret.txt', testRoot);
    }, (err) => err.status === 403);

    assert.throws(() => {
      resolveSafePath('%2e%2e%5csecret.txt', testRoot);
    }, (err) => err.status === 403);
  });

  await t.test('listDirectory: Returns sorted items with directories first', () => {
    const res = listDirectory('', testRoot);
    assert.ok(res.root);
    assert.equal(res.currentPath, '/');
    assert.ok(Array.isArray(res.items));

    // Verify folders come before files
    const dirIndices = res.items.map((it, idx) => it.type === 'directory' ? idx : -1).filter(i => i >= 0);
    const fileIndices = res.items.map((it, idx) => it.type === 'file' ? idx : -1).filter(i => i >= 0);

    if (dirIndices.length && fileIndices.length) {
      assert.ok(Math.max(...dirIndices) < Math.min(...fileIndices));
    }

    const itemNames = res.items.map(i => i.name);
    assert.ok(itemNames.includes('src'));
    assert.ok(itemNames.includes('package.json'));
    assert.ok(itemNames.includes('README.md'));
  });

  await t.test('listDirectory: Subfolder listing returns relative currentPath', () => {
    const res = listDirectory('src', testRoot);
    assert.equal(res.currentPath, '/src');
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].name, 'index.js');
    assert.equal(res.items[0].type, 'file');
    assert.equal(res.items[0].extension, '.js');
  });

  await t.test('listDirectory: Fails on non-existent directory with 404', () => {
    assert.throws(() => {
      listDirectory('non-existent-subfolder', testRoot);
    }, (err) => err.status === 404);
  });

  await t.test('statPath: Returns sanitized file and directory metadata', () => {
    const fileMeta = statPath('package.json', testRoot);
    assert.equal(fileMeta.name, 'package.json');
    assert.equal(fileMeta.type, 'file');
    assert.equal(fileMeta.extension, '.json');
    assert.ok(fileMeta.size > 0);
    assert.ok(fileMeta.modifiedAt);
    assert.equal(fileMeta.relativePath, '/package.json');

    const dirMeta = statPath('src', testRoot);
    assert.equal(dirMeta.name, 'src');
    assert.equal(dirMeta.type, 'directory');
    assert.equal(dirMeta.relativePath, '/src');

    assert.throws(() => {
      statPath('missing-file.txt', testRoot);
    }, (err) => err.status === 404);
  });

  await t.test('readFileContent: Reads text file preview correctly', () => {
    const content = readFileContent('README.md', testRoot);
    assert.equal(content.name, 'README.md');
    assert.equal(content.extension, '.md');
    assert.equal(content.relativePath, '/README.md');
    assert.ok(content.content.includes('# Sandbox Test Repository'));
  });

  await t.test('readFileContent: Rejects oversized files with status 413', () => {
    assert.throws(() => {
      readFileContent('large_file.txt', testRoot);
    }, (err) => err.status === 413 && err.message.includes('too large'));
  });

  await t.test('readFileContent: Rejects reading directory content with status 400', () => {
    assert.throws(() => {
      readFileContent('src', testRoot);
    }, (err) => err.status === 400);
  });

  await t.test('executeFileCapability: Dispatches supported capabilities', async () => {
    const listRes = await executeFileCapability('workspace.file.list', { rootPath: testRoot, subPath: 'src' });
    assert.equal(listRes.currentPath, '/src');

    const statRes = await executeFileCapability('workspace.file.stat', { rootPath: testRoot, filePath: 'README.md' });
    assert.equal(statRes.name, 'README.md');

    const readRes = await executeFileCapability('workspace.file.read', { rootPath: testRoot, filePath: 'src/index.js' });
    assert.ok(readRes.content.includes('Hello from sandbox'));

    await assert.rejects(async () => {
      await executeFileCapability('workspace.file.unknown', { rootPath: testRoot });
    }, (err) => err.status === 400);
  });
});

