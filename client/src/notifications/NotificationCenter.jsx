/**
 * KS Sentinel 2.0 — Notification Center
 * Module 1: Web OS Shell
 *
 * Subscribes to the EventBus and displays recent shell events.
 * Future modules can publish domain events (security, agent, etc.) here.
 */

import React, { useState, useEffect, useRef } from 'react';
import { eventBus } from '../events/eventBus';

const MAX_NOTIFICATIONS = 50;

const EVENT_LABELS = {
  APP_OPENED: 'Application Opened',
  APP_CLOSED: 'Application Closed',
  WINDOW_FOCUSED: 'Window Focused',
  WINDOW_MINIMIZED: 'Window Minimized',
  WINDOW_RESTORED: 'Window Restored',
  WINDOW_MAXIMIZED: 'Window Maximized',
  COMMAND_EXECUTED: 'Command Executed',
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getEventDescription(event) {
  const label = EVENT_LABELS[event.type] || event.type;
  const detail =
    event.payload?.title ||
    event.payload?.appId ||
    event.payload?.command ||
    '';
  return detail ? `${label}: ${detail}` : label;
}

export default function NotificationCenter({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const panelRef = useRef(null);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('*', (event) => {
      setNotifications((prev) => {
        const next = [{ id: `${event.timestamp}_${Math.random()}`, ...event }, ...prev];
        return next.slice(0, MAX_NOTIFICATIONS);
      });
    });
    return unsubscribe;
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="notification-center" ref={panelRef}>
      <div className="notification-header">
        <span>Events</span>
        <button
          className="notification-clear-btn"
          onClick={() => setNotifications([])}
        >
          Clear
        </button>
      </div>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No recent events</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="notification-item">
              <span className="notification-time">{formatTime(n.timestamp)}</span>
              <span className="notification-desc">{getEventDescription(n)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
