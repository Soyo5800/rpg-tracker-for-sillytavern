import React, { useState, useEffect, useRef } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './TrackerPanelToggle.module.css';
import { BrandIcon, LockIcon, MoveArrowsIcon, ResetArrowIcon } from '../Icons';

export default function TrackerPanelToggle() {
  const { settings, updateSettings } = useRPG();
  const [isDragMode, setIsDragMode] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const menuRef = useRef(null);
  const wrapperRef = useRef(null);
  const dragInfoRef = useRef({ isDragging: false, hasMoved: false, nextPos: null });

  const position = settings.togglePosition;
  const isPanelOpen = settings.isPanelOpen || false;

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowContextMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Remove residual inline style properties when position is reset or cleared
  useEffect(() => {
    if (!position && wrapperRef.current) {
      wrapperRef.current.style.removeProperty('left');
      wrapperRef.current.style.removeProperty('top');
      if (styles.userPositioned) {
        wrapperRef.current.classList.remove(styles.userPositioned);
      }
    }
  }, [position]);

  if (isPanelOpen) {
    return null;
  }

  const handleLeftClick = () => {
    if (isDragMode || dragInfoRef.current.hasMoved) return;
    updateSettings({ isPanelOpen: true });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setShowContextMenu(true);
  };

  const clampPosition = (x, y, element) => {
    const width = element ? element.offsetWidth : 38;
    const height = element ? element.offsetHeight : 38;
    const maxX = Math.max(0, window.innerWidth - width);
    const maxY = Math.max(0, window.innerHeight - height);

    return {
      x: Math.min(maxX, Math.max(0, x)),
      y: Math.min(maxY, Math.max(0, y))
    };
  };

  const startDrag = (e) => {
    if (!isDragMode || e.button !== 0) return;
    e.preventDefault();

    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = wrapperEl.getBoundingClientRect();
    const initX = position ? position.x : rect.left;
    const initY = position ? position.y : rect.top;

    dragInfoRef.current = { isDragging: true, hasMoved: false, nextPos: null };

    if (styles.userPositioned) {
      wrapperEl.classList.add(styles.userPositioned);
    }

    const onMouseMove = (moveEvent) => {
      if (!dragInfoRef.current.isDragging) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragInfoRef.current.hasMoved = true;
      }

      const clamped = clampPosition(initX + deltaX, initY + deltaY, wrapperEl);
      dragInfoRef.current.nextPos = clamped;

      wrapperEl.style.setProperty('left', `${clamped.x}px`, 'important');
      wrapperEl.style.setProperty('top', `${clamped.y}px`, 'important');
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (dragInfoRef.current.isDragging && dragInfoRef.current.nextPos) {
        updateSettings({ togglePosition: dragInfoRef.current.nextPos });
      }

      setTimeout(() => {
        dragInfoRef.current.isDragging = false;
        dragInfoRef.current.hasMoved = false;
        dragInfoRef.current.nextPos = null;
      }, 60);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startTouchDrag = (e) => {
    if (!isDragMode) return;

    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const rect = wrapperEl.getBoundingClientRect();
    const initX = position ? position.x : rect.left;
    const initY = position ? position.y : rect.top;

    dragInfoRef.current = { isDragging: true, hasMoved: false, nextPos: null };

    if (styles.userPositioned) {
      wrapperEl.classList.add(styles.userPositioned);
    }

    const onTouchMove = (moveEvent) => {
      if (!dragInfoRef.current.isDragging) return;
      const currentTouch = moveEvent.touches[0];
      const deltaX = currentTouch.clientX - startX;
      const deltaY = currentTouch.clientY - startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragInfoRef.current.hasMoved = true;
      }

      const clamped = clampPosition(initX + deltaX, initY + deltaY, wrapperEl);
      dragInfoRef.current.nextPos = clamped;

      wrapperEl.style.setProperty('left', `${clamped.x}px`, 'important');
      wrapperEl.style.setProperty('top', `${clamped.y}px`, 'important');
    };

    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);

      if (dragInfoRef.current.isDragging && dragInfoRef.current.nextPos) {
        updateSettings({ togglePosition: dragInfoRef.current.nextPos });
      }

      setTimeout(() => {
        dragInfoRef.current.isDragging = false;
        dragInfoRef.current.hasMoved = false;
        dragInfoRef.current.nextPos = null;
      }, 60);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  };

  const resetToDefault = () => {
    if (wrapperRef.current) {
      wrapperRef.current.style.removeProperty('left');
      wrapperRef.current.style.removeProperty('top');
      if (styles.userPositioned) {
        wrapperRef.current.classList.remove(styles.userPositioned);
      }
    }
    updateSettings({ togglePosition: null });
    setIsDragMode(false);
    setShowContextMenu(false);
  };

  const dynamicInlineStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px` }
    : {};

  return (
    <div
      ref={wrapperRef}
      className={`${styles.toggleWrapper} ${isDragMode ? styles.dragModeActive : ''} ${position ? styles.userPositioned : ''}`}
      style={dynamicInlineStyle}
      onMouseDown={startDrag}
      onTouchStart={startTouchDrag}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className={styles.toggleButton}
        onClick={handleLeftClick}
        title={isDragMode ? "Drag to re-position" : "Open Tracker / Right-click for options"}
      >
        <BrandIcon className={styles.icon} size={20} />
      </button>

      {showContextMenu && (
        <div className={styles.contextMenu} ref={menuRef}>
          <button
            type="button"
            className={isDragMode ? styles.activeMenuBtn : ''}
            onClick={() => { setIsDragMode(!isDragMode); setShowContextMenu(false); }}
          >
            {isDragMode ? (
              <>
                <LockIcon isLocked={true} className={styles.menuIcon} size={13} />
                Lock Position
              </>
            ) : (
              <>
                <MoveArrowsIcon className={styles.menuIcon} />
                Enable Drag
              </>
            )}
          </button>
          <button type="button" onClick={resetToDefault}>
            <ResetArrowIcon className={styles.menuIcon} />
            Reset Position
          </button>
        </div>
      )}
    </div>
  );
}