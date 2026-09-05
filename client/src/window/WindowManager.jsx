/**
 * KS Sentinel 2.0 — Window Manager
 * Module 1: Web OS Shell
 *
 * Renders all open (non-minimized) windows from centralized state.
 * Maps registered app components into Window frames.
 */

import React from 'react';
import Window from './Window';
import { useWindows } from './windowStore';
import { getAppById } from '../registry/appRegistry';

export default function WindowManager() {
  const {
    windows,
    activeWindowId,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    resizeWindow,
  } = useWindows();

  const visibleWindows = windows.filter((w) => !w.minimized);

  return (
    <div className="window-manager">
      {visibleWindows.map((win) => {
        const app = getAppById(win.appId);
        const AppComponent = app?.component;
        return (
          <Window
            key={win.instanceId}
            windowData={win}
            isActive={win.instanceId === activeWindowId}
            onClose={() => closeWindow(win.instanceId)}
            onMinimize={() => minimizeWindow(win.instanceId)}
            onMaximize={() => maximizeWindow(win.instanceId)}
            onFocus={() => focusWindow(win.instanceId)}
            onMove={(x, y) => moveWindow(win.instanceId, x, y)}
            onResize={(w, h, x, y) => resizeWindow(win.instanceId, w, h, x, y)}
          >
            {AppComponent ? <AppComponent /> : null}
          </Window>
        );
      })}
    </div>
  );
}
