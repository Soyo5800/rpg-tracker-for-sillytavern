import { getContext, extension_settings } from "../../../../../extensions.js";
import { generateQuietPrompt } from "../../../../../../script.js";
import { applyModularExtensionPrompts, clearAllExtensionPrompts } from "./ExtensionLifecycle.js";
import { rehydrateFromHistory } from "./JSONTracker.js";
import { getAvailableOpenRouterProviders, fetchProvidersForOpenRouterModel } from "./OpenRouterHelper.js";

export { getAvailableOpenRouterProviders, fetchProvidersForOpenRouterModel };

/**
 * Validates whether an intercepted HTTP request targets text completion generation.
 * Prevents interference with TTS, translation, vector embeddings, and other auxiliary services.
 */
function isTargetGenerationRequest(url, bodyObj) {
    if (!bodyObj || typeof bodyObj !== 'object' || Array.isArray(bodyObj)) {
        return false;
    }

    const normalizedUrl = String(url || '').toLowerCase();

    const excludedEndpoints = [
        '/audio', '/tts', 'speech', 'voice',
        '/translate', 'translation',
        '/embedding', 'vector', 'tokenize',
        '/sprites', '/thumbnails', '/tags', '/worldinfo'
    ];
    if (excludedEndpoints.some(token => normalizedUrl.includes(token))) {
        return false;
    }

    const hasModelField = 'model' in bodyObj;
    const hasPayloadField = Array.isArray(bodyObj.messages) || typeof bodyObj.prompt === 'string';

    const isKnownGenerationUrl =
        normalizedUrl.includes('/generate') ||
        normalizedUrl.includes('/completions') ||
        normalizedUrl.includes('chat/completions');

    return isKnownGenerationUrl && (hasModelField || hasPayloadField);
}

/**
 * Applies model override and OpenRouter provider routing configurations to the request payload.
 */
function applyModelOverride(bodyObj, targetModelName, settings) {
    bodyObj.model = targetModelName;

    const isOpenRouter = (bodyObj.chat_completion_source === 'openrouter') ||
                         (typeof targetModelName === 'string' && targetModelName.includes('/'));

    if (isOpenRouter) {
        const validProviders = Array.isArray(settings.customProviders)
            ? settings.customProviders.filter(p => typeof p === 'string' && p.trim() !== '')
            : [];

        const allowFallbacks = settings.customAllowFallbacks !== false;

        if (validProviders.length > 0) {
            bodyObj.provider = {
                order: validProviders,
                allow_fallbacks: allowFallbacks
            };
            bodyObj.openrouter_providers = validProviders;
        }

        bodyObj.allow_fallbacks = allowFallbacks;
        bodyObj.openrouter_allow_fallbacks = allowFallbacks;
    }
}

/**
 * Restores extension prompt configuration based on active injection settings and update mode.
 */
export function restoreExtensionPromptForCurrentMode(extensionName) {
    const currentSettings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || {};
    const context = typeof getContext === 'function' ? getContext() : (window.SillyTavern?.getContext?.() || {});
    const trackerData = window.RPGBridge?.currentTrackerData || (context?.chatId ? rehydrateFromHistory(context.chat) : null);

    if (!currentSettings.enabled || !trackerData || !Array.isArray(trackerData.characters)) {
        clearAllExtensionPrompts(extensionName);
        return;
    }

    const mode = currentSettings.updateMode || 'merged';
    const promptConfig = window.RPGBridge?.currentPromptSettings || window.RPGBridge?.getChatPromptSettings?.() || null;
    applyModularExtensionPrompts(extensionName, trackerData, mode, promptConfig);
}

/**
 * Executes quiet prompt with target model override and OpenRouter provider routing.
 * Intercepts text generation network calls strictly within the execution lifetime.
 */
export async function executeQuietPromptWithModelOverride(extensionName, prompt, customModel, sendChat = false, clearExtensionPrompt = true) {
    globalThis.rpgTracker_isQuietUpdating = true;
    if (window.RPGBridge) {
        window.RPGBridge.isQuietUpdating = true;
    }

    const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || {};

    const targetModelName = (typeof customModel === 'string' && customModel.trim() !== '')
        ? customModel.trim()
        : (settings.useCustomModel && settings.customModel ? settings.customModel.trim() : null);

    const shouldUseCustom = settings.useCustomModel && Boolean(targetModelName);

    if (clearExtensionPrompt) {
        clearAllExtensionPrompts(extensionName);
    }

    const originalFetch = window.fetch;

    if (shouldUseCustom && targetModelName) {
        window.fetch = async function (...args) {
            try {
                let [resource, config] = args;

                const url = typeof resource === 'string'
                    ? resource
                    : (resource && typeof resource === 'object' && resource.url ? resource.url : (resource ? resource.toString() : ''));

                // Case 1: Standard fetch(url, options) with JSON string body
                if (config && config.body && typeof config.body === 'string') {
                    try {
                        const bodyObj = JSON.parse(config.body);
                        if (isTargetGenerationRequest(url, bodyObj)) {
                            applyModelOverride(bodyObj, targetModelName, settings);
                            config.body = JSON.stringify(bodyObj);
                        }
                    } catch {
                        // Ignore non-JSON request body
                    }
                }
                // Case 2: fetch(Request) where body is encapsulated in Request instance
                else if (typeof Request !== 'undefined' && resource instanceof Request && (!config || !config.body)) {
                    try {
                        const clonedReq = resource.clone();
                        const reqText = await clonedReq.text();
                        if (reqText && typeof reqText === 'string') {
                            const bodyObj = JSON.parse(reqText);
                            if (isTargetGenerationRequest(url, bodyObj)) {
                                applyModelOverride(bodyObj, targetModelName, settings);
                                args[0] = new Request(resource, {
                                    body: JSON.stringify(bodyObj)
                                });
                            }
                        }
                    } catch {
                        // Ignore uncloneable or non-JSON request instance
                    }
                }
            } catch (e) {
                console.warn("[RPG Tracker] Fetch interceptor warning:", e);
            }
            return originalFetch.apply(this, args);
        };
    }

    try {
        return await generateQuietPrompt({
            quietPrompt: prompt,
            quietToLoud: sendChat,
            skipWIAN: false
        });
    } finally {
        window.fetch = originalFetch;

        globalThis.rpgTracker_isQuietUpdating = false;
        if (window.RPGBridge) {
            window.RPGBridge.isQuietUpdating = false;
        }
        restoreExtensionPromptForCurrentMode(extensionName);
    }
}

/**
 * Scans SillyTavern UI elements to retrieve available API models.
 */
export function getAvailableModels() {
    try {
        const $ = window.jQuery || window.$;
        if (!$) {
            return { api: 'default', currentModel: '', models: [] };
        }

        const context = typeof getContext === 'function' ? getContext() : (window.SillyTavern?.getContext?.() || {});
        const mainApi = ($('#main_api').val() || window.main_api || context?.main_api || '').toLowerCase();

        let activeSource = '';
        let $container = null;

        if (mainApi === 'openai') {
            activeSource = ($('#chat_completion_source').val() || '').toLowerCase();
            $container = activeSource
                ? $(`#openai_api [data-source="${activeSource}"], #openai_api #${activeSource}_form`).first()
                : $('#openai_api');
        } else if (mainApi === 'textgenerationwebui') {
            activeSource = ($('#textgen_type').val() || '').toLowerCase();
            $container = activeSource
                ? $(`#textgenerationwebui_api [data-tg-type="${activeSource}"]`).first()
                : $('#textgenerationwebui_api');
        } else if (mainApi === 'novel') {
            $container = $('#novel_api');
        } else if (mainApi === 'koboldhorde') {
            $container = $('#kobold_horde');
        } else if (mainApi === 'kobold') {
            $container = $('#kobold_api');
        }

        if (!$container || $container.length === 0) {
            $container = $('#top-settings-holder');
        }

        const modelMap = new Map();
        let currentModel = '';

        const $selects = $container.find('select').filter(function () {
            const id = (this.id || '').toLowerCase();
            if (!id.includes('model')) return false;
            const blacklist = ['auth', 'proxy', 'preset', 'sort', 'region', 'provider', 'quantization', 'format', 'type', 'strategy', 'middleout', 'resolution', 'aspect_ratio'];
            return !blacklist.some(keyword => id.includes(keyword));
        });

        $selects.each(function () {
            const val = $(this).val();
            if (val && typeof val === 'string' && !currentModel) {
                currentModel = val.trim();
            }

            $(this).find('option').each(function () {
                const optVal = ($(this).val() || $(this).text() || '').trim();
                const optLabel = ($(this).text() || optVal).trim();
                const lowerVal = optVal.toLowerCase();

                if (optVal &&
                    !lowerVal.includes('connect to') &&
                    !lowerVal.includes('click \'connect\'') &&
                    !lowerVal.includes('not loaded') &&
                    !lowerVal.includes('express mode') &&
                    !lowerVal.includes('full version')) {
                    if (!modelMap.has(optVal)) {
                        modelMap.set(optVal, optLabel || optVal);
                    }
                }
            });
        });

        if (modelMap.size === 0) {
            const $inputs = $container.find('input[list], input[id*="model"]').filter(function () {
                const id = (this.id || '').toLowerCase();
                return !id.includes('proxy') && !id.includes('key');
            });

            $inputs.each(function () {
                const listId = $(this).attr('list');
                if (listId) {
                    $(`#${listId} option`).each(function () {
                        const optVal = ($(this).val() || $(this).text() || '').trim();
                        if (optVal) modelMap.set(optVal, optVal);
                    });
                }
                const inputVal = $(this).val();
                if (inputVal && typeof inputVal === 'string' && !currentModel) {
                    currentModel = inputVal.trim();
                }
            });
        }

        return {
            api: activeSource || mainApi || 'default',
            currentModel: currentModel,
            models: Array.from(modelMap.entries()).map(([value, label]) => ({
                value,
                label: label && label !== value ? label : value
            }))
        };
    } catch (e) {
        console.warn("[RPG Tracker] Failed to extract API models:", e);
        return { api: 'default', currentModel: '', models: [] };
    }
}