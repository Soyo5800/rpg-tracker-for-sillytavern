import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { defensiveMerge, sanitizeTrackerData, remapAssociatedMetadata } from './JSONTracker';
import { getInitialTrackerData, getDefaultPromptSettings, DEFAULT_SETTINGS } from './PromptSchema';
import { setNestedValue } from './StateHelpers';
import { hydrateCharacterMetadata, buildCharacterSpriteUrl, normalizeCropOffset, extractVisualMetadata } from './AvatarResolver';

const RPGContext = createContext(null);

const getDefaultTrackerData = () => {
  return sanitizeTrackerData(getInitialTrackerData());
};

function mergeAndHydrateTrackerData(incomingData, settings, baseData = null) {
  const base = baseData ? sanitizeTrackerData(baseData) : getDefaultTrackerData();
  const merged = incomingData ? defensiveMerge(base, incomingData) : base;
  const sanitized = sanitizeTrackerData(merged);
  const protectedData = window.RPGBridge?.applyChatLocks ? window.RPGBridge.applyChatLocks(sanitized) : sanitized;

  const context = window.SillyTavern?.getContext?.() || {};
  if (Array.isArray(protectedData.characters)) {
    hydrateCharacterMetadata(protectedData.characters, context, settings);
  }
  return protectedData;
}


export function RPGControlProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const existing = window.RPGBridge?.latestSettings;
    return existing ? { ...DEFAULT_SETTINGS, ...existing } : DEFAULT_SETTINGS;
  });

  const [trackerData, setTrackerData] = useState(getDefaultTrackerData);

  const [promptSettings, setPromptSettings] = useState(() => {
    const fromBridge = window.RPGBridge?.getChatPromptSettings?.();
    return fromBridge || getDefaultPromptSettings();
  });

  const [isChatConnected, setIsChatConnected] = useState(false);
  const [activeVisualCharId, setActiveVisualCharId] = useState(null);

  const [customAvatars, setCustomAvatars] = useState(() => {
    const context = window.SillyTavern?.getContext?.() || {};
    return context.chatMetadata?.rpgCustomAvatars || {};
  });

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    if (window.RPGBridge) {
      window.RPGBridge.latestSettings = settings;
    }
  }, [settings]);

  const promptSettingsRef = useRef(promptSettings);
  useEffect(() => {
    promptSettingsRef.current = promptSettings;
    if (window.RPGBridge) {
      window.RPGBridge.currentPromptSettings = promptSettings;
    }
  }, [promptSettings]);

  const trackerDataRef = useRef(trackerData);
  useEffect(() => {
    trackerDataRef.current = trackerData;
    if (window.RPGBridge) {
      window.RPGBridge.currentTrackerData = trackerData;
    }
  }, [trackerData]);


  const [snapshotModalData, setSnapshotModalData] = useState({
    isOpen: false,
    mesId: null,
    historicalData: null,
    existingPayload: null,
    sendDate: null,
    turnId: null
  });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [uiState, setUiState] = useState(() => {
    try {
      const cached = localStorage.getItem('rpg_tracker_ui_state');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("[RPG Tracker] Failed to load UI state from localStorage:", e);
    }
    return {
      activeTab: 'status',
      collapsedChars: {},
      activeInlineTabs: {}
    };
  });

  const updateUiState = useCallback((updates) => {
    setUiState((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('rpg_tracker_ui_state', JSON.stringify(next));
      } catch (e) {
        console.warn("[RPG Tracker] Failed to save UI state to localStorage:", e);
      }
      return next;
    });
  }, []);

  const saveSettingsToST = useCallback((updatedSettings) => {
    if (window.RPGBridge && typeof window.RPGBridge.saveSettings === 'function') {
      window.RPGBridge.saveSettings(updatedSettings);
    }
  }, []);

  const saveTimeoutRef = useRef(null);
  const pendingDataRef = useRef(null);

  const executeSave = useCallback(() => {
    if (!pendingDataRef.current) return;

    const pending = pendingDataRef.current;
    const dataToSave = pending.data || pending;
    const targetToSave = pending.target || null;

    if (window.RPGBridge && typeof window.RPGBridge.saveChatData === 'function') {
      const currentSettings = settingsRef.current || {};
      const effectiveMaxKeep = currentSettings.keepAllBackups === true ? -1 : (currentSettings.maxBackupCount ?? 20);

      window.RPGBridge.saveChatData(
        dataToSave,
        effectiveMaxKeep,
        targetToSave
      );
      pendingDataRef.current = null;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const executeSaveRef = useRef(executeSave);
  useEffect(() => {
    executeSaveRef.current = executeSave;
  }, [executeSave]);

  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingDataRef.current = null;
  }, []);

  const cancelPendingSaveRef = useRef(cancelPendingSave);
  useEffect(() => {
    cancelPendingSaveRef.current = cancelPendingSave;
  }, [cancelPendingSave]);

  const saveTrackerDataToST = useCallback((updatedTracker, immediate = false) => {
    const cleanTracker = sanitizeTrackerData(updatedTracker);

    if (window.RPGBridge) {
      window.RPGBridge.currentTrackerData = cleanTracker;
      window.RPGBridge.recordChatLocks?.(cleanTracker);
    }

    pendingDataRef.current = {
      data: cleanTracker,
      target: window.RPGBridge?.createSaveTarget?.() || null,
    };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (immediate) {
      executeSaveRef.current();
    } else {
      saveTimeoutRef.current = setTimeout(() => {
        executeSaveRef.current();
      }, 500);
    }
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      settingsRef.current = updated;
      if (window.RPGBridge) {
        window.RPGBridge.latestSettings = updated;
        if (typeof window.RPGBridge.refreshPrompts === 'function' && updated.enabled !== false) {
          window.RPGBridge.refreshPrompts();
        }
        if (typeof window.RPGBridge.triggerObserverNow === 'function') {
          window.RPGBridge.triggerObserverNow();
        }
      }
      saveSettingsToST(updated);
      return updated;
    });
  }, [saveSettingsToST]);


  const updatePromptSettings = useCallback((newPromptSettings) => {
    setPromptSettings((prev) => {
      const updated = { ...prev, ...newPromptSettings };
      if (window.RPGBridge) {
        window.RPGBridge.currentPromptSettings = updated;
        if (typeof window.RPGBridge.updatePromptSettings === 'function') {
          window.RPGBridge.updatePromptSettings(updated);
        } else if (typeof window.RPGBridge.saveChatPromptSettings === 'function') {
          window.RPGBridge.saveChatPromptSettings(updated);
          if (typeof window.RPGBridge.refreshPrompts === 'function') {
            window.RPGBridge.refreshPrompts();
          }
        }
      }
      return updated;
    });
  }, []);

  const updateTrackerData = useCallback((newTrackerData) => {
    setTrackerData((prev) => {
      const updated = sanitizeTrackerData({ ...prev, ...newTrackerData });
      saveTrackerDataToST(updated);
      return updated;
    });
  }, [saveTrackerDataToST]);

  const removeCharacterSync = useCallback((charIdOrIds) => {
    const context = window.SillyTavern?.getContext?.() || {};
    const chatId = context.chatId;
    if (!chatId || !settingsRef.current?.characterSyncs?.[chatId]) return;

    const idsToRemove = Array.isArray(charIdOrIds)
      ? new Set(charIdOrIds)
      : (charIdOrIds instanceof Set ? charIdOrIds : new Set([charIdOrIds]));

    setSettings((prevSettings) => {
      const currentSyncs = JSON.parse(JSON.stringify(prevSettings.characterSyncs || {}));
      const chatSync = currentSyncs[chatId];
      if (!chatSync) return prevSettings;

      let hasChanges = false;
      idsToRemove.forEach((id) => {
        if (chatSync[id]) {
          delete chatSync[id];
          hasChanges = true;
        }
      });

      if (!hasChanges) return prevSettings;

      if (Object.keys(chatSync).length === 0) {
        delete currentSyncs[chatId];
      } else {
        currentSyncs[chatId] = chatSync;
      }

      const nextSettings = { ...prevSettings, characterSyncs: currentSyncs };
      settingsRef.current = nextSettings;
      if (window.RPGBridge) {
        window.RPGBridge.latestSettings = nextSettings;
      }
      saveSettingsToST(nextSettings);
      return nextSettings;
    });
  }, [saveSettingsToST]);

  const pruneCharacterSyncs = useCallback((activeCharIds) => {
    const context = window.SillyTavern?.getContext?.() || {};
    const chatId = context.chatId;
    if (!chatId || !settingsRef.current?.characterSyncs?.[chatId]) return;

    const validSet = new Set(activeCharIds);

    setSettings((prevSettings) => {
      const currentSyncs = JSON.parse(JSON.stringify(prevSettings.characterSyncs || {}));
      const chatSync = currentSyncs[chatId];
      if (!chatSync) return prevSettings;

      let hasChanges = false;
      Object.keys(chatSync).forEach((key) => {
        if (!validSet.has(key)) {
          delete chatSync[key];
          hasChanges = true;
        }
      });

      if (!hasChanges) return prevSettings;

      if (Object.keys(chatSync).length === 0) {
        delete currentSyncs[chatId];
      } else {
        currentSyncs[chatId] = chatSync;
      }

      const nextSettings = { ...prevSettings, characterSyncs: currentSyncs };
      settingsRef.current = nextSettings;
      if (window.RPGBridge) {
        window.RPGBridge.latestSettings = nextSettings;
      }
      saveSettingsToST(nextSettings);
      return nextSettings;
    });
  }, [saveSettingsToST]);

  const pruneCustomAvatars = useCallback((activeCharIds) => {
    const context = window.SillyTavern?.getContext?.() || {};
    if (!context.chatMetadata?.rpgCustomAvatars) return;

    const validSet = new Set(activeCharIds);
    const currentCustom = context.chatMetadata.rpgCustomAvatars;
    let hasChanges = false;
    const nextCustom = { ...currentCustom };

    Object.keys(nextCustom).forEach((id) => {
      if (!validSet.has(id)) {
        delete nextCustom[id];
        hasChanges = true;
      }
    });

    if (!hasChanges) return;

    context.chatMetadata.rpgCustomAvatars = nextCustom;
    if (typeof context.saveMetadata === 'function') {
      context.saveMetadata();
    }

    setCustomAvatars(nextCustom);
  }, []);

  const remapCharacterMetadata = useCallback((idMap) => {
    if (!idMap || typeof idMap !== 'object' || Object.keys(idMap).length === 0) return;

    setActiveVisualCharId(prev => (prev && idMap[prev]) ? idMap[prev] : prev);

    const context = window.SillyTavern?.getContext?.() || {};
    const chatId = context.chatId;
    const currentLocks = context.chatMetadata?.['rpgTrackerLocks'];
    const currentCustom = context.chatMetadata?.['rpgCustomAvatars'];

    const { settings: nextSettings, lockState: nextLocks, customAvatars: nextCustom } = remapAssociatedMetadata(idMap, {
      settings: settingsRef.current,
      lockState: currentLocks,
      chatId,
      customAvatars: currentCustom
    });

    if (nextSettings) {
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      saveSettingsToST(nextSettings);
    }

    if (context.chatMetadata) {
      if (nextLocks) context.chatMetadata['rpgTrackerLocks'] = nextLocks;
      if (nextCustom) context.chatMetadata['rpgCustomAvatars'] = nextCustom;
      if (typeof context.saveMetadata === 'function') {
        context.saveMetadata();
      }
    }

    if (nextCustom) {
      setCustomAvatars(nextCustom);
    }
  }, [saveSettingsToST]);

  const patchCharacterField = useCallback((charId, pathArray, value) => {
    setTrackerData(prev => {
      const updatedChars = prev.characters.map(c => {
        if (c.id === charId) {
          return setNestedValue(c, pathArray, value);
        }
        return c;
      });
      const updatedData = sanitizeTrackerData({ ...prev, characters: updatedChars });
      saveTrackerDataToST(updatedData);
      return updatedData;
    });
  }, [saveTrackerDataToST]);

  const patchWorldField = useCallback((pathArray, value) => {
    setTrackerData(prev => {
      const updatedWorld = setNestedValue(prev.worldState || {}, pathArray, value);
      const updatedData = sanitizeTrackerData({ ...prev, worldState: updatedWorld });
      saveTrackerDataToST(updatedData);
      return updatedData;
    });
  }, [saveTrackerDataToST]);

  const syncCharacterToCard = useCallback((charId, target) => {
    const context = window.SillyTavern?.getContext?.() || {};
    const chatId = context.chatId;
    if (!chatId) return;

    const isUnsync = !target || target.type === 'Unsync';

    setSettings(prevSettings => {
      const nextSyncs = JSON.parse(JSON.stringify(prevSettings.characterSyncs || {}));
      nextSyncs[chatId] = nextSyncs[chatId] || {};

      if (isUnsync) {
        delete nextSyncs[chatId][charId];

        const activeChar = (trackerData.characters || []).find(c => c.id === charId);
        const activeName = activeChar?.name ? activeChar.name.trim().toLowerCase() : '';

        if (activeName) {
          Object.keys(nextSyncs[chatId]).forEach(k => {
            const entry = nextSyncs[chatId][k];
            if (entry && entry.name && entry.name.trim().toLowerCase() === activeName) {
              delete nextSyncs[chatId][k];
            }
          });
        }

        if (Object.keys(nextSyncs[chatId]).length === 0) {
          delete nextSyncs[chatId];
        }
      } else {
        nextSyncs[chatId][charId] = {
          syncedCardAvatar: target.avatarFile,
          syncedCardType: target.type,
          name: target.name,
          avatarUrl: target.avatarUrl
        };
      }

      const updated = { ...prevSettings, characterSyncs: nextSyncs };
      settingsRef.current = updated;
      if (window.RPGBridge) {
        window.RPGBridge.latestSettings = updated;
      }
      saveSettingsToST(updated);
      return updated;
    });

    if (!isUnsync && target) {
      const currentChar = (trackerData.characters || []).find(c => c.id === charId);
      const cardPreset = target.preset || null;
      const hasPresetVisual = Boolean(cardPreset && (cardPreset.assetName || cardPreset.isFolder !== undefined));
      const isCardChanged = currentChar?.syncedCardAvatar !== target.avatarFile;
      const existingCustom = context.chatMetadata?.rpgCustomAvatars?.[charId];

      if (hasPresetVisual || isCardChanged || !existingCustom || !existingCustom.assetName) {
        const sourceForMeta = hasPresetVisual ? cardPreset : (isCardChanged ? { assetName: target.avatarFile, isFolder: false } : (existingCustom || { assetName: target.avatarFile }));
        const fallbackForMeta = existingCustom || { assetName: target.avatarFile };
        const initialMeta = extractVisualMetadata(sourceForMeta, fallbackForMeta);

        context.chatMetadata = context.chatMetadata || {};
        context.chatMetadata.rpgCustomAvatars = context.chatMetadata.rpgCustomAvatars || {};
        context.chatMetadata.rpgCustomAvatars[charId] = initialMeta;

        if (typeof context.saveMetadata === 'function') {
          context.saveMetadata();
        }

        setCustomAvatars(prevCustom => ({ ...prevCustom, [charId]: initialMeta }));
      }

    }

    setTrackerData(prev => {
      const charIndex = prev.characters.findIndex(c => c.id === charId);
      if (charIndex === -1) return prev;

      const updatedChars = prev.characters.map((c, idx) => {
        if (idx === charIndex) {
          if (isUnsync) {
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
          const existingCustom = context.chatMetadata?.rpgCustomAvatars?.[charId];

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
            : (existingCustom?.cropOffset ? normalizeCropOffset(existingCustom.cropOffset) : (c.cropOffset ? normalizeCropOffset(c.cropOffset) : { x: 50, y: 50, zoom: 1 }));

          const effectiveViewportScale = hasPresetVisual && cardPreset.viewportScale !== undefined
            ? Math.min(100, Math.max(20, cardPreset.viewportScale))
            : (existingCustom?.viewportScale ?? c.viewportScale ?? 100);

          const effectiveViewportOpacity = hasPresetVisual && cardPreset.viewportOpacity !== undefined
            ? Math.min(1.0, Math.max(0.1, cardPreset.viewportOpacity))
            : (existingCustom?.viewportOpacity ?? c.viewportOpacity ?? 0.95);

          const effectiveAvatarUrl = effectiveAssetName
            ? buildCharacterSpriteUrl(effectiveAssetName, effectiveSelectedSprite, effectiveIsFolder)
            : (target.avatarUrl || null);

          return {
            ...c,
            name: target.name,
            avatarUrl: effectiveAvatarUrl,
            syncedCardAvatar: target.avatarFile,
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
        }
        return c;
      });

      const updatedData = sanitizeTrackerData({ ...prev, characters: updatedChars });
      saveTrackerDataToST(updatedData, true);
      return updatedData;
    });
  }, [saveSettingsToST, saveTrackerDataToST, trackerData]);

  const toggleVisualStage = useCallback((charId) => {
    setActiveVisualCharId(prev => (prev === charId ? null : charId));
  }, []);

  const updateCustomAvatar = useCallback((charId, avatarData) => {
    const context = window.SillyTavern?.getContext?.() || {};
    if (!context.chatMetadata) context.chatMetadata = {};
    if (!context.chatMetadata.rpgCustomAvatars) context.chatMetadata.rpgCustomAvatars = {};

    const nextCustom = { ...(context.chatMetadata.rpgCustomAvatars || {}) };
    if (!avatarData) {
      delete nextCustom[charId];
    } else {
      nextCustom[charId] = {
        ...(nextCustom[charId] || {}),
        ...avatarData
      };
    }
    context.chatMetadata.rpgCustomAvatars = nextCustom;

    if (typeof context.saveMetadata === 'function') {
      context.saveMetadata();
    }

    setCustomAvatars(nextCustom);

    if (window.RPGBridge) {
      window.RPGBridge.trackerRevision = (window.RPGBridge.trackerRevision || 0) + 1;
    }
  }, []);

  useEffect(() => {
    if (window.RPGBridge) {
      window.RPGBridge.currentTrackerData = trackerData;
    }
  }, [trackerData]);

  const syncSettingsHandlerRef = useRef((stSettings) => {
    if (stSettings) {
      setSettings((prev) => ({ ...prev, ...stSettings }));
    }
  });

  useEffect(() => {
    syncSettingsHandlerRef.current = (stSettings) => {
      if (stSettings) {
        setSettings((prev) => ({ ...prev, ...stSettings }));
      }
    };
  }, []);

  useEffect(() => {
    window.RPGBridge = window.RPGBridge || {};
    const bridge = window.RPGBridge;

    bridge.flushSave = () => {
      executeSaveRef.current();
    };

    bridge.cancelPendingSave = () => {
      cancelPendingSaveRef.current();
    };

    if (typeof bridge.syncSettings !== 'function') {
      bridge.syncSettings = (stSettings) => {
        syncSettingsHandlerRef.current(stSettings);
      };
    }

    bridge.syncPromptSettings = (stPromptSettings) => {
      if (stPromptSettings) {
        setPromptSettings(stPromptSettings);
      }
    };

    bridge.syncChatData = (stChatData, stPromptSettings = null) => {
      const context = window.SillyTavern?.getContext?.() || {};
      if (context.chatMetadata?.rpgCustomAvatars) {
        setCustomAvatars({ ...context.chatMetadata.rpgCustomAvatars });
      } else {
        setCustomAvatars({});
      }

      if (stPromptSettings) {
        setPromptSettings(stPromptSettings);
      }
      if (stChatData) {
        setTrackerData(() => mergeAndHydrateTrackerData(stChatData, settingsRef.current, null));
      }
    };

    bridge.setChatConnectionStatus = (status) => {
      setIsChatConnected(status);
    };

    bridge.triggerHistoryRollback = () => {
      cancelPendingSaveRef.current();
      if (window.RPGBridge && typeof window.RPGBridge.rehydrateFromHistory === 'function') {
        let recovered = window.RPGBridge.rehydrateFromHistory();
        if (recovered) {
          recovered = sanitizeTrackerData(recovered);
          if (typeof window.RPGBridge.applyChatLocks === 'function') {
            recovered = window.RPGBridge.applyChatLocks(recovered);
          }
          const nextData = mergeAndHydrateTrackerData(recovered, settingsRef.current, null);
          trackerDataRef.current = nextData;
          window.RPGBridge.currentTrackerData = nextData;
          if (typeof window.RPGBridge.refreshPrompts === 'function' && settingsRef.current.enabled !== false) {
            window.RPGBridge.refreshPrompts(nextData);
          }
          setTrackerData(nextData);
        }
      }
    };


    bridge.resetToDefault = () => {
      cancelPendingSaveRef.current();
      setTrackerData(() => {
        const defaultData = getDefaultTrackerData();
        const cleanDefault = sanitizeTrackerData(defaultData);
        const context = window.SillyTavern?.getContext?.() || {};
        if (Array.isArray(cleanDefault.characters)) {
          hydrateCharacterMetadata(cleanDefault.characters, context, settingsRef.current);
        }
        return cleanDefault;
      });
      setPromptSettings(getDefaultPromptSettings());
      setActiveVisualCharId(null);
      setCustomAvatars({});
    };

    bridge.openSnapshotModal = (mesId, historicalData, existingPayload = null, sendDate = null, turnId = null) => {
      setSnapshotModalData({ isOpen: true, mesId, historicalData, existingPayload, sendDate, turnId });
    };

    bridge.closeSnapshotModal = () => {
      setSnapshotModalData({ isOpen: false, mesId: null, historicalData: null, existingPayload: null, sendDate: null, turnId: null });
    };

    bridge.openHistoryModal = () => {
      setIsHistoryModalOpen(true);
    };

    bridge.triggerSnapshotRender = () => {
      if (typeof window.RPGBridge?.triggerObserverNow === 'function') {
        window.RPGBridge.triggerObserverNow();
      }
    };
  }, []);

  const isEnabled = settings.enabled;

  const value = {
    isEnabled,
    settings,
    trackerData,
    promptSettings,
    isChatConnected,
    activeVisualCharId,
    setActiveVisualCharId,
    toggleVisualStage,
    customAvatars,
    updateCustomAvatar,
    remapCharacterMetadata,
    removeCharacterSync,
    pruneCharacterSyncs,
    pruneCustomAvatars,
    snapshotModalData,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    uiState,
    updateUiState,
    updateSettings,
    updateTrackerData,
    updatePromptSettings,
    patchCharacterField,
    patchWorldField,
    syncCharacterToCard
  };

  return (
    <RPGContext.Provider value={value}>
      {children}
    </RPGContext.Provider>
  );
}

export function useRPG() {
  const context = useContext(RPGContext);
  if (!context) {
    throw new Error('useRPG must be used within an RPGControlProvider');
  }
  return context;
}