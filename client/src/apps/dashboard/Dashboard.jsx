/**
 * KS Sentinel 2.0 — Dashboard Application
 * Module 2: Dashboard
 * Module 4: Remote Machine Information
 *
 * Operational overview, architecture readiness, and read-only host machine telemetry.
 * Runs as a registered Web OS application inside the Window Manager.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWindows } from '../../window/windowStore';
import { appRegistry } from '../../registry/appRegistry';
import { eventBus, EventTypes } from '../../events/eventBus';
import './dashboard.css';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = Number(bytes);
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export default function Dashboard() {
  const { windows, activeWindowId, openApp, focusWindow } = useWindows();
  const [gatewayStatus, setGatewayStatus] = useState('checking');
  const [agentStatus, setAgentStatus] = useState({ connected: false, state: 'CHECKING', agent: null });
  const [machineInfo, setMachineInfo] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [events, setEvents] = useState([]);

  // Check Gateway Health, Agent Status, Machine Telemetry, Active Workspace & Project
  const checkGatewayHealth = useCallback(() => {
    setGatewayStatus('checking');

    // 1. Gateway Health
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setGatewayStatus(data.status === 'ok' ? 'online' : 'unhealthy');
        setLastChecked(new Date().toLocaleTimeString());
      })
      .catch(() => {
        setGatewayStatus('offline');
        setLastChecked(new Date().toLocaleTimeString());
      });

    // 2. Agent Connection Status (Module 3)
    fetch('/api/agent/status')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAgentStatus(data);
      })
      .catch(() => {
        setAgentStatus({ connected: false, state: 'OFFLINE', agent: null });
      });

    // 3. Remote Machine Telemetry (Module 4)
    fetch('/api/machine/info')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setMachineInfo(data);
      })
      .catch(() => {
        setMachineInfo({ available: false, state: 'OFFLINE', message: 'Gateway communication error.' });
      });

    // 4. Active Workspace (Module 5)
    fetch('/api/workspaces/active')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active && data.workspace) {
          setActiveWorkspace(data.workspace);
        } else {
          setActiveWorkspace(null);
        }
      })
      .catch(() => setActiveWorkspace(null));

    // 5. Active Project (Module 6)
    fetch('/api/projects/active')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active && data.project) {
          setActiveProject(data.project);
        } else {
          setActiveProject(null);
        }
      })
      .catch(() => setActiveProject(null));
  }, []);

  useEffect(() => {
    checkGatewayHealth();
    // Periodically refresh agent & machine status every 5 seconds
    const timer = setInterval(checkGatewayHealth, 5000);
    return () => clearInterval(timer);
  }, [checkGatewayHealth]);

  // Subscribe to Shell EventBus
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('*', (e) => {
      setEvents((prev) => [e, ...prev.slice(0, 19)]);
    });
    return unsubscribe;
  }, []);

  // Compute workspace metrics
  const totalWindows = windows.length;
  const minimizedWindows = windows.filter((w) => w.minimized).length;
  const activeWindow = windows.find((w) => w.instanceId === activeWindowId);

  return (
    <div className="dashboard-container">
      {/* 1. Operational Status Header */}
      <div className="dashboard-header-banner">
        <div className="dashboard-title-group">
          <div className="dashboard-title-row">
            <span className="dashboard-app-title">OPERATIONAL CONTROL CONSOLE</span>
            <span className={`dashboard-badge dashboard-badge-${gatewayStatus}`}>
              GATEWAY: {gatewayStatus.toUpperCase()}
            </span>
          </div>
          <span className="dashboard-subtitle">
            KS Sentinel Virtual Operating Environment • Baseline: Module 6
          </span>
        </div>
        <div className="dashboard-header-actions">
          {lastChecked && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Checked: {lastChecked}
            </span>
          )}
          <button className="dashboard-refresh-btn" onClick={checkGatewayHealth}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="dashboard-metrics-grid">
        <div className="dashboard-metric-card">
          <span className="dashboard-metric-label">Web OS Shell</span>
          <span className="dashboard-metric-value" style={{ color: 'var(--accent-green)' }}>
            ONLINE
          </span>
          <span className="dashboard-metric-detail">Active Session</span>
        </div>

        <div className="dashboard-metric-card">
          <span className="dashboard-metric-label">Open Windows</span>
          <span className="dashboard-metric-value" style={{ color: 'var(--accent-cyan)' }}>
            {totalWindows}
          </span>
          <span className="dashboard-metric-detail">
            {minimizedWindows} Minimized
          </span>
        </div>

        <div className="dashboard-metric-card">
          <span className="dashboard-metric-label">Focused App</span>
          <span
            className="dashboard-metric-value"
            style={{
              fontSize: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: activeWindow ? 'var(--accent-purple)' : 'var(--text-muted)'
            }}
          >
            {activeWindow ? activeWindow.title : 'None'}
          </span>
          <span className="dashboard-metric-detail">Active Window</span>
        </div>

        <div className="dashboard-metric-card">
          <span className="dashboard-metric-label">Local Agent</span>
          <span
            className="dashboard-metric-value"
            style={{
              color: agentStatus.connected
                ? 'var(--accent-green)'
                : agentStatus.state === 'OFFLINE'
                ? 'var(--accent-red)'
                : 'var(--text-muted)',
              fontSize: '13px'
            }}
          >
            {agentStatus.state}
          </span>
          <span className="dashboard-metric-detail">
            {agentStatus.agent
              ? `${agentStatus.agent.agentId} (v${agentStatus.agent.agentVersion})`
              : 'Host Telemetry Offline'}
          </span>
        </div>

        <div
          className="dashboard-metric-card"
          onClick={() => openApp('workspace-manager')}
          style={{ cursor: 'pointer' }}
          title="Click to open Workspace Manager"
        >
          <span className="dashboard-metric-label">Active Workspace</span>
          <span
            className="dashboard-metric-value"
            style={{
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: activeWorkspace ? 'var(--accent-cyan)' : 'var(--text-muted)'
            }}
          >
            {activeWorkspace ? activeWorkspace.name : 'None'}
          </span>
          <span className="dashboard-metric-detail">
            {activeWorkspace
              ? activeWorkspace.rootPath
                ? `Bound: ${activeWorkspace.rootPath.split('\\').pop() || activeWorkspace.rootPath}`
                : 'Unbound Root'
              : 'Click to Select'}
          </span>
        </div>

        <div
          className="dashboard-metric-card"
          onClick={() => openApp('project-manager')}
          style={{ cursor: 'pointer' }}
          title="Click to open Project Manager"
        >
          <span className="dashboard-metric-label">Active Project</span>
          <span
            className="dashboard-metric-value"
            style={{
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: activeProject ? 'var(--accent-purple)' : 'var(--text-muted)'
            }}
          >
            {activeProject ? activeProject.name : 'None'}
          </span>
          <span className="dashboard-metric-detail">
            {activeProject
              ? activeProject.rootPath
                ? `Sub-path: ${activeProject.rootPath.split('\\').pop() || activeProject.rootPath}`
                : 'Unbound Sub-path'
              : 'Click to Select'}
          </span>
        </div>
      </div>

      {/* 3. Remote Machine Telemetry (Module 4: Read-Only) */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <span className="dashboard-section-title">
            <span>▤</span> Remote Machine Telemetry
          </span>
          <span className="dashboard-section-badge">
            {machineInfo?.available ? 'Live Host Telemetry (Read-Only)' : 'Telemetry Unavailable'}
          </span>
        </div>

        {machineInfo?.available ? (
          <div className="telemetry-grid">
            {/* Host Identity Card */}
            <div className="telemetry-card">
              <div className="telemetry-card-title">
                <span>HOST SYSTEM</span>
                <span className="telemetry-card-badge">{machineInfo.machine?.platform} ({machineInfo.machine?.architecture})</span>
              </div>
              <div className="telemetry-item-row">
                <span>Device</span>
                <span className="telemetry-item-value">{machineInfo.machine?.hostname}</span>
              </div>
              <div className="telemetry-item-row">
                <span>OS</span>
                <span className="telemetry-item-value">{machineInfo.machine?.osRelease || machineInfo.machine?.osType}</span>
              </div>
              <div className="telemetry-item-row">
                <span>Uptime</span>
                <span className="telemetry-item-value">{formatUptime(machineInfo.machine?.uptimeSeconds)}</span>
              </div>
            </div>

            {/* CPU Card */}
            <div className="telemetry-card">
              <div className="telemetry-card-title">
                <span>PROCESSOR (CPU)</span>
                <span className="telemetry-card-badge">{machineInfo.cpu?.cores} Cores</span>
              </div>
              <div className="telemetry-item-row">
                <span>Model</span>
                <span className="telemetry-item-value" style={{ fontSize: '9px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {machineInfo.cpu?.model}
                </span>
              </div>
              <div className="telemetry-item-row">
                <span>Speed</span>
                <span className="telemetry-item-value">{machineInfo.cpu?.speedMHz} MHz</span>
              </div>
            </div>

            {/* Memory Card */}
            <div className="telemetry-card">
              <div className="telemetry-card-title">
                <span>SYSTEM MEMORY</span>
                <span className="telemetry-card-badge">{machineInfo.memory?.usagePercent}%</span>
              </div>
              <div className="telemetry-bar-track">
                <div
                  className="telemetry-bar-fill telemetry-bar-cyan"
                  style={{ width: `${Math.min(100, Math.max(0, machineInfo.memory?.usagePercent || 0))}%` }}
                />
              </div>
              <div className="telemetry-item-row">
                <span>Used / Total</span>
                <span className="telemetry-item-value">
                  {formatBytes(machineInfo.memory?.usedBytes)} / {formatBytes(machineInfo.memory?.totalBytes)}
                </span>
              </div>
            </div>

            {/* Storage Card */}
            {machineInfo.storage ? (
              <div className="telemetry-card">
                <div className="telemetry-card-title">
                  <span>STORAGE ({machineInfo.storage.mount})</span>
                  <span className="telemetry-card-badge">{machineInfo.storage.usagePercent}%</span>
                </div>
                <div className="telemetry-bar-track">
                  <div
                    className="telemetry-bar-fill telemetry-bar-green"
                    style={{ width: `${Math.min(100, Math.max(0, machineInfo.storage.usagePercent || 0))}%` }}
                  />
                </div>
                <div className="telemetry-item-row">
                  <span>Free Space</span>
                  <span className="telemetry-item-value">
                    {formatBytes(machineInfo.storage.freeBytes)} / {formatBytes(machineInfo.storage.totalBytes)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="telemetry-unavailable-banner">
            <span className="telemetry-unavailable-icon">⚠</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                Machine Telemetry Unavailable
              </strong>
              <span>
                {machineInfo?.message || 'Local Sentinel Agent is not connected. Host machine information is offline.'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. System Readiness Architecture Grid */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <span className="dashboard-section-title">
            <span>◈</span> System Readiness & Architecture Pipeline
          </span>
          <span className="dashboard-section-badge">Security Boundary Enforced</span>
        </div>

        <div className="readiness-grid">
          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Web OS Shell</span>
              <span className="readiness-role">Desktop & Window Manager</span>
            </div>
            <span className="dashboard-badge dashboard-badge-online">ONLINE</span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Secure Gateway</span>
              <span className="readiness-role">Express Node.js Proxy</span>
            </div>
            <span className={`dashboard-badge dashboard-badge-${gatewayStatus}`}>
              {gatewayStatus.toUpperCase()}
            </span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Local Sentinel Agent</span>
              <span className="readiness-role">
                {agentStatus.agent
                  ? `${agentStatus.agent.platform} (${agentStatus.agent.arch})`
                  : 'Windows Host Service (Mod 3)'}
              </span>
            </div>
            <span
              className={`dashboard-badge dashboard-badge-${
                agentStatus.connected
                  ? 'online'
                  : agentStatus.state === 'OFFLINE'
                  ? 'offline'
                  : 'pending'
              }`}
            >
              {agentStatus.state}
            </span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Sentinel Workspace</span>
              <span className="readiness-role">Logical Root Binding (Mod 5)</span>
            </div>
            <span
              className={`dashboard-badge dashboard-badge-${
                activeWorkspace ? 'online' : 'pending'
              }`}
            >
              {activeWorkspace ? 'ONLINE' : 'PENDING'}
            </span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Sentinel Projects</span>
              <span className="readiness-role">Logical Work Unit (Mod 6)</span>
            </div>
            <span
              className={`dashboard-badge dashboard-badge-${
                activeProject ? 'online' : 'pending'
              }`}
            >
              {activeProject ? 'ONLINE' : 'PENDING'}
            </span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Trust & Policy Engine</span>
              <span className="readiness-role">Access Authorization (Mod 21)</span>
            </div>
            <span className="dashboard-badge dashboard-badge-pending">PENDING</span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Execution Broker</span>
              <span className="readiness-role">Capability Gatekeeper (Mod 22)</span>
            </div>
            <span className="dashboard-badge dashboard-badge-pending">NOT ACTIVE</span>
          </div>

          <div className="readiness-item">
            <div className="readiness-item-info">
              <span className="readiness-name">Authentication & Sessions</span>
              <span className="readiness-role">Session Governance (Mod 26)</span>
            </div>
            <span className="dashboard-badge dashboard-badge-pending">PENDING</span>
          </div>
        </div>
      </div>

      {/* 5. Quick Application Access */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <span className="dashboard-section-title">
            <span>⌂</span> Quick Application Launch
          </span>
          <span className="dashboard-section-badge">Central Registry</span>
        </div>

        <div className="quick-launch-grid">
          {appRegistry.map((app) => {
            const openInstance = windows.find((w) => w.appId === app.id);
            const isOpen = Boolean(openInstance);
            const isActive = openInstance?.instanceId === activeWindowId;

            return (
              <div
                key={app.id}
                className="quick-launch-card"
                onClick={() => {
                  if (openInstance) {
                    focusWindow(openInstance.instanceId);
                  } else {
                    openApp(app.id);
                  }
                }}
              >
                <span className="quick-launch-icon">{app.icon}</span>
                <div className="quick-launch-details">
                  <span className="quick-launch-name">{app.name}</span>
                  <span className="quick-launch-status">
                    {isActive
                      ? 'Active Window'
                      : isOpen
                      ? openInstance.minimized
                        ? 'Minimized'
                        : 'Open in Background'
                      : 'Click to Launch'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Shell Activity Stream */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <span className="dashboard-section-title">
            <span>⚡</span> Shell Activity Stream
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="dashboard-section-badge">Live EventBus</span>
            {events.length > 0 && (
              <button
                className="notification-clear-btn"
                style={{ padding: '1px 6px', fontSize: '9px' }}
                onClick={() => setEvents([])}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="activity-stream">
          {events.length === 0 ? (
            <div className="activity-empty">No shell activity logged yet.</div>
          ) : (
            events.map((evt, idx) => {
              let rowClass = 'activity-row';
              if (
                evt.type === EventTypes.APP_OPENED ||
                evt.type === EventTypes.WORKSPACE_CREATED ||
                evt.type === EventTypes.WORKSPACE_SWITCHED ||
                evt.type === EventTypes.PROJECT_CREATED ||
                evt.type === EventTypes.PROJECT_OPENED ||
                evt.type === EventTypes.PROJECT_SWITCHED
              ) rowClass += ' activity-row-opened';
              else if (
                evt.type === EventTypes.APP_CLOSED ||
                evt.type === EventTypes.WORKSPACE_CLOSED ||
                evt.type === EventTypes.WORKSPACE_DELETED ||
                evt.type === EventTypes.PROJECT_CLOSED ||
                evt.type === EventTypes.PROJECT_DELETED
              ) rowClass += ' activity-row-closed';
              else if (evt.type === EventTypes.WINDOW_FOCUSED) rowClass += ' activity-row-focused';
              else if (evt.type === EventTypes.WINDOW_MINIMIZED) rowClass += ' activity-row-minimized';

              const detail =
                evt.payload?.name ||
                evt.payload?.title ||
                evt.payload?.appId ||
                evt.payload?.command ||
                '';

              return (
                <div key={idx} className={rowClass}>
                  <span className="activity-event-desc">
                    <strong>{evt.type}</strong> {detail && `— ${detail}`}
                  </span>
                  <span className="activity-time">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
