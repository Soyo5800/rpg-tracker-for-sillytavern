import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './FuncSection.module.css';
import { DEFAULT_ADD_CHAR_PROMPT, DEFAULT_ADD_PLAYER_CHAR_PROMPT } from '../core/PromptSchema.js';
import { ToggleSwitch } from '../utils';
import { PenIcon, GearIcon } from '../Icons';

export default function FuncSection({ onOpenPromptSettings, onOpenSettings }) {
  const {
    trackerData,
    updateTrackerData,
    promptSettings,
    updatePromptSettings,
    settings,
    updateSettings,
    isChatConnected
  } = useRPG();

  const [targetNameInput, setTargetNameInput] = useState('');
  const [maxBackupInput, setMaxBackupInput] = useState(() => String(settings.maxBackupCount ?? 20));

  useEffect(() => {
    setMaxBackupInput(String(settings.maxBackupCount ?? 20));
  }, [settings.maxBackupCount]);

  const effectivePrompts = promptSettings || trackerData || {};
  const addons = effectivePrompts.addons || { weather: false, worldEvents: false, cyoa: false };
  const isUnlimited = settings.keepAllBackups === true;

  const handleMaxBackupChange = (e) => {
    const rawVal = e.target.value;
    setMaxBackupInput(rawVal);

    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      updateSettings({ maxBackupCount: Math.min(100, parsed) });
    }
  };

  const handleMaxBackupBlur = () => {
    const parsed = parseInt(maxBackupInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      setMaxBackupInput('20');
      updateSettings({ maxBackupCount: 20 });
    } else if (parsed > 100) {
      setMaxBackupInput('100');
      updateSettings({ maxBackupCount: 100 });
    }
  };

  const handleCleanOldBackups = async () => {
    if (!window.RPGBridge || typeof window.RPGBridge.runManualPrune !== 'function') {
      alert("Manual cleanup API is not available.");
      return;
    }

    if (window.confirm("Clean up old snapshots exceeding the retention limit? Pinned turns will remain protected.")) {
      try {
        const result = await window.RPGBridge.runManualPrune();
        const pruned = result?.prunedCount ?? 0;
        const pinned = result?.pinnedCount ?? 0;
        alert(`Cleanup complete: Removed ${pruned} old snapshot(s).\n(${pinned} pinned turn(s) safely preserved)`);
      } catch (err) {
        console.error("[RPG Tracker] Manual prune error:", err);
        alert("An error occurred during snapshot cleanup.");
      }
    }
  };

  const handleOpenTurnHistory = () => {
    if (window.RPGBridge && typeof window.RPGBridge.openHistoryModal === 'function') {
      window.RPGBridge.openHistoryModal();
    }
  };

  const handleAddonToggle = (key, checked) => {
    const nextAddons = {
      ...addons,
      [key]: checked
    };

    if (typeof updatePromptSettings === 'function') {
      updatePromptSettings({
        ...effectivePrompts,
        addons: nextAddons
      });
    } else if (typeof updateTrackerData === 'function') {
      updateTrackerData({
        ...trackerData,
        addons: nextAddons
      });
    }
  };

  const handleSendGenerationRequest = async (type) => {
    if (!isChatConnected) {
      alert("Not connected to a chat room. Please connect to a chat room to use this feature.");
      return;
    }

    const isPlayer = type === 'player';
    const name = targetNameInput.trim();
    const basePrompt = isPlayer
      ? (effectivePrompts.addPlayerCharPrompt || DEFAULT_ADD_PLAYER_CHAR_PROMPT)
      : (effectivePrompts.addCharPrompt || DEFAULT_ADD_CHAR_PROMPT);

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

      {/* 1. Quick Settings Launchers */}
      <div className={styles.launcherGrid}>
        <button
          type="button"
          className={styles.launcherBtn}
          onClick={onOpenPromptSettings}
        >
          <PenIcon size={14} className={styles.launcherIcon} />
          <span>Prompt Settings</span>
        </button>
        <button
          type="button"
          className={styles.launcherBtn}
          onClick={onOpenSettings}
        >
          <GearIcon size={14} className={styles.launcherIcon} />
          <span>Tracker Settings</span>
        </button>
      </div>

      {/* 2. Snapshot Retention & History */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Snapshot Retention & History</span>
        </div>

        <div className={styles.rowItem}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>Max Stored Snapshots</span>
            <span className={styles.itemSubText}>
              Number of past turns that preserve tracker data before automatic cleanup.
            </span>
          </div>
          <input
            type="number"
            min="0"
            max="100"
            disabled={isUnlimited}
            className={styles.numberInput}
            value={maxBackupInput}
            onChange={handleMaxBackupChange}
            onBlur={handleMaxBackupBlur}
          />
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.labelGroup}>
            <span className={styles.itemLabel}>Unlimited Storage</span>
            <span className={styles.itemSubText}>
              Keep all historical snapshots indefinitely without auto-pruning.
            </span>
          </div>
          <ToggleSwitch
            checked={isUnlimited}
            onChange={(checked) => updateSettings({ keepAllBackups: checked })}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className="rpg-btn"
            style={{ flex: 1, padding: '7px 8px' }}
            onClick={handleOpenTurnHistory}
            title="Open Tracker History Manager"
          >
            Tracker History
          </button>
          <button
            type="button"
            className={`rpg-btn ${styles.dangerBtn}`}
            style={{ flex: 1, padding: '7px 8px' }}
            onClick={handleCleanOldBackups}
            title="Clean up old unpinned backups exceeding the retention limit"
          >
            Clean Old Backups
          </button>
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