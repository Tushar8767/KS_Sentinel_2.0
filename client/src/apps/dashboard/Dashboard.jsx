/**
 * KS Sentinel 2.0 — Dashboard Application
 * Module 2: Dashboard
 *
 * Operational overview and control console for KS Sentinel.
 * Runs as a registered Web OS application inside the Window Manager.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWindows } from '../../window/windowStore';
import { appRegistry } from '../../registry/appRegistry';
import { eventBus, EventTypes } from '../../events/eventBus';
import './dashboard.css';

export default function Dashboard() {
  const { windows, activeWindowId, openApp, focusWindow } = useWindows();
  const [gatewayStatus, setGatewayStatus] = useState('checking');
  const [lastChecked, setLastChecked] = useState(null);
  const [events, setEvents] = useState([]);

  // Check Gateway Health Endpoint
  const checkGatewayHealth = useCallback(() => {
    setGatewayStatus('checking');
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
  }, []);

  useEffect(() => {
    checkGatewayHealth();
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
            KS Sentinel Virtual Operating Environment • Baseline: Module 2
          </span>
        </div>
        <div className="dashboard-header-actions">
          {lastChecked && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Checked: {lastChecked}
            </span>
          )}
          <button className="dashboard-refresh-btn" onClick={checkGatewayHealth}>
            ↻ Check Gateway
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
          <span className="dashboard-metric-value" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Awaiting Mod 3
          </span>
          <span className="dashboard-metric-detail">Host Telemetry Offline</span>
        </div>
      </div>

      {/* 3. System Readiness Architecture Grid */}
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
              <span className="readiness-role">Windows Host Service (Mod 3)</span>
            </div>
            <span className="dashboard-badge dashboard-badge-pending">NOT CONNECTED</span>
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

        <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
          * Architecture Note: Host machine metrics (CPU, Memory, Git, Filesystem) remain unavailable until the Local Sentinel Agent (Module 3) is connected.
          Arbitrary command execution is strictly prohibited.
        </p>
      </div>

      {/* 4. Quick Application Access */}
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

      {/* 5. Shell Activity Stream */}
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
              if (evt.type === EventTypes.APP_OPENED) rowClass += ' activity-row-opened';
              else if (evt.type === EventTypes.APP_CLOSED) rowClass += ' activity-row-closed';
              else if (evt.type === EventTypes.WINDOW_FOCUSED) rowClass += ' activity-row-focused';
              else if (evt.type === EventTypes.WINDOW_MINIMIZED) rowClass += ' activity-row-minimized';

              const detail =
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

