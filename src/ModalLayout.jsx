import React, { useEffect } from 'react';

/**
 * Common modal frame layout component.
 * Unifies modal overlay, container sizing, header controls,
 * scrollable body, and action footer across all RPG Tracker editors.
 */
export default function ModalLayout({
  isOpen = true,
  title,
  headerContent,
  subHeader,
  children,
  footerLeft,
  footerRight,
  hideFooter = false,
  onClose,
  closeOnOverlayClick = false,
  isHighPriority = false,
  containerStyle,
  containerClassName = ''
}) {
  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`rpg-modal-overlay ${isHighPriority ? 'high-priority' : ''}`.trim()}
      onClick={handleOverlayClick}
    >
      <div
        className={`rpg-modal-container ${containerClassName}`.trim()}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="rpg-modal-header">
          {headerContent ? (
            headerContent
          ) : (
            <h4>{title}</h4>
          )}
          {onClose && (
            <button
              type="button"
              className="rpg-modal-close-btn"
              onClick={onClose}
              title="Close (Esc)"
            >
              ×
            </button>
          )}
        </header>

        {/* Optional Sub-Header (Tab navigation, preset bars, etc.) */}
        {subHeader && subHeader}

        {/* Scrollable Modal Body */}
        <div className="rpg-modal-body">
          {children}
        </div>

        {/* Modal Action Footer */}
        {!hideFooter && (footerLeft || footerRight) && (
          <footer className="rpg-modal-footer">
            <div className="rpg-modal-footer-left">
              {footerLeft}
            </div>
            <div className="rpg-modal-footer-right">
              {footerRight}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}