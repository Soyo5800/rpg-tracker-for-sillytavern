import { getContext, extension_settings } from "../../../../../extensions.js";
import { eventSource, event_types, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from "../../../../../../script.js";
import { rehydrateFromHistory, rehydrateFromHistoryAsync, applyLLMPatch, extractNormalizedPatch, sanitizeTrackerData, resolveActiveSwipeId } from "./JSONTracker.js";
import { buildModularPrompts } from "./ActivePrompt.js";
import { DEFAULT_INJECTION_SETTINGS, INJECTION_TARGETS, normalizeInjectionSettings } from "./PromptSchema.js";
import { parseResponse } from "./ResponseParser.js";
import { setDeltaLog } from "../messagetracker/DeltaLogRenderer.js";
import { safeUpdateMessageBlock } from "./ExtensionBridge.js";
import { triggerObserverNow } from "./ExtensionObserver.js";
import { getChatKey } from "./TrackerLocks.js";
import { getAppliedDelta } from "./AppliedDelta.js";

export const EXTENSION_PROMPT_KEYS = {
    rules_defs: 'rules',
    status: 'status',
    addons_enforcer: 'addons'
};

/**
 * Clears all registered extension prompt keys.
 */
export function clearAllExtensionPrompts(extensionName) {
    const keys = [
        `${extensionName}_def`,
        `${extensionName}_rules`,
        `${extensionName}_status`,
        `${extensionName}_addons`
    ];

    keys.forEach(k => {
        if (extension_settings.extension_prompts?.[k]) {
            delete extension_settings.extension_prompts[k];
        }
        if (typeof setExtensionPrompt === 'function' && typeof extension_prompt_types !== 'undefined') {
            try {
                setExtensionPrompt(k, '', extension_prompt_types.IN_PROMPT, 0, false);
            } catch {
                // Ignore prompt clearance error
            }
        }
    });
}

/**
 * Injects decoupled prompt modules based on active configuration and update mode.
 */
export function applyModularExtensionPrompts(extensionName, trackerData, updateMode = 'merged', promptSettings = null) {
    if (!trackerData || typeof setExtensionPrompt !== 'function' || typeof extension_prompt_types === 'undefined') {
        return;
    }

    if (extension_settings.extension_prompts?.[`${extensionName}_def`]) {
        delete extension_settings.extension_prompts[`${extensionName}_def`];
        try {
            setExtensionPrompt(`${extensionName}_def`, '', extension_prompt_types.IN_PROMPT, 0, false);
        } catch {
            // Ignore legacy prompt clearance error
        }
    }

    const cleanTrackerData = sanitizeTrackerData(trackerData);
    const promptConfig = promptSettings || window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || cleanTrackerData;
    const modularContents = buildModularPrompts(cleanTrackerData, updateMode, { promptSettings: promptConfig });

    const rawInjectionSettings = promptConfig.injectionSettings || cleanTrackerData.injectionSettings || DEFAULT_INJECTION_SETTINGS;
    const injectionSettings = normalizeInjectionSettings(rawInjectionSettings);
    const modulesConfig = injectionSettings.modules;

    Object.entries(EXTENSION_PROMPT_KEYS).forEach(([moduleKey, suffix]) => {
        const promptKey = `${extensionName}_${suffix}`;
        const config = modulesConfig[moduleKey] || {};
        const content = modularContents[moduleKey];

        const target = config.target || (moduleKey === 'rules_defs' ? INJECTION_TARGETS.SYSTEM : INJECTION_TARGETS.CHAT);
        const depth = typeof config.depth === 'number' ? config.depth : (moduleKey === 'status' ? 1 : 0);
        const role = typeof config.role === 'number' ? config.role : (extension_prompt_roles?.SYSTEM ?? 0);

        if (config.enabled === false || !content || content.trim() === '') {
            if (extension_settings.extension_prompts?.[promptKey]) {
                delete extension_settings.extension_prompts[promptKey];
            }
            try {
                setExtensionPrompt(promptKey, '', extension_prompt_types.IN_PROMPT, 0, false);
            } catch {
                // Ignore prompt reset error
            }
            return;
        }

        if (target === INJECTION_TARGETS.SYSTEM) {
            setExtensionPrompt(
                promptKey,
                content.trim(),
                extension_prompt_types.IN_PROMPT,
                0,
                false,
                role
            );
            return;
        }

        if (target === INJECTION_TARGETS.CHAT) {
            setExtensionPrompt(
                promptKey,
                content.trim(),
                extension_prompt_types.IN_CHAT,
                Math.max(0, depth),
                false,
                role
            );
        }
    });
}

/**
 * Registers generation lifecycle hooks for prompt management and response parsing.
 */
export function registerLifecycleEvents(extensionName) {
    let generationChatKey = null;
    let isCurrentGenerationQuiet = false;
    let isProcessingGenerationEnd = false;
    let lastProcessedGenEndAt = 0;

    eventSource.on(event_types.GENERATION_STARTED, () => {
        lastProcessedGenEndAt = 0;
        if (window.RPGBridge && typeof window.RPGBridge.flushSave === 'function') {
            window.RPGBridge.flushSave();
        }

        const isQuiet = Boolean(window.RPGBridge?.isQuietUpdating || globalThis.rpgTracker_isQuietUpdating);
        isCurrentGenerationQuiet = isQuiet;

        if (isQuiet) return;

        generationChatKey = getChatKey(getContext());

        if (!extension_settings[extensionName]?.enabled) {
            clearAllExtensionPrompts(extensionName);
            return;
        }

        const context = getContext();
        const trackerData = window.RPGBridge?.currentTrackerData || (context?.chatId ? rehydrateFromHistory(context.chat) : null);

        if (!trackerData || !Array.isArray(trackerData.characters)) {
            clearAllExtensionPrompts(extensionName);
            return;
        }

        const cleanTracker = sanitizeTrackerData(trackerData);
        const promptConfig = window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || cleanTracker;
        const updateMode = extension_settings[extensionName].updateMode || 'merged';
        applyModularExtensionPrompts(extensionName, cleanTracker, updateMode, promptConfig);
    });

    const processGenerationEnd = async () => {
        if (!extension_settings[extensionName]?.enabled) return;
        if (isProcessingGenerationEnd) return;

        const now = Date.now();
        if (lastProcessedGenEndAt > 0 && (now - lastProcessedGenEndAt) < 300) {
            return;
        }

        isProcessingGenerationEnd = true;
        lastProcessedGenEndAt = now;

        try {
            if (isCurrentGenerationQuiet || window.RPGBridge?.isQuietUpdating || globalThis.rpgTracker_isQuietUpdating) {
                isCurrentGenerationQuiet = false;
                return;
            }
            isCurrentGenerationQuiet = false;

            const context = getContext();
            if (generationChatKey && generationChatKey !== getChatKey(context)) return;

            if (context && context.chat && context.chat.length > 0) {
                const lastIndex = context.chat.length - 1;
                const lastMessage = context.chat[lastIndex];

                if (lastMessage && lastMessage.is_user === false && typeof lastMessage.mes === 'string') {
                    const text = lastMessage.mes;
                    const { cleanedText, patch } = parseResponse(text);
                    const activeSwipeId = resolveActiveSwipeId(lastMessage);

                    const currentSettings = extension_settings[extensionName] || {};
                    const effectiveMaxKeep = currentSettings.keepAllBackups === true ? -1 : (currentSettings.maxBackupCount ?? 20);

                    if (patch && Object.keys(patch).length > 0) {
                        if (Array.isArray(lastMessage.swipes) && lastMessage.swipes.length > activeSwipeId) {
                            lastMessage.swipes[activeSwipeId] = cleanedText;
                        }
                        lastMessage.mes = cleanedText;

                        const normPatch = extractNormalizedPatch(patch);
                        const recovered = window.RPGBridge?.currentTrackerData || (await rehydrateFromHistoryAsync(context.chat));
                        if (generationChatKey && generationChatKey !== getChatKey(getContext())) return;

                        const baseClean = sanitizeTrackerData(recovered);
                        const trackerData = window.RPGBridge?.applyChatLocks?.(baseClean) || baseClean;

                        if (trackerData && Array.isArray(trackerData.characters)) {
                            const patched = applyLLMPatch(trackerData, normPatch);
                            const sanitizedPatched = sanitizeTrackerData(patched);
                            const updatedData = window.RPGBridge?.applyChatLocks?.(sanitizedPatched) || sanitizedPatched;

                            window.RPGBridge?.recordChatLocks?.(updatedData);

                            const appliedDelta = getAppliedDelta(trackerData, updatedData);
                            setDeltaLog(lastMessage, appliedDelta);

                            if (window.RPGBridge && typeof window.RPGBridge.syncChatData === 'function') {
                                window.RPGBridge.syncChatData(updatedData);
                            }
                            if (window.RPGBridge && typeof window.RPGBridge.saveChatData === 'function') {
                                window.RPGBridge.saveChatData(updatedData, effectiveMaxKeep, null, true);
                            }
                        }

                        safeUpdateMessageBlock(lastIndex, lastMessage);
                    } else {
                        const currentTracker = window.RPGBridge?.currentTrackerData || (await rehydrateFromHistoryAsync(context.chat));
                        if (currentTracker && window.RPGBridge && typeof window.RPGBridge.saveChatData === 'function') {
                            const cleanCurrent = sanitizeTrackerData(currentTracker);
                            window.RPGBridge.saveChatData(cleanCurrent, effectiveMaxKeep, null, true);
                        }
                    }

                    setTimeout(() => triggerObserverNow(), 50);
                }
            }
        } finally {
            isProcessingGenerationEnd = false;
        }
    };

    eventSource.on(event_types.GENERATION_ENDED, processGenerationEnd);
    eventSource.on(event_types.GENERATION_STOPPED, processGenerationEnd);
}