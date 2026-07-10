// src/core/ExtensionBridge.js
import { getContext, extension_settings } from "../../../../../extensions.js";
import { saveSettingsDebounced, saveChat, saveChatConditional, updateMessageBlock, getRequestHeaders, generateQuietPrompt } from "../../../../../../script.js";
import { SlashCommandParser } from "../../../../../slash-commands/SlashCommandParser.js";
import { backupToMessage, rehydrateFromHistory, rehydrateFromHistoryAsync, applyLLMPatch, extractNormalizedPatch } from "./JSONTracker.js";
import { parseResponse } from "./ResponseParser.js";
import { buildDefinitionPromptWrapper, buildStatusPromptWrapper } from "./ActivePrompt.js";
import { DEFAULT_PROMPT_HEADER_SEP, DEFAULT_PROMPT_FOOTER_SEP } from "./PromptSchema.js";
import { setDeltaLog } from "../tracker/DeltaLogRenderer.js";

// 안전한 updateMessageBlock 래퍼
export function safeUpdateMessageBlock(index, messageObject) {
    if (typeof updateMessageBlock !== 'function') return;
    try {
        updateMessageBlock(index, messageObject);
    } catch (e) {
        setTimeout(() => {
            try {
                updateMessageBlock(index, messageObject);
            } catch (err) {
                console.warn("[RPG Tracker] Delayed updateMessageBlock failed:", err);
            }
        }, 100);
    }
}

export function establishBridgeConnection(extensionName) {
    const connectionInterval = setInterval(() => {
        if (window.RPGBridge && typeof window.RPGBridge.syncSettings === 'function') {
            clearInterval(connectionInterval);

            window.RPGBridge.saveSettings = (updatedSettings) => {
                extension_settings[extensionName] = extension_settings[extensionName] || {};
                Object.assign(extension_settings[extensionName], updatedSettings);
                saveSettingsDebounced();
            };

            window.RPGBridge.saveChatData = (updatedTracker, maxBackupCount) => {
                const context = getContext();
                const currentChat = context.chat;
                const lastIndex = currentChat ? currentChat.length - 1 : -1;

                const safeSaveChat = () => {
                    if (typeof saveChatConditional === 'function') saveChatConditional();
                    else if (!context.groupId && typeof saveChat === 'function') saveChat();
                };

                if (currentChat && lastIndex >= 0) {
                    backupToMessage(currentChat, lastIndex, updatedTracker, safeUpdateMessageBlock, safeSaveChat, maxBackupCount);
                }
            };

            window.RPGBridge.rehydrateFromHistory = () => rehydrateFromHistory(getContext().chat);
            window.RPGBridge.rehydrateFromHistoryAsync = async () => await rehydrateFromHistoryAsync(getContext().chat);

            window.RPGBridge.connectChat = (currentTrackerData) => {
                const context = getContext();
                if (context && context.chatId) {
                    if (typeof window.RPGBridge.saveChatData === 'function') {
                        window.RPGBridge.saveChatData(currentTrackerData, 20);
                    }
                    if (typeof saveChatConditional === 'function') saveChatConditional();
                    else if (!context.groupId && typeof saveChat === 'function') saveChat();

                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(true);
                    }
                }
            };

            window.RPGBridge.disconnectChat = () => {
                const context = getContext();
                if (context && context.chatId) {
                    const currentChat = context.chat;
                    if (currentChat && currentChat.length > 0) {
                        for (let i = 0; i < currentChat.length; i++) {
                            const msg = currentChat[i];
                            if (msg && msg.mes && (msg.mes.includes('<!--RPG_TRACKER:') || msg.mes.includes('<!--RPG_DATA:') || msg.mes.includes('<!--RPG_DELTA:'))) {
                                msg.mes = msg.mes.replace(/<!--RPG_TRACKER:([\s\S]*?)-->/g, '').trim();
                                msg.mes = msg.mes.replace(/<!--RPG_DATA:([\s\S]*?)-->/g, '').trim();
                                msg.mes = msg.mes.replace(/<!--RPG_DELTA:([\s\S]*?)-->/g, '').trim();
                                safeUpdateMessageBlock(i, msg);
                            }
                        }
                        if (typeof saveChatConditional === 'function') saveChatConditional();
                        else if (!context.groupId && typeof saveChat === 'function') saveChat();
                    }

                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(false);
                    }
                }
            };
            
            // ST 메시지 블록 업데이트 및 채팅 저장용 안전 래퍼 노출
            window.RPGBridge.updateMessageBlock = (index, messageObject) => {
                safeUpdateMessageBlock(index, messageObject);
            };

            window.RPGBridge.saveChat = () => {
                if (typeof saveChatConditional === 'function') {
                    saveChatConditional();
                } else if (!getContext().groupId && typeof saveChat === 'function') {
                    saveChat();
                }
            };

            // 캐릭터 자동 생성 트리거
            window.RPGBridge.triggerCharacterGeneration = async (promptText, isPlayer = false) => {
                const trackerData = window.RPGBridge?.currentTrackerData;
                if (!trackerData) return;

                const header = trackerData.systemPromptHeader_separated !== undefined ? trackerData.systemPromptHeader_separated : DEFAULT_PROMPT_HEADER_SEP;
                const footer = trackerData.systemPromptFooter_separated !== undefined ? trackerData.systemPromptFooter_separated : DEFAULT_PROMPT_FOOTER_SEP;

                const defPrompt = buildDefinitionPromptWrapper(trackerData, header, footer, isPlayer);
                const combinedPrompt = `${defPrompt}\n\n[USER INSTRUCTION]\n${promptText}\n\n${footer}\n\nOutput the generated character's status JSON block only.`;

                try {
                    const rawOutput = await generateQuietPrompt(combinedPrompt);
                    const { patch } = parseResponse(rawOutput);

                    if (patch && Object.keys(patch).length > 0) {
                        // 입력 데이터 정규화 후 패치 적용
                        const normPatch = extractNormalizedPatch(patch);
                        const updatedData = applyLLMPatch(trackerData, normPatch, isPlayer);
                        if (typeof window.RPGBridge.syncChatData === 'function') window.RPGBridge.syncChatData(updatedData);

                        try {
                            const sysText = `[RPG Tracker] System has added a new character. <!--RPG_DELTA:${JSON.stringify(normPatch)}-->`;
                            await SlashCommandParser.commands['sys'].callback({}, sysText);

                            const newContext = getContext();
                            if (newContext && newContext.chat) {
                                let lastSysMsgIdx = -1;
                                for (let i = newContext.chat.length - 1; i >= 0; i--) {
                                    if (newContext.chat[i] && typeof newContext.chat[i].mes === 'string' && newContext.chat[i].mes.includes('[RPG Tracker] System has added a new character')) {
                                        lastSysMsgIdx = i;
                                        break;
                                    }
                                }

                                if (lastSysMsgIdx !== -1) {
                                    const lastSysMsg = newContext.chat[lastSysMsgIdx];
                                    setDeltaLog(lastSysMsg, normPatch);
                                    safeUpdateMessageBlock(lastSysMsgIdx, lastSysMsg);
                                }
                            }
                            if (typeof saveChatConditional === "function") saveChatConditional();
                            else if (typeof saveChat === "function") saveChat();

                            if (typeof window.RPGBridge.saveChatData === 'function') window.RPGBridge.saveChatData(updatedData, 20);
                        } catch (err) {
                            if (typeof window.RPGBridge.saveChatData === 'function') window.RPGBridge.saveChatData(updatedData, 20);
                        }
                    } else {
                        try {
                            await SlashCommandParser.commands['sys'].callback({}, "[RPG Tracker] Generation failed (No valid JSON found).");
                        } catch (err) { }
                    }
                } catch (e) {
                    console.error("[RPG Tracker] Character generation error:", e);
                }
            };

            // 수동 업데이트 트리거
            window.RPGBridge.triggerManualUpdate = async () => {
                const trackerData = window.RPGBridge?.currentTrackerData;
                if (!trackerData || !Array.isArray(trackerData.characters)) return;

                const header = trackerData.systemPromptHeader_separated !== undefined ? trackerData.systemPromptHeader_separated : DEFAULT_PROMPT_HEADER_SEP;
                const footer = trackerData.systemPromptFooter_separated !== undefined ? trackerData.systemPromptFooter_separated : DEFAULT_PROMPT_FOOTER_SEP;

                const defPrompt = buildDefinitionPromptWrapper(trackerData, header, footer);
                const statusPrompt = buildStatusPromptWrapper(trackerData);
                const combinedPrompt = `${defPrompt}\n\n${statusPrompt}\n\nAnalyze the current situation and output the updated status JSON block only.`;

                try {
                    const rawOutput = await generateQuietPrompt(combinedPrompt);
                    const { patch } = parseResponse(rawOutput);

                    if (patch && Object.keys(patch).length > 0) {
                        // 입력 데이터 정규화 후 패치 적용
                        const normPatch = extractNormalizedPatch(patch);
                        const updatedData = applyLLMPatch(trackerData, normPatch);
                        if (typeof window.RPGBridge.syncChatData === 'function') window.RPGBridge.syncChatData(updatedData);

                        try {
                            const sysText = `[RPG Tracker] Status has been manually updated. <!--RPG_DELTA:${JSON.stringify(normPatch)}-->`;
                            await SlashCommandParser.commands['sys'].callback({}, sysText);

                            const newContext = getContext();
                            if (newContext && newContext.chat) {
                                let lastSysMsgIdx = -1;
                                for (let i = newContext.chat.length - 1; i >= 0; i--) {
                                    if (newContext.chat[i] && typeof newContext.chat[i].mes === 'string' && newContext.chat[i].mes.includes('[RPG Tracker] Status has been manually updated')) {
                                        lastSysMsgIdx = i;
                                        break;
                                    }
                                }

                                if (lastSysMsgIdx !== -1) {
                                    const lastSysMsg = newContext.chat[lastSysMsgIdx];
                                    setDeltaLog(lastSysMsg, normPatch);
                                    safeUpdateMessageBlock(lastSysMsgIdx, lastSysMsg);
                                }
                            }
                            if (typeof saveChatConditional === "function") saveChatConditional();
                            else if (typeof saveChat === "function") saveChat();

                            if (typeof window.RPGBridge.saveChatData === 'function') window.RPGBridge.saveChatData(updatedData, 20);
                        } catch (err) {
                            if (typeof window.RPGBridge.saveChatData === 'function') window.RPGBridge.saveChatData(updatedData, 20);
                        }
                    } else {
                        try {
                            await SlashCommandParser.commands['sys'].callback({}, "[RPG Tracker] No valid updates found.");
                        } catch (err) { }
                    }
                } catch (e) {
                    console.error("[RPG Tracker] Manual update error:", e);
                    throw e;
                }
            };

            window.RPGBridge.getUserPersonaName = () => {
                try { return getContext()?.name1 || 'Player'; } catch (e) { return 'Player'; }
            };

            window.RPGBridge.getRequestHeaders = () => {
                if (typeof getRequestHeaders === 'function') return getRequestHeaders();
                return {};
            };

            window.RPGBridge.syncSettings(extension_settings[extensionName]);

            const syncFromHistoryOrMeta = async () => {
                const context = getContext();
                if (!context || !context.chatId) {
                    if (typeof window.RPGBridge.resetToDefault === 'function') window.RPGBridge.resetToDefault();
                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') window.RPGBridge.setChatConnectionStatus(false);
                    return;
                }

                let trackerData = null;
                if (Array.isArray(context.chat)) {
                    trackerData = await window.RPGBridge.rehydrateFromHistoryAsync();
                }

                if (trackerData && typeof window.RPGBridge.syncChatData === 'function') {
                    window.RPGBridge.syncChatData(trackerData);
                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(true);
                    }
                } else if (typeof window.RPGBridge.resetToDefault === 'function') {
                    window.RPGBridge.resetToDefault();
                    if (typeof window.RPGBridge.setChatConnectionStatus === 'function') {
                        window.RPGBridge.setChatConnectionStatus(true);
                    }
                }
            };

            window.RPGBridge.syncFromHistoryOrMeta = syncFromHistoryOrMeta;
            syncFromHistoryOrMeta();
        }
    }, 100);

    setTimeout(() => clearInterval(connectionInterval), 10000);
}