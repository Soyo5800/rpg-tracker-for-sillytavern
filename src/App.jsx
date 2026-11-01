import React, { useEffect } from 'react';
import { RPGControlProvider, useRPG } from './core/RPGControl';
import TrackerPanelToggle from './tracker/TrackerPanelToggle';
import TrackerPanel from './tracker/TrackerPanel';
import { ErrorBoundary } from './core/ErrorBoundary';
import SnapshotModal from './messagetracker/SnapshotModal';
import HistoryModal from './messagetracker/HistoryModal';
import VisualStage from './tracker/VisualStage';

function RPGTrackerContainer() {
  const { isEnabled, settings } = useRPG();

  useEffect(() => {
    const rootElement = document.getElementById('my-rpg-react-root');
    if (rootElement) {
      if (isEnabled) {
        rootElement.style.setProperty('display', 'block', 'important');
        rootElement.style.setProperty('background', 'transparent', 'important');
        rootElement.style.setProperty('border', 'none', 'important');
        rootElement.style.setProperty('box-shadow', 'none', 'important');
        rootElement.style.setProperty('padding', '0', 'important');
        rootElement.style.setProperty('width', '0', 'important');
        rootElement.style.setProperty('height', '0', 'important');
        rootElement.style.setProperty('position', 'fixed', 'important');
        rootElement.style.setProperty('top', '0', 'important');
        rootElement.style.setProperty('left', '0', 'important');
        rootElement.style.setProperty('pointer-events', 'auto', 'important');
      } else {
        rootElement.style.setProperty('display', 'none', 'important');
      }
    }
  }, [isEnabled]);

  if (!isEnabled) {
    return null;
  }

  // Detect custom theme mode
  const isCustomTheme = settings.theme === 'custom';

  // Apply visual theme variables
  const globalThemeStyles = {
    '--rpg-bg': isCustomTheme && settings.customColors?.bg
      ? settings.customColors.bg
      : 'var(--SmartThemeBlurTintColor, var(--bg-color, rgba(26, 26, 46, 0.95)))',

    '--rpg-accent': isCustomTheme && settings.customColors?.accent
      ? settings.customColors.accent
      : 'var(--black30a, rgba(0, 0, 0, 0.3))',

    '--rpg-text': isCustomTheme && settings.customColors?.text
      ? settings.customColors.text
      : 'var(--SmartThemeBodyColor, var(--text-color, #eaeaea))',

    '--rpg-highlight': isCustomTheme && settings.customColors?.highlight
      ? settings.customColors.highlight
      : 'var(--SmartThemeQuoteColor, var(--main-color, #4a9eff))',

    '--rpg-border': isCustomTheme && settings.customColors?.border
      ? settings.customColors.border
      : 'var(--SmartThemeBorderColor, var(--border-color, #4a7ba7))',
  };

  return (
    <div style={{ ...globalThemeStyles, pointerEvents: 'none', width: '100%', height: '100%' }}>
      {/* Floating toggle launcher */}
      <div style={{ pointerEvents: 'auto' }}>
        <ErrorBoundary>
          <TrackerPanelToggle />
        </ErrorBoundary>
      </div>

        {/* Main sidebar tracker panel */}
      <div style={{ pointerEvents: 'auto' }}>
        <ErrorBoundary>
          <TrackerPanel />
        </ErrorBoundary>
      </div>

      {/* Visual stage standee viewport (Full click-through) */}
      <div style={{ pointerEvents: 'none' }}>
        <ErrorBoundary>
          <VisualStage />
        </ErrorBoundary>
      </div>

      {/* Single message snapshot modal */}
      <div style={{ pointerEvents: 'auto' }}>
        <ErrorBoundary>
          <SnapshotModal />
        </ErrorBoundary>
      </div>

      {/* Chat turn history and snapshot manager modal */}
      <div style={{ pointerEvents: 'auto' }}>
        <ErrorBoundary>
          <HistoryModal />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <RPGControlProvider>
      <RPGTrackerContainer />
    </RPGControlProvider>
  );
}