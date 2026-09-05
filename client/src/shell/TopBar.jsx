/**
 * KS Sentinel 2.0 — TopBar
 * Module 1: Web OS Shell
 *
 * System bar with identity, status placeholders, clock, and notification bell.
 */

import React, { useState, useEffect, useCallback } from 'react';
import NotificationCenter from '../notifications/NotificationCenter';
import { useWindows } from '../window/windowStore';
import { eventBus } from '../events/eventBus';

export default function TopBar({ onToggleCommandBar }) {
  const { openApp } = useWindows();
  const [time, setTime] = useState(new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  const fetchActiveWorkspace = useCallback(() => {
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
  }, []);

  useEffect(() => {
    fetchActiveWorkspace();
    const unsub = eventBus.subscribe('*', (evt) => {
      if (evt.type && evt.type.startsWith('WORKSPACE_')) {
        fetchActiveWorkspace();
      }
    });
    return unsub;
  }, [fetchActiveWorkspace]);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleNotifications = useCallback((e) => {
    e.stopPropagation();
    setNotificationsOpen((prev) => !prev);
  }, []);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  const formattedTime = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = time.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="topbar">
      {/* Left: Identity */}
      <div className="topbar-left">
        <span className="topbar-logo">⬡</span>
        <span className="topbar-title">KS SENTINEL</span>
        <span className="topbar-version">2.0</span>
      </div>

      {/* Center: System Status & Active Workspace */}
      <div className="topbar-center" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="topbar-status-dot" />
          <span className="topbar-status-text">SYSTEM READY</span>
        </div>

        <button
          onClick={() => openApp('workspace-manager')}
          style={{
            background: 'rgba(0, 229, 255, 0.08)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            borderRadius: '12px',
            color: 'var(--accent-cyan)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            padding: '2px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
          title="Click to open Workspace Manager"
        >
          <span>⧉</span>
          <span>{activeWorkspace ? activeWorkspace.name : 'No Workspace Active'}</span>
          <span style={{ color: activeWorkspace ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: '8px' }}>
            {activeWorkspace ? '● ACTIVE' : '○'}
          </span>
        </button>
      </div>

      {/* Right: Clock, Notifications, Placeholders */}
      <div className="topbar-right">
        <button
          className="topbar-btn"
          onClick={onToggleCommandBar}
          title="Command Bar (Ctrl+K)"
        >
          ⌘
        </button>

        <div className="topbar-datetime">
          <span className="topbar-time">{formattedTime}</span>
          <span className="topbar-date">{formattedDate}</span>
        </div>

        <div className="topbar-notification-wrapper">
          <button
            className="topbar-btn topbar-bell"
            onClick={toggleNotifications}
            title="Notifications"
          >
            ◆
          </button>
          <NotificationCenter
            isOpen={notificationsOpen}
            onClose={closeNotifications}
          />
        </div>

        <button className="topbar-btn topbar-user" title="User (placeholder)">
          ◉
        </button>
      </div>
    </div>
  );
}
