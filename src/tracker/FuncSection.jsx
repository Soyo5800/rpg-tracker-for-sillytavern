import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './FuncSection.module.css';
import { DEFAULT_ADD_CHAR_PROMPT, DEFAULT_ADD_PLAYER_CHAR_PROMPT } from '../core/PromptSchema.js';
import { ToggleSwitch } from '../utils';

export default function FuncSection() {
  const { trackerData, updateTrackerData, settings, updateSettings, isChatConnected } = useRPG();
  const [targetNameInput, setTargetNameInput] = useState('');
  const [limitInput, setLimitInput] = useState(() => String(settings.contextMessageLimit ?? 4));

  const [modelInfo, setModelInfo] = useState({ api: '', currentModel: '', models: [] });
  const [isManualInputMode, setIsManualInputMode] = useState(false);

  const refreshModels = () => {
    if (window.RPGBridge && typeof window.RPGBridge.getAvailableModels === 'function') {
      const info = window.RPGBridge.getAvailableModels();
      setModelInfo(info);

      if (settings.customModel && info.models.length > 0 && !info.models.some(m => m.value === settings.customModel)) {
        setIsManualInputMode(true);
      }
    }
  };

  useEffect(() => {
    refreshModels();
  }, []);

  useEffect(() => {
    setLimitInput(String(settings.contextMessageLimit ?? 4));
  }, [settings.contextMessageLimit]);

  const addons = trackerData.addons || { weather: false, worldEvents: false, cyoa: false };

  const handleLimitInputChange = (e) => {
    const rawVal = e.target.value;
    setLimitInput(rawVal);

    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      updateSettings({ contextMessageLimit: parsed });
    }
  };

  const handleLimitInputBlur = () => {
    const parsed = parseInt(limitInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setLimitInput('4');
      updateSettings({ contextMessageLimit: 4 });
    }
  };

  const handleAddonToggle = (key, checked) => {
    updateTrackerData({
      ...trackerData,
      addons: {
        ...addons,
        [key]: checked
      }
    });
  };

  const handleSendGenerationRequest = async (type) => {
    if (!isChatConnected) {
      alert("Not connected to a chat room. Please connect to a chat room to use this feature.");
      return;
    }

    const isPlayer = type === 'player';
    const name = targetNameInput.trim();
    const basePrompt = isPlayer
      ? (trackerData.addPlayerCharPrompt || DEFAULT_ADD_PLAYER_CHAR_PROMPT)
      : (trackerData.addCharPrompt || DEFAULT_ADD_CHAR_PROMPT);

    let cardDescription = "";
    try {
      const stContext = window.SillyTavern?.getContext?.();
      if (stContext && name) {
        const matchedCard = stContext.characters?.find(
          c => c.name?.toLowerCase() === name.toLowerCase()
        );

        if (matchedCard) {
          cardDescription = `\n\n[ORIGINAL CHARACTER CARD DETAILS FOR '${name}']`;
          if (matchedCard.description) cardDescription += `\nDescription:\n${matchedCard.description}`;
          if (matchedCard.personality) cardDescription += `\nPersonality:\n${matchedCard.personality}`;
        }
      }
    } catch (err) {
      console.warn("[RPG Tracker] SillyTavern context search warning:", err);
    }

    let finalPrompt = "";
    if (name) {
      finalPrompt = `Create a profile for '${name}' following these guidelines:\n${basePrompt}${cardDescription}`;
    } else {
      finalPrompt = `Identify a character from the chat log that needs a profile and create one following these guidelines:\n${basePrompt}`;
    }

    if (window.RPGBridge && typeof window.RPGBridge.triggerCharacterGeneration === 'function') {
      alert(`Requesting to add ${isPlayer ? 'Player Character' : 'Character'} '${name || 'Auto-Detect'}'... This may take a moment.`);
      try {
        await window.RPGBridge.triggerCharacterGeneration(finalPrompt, isPlayer);
      } catch (err) {
        console.error("[RPG Tracker] Generation trigger error:", err);
        alert("An error occurred during character generation.");
      }
    }
  };

  return (
    <div className={styles.container}>

      {/* 1. Tracker API Model */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Tracker API Model</span>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={refreshModels}
            title="Scan connected API models"
          >
            ↻
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>Use Separate Model</span>
            <span className={styles.itemSubText}>
              Use a fast/lite model for status extraction & background updates.
            </span>
          </div>
          <ToggleSwitch
            checked={settings.useCustomModel || false}
            onChange={(checked) => updateSettings({ useCustomModel: checked })}
          />
        </div>

        {settings.useCustomModel && (
          <div className={styles.inputGroup} style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
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
                className={styles.textInput}
                value={settings.customModel || ''}
                onChange={(e) => updateSettings({ customModel: e.target.value })}
                placeholder="e.g. gemini-1.5-flash, gpt-4o-mini"
              />
            ) : (
              <select
                className={`${styles.selectInput} rpg-select-custom`}
                value={settings.customModel || ''}
                onChange={(e) => updateSettings({ customModel: e.target.value })}
              >
                <option value="">Current Model</option>
                {modelInfo.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* 2. Context Limit */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Context Limit Setting</span>
        </div>
        <div className={styles.rowItem}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>Max Recent Messages</span>
            <span className={styles.itemSubText}>
              Number of recent chat history turns sent to AI during manual status updates or queries.
            </span>
          </div>
          <input
            type="number"
            min="1"
            max="100"
            className={styles.numberInput}
            value={limitInput}
            onChange={handleLimitInputChange}
            onBlur={handleLimitInputBlur}
          />
        </div>
      </div>

      {/* 3. Active Add-ons */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Active Add-ons</span>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>World Events</span>
            <span className={styles.itemSubText}>Inject guidelines for generating dynamic global events.</span>
          </div>
          <ToggleSwitch
            checked={addons.worldEvents || false}
            onChange={(checked) => handleAddonToggle('worldEvents', checked)}
          />
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>Dynamic Weather</span>
            <span className={styles.itemSubText}>Inject guidelines for weather changes and atmosphere descriptions.</span>
          </div>
          <ToggleSwitch
            checked={addons.weather || false}
            onChange={(checked) => handleAddonToggle('weather', checked)}
          />
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>CYOA Mode</span>
            <span className={styles.itemSubText}>Instruct AI to present interactive choices at response end.</span>
          </div>
          <ToggleSwitch
            checked={addons.cyoa || false}
            onChange={(checked) => handleAddonToggle('cyoa', checked)}
          />
        </div>
      </div>

      {/* 4. Character Generator */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Character Generator</span>
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.fieldLabel}>Target Name (Optional)</span>
          <input
            type="text"
            className={styles.textInput}
            value={targetNameInput}
            onChange={(e) => setTargetNameInput(e.target.value)}
            placeholder="Leave blank to auto-detect from chat"
          />
        </div>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            className="rpg-btn"
            style={{ flex: 1, padding: '7px 10px' }}
            onClick={() => handleSendGenerationRequest('npc')}
          >
            Generate NPC
          </button>
          <button
            type="button"
            className="rpg-btn"
            style={{ flex: 1, padding: '7px 10px' }}
            onClick={() => handleSendGenerationRequest('player')}
          >
            Generate Player
          </button>
        </div>
      </div>

    </div>
  );
}