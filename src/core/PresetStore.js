import { deepClone as clone } from './StateHelpers.js';

export const PRESET_STORAGE_VERSION = 1;

const sameRecord = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const normalizedName = name => String(name || '').trim().toLocaleLowerCase();
const localKey = id => `rpg_tracker_preset_${id}`;

/**
 * Calculates the next available preset ID (RTPreset1, RTPreset2, ...)
 * using lowest unused sequential allocation (gap-filling).
 */
export function getNextPresetId(existingPresets = []) {
    const list = Array.isArray(existingPresets) ? existingPresets : [];
    const used = new Set(list.map(item => {
        const id = typeof item === 'string' ? item : item?.id;
        const match = String(id || '').match(/^RTPreset(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
    }).filter(Boolean));

    let candidate = 1;
    while (used.has(candidate)) candidate++;
    return `RTPreset${candidate}`;
}

/**
 * Maintains backwards compatibility for external callers checking preset package types.
 */
export function isPackagedPreset(preset) {
    const hasData = Array.isArray(preset?.data) || Array.isArray(preset?.data?.characters);
    return !hasData && (preset?.type === 'file' || preset?.type === 'server' || Boolean(preset?.file));
}

export function validatePresetCharacters(data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('A preset must contain at least one character.');
    }
    const ids = new Set();
    const names = new Set();
    for (const character of data) {
        if (!character || typeof character !== 'object' || Array.isArray(character)
            || typeof character.id !== 'string' || !character.id.trim()
            || typeof character.name !== 'string' || !character.name.trim()) {
            throw new Error('Each preset character needs a name and a unique ID.');
        }
        if (ids.has(character.id) || names.has(normalizedName(character.name))) {
            throw new Error('Character names and IDs must be unique within a preset.');
        }
        ids.add(character.id);
        names.add(normalizedName(character.name));
    }
    return clone(data);
}

export function normalizePresetData(data) {
    if (Array.isArray(data)) {
        return {
            characters: validatePresetCharacters(data),
            globalDefinitions: {},
        };
    }
    if (data && typeof data === 'object' && Array.isArray(data.characters)) {
        return {
            characters: validatePresetCharacters(data.characters),
            globalDefinitions: (data.globalDefinitions && typeof data.globalDefinitions === 'object' && !Array.isArray(data.globalDefinitions))
                ? clone(data.globalDefinitions)
                : {},
        };
    }
    throw new Error('A preset must contain at least one character.');
}

function readLocalPreset(preset, storage) {
    let stored;
    try {
        stored = storage?.getItem(localKey(preset.id));
    } catch {
        throw new Error('Browser storage is unavailable. Use the original browser or import an exported preset.');
    }
    if (!stored) {
        throw new Error('This preset is only on its original browser and address. Open it there to move it to the server, or import an exported preset.');
    }
    try {
        return normalizePresetData(JSON.parse(stored));
    } catch {
        throw new Error('The browser copy of this preset is damaged or invalid. Import an exported backup to recover it.');
    }
}

export function getPresetLocation(preset, storage) {
    if (Array.isArray(preset?.data) || Array.isArray(preset?.data?.characters)) return 'Server';
    if (isPackagedPreset(preset)) return 'Built-in';
    try {
        return storage?.getItem(localKey(preset.id)) ? 'This browser' : 'Original browser';
    } catch {
        return 'Original browser';
    }
}

function accountRecord(preset, data, now) {
    const payload = normalizePresetData(data);
    return {
        id: preset.id,
        name: preset.name.trim(),
        type: 'account',
        storageVersion: PRESET_STORAGE_VERSION,
        updatedAt: now(),
        data: payload,
    };
}

export function createPresetStore({
    extensionName,
    getRequestHeaders = () => ({}),
    syncPresets = () => { },
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    fetchImpl = fetch,
    idFactory = getNextPresetId,
    now = () => new Date().toISOString(),
}) {
    let pendingWrite = Promise.resolve();

    async function readDocument() {
        const response = await fetchImpl('/api/settings/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: '{}',
            cache: 'no-store',
        });
        if (!response.ok) throw new Error('Could not read presets from the SillyTavern server.');
        const result = await response.json();
        const document = typeof result.settings === 'string' ? JSON.parse(result.settings) : result.settings;
        if (!document || typeof document !== 'object' || Array.isArray(document)) {
            throw new Error('The server returned invalid settings.');
        }
        return document;
    }

    const libraryOf = document => {
        const library = document.extension_settings?.[extensionName]?.presets ?? [];
        if (!Array.isArray(library)) throw new Error('The server preset library is invalid.');
        return library;
    };

    async function readPresetSettings() {
        await pendingWrite;
        const library = clone(libraryOf(await readDocument()));
        syncPresets(library);
        return library;
    }

    function persistPresetSettings(nextPresets, expectedPresets) {
        const next = clone(nextPresets);
        const expected = clone(expectedPresets);
        const write = async () => {
            const document = await readDocument();
            if (!sameRecord(libraryOf(document), expected)) {
                throw new Error('Presets changed on another device. Refresh the list before saving again.');
            }
            document.extension_settings ??= {};
            document.extension_settings[extensionName] ??= {};
            document.extension_settings[extensionName].presets = next;
            const response = await fetchImpl('/api/settings/save', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(document),
                cache: 'no-store',
            });
            if (!response.ok || (await response.json()).result !== 'ok') {
                throw new Error('Presets could not be saved. Your browser copy has been kept.');
            }
            syncPresets(clone(next));
            const confirmed = libraryOf(await readDocument());
            if (!sameRecord(confirmed, next)) {
                syncPresets(clone(confirmed));
                throw new Error('The server save could not be confirmed. Refresh before trying again.');
            }
            return clone(confirmed);
        };
        const result = pendingWrite.then(write);
        pendingWrite = result.catch(() => { });
        return result;
    }

    async function refresh({ migrate = true } = {}) {
        const presets = await readPresetSettings();
        if (!migrate) return { presets, migratedCount: 0, issues: [] };
        const issues = [];
        let migratedCount = 0;
        const next = presets.map(preset => {
            if (!preset || !preset.id || !preset.name || isPackagedPreset(preset)) {
                return preset;
            }
            const isModernAccount = preset.type === 'account'
                && preset.storageVersion === PRESET_STORAGE_VERSION
                && preset.data
                && Array.isArray(preset.data.characters);

            if (isModernAccount) {
                return preset;
            }

            try {
                const rawData = preset.data !== undefined ? preset.data : readLocalPreset(preset, storage);
                const migrated = accountRecord(preset, rawData, now);
                migratedCount++;
                return migrated;
            } catch (error) {
                issues.push({ id: preset.id, name: preset.name, message: error.message });
                return preset;
            }
        });
        if (!migratedCount) return { presets, migratedCount: 0, issues };
        try {
            return { presets: await persistPresetSettings(next, presets), migratedCount, issues };
        } catch (error) {
            return { presets, migratedCount: 0, issues, migrationError: error.message };
        }
    }

    async function save({ id, name, data, expectedPreset = null }) {
        if (!String(name || '').trim()) throw new Error('Enter a preset name before saving.');
        const payload = normalizePresetData(data);
        const presets = await readPresetSettings();
        const existing = presets.find(preset => preset.id === id);
        const nameDuplicate = presets.find(preset => normalizedName(preset.name) === normalizedName(name)
            && preset.id !== existing?.id);
        if (nameDuplicate) {
            throw new Error('A preset with this name already exists. Select it to overwrite it, or use another name.');
        }
        if (existing && (!expectedPreset || !sameRecord(existing, expectedPreset))) {
            throw new Error('This preset changed on another device. Refresh the library and review it before overwriting.');
        }
        if (!existing && expectedPreset) {
            throw new Error('This preset was removed on another device. Refresh the library before saving a new copy.');
        }

        let assignedId = existing?.id;
        if (!assignedId) {
            assignedId = (typeof id === 'string' && id.trim()) ? id.trim() : idFactory(presets);
        }

        if (!existing && presets.some(preset => preset.id === assignedId)) {
            assignedId = getNextPresetId(presets);
        }

        const record = accountRecord({ id: assignedId, name }, payload, now);
        const next = existing
            ? presets.map(preset => preset.id === record.id ? record : preset)
            : [...presets, record];
        return { preset: record, presets: await persistPresetSettings(next, presets) };
    }

    async function remove(id, expectedPreset) {
        const presets = await readPresetSettings();
        const existing = presets.find(preset => preset.id === id);
        if (!existing || !sameRecord(existing, expectedPreset)) {
            throw new Error('This preset changed on another device. Refresh the library before deleting it.');
        }
        const saved = await persistPresetSettings(presets.filter(preset => preset.id !== id), presets);
        try { storage?.removeItem(localKey(id)); } catch { /* ignore */ }
        return saved;
    }

    async function load(id) {
        const presets = await readPresetSettings();
        const preset = presets.find(item => item.id === id);
        if (!preset) throw new Error('This preset no longer exists on the server. Refresh the library.');
        const data = preset.data !== undefined
            ? normalizePresetData(preset.data)
            : readLocalPreset(preset, storage);
        return {
            preset,
            data,
            characters: data.characters,
            globalDefinitions: data.globalDefinitions,
            presets
        };
    }

    return { refresh, save, remove, load, readPresetSettings };
}