/**
 * KS Sentinel 2.0 — Sentinel Project Store
 * Module 6: Projects
 *
 * Implements the core Project model, lifecycle management,
 * workspace scoping, active project tracking, and atomic JSON persistence.
 *
 * Strictly adheres to security boundary:
 * - Logical root binding only (no filesystem access).
 * - No shell, process, or file-reading endpoints.
 * - Workspace isolation: projects are strictly scoped to a parent workspace.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Default storage location: server/data/projects.json
const DEFAULT_STORAGE_PATH = path.resolve(__dirname, '../data/projects.json');

class ProjectStore {
  constructor(storagePath = DEFAULT_STORAGE_PATH, workspaceStore = null) {
    this.storagePath = storagePath;
    this.workspaceStore = workspaceStore;
    this.projects = new Map();
    // Tracks active project id by workspace id: { [workspaceId]: projectId }
    this.activeProjects = new Map();
    this.init();
  }

  /**
   * Set workspace store reference for parent workspace validation.
   */
  setWorkspaceStore(workspaceStore) {
    this.workspaceStore = workspaceStore;
  }

  /**
   * Initialize store: ensure directory exists, load from disk, seed default if empty.
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
        if (Array.isArray(data.projects)) {
          for (const proj of data.projects) {
            this.projects.set(proj.id, proj);
          }
        }
        if (data.activeProjects && typeof data.activeProjects === 'object') {
          for (const [wsId, projId] of Object.entries(data.activeProjects)) {
            this.activeProjects.set(wsId, projId);
          }
        }
      }
    } catch (err) {
      console.warn('[PROJECT STORE] Warning initializing store:', err.message);
    }

    // Seed default project for default workspace if store is empty
    if (this.projects.size === 0) {
      const defaultProj = {
        id: 'proj_default_01',
        workspaceId: 'ws_default_01',
        name: 'KS Sentinel Core',
        description: 'Primary KS Sentinel 2.0 system development project',
        status: 'ACTIVE',
        rootPath: 'D:\\.vscode\\Coding\\Projects\\antigravity\\KS_Sentinel_2.0',
        metadata: {
          color: '#7c4dff',
          tags: ['sentinel', 'core'],
          type: 'system'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString()
      };
      this.projects.set(defaultProj.id, defaultProj);
      this.activeProjects.set('ws_default_01', defaultProj.id);
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

      const activeObj = {};
      for (const [wsId, projId] of this.activeProjects.entries()) {
        activeObj[wsId] = projId;
      }

      const payload = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        activeProjects: activeObj,
        projects: Array.from(this.projects.values())
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
      console.error('[PROJECT STORE] Error saving to disk:', err.message);
    }
  }

  /**
   * Validate and sanitize rootPath.
   * Disallows relative directory traversal ('..') and dangerous shell metacharacters.
   */
  validateRootPath(rootPath) {
    if (!rootPath || typeof rootPath !== 'string') return '';
    const trimmed = rootPath.trim();
    if (trimmed.includes('..')) {
      throw new Error('Invalid rootPath: Relative directory traversal (..) is not permitted.');
    }
    if (/[\x00\r\n\t;|&$`><"]/.test(trimmed)) {
      throw new Error('Invalid rootPath: Contains invalid or prohibited characters.');
    }
    return trimmed;
  }

  /**
   * Enrich project record with active status flag.
   */
  enrichProject(proj) {
    if (!proj) return null;
    const activeForWs = this.activeProjects.get(proj.workspaceId);
    return {
      ...proj,
      isActive: activeForWs === proj.id
    };
  }

  /**
   * Resolve target workspaceId (uses provided or currently active workspace).
   */
  resolveWorkspaceId(workspaceId) {
    if (workspaceId && typeof workspaceId === 'string' && workspaceId.trim().length > 0) {
      return workspaceId.trim();
    }
    if (this.workspaceStore) {
      const activeWs = this.workspaceStore.getActiveWorkspace();
      if (activeWs && activeWs.id) {
        return activeWs.id;
      }
    }
    return null;
  }

  /**
   * List projects scoped to a specific workspace.
   */
  listProjects(workspaceId = null) {
    const wsId = this.resolveWorkspaceId(workspaceId);
    if (!wsId) {
      return {
        workspaceId: null,
        activeProjectId: null,
        total: 0,
        projects: []
      };
    }

    const filtered = Array.from(this.projects.values())
      .filter((p) => p.workspaceId === wsId)
      .map((p) => this.enrichProject(p));

    return {
      workspaceId: wsId,
      activeProjectId: this.activeProjects.get(wsId) || null,
      total: filtered.length,
      projects: filtered
    };
  }

  /**
   * Get project by ID.
   */
  getProject(id) {
    const proj = this.projects.get(id);
    if (!proj) return null;
    return this.enrichProject(proj);
  }

  /**
   * Get active project for a given workspace.
   */
  getActiveProject(workspaceId = null) {
    const wsId = this.resolveWorkspaceId(workspaceId);
    if (!wsId) return null;

    const activeId = this.activeProjects.get(wsId);
    if (!activeId) return null;

    const proj = this.projects.get(activeId);
    if (!proj) return null;

    return this.enrichProject(proj);
  }

  /**
   * Create a new project.
   */
  createProject({ workspaceId = null, name, description = '', rootPath = '', metadata = {} }) {
    const targetWsId = this.resolveWorkspaceId(workspaceId);
    if (!targetWsId) {
      throw new Error('Workspace association is required to create a project. No active workspace found.');
    }

    // Verify workspace exists if workspaceStore is available
    if (this.workspaceStore) {
      const parentWs = this.workspaceStore.getWorkspace(targetWsId);
      if (!parentWs) {
        throw new Error(`Target workspace not found: ${targetWsId}`);
      }
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Project name is required and must be a non-empty string.');
    }

    const cleanName = name.trim();
    if (cleanName.length > 80) {
      throw new Error('Project name cannot exceed 80 characters.');
    }

    const cleanRootPath = this.validateRootPath(rootPath);
    const now = new Date().toISOString();
    const id = `proj_${crypto.randomBytes(6).toString('hex')}`;

    const newProj = {
      id,
      workspaceId: targetWsId,
      name: cleanName,
      description: typeof description === 'string' ? description.trim() : '',
      status: 'INACTIVE',
      rootPath: cleanRootPath,
      metadata: {
        color: metadata.color || '#7c4dff',
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        type: metadata.type || 'general'
      },
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null
    };

    this.projects.set(id, newProj);
    this.saveToDisk();

    return this.enrichProject(newProj);
  }

  /**
   * Open / Activate a project within its workspace.
   */
  openProject(id) {
    const proj = this.projects.get(id);
    if (!proj) {
      throw new Error(`Project not found with id: ${id}`);
    }

    const wsId = proj.workspaceId;
    const currentActiveId = this.activeProjects.get(wsId);

    // Deactivate previous active project in this workspace
    if (currentActiveId && currentActiveId !== id) {
      const prev = this.projects.get(currentActiveId);
      if (prev) {
        prev.status = 'INACTIVE';
        prev.updatedAt = new Date().toISOString();
      }
    }

    const now = new Date().toISOString();
    proj.status = 'ACTIVE';
    proj.lastOpenedAt = now;
    proj.updatedAt = now;
    this.activeProjects.set(wsId, id);

    this.saveToDisk();
    return this.enrichProject(proj);
  }

  /**
   * Switch active project (alias for openProject).
   */
  switchProject(id) {
    return this.openProject(id);
  }

  /**
   * Close a project (deactivate).
   */
  closeProject(id) {
    const proj = this.projects.get(id);
    if (!proj) {
      throw new Error(`Project not found with id: ${id}`);
    }

    const wsId = proj.workspaceId;
    proj.status = 'CLOSED';
    proj.updatedAt = new Date().toISOString();

    if (this.activeProjects.get(wsId) === id) {
      this.activeProjects.delete(wsId);
    }

    this.saveToDisk();
    return this.enrichProject(proj);
  }

  /**
   * Update project metadata or rootPath.
   */
  updateProject(id, updates = {}) {
    const proj = this.projects.get(id);
    if (!proj) {
      throw new Error(`Project not found with id: ${id}`);
    }

    if (updates.name !== undefined) {
      if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length === 0) {
        throw new Error('Project name must be a non-empty string.');
      }
      const cleanName = updates.name.trim();
      if (cleanName.length > 80) {
        throw new Error('Project name cannot exceed 80 characters.');
      }
      proj.name = cleanName;
    }

    if (updates.description !== undefined) {
      proj.description = typeof updates.description === 'string' ? updates.description.trim() : '';
    }

    if (updates.rootPath !== undefined) {
      proj.rootPath = this.validateRootPath(updates.rootPath);
    }

    if (updates.metadata && typeof updates.metadata === 'object') {
      proj.metadata = {
        ...proj.metadata,
        ...updates.metadata
      };
    }

    proj.updatedAt = new Date().toISOString();
    this.saveToDisk();

    return this.enrichProject(proj);
  }

  /**
   * Delete project safely.
   */
  deleteProject(id) {
    const proj = this.projects.get(id);
    if (!proj) {
      throw new Error(`Project not found with id: ${id}`);
    }

    const wsId = proj.workspaceId;
    if (this.activeProjects.get(wsId) === id) {
      this.activeProjects.delete(wsId);
    }

    this.projects.delete(id);
    this.saveToDisk();

    return {
      deleted: true,
      id,
      workspaceId: wsId
    };
  }

  /**
   * Delete all projects belonging to a workspace (for cascade deletion).
   */
  deleteProjectsByWorkspace(workspaceId) {
    if (!workspaceId) return 0;
    let deletedCount = 0;

    for (const [id, proj] of this.projects.entries()) {
      if (proj.workspaceId === workspaceId) {
        this.projects.delete(id);
        deletedCount++;
      }
    }

    this.activeProjects.delete(workspaceId);

    if (deletedCount > 0) {
      this.saveToDisk();
    }

    return deletedCount;
  }
}

// Singleton instance
const projectStore = new ProjectStore();

module.exports = {
  ProjectStore,
  projectStore
};
