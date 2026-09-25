/**
 * KS Sentinel 2.0 — Local Sentinel Agent Filesystem Provider
 * Module 7A: Read-Only Sandboxed File Manager
 *
 * Implements safe, read-only filesystem capabilities strictly bounded
 * to an authorized Workspace or Project rootPath.
 *
 * STRICT SECURITY BOUNDARIES:
 * - Read-only operations only (list, stat, read content).
 * - Strictly bounded to authorized rootPath.
 * - Rejects directory traversal (.., ..\, ../), UNC paths (\\), absolute paths outside root,
 *   drive switches, encoded traversal attempts, and symlink/junction escapes.
 * - Max file preview size limit (2 MB default).
 * - Gateway and Client MUST NOT directly touch filesystem. Agent is the sole authorized executor.
 */

const fs = require('fs');
const path = require('path');

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 MB

// Common text/code extensions explicitly allowed for preview
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.xml', '.svg', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.gitignore', '.gitattributes', '.editorconfig',
  '.sh', '.bash', '.bat', '.cmd', '.ps1', '.py', '.rb', '.php', '.java', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.rs', '.go', '.sql', '.log', '.csv', '.tsv', '.dockerfile',
  '.lock', '.properties'
]);

/**
 * Checks if a string contains URL-encoded or hex traversal sequences.
 */
function containsEncodedTraversal(raw) {
  if (typeof raw !== 'string') return false;
  // Check for %2e, %2f, %5c, %25 (case-insensitive)
  const pattern = /%(2e|2f|5c|25)/i;
  return pattern.test(raw);
}

/**
 * Safely resolves and normalizes a requested path against an authorized rootPath.
 * Guarantees that resolvedPath ∈ rootPath.
 * Throws sanitized errors with appropriate HTTP status codes (400, 403).
 */
function resolveSafePath(requestedPath, rootPath) {
  if (!rootPath || typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    const err = new Error('Authorized rootPath is required and must be a valid directory path');
    err.status = 400;
    throw err;
  }

  // Null byte injection check
  if (requestedPath && typeof requestedPath === 'string' && requestedPath.includes('\0')) {
    const err = new Error('Invalid path: null byte detected');
    err.status = 400;
    throw err;
  }

  // Raw UNC path check
  if (typeof requestedPath === 'string' && (requestedPath.startsWith('\\\\') || requestedPath.startsWith('//'))) {
    const err = new Error('Access denied: UNC paths are prohibited');
    err.status = 400;
    throw err;
  }

  // Encoded traversal check
  if (typeof requestedPath === 'string' && containsEncodedTraversal(requestedPath)) {
    const err = new Error('Access denied: Encoded traversal sequence detected');
    err.status = 403;
    throw err;
  }

  // Attempt URL decode if encoded characters exist
  let decodedSub = requestedPath || '';
  if (typeof decodedSub === 'string' && decodedSub.includes('%')) {
    try {
      decodedSub = decodeURIComponent(decodedSub);
      if (decodedSub.includes('\0')) {
        const err = new Error('Invalid path: null byte detected after decode');
        err.status = 400;
        throw err;
      }
    } catch {
      const err = new Error('Access denied: Malformed URI encoding in path');
      err.status = 400;
      throw err;
    }
  }

  const normalizedRoot = path.resolve(rootPath);
  const rootDrive = path.parse(normalizedRoot).root.toLowerCase();

  let targetPath;
  if (!decodedSub || decodedSub.trim() === '' || decodedSub === '.' || decodedSub === '/' || decodedSub === '\\') {
    targetPath = normalizedRoot;
  } else if (path.isAbsolute(decodedSub)) {
    // If client supplied an absolute path, resolve it and verify containment
    targetPath = path.resolve(decodedSub);
  } else {
    // Treat as relative to normalized root
    // Strip leading slashes to prevent root-relative overrides
    const sanitizedRel = decodedSub.replace(/^[/\\]+/, '');
    targetPath = path.resolve(normalizedRoot, sanitizedRel);
  }

  // Normalization check
  targetPath = path.normalize(targetPath);

  // Check drive letter matching on Windows
  const targetDrive = path.parse(targetPath).root.toLowerCase();
  if (rootDrive && targetDrive && rootDrive !== targetDrive) {
    const err = new Error('Access denied: Drive boundary crossing is prohibited');
    err.status = 403;
    throw err;
  }

  // Traversal containment verification via path.relative
  const relative = path.relative(normalizedRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const err = new Error('Access denied: Target path escapes authorized root sandbox');
    err.status = 403;
    throw err;
  }

  // Windows case-insensitive prefix check
  const lowerRoot = normalizedRoot.toLowerCase();
  const lowerTarget = targetPath.toLowerCase();

  const isExactRoot = lowerTarget === lowerRoot;
  const isDirectDescendant = lowerTarget.startsWith(lowerRoot.endsWith(path.sep) ? lowerRoot : lowerRoot + path.sep);

  if (!isExactRoot && !isDirectDescendant) {
    const err = new Error('Access denied: Path is outside authorized workspace root');
    err.status = 403;
    throw err;
  }

  // Symlink escape check if target exists
  if (fs.existsSync(targetPath)) {
    try {
      const realTarget = fs.realpathSync(targetPath);
      const lowerRealTarget = realTarget.toLowerCase();
      let realRoot = lowerRoot;
      try {
        if (fs.existsSync(normalizedRoot)) {
          realRoot = fs.realpathSync(normalizedRoot).toLowerCase();
        }
      } catch {
        // Fall back to lowerRoot
      }

      const realExact = lowerRealTarget === realRoot;
      const realDescendant = lowerRealTarget.startsWith(realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep);
      if (!realExact && !realDescendant) {
        const err = new Error('Access denied: Symlink or junction escape detected outside authorized root');
        err.status = 403;
        throw err;
      }
    } catch (symErr) {
      if (symErr.status === 403) throw symErr;
      // If error occurs reading realpath, preserve targetPath
    }
  }

  return targetPath;
}

/**
 * Lists contents of a directory within an authorized rootPath.
 */
function listDirectory(subPath, rootPath) {
  const targetPath = resolveSafePath(subPath, rootPath);

  if (!fs.existsSync(targetPath)) {
    const err = new Error(`Directory not found: ${path.basename(targetPath)}`);
    err.status = 404;
    throw err;
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    const err = new Error(`Path is not a directory: ${path.basename(targetPath)}`);
    err.status = 400;
    throw err;
  }

  const normalizedRoot = path.resolve(rootPath);
  const relativeFromRoot = path.relative(normalizedRoot, targetPath).replace(/\\/g, '/');
  const currentPath = relativeFromRoot ? (relativeFromRoot.startsWith('/') ? relativeFromRoot : '/' + relativeFromRoot) : '/';

  const dirEntries = fs.readdirSync(targetPath, { withFileTypes: true });

  const items = [];
  for (const entry of dirEntries) {
    const entryFullPath = path.join(targetPath, entry.name);
    let entryStat = null;
    try {
      entryStat = fs.statSync(entryFullPath);
    } catch {
      // Skip inaccessible or broken symlink items
      continue;
    }

    const isDir = entry.isDirectory();
    const ext = isDir ? null : path.extname(entry.name).toLowerCase();
    const size = isDir ? null : (entryStat ? entryStat.size : 0);
    const modifiedAt = entryStat ? entryStat.mtime.toISOString() : new Date().toISOString();

    items.push({
      name: entry.name,
      type: isDir ? 'directory' : 'file',
      size,
      extension: ext,
      modifiedAt
    });
  }

  // Sort: directories first (alphabetical), then files (alphabetical)
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return {
    root: path.basename(normalizedRoot),
    currentPath,
    items
  };
}

/**
 * Returns sanitized metadata for a file or directory.
 */
function statPath(filePath, rootPath) {
  const targetPath = resolveSafePath(filePath, rootPath);

  if (!fs.existsSync(targetPath)) {
    const err = new Error(`File or path not found: ${path.basename(targetPath)}`);
    err.status = 404;
    throw err;
  }

  const stat = fs.statSync(targetPath);
  const normalizedRoot = path.resolve(rootPath);
  const relativeFromRoot = path.relative(normalizedRoot, targetPath).replace(/\\/g, '/');
  const relativePath = relativeFromRoot ? (relativeFromRoot.startsWith('/') ? relativeFromRoot : '/' + relativeFromRoot) : '/';

  return {
    name: path.basename(targetPath),
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    extension: stat.isFile() ? path.extname(targetPath).toLowerCase() : null,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    relativePath
  };
}

/**
 * Reads text/code content of a file with strict 2 MB limit and binary rejection.
 */
function readFileContent(filePath, rootPath, maxBytes = MAX_PREVIEW_BYTES) {
  const targetPath = resolveSafePath(filePath, rootPath);

  if (!fs.existsSync(targetPath)) {
    const err = new Error(`File not found: ${path.basename(targetPath)}`);
    err.status = 404;
    throw err;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const err = new Error(`Cannot read content of directory: ${path.basename(targetPath)}`);
    err.status = 400;
    throw err;
  }

  const effectiveLimit = Math.min(maxBytes || MAX_PREVIEW_BYTES, MAX_PREVIEW_BYTES);
  if (stat.size > effectiveLimit) {
    const err = new Error(`File too large for preview (${(stat.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed size is ${(effectiveLimit / 1024 / 1024).toFixed(0)} MB.`);
    err.status = 413;
    throw err;
  }

  const ext = path.extname(targetPath).toLowerCase();
  const baseName = path.basename(targetPath).toLowerCase();

  // Allow dotfiles like .env, .gitignore, .dockerignore if ext is empty
  const isRecognizedText = TEXT_EXTENSIONS.has(ext) || baseName.startsWith('.');

  // Read buffer to verify binary vs text
  const buffer = fs.readFileSync(targetPath);

  // Check the first 8000 bytes for null bytes (0x00) indicating binary
  const sampleLimit = Math.min(buffer.length, 8000);
  let isBinary = false;
  for (let i = 0; i < sampleLimit; i++) {
    if (buffer[i] === 0) {
      isBinary = true;
      break;
    }
  }

  if (isBinary && !isRecognizedText) {
    const err = new Error(`Binary file preview is not supported for ${path.basename(targetPath)}`);
    err.status = 400;
    throw err;
  }

  const normalizedRoot = path.resolve(rootPath);
  const relativeFromRoot = path.relative(normalizedRoot, targetPath).replace(/\\/g, '/');
  const relativePath = relativeFromRoot ? (relativeFromRoot.startsWith('/') ? relativeFromRoot : '/' + relativeFromRoot) : '/' + path.basename(targetPath);

  return {
    name: path.basename(targetPath),
    relativePath,
    extension: ext,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    content: buffer.toString('utf8')
  };
}

/**
 * Capability dispatcher for filesystem operations.
 */
async function executeFileCapability(capability, params = {}) {
  const { rootPath, subPath, filePath, maxBytes } = params;

  if (!rootPath) {
    const err = new Error('rootPath is required for filesystem capability execution');
    err.status = 400;
    throw err;
  }

  switch (capability) {
    case 'workspace.file.list':
      return listDirectory(subPath, rootPath);

    case 'workspace.file.stat':
      return statPath(filePath || subPath, rootPath);

    case 'workspace.file.read':
      return readFileContent(filePath, rootPath, maxBytes);

    default: {
      const err = new Error(`Unsupported filesystem capability: ${capability}`);
      err.status = 400;
      throw err;
    }
  }
}

module.exports = {
  MAX_PREVIEW_BYTES,
  resolveSafePath,
  listDirectory,
  statPath,
  readFileContent,
  executeFileCapability
};

