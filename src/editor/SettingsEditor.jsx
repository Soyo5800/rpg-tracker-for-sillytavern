import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './SettingsEditor.module.css';
import { ToggleSwitch } from '../utils';
import ModalLayout from '../ModalLayout';
import { getAvailableOpenRouterProviders, fetchProvidersForOpenRouterModel } from '../core/OpenRouterHelper';

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
  const [localUseCustomModel, setLocalUseCustomModel] = useState(false);
  const [localCustomModel, setLocalCustomModel] = useState('');
  const [localContextLimit, setLocalContextLimit] = useState('4');

  const [localProviders, setLocalProviders] = useState(() =>
    Array.isArray(settings.customProviders) ? [...settings.customProviders] : []
  );
  const [localAllowFallbacks, setLocalAllowFallbacks] = useState(true);
  const [availableProvidersList, setAvailableProvidersList] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const [modelInfo, setModelInfo] = useState({ api: '', currentModel: '', models: [] });
  const [isManualInputMode, setIsManualInputMode] = useState(false);

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

  const refreshModels = () => {
    if (window.RPGBridge && typeof window.RPGBridge.getAvailableModels === 'function') {
      const info = window.RPGBridge.getAvailableModels();
      setModelInfo(info);

      const targetModel = localCustomModel || settings.customModel;
      if (targetModel && info.models.length > 0 && !info.models.some(m => m.value === targetModel)) {
        setIsManualInputMode(true);
      }
    }
  };

  useEffect(() => {
    setLocalUpdateMode(settings.updateMode || 'merged');
    setLocalUseCustomModel(settings.useCustomModel || false);
    setLocalCustomModel(settings.customModel || '');
    setLocalContextLimit(String(settings.contextMessageLimit ?? 4));

    if (Array.isArray(settings.customProviders) && settings.customProviders.length > 0) {
      setLocalProviders([...settings.customProviders]);
    } else {
      setLocalProviders([]);
    }

    setLocalAllowFallbacks(settings.customAllowFallbacks !== false);
    setLocalShowDeltaLog(settings.showDeltaLog !== false);
    setLocalPanelPosition(settings.panelPosition || 'left');
    setLocalTheme(settings.theme || 'default');

    if (settings.customColors) {
      setLocalColors(prev => ({ ...prev, ...settings.customColors }));
    }

    refreshModels();
  }, [settings]);

  const effectiveModel = (localCustomModel || modelInfo.currentModel || '').trim();
  const isOpenRouterModel = (modelInfo.api && modelInfo.api.toLowerCase().includes('openrouter')) || effectiveModel.includes('/');

  // Dynamically update available providers when the target model changes
  useEffect(() => {
    let isCancelled = false;

    const loadProviders = () => {
      if (isOpenRouterModel && effectiveModel && effectiveModel !== 'OR_Website') {
        setLoadingProviders(true);
        fetchProvidersForOpenRouterModel(effectiveModel).then(providers => {
          if (!isCancelled) {
            setAvailableProvidersList(providers);
            setLoadingProviders(false);
          }
        });
      } else {
        setAvailableProvidersList(getAvailableOpenRouterProviders());
      }
    };

    // Immediate update for dropdown selections, debounced for text typing
    const delay = isManualInputMode ? 300 : 0;
    const timer = setTimeout(loadProviders, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [effectiveModel, isOpenRouterModel, isManualInputMode]);

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
    setLocalColors(prev => ({ ...prev, [key]: val }));
  };

  const handleProviderSelectChange = (index, value) => {
    setLocalProviders(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddProviderSlot = () => {
    setLocalProviders(prev => [...prev, '']);
  };

  const handleRemoveProviderSlot = (index) => {
    setLocalProviders(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    let parsedLimit = parseInt(localContextLimit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      parsedLimit = 4;
    } else if (parsedLimit > 100) {
      parsedLimit = 100;
    }

    const cleanProviders = localProviders
      .map(p => p.trim())
      .filter((p, idx, arr) => p !== '' && arr.indexOf(p) === idx);

    updateSettings({
      ...settings,
      updateMode: localUpdateMode,
      useCustomModel: localUseCustomModel,
      customModel: (localCustomModel || '').trim(),
      customProviders: cleanProviders,
      customAllowFallbacks: localAllowFallbacks,
      contextMessageLimit: parsedLimit,
      showDeltaLog: localShowDeltaLog,
      panelPosition: localPanelPosition,
      theme: localTheme,
      customColors: localColors
    });

    if (window.RPGBridge) {
      if (typeof window.RPGBridge.refreshPrompts === 'function') {
        window.RPGBridge.refreshPrompts();
      }
      if (typeof window.RPGBridge.triggerObserverNow === 'function') {
        window.RPGBridge.triggerObserverNow();
      }
    }

    alert("Settings saved successfully.");
    onClose();
  };

  return (
    <ModalLayout
      title="Settings"
      onClose={onClose}
      footerRight={
        <>
          <button type="button" className="rpg-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rpg-modal-btn save" onClick={handleSave}>
            Save Changes
          </button>
        </>
      }
    >
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

      {/* 2. Tracker API Model */}
      <div className={styles.section}>
        <label className={styles.label}>Tracker API Model</label>
        <div className={styles.toggleRow}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>Use Separate Model</span>
            <span className={styles.itemSubText}>
              Use a fast/lite model for status extraction and background updates.
            </span>
          </div>
          <ToggleSwitch
            checked={localUseCustomModel}
            onChange={setLocalUseCustomModel}
          />
        </div>

        {localUseCustomModel && (
          <div className={styles.modelSubBox}>
            <div className={styles.fieldHeaderRow}>
              <span className={styles.fieldLabel}>
                {isManualInputMode ? 'Custom Model ID' : 'Select Model'}
              </span>
              <button
                type="button"
                className="rpg-btn-sm"
                onClick={() => setIsManualInputMode(!isManualInputMode)}
              >
                {isManualInputMode ? 'Select from List' : 'Custom Model'}
              </button>
            </div>

            {isManualInputMode ? (
              <input
                type="text"
                className={`${styles.textInput} ${styles.modelInputControl}`}
                value={localCustomModel}
                onChange={e => setLocalCustomModel(e.target.value)}
                placeholder="e.g. anthropic/claude-3.5-sonnet, meta-llama/llama-3.3-70b"
              />
            ) : (
              <select
                className={`${styles.settingsSelect} ${styles.modelInputControl} rpg-select-custom`}
                value={localCustomModel}
                onChange={e => setLocalCustomModel(e.target.value)}
              >
                <option value="">Current Main Model</option>
                {modelInfo.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}

            {isOpenRouterModel && (
              <div className={styles.providerSection}>
                <div className={styles.providerHeaderRow}>
                  <div className={styles.labelGroup}>
                    <span className={styles.fieldLabel} style={{ fontSize: '11px', color: 'var(--rpg-highlight)' }}>
                      Select Provider {loadingProviders && <span style={{ opacity: 0.6, fontSize: '10px' }}>(Loading...)</span>}
                    </span>
                    <span className={styles.itemSubText}>
                      Set priority order of providers. Empty slot defaults to SillyTavern routing.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rpg-btn-sm"
                    onClick={handleAddProviderSlot}
                    title="Add fallback provider"
                  >
                    + Add
                  </button>
                </div>

                <div className={styles.providerList}>
                  {localProviders.length === 0 ? (
                    <div style={{ fontSize: '11px', opacity: 0.6, padding: '6px 2px', fontStyle: 'italic' }}>
                      No provider override (SillyTavern default routing). Click '+ Add' to set priority.
                    </div>
                  ) : (
                    localProviders.map((selectedProvider, idx) => (
                    <div key={idx} className={styles.providerRow}>
                      <span className={styles.providerIndexBadge}>{idx + 1}</span>
                      <select
                        className={`${styles.settingsSelect} rpg-select-custom`}
                        value={selectedProvider}
                        onChange={e => handleProviderSelectChange(idx, e.target.value)}
                      >
                        <option value="">-- SillyTavern Default Routing --</option>
                        {selectedProvider && !availableProvidersList.includes(selectedProvider) && (
                          <option key={selectedProvider} value={selectedProvider}>
                            {selectedProvider} (Unavailable for this model)
                          </option>
                        )}
                        {availableProvidersList.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rpg-btn-del"
                        onClick={() => handleRemoveProviderSlot(idx)}
                        title="Remove this provider"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
                </div>

                <div className={styles.fallbackRow}>
                  <div className={styles.labelGroup}>
                    <span className={styles.itemLabel} style={{ fontSize: '11px' }}>Allow Fallbacks</span>
                    <span className={styles.itemSubText}>Fallback to other providers if selected ones fail.</span>
                  </div>
                  <ToggleSwitch
                    checked={localAllowFallbacks}
                    onChange={setLocalAllowFallbacks}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Context Message Limit */}
      <div className={styles.section}>
        <div className={styles.rowItem}>
          <div className={styles.labelGroup}>
            <label className={styles.label} style={{ marginBottom: 0 }}>Context Message Limit</label>
            <span className={styles.itemSubText}>
              Number of recent chat history turns sent to the AI during manual status updates or queries.
            </span>
          </div>
          <input
            type="number"
            min="1"
            max="100"
            className={styles.numberInput}
            value={localContextLimit}
            onChange={e => setLocalContextLimit(e.target.value)}
          />
        </div>
      </div>

      {/* 4. Show Status Change Log */}
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div className={styles.labelGroup}>
            <label className={styles.label} style={{ marginBottom: 0 }}>
              Show Status Change Log
            </label>
            <span className={styles.itemSubText}>
              Show collapsing delta change log at the bottom of AI messages.
            </span>
          </div>
          <ToggleSwitch
            checked={localShowDeltaLog}
            onChange={setLocalShowDeltaLog}
          />
        </div>
      </div>

      <div className={styles.sectionDivider} />

      {/* 5. Panel Position */}
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

      {/* 6. Visual Theme */}
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
    </ModalLayout>
  );
}