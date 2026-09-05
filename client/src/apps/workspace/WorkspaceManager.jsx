/**
 * KS Sentinel 2.0 — Sentinel Workspace Manager Application
 * Module 5: Sentinel Workspace
 *
 * Provides safe workspace lifecycle management:
 * - List, create, activate, close, and delete workspaces.
 * - Manage logical root bindings on the authorized machine.
 * - Monitor associated Local Sentinel Agent status.
 * - Strictly enforces security boundary (no filesystem access).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { eventBus, EventTypes } from '../../events/eventBus';
import './workspace.css';

export default function WorkspaceManager() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Workspaces from Gateway
  const fetchWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/workspaces');
      if (!res.ok) throw new Error(`Gateway returned status ${res.status}`);
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      setActiveWorkspaceId(data.activeWorkspaceId || null);

      // Default selected to active or first
      if (!selectedId && data.workspaces && data.workspaces.length > 0) {
        setSelectedId(data.activeWorkspaceId || data.workspaces[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch workspaces from Gateway');
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Selected workspace object
  const selectedWs = workspaces.find((w) => w.id === selectedId) || null;

  // Handle Activate / Open Workspace
  const handleActivate = async (id) => {
    try {
      setError(null);
      const res = await fetch(`/api/workspaces/${id}/open`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to activate workspace (${res.status})`);
      }
      const updated = await res.json();
      setActiveWorkspaceId(id);
      setActionMessage(`Switched active workspace to "${updated.name}"`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.WORKSPACE_SWITCHED, {
        workspaceId: updated.id,
        name: updated.name,
        rootPath: updated.rootPath
      });

      fetchWorkspaces();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Close Workspace
  const handleClose = async (id) => {
    try {
      setError(null);
      const res = await fetch(`/api/workspaces/${id}/close`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to close workspace (${res.status})`);
      }
      const updated = await res.json();
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(null);
      }
      setActionMessage(`Workspace "${updated.name}" closed.`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.WORKSPACE_CLOSED, {
        workspaceId: updated.id,
        name: updated.name
      });

      fetchWorkspaces();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Delete Workspace
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete workspace "${name}"?`)) return;
    try {
      setError(null);
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to delete workspace (${res.status})`);
      }
      setActionMessage(`Workspace "${name}" removed.`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.WORKSPACE_DELETED, { workspaceId: id, name });

      if (selectedId === id) {
        setSelectedId(null);
      }
      fetchWorkspaces();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Create Workspace Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Creation failed (${res.status})`);
      }

      const created = await res.json();
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', rootPath: '' });
      setSelectedId(created.id);
      setActionMessage(`Workspace "${created.name}" created.`);
      setTimeout(() => setActionMessage(null), 3500);

      // Publish Shell Event
      eventBus.publish(EventTypes.WORKSPACE_CREATED, {
        workspaceId: created.id,
        name: created.name,
        rootPath: created.rootPath
      });

      fetchWorkspaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="workspace-manager-container">
      {/* 1. Header Banner */}
      <div className="workspace-header-banner">
        <div className="workspace-title-group">
          <span className="workspace-app-title">
            <span>⧉</span> SENTINEL WORKSPACE MANAGER
          </span>
          <span className="workspace-subtitle">
            Logical workspace bindings & authorized agent association • Module 5
          </span>
        </div>

        <div className="workspace-header-actions">
          <button className="workspace-btn-secondary" onClick={fetchWorkspaces} title="Refresh workspaces">
            ↻ Refresh
          </button>
          <button className="workspace-btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Workspace
          </button>
        </div>
      </div>

      {/* Action / Error Banner */}
      {error && (
        <div style={{ background: 'rgba(255,82,82,0.15)', color: 'var(--accent-red)', padding: '6px 16px', fontSize: '11px', borderBottom: '1px solid rgba(255,82,82,0.3)' }}>
          ⚠ {error}
        </div>
      )}
      {actionMessage && (
        <div style={{ background: 'rgba(0,230,118,0.12)', color: 'var(--accent-green)', padding: '6px 16px', fontSize: '11px', borderBottom: '1px solid rgba(0,230,118,0.3)' }}>
          ✓ {actionMessage}
        </div>
      )}

      {/* 2. Content Split */}
      <div className="workspace-content-split">
        {/* Left: Workspaces List */}
        <div className="workspace-list-column">
          <div className="workspace-list-header">
            <span>AVAILABLE WORKSPACES ({workspaces.length})</span>
          </div>

          {isLoading && workspaces.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
              Loading workspaces...
            </div>
          ) : workspaces.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
              No workspaces defined.
            </div>
          ) : (
            workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const isSelected = ws.id === selectedId;
              return (
                <div
                  key={ws.id}
                  className={`workspace-card ${isSelected ? 'selected' : ''} ${isActive ? 'is-active-ws' : ''}`}
                  onClick={() => setSelectedId(ws.id)}
                >
                  <div className="workspace-card-title-row">
                    <span className="workspace-card-name">{ws.name}</span>
                    <span className={`workspace-pill ${isActive ? 'workspace-pill-active' : 'workspace-pill-inactive'}`}>
                      {isActive ? 'ACTIVE' : ws.status}
                    </span>
                  </div>
                  <span className="workspace-card-root" title={ws.rootPath || 'No root bound'}>
                    📁 {ws.rootPath ? ws.rootPath : '(Unbound Root)'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Workspace Details */}
        <div className="workspace-detail-column">
          {selectedWs ? (
            <>
              <div className="workspace-detail-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="workspace-detail-name">{selectedWs.name}</span>
                    <span className={`workspace-pill ${selectedWs.id === activeWorkspaceId ? 'workspace-pill-active' : 'workspace-pill-inactive'}`}>
                      {selectedWs.id === activeWorkspaceId ? 'ACTIVE WORKSPACE' : selectedWs.status}
                    </span>
                  </div>
                  <div className="workspace-detail-desc">
                    {selectedWs.description || 'No description provided.'}
                  </div>
                </div>

                <div className="workspace-detail-actions">
                  {selectedWs.id !== activeWorkspaceId ? (
                    <button
                      className="workspace-action-btn-activate"
                      onClick={() => handleActivate(selectedWs.id)}
                    >
                      ✓ Activate Workspace
                    </button>
                  ) : (
                    <button
                      className="workspace-action-btn-close"
                      onClick={() => handleClose(selectedWs.id)}
                    >
                      Close Active Workspace
                    </button>
                  )}
                  {workspaces.length > 1 && (
                    <button
                      className="workspace-action-btn-delete"
                      onClick={() => handleDelete(selectedWs.id, selectedWs.name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Info Cards Grid */}
              <div className="workspace-info-grid">
                {/* ID Card */}
                <div className="workspace-info-card">
                  <span className="workspace-info-card-label">Workspace Identifier</span>
                  <span className="workspace-info-card-value">{selectedWs.id}</span>
                </div>

                {/* Root Binding Card */}
                <div className="workspace-info-card">
                  <span className="workspace-info-card-label">
                    <span>Host Root Binding</span>
                    <span style={{ fontSize: '9px', color: 'var(--accent-cyan)' }}>
                      {selectedWs.bindingStatus?.state || 'UNBOUND'}
                    </span>
                  </span>
                  <span className="workspace-info-card-value">
                    {selectedWs.rootPath ? selectedWs.rootPath : 'No local directory bound'}
                  </span>
                </div>

                {/* Agent Association Card */}
                <div className="workspace-info-card">
                  <span className="workspace-info-card-label">
                    <span>Associated Agent</span>
                    <span
                      style={{
                        fontSize: '9px',
                        color: selectedWs.agentStatus?.isAgentConnected
                          ? 'var(--accent-green)'
                          : selectedWs.agentStatus?.agentState === 'OFFLINE'
                          ? 'var(--accent-red)'
                          : 'var(--text-muted)'
                      }}
                    >
                      {selectedWs.agentStatus?.isAgentConnected ? 'CONNECTED' : selectedWs.agentStatus?.agentState || 'UNBOUND'}
                    </span>
                  </span>
                  <span className="workspace-info-card-value">
                    {selectedWs.agentId ? selectedWs.agentId : 'None (Independent)'}
                  </span>
                </div>

                {/* Timestamps Card */}
                <div className="workspace-info-card">
                  <span className="workspace-info-card-label">Timeline</span>
                  <span className="workspace-info-card-value" style={{ fontSize: '11px' }}>
                    Created: {new Date(selectedWs.createdAt).toLocaleDateString()}
                    {selectedWs.lastOpenedAt && ` • Opened: ${new Date(selectedWs.lastOpenedAt).toLocaleTimeString()}`}
                  </span>
                </div>
              </div>

              {/* Security Boundary Notice */}
              <div className="workspace-security-banner">
                <span style={{ fontSize: '16px' }}>🛡</span>
                <div>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>
                    Security Boundary Active
                  </strong>
                  A workspace root binding establishes logical association only. It does not grant arbitrary filesystem browsing, shell execution, or file modifications.
                </div>
              </div>
            </>
          ) : (
            <div className="workspace-detail-empty">
              <span>⧉</span>
              <span>Select a workspace to view details or create a new one.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Create Modal */}
      {showCreateModal && (
        <div className="workspace-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="workspace-modal" onClick={(e) => e.stopPropagation()}>
            <span className="workspace-modal-title">Create Sentinel Workspace</span>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="workspace-form-group">
                <label className="workspace-form-label">Workspace Name *</label>
                <input
                  type="text"
                  required
                  className="workspace-form-input"
                  placeholder="e.g. Sentinel Core Projects"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="workspace-form-group">
                <label className="workspace-form-label">Local Host Root Path (Optional)</label>
                <input
                  type="text"
                  className="workspace-form-input"
                  placeholder="e.g. D:\Projects\MyProject"
                  value={createForm.rootPath}
                  onChange={(e) => setCreateForm({ ...createForm, rootPath: e.target.value })}
                />
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  Bound path on the local authorized machine. Directory traversal ('..') is rejected.
                </span>
              </div>

              <div className="workspace-form-group">
                <label className="workspace-form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="workspace-form-input"
                  placeholder="Brief note about this workspace"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div className="workspace-modal-actions">
                <button
                  type="button"
                  className="workspace-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="workspace-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

