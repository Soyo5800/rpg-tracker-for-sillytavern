import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './CharListEditor.module.css';
import { DEFAULT_STATUS_SCHEMAS, DEFAULT_STATUS, getDefaultCharacters } from '../core/PromptSchema';
import { PresetSaveIcon, PresetLoadIcon, GearIcon } from '../Icons';

export default function CharListEditor({ onClose, onOpenStatusEditor }) {
  const { trackerData, updateTrackerData, settings, updateSettings } = useRPG();
  const [localCharacters, setLocalCharacters] = useState(() =>
    (trackerData.characters && trackerData.characters.length > 0)
      ? JSON.parse(JSON.stringify(trackerData.characters))
      : getDefaultCharacters()
  );
  
  const characters = localCharacters;
  const [showDropdown, setShowDropdown] = useState(false);
  const [packagedPresets, setPackagedPresets] = useState([]);

  const [currentPresetId, setCurrentPresetId] = useState(trackerData.currentPresetId || '');
  const [currentPresetName, setCurrentPresetName] = useState(trackerData.currentPresetName || 'New Preset');

  useEffect(() => {
    const loadPackagedPresets = async () => {
      try {
        const response = await fetch('/scripts/extensions/third-party/rpg-traker-sillytavern/presets.json');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setPackagedPresets(data.map(p => ({ ...p, type: 'file' })));
          }
        }
      } catch (err) {
        console.warn("[RPG Tracker] Default packaged presets config not found.");
      }
    };
    loadPackagedPresets();
  }, []);

  const safeSaveToLocalStorage = (id, data) => {
    try {
      localStorage.setItem(`rpg_tracker_preset_${id}`, JSON.stringify(data));
      return true;
    } catch (e) {
      alert("Browser local storage is full! Please delete old presets or export them as files.");
      return false;
    }
  };

  const getNextAvailableId = (existingIds) => {
    const usedNumbers = existingIds
      .map(id => {
        const match = id?.match(/^RT(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(num => num !== null && !isNaN(num));

    const numberSet = new Set(usedNumbers);
    let candidate = 1;
    while (numberSet.has(candidate)) {
      candidate++;
    }
    return `RT${candidate}`;
  };

  const handleUpdateCharacters = (newChars) => {
    setLocalCharacters(newChars);
  };

  const handleMove = (index, direction) => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= characters.length) return;

    const newChars = [...characters];
    const temp = newChars[index];
    newChars[index] = newChars[nextIdx];
    newChars[nextIdx] = temp;

    handleUpdateCharacters(newChars);
  };

  const handleNameChange = (id, newName) => {
    const cleanIdString = (name, prefix) => {
      if (!name) return `${prefix}_${Date.now()}`;
      const clean = name.replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      return clean ? `${prefix}_${clean}` : `${prefix}_${Date.now()}`;
    };

    const cleanId = newName === 'New' && id === 'char_user' ? 'char_user' : cleanIdString(newName, 'char');

    const newChars = characters.map(c => {
      if (c.id === id) {
        return { ...c, id: cleanId, name: newName };
      }
      return c;
    });
    handleUpdateCharacters(newChars);
  };

  const handleDelete = (id) => {
    if (characters.length <= 1) {
      alert("At least one character must remain in the list.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this character?")) {
      const newChars = characters.filter(c => c.id !== id);
      handleUpdateCharacters(newChars);
    }
  };

  const handleAddCharacter = () => {
    const existingIds = characters.map(c => c.id);
    const newId = getNextAvailableId(existingIds);
    const newChar = {
      id: newId,
      name: "New Character",
      activePlayer: false,
      activeInjection: true,
      statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
      status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
      relations: {}
    };

    let newChars;
    if (characters.length === 1 && characters[0].id === 'char_user' && characters[0].name === 'New') {
      newChars = [newChar];
    } else {
      newChars = [...characters, newChar];
    }
    handleUpdateCharacters(newChars);
  };

  const handleSavePreset = () => {
    if (!currentPresetName.trim()) {
      alert("Please enter a preset name.");
      return;
    }

    const currentPresets = settings.presets || [];
    let duplicate = null;

    if (currentPresetId) {
      duplicate = currentPresets.find(p => p.id === currentPresetId);
    }
    if (!duplicate) {
      duplicate = currentPresets.find(p => p.name === currentPresetName);
    }

    if (duplicate) {
      if (!window.confirm(`Preset "${currentPresetName}" already exists. Overwrite?`)) {
        return;
      }
    }

    let newPresets;
    let savedId = currentPresetId;
    const presetData = JSON.parse(JSON.stringify(characters));

    if (duplicate) {
      savedId = duplicate.id;
      if (!safeSaveToLocalStorage(savedId, presetData)) return;
      
      newPresets = currentPresets.map(p =>
        p.id === duplicate.id ? { id: p.id, name: currentPresetName, type: 'cache' } : p
      );
    } else {
      savedId = getNextAvailableId(currentPresets.map(p => p.id));
      if (!safeSaveToLocalStorage(savedId, presetData)) return;
      
      newPresets = [...currentPresets, { id: savedId, name: currentPresetName, type: 'cache' }];
    }

    updateSettings({ presets: newPresets });

    setCurrentPresetId(savedId);
    updateTrackerData({
      ...trackerData,
      currentPresetId: savedId,
      currentPresetName: currentPresetName,
      characters: characters
    });

    alert(`Preset "${currentPresetName}" saved!`);
  };

  const handleLoadPreset = async (target) => {
    let preset = typeof target === 'object' ? target : null;

    const allPresets = [
      ...packagedPresets,
      ...(settings.presets || []).map(p => ({
        ...p,
        type: p.type || (p.file ? 'file' : (p.data ? 'legacy' : 'cache'))
      }))
    ];

    if (!preset) {
      preset = allPresets.find(p => p.id === target);
    }

    if (!preset) {
      console.warn("[RPG Tracker] Target preset not found.");
      return;
    }

    if (window.confirm(`Are you sure you want to load preset "${preset.name}"? This will overwrite your current characters.`)) {
      try {
        let loadedChars = null;

        if (preset.data) {
          loadedChars = JSON.parse(JSON.stringify(preset.data));
          if (!safeSaveToLocalStorage(preset.id, loadedChars)) return;
          
          const currentPresets = settings.presets || [];
          const updatedPresets = currentPresets.map(p => {
            if (p.id === preset.id) {
              const { data, ...rest } = p;
              return { ...rest, type: 'cache' };
            }
            return p;
          });
          updateSettings({ presets: updatedPresets });

        } else if (preset.type === 'cache' || preset.type === 'local' || preset.type === 'legacy') {
          const localDataStr = localStorage.getItem(`rpg_tracker_preset_${preset.id}`);
          if (localDataStr) {
            loadedChars = JSON.parse(localDataStr);
          } else {
            alert("Preset data not found in browser cache.");
            return;
          }
        } else if (preset.type === 'file' || preset.type === 'server') {
          const fileName = preset.file || `${preset.id}.json`;
          const response = await fetch(`/scripts/extensions/third-party/rpg-traker-sillytavern/presets/${fileName}`);
          if (response.ok) {
            loadedChars = await response.json();
          } else {
            alert(`Failed to load preset file from server: ${fileName}`);
            return;
          }
        }

        if (Array.isArray(loadedChars)) {
          setCurrentPresetId(preset.id);
          setCurrentPresetName(preset.name);
          setLocalCharacters(loadedChars);
          setShowDropdown(false);
        } else {
          alert("Invalid preset structure.");
        }
      } catch (err) {
        console.error("[RPG Tracker] Preset load error:", err);
        alert("An error occurred while loading this preset.");
      }
    }
  };

  // 단독 다이렉트 삭제 및 자동 대체(Fallback) 처리기
  const handleDeletePresetById = (presetId, presetName, e) => {
    if (e) {
      e.stopPropagation(); // 클릭 전파를 막아 뒤에 있는 로드 트리거를 차단
    }

    if (window.confirm(`Are you sure you want to delete preset "${presetName}"?`)) {
      localStorage.removeItem(`rpg_tracker_preset_${presetId}`);

      const currentPresets = settings.presets || [];
      const newPresets = currentPresets.filter(p => p.id !== presetId);
      updateSettings({ presets: newPresets });

      // 삭제한 프리셋이 현재 활성 상태인 경우의 대응 처리
      if (currentPresetId === presetId) {
        if (newPresets.length === 0) {
          // 남은 대안 프리셋이 아예 없는 경우 완전히 초기화
          const defaultChars = getDefaultCharacters();
          setCurrentPresetId('');
          setCurrentPresetName('New Preset');
          setLocalCharacters(defaultChars);
        } else {
          // 남은 캐시 목록 중 최상단 프리셋을 즉시 대체 로드
          const fallbackPreset = newPresets[0];
          handleLoadPreset(fallbackPreset);
        }
      }
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm("Reset character list to default?")) {
      setLocalCharacters(getDefaultCharacters());
      setCurrentPresetId('');
      setCurrentPresetName('New Preset');
    }
  };

  const handleImportLocalFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          const importedName = file.name.replace(/\.[^/.]+$/, "");
          const currentPresets = settings.presets || [];
          
          const newPresetId = getNextAvailableId(currentPresets.map(p => p.id));
          const newPresetItem = {
            id: newPresetId,
            name: importedName,
            type: 'cache'
          };

          if (!safeSaveToLocalStorage(newPresetId, importedData)) return;

          const updatedPresets = [...currentPresets, newPresetItem];
          updateSettings({ presets: updatedPresets });

          setLocalCharacters(importedData);
          setCurrentPresetName(importedName);
          setCurrentPresetId(newPresetId);
          
          alert(`Preset "${importedName}" imported and saved to browser cache.`);
        } else {
          alert("Invalid character list structure.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportLocalFile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localCharacters, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const fileName = `${currentPresetName.trim().replace(/[/\\?%*:|"<>. ]/g, '_') || 'rpg_preset'}.json`;
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleGlobalSave = () => {
    const names = characters.map(c => c.name.trim());
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

    updateTrackerData({
      ...trackerData,
      currentPresetId,
      currentPresetName,
      characters: characters
    });

    alert("Character list applied to active session!");
    onClose();
  };

  const totalPresets = [
    ...packagedPresets,
    ...(settings.presets || []).map(p => ({
      ...p,
      type: p.type || (p.file ? 'file' : (p.data ? 'legacy' : 'cache'))
    }))
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <h4>Character List</h4>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

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
                {totalPresets.length === 0 ? (
                  <div className={styles.presetDropdownEmpty}>No presets saved.</div>
                ) : (
                  totalPresets.map(preset => {
                    const presetType = preset.type === 'file' || preset.type === 'server' ? 'File' : 'Cache';
                    const isDeletable = preset.type !== 'file' && preset.type !== 'server';
                    return (
                      <div key={preset.id} className={styles.presetDropdownItem}>
                        {/* 왼쪽: 로드 클릭 구역 */}
                        <div className={styles.presetDropdownItemLoadArea} onClick={() => handleLoadPreset(preset)}>
                          <span className={styles.presetItemName}>{preset.name}</span>
                          <div className={styles.presetItemBadges}>
                            <span className={styles.charIdBadge} style={{ transform: 'scale(0.85)', margin: 0, flexShrink: 0 }}>
                              {presetType}
                            </span>
                            <span className={styles.charIdBadge} style={{ transform: 'scale(0.85)', margin: 0, flexShrink: 0, opacity: 0.6 }}>
                              {preset.id}
                            </span>
                          </div>
                        </div>
                        {/* 오른쪽: 캐시 프리셋 개별 삭제 단추 */}
                        {isDeletable && (
                          <button
                            type="button"
                            className={styles.presetItemDeleteBtn}
                            title="Delete Preset"
                            onClick={(e) => handleDeletePresetById(preset.id, preset.name, e)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            title="Save Preset"
            onClick={handleSavePreset}
          >
            <PresetSaveIcon />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Load Preset"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <PresetLoadIcon />
          </button>
        </div>

        <div className={styles.body}>
          {characters.map((char, index) => (
            <div key={char.id} className={styles.charItem}>
              <div className={styles.dragControls}>
                <button type="button" disabled={index === 0} onClick={() => handleMove(index, 'up')}>▲</button>
                <button type="button" disabled={index === characters.length - 1} onClick={() => handleMove(index, 'down')}>▼</button>
              </div>
              <input
                type="text"
                className={styles.nameInput}
                value={char.name}
                onChange={(e) => handleNameChange(char.id, e.target.value)}
              />
              <div className={styles.actions} style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Edit Character"
                  onClick={() => onOpenStatusEditor(char.id)}
                >
                  <GearIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.deleteBtn}`}
                  title="Delete Character"
                  onClick={() => handleDelete(char.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button className={styles.addBtn} onClick={handleAddCharacter}>+ Add Character</button>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            <button type="button" className={`${styles.footerBtn} ${styles.reset}`} onClick={handleResetToDefault}>
              Reset
            </button>
          </div>
          
          <input 
            type="file" 
            id="hidden-preset-file-picker" 
            accept=".json" 
            style={{ display: 'none' }} 
            onChange={handleImportLocalFile} 
          />

          <div className={styles.footerRight}>
            <button type="button" className={styles.footerBtn} onClick={handleExportLocalFile}>
              Export
            </button>
            <button 
              type="button" 
              className={styles.footerBtn} 
              style={{ margin: '0 6px' }}
              onClick={() => document.getElementById('hidden-preset-file-picker').click()}
            >
              Import
            </button>
            <button type="button" className={`${styles.footerBtn} ${styles.save}`} onClick={handleGlobalSave}>
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}