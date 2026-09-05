/**
 * KS Sentinel 2.0 — Git Index Self-Healing Utility
 * 
 * Permanently guards against Windows file-locking corruption
 * ('fatal: .git/index: index file smaller than expected').
 *
 * If .git/index is truncated or locked, this cleanly removes it
 * and runs `git reset` to rebuild the index from HEAD.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const gitDir = path.join(repoRoot, '.git');
const indexPath = path.join(gitDir, 'index');
const lockPath = path.join(gitDir, 'index.lock');

function repair() {
  let needsRepair = false;

  // Clean up any dangling lock file
  if (fs.existsSync(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
      console.log('[GIT REPAIR] Removed dangling .git/index.lock');
    } catch {}
  }

  // Check if index exists and is valid size (> 100 bytes)
  if (!fs.existsSync(indexPath)) {
    needsRepair = true;
  } else {
    try {
      const stat = fs.statSync(indexPath);
      if (stat.size < 100) {
        needsRepair = true;
      }
    } catch {
      needsRepair = true;
    }
  }

  // Check if git status throws
  if (!needsRepair) {
    try {
      execSync('git status --porcelain', { cwd: repoRoot, stdio: 'pipe' });
    } catch {
      needsRepair = true;
    }
  }

  if (needsRepair) {
    console.log('[GIT REPAIR] Corrupted or truncated index detected. Rebuilding .git/index...');
    try {
      if (fs.existsSync(indexPath)) {
        fs.unlinkSync(indexPath);
      }
    } catch (err) {
      console.warn('[GIT REPAIR] Warning unlinking index:', err.message);
    }

    try {
      execSync('git reset', { cwd: repoRoot, stdio: 'inherit' });
      console.log('[GIT REPAIR] Successfully rebuilt .git/index.');
    } catch (err) {
      console.error('[GIT REPAIR] Failed to rebuild index:', err.message);
      process.exit(1);
    }
  } else {
    console.log('[GIT REPAIR] .git/index is clean and healthy.');
  }
}

repair();

