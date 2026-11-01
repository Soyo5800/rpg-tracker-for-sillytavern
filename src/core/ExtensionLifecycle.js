import { getContext, extension_settings } from "../../../../../extensions.js";
import { eventSource, event_types, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from "../../../../../../script.js";
import { rehydrateFromHistory, rehydrateFromHistoryAsync, applyLLMPatch, extractNormalizedPatch, sanitizeTrackerData, resolveActiveSwipeId } from "./JSONTracker.js";
import { buildModularPrompts } from "./ActivePrompt.js";
import { DEFAULT_INJECTION_SETTINGS, INJECTION_TARGETS } from "./PromptSchema.js";
import { parseResponse } from "./ResponseParser.js";
import { setDeltaLog } from "../messagetracker/DeltaLogRenderer.js";
import { safeUpdateMessageBlock } from "./ExtensionBridge.js";
import { triggerObserverNow } from "./ExtensionObserver.js";
import { registerOutletMacro } from "./ContextManager.js";
import { getChatKey } from "./TrackerLocks.js";
import { getAppliedDelta } from "./AppliedDelta.js";

export const EXTENSION_PROMPT_KEYS = {
    rules_defs: 'rules',
    status: 'status',
    addons_enforcer: 'addons'
};

const WORLD_INFO_OUTLET_POSITION = 7;
const activeWiOutletKeys = new Set(['customWIOutlet_rpg_rules', 'customWIOutlet_rpg_status', 'customWIOutlet_rpg_addons']);

/**
 * Clears all registered extension prompt keys and resets outlet memory.
 */
export function clearAllExtensionPrompts(extensionName) {
    const keys = [
        `${extensionName}_def`,
        `${extensionName}_rules`,
        `${extensionName}_status`,
        `${extensionName}_addons`,
        ...Array.from(activeWiOutletKeys)
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

    if (globalThis.rpgTrackerOutlets) {
        globalThis.rpgTrackerOutlets = {};
    }
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

    activeWiOutletKeys.forEach(wiKey => {
        if (extension_settings.extension_prompts?.[wiKey]) {
            delete extension_settings.extension_prompts[wiKey];
        }
    });

    const cleanTrackerData = sanitizeTrackerData(trackerData);
    const promptConfig = promptSettings || window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || cleanTrackerData;
    const modularContents = buildModularPrompts(cleanTrackerData, updateMode, { promptSettings: promptConfig });

    const injectionSettings = promptConfig.injectionSettings || cleanTrackerData.injectionSettings || DEFAULT_INJECTION_SETTINGS;
    const modulesConfig = injectionSettings.modules || DEFAULT_INJECTION_SETTINGS.modules;

    globalThis.rpgTrackerOutlets = {};

    Object.entries(EXTENSION_PROMPT_KEYS).forEach(([moduleKey, suffix]) => {
        const promptKey = `${extensionName}_${suffix}`;
        const config = modulesConfig[moduleKey] || {};
        const content = modularContents[moduleKey];

        const target = config.target || (moduleKey === 'rules_defs' ? INJECTION_TARGETS.SYSTEM : INJECTION_TARGETS.CHAT);
        const depth = typeof config.depth === 'number' ? config.depth : (moduleKey === 'status' ? 1 : 0);
        const role = typeof config.role === 'number' ? config.role : (extension_prompt_roles?.SYSTEM ?? 0);
        const outletName = config.outletName || `rpg_${suffix}`;

        if (config.enabled === false || !content || content.trim() === '') {
            if (extension_settings.extension_prompts?.[promptKey]) {
                delete extension_settings.extension_prompts[promptKey];
            }
            try {
                setExtensionPrompt(promptKey, '', extension_prompt_types.IN_PROMPT, 0, false);
            } catch {
                // Ignore prompt reset error
            }

            const wiOutletKey = `customWIOutlet_${outletName}`;
            if (extension_settings.extension_prompts?.[wiOutletKey]) {
                delete extension_settings.extension_prompts[wiOutletKey];
            }
            try {
                const nonePosition = extension_prompt_types.NONE !== undefined ? extension_prompt_types.NONE : -1;
                setExtensionPrompt(wiOutletKey, '', nonePosition, 0, false);
            } catch {
                // Ignore outlet prompt reset error
            }

            delete globalThis.rpgTrackerOutlets?.[outletName];
            return;
        }

        if (target === INJECTION_TARGETS.OUTLET) {
            const cleanContent = content.trim();
            globalThis.rpgTrackerOutlets[outletName] = cleanContent;

            if (extension_settings.extension_prompts?.[promptKey]) {
                delete extension_settings.extension_prompts[promptKey];
            }
            try {
                setExtensionPrompt(promptKey, '', extension_prompt_types.IN_PROMPT, 0, false);
            } catch {
                // Ignore prompt reset error
            }

            const wiOutletKey = `customWIOutlet_${outletName}`;
            activeWiOutletKeys.add(wiOutletKey);
            const nonePosition = extension_prompt_types.NONE !== undefined ? extension_prompt_types.NONE : -1;
            try {
                setExtensionPrompt(
                    wiOutletKey,
                    cleanContent,
                    nonePosition,
                    0,
                    Boolean(config.scan),
                    role
                );
            } catch {
                // Ignore outlet prompt registration error
            }
            return;
        }

        if (target === INJECTION_TARGETS.BEFORE_PROMPT || target === 'before_prompt') {
            const beforeType = extension_prompt_types.BEFORE_PROMPT ?? 2;
            setExtensionPrompt(
                promptKey,
                content.trim(),
                beforeType,
                0,
                false,
                role
            );
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

    registerOutletMacro();
}

/**
 * Registers generation lifecycle hooks for prompt management and response parsing.
 */
export function registerLifecycleEvents(extensionName) {
    let generationChatKey = null;
    let isCurrentGenerationQuiet = false;
    let isProcessingGenerationEnd = false;
    let lastProcessedGenEndAt = 0;

    eventSource.on(event_types.WORLDINFO_ENTRIES_LOADED, ({ chatLore }) => {
        if (!extension_settings[extensionName]?.enabled) return;
        if (window.RPGBridge?.isQuietUpdating || globalThis.rpgTracker_isQuietUpdating) return;

        const context = getContext();
        const trackerData = window.RPGBridge?.currentTrackerData || (context?.chatId ? rehydrateFromHistory(context.chat) : null);
        if (!trackerData || !Array.isArray(trackerData.characters)) return;

        const cleanTracker = sanitizeTrackerData(trackerData);
        const promptConfig = window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || cleanTracker;
        const updateMode = extension_settings[extensionName].updateMode || 'merged';
        const modularContents = buildModularPrompts(cleanTracker, updateMode, { promptSettings: promptConfig });

        const injectionSettings = promptConfig.injectionSettings || cleanTracker.injectionSettings || DEFAULT_INJECTION_SETTINGS;
        const modulesConfig = injectionSettings.modules || DEFAULT_INJECTION_SETTINGS.modules;

        Object.entries(EXTENSION_PROMPT_KEYS).forEach(([moduleKey, suffix]) => {
            const config = modulesConfig[moduleKey] || {};
            if (config.enabled === false) return;
            if (config.target !== INJECTION_TARGETS.OUTLET) return;

            const content = modularContents[moduleKey];
            if (!content || !content.trim()) return;

            const outletName = config.outletName || `rpg_${suffix}`;

            chatLore.push({
                uid: `rpg_tracker_virtual_${suffix}`,
                world: 'rpg_tracker',
                key: [],
                keysecondary: [],
                comment: `RPG Tracker Outlet: ${outletName}`,
                content: content.trim(),
                constant: true,
                disable: false,
                position: WORLD_INFO_OUTLET_POSITION,
                outletName: outletName,
                ignoreBudget: true,
                useProbability: false,
                probability: 100,
                selective: false,
                order: 100,
                extensions: {
                    position: WORLD_INFO_OUTLET_POSITION,
                    outlet_name: outletName,
                    ignore_budget: true
                }
            });
        });
    });

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