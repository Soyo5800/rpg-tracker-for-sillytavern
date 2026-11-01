import { extension_settings } from "../../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../script.js";
import { cleanBase64Avatar } from "./JSONTracker_Migrator.js";
import { DEFAULT_SETTINGS } from "./PromptSchema.js";

const localStorageBackupKey = "rpg_tracker_settings_backup";

export const defaultSettings = DEFAULT_SETTINGS;

/**
 * Traverses extension settings and strips out legacy base64 image strings.
 * Prevents settings.json bloat and storage quota exhaustion.
 */
export function cleanBase64FromSettings(settings) {
    if (!settings || typeof settings !== 'object') return false;
    let modified = false;

    // 1. Clean character synchronization records across all chats
    if (settings.characterSyncs && typeof settings.characterSyncs === 'object') {
        Object.keys(settings.characterSyncs).forEach(chatId => {
            const chatSync = settings.characterSyncs[chatId];
            if (chatSync && typeof chatSync === 'object') {
                Object.keys(chatSync).forEach(charId => {
                    const item = chatSync[charId];
                    if (cleanBase64Avatar(item)) {
                        modified = true;
                    }
                });
            }
        });
    }

    // 2. Clean saved character presets
    if (Array.isArray(settings.presets)) {
        settings.presets.forEach(preset => {
            const charList = Array.isArray(preset?.data?.characters)
                ? preset.data.characters
                : (Array.isArray(preset?.characters) ? preset.characters : null);

            if (Array.isArray(charList)) {
                charList.forEach(char => {
                    if (cleanBase64Avatar(char)) {
                        modified = true;
                    }
                });
            }
        });
    }

    return modified;
}

export function backupSettingsToLocalStorage(extensionName) {
    if (extension_settings[extensionName]) {
        localStorage.setItem(localStorageBackupKey, JSON.stringify(extension_settings[extensionName]));
    }
}

export function restoreSettingsFromLocalStorage() {
    try {
        const backup = localStorage.getItem(localStorageBackupKey);
        if (backup) return JSON.parse(backup);
    } catch (e) {
        console.warn("[RPG Tracker] Failed to restore settings from localStorage:", e);
    }
    return null;
}

export function syncRpgTrackerRegex(enabled) {
    extension_settings.regex = extension_settings.regex || [];

    if (!enabled) {
        extension_settings.regex = extension_settings.regex.filter(s => !(s.id && s.id.startsWith('rpg_tracker')));
        saveSettingsDebounced();
        return;
    }

    const officialIds = ['rpg_tracker_json_stripper', 'rpg_tracker_delta_stripper'];
    extension_settings.regex = extension_settings.regex.filter(s => {
        if (s.id && s.id.startsWith('rpg_tracker')) {
            return officialIds.includes(s.id);
        }
        return true;
    });

    const flexibleJsonRegex = '<!--RPG_TRACKER\\s*(?:```(?:json|markdown)?\\s*\\n?)?\\{[\\s\\S]*?(?:\"[sS]tatus\"|\"[sS]tatus[sS]chema\"|\"[sS]tats\"|\"[pP]rofile\"|\"[iI]nventory\"|\"[qQ]uests\"|\"[cC]haracter [nN]ame\"|\"[wW]orld\"|\"[rR]elations\"|\"[eE]vents\")[\\s\\S]*?\\}(?:\\s*\\n?```)?\\s*-->\\s*';

    let script = extension_settings.regex.find(s => s.id === 'rpg_tracker_json_stripper');
    if (!script) {
        script = {
            id: 'rpg_tracker_json_stripper',
            scriptName: 'RPG Tracker JSON Stripper',
            findRegex: flexibleJsonRegex,
            replaceString: '',
            trimStrings: [],
            placement: [1, 2],
            disabled: !enabled,
            promptOnly: true,
            markdownOnly: false,
            runOnEdit: true
        };
        extension_settings.regex.push(script);
    } else {
        script.findRegex = flexibleJsonRegex;
        script.disabled = !enabled;
    }

    let deltaScript = extension_settings.regex.find(s => s.id === 'rpg_tracker_delta_stripper');
    if (!deltaScript) {
        deltaScript = {
            id: 'rpg_tracker_delta_stripper',
            scriptName: 'RPG Tracker Delta Stripper',
            findRegex: '<!--RPG_DELTA:[\\s\\S]*?-->\\s*',
            replaceString: '',
            trimStrings: [],
            placement: [1, 2],
            disabled: !enabled,
            promptOnly: true,
            markdownOnly: false,
            runOnEdit: true
        };
        extension_settings.regex.push(deltaScript);
    } else {
        deltaScript.disabled = !enabled;
    }

    saveSettingsDebounced();
}

export async function loadSettings(extensionName) {
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    if (Object.keys(extension_settings[extensionName]).length === 0) {
        const restored = restoreSettingsFromLocalStorage();
        if (restored) {
            Object.assign(extension_settings[extensionName], restored);
        } else {
            Object.assign(extension_settings[extensionName], defaultSettings);
        }
    } else {
        Object.keys(defaultSettings).forEach(key => {
            if (extension_settings[extensionName][key] === undefined) {
                extension_settings[extensionName][key] = defaultSettings[key];
            }
        });
    }

    // Purge legacy base64 strings upon loading settings
    const settingsModified = cleanBase64FromSettings(extension_settings[extensionName]);
    if (settingsModified) {
        console.log("[RPG Tracker] Purged legacy base64 avatar data from extension settings.");
        saveSettingsDebounced();
        backupSettingsToLocalStorage(extensionName);
    }

    const enabled = extension_settings[extensionName].enabled !== false;
    extension_settings[extensionName].enabled = enabled;

    $("#rpg_tracker_enabled").prop("checked", enabled);
    syncRpgTrackerRegex(enabled);
}