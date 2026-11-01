import {
    getInitialTrackerData,
    createDefaultCharacter,
    DEFAULT_STATUS_SCHEMAS,
    DEFAULT_STATUS
} from './PromptSchema.js';
import { sanitizeTrackerData, stripPromptSettings, getNextCharacterId } from './JSONTracker_Migrator.js';
import { applyLLMPatch, extractNormalizedPatch } from './JSONTracker_Patcher.js';
import { resolveActiveSwipeId, isTurnSnapshotPinned, extractTurnSnapshotData } from './JSONTracker_History.js';
import { parseResponse } from './ResponseParser.js';
import {
    cleanAllMessageTrackerTags,
    RPG_DELTA_TAG_REGEX,
    RPGMT_TAG_REGEX,
    RPGMT_DIV_REGEX
} from '../messagetracker/MessageCardRenderer.js';

const DEFAULT_MAX_KEEP = 20;

/**
 * Defensively merges snapshot data directly into active tracker schemas.
 * Ensures historical character IDs, names, and schemas are fully protected against drops,
 * falling back safely to default templates when snapshot characters lack explicit statusSchema.
 * @param {Object} masterSchema - Active or default baseline schema.
 * @param {Object} backupData - Recovered snapshot or historical backup payload.
 * @returns {Object} Merged and schema-preserved tracker state.
 */
export function defensiveMerge(masterSchema, backupData) {
    if (!backupData || typeof backupData !== 'object') return masterSchema;

    const merged = { ...masterSchema };

    Object.keys(masterSchema).forEach(key => {
        if (backupData[key] !== undefined) {
            if (key === 'characters' && Array.isArray(masterSchema.characters) && Array.isArray(backupData.characters)) {
                merged.characters = backupData.characters.map((backupChar, index) => {
                    if (!backupChar || typeof backupChar !== 'object') return backupChar;

                    const bName = backupChar.name?.trim()?.toLowerCase();

                    const matchedMaster = (bName && masterSchema.characters.find(c => c.name?.trim()?.toLowerCase() === bName))
                        || masterSchema.characters.find(c => c.id === backupChar.id)
                        || null;

                    const cleanBackupChar = backupChar;
                    const isUserPlayer = cleanBackupChar.activePlayer !== undefined
                        ? Boolean(cleanBackupChar.activePlayer)
                        : (index === 0 && (cleanBackupChar.id === 'char_user' || cleanBackupChar.name === 'New'));

                    const cleanMasterChar = matchedMaster || createDefaultCharacter({
                        id: cleanBackupChar.id || (index === 0 && isUserPlayer ? 'char_user' : getNextCharacterId()),
                        name: cleanBackupChar.name || 'Character',
                        activePlayer: isUserPlayer
                    });

                    const effectiveId = cleanBackupChar.id || cleanMasterChar.id;
                    const effectiveName = (cleanBackupChar.name && cleanBackupChar.name.trim() !== 'New')
                        ? cleanBackupChar.name
                        : (cleanMasterChar.name || cleanBackupChar.name || 'Character');

                    let effectiveStatusSchema = [];
                    if (Array.isArray(cleanBackupChar.statusSchema) && cleanBackupChar.statusSchema.length > 0) {
                        effectiveStatusSchema = cleanBackupChar.statusSchema;
                    } else if (Array.isArray(cleanMasterChar.statusSchema) && cleanMasterChar.statusSchema.length > 0) {
                        effectiveStatusSchema = cleanMasterChar.statusSchema;
                    } else {
                        effectiveStatusSchema = JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS));
                    }

                    const masterInv = cleanMasterChar.inventory || {};
                    const backupInv = cleanBackupChar.inventory || {};
                    const effectiveInventory = {
                        equipIsLocked: backupInv.equipIsLocked ?? masterInv.equipIsLocked ?? false,
                        equipIsInject: backupInv.equipIsInject ?? masterInv.equipIsInject ?? isUserPlayer,
                        storageIsLocked: backupInv.storageIsLocked ?? masterInv.storageIsLocked ?? false,
                        storageIsInject: backupInv.storageIsInject ?? masterInv.storageIsInject ?? isUserPlayer,
                        equipmentLocks: { ...(masterInv.equipmentLocks || {}), ...(backupInv.equipmentLocks || {}) },
                        storageLocks: { ...(masterInv.storageLocks || {}), ...(backupInv.storageLocks || {}) },
                        equipment: (backupInv.equipment && typeof backupInv.equipment === 'object')
                            ? backupInv.equipment
                            : (masterInv.equipment || (isUserPlayer ? { 'Right Hand': null, 'Left Hand': null } : {})),
                        storage: (backupInv.storage && typeof backupInv.storage === 'object')
                            ? backupInv.storage
                            : (masterInv.storage || (isUserPlayer ? { 'Backpack': [] } : {}))
                    };

                    const masterQuests = cleanMasterChar.quests || {};
                    const backupQuests = cleanBackupChar.quests || {};
                    const effectiveQuests = {
                        main: backupQuests.main || masterQuests.main || { name: '', desc: '', isCompleted: false, isLocked: false },
                        sides: Array.isArray(backupQuests.sides) ? backupQuests.sides : (Array.isArray(masterQuests.sides) ? masterQuests.sides : [])
                    };

                    const hasBackupProfile = cleanBackupChar.profile && typeof cleanBackupChar.profile === 'object';
                    const effectiveProfile = hasBackupProfile
                        ? { ...cleanBackupChar.profile }
                        : { ...(cleanMasterChar.profile || {}) };
                    const effectiveProfileLocks = {};
                    const effectiveProfileInjects = {};
                    Object.keys(effectiveProfile).forEach(k => {
                        effectiveProfileLocks[k] = cleanBackupChar.profileLocks?.[k] !== undefined
                            ? Boolean(cleanBackupChar.profileLocks[k])
                            : Boolean(cleanMasterChar.profileLocks?.[k]);
                        effectiveProfileInjects[k] = cleanBackupChar.profileInjects?.[k] !== undefined
                            ? Boolean(cleanBackupChar.profileInjects[k])
                            : (cleanMasterChar.profileInjects?.[k] !== undefined ? Boolean(cleanMasterChar.profileInjects[k]) : true);
                    });

                    const hasBackupRelations = cleanBackupChar.relations && typeof cleanBackupChar.relations === 'object';
                    const effectiveRelations = hasBackupRelations
                        ? { ...cleanBackupChar.relations }
                        : { ...(cleanMasterChar.relations || {}) };

                    return {
                        ...cleanMasterChar,
                        ...cleanBackupChar,
                        id: effectiveId,
                        name: effectiveName,
                        statusSchema: effectiveStatusSchema,
                        status: { ...(cleanMasterChar.status || DEFAULT_STATUS), ...(cleanBackupChar.status || {}) },
                        profile: effectiveProfile,
                        profileLocks: effectiveProfileLocks,
                        profileInjects: effectiveProfileInjects,
                        inventory: effectiveInventory,
                        quests: effectiveQuests,
                        relations: effectiveRelations
                    };
                });
            } else if (typeof masterSchema[key] === 'object' && !Array.isArray(masterSchema[key])) {
                merged[key] = { ...masterSchema[key], ...backupData[key] };
            } else {
                merged[key] = backupData[key];
            }
        }
    });

    if (backupData.currentPresetId !== undefined) {
        merged.currentPresetId = backupData.currentPresetId;
    }
    if (backupData.currentPresetName !== undefined) {
        merged.currentPresetName = backupData.currentPresetName;
    }

    return merged;
}

/**
 * Prunes older hidden snapshots across turns when exceeding the retention limit.
 * Turns marked with a pinned retention lock are strictly exempt from pruning.
 * @param {Array<Object>} chat - SillyTavern chat message list.
 * @param {number} maxKeep - Number of recent snapshots to preserve.
 * @param {Function|null} updateMessageFn - Message update callback.
 */
export function purgeOldBackups(chat, maxKeep = DEFAULT_MAX_KEEP, updateMessageFn = null) {
    if (!Array.isArray(chat)) return;
    if (maxKeep < 0 || maxKeep === Infinity) return;

    let backedUpMessagesCount = 0;

    for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message) continue;

        const activeSwipe = resolveActiveSwipeId(message);
        const text = typeof message.mes === 'string' ? message.mes : '';
        const hasCardTag = RPGMT_TAG_REGEX.test(text) || RPGMT_DIV_REGEX.test(text);

        let hasHiddenBackup = Boolean(
            message.swipe_info?.[activeSwipe]?.extra?.rpgTrackerData ||
            (activeSwipe === 0 && message.extra?.rpgTrackerData) ||
            hasCardTag
        );

        if (!hasHiddenBackup) continue;

        if (isTurnSnapshotPinned(message, activeSwipe)) {
            continue;
        }

        backedUpMessagesCount++;

        if (backedUpMessagesCount > maxKeep) {
            let changed = false;

            if (message.swipe_info?.[activeSwipe]?.extra?.rpgTrackerData) {
                delete message.swipe_info[activeSwipe].extra.rpgTrackerData;
                changed = true;
            }
            if (activeSwipe === 0 && message.extra?.rpgTrackerData) {
                delete message.extra.rpgTrackerData;
                changed = true;
            }

            if (hasCardTag) {
                message.mes = cleanAllMessageTrackerTags(message.mes, { stripDelta: false });
                if (Array.isArray(message.swipes) && message.swipes[activeSwipe]) {
                    message.swipes[activeSwipe] = cleanAllMessageTrackerTags(message.swipes[activeSwipe], { stripDelta: false });
                }
                changed = true;
            }

            if (changed && typeof updateMessageFn === 'function') {
                updateMessageFn(i, message);
            }
        }
    }
}

/**
 * Stores current tracker state inside hidden message metadata.
 * Strips prompt configurations to ensure lightweight message persistence.
 * @param {Array<Object>} chat - SillyTavern chat message list.
 * @param {number} index - Message index.
 * @param {Object} trackerData - State payload to persist.
 * @param {Function} updateMessageFn - Message update callback.
 * @param {Function} saveChatFn - Storage commit callback.
 * @param {number} maxKeep - Snapshot retention limit.
 * @param {number|undefined} savedSwipeId - Target swipe index.
 * @param {boolean} shouldPurge - Whether to execute backup pruning.
 */
export function backupToMessage(
    chat,
    index,
    trackerData,
    updateMessageFn,
    saveChatFn,
    maxKeep = DEFAULT_MAX_KEEP,
    savedSwipeId = undefined,
    shouldPurge = false
) {
    if (!Array.isArray(chat) || index < 0 || !chat[index]) return;

    const targetMessage = chat[index];

    let strippedData = JSON.parse(JSON.stringify(trackerData));
    strippedData = stripPromptSettings(strippedData);

    const swipeId = (Number.isInteger(savedSwipeId) && savedSwipeId >= 0)
        ? savedSwipeId
        : resolveActiveSwipeId(targetMessage);

    if (!Array.isArray(targetMessage.swipe_info)) {
        targetMessage.swipe_info = [];
    }
    if (!targetMessage.swipe_info[swipeId]) {
        targetMessage.swipe_info[swipeId] = { extra: {} };
    }
    if (!targetMessage.swipe_info[swipeId].extra) {
        targetMessage.swipe_info[swipeId].extra = {};
    }

    targetMessage.swipe_info[swipeId].extra.rpgTrackerData = strippedData;

    if (swipeId === 0) {
        targetMessage.extra = targetMessage.extra || {};
        targetMessage.extra.rpgTrackerData = strippedData;
    }

    if (shouldPurge) {
        purgeOldBackups(chat, maxKeep, updateMessageFn);
    }

    if (typeof updateMessageFn === 'function') {
        updateMessageFn(index, targetMessage);
    }

    if (typeof saveChatFn === 'function') {
        const savePromise = saveChatFn();
        if (savePromise && typeof savePromise.catch === 'function') {
            savePromise.catch(err => console.warn("[RPG Tracker] saveChatFn error in backupToMessage:", err));
        }
    }
}

/**
 * Synchronously recovers the most recent state snapshot from message metadata history.
 * @param {Array<Object>} chat - SillyTavern chat message list.
 * @returns {Object|null} Recovered and sanitized tracker data or null.
 */
/**
 * Core engine for reconstructing state history from message backups and sequential deltas.
 */
function rehydrateCore(chat, isAsync) {
    if (!Array.isArray(chat) || chat.length === 0) return null;

    const lastMsg = chat[chat.length - 1];
    if (lastMsg) {
        const lastSwipeId = resolveActiveSwipeId(lastMsg);
        let directData = lastMsg.swipe_info?.[lastSwipeId]?.extra?.rpgTrackerData
            ?? (lastSwipeId === 0 ? lastMsg.extra?.rpgTrackerData : null);

        if (!directData) {
            const snap = extractTurnSnapshotData(lastMsg);
            if (snap?.data) directData = snap.data;
        }

        if (directData && typeof directData === 'object' && directData.characters !== undefined) {
            return sanitizeTrackerData(directData);
        }
    }

    let baseIndex = -1;
    let accumulatedData = null;

    for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message) continue;

        const swipeId = resolveActiveSwipeId(message);
        let backupData = message.swipe_info?.[swipeId]?.extra?.rpgTrackerData
            ?? (swipeId === 0 ? message.extra?.rpgTrackerData : null);

        if (!backupData) {
            const snap = extractTurnSnapshotData(message);
            if (snap?.data) backupData = snap.data;
        }

        if (backupData && typeof backupData === 'object' && backupData.characters !== undefined) {
            accumulatedData = JSON.parse(JSON.stringify(backupData));
            baseIndex = i;
            break;
        }
    }

    if (!accumulatedData) {
        accumulatedData = getInitialTrackerData();
        baseIndex = -1;
    }

    let anyUpdateApplied = baseIndex !== -1;

    const applyTurnDelta = (message) => {
        if (!message) return;
        const swipeId = resolveActiveSwipeId(message);
        let deltaPatch = message.swipe_info?.[swipeId]?.extra?.rpgTrackerDelta
            ?? (swipeId === 0 ? message.extra?.rpgTrackerDelta : null);

        if (!deltaPatch && typeof message.mes === 'string') {
            const deltaMatch = message.mes.match(RPG_DELTA_TAG_REGEX);
            if (deltaMatch && deltaMatch[1]) {
                try {
                    deltaPatch = JSON.parse(deltaMatch[1]);
                } catch {
                    // Ignore parsing failure
                }
            }
        }

        if (deltaPatch && typeof deltaPatch === 'object' && Object.keys(deltaPatch).length > 0) {
            accumulatedData = applyLLMPatch(accumulatedData, deltaPatch, false, 'patch', true);
            anyUpdateApplied = true;
        } else if (typeof message.mes === 'string') {
            const { patch } = parseResponse(message.mes);
            if (patch && typeof patch === 'object' && Object.keys(patch).length > 0) {
                if (Array.isArray(patch.characters)) {
                    accumulatedData = JSON.parse(JSON.stringify(patch));
                } else {
                    const normPatch = extractNormalizedPatch(patch);
                    accumulatedData = applyLLMPatch(accumulatedData, normPatch, false, 'patch', true);
                }
                anyUpdateApplied = true;
            }
        }
    };

    if (isAsync) {
        return (async () => {
            for (let i = baseIndex + 1; i < chat.length; i++) {
                if (i % 15 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                applyTurnDelta(chat[i]);
            }
            return anyUpdateApplied ? sanitizeTrackerData(accumulatedData) : null;
        })();
    }

    for (let i = baseIndex + 1; i < chat.length; i++) {
        applyTurnDelta(chat[i]);
    }
    return anyUpdateApplied ? sanitizeTrackerData(accumulatedData) : null;
}

/**
 * Recovers tracker state from chat history by scanning backwards for turn backups.
 * @param {Array<Object>} chat - SillyTavern chat message list.
 * @returns {Object|null} Recovered and sanitized tracker data or null.
 */
export function rehydrateFromHistory(chat) {
    return rehydrateCore(chat, false);
}

/**
 * Asynchronously restores state history, sequentially replaying intermediate deltas if needed.
 * @param {Array<Object>} chat - SillyTavern chat message list.
 * @returns {Promise<Object|null>} Restored tracker data or null.
 */
export async function rehydrateFromHistoryAsync(chat) {
    return rehydrateCore(chat, true);
}