/**
 * KS Sentinel 2.0 — Centralized Window State
 * Module 1: Web OS Shell
 *
 * React Context + useReducer for all window lifecycle operations.
 * All window behavior flows through this single store.
 */

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { getAppById } from '../registry/appRegistry';
import { eventBus, EventTypes } from '../events/eventBus';

const WindowContext = createContext(null);

let instanceCounter = 0;
function generateInstanceId() {
  return `win_${++instanceCounter}_${Date.now()}`;
}

const initialState = {
  windows: [],
  nextZIndex: 1,
  activeWindowId: null,
};

function windowReducer(state, action) {
  switch (action.type) {
    case 'OPEN_WINDOW': {
      const { appId } = action.payload;
      const app = getAppById(appId);
      if (!app) return state;

      const instanceId = generateInstanceId();
      const offset = (state.windows.length % 8) * 30;
      const newWindow = {
        instanceId,
        appId: app.id,
        title: app.name,
        icon: app.icon,
        x: 80 + offset,
        y: 60 + offset,
        width: app.defaultWidth,
        height: app.defaultHeight,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
        minimized: false,
        maximized: false,
        zIndex: state.nextZIndex,
        prevBounds: null,
      };
      return {
        ...state,
        windows: [...state.windows, newWindow],
        nextZIndex: state.nextZIndex + 1,
        activeWindowId: instanceId,
      };
    }

    case 'CLOSE_WINDOW': {
      const { instanceId } = action.payload;
      const remaining = state.windows.filter((w) => w.instanceId !== instanceId);
      const visibleRemaining = remaining.filter((w) => !w.minimized);
      return {
        ...state,
        windows: remaining,
        activeWindowId:
          state.activeWindowId === instanceId
            ? visibleRemaining.length > 0
              ? visibleRemaining.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).instanceId
              : null
            : state.activeWindowId,
      };
    }

    case 'FOCUS_WINDOW': {
      const { instanceId } = action.payload;
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.instanceId === instanceId
            ? { ...w, zIndex: state.nextZIndex, minimized: false }
            : w
        ),
        nextZIndex: state.nextZIndex + 1,
        activeWindowId: instanceId,
      };
    }

    case 'MINIMIZE_WINDOW': {
      const { instanceId } = action.payload;
      const visible = state.windows.filter(
        (w) => w.instanceId !== instanceId && !w.minimized
      );
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.instanceId === instanceId ? { ...w, minimized: true } : w
        ),
        activeWindowId:
          state.activeWindowId === instanceId
            ? visible.length > 0
              ? visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).instanceId
              : null
            : state.activeWindowId,
      };
    }

    case 'RESTORE_WINDOW': {
      const { instanceId } = action.payload;
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.instanceId === instanceId
            ? { ...w, minimized: false, zIndex: state.nextZIndex }
            : w
        ),
        nextZIndex: state.nextZIndex + 1,
        activeWindowId: instanceId,
      };
    }

    case 'MAXIMIZE_WINDOW': {
      const { instanceId } = action.payload;
      return {
        ...state,
        windows: state.windows.map((w) => {
          if (w.instanceId !== instanceId) return w;
          if (w.maximized) {
            // Restore from maximized state
            return {
              ...w,
              maximized: false,
              x: w.prevBounds?.x ?? w.x,
              y: w.prevBounds?.y ?? w.y,
              width: w.prevBounds?.width ?? w.width,
              height: w.prevBounds?.height ?? w.height,
              prevBounds: null,
              zIndex: state.nextZIndex,
            };
          }
          // Maximize — save current bounds
          return {
            ...w,
            maximized: true,
            prevBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
            zIndex: state.nextZIndex,
          };
        }),
        nextZIndex: state.nextZIndex + 1,
        activeWindowId: instanceId,
      };
    }

    case 'MOVE_WINDOW': {
      const { instanceId, x, y } = action.payload;
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.instanceId === instanceId
            ? { ...w, x, y, maximized: false, prevBounds: null }
            : w
        ),
      };
    }

    case 'RESIZE_WINDOW': {
      const { instanceId, width, height, x, y } = action.payload;
      return {
        ...state,
        windows: state.windows.map((w) => {
          if (w.instanceId !== instanceId) return w;
          return {
            ...w,
            width: Math.max(width, w.minWidth),
            height: Math.max(height, w.minHeight),
            ...(x !== undefined && { x }),
            ...(y !== undefined && { y }),
            maximized: false,
            prevBounds: null,
          };
        }),
      };
    }

    default:
      return state;
  }
}

export function WindowProvider({ children }) {
  const [state, dispatch] = useReducer(windowReducer, initialState);

  return (
    <WindowContext.Provider value={{ state, dispatch }}>
      {children}
    </WindowContext.Provider>
  );
}

/**
 * Hook providing centralized window state and action dispatchers.
 * All window operations publish events to the shell EventBus.
 */
export function useWindows() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindows must be used within a WindowProvider');
  }

  const { state, dispatch } = context;
  const stateRef = useRef(state);
  stateRef.current = state;

  const openApp = useCallback(
    (appId) => {
      const existing = stateRef.current.windows.find((w) => w.appId === appId);
      if (existing) {
        if (existing.minimized) {
          dispatch({ type: 'RESTORE_WINDOW', payload: { instanceId: existing.instanceId } });
          eventBus.publish(EventTypes.WINDOW_RESTORED, { instanceId: existing.instanceId, appId });
        } else {
          dispatch({ type: 'FOCUS_WINDOW', payload: { instanceId: existing.instanceId } });
          eventBus.publish(EventTypes.WINDOW_FOCUSED, { instanceId: existing.instanceId, appId });
        }
        return;
      }
      dispatch({ type: 'OPEN_WINDOW', payload: { appId } });
      eventBus.publish(EventTypes.APP_OPENED, { appId });
    },
    [dispatch]
  );

  const closeWindow = useCallback(
    (instanceId) => {
      const win = stateRef.current.windows.find((w) => w.instanceId === instanceId);
      dispatch({ type: 'CLOSE_WINDOW', payload: { instanceId } });
      if (win) {
        eventBus.publish(EventTypes.APP_CLOSED, { instanceId, appId: win.appId, title: win.title });
      }
    },
    [dispatch]
  );

  const focusWindow = useCallback(
    (instanceId) => {
      dispatch({ type: 'FOCUS_WINDOW', payload: { instanceId } });
      eventBus.publish(EventTypes.WINDOW_FOCUSED, { instanceId });
    },
    [dispatch]
  );

  const minimizeWindow = useCallback(
    (instanceId) => {
      dispatch({ type: 'MINIMIZE_WINDOW', payload: { instanceId } });
      eventBus.publish(EventTypes.WINDOW_MINIMIZED, { instanceId });
    },
    [dispatch]
  );

  const restoreWindow = useCallback(
    (instanceId) => {
      dispatch({ type: 'RESTORE_WINDOW', payload: { instanceId } });
      eventBus.publish(EventTypes.WINDOW_RESTORED, { instanceId });
    },
    [dispatch]
  );

  const maximizeWindow = useCallback(
    (instanceId) => {
      dispatch({ type: 'MAXIMIZE_WINDOW', payload: { instanceId } });
      eventBus.publish(EventTypes.WINDOW_MAXIMIZED, { instanceId });
    },
    [dispatch]
  );

  const moveWindow = useCallback(
    (instanceId, x, y) => {
      dispatch({ type: 'MOVE_WINDOW', payload: { instanceId, x, y } });
    },
    [dispatch]
  );

  const resizeWindow = useCallback(
    (instanceId, width, height, x, y) => {
      dispatch({ type: 'RESIZE_WINDOW', payload: { instanceId, width, height, x, y } });
    },
    [dispatch]
  );

  return {
    windows: state.windows,
    activeWindowId: state.activeWindowId,
    openApp,
    closeWindow,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    moveWindow,
    resizeWindow,
  };
}
