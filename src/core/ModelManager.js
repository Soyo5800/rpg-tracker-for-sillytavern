import { getContext, extension_settings } from "../../../../../extensions.js";
import { generateQuietPrompt, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from "../../../../../../script.js";
import { buildDefinitionPromptWrapper, buildCleanStatusPrompt, buildStaticDefinitionsPrompt, buildAddonSection } from "./ActivePrompt.js";
import { DEFAULT_PROMPT_HEADER_MERGED, DEFAULT_PROMPT_FOOTER_MERGED, DEFAULT_READONLY_CONTEXT_HEADER } from "./PromptSchema.js";

/**
 * Restores extension prompt configuration based on active update mode.
 */
export function restoreExtensionPromptForCurrentMode(extensionName) {
    if (typeof setExtensionPrompt !== 'function' || typeof extension_prompt_types === 'undefined') return;

    const currentSettings = extension_settings[extensionName] || {};
    const mode = currentSettings.updateMode || 'merged';
    const trackerData = window.RPGBridge?.currentTrackerData;

    if (!currentSettings.enabled || !trackerData) {
        setExtensionPrompt(`${extensionName}_def`, '', extension_prompt_types.IN_PROMPT, 0, false);
        return;
    }

    if (mode === 'isolated') {
        const addonSection = buildAddonSection(trackerData);
        if (addonSection && addonSection.trim() !== '') {
            setExtensionPrompt(`${extensionName}_def`, addonSection.trim(), extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM || 0);
        } else {
            setExtensionPrompt(`${extensionName}_def`, '', extension_prompt_types.IN_PROMPT, 0, false);
        }
        return;
    }

    if (mode === 'separated') {
        const cleanStatusPrompt = buildCleanStatusPrompt(trackerData);
        const staticDefs = buildStaticDefinitionsPrompt(trackerData) || '';
        const readOnlyHeader = trackerData.systemPrompt_readonly !== undefined ? trackerData.systemPrompt_readonly : DEFAULT_READONLY_CONTEXT_HEADER;
        const addonSection = buildAddonSection(trackerData);
        
        const readOnlyPrompt = [readOnlyHeader, cleanStatusPrompt, staticDefs, addonSection]
            .filter(part => part && part.trim() !== '')
            .join('\n\n');

        setExtensionPrompt(`${extensionName}_def`, readOnlyPrompt, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM || 0);
    } else if (mode === 'merged') {
        const header = trackerData.systemPromptHeader_merged !== undefined ? trackerData.systemPromptHeader_merged : DEFAULT_PROMPT_HEADER_MERGED;
        const footer = trackerData.systemPromptFooter_merged !== undefined ? trackerData.systemPromptFooter_merged : DEFAULT_PROMPT_FOOTER_MERGED;
        const finalPrompt = buildDefinitionPromptWrapper(trackerData, header, footer);

        setExtensionPrompt(`${extensionName}_def`, finalPrompt, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM || 0);
    }
}

/**
 * Executes background quiet prompt with optional API model override.
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

    const shouldUseCustom = settings.useCustomModel && !!targetModelName;

    if (clearExtensionPrompt) {
        if (extension_settings.extension_prompts) {
            delete extension_settings.extension_prompts[`${extensionName}_def`];
            delete extension_settings.extension_prompts[`${extensionName}_status`];
        }
        if (typeof setExtensionPrompt === 'function' && typeof extension_prompt_types !== 'undefined') {
            try {
                setExtensionPrompt(`${extensionName}_def`, '', extension_prompt_types.IN_PROMPT, 0, false);
            } catch (e) {
                console.warn("[RPG Tracker] Clearing active extension prompt failed:", e);
            }
        }
    }

    const originalFetch = window.fetch;
    const originalAjax = (typeof $ !== 'undefined' && $.ajax) ? $.ajax : null;

    if (shouldUseCustom && targetModelName) {
        window.fetch = async function (...args) {
            try {
                let [resource, config] = args;
                if (config && config.body && typeof config.body === 'string') {
                    try {
                        const bodyObj = JSON.parse(config.body);
                        if (bodyObj && typeof bodyObj === 'object') {
                            if ('model' in bodyObj || resource.toString().includes('completions') || resource.toString().includes('generate')) {
                                bodyObj.model = targetModelName;
                                config.body = JSON.stringify(bodyObj);
                            }
                        }
                    } catch (parseErr) {
                        // Non-JSON payload, preserve original body
                    }
                }
            } catch (e) {
                console.warn("[RPG Tracker] Fetch interceptor warning:", e);
            }
            return originalFetch.apply(this, args);
        };

        if (originalAjax) {
            $.ajax = function (options) {
                if (options && options.data && typeof options.data === 'string') {
                    try {
                        const bodyObj = JSON.parse(options.data);
                        if (bodyObj && typeof bodyObj === 'object') {
                            if ('model' in bodyObj || (options.url && options.url.includes('generate'))) {
                                bodyObj.model = targetModelName;
                                options.data = JSON.stringify(bodyObj);
                            }
                        }
                    } catch (e) { }
                }
                return originalAjax.apply(this, arguments);
            };
        }
    }

    try {
        return await generateQuietPrompt(prompt, sendChat, false, 'quiet');
    } finally {
        window.fetch = originalFetch;
        if (originalAjax) {
            $.ajax = originalAjax;
        }

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
        const context = getContext();
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