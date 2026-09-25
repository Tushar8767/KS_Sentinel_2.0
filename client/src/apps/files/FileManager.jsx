import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { eventBus, EventTypes } from '../../events/eventBus';
import './fileManager.css';

const API_BASE = '/api';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(item) {
  if (item.type === 'directory') return '📁';
  const ext = item.extension || '';
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.py', '.rb', '.java', '.c', '.cpp', '.rs', '.go'].includes(ext)) {
    return '💻';
  }
  if (['.json', '.yml', '.yaml', '.toml', '.env', '.config', '.ini'].includes(ext)) {
    return '⚙️';
  }
  if (['.md', '.txt', '.log', '.doc'].includes(ext)) {
    return '📄';
  }
  if (['.html', '.css', '.scss', '.svg'].includes(ext)) {
    return '🌐';
  }
  return '📃';
}

export default function FileManager() {
  // Workspaces & Projects State
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Agent Status
  const [agentConnected, setAgentConnected] = useState(true);

  // Navigation State
  const [currentSubPath, setCurrentSubPath] = useState('');
  const [history, setHistory] = useState(['']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Directory Content State
  const [directoryData, setDirectoryData] = useState({ root: '', currentPath: '/', items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Selected File & Preview State
  const [selectedItem, setSelectedItem] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Sort State
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Publish event on component mount
  useEffect(() => {
    eventBus.publish(EventTypes.FILE_MANAGER_OPENED, { app: 'file-manager' });
  }, []);

  // Fetch workspaces list on mount
  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const res = await fetch(`${API_BASE}/workspaces`);
        if (res.ok) {
          const data = await res.json();
          const list = data.workspaces || [];
          setWorkspaces(list);
          const activeWs = list.find((w) => w.isActive) || list[0];
          if (activeWs) {
            setSelectedWorkspaceId(activeWs.id);
          }
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      }
    }
    loadWorkspaces();
  }, []);

  // Fetch projects when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) {
      setProjects([]);
      setSelectedProjectId('');
      return;
    }

    async function loadProjects() {
      try {
        const res = await fetch(`${API_BASE}/projects?workspaceId=${selectedWorkspaceId}`);
        if (res.ok) {
          const data = await res.json();
          const list = data.projects || [];
          setProjects(list);
          const activeProj = list.find((p) => p.isActive);
          if (activeProj) {
            setSelectedProjectId(activeProj.id);
          } else {
            setSelectedProjectId('');
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    }
    loadProjects();
  }, [selectedWorkspaceId]);

  // Load directory items
  const loadDirectory = useCallback(
    async (subPath) => {
      if (!selectedWorkspaceId) return;

      setLoading(true);
      setError(null);
      setSelectedItem(null);
      setFilePreview(null);
      setPreviewError(null);

      let url = `${API_BASE}/files/list?workspaceId=${encodeURIComponent(selectedWorkspaceId)}`;
      if (selectedProjectId) {
        url += `&projectId=${encodeURIComponent(selectedProjectId)}`;
      }
      if (subPath) {
        url += `&subPath=${encodeURIComponent(subPath)}`;
      }

      try {
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            setAgentConnected(false);
          } else if (res.status === 403) {
            eventBus.publish(EventTypes.FILE_ACCESS_DENIED, { subPath, error: data.message });
          }
          throw new Error(data.message || `Directory read failed with HTTP ${res.status}`);
        }

        setAgentConnected(true);
        setDirectoryData(data);
        eventBus.publish(EventTypes.DIRECTORY_NAVIGATED, {
          workspaceId: selectedWorkspaceId,
          projectId: selectedProjectId,
          path: data.currentPath
        });
      } catch (err) {
        setError(err.message);
        setDirectoryData({ root: '', currentPath: subPath || '/', items: [] });
      } finally {
        setLoading(false);
      }
    },
    [selectedWorkspaceId, selectedProjectId]
  );

  // Trigger directory load when scope or path changes
  useEffect(() => {
    loadDirectory(currentSubPath);
  }, [currentSubPath, selectedWorkspaceId, selectedProjectId, loadDirectory]);

  // Navigation handlers
  const navigateTo = (newSubPath) => {
    const cleanPath = newSubPath.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (cleanPath === currentSubPath) return;

    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(cleanPath);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentSubPath(cleanPath);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setCurrentSubPath(history[newIdx]);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setCurrentSubPath(history[newIdx]);
    }
  };

  const handleUp = () => {
    if (!currentSubPath) return;
    const parts = currentSubPath.split('/').filter(Boolean);
    parts.pop();
    navigateTo(parts.join('/'));
  };

  // Double click to open folder
  const handleItemDoubleClick = (item) => {
    if (item.type === 'directory') {
      const nextSub = currentSubPath ? `${currentSubPath}/${item.name}` : item.name;
      navigateTo(nextSub);
    }
  };

  // Single click to inspect / preview file
  const handleItemSelect = async (item) => {
    setSelectedItem(item);
    setFilePreview(null);
    setPreviewError(null);

    if (item.type !== 'file') return;

    setPreviewLoading(true);
    let url = `${API_BASE}/files/content?workspaceId=${encodeURIComponent(selectedWorkspaceId)}`;
    if (selectedProjectId) {
      url += `&projectId=${encodeURIComponent(selectedProjectId)}`;
    }
    const itemPath = currentSubPath ? `${currentSubPath}/${item.name}` : item.name;
    url += `&filePath=${encodeURIComponent(itemPath)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Preview failed (HTTP ${res.status})`);
      }
      setFilePreview(data);
      eventBus.publish(EventTypes.FILE_PREVIEWED, {
        workspaceId: selectedWorkspaceId,
        projectId: selectedProjectId,
        name: data.name,
        size: data.size
      });
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filtered & sorted items
  const displayItems = useMemo(() => {
    let items = directoryData.items || [];
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q));
    }

    return [...items].sort((a, b) => {
      // Folders always precede files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [directoryData.items, filterQuery, sortField, sortAsc]);

  // Breadcrumbs calculation
  const breadcrumbSegments = useMemo(() => {
    const rootLabel = directoryData.root || 'Root';
    const segments = [{ label: rootLabel, path: '' }];
    if (!currentSubPath) return segments;

    const parts = currentSubPath.split('/').filter(Boolean);
    let accum = '';
    for (const part of parts) {
      accum = accum ? `${accum}/${part}` : part;
      segments.push({ label: part, path: accum });
    }
    return segments;
  }, [directoryData.root, currentSubPath]);

  return (
    <div className="file-manager-container">
      {/* Header Context Bar */}
      <div className="fm-header-bar">
        <div className="fm-context-group">
          <div className="fm-context-item">
            <span className="fm-context-label">Workspace:</span>
            <select
              className="fm-select"
              value={selectedWorkspaceId}
              onChange={(e) => {
                setSelectedWorkspaceId(e.target.value);
                setCurrentSubPath('');
                setHistory(['']);
                setHistoryIndex(0);
              }}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>

          <div className="fm-context-item">
            <span className="fm-context-label">Project:</span>
            <select
              className="fm-select"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setCurrentSubPath('');
                setHistory(['']);
                setHistoryIndex(0);
              }}
            >
              <option value="">(Workspace Root)</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fm-context-group">
          {agentConnected ? (
            <div className="fm-header-badge">
              <span>●</span> AGENT ONLINE
            </div>
          ) : (
            <div className="fm-header-badge fm-badge-offline">
              <span>●</span> AGENT OFFLINE
            </div>
          )}
        </div>
      </div>

      {/* Navigation Toolbar */}
      <div className="fm-nav-bar">
        <div className="fm-nav-buttons">
          <button
            className="fm-btn-icon"
            onClick={handleBack}
            disabled={historyIndex <= 0}
            title="Back"
          >
            ←
          </button>
          <button
            className="fm-btn-icon"
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            title="Forward"
          >
            →
          </button>
          <button
            className="fm-btn-icon"
            onClick={handleUp}
            disabled={!currentSubPath}
            title="Up one level"
          >
            ↑
          </button>
          <button
            className="fm-btn-icon"
            onClick={() => loadDirectory(currentSubPath)}
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {/* Breadcrumb Path Bar */}
        <div className="fm-breadcrumbs">
          {breadcrumbSegments.map((seg, idx) => (
            <React.Fragment key={seg.path || 'root'}>
              {idx > 0 && <span className="fm-crumb-sep">/</span>}
              <span
                className={`fm-crumb ${idx === breadcrumbSegments.length - 1 ? 'fm-crumb-active' : ''}`}
                onClick={() => navigateTo(seg.path)}
              >
                {seg.label}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Search / Filter Input */}
        <div className="fm-search-wrap">
          <span className="fm-search-icon">🔍</span>
          <input
            type="text"
            className="fm-search-input"
            placeholder="Search current folder..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Split: Tree / Quick Navigation & Directory View */}
      <div className="fm-main-split">
        {/* Quick Access Sidebar */}
        <div className="fm-sidebar">
          <div className="fm-sidebar-title">Locations</div>
          <div
            className={`fm-tree-node ${!currentSubPath ? 'active' : ''}`}
            onClick={() => navigateTo('')}
          >
            <span className="fm-tree-icon">⌂</span>
            <span>Root Directory</span>
          </div>

          {projects.length > 0 && (
            <>
              <div className="fm-sidebar-title" style={{ marginTop: '12px' }}>
                Projects
              </div>
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`fm-tree-node ${selectedProjectId === p.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    navigateTo('');
                  }}
                >
                  <span className="fm-tree-icon">◲</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Content Table Area */}
        <div className="fm-content-area">
          {error && (
            <div className="fm-alert fm-alert-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!agentConnected && (
            <div className="fm-alert fm-alert-warning">
              <span>⚠️</span>
              <span>
                Local Sentinel Agent is disconnected. Filesystem operations require an active host agent.
              </span>
            </div>
          )}

          {loading ? (
            <div className="fm-loading-state">
              <span>⚡</span> Loading directory contents...
            </div>
          ) : displayItems.length === 0 ? (
            <div className="fm-empty-state">
              <span className="fm-empty-icon">📂</span>
              <span>This directory is empty</span>
            </div>
          ) : (
            <div className="fm-table-container">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')}>
                      Name {sortField === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => handleSort('type')} style={{ width: '100px' }}>
                      Type {sortField === 'type' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => handleSort('size')} style={{ width: '90px' }}>
                      Size {sortField === 'size' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => handleSort('modifiedAt')} style={{ width: '160px' }}>
                      Modified {sortField === 'modifiedAt' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => {
                    const isSelected = selectedItem?.name === item.name;
                    return (
                      <tr
                        key={item.name}
                        className={`fm-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleItemSelect(item)}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                      >
                        <td>
                          <div className="fm-name-cell">
                            <span className="fm-item-icon">{getFileIcon(item)}</span>
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize' }}>{item.type}</span>
                        </td>
                        <td className="fm-size-cell">{formatBytes(item.size)}</td>
                        <td className="fm-date-cell">
                          {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom File Inspection & Preview Panel */}
          <div className="fm-preview-panel">
            <div className="fm-preview-header">
              <div className="fm-preview-meta">
                <span className="fm-meta-tag">Selected:</span>
                <span className="fm-meta-val">{selectedItem ? selectedItem.name : 'None'}</span>
                {selectedItem && (
                  <>
                    <span className="fm-meta-tag">Size:</span>
                    <span className="fm-meta-val">{formatBytes(selectedItem.size)}</span>
                    <span className="fm-meta-tag">Type:</span>
                    <span className="fm-meta-val">{selectedItem.type}</span>
                  </>
                )}
              </div>
              <div className="fm-meta-tag">Read-Only Preview</div>
            </div>

            <div className="fm-preview-body">
              {previewLoading ? (
                <div className="fm-preview-placeholder">Loading file content...</div>
              ) : previewError ? (
                <div className="fm-alert fm-alert-warning" style={{ margin: 0 }}>
                  <span>ℹ️</span>
                  <span>{previewError}</span>
                </div>
              ) : filePreview ? (
                <pre className="fm-code-preview">{filePreview.content}</pre>
              ) : (
                <div className="fm-preview-placeholder">
                  Select a text or code file to inspect its content preview (up to 2 MB)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="fm-statusbar">
        <div>
          <span>{displayItems.length} items</span>
          {filterQuery && <span> (filtered from {directoryData.items?.length || 0})</span>}
        </div>
        <div>
          <span>Sandboxed Path: {directoryData.currentPath || '/'}</span>
        </div>
      </div>
    </div>
  );
}

