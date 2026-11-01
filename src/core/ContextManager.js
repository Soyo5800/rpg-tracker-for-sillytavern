import { getContext, extension_settings } from "../../../../../extensions.js";
import { buildModularPrompts } from "./ActivePrompt.js";
import { DEFAULT_INJECTION_SETTINGS, INJECTION_TARGETS } from "./PromptSchema.js";

const registeredMacroKeys = new Set();

const MODULE_SUFFIX_MAP = {
    rules_defs: 'rules',
    status: 'status',
    addons_enforcer: 'addons'
};

/**
 * Retrieves and refreshes active outlet contents for prompt generation and macro interpolation.
 * Forces regeneration from the current live session tracker data when requested or when cache is empty.
 * @param {string} extensionName - Extension directory name.
 * @param {boolean} forceRefresh - If true, bypasses in-memory cache and recomputes from latest data.
 * @returns {Record<string, string>} Key-value map of outlet names to generated prompt texts.
 */
export function getActiveOutlets(extensionName = 'rpg-tracker-for-sillytavern', forceRefresh = false) {
    if (!forceRefresh && globalThis.rpgTrackerOutlets && Object.keys(globalThis.rpgTrackerOutlets).length > 0) {
        return globalThis.rpgTrackerOutlets;
    }

    const trackerData = window.RPGBridge?.currentTrackerData;
    if (!trackerData || !Array.isArray(trackerData.characters)) {
        return globalThis.rpgTrackerOutlets || {};
    }

    const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || extension_settings['rpg-tracker-for-sillytavern'] || {};
    if (settings.enabled === false) {
        globalThis.rpgTrackerOutlets = {};
        return {};
    }

    const updateMode = settings.updateMode || 'merged';
    const promptConfig = window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || trackerData;
    const modularContents = buildModularPrompts(trackerData, updateMode, { promptSettings: promptConfig });

    const injectionSettings = promptConfig.injectionSettings || trackerData.injectionSettings || DEFAULT_INJECTION_SETTINGS;
    const modulesConfig = injectionSettings.modules || DEFAULT_INJECTION_SETTINGS.modules;

    const outlets = {};

    Object.entries(MODULE_SUFFIX_MAP).forEach(([moduleKey, suffix]) => {
        const config = modulesConfig[moduleKey] || {};
        if (config.enabled === false) return;
        if (config.target === INJECTION_TARGETS.OUTLET) {
            const content = modularContents[moduleKey];
            if (content && typeof content === 'string' && content.trim() !== '') {
                const outletName = config.outletName || `rpg_${suffix}`;
                const trimmed = content.trim();
                outlets[outletName] = trimmed;

                if (extension_settings.extension_prompts) {
                    const wiOutletKey = `customWIOutlet_${outletName}`;
                    extension_settings.extension_prompts[wiOutletKey] = {
                        ...(extension_settings.extension_prompts[wiOutletKey] || {}),
                        value: trimmed,
                        position: -1,
                        depth: 0,
                        scan: Boolean(config.scan)
                    };
                }
            }
        }
    });

    globalThis.rpgTrackerOutlets = outlets;
    return outlets;
}

/**
 * Replaces outlet tags in text with cached or freshly resolved module contents.
 * Uses functional string replacement to prevent dollar-sign character corruption.
 * @param {string} text - Source text containing macro tags.
 * @returns {string} Text with outlet macros evaluated.
 */
function substituteOutletTagsInText(text) {
    if (!text || typeof text !== 'string') return text;
    const outlets = globalThis.rpgTrackerOutlets;
    if (!outlets || Object.keys(outlets).length === 0) return text;

    let processed = text.replace(/\{\{outlet(?:::|:)([\w_-]+)\}\}/gi, (match, outletName) => {
        if (outlets[outletName] !== undefined) {
            return outlets[outletName];
        }
        return match;
    });

    Object.keys(outlets).forEach(outletName => {
        const directTag = `{{${outletName}}}`;
        if (processed.includes(directTag)) {
            const regex = new RegExp(`\\{\\{${outletName}\\}\\}`, 'gi');
            processed = processed.replace(regex, () => outlets[outletName]);
        }
    });

    return processed;
}

/**
 * Registers SillyTavern native macros for all configured modular outlet keys.
 * Ensures dynamic fallback to live data if the macro is queried before cache initialization.
 * @param {string} extensionName - Extension directory name.
 */
export function registerOutletMacro(extensionName = 'rpg-tracker-for-sillytavern') {
    const context = typeof getContext === 'function' ? getContext() : (typeof window !== 'undefined' ? window.SillyTavern?.getContext?.() : null);
    const registerMacroFn = context?.registerMacro || (typeof window !== 'undefined' ? window.registerMacro : null);
    const getMacroFn = context?.getMacro || (typeof window !== 'undefined' ? window.getMacro : null);
    if (typeof registerMacroFn !== 'function') return;

    if (!registeredMacroKeys.has('outlet')) {
        try {
            const originalMacro = typeof getMacroFn === 'function' ? getMacroFn.call(context || window, 'outlet') : null;
            registerMacroFn.call(context || window, 'outlet', (outletName) => {
                if (outletName) {
                    if (!globalThis.rpgTrackerOutlets || globalThis.rpgTrackerOutlets[outletName] === undefined) {
                        getActiveOutlets(extensionName, true);
                    }
                    if (globalThis.rpgTrackerOutlets && globalThis.rpgTrackerOutlets[outletName] !== undefined) {
                        return globalThis.rpgTrackerOutlets[outletName];
                    }
                }
                if (typeof originalMacro === 'function') {
                    return originalMacro(outletName);
                }
                if (outletName && extension_settings?.extension_prompts?.[`customWIOutlet_${outletName}`]?.value) {
                    return extension_settings.extension_prompts[`customWIOutlet_${outletName}`].value;
                }
                if (outletName && window.extension_prompts?.[`customWIOutlet_${outletName}`]?.value) {
                    return window.extension_prompts[`customWIOutlet_${outletName}`].value;
                }
                return '';
            }, 'RPG Tracker modular outlet macro handler');
            registeredMacroKeys.add('outlet');
        } catch (e) {
            console.warn("[RPG Tracker] Failed to register base outlet macro:", e);
        }
    }

    const outlets = getActiveOutlets(extensionName);
    const outletNamesToRegister = new Set(['rpg_rules', 'rpg_status', 'rpg_addons', ...Object.keys(outlets)]);

    const promptConfig = window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || window.RPGBridge?.currentTrackerData;
    const modulesConfig = promptConfig?.injectionSettings?.modules || DEFAULT_INJECTION_SETTINGS.modules;
    Object.values(modulesConfig).forEach(cfg => {
        if (cfg?.outletName && typeof cfg.outletName === 'string' && cfg.outletName.trim() !== '') {
            outletNamesToRegister.add(cfg.outletName.trim());
        }
    });

    outletNamesToRegister.forEach(outletName => {
        const keysToRegister = [
            outletName,
            `outlet:${outletName}`,
            `outlet::${outletName}`
        ];

        keysToRegister.forEach(key => {
            if (!registeredMacroKeys.has(key)) {
                try {
                    registerMacroFn.call(context || window, key, () => {
                        if (!globalThis.rpgTrackerOutlets || globalThis.rpgTrackerOutlets[outletName] === undefined) {
                            getActiveOutlets(extensionName, true);
                        }
                        return globalThis.rpgTrackerOutlets?.[outletName] || '';
                    }, `RPG Tracker dynamic outlet macro: ${key}`);
                    registeredMacroKeys.add(key);
                } catch (e) {
                    console.warn(`[RPG Tracker] Failed to register macro for key ${key}:`, e);
                }
            }
        });
    });
}

/**
 * Registers generation interceptor for SillyTavern.
 * Performs in-chat outlet substitution and isolates quiet history slicing to RPG Tracker calls only.
 * @param {string} extensionName - Extension directory name.
 */
export function registerContextInterceptor(extensionName) {
    registerOutletMacro(extensionName);

    const interceptor = function RPGTracker_interceptGeneration(chat, _contextSize, _abort, _type) {
        if (!Array.isArray(chat) || chat.length === 0) return;

        getActiveOutlets(extensionName, true);
        registerOutletMacro(extensionName);

        if (globalThis.rpgTrackerOutlets && Object.keys(globalThis.rpgTrackerOutlets).length > 0) {
            for (let i = 0; i < chat.length; i++) {
                const msg = chat[i];
                if (msg && typeof msg.mes === 'string') {
                    const hasOutletTag = msg.mes.includes('{{outlet') || Object.keys(globalThis.rpgTrackerOutlets).some(k => msg.mes.includes(`{{${k}}}`));
                    if (hasOutletTag) {
                        chat[i] = {
                            ...msg,
                            mes: substituteOutletTagsInText(msg.mes)
                        };
                    }
                }
            }
        }

        const isMyQuiet = Boolean(globalThis.rpgTracker_isQuietUpdating || window.RPGBridge?.isQuietUpdating);
        if (!isMyQuiet) return;

        const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || extension_settings['rpg-tracker-for-sillytavern'] || {};
        const rawLimit = settings.contextMessageLimit;
        const limit = (rawLimit !== undefined && rawLimit !== null && !isNaN(Number(rawLimit))) ? Math.max(0, Number(rawLimit)) : 4;

        const instructionMessage = chat[chat.length - 1];
        const historyMessages = chat.slice(0, chat.length - 1);

        const validChatMessages = historyMessages.filter(msg => {
            if (!msg) return false;
            if (msg.is_system === true || msg.extra?.is_system === true || msg.extra?.type === 'system') return false;
            if (typeof msg.mes === 'string' && msg.mes.startsWith('[RPG Tracker]')) return false;
            return true;
        });

        const slicedHistory = limit > 0 ? validChatMessages.slice(-limit) : [];
        const finalChat = instructionMessage ? [...slicedHistory, instructionMessage] : slicedHistory;

        chat.splice(0, chat.length, ...finalChat);
    };

    globalThis.RPGTracker_interceptGeneration = interceptor;
    if (typeof window !== 'undefined') {
        window.RPGTracker_interceptGeneration = interceptor;
    }
}