import { PROMPT_SETTING_KEYS, extractPromptSettings, stripPromptSettings } from './PromptSchema.js';

export { PROMPT_SETTING_KEYS, extractPromptSettings, stripPromptSettings };

export const CURRENT_TRACKER_SCHEMA_VERSION = 2;

/**
 * Checks whether the given string is a Base64 or Blob URI data payload.
 * @param {any} url - Target URL or string to validate.
 * @returns {boolean} True if the string represents an inline data/blob image.
 */
export function isBase64Image(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('data:') || trimmed.startsWith('blob:');
}

/**
 * Normalizes an avatar URL string, discarding any Base64 or Blob URIs.
 * @param {any} url - Candidate URL string.
 * @returns {string|null} Clean URL path or null.
 */
export function sanitizeAvatarUrl(url) {
    if (isBase64Image(url)) return null;
    return (typeof url === 'string' && url.trim() !== '') ? url.trim() : null;
}

/**
 * Sanitizes an object containing an avatarUrl property by removing inline Base64 data.
 * @param {Object} entity - Target object (e.g. character sheet or character sync item).
 * @returns {boolean} True if a Base64 avatarUrl was found and purged.
 */
export function cleanBase64Avatar(entity) {
    if (!entity || typeof entity !== 'object') return false;
    if (isBase64Image(entity.avatarUrl)) {
        delete entity.avatarUrl;
        return true;
    }
    return false;
}

/**
 * Checks if any character in the provided collection contains an inline Base64 avatar.
 * @param {Array<Object>} characters - Array of character objects.
 * @returns {boolean} True if any character has a Base64 avatarUrl.
 */
export function hasBase64Avatar(characters) {
    if (!Array.isArray(characters)) return false;
    return characters.some(char => isBase64Image(char?.avatarUrl));
}

const isCompletedStatus = (val, status) =>
    val === true ||
    String(val).toUpperCase() === 'TRUE' ||
    String(val).toUpperCase() === 'COMPLETED' ||
    String(status).toUpperCase() === 'COMPLETED';

export function generateUniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function cleanIdString(name, prefix = '') {
    const clean = String(name || '').replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    const id = clean || generateUniqueId(prefix || 'id');
    return prefix ? `${prefix}_${id}` : id;
}

export function getNextCharacterId(charactersOrIds = []) {
    const list = Array.isArray(charactersOrIds)
        ? charactersOrIds
        : (charactersOrIds instanceof Set ? Array.from(charactersOrIds) : []);

    const used = new Set(list.map(item => {
        const id = typeof item === 'string' ? item : item?.id;
        const match = String(id).match(/^RT(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
    }).filter(Boolean));

    let candidate = 1;
    while (used.has(candidate)) candidate++;
    return `RT${candidate}`;
}

export function parseMetadata(rawVal) {
    if (typeof rawVal !== 'string') return { value: rawVal, type: null, min: null, max: null };
    const m = rawVal.match(/^(.*?)\s*\(\s*type:\s*([a-zA-Z_]+)(?:[^)]*?min:\s*(-?\d+))?(?:[^)]*?max:\s*(-?\d+))?.*?\)$/i);
    return m ? {
        value: m[1].trim(),
        type: m[2].toLowerCase(),
        min: m[3] ? parseInt(m[3], 10) : null,
        max: m[4] ? parseInt(m[4], 10) : null
    } : { value: rawVal, type: null, min: null, max: null };
}

export function normalizeSingleInventoryItem(rawItem) {
    if (!rawItem) return null;

    if (typeof rawItem === 'string') {
        const trimmed = rawItem.trim();
        if (!trimmed || trimmed === 'Empty' || trimmed.toLowerCase().includes('<new_value')) return null;

        const qtyMatch = trimmed.match(/^([\s\S]+?)\s*(?:\((?:x|X)?\s*(\d+)\s*\)|\[(?:x|X)?\s*(\d+)\s*\]|(?:\bx|X)\s*(\d+))\s*$/);
        return {
            id: generateUniqueId('item'),
            name: qtyMatch ? qtyMatch[1].trim() : trimmed,
            quantity: qtyMatch ? Math.max(1, parseInt(qtyMatch[2] || qtyMatch[3] || qtyMatch[4], 10) || 1) : 1,
            type: 'general',
            desc: ''
        };
    }

    if (typeof rawItem === 'object') {
        const name = String(rawItem.name || '').trim();
        if (!name || name === '[object Object]' || name.toLowerCase().includes('<new_value')) return null;

        const type = rawItem.type || 'general';
        const rawId = typeof rawItem.id === 'string' ? rawItem.id.trim() : '';
        const id = (!rawId || rawId === '[object Object]' || rawId === 'undefined') ? generateUniqueId('item') : rawId;
        const rawQty = rawItem.quantity ?? rawItem.qty ?? rawItem.count ?? 1;

        const base = { id, name, type };
        if (type === 'currency') {
            const parsed = Number(rawQty);
            base.quantity = (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
        } else if (type === 'asset') {
            const assetAmt = Number(rawItem.assetValue?.amount);
            const assetUnit = String(rawItem.assetValue?.currencyName || 'Gold').trim();
            base.assetValue = {
                amount: !isNaN(assetAmt) && assetAmt >= 0 ? assetAmt : 0,
                currencyName: assetUnit || 'Gold'
            };
            base.desc = String(rawItem.desc || rawItem.description || '');
        } else {
            const parsed = parseInt(rawQty, 10);
            base.quantity = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
            base.desc = String(rawItem.desc || rawItem.description || '');
        }

        if (rawItem.isContainer) {
            base.isContainer = true;
            base.storageKey = rawItem.storageKey || name;
        }
        return base;
    }
    return null;
}

export function migrateCharacterSchema(char) {
    if (!char || typeof char !== 'object') return char;

    cleanBase64Avatar(char);

    char.statusSchema = char.statusSchema || char.statsSchema || [];
    char.status = char.status || char.stats || {};
    delete char.statsSchema;
    delete char.stats;
    delete char.featuresData;

    char.profile = char.profile || {};
    char.profileLocks = char.profileLocks || {};
    char.profileInjects = char.profileInjects || {};

    char.inventory = char.inventory || {};
    char.inventory.equipment = (char.inventory.equipment && typeof char.inventory.equipment === 'object' && !Array.isArray(char.inventory.equipment))
        ? char.inventory.equipment : { 'Right Hand': null, 'Left Hand': null };
    char.inventory.storage = (char.inventory.storage && typeof char.inventory.storage === 'object' && !Array.isArray(char.inventory.storage))
        ? char.inventory.storage : { 'Backpack': [] };
    char.inventory.equipmentLocks = char.inventory.equipmentLocks || {};
    char.inventory.storageLocks = char.inventory.storageLocks || {};

    if (!char.quests || typeof char.quests !== 'object' || Array.isArray(char.quests)) {
        char.quests = { main: { name: '', desc: '', isCompleted: false, isLocked: false }, sides: [] };
    }

    char.relations = char.relations || {};
    return char;
}

export function reindexCharactersSequentially(characters = []) {
    if (!Array.isArray(characters) || characters.length === 0) {
        return { characters: [], idMap: {} };
    }

    const idMap = {};
    let rtCounter = 1;

    let playerIndex = characters.findIndex(c => c && c.activePlayer === true);
    if (playerIndex === -1) {
        playerIndex = characters.findIndex(c => c && c.id === 'char_user');
    }
    if (playerIndex === -1) {
        playerIndex = 0;
    }

    const reindexed = characters.map((char, index) => {
        if (!char || typeof char !== 'object') return char;
        const oldId = typeof char.id === 'string' ? char.id.trim() : '';
        const newId = (index === playerIndex) ? 'char_user' : `RT${rtCounter++}`;

        if (oldId && oldId !== newId) {
            idMap[oldId] = newId;
        }

        return {
            ...char,
            id: newId
        };
    });

    return { characters: reindexed, idMap };
}

export function remapAssociatedMetadata(idMap, { settings = null, lockState = null, chatId = null, customAvatars = null } = {}) {
    if (!idMap || typeof idMap !== 'object' || Object.keys(idMap).length === 0) {
        return { settings, lockState, customAvatars };
    }

    const nextSettings = settings ? JSON.parse(JSON.stringify(settings)) : null;
    const nextLocks = lockState ? JSON.parse(JSON.stringify(lockState)) : null;
    const nextCustomAvatars = customAvatars ? JSON.parse(JSON.stringify(customAvatars)) : null;

    if (nextSettings && chatId && nextSettings.characterSyncs?.[chatId]) {
        const originalSync = nextSettings.characterSyncs[chatId];
        const remappedSync = {};
        for (const [key, val] of Object.entries(originalSync)) {
            const mappedKey = idMap[key] || key;
            remappedSync[mappedKey] = val;
        }
        nextSettings.characterSyncs[chatId] = remappedSync;
    }

    if (nextCustomAvatars && typeof nextCustomAvatars === 'object') {
        const remappedAvatars = {};
        for (const [key, val] of Object.entries(nextCustomAvatars)) {
            const mappedKey = idMap[key] || key;
            remappedAvatars[mappedKey] = val;
        }
        Object.keys(nextCustomAvatars).forEach(k => delete nextCustomAvatars[k]);
        Object.assign(nextCustomAvatars, remappedAvatars);
    }

    if (nextLocks?.characters) {
        const remappedLocks = {};
        for (const [charId, record] of Object.entries(nextLocks.characters)) {
            const mappedId = idMap[charId] || charId;
            const updatedRecord = record ? { ...record } : record;
            if (updatedRecord?.identity) {
                updatedRecord.identity = {
                    ...updatedRecord.identity,
                    id: mappedId
                };
            }
            remappedLocks[mappedId] = updatedRecord;
        }
        nextLocks.characters = remappedLocks;
    }

    return { settings: nextSettings, lockState: nextLocks, customAvatars: nextCustomAvatars };
}

export function syncChatHistoryCharacterIds(chat, currentCharacters) {
    if (!Array.isArray(chat) || !Array.isArray(currentCharacters) || currentCharacters.length === 0) {
        return false;
    }

    const nameToCurrentIdMap = new Map();
    currentCharacters.forEach(c => {
        if (c.name && c.id) {
            nameToCurrentIdMap.set(c.name.trim().toLowerCase(), c.id);
        }
    });

    let modified = false;

    const updateSnapshot = (tracker) => {
        if (!tracker || !Array.isArray(tracker.characters)) return false;
        let changed = false;
        tracker.characters.forEach(char => {
            const charName = char.name?.trim()?.toLowerCase();
            if (charName && nameToCurrentIdMap.has(charName)) {
                const targetId = nameToCurrentIdMap.get(charName);
                if (char.id !== targetId) {
                    char.id = targetId;
                    changed = true;
                }
            }
        });
        return changed;
    };

    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (!msg) continue;

        if (msg.extra?.rpgTrackerData && updateSnapshot(msg.extra.rpgTrackerData)) {
            modified = true;
        }

        if (Array.isArray(msg.swipe_info)) {
            msg.swipe_info.forEach(swipe => {
                if (swipe?.extra?.rpgTrackerData && updateSnapshot(swipe.extra.rpgTrackerData)) {
                    modified = true;
                }
            });
        }
    }

    return modified;
}

export function sanitizeTrackerData(trackerData, options = {}) {
    if (!trackerData || typeof trackerData !== 'object') return trackerData;
    const data = trackerData;

    if (options.stripPrompts === true) {
        stripPromptSettings(data);
    }

    if (!data.worldState && data.world && typeof data.world === 'object') {
        data.worldState = data.world;
        delete data.world;
    }
    delete data.inventory;
    delete data.quests;

    data.globalDefinitions = (data.globalDefinitions && typeof data.globalDefinitions === 'object' && !Array.isArray(data.globalDefinitions))
        ? data.globalDefinitions : {};

    if (data.worldSchema) {
        delete data.worldSchema.relationsFieldType;
    }

    // 1. World State Normalization
    if (data.worldState && typeof data.worldState === 'object') {
        const validWorldKeys = new Set(['date', 'time', 'location', 'weather', 'events']);
        Object.keys(data.worldState).forEach(k => {
            if (!validWorldKeys.has(k)) delete data.worldState[k];
        });

        data.worldState.events = Array.isArray(data.worldState.events)
            ? data.worldState.events.map((evt, idx) => {
                if (typeof evt === 'string' && evt.trim()) return { id: `event_${Date.now()}_${idx}`, name: '', desc: evt.trim() };
                if (evt && typeof evt === 'object' && (evt.id || evt.name !== undefined || evt.desc !== undefined || evt.description !== undefined)) {
                    return { id: evt.id || `event_${Date.now()}_${idx}`, name: evt.name || '', desc: evt.desc || evt.description || '' };
                }
                return null;
            }).filter(Boolean)
            : [];

        if (data.worldStateLocks) {
            Object.keys(data.worldStateLocks).forEach(k => {
                if (!validWorldKeys.has(k)) delete data.worldStateLocks[k];
            });
        }
    }

    // 2. Character Normalization
    const validStatusKeys = new Set();
    const validProfileKeys = new Set();
    const validRelationKeys = new Set();
    const nextGlobalDefs = { ...data.globalDefinitions };
    const seenCharIds = new Set();

    if (Array.isArray(data.characters)) {
        data.characters.forEach((char, idx) => {
            if (!char || typeof char !== 'object') return;

            cleanBase64Avatar(char);
            migrateCharacterSchema(char);

            const rawId = typeof char.id === 'string' ? char.id.trim() : '';
            if (!rawId || seenCharIds.has(rawId)) {
                char.id = (idx === 0 && (char.name === 'New' || char.activePlayer))
                    ? 'char_user'
                    : getNextCharacterId(seenCharIds);
            } else {
                char.id = rawId;
            }
            seenCharIds.add(char.id);

            const schemaIdMapping = {};
            const seenTargetIds = new Set();

            // A. Status Schema
            if (Array.isArray(char.statusSchema)) {
                char.statusSchema = char.statusSchema.map(schema => {
                    if (!schema || typeof schema !== 'object' || schema.type === 'relation_schema') return null;
                    const schemaName = String(schema.name || schema.id || '').trim();
                    if (!schemaName || schemaName === '[object Object]') return null;

                    const oldId = schema.id ? String(schema.id).trim() : '';
                    let targetId = oldId || cleanIdString(schemaName);

                    if (seenTargetIds.has(targetId)) {
                        let counter = 1;
                        while (seenTargetIds.has(`${targetId}_${counter}`)) counter++;
                        targetId = `${targetId}_${counter}`;
                    }
                    seenTargetIds.add(targetId);

                    if (oldId) {
                        schemaIdMapping[oldId] = targetId;
                        schemaIdMapping[oldId.toLowerCase()] = targetId;
                    }
                    schemaIdMapping[schemaName] = targetId;
                    schemaIdMapping[schemaName.toLowerCase()] = targetId;

                    validStatusKeys.add(targetId);

                    if (oldId && oldId !== targetId && nextGlobalDefs[`status_${oldId}`] !== undefined) {
                        nextGlobalDefs[`status_${targetId}`] = nextGlobalDefs[`status_${oldId}`];
                        delete nextGlobalDefs[`status_${oldId}`];
                    }

                    return {
                        id: targetId,
                        name: schemaName,
                        type: schema.type || 'consumable',
                        min: typeof schema.min === 'number' ? schema.min : 0,
                        max: typeof schema.max === 'number' ? schema.max : 100,
                        color: schema.color || (schema.type === 'stacking' ? '#3498db' : '#e74c3c'),
                        isLocked: Boolean(schema.isLocked),
                        isInject: schema.isInject !== false
                    };
                }).filter(Boolean);
            } else {
                char.statusSchema = [];
            }

            // B. Status Values
            const nextStatus = {};
            if (char.status && typeof char.status === 'object') {
                Object.entries(char.status).forEach(([rawKey, val]) => {
                    const cleanKey = String(rawKey).trim();
                    const targetId = schemaIdMapping[cleanKey] || schemaIdMapping[cleanKey.toLowerCase()];
                    if (!targetId) return;

                    const schemaItem = char.statusSchema.find(s => s.id === targetId);
                    if (!schemaItem) return;

                    let cleanVal = val;
                    if (typeof val === 'string' && val.includes('(type:')) {
                        const parsedInt = parseInt(parseMetadata(val).value, 10);
                        cleanVal = !isNaN(parsedInt) ? parsedInt : parseMetadata(val).value;
                    }

                    if (['integer', 'consumable', 'stacking'].includes(schemaItem.type)) {
                        const parsed = parseInt(cleanVal, 10);
                        const min = schemaItem.min ?? 0;
                        const max = schemaItem.max ?? 100;
                        nextStatus[targetId] = isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed));
                    } else {
                        nextStatus[targetId] = cleanVal !== undefined && cleanVal !== null ? String(cleanVal) : '';
                    }
                });
            }

            char.statusSchema.forEach(s => {
                if (nextStatus[s.id] === undefined) {
                    const min = s.min ?? 0;
                    const max = s.max ?? 100;
                    nextStatus[s.id] = s.type === 'consumable' ? max : (s.type === 'text' ? '' : min);
                }
            });
            char.status = nextStatus;

            // C. Profile & Locks Pruning
            const charProfileKeys = new Set();
            Object.keys(char.profile).forEach(k => {
                const trimmed = k.trim();
                if (!trimmed || trimmed === '[object Object]') {
                    delete char.profile[k];
                } else {
                    charProfileKeys.add(trimmed);
                    validProfileKeys.add(trimmed);
                }
            });
            Object.keys(char.profileLocks).forEach(k => {
                if (!charProfileKeys.has(k)) delete char.profileLocks[k];
            });
            Object.keys(char.profileInjects).forEach(k => {
                if (!charProfileKeys.has(k)) delete char.profileInjects[k];
            });

            // D. Inventory & Locks Pruning
            if (char.inventory) {
                Object.keys(char.inventory.equipment).forEach(slot => {
                    char.inventory.equipment[slot] = normalizeSingleInventoryItem(char.inventory.equipment[slot]);
                });
                Object.keys(char.inventory.storage).forEach(cName => {
                    char.inventory.storage[cName] = Array.isArray(char.inventory.storage[cName])
                        ? char.inventory.storage[cName].map(normalizeSingleInventoryItem).filter(Boolean)
                        : [];
                });

                const validEquipSlots = new Set(Object.keys(char.inventory.equipment));
                Object.keys(char.inventory.equipmentLocks).forEach(slot => {
                    if (!validEquipSlots.has(slot)) delete char.inventory.equipmentLocks[slot];
                });

                const validContainers = new Set(Object.keys(char.inventory.storage));
                Object.keys(char.inventory.storageLocks).forEach(cName => {
                    if (!validContainers.has(cName)) delete char.inventory.storageLocks[cName];
                });
            }

            // E. Quests
            if (char.quests) {
                const main = char.quests.main;
                char.quests.main = {
                    name: String(main?.name || (typeof main === 'string' ? main : '')).trim(),
                    desc: String(main?.desc || main?.description || ''),
                    isCompleted: isCompletedStatus(main?.isCompleted, main?.status),
                    isLocked: Boolean(main?.isLocked)
                };
                char.quests.sides = Array.isArray(char.quests.sides)
                    ? char.quests.sides.map((sq, i) => {
                        if (typeof sq === 'string') {
                            const strName = sq.trim();
                            if (!strName) return null;
                            return {
                                id: `quest_${Date.now()}_${i}`,
                                name: strName,
                                desc: '',
                                isCompleted: false,
                                isLocked: false
                            };
                        }
                        if (sq && typeof sq === 'object' && (sq.id || sq.name !== undefined || sq.title !== undefined || sq.desc !== undefined || sq.description !== undefined)) {
                            const name = String(sq.name ?? sq.title ?? '').trim();
                            return {
                                id: sq.id || `quest_${Date.now()}_${i}`,
                                name,
                                desc: String(sq.desc || sq.description || ''),
                                isCompleted: isCompletedStatus(sq.isCompleted, sq.status),
                                isLocked: Boolean(sq.isLocked)
                            };
                        }
                        return null;
                    }).filter(Boolean)
                    : [];
            }

            // F. Relations
            if (char.relations && typeof char.relations === 'object') {
                const cleanMetrics = (src) => {
                    const res = {};
                    Object.entries(src || {}).forEach(([mName, mVal]) => {
                        const cleanName = mName.trim();
                        if (!cleanName || cleanName === '[object Object]') return;

                        let val = 0, min = -100, max = 100, colNeg = '#e74c3c', colPos = '#2ecc71';
                        if (typeof mVal === 'object' && mVal !== null) {
                            const vInt = parseInt(mVal.value, 10);
                            const minInt = parseInt(mVal.min, 10);
                            const maxInt = parseInt(mVal.max, 10);
                            val = !isNaN(vInt) ? vInt : 0;
                            min = !isNaN(minInt) ? minInt : -100;
                            max = !isNaN(maxInt) ? maxInt : 100;
                            colNeg = mVal.colorNegative || colNeg;
                            colPos = mVal.colorPositive || colPos;
                        } else {
                            const meta = parseMetadata(mVal);
                            const vInt = parseInt(meta.value, 10);
                            val = !isNaN(vInt) ? vInt : 0;
                            if (meta.min !== null && !isNaN(meta.min)) min = meta.min;
                            if (meta.max !== null && !isNaN(meta.max)) max = meta.max;
                        }

                        const safeMin = Math.min(min, max);
                        const safeMax = Math.max(min, max);

                        res[cleanName] = {
                            value: Math.min(safeMax, Math.max(safeMin, val)),
                            type: 'integer',
                            min: safeMin,
                            max: safeMax,
                            colorNegative: colNeg,
                            colorPositive: colPos
                        };
                        validRelationKeys.add(cleanName);
                    });
                    return res;
                };

                Object.keys(char.relations).forEach(targetName => {
                    const cleanTarget = targetName.trim();
                    if (!cleanTarget || cleanTarget === '[object Object]') {
                        delete char.relations[targetName];
                        return;
                    }
                    const rel = char.relations[targetName];
                    if (!rel || typeof rel !== 'object') {
                        delete char.relations[targetName];
                        return;
                    }
                    if (cleanTarget !== targetName) {
                        char.relations[cleanTarget] = rel;
                        delete char.relations[targetName];
                    }

                    rel.text = typeof rel.text === 'string' ? rel.text : (rel.description || '');
                    rel.targetText = typeof rel.targetText === 'string' ? rel.targetText : (rel.targetDescription || '');
                    rel.isLocked = Boolean(rel.isLocked);
                    rel.isInject = rel.isInject !== false;
                    rel.values = cleanMetrics(rel.values || rel.metrics);
                    rel.targetValues = cleanMetrics(rel.targetValues || rel.targetMetrics);

                    delete rel.description;
                    delete rel.targetDescription;
                    delete rel.metrics;
                    delete rel.targetMetrics;
                });
            }
        });
    }

    // 3. Global Definitions Orphan Cleanup
    Object.keys(nextGlobalDefs).forEach(key => {
        if (key.startsWith('status_') && !validStatusKeys.has(key.replace('status_', ''))) delete nextGlobalDefs[key];
        else if (key.startsWith('profile_') && !validProfileKeys.has(key.replace('profile_', ''))) delete nextGlobalDefs[key];
        else if (key.startsWith('relation_') && !validRelationKeys.has(key.replace('relation_', ''))) delete nextGlobalDefs[key];
    });
    data.globalDefinitions = nextGlobalDefs;

    data._schemaVersion = CURRENT_TRACKER_SCHEMA_VERSION;
    return data;
}

export function pruneOrphanedChatLocks(lockState, activeTrackerData) {
    if (!lockState || lockState.version !== 1 || !lockState.characters || !activeTrackerData) return lockState;

    const liveCharMap = new Map((activeTrackerData.characters || []).map(c => [c.id, c]));

    Object.keys(lockState.characters).forEach(charId => {
        const liveChar = liveCharMap.get(charId);
        if (!liveChar) {
            delete lockState.characters[charId];
            return;
        }

        const record = lockState.characters[charId];
        const liveStatusIds = new Set((liveChar.statusSchema || []).map(s => s.id));

        if (record.status) {
            Object.keys(record.status).forEach(statId => {
                if (!liveStatusIds.has(statId)) delete record.status[statId];
            });
        }
        if (record.profile?.flags) {
            const liveProfileKeys = new Set(Object.keys(liveChar.profile || {}));
            Object.keys(record.profile.flags).forEach(k => {
                if (!liveProfileKeys.has(k)) {
                    delete record.profile.flags[k];
                    if (record.profile.values) delete record.profile.values[k];
                }
            });
        }
        if (record.inventory?.equipmentLocks) {
            const validSlots = new Set(Object.keys(liveChar.inventory?.equipment || {}));
            Object.keys(record.inventory.equipmentLocks).forEach(k => {
                if (!validSlots.has(k)) delete record.inventory.equipmentLocks[k];
            });
        }
        if (record.inventory?.storageLocks) {
            const validContainers = new Set(Object.keys(liveChar.inventory?.storage || {}));
            Object.keys(record.inventory.storageLocks).forEach(k => {
                if (!validContainers.has(k)) delete record.inventory.storageLocks[k];
            });
        }
        if (record.relations) {
            const validTargets = new Set(Object.keys(liveChar.relations || {}));
            Object.keys(record.relations).forEach(k => {
                if (!validTargets.has(k)) delete record.relations[k];
            });
        }
    });

    return lockState;
}

export function migrateChatHistoryMessages(chat) {
    if (!Array.isArray(chat) || chat.length === 0) return { modifiedCount: 0 };
    let modifiedCount = 0;

    const checkAndMigrate = (obj) => {
        if (obj?.extra?.rpgTrackerData) {
            const hasBase64 = hasBase64Avatar(obj.extra.rpgTrackerData.characters);

            if (obj.extra.rpgTrackerData._schemaVersion !== CURRENT_TRACKER_SCHEMA_VERSION || hasBase64) {
                obj.extra.rpgTrackerData = sanitizeTrackerData(obj.extra.rpgTrackerData, { stripPrompts: true });
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (!msg) continue;
        let changed = checkAndMigrate(msg);
        if (Array.isArray(msg.swipe_info)) {
            msg.swipe_info.forEach(swipe => {
                if (checkAndMigrate(swipe)) changed = true;
            });
        }
        if (changed) modifiedCount++;
    }

    return { modifiedCount };
}