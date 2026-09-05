/**
 * KS Sentinel 2.0 — Sentinel Project Manager Application
 * Module 6: Projects
 *
 * Provides safe project lifecycle management:
 * - Scoped strictly to the active Sentinel Workspace.
 * - List, create, activate, close, and delete projects.
 * - Manage logical project sub-path bindings on the authorized host machine.
 * - Strictly enforces security boundary (no filesystem browsing, no git, no shell).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { eventBus, EventTypes } from '../../events/eventBus';
import './projects.css';

export default function ProjectManager() {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    rootPath: '',
    type: 'general',
    tags: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Active Workspace & Projects
  const fetchActiveWorkspaceAndProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Get active workspace
      const wsRes = await fetch('/api/workspaces/active');
      if (!wsRes.ok) throw new Error(`Workspace query failed (${wsRes.status})`);
      const wsData = await wsRes.json();

      if (wsData && wsData.active && wsData.workspace) {
        setActiveWorkspace(wsData.workspace);
        const wsId = wsData.workspace.id;

        // 2. Fetch projects for this workspace
        const projRes = await fetch(`/api/projects?workspaceId=${encodeURIComponent(wsId)}`);
        if (!projRes.ok) throw new Error(`Project query failed (${projRes.status})`);
        const projData = await projRes.json();

        setProjects(projData.projects || []);
        setActiveProjectId(projData.activeProjectId || null);

        // Retain or set selected project
        if (projData.projects && projData.projects.length > 0) {
          setSelectedId((prev) => {
            if (prev && projData.projects.some((p) => p.id === prev)) return prev;
            return projData.activeProjectId || projData.projects[0].id;
          });
        } else {
          setSelectedId(null);
        }
      } else {
        setActiveWorkspace(null);
        setProjects([]);
        setActiveProjectId(null);
        setSelectedId(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch projects from Gateway');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveWorkspaceAndProjects();

    const unsubscribe = eventBus.subscribe('*', (evt) => {
      if (
        evt.type &&
        (evt.type.startsWith('WORKSPACE_') || evt.type.startsWith('PROJECT_'))
      ) {
        fetchActiveWorkspaceAndProjects();
      }
    });

    return unsubscribe;
  }, [fetchActiveWorkspaceAndProjects]);

  // Selected project object
  const selectedProj = projects.find((p) => p.id === selectedId) || null;

  // Handle Activate / Open Project
  const handleActivate = async (id) => {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${id}/open`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to activate project (${res.status})`);
      }
      const updated = await res.json();
      setActiveProjectId(id);
      setActionMessage(`Active project set to "${updated.name}"`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.PROJECT_SWITCHED, {
        projectId: updated.id,
        name: updated.name,
        workspaceId: updated.workspaceId,
        rootPath: updated.rootPath
      });

      fetchActiveWorkspaceAndProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Close Project
  const handleClose = async (id) => {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${id}/close`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to close project (${res.status})`);
      }
      const updated = await res.json();
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
      setActionMessage(`Project "${updated.name}" closed.`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.PROJECT_CLOSED, {
        projectId: updated.id,
        name: updated.name,
        workspaceId: updated.workspaceId
      });

      fetchActiveWorkspaceAndProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Delete Project
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"?`)) return;
    try {
      setError(null);
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to delete project (${res.status})`);
      }
      setActionMessage(`Project "${name}" removed.`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.PROJECT_DELETED, {
        projectId: id,
        name,
        workspaceId: activeWorkspace ? activeWorkspace.id : null
      });

      if (selectedId === id) {
        setSelectedId(null);
      }
      fetchActiveWorkspaceAndProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Create Project Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !activeWorkspace) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        workspaceId: activeWorkspace.id,
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        rootPath: createForm.rootPath.trim(),
        metadata: {
          type: createForm.type,
          tags: createForm.tags
            ? createForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : []
        }
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Creation failed (${res.status})`);
      }

      const created = await res.json();
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', rootPath: '', type: 'general', tags: '' });
      setSelectedId(created.id);
      setActionMessage(`Project "${created.name}" created.`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.PROJECT_CREATED, {
        projectId: created.id,
        name: created.name,
        workspaceId: created.workspaceId,
        rootPath: created.rootPath
      });

      fetchActiveWorkspaceAndProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="project-manager-container">
      {/* 1. Header Banner */}
      <div className="project-header-banner">
        <div className="project-title-group">
          <span className="project-app-title">
            <span>◲</span> SENTINEL PROJECTS MANAGER
          </span>
          <span className="project-subtitle">
            Logical project units & workspace lifecycle management • Module 6
          </span>
        </div>

        <div className="project-header-actions">
          <button
            className="project-btn-secondary"
            onClick={fetchActiveWorkspaceAndProjects}
            title="Refresh projects"
          >
            ↻ Refresh
          </button>
          <button
            className="project-btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!activeWorkspace}
            title={!activeWorkspace ? 'Activate a workspace first' : 'Create new project'}
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Workspace Context Bar */}
      <div className="project-workspace-bar">
        <div className="project-ws-info">
          <span className="project-ws-label">Parent Workspace:</span>
          {activeWorkspace ? (
            <span className="project-ws-badge">
              <span>⧉</span>
              <strong>{activeWorkspace.name}</strong>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>({activeWorkspace.id})</span>
            </span>
          ) : (
            <span style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
              No Active Workspace Selected
            </span>
          )}
        </div>
        {activeWorkspace && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Root: {activeWorkspace.rootPath || '(Unbound)'}
          </span>
        )}
      </div>

      {/* Action / Error Banner */}
      {error && (
        <div
          style={{
            background: 'rgba(255,82,82,0.15)',
            color: 'var(--accent-red)',
            padding: '6px 16px',
            fontSize: '11px',
            borderBottom: '1px solid rgba(255,82,82,0.3)'
          }}
        >
          ⚠ {error}
        </div>
      )}
      {actionMessage && (
        <div
          style={{
            background: 'rgba(0,230,118,0.12)',
            color: 'var(--accent-green)',
            padding: '6px 16px',
            fontSize: '11px',
            borderBottom: '1px solid rgba(0,230,118,0.3)'
          }}
        >
          ✓ {actionMessage}
        </div>
      )}

      {/* 2. Content Split */}
      <div className="project-content-split">
        {/* Left: Projects List */}
        <div className="project-list-column">
          <div className="project-list-header">
            <span>WORKSPACE PROJECTS ({projects.length})</span>
          </div>

          {!activeWorkspace ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
              Please select and activate a workspace in Workspace Manager to view or create projects.
            </div>
          ) : isLoading && projects.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
              No projects in this workspace. Click "+ New Project" to add one.
            </div>
          ) : (
            projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              const isSelected = proj.id === selectedId;
              return (
                <div
                  key={proj.id}
                  className={`project-card ${isSelected ? 'selected' : ''} ${isActive ? 'is-active-proj' : ''}`}
                  onClick={() => setSelectedId(proj.id)}
                >
                  <div className="project-card-title-row">
                    <span className="project-card-name">{proj.name}</span>
                    <span className={`project-pill ${isActive ? 'project-pill-active' : 'project-pill-inactive'}`}>
                      {isActive ? 'ACTIVE' : proj.status}
                    </span>
                  </div>
                  <span className="project-card-root" title={proj.rootPath || 'No sub-path bound'}>
                    📁 {proj.rootPath ? proj.rootPath : '(Unbound Root)'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Project Details */}
        <div className="project-detail-column">
          {selectedProj ? (
            <>
              <div className="project-detail-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="project-detail-name">{selectedProj.name}</span>
                    <span
                      className={`project-pill ${
                        selectedProj.id === activeProjectId ? 'project-pill-active' : 'project-pill-inactive'
                      }`}
                    >
                      {selectedProj.id === activeProjectId ? 'ACTIVE PROJECT' : selectedProj.status}
                    </span>
                  </div>
                  <div className="project-detail-desc">
                    {selectedProj.description || 'No description provided.'}
                  </div>
                </div>

                <div className="project-detail-actions">
                  {selectedProj.id !== activeProjectId ? (
                    <button
                      className="project-action-btn-activate"
                      onClick={() => handleActivate(selectedProj.id)}
                    >
                      ✓ Activate Project
                    </button>
                  ) : (
                    <button
                      className="project-action-btn-close"
                      onClick={() => handleClose(selectedProj.id)}
                    >
                      Close Active Project
                    </button>
                  )}
                  <button
                    className="project-action-btn-delete"
                    onClick={() => handleDelete(selectedProj.id, selectedProj.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Info Cards Grid */}
              <div className="project-info-grid">
                {/* ID Card */}
                <div className="project-info-card">
                  <span className="project-info-card-label">Project Identifier</span>
                  <span className="project-info-card-value">{selectedProj.id}</span>
                </div>

                {/* Workspace Association Card */}
                <div className="project-info-card">
                  <span className="project-info-card-label">Parent Workspace</span>
                  <span className="project-info-card-value" style={{ color: 'var(--accent-cyan)' }}>
                    {activeWorkspace ? activeWorkspace.name : selectedProj.workspaceId}
                  </span>
                </div>

                {/* Host Root Path Card */}
                <div className="project-info-card">
                  <span className="project-info-card-label">Logical Host Sub-Path</span>
                  <span className="project-info-card-value">
                    {selectedProj.rootPath || 'Not bound to specific path'}
                  </span>
                </div>

                {/* Timeline Card */}
                <div className="project-info-card">
                  <span className="project-info-card-label">Timeline</span>
                  <span className="project-info-card-value" style={{ fontSize: '11px' }}>
                    Created: {new Date(selectedProj.createdAt).toLocaleDateString()}
                    {selectedProj.lastOpenedAt &&
                      ` • Opened: ${new Date(selectedProj.lastOpenedAt).toLocaleTimeString()}`}
                  </span>
                </div>
              </div>

              {/* Tags and Metadata */}
              {selectedProj.metadata?.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    TAGS:
                  </span>
                  {selectedProj.metadata.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '3px',
                        padding: '1px 6px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-main)'
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Security Boundary Notice */}
              <div className="project-security-banner">
                <span style={{ fontSize: '16px' }}>🛡</span>
                <div>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>
                    Security Boundary Active (Module 6)
                  </strong>
                  A project represents a logical development unit. It inherits host-agent bindings from its parent workspace. Arbitrary filesystem access, git modifications, and process executions are strictly prohibited in Module 6.
                </div>
              </div>
            </>
          ) : (
            <div className="project-detail-empty">
              <span>◲</span>
              <span>Select a project from the list to view details or create a new project.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Create Modal */}
      {showCreateModal && (
        <div className="project-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="project-modal" onClick={(e) => e.stopPropagation()}>
            <span className="project-modal-title">Create Sentinel Project</span>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="project-form-group">
                <label className="project-form-label">Project Name *</label>
                <input
                  type="text"
                  required
                  className="project-form-input"
                  placeholder="e.g. Sentinel Core Subsystem"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="project-form-group">
                <label className="project-form-label">Local Host Sub-Path (Optional)</label>
                <input
                  type="text"
                  className="project-form-input"
                  placeholder="e.g. D:\Projects\MyProject\frontend"
                  value={createForm.rootPath}
                  onChange={(e) => setCreateForm({ ...createForm, rootPath: e.target.value })}
                />
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  Logical sub-path on host. Traversal sequences ('..') are prohibited.
                </span>
              </div>

              <div className="project-form-group">
                <label className="project-form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="project-form-input"
                  placeholder="Brief note about this project"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div className="project-form-group">
                <label className="project-form-label">Tags (comma-separated, optional)</label>
                <input
                  type="text"
                  className="project-form-input"
                  placeholder="e.g. core, frontend, api"
                  value={createForm.tags}
                  onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                />
              </div>

              <div className="project-modal-actions">
                <button
                  type="button"
                  className="project-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="project-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

