import { getContext, extension_settings } from "../../../../../extensions.js";
import { eventSource, event_types, saveChat, saveChatConditional, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from "../../../../../../script.js";
import { rehydrateFromHistory, rehydrateFromHistoryAsync, applyLLMPatch, extractNormalizedPatch } from "./JSONTracker.js";
import { buildDefinitionPromptWrapper, buildCleanStatusPrompt, buildStaticDefinitionsPrompt, buildAddonSection } from "./ActivePrompt.js";
import { DEFAULT_PROMPT_HEADER_MERGED, DEFAULT_PROMPT_FOOTER_MERGED, DEFAULT_READONLY_CONTEXT_HEADER } from "./PromptSchema.js";
import { parseResponse } from "./ResponseParser.js";
import { setDeltaLog } from "../tracker/DeltaLogRenderer.js";
import { safeUpdateMessageBlock } from "./ExtensionBridge.js";
import { triggerObserverNow } from "./ExtensionObserver.js";

export function registerLifecycleEvents(extensionName) {
    eventSource.on(event_types.GENERATION_STARTED, () => {
        if (window.RPGBridge && typeof window.RPGBridge.flushSave === 'function') {
            window.RPGBridge.flushSave();
        }

        if (window.RPGBridge?.isQuietUpdating) return;
        if (!extension_settings[extensionName]?.enabled) return;

        if (extension_settings.extension_prompts?.[`${extensionName}_status`]) {
            delete extension_settings.extension_prompts[`${extensionName}_status`];
        }

        const context = getContext();
        const trackerData = window.RPGBridge?.currentTrackerData || (context?.chatId ? rehydrateFromHistory(context.chat) : null);

        if (!trackerData || !Array.isArray(trackerData.characters)) return;

        const updateMode = extension_settings[extensionName].updateMode || 'merged';

        if (updateMode === 'isolated') {
            const addonSection = buildAddonSection(trackerData);
            if (typeof extension_prompt_types !== 'undefined' && typeof setExtensionPrompt === 'function') {
                if (addonSection && addonSection.trim() !== '') {
                    setExtensionPrompt(`${extensionName}_def`, addonSection.trim(), extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM || 0);
                } else {
                    setExtensionPrompt(`${extensionName}_def`, '', extension_prompt_types.IN_PROMPT, 0, false);
                    delete extension_settings.extension_prompts[`${extensionName}_def`];
                }
            }
            return;
        }

        if (updateMode === 'separated') {
            const cleanStatusPrompt = buildCleanStatusPrompt(trackerData);
            const staticDefs = buildStaticDefinitionsPrompt(trackerData) || '';
            const readOnlyHeader = trackerData.systemPrompt_readonly !== undefined ? trackerData.systemPrompt_readonly : DEFAULT_READONLY_CONTEXT_HEADER;
            const addonSection = buildAddonSection(trackerData);

            const readOnlyPrompt = [readOnlyHeader, cleanStatusPrompt, staticDefs, addonSection]
                .filter(part => part && part.trim() !== '')
                .join('\n\n');

            if (typeof extension_prompt_types !== 'undefined' && typeof setExtensionPrompt === 'function') {
                setExtensionPrompt(`${extensionName}_def`, readOnlyPrompt, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM || 0);
            }
            return;
        }

        const header = trackerData.systemPromptHeader_merged !== undefined ? trackerData.systemPromptHeader_merged : DEFAULT_PROMPT_HEADER_MERGED;
        const footer = trackerData.systemPromptFooter_merged !== undefined ? trackerData.systemPromptFooter_merged : DEFAULT_PROMPT_FOOTER_MERGED;
        const finalPrompt = buildDefinitionPromptWrapper(trackerData, header, footer);

        if (typeof extension_prompt_types !== 'undefined' && typeof setExtensionPrompt === 'function') {
            setExtensionPrompt(`${extensionName}_def`, finalPrompt, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM || 0);
        }
    });

    const processGenerationEnd = async () => {
        if (!extension_settings[extensionName]?.enabled) return;

        const context = getContext();
        if (context && context.chat && context.chat.length > 0) {
            const lastMessage = context.chat[context.chat.length - 1];

            if (lastMessage && lastMessage.is_user === false && typeof lastMessage.mes === 'string') {
                const text = lastMessage.mes;
                const { cleanedText, patch } = parseResponse(text);

                if (patch && Object.keys(patch).length > 0) {
                    const activeSwipeId = lastMessage.swipe_id || 0;
                    if (Array.isArray(lastMessage.swipes) && lastMessage.swipes.length > activeSwipeId) {
                        lastMessage.swipes[activeSwipeId] = cleanedText;
                    }
                    lastMessage.mes = cleanedText;

                    const normPatch = extractNormalizedPatch(patch);
                    setDeltaLog(lastMessage, normPatch);

                    const trackerData = window.RPGBridge?.currentTrackerData || (await rehydrateFromHistoryAsync(context.chat));
                    if (trackerData && Array.isArray(trackerData.characters)) {
                        const updatedData = applyLLMPatch(trackerData, normPatch);
                        if (window.RPGBridge && typeof window.RPGBridge.syncChatData === 'function') {
                            window.RPGBridge.syncChatData(updatedData);
                        }
                        if (window.RPGBridge && typeof window.RPGBridge.saveChatData === 'function') {
                            window.RPGBridge.saveChatData(updatedData, 20);
                        }
                    }

                    safeUpdateMessageBlock(context.chat.length - 1, lastMessage);

                    if (typeof saveChatConditional === "function") saveChatConditional();
                    else if (typeof saveChat === "function") saveChat();

                    setTimeout(() => triggerObserverNow(), 50);
                }
            }
        }
    };

    eventSource.on(event_types.GENERATION_ENDED, processGenerationEnd);
    eventSource.on(event_types.GENERATION_STOPPED, processGenerationEnd);
}