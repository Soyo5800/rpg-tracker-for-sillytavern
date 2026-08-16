import React, { useRef, useEffect, useState } from 'react';

/**
 * Resolves SillyTavern avatar filenames to browser-accessible URLs.
 * Bundle-safe implementation for React UI components.
 */
export function resolveSillyTavernAvatarUrl(avatarFile, type = 'Card') {
  if (!avatarFile || typeof avatarFile !== 'string') return null;
  if (avatarFile.startsWith('http://') || avatarFile.startsWith('https://') || avatarFile.startsWith('data:')) {
    return avatarFile;
  }

  let filename = String(avatarFile);
  if (filename.includes('/')) {
    filename = filename.split('/').pop();
  }

  try { filename = decodeURIComponent(filename); } catch (e) { }

  const lower = filename.toLowerCase();

  if (
    lower === 'default.png' || lower === 'ghost.png' || lower === 'user.png' ||
    lower === 'system.png' || lower === 'default-user' || lower === 'default' ||
    lower === 'user-default.png' || lower === 'user-default' || lower === 'none' ||
    lower === ''
  ) {
    return null;
  }

  if (type === 'Card') {
    if (typeof window.getAvatarPath === 'function') {
      const resolved = window.getAvatarPath(avatarFile);
      if (resolved && (resolved.startsWith('http') || resolved.startsWith('/') || resolved.startsWith('.'))) {
        return resolved;
      }
    }
    const encoded = encodeURIComponent(filename);
    return `/characters/${encoded}`;
  }

  if (type === 'Persona') {
    if (window.RPGBridge && typeof window.RPGBridge.getThumbnailUrl === 'function') {
      const url = window.RPGBridge.getThumbnailUrl('persona', filename);
      if (url) return url;
    }

    if (!/\.[a-zA-Z0-9]{2,5}$/.test(filename)) {
      filename += '.png';
    }
    return `/api/images/avatars/${encodeURIComponent(filename)}`;
  }

  return null;
}

/**
 * Auto-resizing multi-line text input component.
 * Enforces hidden overflow and border-box sizing to eliminate scrollbars.
 */
export function AutoGrowingTextArea({ value, onChange, placeholder, className, style, disabled }) {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      if (!value || String(value).trim() === '') {
        el.style.height = '';
      } else {
        el.style.height = `${el.scrollHeight}px`;
      }
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className={className}
      style={{
        overflowY: 'hidden',
        boxSizing: 'border-box',
        resize: isFocused && !disabled ? 'vertical' : 'none',
        ...style
      }}
      value={value || ''}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      onFocus={() => {
        if (disabled) return;
        setIsFocused(true);
        adjustHeight();
      }}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder}
      rows={1}
      disabled={disabled}
    />
  );
}

/**
 * Standardized Toggle Switch Component
 */
export function ToggleSwitch({ checked, onChange, label, disabled = false, title, className = '' }) {
  return (
    <label className={`rpg-switch-row ${className}`.trim()} title={title}>
      {label && <span>{label}</span>}
      <div className="rpg-switch">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.checked, e)}
        />
        <span className="rpg-slider" />
      </div>
    </label>
  );
}

/**
 * Standardized Order Sorting Button Pair (Up/Down)
 */
export function SortButtons({ onMoveUp, onMoveDown, isFirst = false, isLast = false, disabled = false }) {
  return (
    <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      <button
        type="button"
        className="rpg-btn-sort"
        disabled={disabled || isFirst}
        onClick={(e) => {
          e.stopPropagation();
          if (onMoveUp) onMoveUp(e);
        }}
        title="Move Up"
      >
        ▲
      </button>
      <button
        type="button"
        className="rpg-btn-sort"
        disabled={disabled || isLast}
        onClick={(e) => {
          e.stopPropagation();
          if (onMoveDown) onMoveDown(e);
        }}
        title="Move Down"
      >
        ▼
      </button>
    </div>
  );
}

/**
 * Standardized Accordion Collapse/Expand Arrow Button
 */
export function AccordionArrow({ isExpanded, onClick, className = '', title, style }) {
  return (
    <button
      type="button"
      className={`rpg-accordion-arrow ${isExpanded ? 'expanded' : ''} ${className}`.trim()}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(e);
      }}
      title={title}
      style={style}
    >
      ▶
    </button>
  );
}