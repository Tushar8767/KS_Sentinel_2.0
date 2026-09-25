/**
 * KS Sentinel 2.0 — Local Sentinel Agent Capability Server
 * Module 7A: Read-Only Sandboxed File Manager
 *
 * Exposes a strictly local loopback (127.0.0.1) HTTP endpoint for
 * capability execution requests dispatched by the Secure Gateway.
 */

const http = require('http');
const { executeFileCapability } = require('../filesystem/fileProvider');

class CapabilityServer {
  constructor(agentId, capabilities) {
    this.agentId = agentId;
    this.capabilities = capabilities;
    this.server = null;
    this.port = null;
    this.endpoint = null;
  }

  /**
   * Start listening on loopback (127.0.0.1).
   */
  start(preferredPort = 0) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      // Bind strictly to 127.0.0.1 (never 0.0.0.0 or external network)
      this.server.listen(preferredPort, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.endpoint = `http://127.0.0.1:${this.port}`;
        resolve(this.endpoint);
      });
    });
  }

  /**
   * Stop capability server.
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Request handler for capability execution.
   */
  async handleRequest(req, res) {
    // Only accept POST to /api/capability/execute
    if (req.method !== 'POST' || req.url !== '/api/capability/execute') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint Not Found', code: 404 }));
    }

    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
      // Guard against oversized payload (1MB max for JSON request)
      if (rawBody.length > 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload Too Large', code: 413 }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(rawBody || '{}');
        const { capability, params } = payload;

        if (!capability) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Capability identifier required', code: 400 }));
        }

        // Check if capability is registered and enabled in local registry
        if (!this.capabilities.hasCapability(capability)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: `Capability not registered or enabled: ${capability}`, code: 400 }));
        }

        let result = null;
        if (capability.startsWith('workspace.file.')) {
          result = await executeFileCapability(capability, params);
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: `Execution handler not implemented for: ${capability}`, code: 400 }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err) {
        const statusCode = err.status || (err.statusCode ? err.statusCode : 500);
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: err.message || 'Capability execution failed',
          code: statusCode
        }));
      }
    });
  }
}

module.exports = {
  CapabilityServer
};

