import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './CharListEditor.module.css';
import { getDefaultCharacters, createDefaultCharacter } from '../core/PromptSchema';
import {
  getNextCharacterId,
  reindexCharactersSequentially,
  syncChatHistoryCharacterIds
} from '../core/JSONTracker';
import { PresetSaveIcon, PresetLoadIcon, GearIcon } from '../Icons';
import { SortButtons } from '../utils';
import ModalLayout from '../ModalLayout';
import { createPresetStore, getPresetLocation } from '../core/PresetStore.js';
import FieldDefinitionsTab from './FieldDefinitionsTab';

export default function CharListEditor({ onClose, onOpenStatusEditor }) {
  const {
    trackerData,
    updateTrackerData,
    settings,
    updateSettings,
    uiState,
    updateUiState,
    remapCharacterMetadata,
    pruneCharacterSyncs,
    pruneCustomAvatars
  } = useRPG();

  const [activeTab, setActiveTab] = useState('characters');

  const [localCharacters, setLocalCharacters] = useState(() =>
    (trackerData.characters && trackerData.characters.length > 0)
      ? JSON.parse(JSON.stringify(trackerData.characters))
      : getDefaultCharacters()
  );

  const [localDefObj, setLocalDefObj] = useState(() =>
    trackerData.globalDefinitions ? JSON.parse(JSON.stringify(trackerData.globalDefinitions)) : {}
  );

  const [showDropdown, setShowDropdown] = useState(false);

  const [currentPresetId, setCurrentPresetId] = useState(trackerData.currentPresetId || '');
  const [currentPresetName, setCurrentPresetName] = useState(trackerData.currentPresetName || 'New Preset');

  const presetStore = useMemo(() => {
    if (window.RPGBridge?.presetStore) {
      return window.RPGBridge.presetStore;
    }
    return createPresetStore({
      extensionName: 'rpg-tracker-for-sillytavern',
      getRequestHeaders: () => window.RPGBridge?.getRequestHeaders?.() || {},
      syncPresets: (presets) => updateSettings({ presets }),
    });
  }, [updateSettings]);

  useEffect(() => {
    presetStore.refresh()
      .then((result) => {
        if (result?.presets) {
          updateSettings({ presets: result.presets });
        }
      })
      .catch((err) => {
        console.warn("[RPG Tracker] Preset store refresh failed:", err);
      });
  }, [presetStore, updateSettings]);

  const applyIdRemapping = useCallback((idMap) => {
    if (!idMap || typeof idMap !== 'object' || Object.keys(idMap).length === 0) return;

    if (typeof remapCharacterMetadata === 'function') {
      remapCharacterMetadata(idMap);
    }

    if (uiState && typeof updateUiState === 'function') {
      const nextCollapsed = {};
      Object.entries(uiState.collapsedChars || {}).forEach(([key, val]) => {
        const mappedKey = idMap[key] || key;
        nextCollapsed[mappedKey] = val;
      });

      const nextTabs = {};
      Object.entries(uiState.activeInlineTabs || {}).forEach(([key, val]) => {
        const mappedKey = idMap[key] || key;
        nextTabs[mappedKey] = val;
      });

      const nextCollapsedRelations = {};
      Object.entries(uiState.collapsedRelations || {}).forEach(([key, val]) => {
        const sepIdx = key.indexOf('_');
        if (sepIdx !== -1) {
          const prefixId = key.substring(0, sepIdx);
          const rest = key.substring(sepIdx);
          const mappedId = idMap[prefixId] || prefixId;
          nextCollapsedRelations[`${mappedId}${rest}`] = val;
        } else {
          nextCollapsedRelations[key] = val;
        }
      });

      updateUiState({
        collapsedChars: nextCollapsed,
        activeInlineTabs: nextTabs,
        collapsedRelations: nextCollapsedRelations
      });
    }
  }, [remapCharacterMetadata, uiState, updateUiState]);

  const commitTrackerChanges = useCallback((nextChars, nextDefs = localDefObj, nextPresetId = currentPresetId, nextPresetName = currentPresetName, idMap = null, shouldPrune = false) => {
    if (idMap && Object.keys(idMap).length > 0) {
      applyIdRemapping(idMap);
    }

    if (shouldPrune) {
      const activeCharIds = nextChars.map(c => c.id);
      if (pruneCharacterSyncs) pruneCharacterSyncs(activeCharIds);
      if (pruneCustomAvatars) pruneCustomAvatars(activeCharIds);
    }

    const updatedTracker = {
      ...trackerData,
      currentPresetId: nextPresetId,
      currentPresetName: nextPresetName,
      characters: nextChars,
      globalDefinitions: nextDefs
    };

    updateTrackerData(updatedTracker);
    if (window.RPGBridge) {
      window.RPGBridge.currentTrackerData = updatedTracker;
    }
  }, [applyIdRemapping, currentPresetId, currentPresetName, localDefObj, pruneCharacterSyncs, pruneCustomAvatars, trackerData, updateTrackerData]);

  const handleMove = (index, direction) => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= localCharacters.length) return;

    const newChars = [...localCharacters];
    const temp = newChars[index];
    newChars[index] = newChars[nextIdx];
    newChars[nextIdx] = temp;

    const { characters: reindexedChars, idMap } = reindexCharactersSequentially(newChars);
    setLocalCharacters(reindexedChars);
    commitTrackerChanges(reindexedChars, localDefObj, currentPresetId, currentPresetName, idMap, false);
  };

  const handleNameChange = (id, newName) => {
    const targetChar = localCharacters.find(c => c.id === id);
    const oldName = targetChar?.name || '';
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    const canRenameRelations = Boolean(
      trimmedOld &&
      trimmedNew &&
      trimmedOld !== trimmedNew &&
      !localCharacters.some(c => c.id !== id && c.name?.trim().toLowerCase() === trimmedNew.toLowerCase())
    );

    const newChars = localCharacters.map(c => {
      if (c.id === id) {
        return { ...c, name: newName };
      }
      if (canRenameRelations && c.relations && typeof c.relations === 'object' && c.relations[trimmedOld] !== undefined) {
        const nextRelations = {};
        Object.keys(c.relations).forEach(relKey => {
          if (relKey === trimmedOld && c.relations[trimmedNew] === undefined) {
            nextRelations[trimmedNew] = c.relations[relKey];
          } else {
            nextRelations[relKey] = c.relations[relKey];
          }
        });
        return { ...c, relations: nextRelations };
      }
      return c;
    });

    if (canRenameRelations && uiState?.collapsedRelations && typeof updateUiState === 'function') {
      const nextCollapsedRelations = {};
      let relChanged = false;
      Object.entries(uiState.collapsedRelations).forEach(([key, val]) => {
        const suffix = `_${trimmedOld}`;
        if (key.endsWith(suffix)) {
          const prefix = key.slice(0, -suffix.length);
          nextCollapsedRelations[`${prefix}_${trimmedNew}`] = val;
          relChanged = true;
        } else {
          nextCollapsedRelations[key] = val;
        }
      });
      if (relChanged) {
        updateUiState({ collapsedRelations: nextCollapsedRelations });
      }
    }

    setLocalCharacters(newChars);
    commitTrackerChanges(newChars, localDefObj, currentPresetId, currentPresetName, null, false);
  };

  const handleDelete = (id) => {
    if (localCharacters.length <= 1) {
      alert("At least one character must remain in the list.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this character?")) {
      const filteredChars = localCharacters.filter(c => c.id !== id);
      const { characters: reindexedChars, idMap } = reindexCharactersSequentially(filteredChars);
      setLocalCharacters(reindexedChars);
      commitTrackerChanges(reindexedChars, localDefObj, currentPresetId, currentPresetName, idMap, true);
    }
  };

  const handleAddCharacter = () => {
    const newId = getNextCharacterId(localCharacters);
    const newChar = createDefaultCharacter({ id: newId, name: "New Character", activePlayer: false });

    let newChars;
    if (localCharacters.length === 1 && localCharacters[0].id === 'char_user' && localCharacters[0].name === 'New') {
      newChars = [newChar];
    } else {
      newChars = [...localCharacters, newChar];
    }
    const { characters: reindexedChars, idMap } = reindexCharactersSequentially(newChars);
    setLocalCharacters(reindexedChars);
    commitTrackerChanges(reindexedChars, localDefObj, currentPresetId, currentPresetName, idMap, false);
  };

  const handleSavePreset = async () => {
    const trimmedName = currentPresetName.trim();
    if (!trimmedName) {
      alert("Please enter a preset name.");
      return;
    }

    const names = localCharacters.map(c => c.name.trim());
    if (names.some(name => !name)) {
      alert("Character name cannot be empty.");
      return;
    }

    const hasDuplicates = names.some((name, index) => names.indexOf(name) !== index);
    if (hasDuplicates) {
      const duplicateName = names.find((name, index) => names.indexOf(name) !== index);
      alert(`The character name "${duplicateName}" already exists. Duplicate names are not allowed.`);
      return;
    }

    const { characters: reindexedChars, idMap } = reindexCharactersSequentially(localCharacters);
    setLocalCharacters(reindexedChars);
    applyIdRemapping(idMap);

    const activeCharIds = reindexedChars.map(c => c.id);
    if (pruneCharacterSyncs) {
      pruneCharacterSyncs(activeCharIds);
    }
    if (pruneCustomAvatars) {
      pruneCustomAvatars(activeCharIds);
    }

    const context = window.SillyTavern?.getContext?.();
    if (context && Array.isArray(context.chat)) {
      const isChanged = syncChatHistoryCharacterIds(context.chat, reindexedChars);
      if (isChanged && window.RPGBridge?.saveChat) {
        window.RPGBridge.saveChat();
      }
    }

    const currentPresets = settings.presets || [];
    const existingById = currentPresetId ? currentPresets.find(p => p.id === currentPresetId) : null;
    const existingByName = currentPresets.find(p => p.name?.trim().toLowerCase() === trimmedName.toLowerCase());
    const targetExisting = existingById || existingByName;

    if (targetExisting) {
      if (!window.confirm(`Preset "${targetExisting.name}" already exists. Overwrite?`)) {
        return;
      }
    }

    try {
      const { preset, presets: nextPresets } = await presetStore.save({
        id: targetExisting?.id || undefined,
        name: trimmedName,
        data: {
          characters: reindexedChars,
          globalDefinitions: localDefObj
        },
        expectedPreset: targetExisting || null
      });

      updateSettings({ presets: nextPresets });
      setCurrentPresetId(preset.id);
      setCurrentPresetName(preset.name);

      updateTrackerData({
        ...trackerData,
        currentPresetId: preset.id,
        currentPresetName: preset.name,
        characters: reindexedChars,
        globalDefinitions: localDefObj
      });

      alert(`Preset "${preset.name}" saved to server!`);
    } catch (err) {
      alert(err.message || "Failed to save preset to server.");
    }
  };

  const handleLoadPreset = async (target) => {
    if (!window.confirm(`Are you sure you want to load preset "${target.name}"? This will overwrite your current characters in the editor.`)) {
      return;
    }

    try {
      let loadedChars = null;
      let loadedDefs = null;

      const presetId = typeof target === 'object' ? target.id : target;
      const { preset, data, presets: refreshedPresets } = await presetStore.load(presetId);
      if (Array.isArray(data)) {
        loadedChars = data;
      } else if (data && Array.isArray(data.characters)) {
        loadedChars = data.characters;
        loadedDefs = data.globalDefinitions || null;
      }
      setCurrentPresetId(preset.id);
      setCurrentPresetName(preset.name);
      if (refreshedPresets) {
        updateSettings({ presets: refreshedPresets });
      }

      if (Array.isArray(loadedChars)) {
        const { characters: reindexedChars, idMap } = reindexCharactersSequentially(loadedChars);
        const nextDefs = (loadedDefs && typeof loadedDefs === 'object') ? loadedDefs : localDefObj;
        setLocalCharacters(reindexedChars);
        if (loadedDefs && typeof loadedDefs === 'object') {
          setLocalDefObj(loadedDefs);
        }
        commitTrackerChanges(reindexedChars, nextDefs, preset.id, preset.name, idMap, true);
        setShowDropdown(false);
      } else {
        alert("Invalid preset structure.");
      }
    } catch (err) {
      console.error("[RPG Tracker] Preset load error:", err);
      alert(err.message || "An error occurred while loading this preset.");
    }
  };

  const handleDeletePresetById = async (presetId, presetName, e) => {
    if (e) e.stopPropagation();

    if (!window.confirm(`Are you sure you want to delete preset "${presetName}" from the server?`)) {
      return;
    }

    try {
      const currentPresets = settings.presets || [];
      const expected = currentPresets.find(p => p.id === presetId);
      const nextPresets = await presetStore.remove(presetId, expected);

      updateSettings({ presets: nextPresets });

      if (currentPresetId === presetId) {
        if (nextPresets.length === 0) {
          const defaultChars = getDefaultCharacters();
          const { characters: reindexedChars, idMap } = reindexCharactersSequentially(defaultChars);
          setCurrentPresetId('');
          setCurrentPresetName('New Preset');
          setLocalCharacters(reindexedChars);
          setLocalDefObj({});
          commitTrackerChanges(reindexedChars, {}, '', 'New Preset', idMap, true);
        } else {
          handleLoadPreset(nextPresets[0]);
        }
      }
    } catch (err) {
      alert(err.message || "Failed to delete preset.");
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm("Reset character list and definitions to default?")) {
      const defaultChars = getDefaultCharacters();
      const { characters: reindexedChars, idMap } = reindexCharactersSequentially(defaultChars);
      setLocalCharacters(reindexedChars);
      setLocalDefObj({});
      setCurrentPresetId('');
      setCurrentPresetName('New Preset');
      commitTrackerChanges(reindexedChars, {}, '', 'New Preset', idMap, true);
    }
  };

  const handleImportLocalFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        let parsedChars = null;
        let parsedDefs = null;

        if (Array.isArray(importedData)) {
          parsedChars = importedData;
        } else if (importedData && Array.isArray(importedData.characters)) {
          parsedChars = importedData.characters;
          parsedDefs = importedData.globalDefinitions || null;
        }

        if (parsedChars) {
          const importedName = file.name.replace(/\.[^/.]+$/, "");
          const { characters: reindexedChars, idMap } = reindexCharactersSequentially(parsedChars);
          const nextDefs = (parsedDefs && typeof parsedDefs === 'object') ? parsedDefs : localDefObj;

          try {
            const { preset, presets: nextPresets } = await presetStore.save({
              name: importedName,
              data: {
                characters: reindexedChars,
                globalDefinitions: parsedDefs || {}
              }
            });

            updateSettings({ presets: nextPresets });
            setLocalCharacters(reindexedChars);
            if (parsedDefs && typeof parsedDefs === 'object') {
              setLocalDefObj(parsedDefs);
            }
            setCurrentPresetName(preset.name);
            setCurrentPresetId(preset.id);
            commitTrackerChanges(reindexedChars, nextDefs, preset.id, preset.name, idMap, true);

            alert(`Preset "${preset.name}" imported and saved to server.`);
          } catch (saveErr) {
            alert(saveErr.message || "Failed to save imported preset to server.");
          }
        } else {
          alert("Invalid file format. Please import a valid RPG Tracker preset JSON file.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportLocalFile = () => {
    const { characters: reindexedChars } = reindexCharactersSequentially(localCharacters);

    const exportPayload = {
      characters: reindexedChars,
      globalDefinitions: localDefObj
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);

    const fileName = `${currentPresetName.trim().replace(/[/\\?%*:|"<>. ]/g, '_') || 'rpg_preset'}.json`;
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);

    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleGlobalSave = () => {
    const names = localCharacters.map(c => c.name.trim());
    if (names.some(name => !name)) {
      alert("Character name cannot be empty.");
      return;
    }

    const hasDuplicates = names.some((name, index) => names.indexOf(name) !== index);
    if (hasDuplicates) {
      const duplicateName = names.find((name, index) => names.indexOf(name) !== index);
      alert(`The character name "${duplicateName}" already exists. Duplicate names are not allowed.`);
      return;
    }

    const { characters: reindexedChars, idMap } = reindexCharactersSequentially(localCharacters);
    applyIdRemapping(idMap);

    const activeCharIds = reindexedChars.map(c => c.id);
    if (pruneCharacterSyncs) {
      pruneCharacterSyncs(activeCharIds);
    }
    if (pruneCustomAvatars) {
      pruneCustomAvatars(activeCharIds);
    }

    const context = window.SillyTavern?.getContext?.();
    if (context && Array.isArray(context.chat)) {
      const isChanged = syncChatHistoryCharacterIds(context.chat, reindexedChars);
      if (isChanged && window.RPGBridge?.saveChat) {
        window.RPGBridge.saveChat();
      }
    }

    const updatedTracker = {
      ...trackerData,
      currentPresetId,
      currentPresetName,
      characters: reindexedChars,
      globalDefinitions: localDefObj
    };

    updateTrackerData(updatedTracker);

    if (window.RPGBridge) {
      window.RPGBridge.currentTrackerData = updatedTracker;
      if (typeof window.RPGBridge.recordChatLocks === 'function') {
        window.RPGBridge.recordChatLocks(updatedTracker);
      }
      if (typeof window.RPGBridge.refreshPrompts === 'function') {
        window.RPGBridge.refreshPrompts(updatedTracker);
      }
    }

    alert("Character list saved and applied to active session!");
    onClose();
  };

  const presetsList = settings.presets || [];

  return (
    <ModalLayout
      title="Character List"
      onClose={onClose}
      subHeader={
        <div>
          <div className={styles.presetBar}>
            <div className={styles.presetDropdownContainer} style={{ flex: 1, position: 'relative' }}>
              <div className={styles.presetInputWrapper}>
                <input
                  type="text"
                  className={styles.presetNameInput}
                  value={currentPresetName}
                  onChange={(e) => setCurrentPresetName(e.target.value)}
                  placeholder="Preset Name"
                />
                <span className={styles.charIdBadge} style={{ margin: 0 }}>
                  {currentPresetId || 'NEW'}
                </span>
              </div>
              {showDropdown && (
                <div className={styles.presetDropdown} style={{ left: 0, right: 0, width: '100%', top: '100%', marginTop: '4px' }}>
                  {presetsList.length === 0 ? (
                    <div className={styles.presetDropdownEmpty}>No presets saved.</div>
                  ) : (
                    presetsList.map(preset => {
                      const locationLabel = getPresetLocation(preset, typeof window !== 'undefined' ? window.localStorage : null);

                      return (
                        <div key={preset.id} className={styles.presetDropdownItem}>
                          <div className={styles.presetDropdownItemLoadArea} onClick={() => handleLoadPreset(preset)}>
                            <span className={styles.presetItemName}>{preset.name}</span>
                            <div className={styles.presetItemBadges}>
                              <span className={styles.charIdBadge} style={{ transform: 'scale(0.85)', margin: 0, flexShrink: 0 }}>
                                {locationLabel}
                              </span>
                              <span className={styles.charIdBadge} style={{ transform: 'scale(0.85)', margin: 0, flexShrink: 0, opacity: 0.6 }}>
                                {preset.id}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="rpg-btn-del-text"
                            title="Delete Preset"
                            onClick={(e) => handleDeletePresetById(preset.id, preset.name, e)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="rpg-btn-icon"
              title="Save Preset"
              onClick={handleSavePreset}
            >
              <PresetSaveIcon />
            </button>
            <button
              type="button"
              className="rpg-btn-icon"
              title="Load Preset"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <PresetLoadIcon />
            </button>
          </div>

          <div className="rpg-tab-nav">
            <button
              type="button"
              className={`rpg-tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
              onClick={() => setActiveTab('characters')}
            >
              Characters
            </button>
            <button
              type="button"
              className={`rpg-tab-btn ${activeTab === 'definitions' ? 'active' : ''}`}
              onClick={() => setActiveTab('definitions')}
            >
              Field Definitions
            </button>
          </div>
        </div>
      }
      footerLeft={
        <button type="button" className="rpg-modal-btn reset" onClick={handleResetToDefault}>
          Reset
        </button>
      }
      footerRight={
        <>
          <input
            type="file"
            id="hidden-preset-file-picker"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportLocalFile}
          />
          <button type="button" className="rpg-modal-btn" onClick={handleExportLocalFile}>
            Export
          </button>
          <button
            type="button"
            className="rpg-modal-btn"
            onClick={() => document.getElementById('hidden-preset-file-picker')?.click()}
          >
            Import
          </button>
          <button type="button" className="rpg-modal-btn save" onClick={handleGlobalSave}>
            Save
          </button>
        </>
      }
    >
      {activeTab === 'characters' && (
        <div className={styles.charListContainer}>
          {localCharacters.map((char, index) => (
            <div key={char.id} className={styles.charItem}>
              <SortButtons
                onMoveUp={() => handleMove(index, 'up')}
                onMoveDown={() => handleMove(index, 'down')}
                isFirst={index === 0}
                isLast={index === localCharacters.length - 1}
              />
              <input
                type="text"
                className={styles.nameInput}
                value={char.name}
                onChange={(e) => handleNameChange(char.id, e.target.value)}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className="rpg-btn-icon"
                  title="Edit Character"
                  onClick={() => {
                    const { characters: reindexedChars, idMap } = reindexCharactersSequentially(localCharacters);
                    setLocalCharacters(reindexedChars);
                    commitTrackerChanges(reindexedChars, localDefObj, currentPresetId, currentPresetName, idMap, false);
                    const mappedTargetId = (idMap && idMap[char.id]) ? idMap[char.id] : char.id;
                    onOpenStatusEditor(mappedTargetId);
                  }}
                >
                  <GearIcon />
                </button>
                <button
                  type="button"
                  className="rpg-btn-del"
                  title="Delete Character"
                  onClick={() => handleDelete(char.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="rpg-btn-dashed" onClick={handleAddCharacter}>
            + Add Character
          </button>
        </div>
      )}

      {activeTab === 'definitions' && (
        <FieldDefinitionsTab
          localCharacters={localCharacters}
          setLocalCharacters={(updater) => {
            setLocalCharacters(prev => {
              const next = typeof updater === 'function' ? updater(prev) : updater;
              commitTrackerChanges(next, localDefObj, currentPresetId, currentPresetName, null, false);
              return next;
            });
          }}
          localDefObj={localDefObj}
          setLocalDefObj={(updater) => {
            setLocalDefObj(prev => {
              const next = typeof updater === 'function' ? updater(prev) : updater;
              commitTrackerChanges(localCharacters, next, currentPresetId, currentPresetName, null, false);
              return next;
            });
          }}
        />
      )}
    </ModalLayout>
  );
}