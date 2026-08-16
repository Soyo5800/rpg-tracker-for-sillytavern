import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './StatusEditor.module.css';
import { sanitizeTrackerData, syncCrossRelations } from '../core/JSONTracker';
import { setNestedValue } from '../core/StateHelpers';
import { GearIcon } from '../Icons';
import { DEFAULT_STATUS_SCHEMAS, DEFAULT_STATUS, getDefaultCharacters } from '../core/PromptSchema';
import { resolveSillyTavernAvatarUrl } from '../utils';

import StatusSpecsTab from './StatusSpecsTab';
import RelationsTab from './RelationsTab';
import InventoryTab from './InventoryTab';

import CardSyncComponent, { savePresetToSillyTavernCard } from './CardSyncComponent';

export default function StatusEditor({ charId, initialTab = 'status', onClose, characters, onUpdateCharacters }) {
  const { trackerData, updateTrackerData, syncCharacterToCard } = useRPG();

  const [localCharacters, setLocalCharacters] = useState(() => {
    const getActiveCharacters = () => {
      if (characters && characters.length > 0) return characters;
      if (trackerData.characters && trackerData.characters.length > 0) return trackerData.characters;
      return getDefaultCharacters();
    };
    return JSON.parse(JSON.stringify(getActiveCharacters()));
  });

  const [expandedIds, setExpandedIds] = useState({});
  const [activeTab, setActiveTab] = useState(initialTab);

  const [presetEditingTarget, setPresetEditingTarget] = useState(null);

  useEffect(() => {
    const getActiveCharacters = () => {
      if (characters && characters.length > 0) return characters;
      if (trackerData.characters && trackerData.characters.length > 0) return trackerData.characters;
      return getDefaultCharacters();
    };
    setLocalCharacters(JSON.parse(JSON.stringify(getActiveCharacters())));
  }, [trackerData.characters, characters]);

  const targetChar = localCharacters.find(c => c.id === charId);

  const context = window.SillyTavern?.getContext?.();
  let liveName = targetChar ? targetChar.name : '';
  let liveAvatarUrl = targetChar ? targetChar.avatarUrl : '';

  if (context && targetChar) {
    if (targetChar.syncedCardType === 'Persona') {
      liveName = context.name1 || window.name1 || targetChar.name;
      const userAvatarFile = context.user_avatar || window.user_avatar || 'default.png';
      liveAvatarUrl = resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona');
    } else if (targetChar.syncedCardAvatar && targetChar.syncedCardType === 'Card') {
      const allChars = Array.isArray(context.characters) ? context.characters : (Array.isArray(window.characters) ? window.characters : []);
      const matched = allChars.find(c => c.avatar === targetChar.syncedCardAvatar);
      if (matched) {
        liveName = matched.name;
        liveAvatarUrl = resolveSillyTavernAvatarUrl(matched.avatar, 'Card');
      }
    }
  }

  const isEditingPreset = presetEditingTarget !== null;
  const currentEditingChar = isEditingPreset ? presetEditingTarget : targetChar;
  const currentEditingList = isEditingPreset ? [presetEditingTarget] : localCharacters;

  const handleUpdateList = (updater) => {
    if (isEditingPreset) {
      setPresetEditingTarget(prev => {
        const nextList = typeof updater === 'function' ? updater([prev]) : updater;
        return nextList[0];
      });
    } else {
      setLocalCharacters(updater);
    }
  };

  const handleUpdateNestedField = (group, key, val) => {
    handleUpdateList(prev => prev.map(c => {
      if (c.id !== currentEditingChar.id) return c;
      const path = key === null ? [group] : [group, key];
      return setNestedValue(c, path, val);
    }));
  };

  const updateSchemaField = (id, key, val) => {
    handleUpdateList(prev => prev.map(c =>
      c.id === currentEditingChar.id
        ? { ...c, statusSchema: (c.statusSchema || []).map(s => s.id === id ? { ...s, [key]: val } : s) }
        : c
    ));
  };

  const handleAddCharacter = () => {
    const name = "New Character";
    const newChar = JSON.parse(JSON.stringify(getDefaultCharacters()[0]));
    newChar.id = `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    newChar.name = name;
    newChar.activePlayer = false;
    newChar.activeInjection = true;

    let nextChars;
    if (localCharacters.length === 1 && localCharacters[0].id === 'char_user' && localCharacters[0].name === 'New') {
      nextChars = [newChar];
    } else {
      nextChars = [...localCharacters, newChar];
    }

    if (onUpdateCharacters) {
      onUpdateCharacters(nextChars);
    } else if (updateTrackerData) {
      updateTrackerData({ ...trackerData, characters: nextChars });
    }
  };

  if (!charId || !targetChar) {
    if (!charId) {
      return (
        <button type="button" className="rpg-btn-dashed" onClick={handleAddCharacter}>
          + Add Character
        </button>
      );
    }
    return null;
  }

  const handleSyncCard = (target) => {
    setLocalCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c;

      if (target.type === 'Unsync') {
        return {
          ...c,
          syncedCardAvatar: null,
          syncedCardType: null
        };
      }

      return {
        ...c,
        name: target.name,
        avatarUrl: target.avatarUrl,
        syncedCardAvatar: target.avatarFile,
        syncedCardType: target.type
      };
    }));

    if (syncCharacterToCard) {
      syncCharacterToCard(charId, target);
    }

    if (target.type === 'Unsync') {
      alert("Card synchronization has been removed. Current values have been kept.");
    } else {
      alert(`"${target.name}" card synchronization completed successfully.`);
    }
  };

  const handleLoadPresetToActive = () => {
    const context = window.SillyTavern?.getContext?.();
    const syncedAvatar = targetChar.syncedCardAvatar;
    const allChars = Array.isArray(context?.characters) ? context.characters : (Array.isArray(window.characters) ? window.characters : []);
    const matchedCard = allChars.find(c => c.avatar === syncedAvatar);

    if (!matchedCard) {
      alert("Could not load the synchronized SillyTavern card asset. Please verify card connection.");
      return;
    }

    const cardPreset = matchedCard.data?.extensions?.rpg_tracker;
    if (!cardPreset) {
      alert("No preset data found inside this card. You can edit and save a preset first.");
      return;
    }

    if (window.confirm(`Are you sure you want to load the preset template of "${liveName}" into the active session? This will overwrite your current status and features for this turn.`)) {
      setLocalCharacters(localCharacters.map(c => {
        if (c.id !== charId) return c;
        return {
          ...c,
          statusSchema: JSON.parse(JSON.stringify(cardPreset.statusSchema || DEFAULT_STATUS_SCHEMAS)),
          status: JSON.parse(JSON.stringify(cardPreset.status || DEFAULT_STATUS)),
          profile: JSON.parse(JSON.stringify(cardPreset.profile || { Race: '', Height: '', Appearance: '' })),
          inventory: JSON.parse(JSON.stringify(cardPreset.inventory || { equipment: {}, storage: {} })),
          quests: JSON.parse(JSON.stringify(cardPreset.quests || { main: { name: '', desc: '' }, sides: [] })),
          relations: JSON.parse(JSON.stringify(cardPreset.relations || {}))
        };
      }));
      alert("Preset loaded into the active session successfully.");
    }
  };

  const handleLoadActiveToPreset = () => {
    if (window.confirm("Are you sure you want to copy the active session's current status and features into this preset editor? This will overwrite your working preset edits.")) {
      setPresetEditingTarget(prev => ({
        ...prev,
        statusSchema: JSON.parse(JSON.stringify(targetChar.statusSchema || DEFAULT_STATUS_SCHEMAS)),
        status: JSON.parse(JSON.stringify(targetChar.status || DEFAULT_STATUS)),
        profile: JSON.parse(JSON.stringify(targetChar.profile || { Race: '', Height: '', Appearance: '' })),
        inventory: JSON.parse(JSON.stringify(targetChar.inventory || { equipment: {}, storage: {} })),
        quests: JSON.parse(JSON.stringify(targetChar.quests || { main: { name: '', desc: '' }, sides: [] })),
        relations: JSON.parse(JSON.stringify(targetChar.relations || {}))
      }));
      alert("Active session status copied to the preset editor. Click 'Save Preset to Card' to permanently write it to the card PNG.");
    }
  };

  const handleOpenPresetEditor = () => {
    const context = window.SillyTavern?.getContext?.();
    const syncedAvatar = targetChar.syncedCardAvatar;
    const allChars = Array.isArray(context?.characters) ? context.characters : (Array.isArray(window.characters) ? window.characters : []);
    const matchedCard = allChars.find(c => c.avatar === syncedAvatar);

    if (!matchedCard) {
      alert("Could not load the synchronized SillyTavern card asset. Please verify card connection.");
      return;
    }

    const presetData = matchedCard.data?.extensions?.rpg_tracker || {};
    const virtualPresetChar = {
      id: `preset_${syncedAvatar}`,
      name: `${matchedCard.name}`,
      activePlayer: targetChar.activePlayer,
      statusSchema: presetData.statusSchema || JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
      status: presetData.status || JSON.parse(JSON.stringify(DEFAULT_STATUS)),
      profile: presetData.profile || { Race: '', Height: '', Appearance: '' },
      inventory: presetData.inventory || { equipment: {}, storage: {} },
      quests: presetData.quests || { main: { name: '', desc: '' }, sides: [] },
      relations: presetData.relations || {}
    };

    setPresetEditingTarget(virtualPresetChar);
  };

  const handleResetCharacter = () => {
    if (isEditingPreset) {
      const context = window.SillyTavern?.getContext?.();
      const syncedAvatar = targetChar.syncedCardAvatar;
      const allChars = Array.isArray(context?.characters) ? context.characters : (Array.isArray(window.characters) ? window.characters : []);
      const matchedCard = allChars.find(c => c.avatar === syncedAvatar);

      if (!matchedCard) {
        alert("Could not load the synchronized SillyTavern card asset. Please verify card connection.");
        return;
      }

      if (window.confirm("Are you sure you want to revert your unsaved preset changes and load the last saved preset from the card?")) {
        const presetData = matchedCard.data?.extensions?.rpg_tracker || {};
        setPresetEditingTarget(prev => ({
          ...prev,
          statusSchema: JSON.parse(JSON.stringify(presetData.statusSchema || DEFAULT_STATUS_SCHEMAS)),
          status: JSON.parse(JSON.stringify(presetData.status || DEFAULT_STATUS)),
          profile: JSON.parse(JSON.stringify(presetData.profile || { Race: '', Height: '', Appearance: '' })),
          inventory: JSON.parse(JSON.stringify(presetData.inventory || { equipment: {}, storage: {} })),
          quests: JSON.parse(JSON.stringify(presetData.quests || { main: { name: '', desc: '' }, sides: [] })),
          relations: JSON.parse(JSON.stringify(presetData.relations || {}))
        }));
      }
    } else {
      const context = window.SillyTavern?.getContext?.();
      const allChars = Array.isArray(context?.characters) ? context.characters : (Array.isArray(window.characters) ? window.characters : []);
      const matchedCard = allChars.find(c => c.avatar === targetChar.syncedCardAvatar);
      const cardPreset = matchedCard?.data?.extensions?.rpg_tracker;

      const confirmMessage = cardPreset
        ? `Do you want to restore the character data of "${liveName}" to the synced card template?`
        : `Do you want to restore the character data of "${liveName}" to default factory schemas?`;

      if (window.confirm(confirmMessage)) {
        setLocalCharacters(localCharacters.map(c => {
          if (c.id !== charId) return c;

          if (cardPreset) {
            return {
              ...c,
              statusSchema: JSON.parse(JSON.stringify(cardPreset.statusSchema || DEFAULT_STATUS_SCHEMAS)),
              status: JSON.parse(JSON.stringify(cardPreset.status || DEFAULT_STATUS)),
              profile: JSON.parse(JSON.stringify(cardPreset.profile || { Race: '', Height: '', Appearance: '' })),
              inventory: JSON.parse(JSON.stringify(cardPreset.inventory || { equipment: {}, storage: {} })),
              quests: JSON.parse(JSON.stringify(cardPreset.quests || { main: { name: '', desc: '' }, sides: [] })),
              relations: JSON.parse(JSON.stringify(cardPreset.relations || {}))
            };
          }

          return {
            ...c,
            statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
            status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
            profile: { Race: '', Height: '', Appearance: '' },
            inventory: {
              equipIsLocked: false, equipIsInject: true, storageIsLocked: false, storageIsInject: true,
              equipmentLocks: {}, storageLocks: {},
              equipment: { 'Right Hand': null, 'Left Hand': null }, storage: { 'Backpack': [] }
            },
            quests: { main: { name: '', desc: '' }, sides: [] },
            relations: {}
          };
        }));
      }
    }
  };

  const handleDeletePresetFromCard = async () => {
    if (window.confirm("Are you sure you want to permanently delete the custom preset metadata inside this PNG file?\nThis action cannot be undone, and the active session will be reset to default schemas.")) {
      const success = await savePresetToSillyTavernCard(targetChar.syncedCardAvatar, null);
      if (success) {
        alert("The stored preset info inside the character card has been cleared.");
        setLocalCharacters(prev => prev.map(c => {
          if (c.id !== charId) return c;
          return {
            ...c,
            statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
            status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
            profile: { Race: '', Height: '', Appearance: '' },
            inventory: {
              equipIsLocked: false, equipIsInject: true, storageIsLocked: false, storageIsInject: true,
              equipmentLocks: {}, storageLocks: {},
              equipment: { 'Right Hand': null, 'Left Hand': null }, storage: { 'Backpack': [] }
            },
            quests: { main: { name: '', desc: '' }, sides: [] },
            relations: {}
          };
        }));
        setPresetEditingTarget(null);
      } else {
        alert("An error occurred during communication with the server.");
      }
    }
  };

  const handleSavePresetToCard = async () => {
    const presetPayload = {
      statusSchema: presetEditingTarget.statusSchema,
      status: presetEditingTarget.status,
      profile: presetEditingTarget.profile,
      inventory: presetEditingTarget.inventory,
      quests: presetEditingTarget.quests,
      relations: presetEditingTarget.relations
    };

    const success = await savePresetToSillyTavernCard(targetChar.syncedCardAvatar, presetPayload);
    if (success) {
      alert("Preset modifications have been permanently written to the character card PNG metadata.");
      setPresetEditingTarget(null);
    } else {
      alert("Failed to write preset. Please check SillyTavern server connection.");
    }
  };

  const handleDeleteCharacter = () => {
    if (localCharacters.length <= 1) {
      alert("At least one character must remain in the list.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this character?")) {
      const newChars = localCharacters.filter(c => c.id !== charId);
      if (updateTrackerData) updateTrackerData({ ...trackerData, characters: newChars });
      if (onUpdateCharacters) onUpdateCharacters(newChars);
      onClose();
    }
  };

  const handleExportCharacter = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentEditingChar, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${currentEditingChar.name}_export.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportCharacter = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData && importedData.id) {
          handleUpdateList(currentEditingList.map(c =>
            c.id === currentEditingChar.id ? {
              ...(() => {
                const tempTracker = { characters: [importedData] };
                const sanitizedTemp = sanitizeTrackerData(tempTracker);
                return sanitizedTemp.characters[0];
              })(), id: currentEditingChar.id
            } : c
          ));
        } else {
          alert("Invalid character JSON file.");
        }
      } catch (error) {
        alert("Error parsing JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveChanges = () => {
    if (updateTrackerData) {
      const stContext = window.SillyTavern?.getContext?.();
      const updatedList = localCharacters.map(c => {
        if (c.id === charId) {
          if (c.syncedCardType === 'Card' && c.syncedCardAvatar) {
            const allChars = Array.isArray(stContext?.characters) ? stContext.characters : (Array.isArray(window.characters) ? window.characters : []);
            const matched = allChars.find(stChar => stChar.avatar === c.syncedCardAvatar);
            if (matched) {
              return {
                ...c,
                name: matched.name || c.name,
                avatarUrl: resolveSillyTavernAvatarUrl(matched.avatar, 'Card')
              };
            }
          } else if (c.syncedCardType === 'Persona' && c.syncedCardAvatar) {
            const userAvatarFile = stContext?.user_avatar || window.user_avatar || 'default.png';
            const liveName = stContext?.name1 || window.name1 || c.name;
            return {
              ...c,
              name: liveName,
              avatarUrl: resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona')
            };
          }
          return c;
        }
        return c;
      });

      const tempTracker = {
        characters: JSON.parse(JSON.stringify(updatedList)),
        globalDefinitions: JSON.parse(JSON.stringify(trackerData.globalDefinitions || {}))
      };

      const sanitizedTracker = sanitizeTrackerData(tempTracker);
      const syncedCharacters = sanitizedTracker.characters;
      syncCrossRelations(syncedCharacters);

      updateTrackerData({
        ...trackerData,
        characters: syncedCharacters,
        globalDefinitions: sanitizedTracker.globalDefinitions
      });
      alert("Character configuration saved successfully.");
      onClose();
    }
  };

  const isSyncedCard = targetChar.syncedCardAvatar && targetChar.syncedCardType === 'Card';

  return (
    <div className="rpg-modal-overlay">
      <div className="rpg-modal-container" onClick={(e) => e.stopPropagation()}>
        <header className="rpg-modal-header">
          {isEditingPreset ? (
            <div className={styles.headerNav} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="rpg-btn rpg-btn-sm"
                onClick={() => setPresetEditingTarget(null)}
              >
                Back
              </button>
              <span style={{ fontWeight: 'bold', color: 'var(--rpg-highlight)', fontSize: '14px' }}>
                Editing Card Preset: {liveName}
              </span>
            </div>
          ) : (
            <div className={styles.headerNav} style={{ flexWrap: 'wrap', gap: '6px' }}>
              <GearIcon size={20} style={{ marginRight: '2px', opacity: 0.8, flexShrink: 0 }} />
              <input
                type="text"
                className={styles.charNameInput}
                value={liveName}
                disabled={!!targetChar.syncedCardAvatar}
                onChange={e => setLocalCharacters(localCharacters.map(c => c.id === charId ? { ...c, name: e.target.value } : c))}
                style={{ width: '130px', flexShrink: 0 }}
                title={targetChar.syncedCardAvatar ? "Name is managed by SillyTavern Card Sync" : "Edit Name"}
              />

              <CardSyncComponent
                onSync={handleSyncCard}
                isSynced={!!targetChar.syncedCardAvatar}
              />

              {isSyncedCard && (
                <>
                  <button
                    type="button"
                    className="rpg-btn rpg-btn-sm"
                    onClick={handleOpenPresetEditor}
                  >
                    Edit Preset
                  </button>
                  <button
                    type="button"
                    className="rpg-btn rpg-btn-sm"
                    onClick={handleLoadPresetToActive}
                  >
                    Load Preset
                  </button>
                </>
              )}
            </div>
          )}
          <button className="rpg-modal-close-btn" onClick={isEditingPreset ? () => setPresetEditingTarget(null) : onClose}>×</button>
        </header>

        <div className="rpg-tab-nav">
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            Status
          </button>
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'relations' ? 'active' : ''}`}
            onClick={() => setActiveTab('relations')}
          >
            Relations
          </button>
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
        </div>

        <div className="rpg-modal-body">
          {activeTab === 'status' && (
            <StatusSpecsTab
              charId={currentEditingChar.id}
              targetChar={currentEditingChar}
              localCharacters={currentEditingList}
              setLocalCharacters={handleUpdateList}
              expandedIds={expandedIds}
              setExpandedIds={setExpandedIds}
              updateSchemaField={updateSchemaField}
              handleUpdateNestedField={handleUpdateNestedField}
            />
          )}
          {activeTab === 'relations' && (
            <RelationsTab
              charId={currentEditingChar.id}
              targetChar={currentEditingChar}
              localCharacters={currentEditingList}
              setLocalCharacters={handleUpdateList}
              expandedIds={expandedIds}
              setExpandedIds={setExpandedIds}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab
              charId={currentEditingChar.id}
              targetChar={currentEditingChar}
              localCharacters={currentEditingList}
              setLocalCharacters={handleUpdateList}
              expandedIds={expandedIds}
              setExpandedIds={setExpandedIds}
              handleUpdateNestedField={handleUpdateNestedField}
            />
          )}
        </div>

        <footer className="rpg-modal-footer">
          {isEditingPreset ? (
            <>
              <div className="rpg-modal-footer-left">
                <button className="rpg-modal-btn reset" onClick={handleResetCharacter}>Reset</button>
                <button className="rpg-modal-btn reset" onClick={handleDeletePresetFromCard}>Delete</button>
                <button className="rpg-modal-btn" onClick={handleLoadActiveToPreset}>Load</button>
              </div>
              <div className="rpg-modal-footer-right">
                <button className="rpg-modal-btn save" onClick={handleSavePresetToCard}>Save Preset to Card</button>
              </div>
            </>
          ) : (
            <>
              <div className="rpg-modal-footer-left">
                <button className="rpg-modal-btn reset" onClick={handleResetCharacter}>Reset</button>
                <button className="rpg-modal-btn reset" onClick={handleDeleteCharacter}>Delete</button>
              </div>
              <div className="rpg-modal-footer-right">
                <button className="rpg-modal-btn" onClick={handleExportCharacter}>Export</button>
                <label className="rpg-modal-btn" style={{ cursor: 'pointer' }}>
                  Import
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportCharacter} />
                </label>
                <button className="rpg-modal-btn save" onClick={handleSaveChanges}>Save</button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}