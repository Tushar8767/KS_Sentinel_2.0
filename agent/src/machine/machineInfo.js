/**
 * KS Sentinel 2.0 — Read-Only Machine Information Provider
 * Module 4: Remote Machine Information
 *
 * Collects safe, read-only, non-destructive host machine metadata
 * strictly using Node.js built-in standard APIs (os, fs.statfs).
 *
 * SECURITY GUARANTEES:
 * - NO shell invocation (no wmic, powershell, cmd, systeminfo)
 * - NO child processes or command execution
 * - NO arbitrary filesystem browsing or reading
 * - NO credentials, passwords, tokens, or environment secrets
 */

const os = require('os');
const fs = require('fs');

/**
 * Normalizes and returns safe, read-only host machine information.
 */
function getMachineInfo(agentIdentity = null) {
  const cpus = os.cpus() || [];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const memoryUsagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;

  // Safe drive storage inspection (uses standard C-level statfs, NO shell calls)
  let storage = null;
  try {
    const driveRoot = process.platform === 'win32'
      ? (process.cwd().substring(0, 3) || 'C:\\')
      : '/';
    if (typeof fs.statfsSync === 'function') {
      const stat = fs.statfsSync(driveRoot);
      const totalBytes = Number(stat.bsize) * Number(stat.blocks);
      const freeBytes = Number(stat.bsize) * Number(stat.bavail);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const storageUsagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

      storage = {
        mount: driveRoot,
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: storageUsagePercent
      };
    }
  } catch {
    storage = null;
  }

  // Safe, limited network interfaces (non-internal IPv4/IPv6 only, NO MACs or packet inspection)
  const network = [];
  try {
    const interfaces = os.networkInterfaces() || {};
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!Array.isArray(addrs)) continue;
      for (const addr of addrs) {
        if (!addr.internal && (addr.family === 'IPv4' || addr.family === 4)) {
          network.push({
            name,
            family: 'IPv4',
            address: addr.address
          });
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  return {
    agent: {
      agentId: agentIdentity ? agentIdentity.agentId : 'unknown',
      agentVersion: agentIdentity ? agentIdentity.agentVersion : '2.0.0',
      protocolVersion: agentIdentity ? agentIdentity.protocolVersion : '1.0'
    },
    machine: {
      hostname: os.hostname() || 'localhost',
      platform: os.platform(),
      architecture: os.arch(),
      osType: os.type(),
      osRelease: os.release(),
      osVersion: typeof os.version === 'function' ? os.version() : os.release(),
      uptimeSeconds: Math.floor(os.uptime())
    },
    cpu: {
      model: cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU',
      cores: cpus.length,
      speedMHz: cpus.length > 0 ? cpus[0].speed : 0
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usagePercent: memoryUsagePercent
    },
    storage,
    network,
    collectedAt: new Date().toISOString()
  };
}

module.exports = {
  getMachineInfo
};

