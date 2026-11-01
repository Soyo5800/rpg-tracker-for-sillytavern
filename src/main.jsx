import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './core/ErrorBoundary';
import './ModalGlobal.css';
import './CommonGlobal.css';

// --- Mobile Touch Drag and Drop Polyfill ---
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";

// Restrict mobile drag polyfill exclusively to designated inventory drag handles
polyfill({
  dragImageCenterOnTouch: true,
  tryFindDraggableTarget: (event) => {
    const rawTarget = event.target;
    if (!rawTarget) return null;

    // Safely resolve DOM element to prevent TypeError when tapping Text nodes
    const element = rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
    if (!element || typeof element.closest !== 'function') return null;

    // Match CSS module hashed class name for drag handle wrapper
    const handle = element.closest('[class*="dragHandleIconWrapper"]');
    if (handle && handle.getAttribute('draggable') === 'true') {
      return handle;
    }

    return null;
  }
});

const rootElement = document.getElementById('my-rpg-react-root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("[RPG Tracker] React root mounting error:", error);
  }
}