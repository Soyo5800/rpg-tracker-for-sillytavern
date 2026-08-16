import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './SettingsEditor.module.css';
import { ToggleSwitch } from '../utils';

function rgbToHex(rgbStr) {
  const match = rgbStr.match(/\d+/g);
  if (!match || match.length < 3) return null;
  const r = Math.min(255, parseInt(match[0], 10));
  const g = Math.min(255, parseInt(match[1], 10));
  const b = Math.min(255, parseInt(match[2], 10));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getSillyTavernThemeColors() {
  const bodyStyle = getComputedStyle(document.body);

  const resolveToHex = (cssVarNames, fallback) => {
    for (const varName of cssVarNames) {
      const val = bodyStyle.getPropertyValue(varName).trim();
      if (val) {
        if (val.startsWith('#')) {
          if (val.length === 4) {
            return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
          }
          return val.substring(0, 7);
        }
        if (val.startsWith('rgb')) {
          const hex = rgbToHex(val);
          if (hex) return hex;
        }
      }
    }
    return fallback;
  };

  return {
    bg: resolveToHex(['--SmartThemeBlurTintColor', '--bg-color'], '#1a1a2e'),
    accent: resolveToHex(['--black30a', '--border-color'], '#4a7ba7'),
    text: resolveToHex(['--SmartThemeBodyColor', '--text-color'], '#ffffff'),
    highlight: resolveToHex(['--SmartThemeQuoteColor', '--main-color'], '#4a9eff'),
    border: resolveToHex(['--SmartThemeBorderColor', '--border-color'], '#4a7ba7')
  };
}

export default function SettingsEditor({ onClose }) {
  const { settings, updateSettings } = useRPG();

  const [localUpdateMode, setLocalUpdateMode] = useState('merged');
  const [localPanelPosition, setLocalPanelPosition] = useState('left');
  const [localTheme, setLocalTheme] = useState('default');
  const [localShowDeltaLog, setLocalShowDeltaLog] = useState(true);

  const [localKeepAllBackups, setLocalKeepAllBackups] = useState(false);
  const [localMaxBackupCount, setLocalMaxBackupCount] = useState(20);

  const [localColors, setLocalColors] = useState({
    bg: '#1a1a2e',
    accent: '#4a7ba7',
    text: '#ffffff',
    highlight: '#4a9eff',
    border: '#4a7ba7'
  });

  useEffect(() => {
    setLocalUpdateMode(settings.updateMode || 'merged');
    setLocalPanelPosition(settings.panelPosition || 'left');
    setLocalTheme(settings.theme || 'default');
    setLocalShowDeltaLog(settings.showDeltaLog !== false);
    setLocalKeepAllBackups(settings.keepAllBackups === true);
    setLocalMaxBackupCount(settings.maxBackupCount !== undefined ? settings.maxBackupCount : 20);

    if (settings.customColors) {
      setLocalColors(prev => ({ ...prev, ...settings.customColors }));
    }
  }, [settings]);

  const handleThemeChange = (newTheme) => {
    setLocalTheme(newTheme);
    if (newTheme === 'custom') {
      const isDefaultPlaceholder =
        localColors.bg === '#1a1a2e' &&
        localColors.accent === '#4a7ba7' &&
        localColors.text === '#ffffff' &&
        localColors.highlight === '#4a9eff' &&
        localColors.border === '#4a7ba7';

      if (isDefaultPlaceholder) {
        setLocalColors(getSillyTavernThemeColors());
      }
    }
  };

  const handleColorChange = (key, val) => {
    setLocalColors(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSave = () => {
    updateSettings({
      ...settings,
      updateMode: localUpdateMode,
      panelPosition: localPanelPosition,
      theme: localTheme,
      showDeltaLog: localShowDeltaLog,
      customColors: localColors,
      keepAllBackups: localKeepAllBackups,
      maxBackupCount: Math.max(0, parseInt(localMaxBackupCount, 10) || 0)
    });
    alert("Settings saved successfully.");
    onClose();
  };

  return (
    <div className="rpg-modal-overlay">
      <div className="rpg-modal-container" onClick={e => e.stopPropagation()}>
        <header className="rpg-modal-header">
          <h4>Settings</h4>
          <button className="rpg-modal-close-btn" onClick={onClose}>×</button>
        </header>

        <div className="rpg-modal-body">
          {/* 1. Update Mode */}
          <div className={styles.section}>
            <label className={styles.label}>Update Mode</label>
            <p className={styles.settingsDesc}>
              Choose how the tracker syncs data with the AI.
            </p>
            <select
              value={localUpdateMode}
              onChange={e => setLocalUpdateMode(e.target.value)}
              className={`${styles.settingsSelect} rpg-select-custom`}
            >
              <option value="merged">Merged (Inject status & Auto-update every turn)</option>
              <option value="separated">Separated (Inject status for context, Manual update)</option>
              <option value="isolated">Isolated (No injection, Manual update only)</option>
            </select>
          </div>

          {/* 2. Panel Position */}
          <div className={styles.section}>
            <label className={styles.label}>Panel Position</label>
            <p className={styles.settingsDesc}>
              Choose which side of the screen the sidebar panel will dock.
            </p>
            <select
              value={localPanelPosition}
              onChange={e => setLocalPanelPosition(e.target.value)}
              className={`${styles.settingsSelect} rpg-select-custom`}
            >
              <option value="left">Left Side</option>
              <option value="right">Right Side</option>
            </select>
          </div>

          {/* 3. Visual Theme */}
          <div className={styles.section}>
            <label className={styles.label}>Visual Theme</label>
            <p className={styles.settingsDesc}>
              Choose the interface color palette.
            </p>
            <select
              value={localTheme}
              onChange={e => handleThemeChange(e.target.value)}
              className={`${styles.settingsSelect} rpg-select-custom`}
            >
              <option value="default">Default (Follow SillyTavern UI)</option>
              <option value="custom">Custom Color Palette</option>
            </select>

            {localTheme === 'custom' && (
              <div className={styles.colorPaletteGrid}>
                <div className={styles.colorRow}>
                  <span className={styles.colorLabel}>Background</span>
                  <input
                    type="color"
                    value={localColors.bg}
                    onChange={e => handleColorChange('bg', e.target.value)}
                    className={styles.colorPicker}
                  />
                  <input
                    type="text"
                    value={localColors.bg}
                    onChange={e => handleColorChange('bg', e.target.value)}
                    className={styles.colorTextInput}
                  />
                </div>
                <div className={styles.colorRow}>
                  <span className={styles.colorLabel}>Text Color</span>
                  <input
                    type="color"
                    value={localColors.text}
                    onChange={e => handleColorChange('text', e.target.value)}
                    className={styles.colorPicker}
                  />
                  <input
                    type="text"
                    value={localColors.text}
                    onChange={e => handleColorChange('text', e.target.value)}
                    className={styles.colorTextInput}
                  />
                </div>
                <div className={styles.colorRow}>
                  <span className={styles.colorLabel}>Border Line</span>
                  <input
                    type="color"
                    value={localColors.border}
                    onChange={e => handleColorChange('border', e.target.value)}
                    className={styles.colorPicker}
                  />
                  <input
                    type="text"
                    value={localColors.border}
                    onChange={e => handleColorChange('border', e.target.value)}
                    className={styles.colorTextInput}
                  />
                </div>
                <div className={styles.colorRow}>
                  <span className={styles.colorLabel}>Accent Area</span>
                  <input
                    type="color"
                    value={localColors.accent}
                    onChange={e => handleColorChange('accent', e.target.value)}
                    className={styles.colorPicker}
                  />
                  <input
                    type="text"
                    value={localColors.accent}
                    onChange={e => handleColorChange('accent', e.target.value)}
                    className={styles.colorTextInput}
                  />
                </div>
                <div className={styles.colorRow}>
                  <span className={styles.colorLabel}>Highlight Text</span>
                  <input
                    type="color"
                    value={localColors.highlight}
                    onChange={e => handleColorChange('highlight', e.target.value)}
                    className={styles.colorPicker}
                  />
                  <input
                    type="text"
                    value={localColors.highlight}
                    onChange={e => handleColorChange('highlight', e.target.value)}
                    className={styles.colorTextInput}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Show Status Change Log */}
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <label className={styles.label}>
                Show Status Change Log
              </label>
              <ToggleSwitch
                checked={localShowDeltaLog}
                onChange={setLocalShowDeltaLog}
              />
            </div>
            <p className={styles.settingsDesc}>
              Show collapsing delta change log at the bottom of AI messages.
            </p>
          </div>

          {/* 5. History Snapshots */}
          <div className={styles.section}>
            <label className={styles.label}>
              History Snapshots
            </label>

            <div className={styles.snapshotControlsRow}>
              <span className={styles.snapshotLabel}>
                Max Recent Snapshots to Keep
              </span>

              <div className={styles.snapshotButtonGroup}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={localKeepAllBackups}
                  value={localKeepAllBackups ? '' : localMaxBackupCount}
                  placeholder={localKeepAllBackups ? '∞' : ''}
                  onChange={e => setLocalMaxBackupCount(e.target.value)}
                  className={styles.snapshotNumberInput}
                />

                <button
                  type="button"
                  onClick={() => setLocalKeepAllBackups(!localKeepAllBackups)}
                  className={`rpg-btn ${localKeepAllBackups ? 'rpg-btn-primary' : ''}`}
                >
                  Unlimited {localKeepAllBackups ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <p className={styles.settingsDesc}>
              Set how many historical state snapshots to keep in chat metadata. Enabling Unlimited stores status snapshots across all turns for complete historical integrity.
            </p>
          </div>
        </div>

        <footer className="rpg-modal-footer">
          <div className="rpg-modal-footer-left"></div>
          <div className="rpg-modal-footer-right">
            <button type="button" className="rpg-modal-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="rpg-modal-btn save" onClick={handleSave}>Save Changes</button>
          </div>
        </footer>
      </div>
    </div>
  );
}