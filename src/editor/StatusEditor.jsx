import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './StatusEditor.module.css';
import {
  sanitizeTrackerData,
  syncCrossRelations,
  migrateCharacterSchema,
  isBase64Image
} from '../core/JSONTracker';
import { setNestedValue, deepClone } from '../core/StateHelpers';
import { GearIcon } from '../Icons';
import { DEFAULT_STATUS_SCHEMAS, DEFAULT_STATUS, DEFAULT_PROFILE, DEFAULT_PROFILE_LOCKS, getDefaultCharacters } from '../core/PromptSchema';
import { resolveSillyTavernAvatarUrl, buildCharacterSpriteUrl, normalizeCropOffset, extractVisualMetadata } from '../core/AvatarResolver';

import StatusSpecsTab from './StatusSpecsTab';
import RelationsTab from './RelationsTab';
import InventoryTab from './InventoryTab';

import CardSyncComponent, { savePresetToSillyTavernCard } from './CardSyncComponent';
import ModalLayout from '../ModalLayout';

function extractRawCardPreset(matchedCard) {

  if (!matchedCard || typeof matchedCard !== 'object') return null;

  const raw = matchedCard.data?.extensions?.rpg_tracker
    || matchedCard.extensions?.rpg_tracker
    || null;

  if (!raw || typeof raw !== 'object') return null;

  if (Array.isArray(raw.characters) && raw.characters.length > 0) {
    return raw.characters[0];
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw[0];
  }

  return raw;
}

export default function StatusEditor({ charId, initialTab = 'status', onClose }) {
  const {
    trackerData,
    updateTrackerData,
    syncCharacterToCard,
    removeCharacterSync,
    updateCustomAvatar
  } = useRPG();

  const [localCharacters, setLocalCharacters] = useState(() => {
    const activeChars = trackerData.characters && trackerData.characters.length > 0
      ? trackerData.characters
      : getDefaultCharacters();
    return deepClone(activeChars);
  });

  const [localGlobalDefs, setLocalGlobalDefs] = useState(() =>
    trackerData.globalDefinitions ? deepClone(trackerData.globalDefinitions) : {}
  );

  const [expandedIds, setExpandedIds] = useState({});
  const [activeTab, setActiveTab] = useState(initialTab);
  const [presetEditingTarget, setPresetEditingTarget] = useState(null);
  const [pendingAvatarUpdate, setPendingAvatarUpdate] = useState(undefined);
  const [pendingCardSync, setPendingCardSync] = useState(undefined);

  useEffect(() => {
    const getActiveCharacters = () => {
      if (trackerData.characters && trackerData.characters.length > 0) return trackerData.characters;
      return getDefaultCharacters();
    };
    setLocalCharacters(deepClone(getActiveCharacters()));
    setLocalGlobalDefs(trackerData.globalDefinitions ? JSON.parse(JSON.stringify(trackerData.globalDefinitions)) : {});
    setPendingAvatarUpdate(undefined);
    setPendingCardSync(undefined);
  }, [charId]);

  const targetChar = localCharacters.find(c => c.id === charId);

  if (!charId || !targetChar) {
    return null;
  }

  const context = window.SillyTavern?.getContext?.();

  let liveName = targetChar.name || '';
  let liveAvatarUrl = targetChar.avatarUrl || '';

  if (isBase64Image(liveAvatarUrl)) {
    liveAvatarUrl = '';
  }

  if (targetChar.assetName) {
    liveAvatarUrl = buildCharacterSpriteUrl(targetChar.assetName, targetChar.selectedSprite, targetChar.isFolder);
  }

  if (context) {
    if (targetChar.syncedCardType === 'Persona') {
      liveName = context.name1 || window.name1 || targetChar.name;
      if (!liveAvatarUrl) {
        const userAvatarFile = context.user_avatar || window.user_avatar || null;
        liveAvatarUrl = resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona');
      }
    } else if (targetChar.syncedCardAvatar && targetChar.syncedCardType === 'Card') {
      const allChars = Array.isArray(context.characters)
        ? context.characters
        : (Array.isArray(window.characters) ? window.characters : []);
      const matched = allChars.find(c => c.avatar === targetChar.syncedCardAvatar);
      if (matched) {
        liveName = matched.name;
        if (!liveAvatarUrl) {
          liveAvatarUrl = resolveSillyTavernAvatarUrl(matched.avatar, 'Card');
        }
      } else if (!liveAvatarUrl) {
        liveAvatarUrl = resolveSillyTavernAvatarUrl(targetChar.syncedCardAvatar, 'Card');
      }
    }
  }

  const isEditingPreset = presetEditingTarget !== null;
  const currentEditingChar = isEditingPreset ? presetEditingTarget : targetChar;
  const currentEditingList = isEditingPreset ? [presetEditingTarget] : localCharacters;

  const handleRenameFieldInDefs = (category, oldKey, newKey) => {
    if (!oldKey || !newKey || oldKey === newKey) return;
    const oldFullKey = `${category}_${oldKey}`;
    const newFullKey = `${category}_${newKey}`;

    setLocalGlobalDefs(prev => {
      if (!prev || prev[oldFullKey] === undefined) return prev;
      const next = { ...prev };
      next[newFullKey] = next[oldFullKey];
      delete next[oldFullKey];
      return next;
    });
  };

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

  const handleSyncCard = (target) => {
    setLocalCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c;

      if (target.type === 'Unsync') {
        return {
          ...c,
          syncedCardAvatar: null,
          syncedCardType: null,
          avatarUrl: c.assetName ? buildCharacterSpriteUrl(c.assetName, c.selectedSprite, c.isFolder) : null
        };
      }

      const cardPreset = target.preset || null;
      const hasPresetVisual = Boolean(cardPreset && (cardPreset.assetName || cardPreset.isFolder !== undefined));
      const isCardChanged = c.syncedCardAvatar !== target.avatarFile;

      const effectiveAssetName = hasPresetVisual
        ? cardPreset.assetName
        : (isCardChanged ? target.avatarFile : (c.assetName || target.avatarFile));
      const effectiveIsFolder = hasPresetVisual
        ? Boolean(cardPreset.isFolder)
        : (isCardChanged ? false : (c.isFolder !== undefined ? c.isFolder : false));
      const effectiveSelectedSprite = hasPresetVisual
        ? (cardPreset.selectedSprite || null)
        : (isCardChanged ? null : c.selectedSprite);
      const effectiveAvailableSprites = hasPresetVisual
        ? (Array.isArray(cardPreset.availableSprites) ? cardPreset.availableSprites : [])
        : (isCardChanged ? [] : (c.availableSprites || []));
      const effectiveEnableExpression = hasPresetVisual
        ? Boolean(cardPreset.enableExpression)
        : (isCardChanged ? false : Boolean(c.enableExpression));
      const effectiveCropOffset = hasPresetVisual && cardPreset.cropOffset
        ? normalizeCropOffset(cardPreset.cropOffset)
        : (c.cropOffset ? normalizeCropOffset(c.cropOffset) : { x: 50, y: 50, zoom: 1 });
      const effectiveViewportScale = hasPresetVisual && cardPreset.viewportScale !== undefined
        ? Math.min(100, Math.max(20, cardPreset.viewportScale))
        : (c.viewportScale ?? 100);
      const effectiveViewportOpacity = hasPresetVisual && cardPreset.viewportOpacity !== undefined
        ? Math.min(1.0, Math.max(0.1, cardPreset.viewportOpacity))
        : (c.viewportOpacity ?? 0.95);

      const effectiveAvatarUrl = effectiveAssetName
        ? buildCharacterSpriteUrl(effectiveAssetName, effectiveSelectedSprite, effectiveIsFolder)
        : (target.avatarUrl || resolveSillyTavernAvatarUrl(target.avatarFile, target.type));

      return {
        ...c,
        name: target.name,
        avatarUrl: effectiveAvatarUrl,
        syncedCardAvatar: target.avatarFile || null,
        syncedCardType: target.type,
        assetName: effectiveAssetName,
        isFolder: effectiveIsFolder,
        selectedSprite: effectiveSelectedSprite,
        availableSprites: effectiveAvailableSprites,
        enableExpression: effectiveEnableExpression,
        cropOffset: effectiveCropOffset,
        viewportScale: effectiveViewportScale,
        viewportOpacity: effectiveViewportOpacity
      };
    }));

    setPendingCardSync(target);

    if (target.type === 'Unsync') {
      alert("Card synchronization removed. Click 'Save' to apply changes.");
    } else {
      alert(`Card "${target.name}" linked. Click 'Save' to apply changes.`);
    }
  };

  const handleLoadPresetToActive = () => {
    const syncedAvatar = targetChar.syncedCardAvatar;
    const allChars = Array.isArray(context?.characters)
      ? context.characters
      : (Array.isArray(window.characters) ? window.characters : []);
    const matchedCard = allChars.find(c => c.avatar === syncedAvatar);

    if (!matchedCard) {
      alert("Could not load the synchronized SillyTavern card asset. Please verify card connection.");
      return;
    }

    const rawPreset = extractRawCardPreset(matchedCard);
    if (!rawPreset) {
      alert("No preset data found inside this card. You can edit and save a preset first.");
      return;
    }

    if (window.confirm(`Load preset template of "${liveName}" into active session? Current turn edits will be overwritten.`)) {
      const cardPreset = migrateCharacterSchema(JSON.parse(JSON.stringify(rawPreset)));
      const visualMeta = extractVisualMetadata(cardPreset, targetChar);

      let nextAvatarUrl = null;
      if (visualMeta.assetName) {
        nextAvatarUrl = buildCharacterSpriteUrl(visualMeta.assetName, visualMeta.selectedSprite, visualMeta.isFolder);
      } else if (targetChar.syncedCardAvatar) {
        nextAvatarUrl = resolveSillyTavernAvatarUrl(targetChar.syncedCardAvatar, targetChar.syncedCardType || 'Card');
      }

      setLocalCharacters(localCharacters.map(c => {
        if (c.id !== charId) return c;
        return {
          ...c,
          statusSchema: JSON.parse(JSON.stringify(cardPreset.statusSchema || DEFAULT_STATUS_SCHEMAS)),
          status: JSON.parse(JSON.stringify(cardPreset.status || DEFAULT_STATUS)),
          profile: JSON.parse(JSON.stringify(cardPreset.profile || (c.activePlayer ? DEFAULT_PROFILE : {}))),
          inventory: JSON.parse(JSON.stringify(cardPreset.inventory || (c.activePlayer ? {
            equipIsLocked: false,
            equipIsInject: true,
            storageIsLocked: false,
            storageIsInject: true,
            equipmentLocks: {},
            storageLocks: {},
            equipment: { 'Right Hand': null, 'Left Hand': null },
            storage: { 'Backpack': [] }
          } : {
            equipIsLocked: false,
            equipIsInject: false,
            storageIsLocked: false,
            storageIsInject: false,
            equipmentLocks: {},
            storageLocks: {},
            equipment: {},
            storage: {}
          }))),
          quests: JSON.parse(JSON.stringify(cardPreset.quests || { main: { name: '', desc: '' }, sides: [] })),
          relations: JSON.parse(JSON.stringify(cardPreset.relations || {})),
          ...visualMeta,
          avatarUrl: nextAvatarUrl
        };
      }));

      setPendingAvatarUpdate(visualMeta);

      alert("Preset template loaded into editor. Click 'Save' to apply to the active session.");
    }
  };

  const handleLoadActiveToPreset = () => {
    if (window.confirm("Copy active session values into this preset editor? Unsaved working preset edits will be replaced.")) {
      const visualMeta = extractVisualMetadata(targetChar);

      setPresetEditingTarget(prev => ({
        ...prev,
        statusSchema: JSON.parse(JSON.stringify(targetChar.statusSchema || DEFAULT_STATUS_SCHEMAS)),
        status: JSON.parse(JSON.stringify(targetChar.status || DEFAULT_STATUS)),
        profile: JSON.parse(JSON.stringify(targetChar.profile || {})),
        inventory: JSON.parse(JSON.stringify(targetChar.inventory || (targetChar.activePlayer ? {
          equipIsLocked: false,
          equipIsInject: true,
          storageIsLocked: false,
          storageIsInject: true,
          equipmentLocks: {},
          storageLocks: {},
          equipment: { 'Right Hand': null, 'Left Hand': null },
          storage: { 'Backpack': [] }
        } : {
          equipIsLocked: false,
          equipIsInject: false,
          storageIsLocked: false,
          storageIsInject: false,
          equipmentLocks: {},
          storageLocks: {},
          equipment: {},
          storage: {}
        }))),
        quests: JSON.parse(JSON.stringify(targetChar.quests || { main: { name: '', desc: '' }, sides: [] })),
        relations: JSON.parse(JSON.stringify(targetChar.relations || {})),
        ...visualMeta
      }));
      alert("Active session values copied to preset editor. Click 'Save Preset to Card' to persist changes.");
    }
  };

  const handleOpenPresetEditor = () => {
    const syncedAvatar = targetChar.syncedCardAvatar;
    const allChars = Array.isArray(context?.characters)
      ? context.characters
      : (Array.isArray(window.characters) ? window.characters : []);
    const matchedCard = allChars.find(c => c.avatar === syncedAvatar);

    if (!matchedCard) {
      alert("Could not load the synchronized SillyTavern card asset. Please verify card connection.");
      return;
    }

    const rawPresetData = extractRawCardPreset(matchedCard) || {};
    const presetData = migrateCharacterSchema(JSON.parse(JSON.stringify(rawPresetData)));
    const visualMeta = extractVisualMetadata(presetData, targetChar);

    const virtualPresetChar = {
      id: `preset_${syncedAvatar}`,
      name: `${matchedCard.name}`,
      activePlayer: targetChar.activePlayer,
      statusSchema: presetData.statusSchema || JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
      status: presetData.status || JSON.parse(JSON.stringify(DEFAULT_STATUS)),
      profile: presetData.profile || (targetChar.activePlayer ? JSON.parse(JSON.stringify(DEFAULT_PROFILE)) : {}),
      inventory: presetData.inventory || (targetChar.activePlayer ? {
        equipIsLocked: false,
        equipIsInject: true,
        storageIsLocked: false,
        storageIsInject: true,
        equipmentLocks: {},
        storageLocks: {},
        equipment: { 'Right Hand': null, 'Left Hand': null },
        storage: { 'Backpack': [] }
      } : {
        equipIsLocked: false,
        equipIsInject: false,
        storageIsLocked: false,
        storageIsInject: false,
        equipmentLocks: {},
        storageLocks: {},
        equipment: {},
        storage: {}
      }),
      quests: presetData.quests || { main: { name: '', desc: '' }, sides: [] },
      relations: presetData.relations || {},
      ...visualMeta
    };

    setPresetEditingTarget(virtualPresetChar);
  };

  const handleResetCharacter = () => {
    if (isEditingPreset) {
      const syncedAvatar = targetChar.syncedCardAvatar;
      const allChars = Array.isArray(context?.characters)
        ? context.characters
        : (Array.isArray(window.characters) ? window.characters : []);
      const matchedCard = allChars.find(c => c.avatar === syncedAvatar);

      if (!matchedCard) {
        alert("Could not load the synchronized SillyTavern card asset. Please verify card connection.");
        return;
      }

      if (window.confirm("Revert unsaved preset changes and reload the last saved preset from the card?")) {
        const rawPresetData = extractRawCardPreset(matchedCard) || {};
        const presetData = migrateCharacterSchema(JSON.parse(JSON.stringify(rawPresetData)));
        const visualMeta = extractVisualMetadata(presetData, targetChar);

        setPresetEditingTarget(prev => ({
          ...prev,
          statusSchema: JSON.parse(JSON.stringify(presetData.statusSchema || DEFAULT_STATUS_SCHEMAS)),
          status: JSON.parse(JSON.stringify(presetData.status || DEFAULT_STATUS)),
          profile: JSON.parse(JSON.stringify(presetData.profile || (targetChar.activePlayer ? DEFAULT_PROFILE : {}))),
          inventory: JSON.parse(JSON.stringify(presetData.inventory || (targetChar.activePlayer ? {
            equipIsLocked: false,
            equipIsInject: true,
            storageIsLocked: false,
            storageIsInject: true,
            equipmentLocks: {},
            storageLocks: {},
            equipment: { 'Right Hand': null, 'Left Hand': null },
            storage: { 'Backpack': [] }
          } : {
            equipIsLocked: false,
            equipIsInject: false,
            storageIsLocked: false,
            storageIsInject: false,
            equipmentLocks: {},
            storageLocks: {},
            equipment: {},
            storage: {}
          }))),
          quests: JSON.parse(JSON.stringify(presetData.quests || { main: { name: '', desc: '' }, sides: [] })),
          relations: JSON.parse(JSON.stringify(presetData.relations || {})),
          ...visualMeta
        }));
      }
    } else {
      const allChars = Array.isArray(context?.characters)
        ? context.characters
        : (Array.isArray(window.characters) ? window.characters : []);
      const matchedCard = allChars.find(c => c.avatar === targetChar.syncedCardAvatar);
      const rawCardPreset = extractRawCardPreset(matchedCard);
      const cardPreset = rawCardPreset ? migrateCharacterSchema(JSON.parse(JSON.stringify(rawCardPreset))) : null;

      const confirmMessage = cardPreset
        ? `Reset "${liveName}" to the synchronized card preset template?`
        : `Reset "${liveName}" to default factory schema?`;

      if (window.confirm(confirmMessage)) {
        setLocalCharacters(localCharacters.map(c => {
          if (c.id !== charId) return c;

          if (cardPreset) {
            const visualMeta = extractVisualMetadata(cardPreset, c);
            let nextAvatarUrl = null;
            if (visualMeta.assetName) {
              nextAvatarUrl = buildCharacterSpriteUrl(visualMeta.assetName, visualMeta.selectedSprite, visualMeta.isFolder);
            } else if (c.syncedCardAvatar) {
              nextAvatarUrl = resolveSillyTavernAvatarUrl(c.syncedCardAvatar, c.syncedCardType || 'Card');
            }

            setPendingAvatarUpdate(visualMeta);

            return {
              ...c,
              statusSchema: JSON.parse(JSON.stringify(cardPreset.statusSchema || DEFAULT_STATUS_SCHEMAS)),
              status: JSON.parse(JSON.stringify(cardPreset.status || DEFAULT_STATUS)),
              profile: JSON.parse(JSON.stringify(cardPreset.profile || (c.activePlayer ? DEFAULT_PROFILE : {}))),
              inventory: JSON.parse(JSON.stringify(cardPreset.inventory || (c.activePlayer ? {
                equipIsLocked: false,
                equipIsInject: true,
                storageIsLocked: false,
                storageIsInject: true,
                equipmentLocks: {},
                storageLocks: {},
                equipment: { 'Right Hand': null, 'Left Hand': null },
                storage: { 'Backpack': [] }
              } : {
                equipIsLocked: false,
                equipIsInject: false,
                storageIsLocked: false,
                storageIsInject: false,
                equipmentLocks: {},
                storageLocks: {},
                equipment: {},
                storage: {}
              }))),
              quests: JSON.parse(JSON.stringify(cardPreset.quests || { main: { name: '', desc: '' }, sides: [] })),
              relations: JSON.parse(JSON.stringify(cardPreset.relations || {})),
              ...visualMeta,
              avatarUrl: nextAvatarUrl
            };
          }

          setPendingAvatarUpdate(null);

          let defaultAvatarUrl = null;
          if (c.syncedCardAvatar) {
            defaultAvatarUrl = resolveSillyTavernAvatarUrl(c.syncedCardAvatar, c.syncedCardType || 'Card');
          }

          return {
            ...c,
            statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
            status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
            profile: JSON.parse(JSON.stringify(c.activePlayer ? DEFAULT_PROFILE : {})),
            profileLocks: JSON.parse(JSON.stringify(c.activePlayer ? DEFAULT_PROFILE_LOCKS : {})),
            profileInjects: {},
            inventory: c.activePlayer ? {
              equipIsLocked: false,
              equipIsInject: true,
              storageIsLocked: false,
              storageIsInject: true,
              equipmentLocks: {},
              storageLocks: {},
              equipment: { 'Right Hand': null, 'Left Hand': null },
              storage: { 'Backpack': [] }
            } : {
              equipIsLocked: false,
              equipIsInject: false,
              storageIsLocked: false,
              storageIsInject: false,
              equipmentLocks: {},
              storageLocks: {},
              equipment: {},
              storage: {}
            },
            quests: { main: { name: '', desc: '' }, sides: [] },
            relations: {},
            assetName: null,
            isFolder: true,
            enableExpression: false,
            selectedSprite: null,
            availableSprites: [],
            cropOffset: { x: 50, y: 50, zoom: 1 },
            viewportScale: 100,
            viewportOpacity: 0.95,
            avatarUrl: defaultAvatarUrl
          };
        }));
      }
    }
  };

  const handleDeletePresetFromCard = async () => {
    if (window.confirm("Permanently delete custom preset metadata from this card file?\nThis action cannot be undone.")) {
      const success = await savePresetToSillyTavernCard(targetChar.syncedCardAvatar, null);
      if (success) {
        alert("Card preset cleared successfully.");
        if (updateCustomAvatar) {
          updateCustomAvatar(charId, null);
        }

        setLocalCharacters(prev => prev.map(c => {
          if (c.id !== charId) return c;
          let defaultAvatarUrl = null;
          if (c.syncedCardAvatar) {
            defaultAvatarUrl = resolveSillyTavernAvatarUrl(c.syncedCardAvatar, c.syncedCardType || 'Card');
          }
          return {
            ...c,
            statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
            status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
            profile: JSON.parse(JSON.stringify(c.activePlayer ? DEFAULT_PROFILE : {})),
            profileLocks: JSON.parse(JSON.stringify(c.activePlayer ? DEFAULT_PROFILE_LOCKS : {})),
            profileInjects: {},
            inventory: c.activePlayer ? {
              equipIsLocked: false,
              equipIsInject: true,
              storageIsLocked: false,
              storageIsInject: true,
              equipmentLocks: {},
              storageLocks: {},
              equipment: { 'Right Hand': null, 'Left Hand': null },
              storage: { 'Backpack': [] }
            } : {
              equipIsLocked: false,
              equipIsInject: false,
              storageIsLocked: false,
              storageIsInject: false,
              equipmentLocks: {},
              storageLocks: {},
              equipment: {},
              storage: {}
            },
            quests: { main: { name: '', desc: '' }, sides: [] },
            relations: {},
            assetName: null,
            isFolder: true,
            enableExpression: false,
            selectedSprite: null,
            availableSprites: [],
            cropOffset: { x: 50, y: 50, zoom: 1 },
            viewportScale: 100,
            viewportOpacity: 0.95,
            avatarUrl: defaultAvatarUrl
          };
        }));
        setPresetEditingTarget(null);
      } else {
        alert("Failed to communicate with SillyTavern server.");
      }
    }
  };

  const handleSavePresetToCard = async () => {
    const visualMeta = extractVisualMetadata(presetEditingTarget, targetChar);

    const presetPayload = {
      statusSchema: presetEditingTarget.statusSchema,
      status: presetEditingTarget.status,
      profile: presetEditingTarget.profile,
      inventory: presetEditingTarget.inventory,
      quests: presetEditingTarget.quests,
      relations: presetEditingTarget.relations,
      ...visualMeta
    };

    const success = await savePresetToSillyTavernCard(targetChar.syncedCardAvatar, presetPayload);
    if (success) {
      alert("Preset saved to character card metadata successfully.");
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
      if (removeCharacterSync) {
        removeCharacterSync(charId);
      }
      if (updateCustomAvatar) {
        updateCustomAvatar(charId, null);
      }

      const newChars = localCharacters.filter(c => c.id !== charId);
      if (updateTrackerData) {
        updateTrackerData({ ...trackerData, characters: newChars });
      }
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
        if (importedData && typeof importedData === 'object') {
          const migrated = migrateCharacterSchema(JSON.parse(JSON.stringify(importedData)));
          const visualMeta = extractVisualMetadata(importedData, currentEditingChar);

          const tempTracker = { characters: [{ ...migrated, ...visualMeta }] };
          const sanitizedTemp = sanitizeTrackerData(tempTracker);
          const importedChar = sanitizedTemp.characters[0];

          handleUpdateList(currentEditingList.map(c =>
            c.id === currentEditingChar.id ? {
              ...importedChar,
              id: currentEditingChar.id
            } : c
          ));

          if (!isEditingPreset) {
            setPendingAvatarUpdate(visualMeta);
          }
        } else {
          alert("Invalid character JSON file.");
        }
      } catch (error) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveChanges = () => {
    if (updateTrackerData) {
      if (pendingCardSync !== undefined && syncCharacterToCard) {
        syncCharacterToCard(charId, pendingCardSync);
      }
      if (pendingAvatarUpdate !== undefined && updateCustomAvatar) {
        updateCustomAvatar(charId, pendingAvatarUpdate);
      }

      const stContext = window.SillyTavern?.getContext?.();
      const originalChar = (trackerData.characters || []).find(c => c.id === charId);
      const oldName = originalChar?.name?.trim() || '';

      let updatedList = localCharacters.map(c => {
        if (c.id === charId) {
          let targetAvatarUrl = null;
          if (c.assetName) {
            targetAvatarUrl = buildCharacterSpriteUrl(c.assetName, c.selectedSprite, c.isFolder);
          } else if (c.avatarUrl && !isBase64Image(c.avatarUrl)) {
            targetAvatarUrl = c.avatarUrl;
          }

          if (c.syncedCardType === 'Card' && c.syncedCardAvatar) {
            const allChars = Array.isArray(stContext?.characters)
              ? stContext.characters
              : (Array.isArray(window.characters) ? window.characters : []);
            const matched = allChars.find(stChar => stChar.avatar === c.syncedCardAvatar);
            const resolvedCardUrl = matched
              ? resolveSillyTavernAvatarUrl(matched.avatar, 'Card')
              : resolveSillyTavernAvatarUrl(c.syncedCardAvatar, 'Card');

            return {
              ...c,
              name: matched?.name || c.name,
              avatarUrl: targetAvatarUrl || resolvedCardUrl
            };
          } else if (c.syncedCardType === 'Persona') {
            const userAvatarFile = stContext?.user_avatar || window.user_avatar || null;
            const currentLiveName = stContext?.name1 || window.name1 || c.name;
            const resolvedPersonaUrl = resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona');

            return {
              ...c,
              name: currentLiveName,
              avatarUrl: targetAvatarUrl || resolvedPersonaUrl
            };
          } else {
            return {
              ...c,
              avatarUrl: targetAvatarUrl || null
            };
          }
        }
        return c;
      });

      const savedTarget = updatedList.find(c => c.id === charId);
      const newName = savedTarget?.name?.trim() || '';
      if (oldName && newName && oldName !== newName) {
        updatedList = updatedList.map(c => {
          if (c.id === charId || !c.relations || c.relations[oldName] === undefined) return c;
          const nextRelations = {};
          Object.keys(c.relations).forEach(relKey => {
            if (relKey === oldName && c.relations[newName] === undefined) {
              nextRelations[newName] = c.relations[relKey];
            } else {
              nextRelations[relKey] = c.relations[relKey];
            }
          });
          return { ...c, relations: nextRelations };
        });
      }

      const tempTracker = {
        characters: JSON.parse(JSON.stringify(updatedList)),
        globalDefinitions: JSON.parse(JSON.stringify(localGlobalDefs))
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

  const isSyncedCard = Boolean(targetChar.syncedCardAvatar && targetChar.syncedCardType === 'Card');
  const isAnySyncActive = Boolean(targetChar.syncedCardAvatar || targetChar.syncedCardType);

  return (
    <ModalLayout
      onClose={isEditingPreset ? () => setPresetEditingTarget(null) : onClose}
      headerContent={
        isEditingPreset ? (
          <div className={styles.headerNav} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="rpg-btn-sm"
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
              disabled={isAnySyncActive}
              onChange={e => setLocalCharacters(localCharacters.map(c => c.id === charId ? { ...c, name: e.target.value } : c))}
              style={{ width: '130px', flexShrink: 0 }}
              title={isAnySyncActive ? "Name is managed by SillyTavern Card Sync" : "Edit Name"}
            />

            <CardSyncComponent
              onSync={handleSyncCard}
              isSynced={isAnySyncActive}
            />

            {isSyncedCard && (
              <>
                <button
                  type="button"
                  className="rpg-btn-sm"
                  onClick={handleOpenPresetEditor}
                >
                  Edit Preset
                </button>
                <button
                  type="button"
                  className="rpg-btn-sm"
                  onClick={handleLoadPresetToActive}
                >
                  Load Preset
                </button>
              </>
            )}
          </div>
        )
      }
      subHeader={
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
      }
      footerLeft={
        isEditingPreset ? (
          <>
            <button type="button" className="rpg-modal-btn reset" onClick={handleResetCharacter}>Reset</button>
            <button type="button" className="rpg-modal-btn reset" onClick={handleDeletePresetFromCard}>Delete</button>
            <button type="button" className="rpg-modal-btn" onClick={handleLoadActiveToPreset}>Load</button>
          </>
        ) : (
          <>
            <button type="button" className="rpg-modal-btn reset" onClick={handleResetCharacter}>Reset</button>
            <button type="button" className="rpg-modal-btn reset" onClick={handleDeleteCharacter}>Delete</button>
          </>
        )
      }
      footerRight={
        isEditingPreset ? (
          <button type="button" className="rpg-modal-btn save" onClick={handleSavePresetToCard}>Save Preset to Card</button>
        ) : (
          <>
            <button type="button" className="rpg-modal-btn" onClick={handleExportCharacter}>Export</button>
            <label className="rpg-modal-btn" style={{ cursor: 'pointer' }}>
              Import
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportCharacter} />
            </label>
            <button type="button" className="rpg-modal-btn save" onClick={handleSaveChanges}>Save</button>
          </>
        )
      }
    >
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
          onRenameField={handleRenameFieldInDefs}
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
          onRenameField={handleRenameFieldInDefs}
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
    </ModalLayout>
  );
}