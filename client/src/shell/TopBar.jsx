/**
 * KS Sentinel 2.0 — TopBar
 * Module 1: Web OS Shell
 *
 * System bar with identity, status placeholders, clock, and notification bell.
 */

import React, { useState, useEffect, useCallback } from 'react';
import NotificationCenter from '../notifications/NotificationCenter';

export default function TopBar({ onToggleCommandBar }) {
  const [time, setTime] = useState(new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

      {/* Center: System Status */}
      <div className="topbar-center">
        <span className="topbar-status-dot" />
        <span className="topbar-status-text">MODULE 1 ACTIVE</span>
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
