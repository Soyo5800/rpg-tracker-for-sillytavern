// src/editor/SettingsEditor.jsx

import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './SettingsEditor.module.css';

// rgb/rgba 문자열을 hex6 형식(#rrggbb)으로 파싱하는 도우미 함수
function rgbToHex(rgbStr) {
  const match = rgbStr.match(/\d+/g);
  if (!match || match.length < 3) return null;
  const r = Math.min(255, parseInt(match[0], 10));
  const g = Math.min(255, parseInt(match[1], 10));
  const b = Math.min(255, parseInt(match[2], 10));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// 실리터번 바디에 적용되어 있는 활성 테마 변수를 동적으로 캡처하는 함수
function getSillyTavernThemeColors() {
  const bodyStyle = getComputedStyle(document.body);

  const resolveToHex = (cssVarNames, fallback) => {
    for (const varName of cssVarNames) {
      const val = bodyStyle.getPropertyValue(varName).trim();
      if (val) {
        if (val.startsWith('#')) {
          if (val.length === 4) { // shorthand (#fff -> #ffffff)
            return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
          }
          return val.substring(0, 7); // 알파값이 포함된 hex8 규격 대응
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
  const [localShowDeltaLog, setLocalShowDeltaLog] = useState(true);
  const [localPanelPosition, setLocalPanelPosition] = useState('left');
  const [localTheme, setLocalTheme] = useState('default');

  const [localColors, setLocalColors] = useState({
    bg: '#1a1a2e',
    accent: '#4a7ba7',
    text: '#ffffff',
    highlight: '#4a9eff',
    border: '#4a7ba7'
  });

  useEffect(() => {
    setLocalUpdateMode(settings.updateMode || 'merged');
    setLocalShowDeltaLog(settings.showDeltaLog !== false);
    setLocalPanelPosition(settings.panelPosition || 'left');
    setLocalTheme(settings.theme || 'default');

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
      showDeltaLog: localShowDeltaLog,
      panelPosition: localPanelPosition,
      theme: localTheme,
      customColors: localColors,
      maxBackupCount: 20
    });
    alert("Settings saved successfully.");
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <h4>Settings</h4>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.body}>
          {/* 1. 업데이트 연산 모드 조정 */}
          <div className={styles.section} style={{ marginBottom: '16px' }}>
            <label className={styles.label}>Update Mode</label>
            <p className={styles.settingsDesc}>
              Choose how the tracker syncs data with the AI.
            </p>
            <select
              value={localUpdateMode}
              onChange={e => setLocalUpdateMode(e.target.value)}
              className={styles.settingsSelect}
            >
              <option value="merged">Merged (Inject status & Auto-update every turn)</option>
              <option value="separated">Separated (Inject status for context, Manual update)</option>
              <option value="isolated">Isolated (No injection, Manual update only)</option>
            </select>
          </div>

          {/* 2. 델타 로그 변경 사항 */}
          <div className={styles.section} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.label} style={{ margin: 0 }}>
                Show Status Change Log
              </label>
              <label className={styles.switch} style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={localShowDeltaLog}
                  onChange={e => setLocalShowDeltaLog(e.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <p className={styles.settingsDesc}>
              Show collapsing delta change log at the bottom of AI messages.
            </p>
          </div>

          {/* 3. 패널 도크 정렬 옵션 */}
          <div className={styles.section} style={{ marginBottom: '16px' }}>
            <label className={styles.label}>Panel Position</label>
            <p className={styles.settingsDesc}>
              Choose which side of the screen the sidebar panel will dock.
            </p>
            <select
              value={localPanelPosition}
              onChange={e => setLocalPanelPosition(e.target.value)}
              className={styles.settingsSelect}
            >
              <option value="left">Left Side</option>
              <option value="right">Right Side</option>
            </select>
          </div>

          {/* 4. 테마 모드 셀렉트 및 컬러 편집 그리드 */}
          <div className={styles.section} style={{ marginBottom: '16px' }}>
            <label className={styles.label}>Visual Theme Mode</label>
            <p className={styles.settingsDesc}>
              Choose the interface color palette.
            </p>
            <select
              value={localTheme}
              onChange={e => handleThemeChange(e.target.value)}
              className={styles.settingsSelect}
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
        </div>

        <footer className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
        </footer>
      </div>
    </div>
  );
}