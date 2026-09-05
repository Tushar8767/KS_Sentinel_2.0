/**
 * KS Sentinel 2.0 — Reusable Window Component
 * Module 1: Web OS Shell
 *
 * OS-level window frame with title bar, controls, drag, and resize.
 * Window behavior is delegated to the centralized Window Store.
 */

import React, { useRef, useCallback } from 'react';

const RESIZE_HANDLES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

const TOPBAR_HEIGHT = 40;
const DOCK_HEIGHT = 58;

export default function Window({
  windowData,
  isActive,
  children,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onMove,
  onResize,
}) {
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  // --- Drag (title bar) ---
  const handleDragPointerDown = useCallback(
    (e) => {
      if (e.target.closest('.window-control-btn')) return;
      if (windowData.maximized) return;
      e.preventDefault();
      onFocus();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWinX: windowData.x,
        startWinY: windowData.y,
      };
    },
    [windowData.x, windowData.y, windowData.maximized, onFocus]
  );

  const handleDragPointerMove = useCallback(
    (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      let newX = dragRef.current.startWinX + dx;
      let newY = dragRef.current.startWinY + dy;

      // Clamp: keep title bar within viewport bounds
      newY = Math.max(TOPBAR_HEIGHT, newY);
      newY = Math.min(window.innerHeight - DOCK_HEIGHT - 36, newY);
      newX = Math.max(-windowData.width + 120, newX);
      newX = Math.min(window.innerWidth - 120, newX);

      onMove(newX, newY);
    },
    [windowData.width, onMove]
  );

  const handleDragPointerUp = useCallback((e) => {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  }, []);

  // --- Resize (edge/corner handles) ---
  const handleResizePointerDown = useCallback(
    (e, direction) => {
      if (windowData.maximized) return;
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        direction,
        startX: e.clientX,
        startY: e.clientY,
        startWinX: windowData.x,
        startWinY: windowData.y,
        startWidth: windowData.width,
        startHeight: windowData.height,
      };
    },
    [windowData.x, windowData.y, windowData.width, windowData.height, windowData.maximized, onFocus]
  );

  const handleResizePointerMove = useCallback(
    (e) => {
      if (!resizeRef.current) return;
      const {
        direction, startX, startY,
        startWinX, startWinY, startWidth, startHeight,
      } = resizeRef.current;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = startWinX;
      let newY = startWinY;
      let newW = startWidth;
      let newH = startHeight;

      if (direction.includes('e')) newW = startWidth + dx;
      if (direction.includes('w')) { newW = startWidth - dx; newX = startWinX + dx; }
      if (direction.includes('s')) newH = startHeight + dy;
      if (direction.includes('n')) { newH = startHeight - dy; newY = startWinY + dy; }

      // Enforce minimums
      if (newW < windowData.minWidth) {
        if (direction.includes('w')) newX = startWinX + startWidth - windowData.minWidth;
        newW = windowData.minWidth;
      }
      if (newH < windowData.minHeight) {
        if (direction.includes('n')) newY = startWinY + startHeight - windowData.minHeight;
        newH = windowData.minHeight;
      }

      onResize(newW, newH, newX, newY);
    },
    [windowData.minWidth, windowData.minHeight, onResize]
  );

  const handleResizePointerUp = useCallback((e) => {
    resizeRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  }, []);

  // --- Compute styles ---
  const desktopH = window.innerHeight - TOPBAR_HEIGHT - DOCK_HEIGHT;
  const style = windowData.maximized
    ? {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: `${desktopH}px`,
        zIndex: windowData.zIndex,
      }
    : {
        position: 'absolute',
        left: `${windowData.x}px`,
        top: `${windowData.y - TOPBAR_HEIGHT}px`,
        width: `${windowData.width}px`,
        height: `${windowData.height}px`,
        zIndex: windowData.zIndex,
      };

  return (
    <div
      className={`sentinel-window ${isActive ? 'window-focused' : 'window-unfocused'}`}
      style={style}
      onPointerDown={onFocus}
    >
      {/* Title Bar */}
      <div
        className="window-titlebar"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
      >
        <span className="window-icon">{windowData.icon}</span>
        <span className="window-title">{windowData.title}</span>
        <div className="window-controls">
          <button
            className="window-control-btn window-control-minimize"
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            title="Minimize"
          >
            ─
          </button>
          <button
            className="window-control-btn window-control-maximize"
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            title={windowData.maximized ? 'Restore' : 'Maximize'}
          >
            {windowData.maximized ? '❐' : '□'}
          </button>
          <button
            className="window-control-btn window-control-close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="window-content">
        {children}
      </div>

      {/* Resize Handles (hidden when maximized) */}
      {!windowData.maximized &&
        RESIZE_HANDLES.map((dir) => (
          <div
            key={dir}
            className={`window-resize-handle window-resize-${dir}`}
            onPointerDown={(e) => handleResizePointerDown(e, dir)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
        ))}
    </div>
  );
}
