// src/core/ExtensionSettings.js
import { extension_settings } from "../../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../script.js";

const localStorageBackupKey = "rpg_tracker_settings_backup";

export const defaultSettings = {
    enabled: true,
    theme: "default",
    updateMode: "merged",
    showDeltaLog: true,
    presets: []
};

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

    const officialIds = ['rpg_tracker_json_stripper', 'rpg_tracker_delta_stripper', 'rpg_tracker_comment_stripper'];
    extension_settings.regex = extension_settings.regex.filter(s => {
        if (s.id && s.id.startsWith('rpg_tracker')) {
            return officialIds.includes(s.id);
        }
        return true;
    });

    // 1. JSON Stripper (대소문자 환각 완벽 방어형 정규식)
    let script = extension_settings.regex.find(s => s.id === 'rpg_tracker_json_stripper');
    if (!script) {
        script = {
            id: 'rpg_tracker_json_stripper',
            scriptName: 'RPG Tracker JSON Stripper',
            findRegex: '<!--RPG_TRACKER\\s*```(?:json|markdown)?\\s*\\n?\\{[\\s\\S]*?(?:\"[sS]tatus\"|\"[sS]tatus[sS]chema\"|\"[sS]tats\"|\"[pP]rofile\"|\"[iI]nventory\"|\"[qQ]uests\"|\"[cC]haracter [nN]ame\"|\"[wW]orld\"|\"[rR]elations\"|\"[eE]vents\")[\\s\\S]*?\\}\\s*\\n?```\\s*-->\\s*',
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
        script.disabled = !enabled;
    }

    // 2. Delta Stripper
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

    // 3. Comment Stripper (대소문자 환각 완벽 방어형 정규식)
    let commentScript = extension_settings.regex.find(s => s.id === 'rpg_tracker_comment_stripper');
    if (!commentScript) {
        commentScript = {
            id: 'rpg_tracker_comment_stripper',
            scriptName: 'RPG Tracker Comment Stripper',
            findRegex: '<!--RPG_TRACKER\\s*```(?:json|markdown)?\\s*\\n?\\{[\\s\\S]*?(?:\"[sS]tatus\"|\"[sS]tatus[sS]chema\"|\"[sS]tats\"|\"[pP]rofile\"|\"[iI]nventory\"|\"[qQ]uests\"|\"[cC]haracter [nN]ame\"|\"[wW]orld\"|\"[rR]elations\"|\"[eE]vents\")[\\s\\S]*?\\}\\s*\\n?```\\s*-->\\s*',
            replaceString: '',
            trimStrings: [],
            placement: [1, 2],
            disabled: !enabled,
            promptOnly: true,
            markdownOnly: false,
            runOnEdit: true
        };
        extension_settings.regex.push(commentScript);
    } else {
        commentScript.disabled = !enabled;
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
    }

    const enabled = extension_settings[extensionName].enabled;
    $("#rpg_tracker_enabled").prop("checked", enabled).trigger("input");

    syncRpgTrackerRegex(enabled);
}