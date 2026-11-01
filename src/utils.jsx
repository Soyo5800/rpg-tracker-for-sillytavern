import React, { useRef, useEffect, useState } from 'react';

/**
 * Auto-resizing multi-line text input component.
 * Automatically adjusts height based on content while managing scroll behavior.
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
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      title={title}
      style={style}
    >
      ▶
    </button>
  );
}