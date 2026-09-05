/**
 * KS Sentinel 2.0 — Dock / Launcher
 * Module 1: Web OS Shell
 *
 * App launcher reading from the centralized Application Registry.
 * Shows open-app indicators and handles minimized-window restoration.
 */

import React from 'react';
import { appRegistry } from '../registry/appRegistry';
import { useWindows } from '../window/windowStore';

export default function Dock() {
  const { windows, activeWindowId, openApp, minimizeWindow, restoreWindow, focusWindow } = useWindows();

  const handleDockClick = (appId) => {
    const existing = windows.find((w) => w.appId === appId);
    if (!existing) {
      // App not open → launch
      openApp(appId);
    } else if (existing.minimized) {
      // App minimized → restore
      restoreWindow(existing.instanceId);
    } else if (existing.instanceId === activeWindowId) {
      // App focused → minimize
      minimizeWindow(existing.instanceId);
    } else {
      // App open but not focused → focus
      focusWindow(existing.instanceId);
    }
  };

  return (
    <div className="dock">
      <div className="dock-apps">
        {appRegistry.map((app) => {
          const win = windows.find((w) => w.appId === app.id);
          const isOpen = !!win;
          const isActive = win?.instanceId === activeWindowId;
          const isMinimized = win?.minimized;

          return (
            <button
              key={app.id}
              className={`dock-item ${isActive ? 'dock-item-active' : ''} ${isMinimized ? 'dock-item-minimized' : ''}`}
              onClick={() => handleDockClick(app.id)}
              title={app.name}
            >
              <span className="dock-icon">{app.icon}</span>
              <span className="dock-label">{app.name}</span>
              {isOpen && <span className="dock-indicator" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
