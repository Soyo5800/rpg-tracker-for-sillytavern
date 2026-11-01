import { getContext, extension_settings, writeExtensionField } from "../../../../../extensions.js";
import { saveSettingsDebounced, saveChat, saveChatConditional, updateMessageBlock, getRequestHeaders, getThumbnailUrl, user_avatar, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from "../../../../../../script.js";
import { SlashCommandParser } from "../../../../../slash-commands/SlashCommandParser.js";
import {
    backupToMessage,
    rehydrateFromHistory,
    rehydrateFromHistoryAsync,
    applyLLMPatch,
    extractNormalizedPatch,
    getChatTurnHistory,
    setTurnSnapshotPinned,
    updateTurnSnapshotData,
    deleteTurnSnapshot,
    restoreTurnSnapshotToLive,
    manualPruneBackups,
    resolveMessageIndex,
    resolveActiveSwipeId,
    sanitizeTrackerData,
    migrateChatHistoryMessages,
    cleanBase64Avatar
} from "./JSONTracker.js";
import { parseResponse } from "./ResponseParser.js";
import { buildUpdatePromptWrapper } from "./ActivePrompt.js";
import {
    DEFAULT_PROMPT_HEADER_SEP,
    DEFAULT_PROMPT_FOOTER_SEP,
    getDefaultPromptSettings,
    extractPromptSettings,
    stripPromptSettings,
    getInitialTrackerData
} from "./PromptSchema.js";
import { setDeltaLog } from "../messagetracker/DeltaLogRenderer.js";
import { createPresetStore } from "./PresetStore.js";
import { getAppliedDelta } from "./AppliedDelta.js";
import { hydrateCharacterMetadata } from "./AvatarResolver.js";
import { getAvailableModels, getAvailableOpenRouterProviders, executeQuietPromptWithModelOverride, restoreExtensionPromptForCurrentMode } from "./ModelManager.js";
import { clearAllExtensionPrompts, applyModularExtensionPrompts } from "./ExtensionLifecycle.js";
import { createChatLockStore, createChatPromptStore, getChatKey } from "./TrackerLocks.js";
import { triggerObserverNow } from "./ExtensionObserver.js";
import { cleanAllMessageTrackerTags } from "../messagetracker/MessageCardRenderer.js";
import { backupSettingsToLocalStorage } from "./ExtensionSettings.js";

const chatLocks = createChatLockStore(getContext);
const chatPrompts = createChatPromptStore(getContext);

window.SillyTavern = window.SillyTavern || {};
window.SillyTavern.getContext = () => {
    try {
        const ctx = getContext();
        return {
            ...ctx,
            user_avatar: user_avatar
        };
    } catch {
        return { user_avatar: user_avatar };
    }
};

let cachedGroupModule = null;
async function resolveGroupModule() {
    if (!cachedGroupModule) {
        try {
            cachedGroupModule = await import('../../../../../group-chats.js');
        } catch {
            try {
                cachedGroupModule = await import('../../../../../../group-chats.js');
            } catch {
                // Ignore dynamic import failure
            }
        }
    }
    return cachedGroupModule;
}

export function safeUpdateMessageBlock(index, messageObject) {
    if (typeof updateMessageBlock !== 'function') return;
    try {
        updateMessageBlock(index, messageObject);
    } catch {
        setTimeout(() => {
            try {
                updateMessageBlock(index, messageObject);
            } catch (err) {
                console.warn("[RPG Tracker] Delayed updateMessageBlock failed:", err);
            }
        }, 100);
    }
}

let isSavingChat = false;
let hasQueuedSave = false;

export async function safeSaveChat() {
    try {
        const context = typeof getContext === 'function' ? getContext() : {};

        if (!context?.chatId || !Array.isArray(context?.chat)) {
            return;
        }

        if (isSavingChat) {
            hasQueuedSave = true;
            return;
        }

        isSavingChat = true;

        if (typeof window.is_chat_dirty !== 'undefined') {
            window.is_chat_dirty = true;
        }

        const isGroup = Boolean(context?.groupId || window.selected_group);

        if (isGroup) {
            if (typeof window.saveGroupChat === 'function') {
                await window.saveGroupChat();
            } else {
                const groupModule = await resolveGroupModule();
                if (groupModule && typeof groupModule.saveGroupChat === 'function') {
                    await groupModule.saveGroupChat();
                } else if (typeof saveChat === 'function') {
                    await saveChat();
                } else if (typeof window.saveChat === 'function') {
                    await window.saveChat();
                } else if (typeof saveChatConditional === 'function') {
                    await saveChatConditional();
                }
            }
        } else {
            if (typeof saveChat === 'function') {
                await saveChat();
            } else if (typeof window.saveChat === 'function') {
                await window.saveChat();
            } else if (typeof saveChatConditional === 'function') {
                await saveChatConditional();
            }
        }
    } catch (err) {
        console.warn("[RPG Tracker] safeSaveChat failed:", err);
    } finally {
        isSavingChat = false;

        if (hasQueuedSave) {
            hasQueuedSave = false;
            setTimeout(() => {
                safeSaveChat();
            }, 60);
        }
    }
}

async function sendSystemNotice(text) {
    try {
        const sysCallback = SlashCommandParser?.commands?.['sys']?.callback || SlashCommandParser?.commands?.['system']?.callback;
        if (typeof sysCallback === 'function') {
            await sysCallback({}, text);
            return;
        }
    } catch (err) {
        console.warn("[RPG Tracker] SlashCommandParser execution failed, falling back to chat injection:", err);
    }

    const context = getContext();
    if (context && Array.isArray(context.chat)) {
        const sysMsg = {
            name: 'System',
            is_user: false,
            is_system: true,
            send_date: Date.now(),
            mes: text,
            extra: { type: 'system', is_system: true }
        };
        context.chat.push(sysMsg);
        safeUpdateMessageBlock(context.chat.length - 1, sysMsg);
        await safeSaveChat();
    }
}

async function persistQuietUpdateDelta(updatedData, appliedDelta, noticePrefix, settings) {
    window.RPGBridge.currentTrackerData = updatedData;
    if (typeof window.RPGBridge.syncChatData === 'function') {
        window.RPGBridge.syncChatData(updatedData);
    }

    try {
        const sysText = `${noticePrefix} <!--RPG_DELTA:${JSON.stringify(appliedDelta)}-->`;
        await sendSystemNotice(sysText);

        const freshContext = getContext();
        const activeChat = freshContext?.chat;
        if (activeChat && activeChat.length > 0) {
            let lastSysMsgIdx = -1;
            for (let i = activeChat.length - 1; i >= 0; i--) {
                if (activeChat[i] && typeof activeChat[i].mes === 'string' && activeChat[i].mes.includes(noticePrefix)) {
                    lastSysMsgIdx = i;
                    break;
                }
            }

            if (lastSysMsgIdx !== -1) {
                const lastSysMsg = activeChat[lastSysMsgIdx];
                setDeltaLog(lastSysMsg, appliedDelta);
                safeUpdateMessageBlock(lastSysMsgIdx, lastSysMsg);
            }

            const effectiveMaxKeep = settings.keepAllBackups === true ? -1 : (settings.maxBackupCount ?? 20);
            const backupTargetIdx = lastSysMsgIdx !== -1 ? lastSysMsgIdx : (activeChat.length - 1);

            if (backupTargetIdx >= 0) {
                backupToMessage(
                    activeChat,
                    backupTargetIdx,
                    updatedData,
                    safeUpdateMessageBlock,
                    safeSaveChat,
                    effectiveMaxKeep,
                    undefined,
                    false
                );
            } else {
                await safeSaveChat();
            }
        }
        setTimeout(() => triggerObserverNow(), 50);
    } catch (err) {
        console.error(`[RPG Tracker] Error persisting quiet update (${noticePrefix}):`, err);
        if (typeof window.RPGBridge.saveChatData === 'function') {
            const effectiveMaxKeep = settings.keepAllBackups === true ? -1 : (settings.maxBackupCount ?? 20);
            window.RPGBridge.saveChatData(updatedData, effectiveMaxKeep, null, false);
        }
    }
}

export function establishBridgeConnection(extensionName) {
    const connectionInterval = setInterval(() => {
        if (window.RPGBridge && typeof window.RPGBridge.syncSettings === 'function') {
            clearInterval(connectionInterval);

            window.RPGBridge.latestSettings = extension_settings[extensionName] || null;
            window.RPGBridge.isQuietUpdating = false;

            const historySubscribers = new Set();
            window.RPGBridge.subscribeHistoryChange = (callback) => {
                historySubscribers.add(callback);
                return () => {
                    historySubscribers.delete(callback);
                };
            };

            window.RPGBridge.notifyHistoryChange = () => {
                historySubscribers.forEach(cb => {
                    try {
                        cb();
                    } catch (err) {
                        console.warn("[RPG Tracker] History subscriber callback error:", err);
                    }
                });
            };

            window.RPGBridge.getCurrentChatKey = () => getChatKey(getContext());
            window.RPGBridge.recordChatLocks = (tracker) => chatLocks.remember(tracker);
            window.RPGBridge.applyChatLocks = (tracker) => chatLocks.restore(tracker);

            window.RPGBridge.getChatPromptSettings = () => chatPrompts.get();
            window.RPGBridge.saveChatPromptSettings = (settings) => {
                chatPrompts.save(settings);
                window.RPGBridge.currentPromptSettings = chatPrompts.get() || getDefaultPromptSettings();
            };

            window.RPGBridge.updatePromptSettings = (newSettings) => {
                chatPrompts.save(newSettings);
                const updated = chatPrompts.get() || getDefaultPromptSettings();
                window.RPGBridge.currentPromptSettings = updated;
                if (typeof window.RPGBridge.syncPromptSettings === 'function') {
                    window.RPGBridge.syncPromptSettings(updated);
                }
                if (typeof window.RPGBridge.refreshPrompts === 'function') {
                    window.RPGBridge.refreshPrompts();
                }
            };

            window.RPGBridge.createSaveTarget = () => {
                const context = getContext();
                const index = (context.chat?.length || 0) - 1;
                const message = context.chat?.[index];
                const swipeId = resolveActiveSwipeId(message);
                return {
                    chatKey: getChatKey(context),
                    message,
                    index,
                    sendDate: message?.send_date || null,
                    swipeId
                };
            };

            const presetStoreInstance = createPresetStore({
                extensionName,
                getRequestHeaders,
                syncPresets: (presets) => {
                    extension_settings[extensionName] = extension_settings[extensionName] || {};
                    extension_settings[extensionName].presets = presets;
                    window.RPGBridge.latestSettings = extension_settings[extensionName];
                    if (typeof window.RPGBridge.syncSettings === 'function') {
                        window.RPGBridge.syncSettings({ presets });
                    }
                }
            });
            window.RPGBridge.presetStore = presetStoreInstance;

            window.RPGBridge.writeExtensionFieldNatively = async (characterId, key, value) => {
                if (typeof writeExtensionField === 'function') {
                    try {
                        await writeExtensionField(characterId, key, value);
                        return true;
                    } catch (err) {
                        console.error("[RPG Tracker] writeExtensionField failed:", err);
                        return false;
                    }
                }
                console.warn("[RPG Tracker] writeExtensionField is not available on SillyTavern extensions API");
                return false;
            };

            window.RPGBridge.getSTSettingsCharacterSyncs = (chatId) => {
                if (!chatId) return null;
                const targetSrc = window.RPGBridge.latestSettings || extension_settings[extensionName];
                return targetSrc?.characterSyncs?.[chatId] || null;
            };

            if (!window.RPGBridge.syncSettings._isWrapped) {
                const nativeSyncSettings = window.RPGBridge.syncSettings;
                const wrappedSyncSettings = (stSettings) => {
                    if (stSettings) {
                        window.RPGBridge.latestSettings = {
                            ...(window.RPGBridge.latestSettings || {}),
                            ...stSettings
                        };
                        if (typeof nativeSyncSettings === 'function') {
                            nativeSyncSettings(stSettings);
                        }
                    }
                };
                wrappedSyncSettings._isWrapped = true;
                window.RPGBridge.syncSettings = wrappedSyncSettings;
            }

            window.RPGBridge.getThumbnailUrl = (type, filename) => {
                try {
                    if (typeof getThumbnailUrl === 'function') {
                        let url = getThumbnailUrl(type, filename);
                        if (!url) {
                            const fallbackType = type === 'persona' ? 'avatar' : 'persona';
                            url = getThumbnailUrl(fallbackType, filename);
                        }
                        return url;
                    }
                } catch (e) {
                    console.warn("[RPG Tracker] Failed to retrieve native thumbnail URL:", e);
                }
                return null;
            };

            window.RPGBridge.getAvailableModels = getAvailableModels;
            window.RPGBridge.getAvailableOpenRouterProviders = getAvailableOpenRouterProviders;
            window.RPGBridge.triggerObserverNow = triggerObserverNow;

            window.RPGBridge.saveSettings = (updatedSettings) => {
                extension_settings[extensionName] = extension_settings[extensionName] || {};
                Object.assign(extension_settings[extensionName], updatedSettings);
                window.RPGBridge.latestSettings = extension_settings[extensionName];
                saveSettingsDebounced();
                backupSettingsToLocalStorage(extensionName);
            };

            window.RPGBridge.saveChatData = (updatedTracker, maxBackupCount, target = null, shouldPurge = false) => {
                const context = getContext();
                const currentChat = context?.chat;
                if (!Array.isArray(currentChat) || currentChat.length === 0) return;

                let lastIndex = -1;
                if (target?.message) {
                    lastIndex = currentChat.indexOf(target.message);
                }
                if (lastIndex === -1 && target?.sendDate) {
                    lastIndex = currentChat.findIndex(m => m && m.send_date === target.sendDate);
                }
                if (lastIndex === -1 && target && typeof target.index === 'number') {
                    if (currentChat[target.index] === target.message) {
                        lastIndex = target.index;
                    }
                }
                if (lastIndex === -1) {
                    lastIndex = currentChat.length - 1;
                }

                if (lastIndex < 0 || lastIndex >= currentChat.length) {
                    return;
                }

                const cleanTracker = sanitizeTrackerData(updatedTracker);
                chatLocks.remember(cleanTracker);

                const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || {};
                let effectiveMaxKeep = 20;

                if (settings.keepAllBackups === true) {
                    effectiveMaxKeep = -1;
                } else if (settings.maxBackupCount !== undefined) {
                    effectiveMaxKeep = settings.maxBackupCount;
                } else if (maxBackupCount !== undefined) {
                    effectiveMaxKeep = maxBackupCount;
                }

                const messageSnapshot = stripPromptSettings(JSON.parse(JSON.stringify(cleanTracker)));

                backupToMessage(
                    currentChat,
                    lastIndex,
                    messageSnapshot,
                    safeUpdateMessageBlock,
                    safeSaveChat,
                    effectiveMaxKeep,
                    target?.swipeId,
                    shouldPurge
                );
            };

            window.RPGBridge.rehydrateFromHistory = () => rehydrateFromHistory(getContext().chat);
            window.RPGBridge.rehydrateFromHistoryAsync = async () => await rehydrateFromHistoryAsync(getContext().chat);

            window.RPGBridge.getChatTurnHistory = () => {
                const context = getContext();
                if (!context || !Array.isArray(context.chat)) return [];
                return getChatTurnHistory(context.chat);
            };

            window.RPGBridge.setTurnPinned = async (msgOrIndex, swipeId, isPinned, sendDate = null, turnId = null) => {
                const context = getContext();
                const currentChat = context?.chat;
                if (!Array.isArray(currentChat) || currentChat.length === 0) return false;

                const resolvedIndex = resolveMessageIndex(currentChat, msgOrIndex, sendDate, turnId);
                if (resolvedIndex < 0) return false;

                const success = setTurnSnapshotPinned(currentChat[resolvedIndex], swipeId, isPinned);
                if (success) {
                    safeUpdateMessageBlock(resolvedIndex, currentChat[resolvedIndex]);
                    await safeSaveChat();
                    window.RPGBridge.notifyHistoryChange();
                }
                return success;
            };

            window.RPGBridge.updateTurnSnapshotData = async (msgOrIndex, swipeId, newTrackerData, sendDate = null, turnId = null) => {
                const context = getContext();
                const currentChat = context?.chat;
                if (!Array.isArray(currentChat) || currentChat.length === 0) return false;

                const resolvedIndex = resolveMessageIndex(currentChat, msgOrIndex, sendDate, turnId);
                if (resolvedIndex < 0) return false;

                if (typeof window.RPGBridge.cancelPendingSave === 'function') {
                    window.RPGBridge.cancelPendingSave();
                }

                const cleanData = sanitizeTrackerData(newTrackerData);

                const success = await updateTurnSnapshotData(
                    currentChat,
                    resolvedIndex,
                    {
                        swipeId,
                        newTrackerData: cleanData,
                        updateMessageFn: safeUpdateMessageBlock,
                        saveChatFn: safeSaveChat,
                        sendDate,
                        turnId
                    }
                );

                if (success) {
                    if (typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
                        await window.RPGBridge.syncFromHistoryOrMeta();
                    }
                    setTimeout(() => triggerObserverNow(), 50);
                    window.RPGBridge.notifyHistoryChange();
                }
                return success;
            };

            window.RPGBridge.deleteTurnSnapshot = async (msgOrIndex, swipeId, sendDate = null, turnId = null) => {
                const context = getContext();
                const currentChat = context?.chat;
                if (!Array.isArray(currentChat) || currentChat.length === 0) return false;

                const resolvedIndex = resolveMessageIndex(currentChat, msgOrIndex, sendDate, turnId);
                if (resolvedIndex < 0) return false;

                if (typeof window.RPGBridge.cancelPendingSave === 'function') {
                    window.RPGBridge.cancelPendingSave();
                }

                const success = await deleteTurnSnapshot(
                    currentChat,
                    resolvedIndex,
                    {
                        swipeId,
                        updateMessageFn: safeUpdateMessageBlock,
                        saveChatFn: safeSaveChat,
                        deleteDelta: true,
                        sendDate,
                        turnId
                    }
                );

                if (success) {
                    if (typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
                        await window.RPGBridge.syncFromHistoryOrMeta();
                    }
                    setTimeout(() => triggerObserverNow(), 50);
                    window.RPGBridge.notifyHistoryChange();
                }
                return success;
            };

            window.RPGBridge.restoreTurnSnapshot = async (snapshotData) => {
                if (!snapshotData) return false;
                const cleanData = sanitizeTrackerData(snapshotData);
                return restoreTurnSnapshotToLive(
                    cleanData,
                    (data) => chatLocks.restore(data),
                    (data) => {
                        const currentPrompts = chatPrompts.get() || getDefaultPromptSettings();
                        window.RPGBridge.currentTrackerData = data;
                        chatLocks.remember(data);

                        if (typeof window.RPGBridge.syncChatData === 'function') {
                            window.RPGBridge.syncChatData(data, currentPrompts);
                        }
                        if (typeof window.RPGBridge.refreshPrompts === 'function') {
                            window.RPGBridge.refreshPrompts(data);
                        }
                    },
                    async (data) => {
                        if (typeof window.RPGBridge.saveChatData === 'function') {
                            window.RPGBridge.saveChatData(data);
                        }
                        setTimeout(() => triggerObserverNow(), 50);
                        window.RPGBridge.notifyHistoryChange();
                    }
                );
            };

            window.RPGBridge.runManualPrune = async () => {
                const context = getContext();
                const currentChat = context?.chat;
                if (!Array.isArray(currentChat) || currentChat.length === 0) {
                    return { prunedCount: 0, pinnedCount: 0 };
                }

                const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || {};
                const effectiveMaxKeep = settings.keepAllBackups ? -1 : (settings.maxBackupCount ?? 20);

                const result = await manualPruneBackups(
                    currentChat,
                    effectiveMaxKeep,
                    safeSaveChat,
                    safeUpdateMessageBlock
                );

                setTimeout(() => triggerObserverNow(), 50);
                window.RPGBridge.notifyHistoryChange();
                return result;
            };

            window.RPGBridge.connectChat = (currentTrackerData) => {
                const context = getContext();
                if (context && context.chatId) {
                    const cleanData = sanitizeTrackerData(currentTrackerData);
                    chatLocks.remember(cleanData);

                    if (typeof window.RPGBridge.saveChatData === 'function') {
                        window.RPGBridge.saveChatData(cleanData);
                    }

                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(true);
                    }
                }
            };

            window.RPGBridge.disconnectChat = async () => {
                const context = getContext();
                if (context && context.chatId) {
                    const currentChat = context.chat;
                    if (Array.isArray(currentChat) && currentChat.length > 0) {
                        for (let i = 0; i < currentChat.length; i++) {
                            const msg = currentChat[i];
                            if (!msg || typeof msg !== 'object') continue;

                            let modified = false;

                            if (typeof msg.mes === 'string') {
                                const cleaned = cleanAllMessageTrackerTags(msg.mes, { stripDelta: true });
                                if (cleaned !== msg.mes) {
                                    msg.mes = cleaned;
                                    modified = true;
                                }
                            }

                            if (Array.isArray(msg.swipes)) {
                                msg.swipes = msg.swipes.map(swipe => {
                                    if (typeof swipe !== 'string') return swipe;
                                    const cleanedSwipe = cleanAllMessageTrackerTags(swipe, { stripDelta: true });
                                    if (cleanedSwipe !== swipe) modified = true;
                                    return cleanedSwipe;
                                });
                            }

                            if (modified) {
                                safeUpdateMessageBlock(i, msg);
                            }
                        }
                        await safeSaveChat();
                    }

                    clearAllExtensionPrompts(extensionName);

                    $('#rpg-message-card-styles').remove();
                    $('.rpg-msg-card-container').remove();
                    $('.rpg-snapshot-btn').remove();

                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(false);
                    }
                }
            };

            window.RPGBridge.updateMessageBlock = (index, messageObject) => {
                safeUpdateMessageBlock(index, messageObject);
            };

            window.RPGBridge.saveChat = async () => {
                await safeSaveChat();
            };

            window.RPGBridge.triggerCharacterGeneration = async (promptText, isPlayer = false) => {
                const trackerData = window.RPGBridge?.currentTrackerData;
                if (!trackerData) return;

                const requestChatKey = getChatKey(getContext());
                const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || {};
                const targetModel = settings.useCustomModel ? settings.customModel : null;

                const promptConfig = window.RPGBridge?.currentPromptSettings || chatPrompts.get() || trackerData;
                const header = promptConfig.systemPromptHeader_separated !== undefined ? promptConfig.systemPromptHeader_separated : DEFAULT_PROMPT_HEADER_SEP;
                const footer = promptConfig.systemPromptFooter_separated !== undefined ? promptConfig.systemPromptFooter_separated : DEFAULT_PROMPT_FOOTER_SEP;

                const defPrompt = buildUpdatePromptWrapper(trackerData, header, footer, isPlayer, promptConfig);

                try {
                    clearAllExtensionPrompts(extensionName);

                    if (typeof setExtensionPrompt === 'function' && typeof extension_prompt_types !== 'undefined') {
                        setExtensionPrompt(`${extensionName}_def`, defPrompt, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM || 0);
                    }

                    const instructionText = `[USER INSTRUCTION]\n${promptText}\n\nAnalyze the recent chat log above and output the generated character's status JSON block only.`;

                    const rawOutput = await executeQuietPromptWithModelOverride(extensionName, instructionText, targetModel, false, false);
                    if (getChatKey(getContext()) !== requestChatKey) return;

                    const { patch } = parseResponse(rawOutput);

                    if (patch && Object.keys(patch).length > 0) {
                        const normPatch = extractNormalizedPatch(patch);
                        const latestData = window.RPGBridge?.currentTrackerData || trackerData;
                        const lockedBase = chatLocks.restore(sanitizeTrackerData(latestData));
                        const patchedData = applyLLMPatch(lockedBase, normPatch, isPlayer);
                        const updatedData = chatLocks.restore(sanitizeTrackerData(patchedData));

                        chatLocks.remember(updatedData);

                        const appliedDelta = getAppliedDelta(lockedBase, updatedData);

                        if (Object.keys(appliedDelta).length > 0) {
                            await persistQuietUpdateDelta(
                                updatedData,
                                appliedDelta,
                                '[RPG Tracker] System has added a new character.',
                                settings
                            );
                        } else {
                            await sendSystemNotice("[RPG Tracker] Generation resulted in no state changes.");
                        }
                    } else {
                        await sendSystemNotice("[RPG Tracker] Generation failed (No valid JSON found).");
                    }
                } catch (e) {
                    console.error("[RPG Tracker] Character generation error:", e);
                } finally {
                    restoreExtensionPromptForCurrentMode(extensionName);
                }
            };

            window.RPGBridge.triggerManualUpdate = async () => {
                const trackerData = window.RPGBridge?.currentTrackerData;
                if (!trackerData || !Array.isArray(trackerData.characters)) return;

                const requestChatKey = getChatKey(getContext());
                const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || {};
                const targetModel = settings.useCustomModel ? settings.customModel : null;

                const promptConfig = window.RPGBridge?.currentPromptSettings || chatPrompts.get() || trackerData;
                const header = promptConfig.systemPromptHeader_separated !== undefined ? promptConfig.systemPromptHeader_separated : DEFAULT_PROMPT_HEADER_SEP;
                const footer = promptConfig.systemPromptFooter_separated !== undefined ? promptConfig.systemPromptFooter_separated : DEFAULT_PROMPT_FOOTER_SEP;

                const systemPromptText = buildUpdatePromptWrapper(trackerData, header, footer, null, promptConfig);

                try {
                    clearAllExtensionPrompts(extensionName);

                    if (typeof setExtensionPrompt === 'function' && typeof extension_prompt_types !== 'undefined') {
                        setExtensionPrompt(`${extensionName}_def`, systemPromptText, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM || 0);
                    }

                    const instructionText = "Analyze the recent chat log above against the baseline status, then output the delta JSON block containing ONLY actual changes that occurred in the chat. Do NOT advance time or date unless explicitly stated in the chat log.";

                    const rawOutput = await executeQuietPromptWithModelOverride(extensionName, instructionText, targetModel, false, false);
                    if (getChatKey(getContext()) !== requestChatKey) return;

                    const { patch } = parseResponse(rawOutput);

                    if (patch && Object.keys(patch).length > 0) {
                        const normPatch = extractNormalizedPatch(patch);
                        const latestData = window.RPGBridge?.currentTrackerData || trackerData;
                        const lockedBase = chatLocks.restore(sanitizeTrackerData(latestData));
                        const patchedData = applyLLMPatch(lockedBase, normPatch);
                        const updatedData = chatLocks.restore(sanitizeTrackerData(patchedData));

                        chatLocks.remember(updatedData);

                        const appliedDelta = getAppliedDelta(lockedBase, updatedData);

                        if (Object.keys(appliedDelta).length > 0) {
                            await persistQuietUpdateDelta(
                                updatedData,
                                appliedDelta,
                                '[RPG Tracker] Status has been manually updated.',
                                settings
                            );
                        } else {
                            await sendSystemNotice("[RPG Tracker] No valid updates found.");
                        }
                    } else {
                        await sendSystemNotice("[RPG Tracker] No valid updates found.");
                    }
                } catch (e) {
                    console.error("[RPG Tracker] Manual update error:", e);
                    throw e;
                } finally {
                    restoreExtensionPromptForCurrentMode(extensionName);
                }
            };

            window.RPGBridge.refreshPrompts = (customTrackerData = null) => {
                if (customTrackerData) {
                    const currentSettings = extension_settings[extensionName] || {};
                    const mode = currentSettings.updateMode || 'merged';
                    applyModularExtensionPrompts(extensionName, customTrackerData, mode, window.RPGBridge?.currentPromptSettings);
                } else {
                    restoreExtensionPromptForCurrentMode(extensionName);
                }
            };

            window.RPGBridge.getRequestHeaders = () => {
                if (typeof getRequestHeaders === 'function') return getRequestHeaders();
                return {};
            };

            window.RPGBridge.syncSettings(extension_settings[extensionName]);

            const syncFromHistoryOrMeta = async () => {
                if (window.RPGBridge && typeof window.RPGBridge.flushSave === 'function') {
                    window.RPGBridge.flushSave();
                }

                const context = getContext();
                if (!context || !context.chatId) {
                    if (typeof window.RPGBridge.resetToDefault === 'function') window.RPGBridge.resetToDefault();
                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') window.RPGBridge.setChatConnectionStatus(false);
                    return;
                }

                const currentSettings = extension_settings[extensionName] || {};
                const chatSyncs = currentSettings.characterSyncs?.[context.chatId];
                if (chatSyncs && typeof chatSyncs === 'object') {
                    let syncModified = false;
                    Object.values(chatSyncs).forEach(syncItem => {
                        if (cleanBase64Avatar(syncItem)) {
                            syncModified = true;
                        }
                    });
                    if (syncModified) {
                        saveSettingsDebounced();
                    }
                }

                let trackerData = null;
                if (Array.isArray(context.chat)) {
                    const { modifiedCount } = migrateChatHistoryMessages(context.chat);
                    if (modifiedCount > 0) {
                        console.log(`[RPG Tracker] Pre-emptively migrated ${modifiedCount} legacy message snapshot(s).`);
                        await safeSaveChat();
                    }

                    trackerData = await window.RPGBridge.rehydrateFromHistoryAsync();
                }

                if (trackerData) {
                    trackerData = sanitizeTrackerData(trackerData);
                    trackerData = chatLocks.restore(trackerData);
                    chatLocks.remember(trackerData);
                }

                let promptSettings = chatPrompts.get();
                if (!promptSettings) {
                    const extracted = trackerData ? extractPromptSettings(trackerData) : {};
                    const defaults = getDefaultPromptSettings();
                    promptSettings = {
                        ...defaults,
                        ...extracted
                    };
                    chatPrompts.save(promptSettings);
                }

                window.RPGBridge.currentPromptSettings = promptSettings;

                if (typeof window.RPGBridge.syncPromptSettings === 'function') {
                    window.RPGBridge.syncPromptSettings(promptSettings);
                }

                if (trackerData && typeof window.RPGBridge.syncChatData === 'function') {
                    if (Array.isArray(trackerData.characters)) {
                        hydrateCharacterMetadata(
                            trackerData.characters,
                            { ...context, user_avatar: user_avatar },
                            window.RPGBridge.latestSettings || extension_settings[extensionName]
                        );
                    }

                    window.RPGBridge.currentTrackerData = trackerData;
                    window.RPGBridge.syncChatData(trackerData, promptSettings);
                    if (typeof window.RPGBridge.refreshPrompts === 'function') {
                        window.RPGBridge.refreshPrompts(trackerData);
                    }
                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(true);
                    }
                } else if (typeof window.RPGBridge.resetToDefault === 'function') {
                    const cleanDefault = sanitizeTrackerData(getInitialTrackerData());
                    window.RPGBridge.currentTrackerData = cleanDefault;
                    chatLocks.remember(cleanDefault);
                    window.RPGBridge.resetToDefault();
                    if (typeof window.RPGBridge.refreshPrompts === 'function') {
                        window.RPGBridge.refreshPrompts(cleanDefault);
                    }
                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(true);
                    }
                }
            };

            window.RPGBridge.syncFromHistoryOrMeta = syncFromHistoryOrMeta;

            window.RPGBridge.refreshSettingsAndMetadata = () => {
                const context = getContext();
                const currentSettings = extension_settings[extensionName] || {};
                window.RPGBridge.latestSettings = currentSettings;
                if (typeof window.RPGBridge.syncSettings === 'function') {
                    window.RPGBridge.syncSettings(currentSettings);
                }

                const trackerData = window.RPGBridge.currentTrackerData;
                if (trackerData && Array.isArray(trackerData.characters)) {
                    hydrateCharacterMetadata(
                        trackerData.characters,
                        { ...context, user_avatar: user_avatar },
                        currentSettings
                    );
                    if (typeof window.RPGBridge.syncChatData === 'function') {
                        window.RPGBridge.syncChatData(trackerData, window.RPGBridge.currentPromptSettings);
                    }
                }
                restoreExtensionPromptForCurrentMode(extensionName);
            };

            syncFromHistoryOrMeta();
        }
    }, 100);

    setTimeout(() => clearInterval(connectionInterval), 10000);
}