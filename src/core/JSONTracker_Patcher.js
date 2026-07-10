import { getDefaultCharacters } from './PromptSchema.js';
import { sanitizeTrackerData, cleanIdString, generateUniqueId, parseMetadata } from './JSONTracker_Migrator.js';

function isPlaceholderValue(val) {
    if (typeof val === 'string' && val.toLowerCase().includes('<new_value')) return true;
    return false;
}

function normalizeKeys(obj) {
    if (!obj || typeof obj !== 'object') return {};
    const normalized = {};
    Object.entries(obj).forEach(([k, v]) => {
        normalized[k.toLowerCase()] = v;
    });
    return normalized;
}

function mergeWorldState(currentWorldState, rawUpdates, worldStateLocks) {
    const worldState = currentWorldState || { date: '', time: '', location: '', weather: '', events: [] };
    const locks = worldStateLocks || {};
    const updates = normalizeKeys(rawUpdates);

    if (updates.date !== undefined && !locks.date && !isPlaceholderValue(updates.date)) worldState.date = String(updates.date);
    if (updates.time !== undefined && !locks.time && !isPlaceholderValue(updates.time)) worldState.time = String(updates.time);
    if (updates.location !== undefined && !locks.location && !isPlaceholderValue(updates.location)) worldState.location = String(updates.location);
    if (updates.weather !== undefined && !locks.weather && !isPlaceholderValue(updates.weather)) worldState.weather = String(updates.weather);

    if (Array.isArray(updates.events)) {
        const existingEvents = worldState.events || [];
        const parsedNewEvents = updates.events.map(e => {
            let name = '';
            let desc = '';
            if (typeof e === 'string') {
                desc = e.trim();
            } else if (e && typeof e === 'object') {
                const normE = normalizeKeys(e);
                name = normE.name || '';
                desc = normE.desc || normE.description || '';
            }
            if (!name && !desc) return null;
            if (isPlaceholderValue(name) || isPlaceholderValue(desc)) return null;
            const id = cleanIdString(name, 'event');
            return { id, name, desc };
        }).filter(Boolean);

        const mergedEvents = [...existingEvents];
        parsedNewEvents.forEach(newEvt => {
            const index = mergedEvents.findIndex(evt =>
                (evt.id && evt.id === newEvt.id) ||
                (evt.name && evt.name.trim().toLowerCase() === newEvt.name.trim().toLowerCase())
            );
            if (index !== -1) {
                mergedEvents[index] = { ...mergedEvents[index], ...newEvt };
            } else {
                mergedEvents.push(newEvt);
            }
        });
        worldState.events = mergedEvents;
    }
    return worldState;
}

function getOrCreateCharacter(charactersArray, charName, isPlayer, rawUpdates) {
    const cleanCharId = cleanIdString(charName, 'char');
    let charIndex = charactersArray.findIndex(c => c.id === cleanCharId || c.name?.trim().toLowerCase() === charName.trim().toLowerCase());

    const updates = normalizeKeys(rawUpdates);

    if (charIndex === -1) {
        const newChar = JSON.parse(JSON.stringify(getDefaultCharacters()[0]));
        newChar.id = cleanCharId;
        newChar.name = charName;
        newChar.activePlayer = updates.activeplayer !== undefined ? Boolean(updates.activeplayer) : isPlayer;

        newChar.statusSchema = [];
        newChar.status = {};
        newChar.profile = {};
        newChar.profileLocks = {};
        newChar.relations = {};

        if (charactersArray.length === 1 && charactersArray[0].id === 'char_user' && charactersArray[0].name === 'New') {
            charactersArray.length = 0;
            charactersArray.push(newChar);
            charIndex = 0;
        } else {
            charactersArray.push(newChar);
            charIndex = charactersArray.length - 1;
        }
    }

    const char = charactersArray[charIndex];
    if (updates.activeplayer !== undefined) {
        char.activePlayer = Boolean(updates.activeplayer);
    }
    return char;
}

function mergeCharacterStatus(char, statusUpdates, updateType) {
    const statusSchema = char.statusSchema || [];
    const currentStatus = char.status || {};

    if (updateType === 'replace') {
        const nextStatusSchema = [];
        const nextStatus = {};

        Object.entries(statusUpdates).forEach(([patchKey, rawPatchVal]) => {
            if (isPlaceholderValue(rawPatchVal)) return;

            const metaInfo = parseMetadata(rawPatchVal);
            const patchVal = metaInfo.value;
            const parsedType = metaInfo.type;
            const parsedMin = metaInfo.min;
            const parsedMax = metaInfo.max;

            const cleanPatchKey = patchKey.toLowerCase().replace(/\s+/g, '');
            const matchedSchema = statusSchema.find(schema => {
                const cleanId = (schema.id || '').toLowerCase().replace(/\s+/g, '');
                const cleanName = (schema.name || '').toLowerCase().replace(/\s+/g, '');
                return cleanId === cleanPatchKey || cleanName === cleanPatchKey;
            });

            let targetId = patchKey.trim().replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
            if (!targetId) targetId = generateUniqueId('status');

            let finalType = 'text';
            let finalMin = 0;
            let finalMax = 100;
            let isLocked = false;
            let isInject = true;

            if (matchedSchema) {
                targetId = matchedSchema.id;
                finalType = matchedSchema.type || 'text';
                finalMin = matchedSchema.min !== undefined ? matchedSchema.min : 0;
                finalMax = matchedSchema.max !== undefined ? matchedSchema.max : 100;
                isLocked = matchedSchema.isLocked || false;
                isInject = matchedSchema.isInject !== false;
            } else if (parsedType) {
                finalType = parsedType;
                finalMin = parsedMin !== null ? parsedMin : 0;
                finalMax = parsedMax !== null ? parsedMax : 100;
            } else {
                const parsedInt = parseInt(patchVal, 10);
                if (!isNaN(parsedInt) && String(patchVal).trim() === String(parsedInt)) {
                    finalType = 'integer';
                }
            }

            let finalVal = patchVal !== null && patchVal !== undefined ? String(patchVal) : '';
            if (['integer', 'consumable', 'stacking'].includes(finalType)) {
                const parsedInt = parseInt(patchVal, 10);
                if (!isNaN(parsedInt)) {
                    finalVal = Math.min(finalMax, Math.max(finalMin, parsedInt));
                } else {
                    finalVal = ['consumable'].includes(finalType) ? finalMax : finalMin;
                }
            }

            nextStatusSchema.push({ id: targetId, name: matchedSchema ? matchedSchema.name : patchKey, type: finalType, min: finalMin, max: finalMax, isLocked, isInject });
            nextStatus[targetId] = finalVal;
        });

        char.status = nextStatus;
        char.statusSchema = nextStatusSchema;
    } else {
        const newStatus = {};
        statusSchema.forEach(schema => {
            if (currentStatus[schema.id] !== undefined) {
                newStatus[schema.id] = currentStatus[schema.id];
            } else {
                const minLimit = schema.min !== undefined && schema.min !== null ? schema.min : 0;
                const maxLimit = schema.max !== undefined && schema.max !== null ? schema.max : 100;
                newStatus[schema.id] = ['consumable'].includes(schema.type) ? maxLimit : minLimit;
            }
        });

        Object.entries(statusUpdates).forEach(([patchKey, rawPatchVal]) => {
            if (isPlaceholderValue(rawPatchVal)) return;

            const metaInfo = parseMetadata(rawPatchVal);
            const patchVal = metaInfo.value;
            const parsedType = metaInfo.type;
            const parsedMin = metaInfo.min;
            const parsedMax = metaInfo.max;

            const cleanPatchKey = patchKey.toLowerCase().replace(/\s+/g, '');
            const matchedSchema = statusSchema.find(schema => {
                const cleanId = (schema.id || '').toLowerCase().replace(/\s+/g, '');
                const cleanName = (schema.name || '').toLowerCase().replace(/\s+/g, '');
                return cleanId === cleanPatchKey || cleanName === cleanPatchKey;
            });

            if (matchedSchema) {
                const targetId = matchedSchema.id;
                if (['integer', 'consumable', 'stacking'].includes(matchedSchema.type)) {
                    const parsedInt = parseInt(patchVal, 10);
                    if (!isNaN(parsedInt)) {
                        const minLimit = matchedSchema.min !== undefined && matchedSchema.min !== null ? matchedSchema.min : 0;
                        const maxLimit = matchedSchema.max !== undefined && matchedSchema.max !== null ? matchedSchema.max : 100;
                        newStatus[targetId] = Math.min(maxLimit, Math.max(minLimit, parsedInt));
                    }
                } else {
                    newStatus[targetId] = patchVal !== null && patchVal !== undefined ? String(patchVal) : '';
                }
            } else {
                const cleanId = patchKey.trim().replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                const newId = cleanId ? `status_${cleanId}` : generateUniqueId('status');
                let newType = parsedType || 'text';
                let finalVal = patchVal !== null && patchVal !== undefined ? String(patchVal) : '';

                if (!parsedType) {
                    const parsedInt = parseInt(patchVal, 10);
                    if (!isNaN(parsedInt) && String(patchVal).trim() === String(parsedInt)) {
                        newType = 'integer';
                        finalVal = parsedInt;
                    }
                } else if (['integer', 'consumable', 'stacking'].includes(newType)) {
                    const parsedInt = parseInt(patchVal, 10);
                    if (!isNaN(parsedInt)) {
                        finalVal = parsedInt;
                    }
                }

                statusSchema.push({ id: newId, name: patchKey, type: newType, min: parsedMin !== null ? parsedMin : 0, max: parsedMax !== null ? parsedMax : 100, isLocked: false, isInject: true });
                newStatus[newId] = finalVal;
            }
        });
        char.status = newStatus;
        char.statusSchema = statusSchema;
    }
}

function mergeCharacterProfile(char, profileUpdates, updateType) {
    char.profileLocks = char.profileLocks || {};
    char.profile = char.profile || {};

    const actualKeys = {};
    Object.keys(char.profile).forEach(k => actualKeys[k.toLowerCase()] = k);

    const safeStringify = (val) => {
        if (typeof val === 'object' && val !== null) {
            try { return JSON.stringify(val); } catch (e) { return String(val); }
        }
        return String(val);
    };

    const processProfilePatch = (targetProfile) => {
        Object.entries(profileUpdates).forEach(([pKey, pVal]) => {
            if (isPlaceholderValue(pVal)) return;
            const lowerKey = pKey.toLowerCase();
            const actualKey = actualKeys[lowerKey] || pKey;

            if (!char.profileLocks[actualKey] && pVal !== undefined && pVal !== null) {
                targetProfile[actualKey] = safeStringify(pVal);
            }
        });
    };

    if (updateType === 'replace') {
        const nextProfile = {};
        Object.entries(char.profile || {}).forEach(([pKey, pVal]) => {
            if (char.profileLocks[pKey] === true) nextProfile[pKey] = pVal;
        });
        processProfilePatch(nextProfile);
        char.profile = nextProfile;
    } else {
        processProfilePatch(char.profile);
    }
}

function mergeCharacterInventory(char, rawInventoryUpdates) {
    const inventoryUpdates = normalizeKeys(rawInventoryUpdates);

    char.inventory = char.inventory || {};
    char.inventory.equipmentLocks = char.inventory.equipmentLocks || {};
    char.inventory.storageLocks = char.inventory.storageLocks || {};

    if (inventoryUpdates.equipment && typeof inventoryUpdates.equipment === 'object') {
        char.inventory.equipment = char.inventory.equipment || {};
        const actualSlots = {};
        Object.keys(char.inventory.equipment).forEach(k => actualSlots[k.toLowerCase()] = k);

        Object.entries(inventoryUpdates.equipment).forEach(([slot, itemVal]) => {
            if (isPlaceholderValue(itemVal)) return;
            
            const actualSlot = actualSlots[slot.toLowerCase()] || slot;
            const isSlotLocked = char.inventory.equipIsLocked || char.inventory.equipmentLocks[actualSlot] === true;
            if (isSlotLocked) return;

            if (itemVal === 'Empty' || !itemVal) {
                char.inventory.equipment[actualSlot] = null;
            } else {
                const isObj = typeof itemVal === 'object' && itemVal !== null;
                const normItem = isObj ? normalizeKeys(itemVal) : {};
                const itemType = isObj ? (normItem.type || 'general') : 'general';
                const baseItem = {
                    id: (isObj && normItem.id) || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    name: isObj ? (normItem.name || 'Unknown') : String(itemVal),
                    type: itemType,
                    desc: isObj ? (normItem.desc || normItem.description || '') : ''
                };

                if (itemType === 'currency') {
                    baseItem.quantity = isObj && normItem.quantity !== undefined ? normItem.quantity : 0;
                    delete baseItem.desc;
                } else if (itemType === 'asset') {
                    baseItem.assetValue = isObj && normItem.assetvalue ? normItem.assetvalue : { amount: 0, currencyName: 'Gold' };
                } else {
                    baseItem.quantity = isObj && normItem.quantity !== undefined ? normItem.quantity : 1;
                }

                if (isObj && normItem.iscontainer) {
                    baseItem.isContainer = true;
                    baseItem.storageKey = normItem.storagekey;
                }
                char.inventory.equipment[actualSlot] = baseItem;
            }
        });
    }

    if (inventoryUpdates.storage && typeof inventoryUpdates.storage === 'object') {
        char.inventory.storage = char.inventory.storage || {};
        const actualContainers = {};
        Object.keys(char.inventory.storage).forEach(k => actualContainers[k.toLowerCase()] = k);

        Object.entries(inventoryUpdates.storage).forEach(([container, items]) => {
            const actualContainer = actualContainers[container.toLowerCase()] || container;
            const isContainerLocked = char.inventory.storageIsLocked || char.inventory.storageLocks[actualContainer] === true;
            if (isContainerLocked) return;

            if (Array.isArray(items)) {
                char.inventory.storage[actualContainer] = items.map(item => {
                    if (isPlaceholderValue(item)) return null;

                    if (typeof item === 'string') {
                        const qtyMatch = item.match(/^([\s\S]*?)\s*x\s*(\d+)$/);
                        return qtyMatch
                            ? { id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name: qtyMatch[1].trim(), quantity: parseInt(qtyMatch[2], 10) || 1, desc: '', type: 'general' }
                            : { id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name: item, quantity: 1, desc: '', type: 'general' };
                    } else if (item && typeof item === 'object') {
                        const normItem = normalizeKeys(item);
                        const itemType = normItem.type || 'general';
                        const baseItem = {
                            id: normItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            name: normItem.name || 'Unknown',
                            type: itemType
                        };

                        if (itemType === 'currency') {
                            baseItem.quantity = normItem.quantity !== undefined ? normItem.quantity : 1;
                        } else if (itemType === 'asset') {
                            baseItem.assetValue = normItem.assetvalue || { amount: 0, currencyName: 'Gold' };
                            baseItem.desc = normItem.desc || normItem.description || '';
                        } else {
                            baseItem.quantity = normItem.quantity !== undefined ? normItem.quantity : 1;
                            baseItem.desc = normItem.desc || normItem.description || '';
                        }
                        return baseItem;
                    }
                    return null;
                }).filter(Boolean);
            }
        });
    }
}

function mergeCharacterQuests(char, rawQuestUpdates) {
    const questUpdates = normalizeKeys(rawQuestUpdates);
    if (questUpdates.sidequests) questUpdates.sideQuests = questUpdates.sidequests;
    if (questUpdates.sides) questUpdates.sideQuests = questUpdates.sides;

    char.quests = char.quests || {};

    if (questUpdates.main && typeof questUpdates.main === 'object') {
        const mainUpdate = normalizeKeys(questUpdates.main);
        char.quests.main = char.quests.main || {};
        if (!char.quests.main.isLocked) {
            if (mainUpdate.name !== undefined && !isPlaceholderValue(mainUpdate.name)) {
                char.quests.main.name = String(mainUpdate.name);
            }
            if (mainUpdate.description !== undefined && !isPlaceholderValue(mainUpdate.description)) {
                char.quests.main.desc = String(mainUpdate.description);
            } else if (mainUpdate.desc !== undefined && !isPlaceholderValue(mainUpdate.desc)) {
                char.quests.main.desc = String(mainUpdate.desc);
            }
            if (mainUpdate.status !== undefined && !isPlaceholderValue(mainUpdate.status)) {
                char.quests.main.isCompleted = (mainUpdate.status === 'COMPLETED');
            } else if (mainUpdate.iscompleted !== undefined) {
                char.quests.main.isCompleted = Boolean(mainUpdate.iscompleted);
            }
        }
    }

    if (Array.isArray(questUpdates.sideQuests)) {
        const existingSides = char.quests.sides || [];
        const nextSides = [...existingSides];

        questUpdates.sideQuests.forEach(sq => {
            if (isPlaceholderValue(sq)) return;
            let qName = 'Unknown', qDesc = '', isCompleted = false;
            
            if (typeof sq === 'string') {
                qName = sq;
            } else if (sq && typeof sq === 'object') {
                const normSq = normalizeKeys(sq);
                qName = normSq.name || 'Unknown';
                qDesc = normSq.description || normSq.desc || '';
                isCompleted = normSq.status === 'COMPLETED' || normSq.iscompleted === true;
            }

            if (isPlaceholderValue(qName) || isPlaceholderValue(qDesc)) return;

            const cleanId = cleanIdString(qName, 'quest');
            const matchedIdx = nextSides.findIndex(q =>
                (q.id && q.id === cleanId) ||
                (q.name && q.name.trim().toLowerCase() === qName.trim().toLowerCase())
            );

            if (matchedIdx !== -1) {
                if (!nextSides[matchedIdx].isLocked) {
                    nextSides[matchedIdx].name = qName;
                    if (qDesc) nextSides[matchedIdx].desc = qDesc;
                    nextSides[matchedIdx].isCompleted = isCompleted;
                }
            } else {
                nextSides.push({
                    id: cleanId,
                    name: qName,
                    desc: qDesc,
                    isCompleted,
                    isLocked: false
                });
            }
        });

        char.quests.sides = nextSides;
    }
}

function mergeCharacterRelations(char, relationUpdates, updateType) {
    if (updateType === 'replace') {
        const nextRelations = {};
        Object.entries(char.relations || {}).forEach(([targetName, rData]) => {
            if (rData && rData.isLocked) nextRelations[targetName] = rData;
        });
        char.relations = nextRelations;
    } else {
        char.relations = char.relations || {};
    }

    const actualTargets = {};
    Object.keys(char.relations).forEach(k => actualTargets[k.toLowerCase()] = k);

    Object.entries(relationUpdates).forEach(([targetName, rawRData]) => {
        if (!rawRData || typeof rawRData !== 'object' || isPlaceholderValue(targetName)) return;

        const actualTarget = actualTargets[targetName.toLowerCase()] || targetName;
        const rData = normalizeKeys(rawRData);
        
        const existingRelation = char.relations[actualTarget] || { text: '', isLocked: false, isInject: true, values: {} };
        if (existingRelation.isLocked) return;

        const descStr = rData.description || rData.desc;
        if (descStr !== undefined && !isPlaceholderValue(descStr)) {
            existingRelation.text = String(descStr);
        }

        const metricsObj = rData.metrics || rData.values;
        if (metricsObj && typeof metricsObj === 'object') {
            existingRelation.values = existingRelation.values || {};
            Object.entries(metricsObj).forEach(([mName, rawMVal]) => {
                if (isPlaceholderValue(rawMVal)) return;
                const metaInfo = parseMetadata(rawMVal);
                const parsedInt = parseInt(metaInfo.value, 10);
                const finalVal = !isNaN(parsedInt) ? parsedInt : String(metaInfo.value);
                const valType = metaInfo.type || (!isNaN(parsedInt) ? 'integer' : 'text');

                const actualMName = Object.keys(existingRelation.values).find(k => k.toLowerCase() === mName.toLowerCase()) || mName;

                if (existingRelation.values[actualMName]) {
                    const existingMetric = existingRelation.values[actualMName];
                    const isObj = typeof existingMetric === 'object' && existingMetric !== null;
                    if (isObj && !isNaN(parsedInt)) {
                        const minLimit = existingMetric.min !== undefined && existingMetric.min !== null ? existingMetric.min : -100;
                        const maxLimit = existingMetric.max !== undefined && existingMetric.max !== null ? existingMetric.max : 100;
                        existingRelation.values[actualMName].value = Math.min(maxLimit, Math.max(minLimit, parsedInt));
                    } else {
                        existingRelation.values[actualMName].value = finalVal;
                    }
                    existingRelation.values[actualMName].type = existingRelation.values[actualMName].type || valType;
                } else {
                    existingRelation.values[actualMName] = { value: finalVal, type: valType, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
                }
            });
        }

        const tDescStr = rData.targetdescription || rData.targettext;
        if (tDescStr !== undefined && !isPlaceholderValue(tDescStr)) {
            existingRelation.targetText = String(tDescStr);
        }

        const tMetricsObj = rData.targetmetrics || rData.targetvalues;
        if (tMetricsObj && typeof tMetricsObj === 'object') {
            existingRelation.targetValues = existingRelation.targetValues || {};
            Object.entries(tMetricsObj).forEach(([tmName, rawMVal]) => {
                if (isPlaceholderValue(rawMVal)) return;
                const metaInfo = parseMetadata(rawMVal);
                const parsedInt = parseInt(metaInfo.value, 10);
                const finalVal = !isNaN(parsedInt) ? parsedInt : String(metaInfo.value);
                const valType = metaInfo.type || (!isNaN(parsedInt) ? 'integer' : 'text');

                const actualTMName = Object.keys(existingRelation.targetValues).find(k => k.toLowerCase() === tmName.toLowerCase()) || tmName;

                if (existingRelation.targetValues[actualTMName]) {
                    const existingMetric = existingRelation.targetValues[actualTMName];
                    const isObj = typeof existingMetric === 'object' && existingMetric !== null;
                    if (isObj && !isNaN(parsedInt)) {
                        const minLimit = existingMetric.min !== undefined && existingMetric.min !== null ? existingMetric.min : -100;
                        const maxLimit = existingMetric.max !== undefined && existingMetric.max !== null ? existingMetric.max : 100;
                        existingRelation.targetValues[actualTMName].value = Math.min(maxLimit, Math.max(minLimit, parsedInt));
                    } else {
                        existingRelation.targetValues[actualTMName].value = finalVal;
                    }
                    existingRelation.targetValues[actualTMName].type = existingRelation.targetValues[actualTMName].type || valType;
                } else {
                    existingRelation.targetValues[actualTMName] = { value: finalVal, type: valType, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
                }
            });
        }

        char.relations[actualTarget] = existingRelation;
    });
}

export function syncCrossRelations(characters) {
    if (!Array.isArray(characters)) return;

    const charMap = new Map(characters.map(c => [c.name?.trim().toLowerCase(), c]));

    const truthMap = new Map();
    for (const char of characters) {
        if (!char.relations) continue;
        for (const [targetName, rData] of Object.entries(char.relations)) {
            const key = `${char.name?.trim().toLowerCase()}->${targetName.trim().toLowerCase()}`;
            truthMap.set(key, {
                text: rData.text || '',
                values: rData.values || {}
            });
        }
    }

    for (const char of characters) {
        if (!char.relations) continue;
        for (const [targetName, rData] of Object.entries(char.relations)) {
            const targetChar = charMap.get(targetName.trim().toLowerCase());
            if (targetChar) {
                const counterKey = `${targetName.trim().toLowerCase()}->${char.name?.trim().toLowerCase()}`;
                const counterTruth = truthMap.get(counterKey);
                if (counterTruth) {
                    rData.targetText = counterTruth.text;
                    rData.targetValues = counterTruth.values;
                }
            }
        }
    }
}

export function extractNormalizedPatch(patch) {
    if (!patch || typeof patch !== 'object') return patch;

    let normalizedPatch = patch;

    if (Array.isArray(patch.characters)) {
        normalizedPatch = {};
        patch.characters.forEach(c => {
            if (c && typeof c === 'object' && c.name) {
                const { name, ...rest } = c;
                normalizedPatch[name] = rest;
            }
        });
        if (patch.world || patch.worldState || patch.World) {
            normalizedPatch.World = patch.world || patch.worldState || patch.World;
        }
    } else if (patch.characters && typeof patch.characters === 'object') {
        normalizedPatch = { ...patch.characters };
        if (patch.world || patch.worldState || patch.World) {
            normalizedPatch.World = patch.world || patch.worldState || patch.World;
        }
    }

    return normalizedPatch;
}

export function applyLLMPatch(trackerData, patch, isPlayer = false, updateType = 'patch', mutateInPlace = false) {
    if (!patch || typeof patch !== 'object') return trackerData;

    const baseData = mutateInPlace ? trackerData : JSON.parse(JSON.stringify(trackerData));
    const updatedData = sanitizeTrackerData(baseData);

    const normalizedPatch = extractNormalizedPatch(patch);

    if (Array.isArray(updatedData.characters)) {
        Object.entries(normalizedPatch).forEach(([charName, rawUpdates]) => {
            if (!rawUpdates || typeof rawUpdates !== 'object') return;

            const updates = normalizeKeys(rawUpdates);

            if (charName.toLowerCase() === 'world' || charName.toLowerCase() === 'worldstate') {
                updatedData.worldState = mergeWorldState(updatedData.worldState, updates, updatedData.worldStateLocks);
                return;
            }

            const existingChar = updatedData.characters.find(c => c.name?.trim().toLowerCase() === charName.trim().toLowerCase());
            if (existingChar && existingChar.activeInjection === false) {
                return;
            }

            const char = getOrCreateCharacter(updatedData.characters, charName, isPlayer, rawUpdates);

            let statusUpdates = updates.status || updates.stats || null;
            if (!statusUpdates && !updates.profile && !updates.relations && !updates.inventory && !updates.quests) {
                statusUpdates = rawUpdates; 
            }

            if (statusUpdates) mergeCharacterStatus(char, statusUpdates, updateType);
            if (updates.profile) mergeCharacterProfile(char, updates.profile, updateType);
            if (updates.inventory) mergeCharacterInventory(char, updates.inventory);
            if (updates.quests) mergeCharacterQuests(char, updates.quests);
            if (updates.relations) mergeCharacterRelations(char, updates.relations, updateType);
        });

        syncCrossRelations(updatedData.characters);
    }

    return updatedData;
}