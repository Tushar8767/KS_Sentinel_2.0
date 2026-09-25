/**
 * KS Sentinel 2.0 — Secure Gateway File Service
 * Module 7A: Read-Only Sandboxed File Manager
 *
 * Provides a clean mediation service between the Web OS and Local Sentinel Agent.
 *
 * STRICT SECURITY BOUNDARIES:
 * - The Gateway NEVER accesses the host filesystem directly.
 * - ZERO imports of 'fs', 'fs/promises', or 'child_process'.
 * - Resolves authorized Workspace/Project rootPath boundaries.
 * - Verifies agent availability and capability support.
 * - Delegates all filesystem reads exclusively to the Local Sentinel Agent via typed capability requests.
 */

const { agentRegistry } = require('./agentRegistry');
const { workspaceStore } = require('./workspaceStore');
const { projectStore } = require('./projectStore');

class FileService {
  constructor(registry = agentRegistry, wsStore = workspaceStore, projStore = projectStore) {
    this.agentRegistry = registry;
    this.workspaceStore = wsStore;
    this.projectStore = projStore;
  }

  /**
   * Resolves the authorized rootPath from workspaceId and optional projectId.
   */
  resolveAuthorizedRoot(workspaceId, projectId = null) {
    let effectiveWorkspaceId = workspaceId;

    if (!effectiveWorkspaceId) {
      const activeWorkspace = this.workspaceStore.getActiveWorkspace();
      if (!activeWorkspace) {
        const err = new Error('No workspaceId provided and no active workspace is currently selected');
        err.status = 400;
        err.code = 'WORKSPACE_REQUIRED';
        throw err;
      }
      effectiveWorkspaceId = activeWorkspace.id;
    }

    const workspace = this.workspaceStore.getWorkspace(effectiveWorkspaceId);
    if (!workspace) {
      const err = new Error(`Workspace not found: ${effectiveWorkspaceId}`);
      err.status = 404;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }

    let rootPath = workspace.rootPath;
    let effectiveProjectId = null;

    if (projectId) {
      const project = this.projectStore.getProject(projectId);
      if (!project) {
        const err = new Error(`Project not found: ${projectId}`);
        err.status = 404;
        err.code = 'PROJECT_NOT_FOUND';
        throw err;
      }

      if (project.workspaceId !== effectiveWorkspaceId) {
        const err = new Error(`Project '${projectId}' does not belong to workspace '${effectiveWorkspaceId}'`);
        err.status = 400;
        err.code = 'WORKSPACE_PROJECT_MISMATCH';
        throw err;
      }

      rootPath = project.rootPath;
      effectiveProjectId = project.id;
    }

    if (!rootPath || typeof rootPath !== 'string') {
      const err = new Error('Authorized rootPath is invalid or not defined on selected workspace/project');
      err.status = 400;
      err.code = 'INVALID_ROOT_PATH';
      throw err;
    }

    return {
      workspaceId: effectiveWorkspaceId,
      projectId: effectiveProjectId,
      rootPath
    };
  }

  /**
   * List directory contents within authorized workspace/project root.
   */
  async listDirectory({ workspaceId, projectId, subPath }) {
    const { rootPath } = this.resolveAuthorizedRoot(workspaceId, projectId);

    const result = await this.agentRegistry.executeCapability('workspace.file.list', {
      rootPath,
      subPath: subPath || ''
    });

    return result;
  }

  /**
   * Get file or directory metadata within authorized workspace/project root.
   */
  async statPath({ workspaceId, projectId, filePath }) {
    if (!filePath || typeof filePath !== 'string') {
      const err = new Error('filePath parameter is required');
      err.status = 400;
      err.code = 'FILE_PATH_REQUIRED';
      throw err;
    }

    const { rootPath } = this.resolveAuthorizedRoot(workspaceId, projectId);

    const result = await this.agentRegistry.executeCapability('workspace.file.stat', {
      rootPath,
      filePath
    });

    return result;
  }

  /**
   * Read preview content of a text/code file within authorized workspace/project root.
   */
  async readFileContent({ workspaceId, projectId, filePath, maxBytes }) {
    if (!filePath || typeof filePath !== 'string') {
      const err = new Error('filePath parameter is required for preview');
      err.status = 400;
      err.code = 'FILE_PATH_REQUIRED';
      throw err;
    }

    const { rootPath } = this.resolveAuthorizedRoot(workspaceId, projectId);

    const result = await this.agentRegistry.executeCapability('workspace.file.read', {
      rootPath,
      filePath,
      maxBytes
    });

    return result;
  }
}

const fileService = new FileService();

module.exports = {
  FileService,
  fileService
};
