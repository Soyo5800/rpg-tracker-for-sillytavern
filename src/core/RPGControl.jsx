// src/core/RPGControl.jsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { defensiveMerge, reconstructTurnState } from './JSONTracker';
import { getDefaultCharacters, getInitialTrackerData } from './PromptSchema';
import { setNestedValue, deleteNestedValue } from './StateHelpers';

const RPGContext = createContext(null);

const DEFAULT_SETTINGS = {
  enabled: true,
  autoUpdate: true,
  panelPosition: 'left',
  theme: 'default',
  updateMode: 'merged',
  contextMessageLimit: 4,
  keepAllBackups: false,
  maxBackupCount: 20,
  showUserStats: true,
  showInfoBox: true,
  showCharacterThoughts: true,
  showInventory: true,
  showQuests: true,
  presets: [],
  characterSyncs: {},
  useCustomModel: false,
  customModel: '',
  customColors: {
    bg: '#1a1a2e',
    accent: '#4a7ba7',
    text: '#ffffff',
    highlight: '#4a9eff',
    border: '#4a7ba7'
  }
};

const getDefaultTrackerData = () => {
  return getInitialTrackerData();
};

export function RPGControlProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const existing = window.RPGBridge?.latestSettings;
    return existing ? { ...DEFAULT_SETTINGS, ...existing } : DEFAULT_SETTINGS;
  });
  const [trackerData, setTrackerData] = useState(getDefaultTrackerData);
  const [isChatConnected, setIsChatConnected] = useState(false);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    if (window.RPGBridge) {
      window.RPGBridge.latestSettings = settings;
    }
  }, [settings]);

  const [snapshotModalData, setSnapshotModalData] = useState({ isOpen: false, mesId: null, historicalData: null });

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

    if (window.RPGBridge && typeof window.RPGBridge.saveChatData === 'function') {
      window.RPGBridge.saveChatData(pendingDataRef.current, settings.maxBackupCount);
      pendingDataRef.current = null;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, [settings.maxBackupCount]);

  const saveTrackerDataToST = useCallback((updatedTracker) => {
    pendingDataRef.current = updatedTracker;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      executeSave();
    }, 500);
  }, [executeSave]);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (window.RPGBridge) {
        window.RPGBridge.latestSettings = updated;
      }
      saveSettingsToST(updated);
      return updated;
    });
  }, [saveSettingsToST]);

  const updateTrackerData = useCallback((newTrackerData) => {
    setTrackerData((prev) => {
      const updated = { ...prev, ...newTrackerData };

      if (updated.characters && settingsRef.current?.croppedAvatars) {
        const activeIds = new Set(updated.characters.map(c => c.id));
        const currentCropped = settingsRef.current.croppedAvatars;
        let hasChanges = false;
        const cleanedCropped = { ...currentCropped };

        Object.keys(currentCropped).forEach(id => {
          if (!activeIds.has(id)) {
            delete cleanedCropped[id];
            hasChanges = true;
          }
        });

        if (hasChanges) {
          updateSettings({ croppedAvatars: cleanedCropped });
        }
      }

      const context = window.SillyTavern?.getContext?.() || {};
      const chatId = context.chatId;
      if (chatId && settingsRef.current?.characterSyncs?.[chatId] && Array.isArray(updated.characters)) {
        const currentSyncs = JSON.parse(JSON.stringify(settingsRef.current.characterSyncs));
        const chatSync = currentSyncs[chatId] || {};
        let hasSyncChanges = false;

        Object.keys(chatSync).forEach(idxKey => {
          const idx = parseInt(idxKey, 10);
          if (isNaN(idx) || idx >= updated.characters.length) {
            delete chatSync[idxKey];
            hasSyncChanges = true;
          }
        });

        if (hasSyncChanges) {
          if (Object.keys(chatSync).length === 0) {
            delete currentSyncs[chatId];
          } else {
            currentSyncs[chatId] = chatSync;
          }
          updateSettings({ characterSyncs: currentSyncs });
        }
      }

      saveTrackerDataToST(updated);
      return updated;
    });
  }, [saveTrackerDataToST, updateSettings]);

  const patchCharacterField = useCallback((charId, pathArray, value) => {
    setTrackerData(prev => {
      const updatedChars = prev.characters.map(c => {
        if (c.id === charId) {
          return setNestedValue(c, pathArray, value);
        }
        return c;
      });
      const updatedData = { ...prev, characters: updatedChars };
      saveTrackerDataToST(updatedData);
      return updatedData;
    });
  }, [saveTrackerDataToST]);

  const deleteCharacterField = useCallback((charId, pathArray) => {
    setTrackerData(prev => {
      const updatedChars = prev.characters.map(c => {
        if (c.id === charId) {
          return deleteNestedValue(c, pathArray);
        }
        return c;
      });
      const updatedData = { ...prev, characters: updatedChars };
      saveTrackerDataToST(updatedData);
      return updatedData;
    });
  }, [saveTrackerDataToST]);

  const patchWorldField = useCallback((pathArray, value) => {
    setTrackerData(prev => {
      const updatedWorld = setNestedValue(prev.worldState || {}, pathArray, value);
      const updatedData = { ...prev, worldState: updatedWorld };
      saveTrackerDataToST(updatedData);
      return updatedData;
    });
  }, [saveTrackerDataToST]);

  const syncCharacterToCard = useCallback((charId, target) => {
    const context = window.SillyTavern?.getContext?.() || {};
    const chatId = context.chatId;
    if (!chatId) return;

    setTrackerData(prev => {
      const charIndex = prev.characters.findIndex(c => c.id === charId);
      if (charIndex === -1) return prev;

      setSettings(prevSettings => {
        const nextSyncs = JSON.parse(JSON.stringify(prevSettings.characterSyncs || {}));
        nextSyncs[chatId] = nextSyncs[chatId] || {};

        if (!target || target.type === 'Unsync') {
          delete nextSyncs[chatId][charIndex];
          if (Object.keys(nextSyncs[chatId]).length === 0) {
            delete nextSyncs[chatId];
          }
        } else {
          nextSyncs[chatId][charIndex] = {
            syncedCardAvatar: target.avatarFile,
            syncedCardType: target.type,
            name: target.name,
            avatarUrl: target.avatarUrl
          };
        }

        const updated = { ...prevSettings, characterSyncs: nextSyncs };
        if (window.RPGBridge) {
          window.RPGBridge.latestSettings = updated;
        }
        saveSettingsToST(updated);
        return updated;
      });

      const updatedChars = prev.characters.map((c, idx) => {
        if (idx === charIndex) {
          if (!target || target.type === 'Unsync') {
            const crop = settingsRef.current?.croppedAvatars?.[c.id];
            return {
              ...c,
              syncedCardAvatar: null,
              syncedCardType: null,
              avatarUrl: crop || null
            };
          }
          return {
            ...c,
            name: target.name,
            avatarUrl: target.avatarUrl,
            syncedCardAvatar: target.avatarFile,
            syncedCardType: target.type
          };
        }
        return c;
      });
      const updatedData = { ...prev, characters: updatedChars };
      saveTrackerDataToST(updatedData);
      return updatedData;
    });
  }, [saveSettingsToST, saveTrackerDataToST]);

  const revertToOriginalTurnState = useCallback(async () => {
    if (!window.RPGBridge) return;

    if (window.confirm("Are you sure you want to revert manual edits and restore the original AI-generated status for this turn?")) {
      try {
        const stContext = window.SillyTavern?.getContext?.();
        const chat = stContext?.chat;
        if (!Array.isArray(chat) || chat.length === 0) return;

        const originalState = await reconstructTurnState(chat, getDefaultTrackerData());

        if (originalState) {
          setTrackerData(originalState);
          if (window.RPGBridge && typeof window.RPGBridge.saveChatData === 'function') {
            window.RPGBridge.saveChatData(originalState, settings.maxBackupCount);
          }
          alert("Restored to the original turn state successfully.");
        }
      } catch (e) {
        console.error("[RPG Tracker] Reversion failed:", e);
        alert("Failed to revert state.");
      }
    }
  }, [settings.maxBackupCount]);

  useEffect(() => {
    if (window.RPGBridge) {
      window.RPGBridge.currentTrackerData = trackerData;
    }
  }, [trackerData]);

  useEffect(() => {
    window.RPGBridge = {
      ...(window.RPGBridge || {}),
      currentTrackerData: trackerData,

      flushSave: () => {
        executeSave();
      },

      syncSettings: (stSettings) => {
        if (stSettings) {
          setSettings((prev) => ({ ...prev, ...stSettings }));
        }
      },
      syncChatData: (stChatData) => {
        if (stChatData) {
          setTrackerData((prev) => {
            const defaultData = getDefaultTrackerData();
            const safePrev = prev || defaultData;

            const cleanBase = {
              ...defaultData,
              systemPromptHeader_merged: safePrev.systemPromptHeader_merged ?? defaultData.systemPromptHeader_merged,
              systemPromptFooter_merged: safePrev.systemPromptFooter_merged ?? defaultData.systemPromptFooter_merged,
              systemPromptHeader_separated: safePrev.systemPromptHeader_separated ?? defaultData.systemPromptHeader_separated,
              systemPromptFooter_separated: safePrev.systemPromptFooter_separated ?? defaultData.systemPromptFooter_separated,
              globalDefinitions: safePrev.globalDefinitions ?? defaultData.globalDefinitions,
              addons: safePrev.addons ?? defaultData.addons,
              addCharPrompt: safePrev.addCharPrompt ?? defaultData.addCharPrompt,
              addPlayerCharPrompt: safePrev.addPlayerCharPrompt ?? defaultData.addPlayerCharPrompt,
              cyoaPrompt: safePrev.cyoaPrompt ?? defaultData.cyoaPrompt,
              weatherPrompt: safePrev.weatherPrompt ?? defaultData.weatherPrompt,
              worldEventsPrompt: safePrev.worldEventsPrompt ?? defaultData.worldEventsPrompt
            };
            const merged = defensiveMerge(cleanBase, stChatData);

            const context = window.SillyTavern?.getContext?.() || {};
            const chatId = context.chatId;
            const savedSyncs = window.RPGBridge?.getSTSettingsCharacterSyncs?.(chatId)
              || settingsRef.current.characterSyncs?.[chatId];

            if (chatId && Array.isArray(merged.characters)) {
              merged.characters.forEach((c, index) => {
                const saved = savedSyncs?.[index];
                if (saved) {
                  c.syncedCardAvatar = saved.syncedCardAvatar;
                  c.syncedCardType = saved.syncedCardType;
                  c.name = saved.name;
                  c.avatarUrl = saved.avatarUrl;
                } else {
                  c.syncedCardAvatar = null;
                  c.syncedCardType = null;
                  const globalCrop = settingsRef.current?.croppedAvatars?.[c.id];
                  c.avatarUrl = globalCrop || null;
                }
              });
            }
            return merged;
          });
        }
      },
      setChatConnectionStatus: (status) => {
        setIsChatConnected(status);
      },
      triggerHistoryRollback: () => {
        if (window.RPGBridge && typeof window.RPGBridge.rehydrateFromHistory === 'function') {
          const recovered = window.RPGBridge.rehydrateFromHistory();
          setTrackerData((prev) => {
            const defaultData = getDefaultTrackerData();
            const safePrev = prev || defaultData;

            const cleanBase = {
              ...defaultData,
              systemPromptHeader_merged: safePrev.systemPromptHeader_merged ?? defaultData.systemPromptHeader_merged,
              systemPromptFooter_merged: safePrev.systemPromptFooter_merged ?? defaultData.systemPromptFooter_merged,
              systemPromptHeader_separated: safePrev.systemPromptHeader_separated ?? defaultData.systemPromptHeader_separated,
              systemPromptFooter_separated: safePrev.systemPromptFooter_separated ?? defaultData.systemPromptFooter_separated,
              globalDefinitions: safePrev.globalDefinitions ?? defaultData.globalDefinitions,
              addons: safePrev.addons ?? defaultData.addons,
              addCharPrompt: safePrev.addCharPrompt ?? defaultData.addCharPrompt,
              addPlayerCharPrompt: safePrev.addPlayerCharPrompt ?? defaultData.addPlayerCharPrompt,
              cyoaPrompt: safePrev.cyoaPrompt ?? defaultData.cyoaPrompt,
              weatherPrompt: safePrev.weatherPrompt ?? defaultData.weatherPrompt,
              worldEventsPrompt: safePrev.worldEventsPrompt ?? defaultData.worldEventsPrompt
            };
            const merged = recovered ? defensiveMerge(cleanBase, recovered) : cleanBase;

            const context = window.SillyTavern?.getContext?.() || {};
            const chatId = context.chatId;
            const savedSyncs = window.RPGBridge?.getSTSettingsCharacterSyncs?.(chatId)
              || settingsRef.current.characterSyncs?.[chatId];

            if (chatId && Array.isArray(merged.characters)) {
              merged.characters.forEach((c, index) => {
                const saved = savedSyncs?.[index];
                if (saved) {
                  c.syncedCardAvatar = saved.syncedCardAvatar;
                  c.syncedCardType = saved.syncedCardType;
                  c.name = saved.name;
                  c.avatarUrl = saved.avatarUrl;
                } else {
                  c.syncedCardAvatar = null;
                  c.syncedCardType = null;
                  const globalCrop = settingsRef.current?.croppedAvatars?.[c.id];
                  c.avatarUrl = globalCrop || null;
                }
              });
            }
            return merged;
          });
        }
      },
      handleManualUpdate: async () => {
        if (window.RPGBridge && typeof window.RPGBridge.triggerManualUpdate === 'function') {
          try {
            await window.RPGBridge.triggerManualUpdate();
          } catch (e) {
            console.error('[RPG Tracker] Manual update failed:', e);
          }
        }
      },
      resetToDefault: () => {
        setTrackerData(() => {
          const defaultData = getDefaultTrackerData();
          const context = window.SillyTavern?.getContext?.() || {};
          const chatId = context.chatId;
          const savedSyncs = window.RPGBridge?.getSTSettingsCharacterSyncs?.(chatId)
            || settingsRef.current.characterSyncs?.[chatId];

          if (chatId && Array.isArray(defaultData.characters)) {
            defaultData.characters.forEach((c, index) => {
              const saved = savedSyncs?.[index];
              if (saved) {
                c.syncedCardAvatar = saved.syncedCardAvatar;
                c.syncedCardType = saved.syncedCardType;
                c.name = saved.name;
                c.avatarUrl = saved.avatarUrl;
              } else {
                c.syncedCardAvatar = null;
                c.syncedCardType = null;
                const globalCrop = settingsRef.current?.croppedAvatars?.[c.id];
                c.avatarUrl = globalCrop || null;
              }
            });
          }
          return defaultData;
        });
      },
      openSnapshotModal: (mesId, historicalData, existingPayload = null) => {
        setSnapshotModalData({ isOpen: true, mesId, historicalData, existingPayload });
      },
      closeSnapshotModal: () => {
        setSnapshotModalData({ isOpen: false, mesId: null, historicalData: null, existingPayload: null });
      },
      triggerSnapshotRender: () => {
        const chatContainer = document.getElementById('chat');
        if (chatContainer) chatContainer.dispatchEvent(new Event('DOMSubtreeModified'));
      }
    };
  }, []);

  const isEnabled = settings.enabled;

  useEffect(() => {
    const rootElement = document.getElementById('my-rpg-react-root');
    if (rootElement) {
      if (isEnabled) {
        rootElement.style.setProperty('display', 'block', 'important');
      } else {
        rootElement.style.setProperty('display', 'none', 'important');
      }
    }
  }, [isEnabled]);

  const value = {
    isEnabled,
    settings,
    trackerData,
    isChatConnected,
    snapshotModalData,
    uiState,
    updateUiState,
    updateSettings,
    updateTrackerData,
    patchCharacterField,
    deleteCharacterField,
    patchWorldField,
    syncCharacterToCard,
    revertToOriginalTurnState
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