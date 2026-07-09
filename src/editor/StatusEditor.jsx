// src/editor/StatusEditor.jsx
import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './StatusEditor.module.css';
import { sanitizeTrackerData, syncCrossRelations } from '../core/JSONTracker';
import { setNestedValue } from '../core/StateHelpers';
import { GearIcon } from '../Icons';
import { DEFAULT_STATUS_SCHEMAS, DEFAULT_STATUS, getDefaultCharacters } from '../core/PromptSchema';

import StatusSpecsTab from './StatusSpecsTab';
import RelationsTab from './RelationsTab';
import InventoryTab from './InventoryTab';

export default function StatusEditor({ charId, initialTab = 'status', onClose, characters, onUpdateCharacters }) {
  const { trackerData, updateTrackerData } = useRPG();
  const [localCharacters, setLocalCharacters] = useState(() => {
    const getActiveCharacters = () => {
      if (trackerData.characters && trackerData.characters.length > 0) return trackerData.characters;
      if (characters && characters.length > 0) return characters;
      return getDefaultCharacters();
    };
    return JSON.parse(JSON.stringify(getActiveCharacters()));
  });

  const [expandedIds, setExpandedIds] = useState({});
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const getActiveCharacters = () => {
      if (trackerData.characters && trackerData.characters.length > 0) return trackerData.characters;
      if (characters && characters.length > 0) return characters;
      return getDefaultCharacters();
    };
    setLocalCharacters(JSON.parse(JSON.stringify(getActiveCharacters())));
  }, [trackerData.characters, characters]);

  const handleUpdateNestedField = (group, key, val) => {
    setLocalCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c;
      const path = key === null ? [group] : [group, key];
      return setNestedValue(c, path, val);
    }));
  };

  const updateSchemaField = (id, key, val) => {
    setLocalCharacters(localCharacters.map(c =>
      c.id === charId
        ? { ...c, statusSchema: (c.statusSchema || []).map(s => s.id === id ? { ...s, [key]: val } : s) }
        : c
    ));
  };

  const handleAddCharacter = () => {
    const name = "New Character";
    const newChar = {
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name,
      activePlayer: false,
      activeInjection: true,
      statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
      status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
      relations: {}
    };

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

  if (!charId) {
    return (
      <button type="button" className={styles.addCharMainBtn} onClick={handleAddCharacter}>
        + Add Character
      </button>
    );
  }

  const targetChar = localCharacters.find(c => c.id === charId);
  if (!targetChar) return null;

  const handleResetCharacter = () => {
    if (window.confirm("Are you sure you want to reset this character to its default state?")) {
      setLocalCharacters(localCharacters.map(c => {
        if (c.id !== charId) return c;
        const defaultChar = getDefaultCharacters()[0];
        if (c.activePlayer) {
          return { ...defaultChar, id: c.id, name: c.name };
        } else {
          return {
            id: c.id, name: c.name, activePlayer: false, activeInjection: true,
            statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
            status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
            relations: {}, profile: { Race: '', Height: '', Appearance: '' },
            profileLocks: {}, profileInjects: {}
          };
        }
      }));
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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetChar, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${targetChar.name}_export.json`);
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
          setLocalCharacters(localCharacters.map(c =>
            c.id === charId ? {
              ...(() => {
                const tempTracker = { characters: [importedData] };
                const sanitizedTemp = sanitizeTrackerData(tempTracker);
                return sanitizedTemp.characters[0];
              })(), id: charId
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
      const tempTracker = {
        characters: JSON.parse(JSON.stringify(localCharacters)),
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

  return (
    <div className={styles.editorOverlay}>
      <div className={styles.editorModal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.editorHeader}>
          <div className={styles.headerNav}>
            <GearIcon size={20} style={{ marginRight: '8px', opacity: 0.8 }} />
            <input
              type="text"
              className={styles.charNameInput}
              value={targetChar.name}
              onChange={e => setLocalCharacters(localCharacters.map(c => c.id === charId ? { ...c, name: e.target.value } : c))}
            />
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.editorTabs}>
          <button type="button" className={`${styles.tabBtn} ${activeTab === 'status' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('status')}>Status</button>
          <button type="button" className={`${styles.tabBtn} ${activeTab === 'relations' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('relations')}>Relations</button>
          <button type="button" className={`${styles.tabBtn} ${activeTab === 'inventory' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('inventory')}>Inventory</button>
        </div>

        <div className={styles.editorBody}>
          {activeTab === 'status' && (
            <StatusSpecsTab
              charId={charId} targetChar={targetChar} localCharacters={localCharacters}
              setLocalCharacters={setLocalCharacters} expandedIds={expandedIds} setExpandedIds={setExpandedIds}
              updateSchemaField={updateSchemaField} handleUpdateNestedField={handleUpdateNestedField}
            />
          )}
          {activeTab === 'relations' && (
            <RelationsTab
              charId={charId} targetChar={targetChar} localCharacters={localCharacters}
              setLocalCharacters={setLocalCharacters} expandedIds={expandedIds} setExpandedIds={setExpandedIds}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab
              charId={charId} targetChar={targetChar} localCharacters={localCharacters}
              setLocalCharacters={setLocalCharacters} expandedIds={expandedIds} setExpandedIds={setExpandedIds}
              handleUpdateNestedField={handleUpdateNestedField}
            />
          )}
        </div>

        <footer className={styles.editorFooter}>
          <div className={styles.footerLeft}>
            <button className={`${styles.footerBtn} ${styles.reset}`} onClick={handleResetCharacter}>Reset</button>
            <button className={`${styles.footerBtn} ${styles.reset}`} style={{ marginLeft: '6px' }} onClick={handleDeleteCharacter}>Delete</button>
          </div>
          <div className={styles.footerRight}>
            <button className={styles.footerBtn} onClick={handleExportCharacter}>Export</button>
            <label className={styles.footerBtn} style={{ cursor: 'pointer', margin: '0 6px' }}>
              Import
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportCharacter} />
            </label>
            <button className={`${styles.footerBtn} ${styles.save}`} onClick={handleSaveChanges}>Save</button>
          </div>
        </footer>
      </div>
    </div>
  );
}