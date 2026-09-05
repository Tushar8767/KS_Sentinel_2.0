/**
 * KS Sentinel 2.0 — Sentinel Workspace Store
 * Module 5: Sentinel Workspace
 *
 * Implements the core Workspace model, lifecycle management,
 * stable ID generation, and lightweight JSON file persistence.
 *
 * Strictly adheres to security boundary:
 * - Logical root binding only (no filesystem access).
 * - No shell, process, or file-reading endpoints.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Default storage location: server/data/workspaces.json
const DEFAULT_STORAGE_PATH = path.resolve(__dirname, '../data/workspaces.json');

class WorkspaceStore {
  constructor(storagePath = DEFAULT_STORAGE_PATH, agentRegistry = null) {
    this.storagePath = storagePath;
    this.agentRegistry = agentRegistry;
    this.projectStore = null;
    this.workspaces = new Map();
    this.activeWorkspaceId = null;
    this.init();
  }

  /**
   * Set agent registry reference for live agent queries.
   */
  setAgentRegistry(agentRegistry) {
    this.agentRegistry = agentRegistry;
  }

  /**
   * Set project store reference for cascading operations.
   */
  setProjectStore(projectStore) {
    this.projectStore = projectStore;
  }

  /**
   * Initialize store: ensure directory exists, load from disk, seed if empty.
   */
  init() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.workspaces)) {
          for (const ws of data.workspaces) {
            this.workspaces.set(ws.id, ws);
          }
        }
        this.activeWorkspaceId = data.activeWorkspaceId || null;
      }
    } catch (err) {
      console.warn('[WORKSPACE STORE] Warning initializing store:', err.message);
    }

    // Seed default workspace if empty
    if (this.workspaces.size === 0) {
      const defaultWs = {
        id: 'ws_default_01',
        name: 'Default Workspace',
        description: 'Default primary environment for KS Sentinel',
        status: 'ACTIVE',
        rootPath: 'D:\\.vscode\\Coding\\Projects\\antigravity\\KS_Sentinel_2.0',
        agentId: 'sentinel-local-agent-01',
        metadata: {
          color: '#00e5ff',
          tags: ['default', 'core']
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString()
      };
      this.workspaces.set(defaultWs.id, defaultWs);
      this.activeWorkspaceId = defaultWs.id;
      this.saveToDisk();
    }
  }

  /**
   * Persist current state to JSON file atomically.
   */
  saveToDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const payload = {
        version: '1.0.0',
        activeWorkspaceId: this.activeWorkspaceId,
        updatedAt: new Date().toISOString(),
        workspaces: Array.from(this.workspaces.values())
      };

      const tmpPath = `${this.storagePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      try {
        fs.renameSync(tmpPath, this.storagePath);
      } catch (renameErr) {
        fs.copyFileSync(tmpPath, this.storagePath);
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    } catch (err) {
      console.error('[WORKSPACE STORE] Error saving to disk:', err.message);
    }
  }

  /**
   * Validate and sanitize rootPath.
   * Disallows path traversal sequences ('..') to enforce boundary.
   */
  validateRootPath(rootPath) {
    if (!rootPath || typeof rootPath !== 'string') return '';
    const trimmed = rootPath.trim();
    if (trimmed.includes('..')) {
      throw new Error('Invalid rootPath: Relative directory traversal (..) is not permitted.');
    }
    // Disallow dangerous shell metacharacters
    if (/[\x00\r\n\t;|&$`><"]/.test(trimmed)) {
      throw new Error('Invalid rootPath: Contains invalid or prohibited characters.');
    }
    return trimmed;
  }

  /**
   * Enrich workspace data with live agent status.
   */
  enrichWithAgentStatus(ws) {
    if (!ws) return null;
    const agentStatus = this.agentRegistry ? this.agentRegistry.getStatus() : { connected: false, state: 'NOT_CONNECTED' };
    
    // Check if the workspace is associated with the active agent
    const isAssociated = Boolean(
      (ws.agentId && agentStatus.agent && ws.agentId === agentStatus.agent.agentId) ||
      (!ws.agentId && agentStatus.agent) ||
      (ws.agentId === 'sentinel-local-agent-01')
    );
    const isAgentConnected = agentStatus.connected;

    let bindingState = 'UNBOUND';
    if (ws.rootPath) {
      if (isAgentConnected && isAssociated) {
        bindingState = 'BOUND_AGENT_ONLINE';
      } else {
        bindingState = 'BOUND_AGENT_OFFLINE';
      }
    }

    return {
      ...ws,
      isActive: ws.id === this.activeWorkspaceId,
      agentStatus: {
        associatedAgentId: ws.agentId || (agentStatus.agent ? agentStatus.agent.agentId : null),
        isAgentConnected: isAgentConnected && isAssociated,
        agentState: isAssociated ? agentStatus.state : (isAgentConnected ? 'CONNECTED' : agentStatus.state),
        agentName: agentStatus.agent ? agentStatus.agent.agentName : null
      },
      bindingStatus: {
        state: bindingState,
        hasRoot: Boolean(ws.rootPath),
        rootPath: ws.rootPath || null
      }
    };
  }

  /**
   * List all workspaces.
   */
  listWorkspaces() {
    return {
      activeWorkspaceId: this.activeWorkspaceId,
      total: this.workspaces.size,
      workspaces: Array.from(this.workspaces.values()).map((ws) => this.enrichWithAgentStatus(ws))
    };
  }

  /**
   * Get workspace by ID.
   */
  getWorkspace(id) {
    const ws = this.workspaces.get(id);
    if (!ws) return null;
    return this.enrichWithAgentStatus(ws);
  }

  /**
   * Get active workspace.
   */
  getActiveWorkspace() {
    if (!this.activeWorkspaceId) return null;
    const ws = this.workspaces.get(this.activeWorkspaceId);
    if (!ws) return null;
    return this.enrichWithAgentStatus(ws);
  }

  /**
   * Create a new workspace.
   */
  createWorkspace({ name, description = '', rootPath = '', agentId = null, metadata = {} }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Workspace name is required and must be a non-empty string.');
    }

    const cleanName = name.trim();
    if (cleanName.length > 80) {
      throw new Error('Workspace name cannot exceed 80 characters.');
    }

    const cleanRootPath = this.validateRootPath(rootPath);
    const now = new Date().toISOString();
    const id = `ws_${crypto.randomBytes(6).toString('hex')}`;

    // If agentId is not specified, check if an agent is currently connected and bind by default
    let boundAgentId = agentId ? String(agentId).trim() : null;
    if (!boundAgentId && this.agentRegistry) {
      const currentStatus = this.agentRegistry.getStatus();
      if (currentStatus.connected && currentStatus.agent) {
        boundAgentId = currentStatus.agent.agentId;
      }
    }

    const newWs = {
      id,
      name: cleanName,
      description: typeof description === 'string' ? description.trim() : '',
      status: 'INACTIVE',
      rootPath: cleanRootPath,
      agentId: boundAgentId,
      metadata: {
        color: metadata.color || '#00e5ff',
        tags: Array.isArray(metadata.tags) ? metadata.tags : []
      },
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null
    };

    this.workspaces.set(id, newWs);
    this.saveToDisk();

    return this.enrichWithAgentStatus(newWs);
  }

  /**
   * Open / Activate workspace.
   */
  openWorkspace(id) {
    const ws = this.workspaces.get(id);
    if (!ws) {
      throw new Error(`Workspace not found with id: ${id}`);
    }

    // Deactivate previous active workspace
    if (this.activeWorkspaceId && this.activeWorkspaceId !== id) {
      const prev = this.workspaces.get(this.activeWorkspaceId);
      if (prev) {
        prev.status = 'INACTIVE';
        prev.updatedAt = new Date().toISOString();
      }
    }

    const now = new Date().toISOString();
    ws.status = 'ACTIVE';
    ws.lastOpenedAt = now;
    ws.updatedAt = now;
    this.activeWorkspaceId = id;

    this.saveToDisk();
    return this.enrichWithAgentStatus(ws);
  }

  /**
   * Close workspace (deactivate).
   */
  closeWorkspace(id) {
    const ws = this.workspaces.get(id);
    if (!ws) {
      throw new Error(`Workspace not found with id: ${id}`);
    }

    ws.status = 'CLOSED';
    ws.updatedAt = new Date().toISOString();

    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = null;
    }

    this.saveToDisk();
    return this.enrichWithAgentStatus(ws);
  }

  /**
   * Switch active workspace.
   */
  switchWorkspace(id) {
    return this.openWorkspace(id);
  }

  /**
   * Update workspace metadata.
   */
  updateWorkspace(id, updates = {}) {
    const ws = this.workspaces.get(id);
    if (!ws) {
      throw new Error(`Workspace not found with id: ${id}`);
    }

    if (updates.name !== undefined) {
      if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length === 0) {
        throw new Error('Workspace name must be a non-empty string.');
      }
      ws.name = updates.name.trim();
    }

    if (updates.description !== undefined) {
      ws.description = typeof updates.description === 'string' ? updates.description.trim() : '';
    }

    if (updates.rootPath !== undefined) {
      ws.rootPath = this.validateRootPath(updates.rootPath);
    }

    if (updates.agentId !== undefined) {
      ws.agentId = updates.agentId ? String(updates.agentId).trim() : null;
    }

    if (updates.metadata && typeof updates.metadata === 'object') {
      ws.metadata = {
        ...ws.metadata,
        ...updates.metadata
      };
    }

    ws.updatedAt = new Date().toISOString();
    this.saveToDisk();

    return this.enrichWithAgentStatus(ws);
  }

  /**
   * Safely delete workspace.
   */
  deleteWorkspace(id) {
    const ws = this.workspaces.get(id);
    if (!ws) {
      throw new Error(`Workspace not found with id: ${id}`);
    }

    if (this.workspaces.size <= 1) {
      throw new Error('Cannot delete the last remaining workspace.');
    }

    // If active workspace is deleted, clear active or fallback to first other workspace
    const wasActive = this.activeWorkspaceId === id;
    this.workspaces.delete(id);

    // Cascade delete any projects belonging to this workspace
    if (this.projectStore) {
      try {
        this.projectStore.deleteProjectsByWorkspace(id);
      } catch (err) {
        console.warn('[WORKSPACE STORE] Warning deleting associated projects:', err.message);
      }
    }

    if (wasActive) {
      const remaining = Array.from(this.workspaces.values());
      if (remaining.length > 0) {
        remaining[0].status = 'ACTIVE';
        remaining[0].updatedAt = new Date().toISOString();
        this.activeWorkspaceId = remaining[0].id;
      } else {
        this.activeWorkspaceId = null;
      }
    }

    this.saveToDisk();
    return {
      deleted: true,
      id,
      activeWorkspaceId: this.activeWorkspaceId
    };
  }
}

// Singleton instance
const workspaceStore = new WorkspaceStore();

module.exports = {
  WorkspaceStore,
  workspaceStore
};

