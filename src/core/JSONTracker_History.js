import { sanitizeTrackerData, stripPromptSettings } from "./JSONTracker_Migrator.js";
import { deepClone } from "./StateHelpers.js";
import {
    findChatMessageElement,
    cleanAllMessageTrackerTags,
    RPGMT_TAG_REGEX,
    RPGMT_DIV_REGEX
} from "../messagetracker/MessageCardRenderer.js";

export { RPGMT_TAG_REGEX, RPGMT_DIV_REGEX };

/**
 * Resolves the currently active swipe index for a chat message.
 */
export function resolveActiveSwipeId(msg) {
    if (!msg || typeof msg !== 'object') return 0;
    if (Number.isInteger(msg.swipe_id) && msg.swipe_id >= 0) {
        return msg.swipe_id;
    }
    if (Array.isArray(msg.swipes) && msg.swipes.length > 0 && typeof msg.mes === 'string') {
        const foundIdx = msg.swipes.findIndex(s => s === msg.mes);
        if (foundIdx !== -1) return foundIdx;
    }
    return 0;
}

/**
 * Resolves target message index from chat history using reference, index, turnId, or sendDate.
 */
export function resolveMessageIndex(chat, msgOrIndex, sendDate = null, turnId = null) {
    if (!Array.isArray(chat) || chat.length === 0) return -1;

    // 1. Direct object reference check
    if (typeof msgOrIndex === 'object' && msgOrIndex !== null) {
        const directIdx = chat.indexOf(msgOrIndex);
        if (directIdx !== -1) return directIdx;
    }

    // 2. Direct numeric index check with identity verification
    const rawIdx = typeof msgOrIndex === 'number' ? msgOrIndex : parseInt(msgOrIndex, 10);
    if (!isNaN(rawIdx) && rawIdx >= 0 && rawIdx < chat.length) {
        const targetMsg = chat[rawIdx];
        if (targetMsg) {
            const turnIdMatches = turnId ? (targetMsg._rpgTurnId === turnId || targetMsg.extra?.rpgTurnId === turnId) : true;
            const sendDateMatches = sendDate ? String(targetMsg.send_date) === String(sendDate) : true;
            if (turnIdMatches && sendDateMatches) {
                return rawIdx;
            }
        }
    }

    // 3. Fallback search by turnId
    if (turnId) {
        const foundByTurnId = chat.findIndex(m =>
            m && (m._rpgTurnId === turnId || m.extra?.rpgTurnId === turnId)
        );
        if (foundByTurnId !== -1) return foundByTurnId;
    }

    // 4. Fallback search by sendDate
    if (sendDate) {
        const foundByDate = chat.findIndex(m => m && String(m.send_date) === String(sendDate));
        if (foundByDate !== -1) return foundByDate;
    }

    // 5. Final fallback to raw index if in bounds
    if (!isNaN(rawIdx) && rawIdx >= 0 && rawIdx < chat.length) {
        return rawIdx;
    }

    return -1;
}

/**
 * Extracts snapshot data stored in a message extra or embedded RPGMT tag.
 */
export function extractTurnSnapshotData(msg) {
    if (!msg || typeof msg !== 'object') return null;

    const activeSwipeId = resolveActiveSwipeId(msg);
    if (Array.isArray(msg.swipe_info) && msg.swipe_info[activeSwipeId]?.extra?.rpgTrackerData) {
        return {
            data: msg.swipe_info[activeSwipeId].extra.rpgTrackerData,
            isPinned: Boolean(msg.swipe_info[activeSwipeId].extra.rpgSnapshotPinned),
            timestamp: msg.swipe_info[activeSwipeId].extra.rpgSnapshotTimestamp || msg.send_date || null
        };
    }
    if ((activeSwipeId === 0 || !Array.isArray(msg.swipes) || msg.swipes.length <= 1) && msg.extra?.rpgTrackerData) {
        return {
            data: msg.extra.rpgTrackerData,
            isPinned: Boolean(msg.extra.rpgSnapshotPinned),
            timestamp: msg.extra.rpgSnapshotTimestamp || msg.send_date || null
        };
    }

    if (typeof msg.mes === 'string') {
        const match = msg.mes.match(RPGMT_TAG_REGEX) || msg.mes.match(RPGMT_DIV_REGEX);
        if (match && match[1]) {
            try {
                const unescaped = match[1]
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&#x27;/g, "'")
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .trim();
                const parsed = JSON.parse(unescaped);
                return {
                    data: (parsed && parsed.characters !== undefined) ? parsed : (parsed?.data || parsed),
                    isPinned: Boolean(parsed?.isPinned),
                    timestamp: parsed?.timestamp || msg.send_date || null
                };
            } catch {
                // Ignore malformed tag parse errors
            }
        }
    }

    return null;
}

/**
 * Checks whether a message turn snapshot is protected against automatic pruning.
 */
export function isTurnSnapshotPinned(msg, swipeId = null) {
    if (!msg || typeof msg !== 'object') return false;
    const targetSwipeId = (Number.isInteger(swipeId) && swipeId >= 0)
        ? swipeId
        : resolveActiveSwipeId(msg);

    if (Array.isArray(msg.swipe_info) && msg.swipe_info[targetSwipeId]?.extra) {
        return Boolean(msg.swipe_info[targetSwipeId].extra.rpgSnapshotPinned);
    }
    if (targetSwipeId === 0 || !Array.isArray(msg.swipes) || msg.swipes.length <= 1) {
        return Boolean(msg.extra?.rpgSnapshotPinned);
    }
    return false;
}

/**
 * Sets or removes the pinned retention state on a message turn snapshot.
 */
export function setTurnSnapshotPinned(msg, swipeId, isPinned) {
    if (!msg || typeof msg !== 'object') return false;
    const targetSwipeId = (Number.isInteger(swipeId) && swipeId >= 0)
        ? swipeId
        : resolveActiveSwipeId(msg);

    if (!Array.isArray(msg.swipe_info)) {
        msg.swipe_info = [];
    }
    if (!msg.swipe_info[targetSwipeId]) {
        msg.swipe_info[targetSwipeId] = { extra: {} };
    }
    if (!msg.swipe_info[targetSwipeId].extra) {
        msg.swipe_info[targetSwipeId].extra = {};
    }
    msg.swipe_info[targetSwipeId].extra.rpgSnapshotPinned = Boolean(isPinned);

    if (targetSwipeId === 0) {
        if (!msg.extra) msg.extra = {};
        msg.extra.rpgSnapshotPinned = Boolean(isPinned);
    }
    return true;
}

/**
 * Scans chat messages and builds the turn history list for HistoryModal.
 */
export function getChatTurnHistory(chat) {
    if (!Array.isArray(chat) || chat.length === 0) return [];
    const turns = [];

    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (!msg || typeof msg !== 'object') continue;

        const swipeId = resolveActiveSwipeId(msg);
        const snap = extractTurnSnapshotData(msg);
        const trackerPayload = msg.swipe_info?.[swipeId]?.extra?.rpgTrackerData
            || (swipeId === 0 ? msg.extra?.rpgTrackerData : null)
            || snap?.data
            || null;

        if (trackerPayload) {
            const isPinned = isTurnSnapshotPinned(msg, swipeId);
            const sender = msg.is_user ? (msg.name || 'User') : (msg.name || 'AI');
            const cleanText = typeof msg.mes === 'string' ? msg.mes.replace(/<!--[\s\S]*?-->/g, '').trim() : '';
            const textPreview = cleanText.length > 80 ? `${cleanText.substring(0, 80)}...` : (cleanText || '(No text content)');

            turns.push({
                messageIndex: i,
                messageRef: msg,
                swipeId,
                sender,
                textPreview,
                isPinned,
                data: trackerPayload,
                sendDate: msg.send_date || null,
                turnId: msg._rpgTurnId || msg.extra?.rpgTurnId || null
            });
        }
    }
    return turns;
}

/**
 * Restores a historical snapshot state to the live session.
 */
export function restoreTurnSnapshotToLive(snapshotData, applyLocksFn, syncChatDataFn, saveChatDataFn) {
    if (!snapshotData || typeof snapshotData !== 'object') return false;
    const cleanData = sanitizeTrackerData(snapshotData);
    const lockedData = typeof applyLocksFn === 'function' ? applyLocksFn(cleanData) : cleanData;

    if (typeof syncChatDataFn === 'function') {
        syncChatDataFn(lockedData);
    }
    if (typeof saveChatDataFn === 'function') {
        saveChatDataFn(lockedData);
    }
    return true;
}

/**
 * Updates or replaces turn snapshot data within message metadata and embedded text.
 * Supports unified options object or legacy positional arguments.
 */
export async function updateTurnSnapshotData(chat, msgOrIndex, arg3, arg4 = null, arg5 = null, arg6 = null) {
    let swipeId = null;
    let newTurnData = null;
    let sendDate = null;
    let turnId = null;
    let updateMessageFn = null;
    let saveChatFn = null;

    if (arg3 && typeof arg3 === 'object' && ('newTrackerData' in arg3 || 'data' in arg3 || 'updateMessageFn' in arg3 || 'saveChatFn' in arg3)) {
        swipeId = arg3.swipeId ?? null;
        newTurnData = arg3.newTrackerData ?? arg3.data ?? null;
        sendDate = arg3.sendDate ?? null;
        turnId = arg3.turnId ?? null;
        updateMessageFn = typeof arg3.updateMessageFn === 'function' ? arg3.updateMessageFn : null;
        saveChatFn = typeof arg3.saveChatFn === 'function' ? arg3.saveChatFn : null;
    } else if (typeof arg3 === 'number') {
        swipeId = arg3;
        newTurnData = arg4;
        updateMessageFn = typeof arg5 === 'function' ? arg5 : null;
        saveChatFn = typeof arg6 === 'function' ? arg6 : null;
    } else {
        newTurnData = arg3;
        sendDate = arg4;
        turnId = arg5;
        updateMessageFn = typeof arg6 === 'function' ? arg6 : null;
    }

    const index = resolveMessageIndex(chat, msgOrIndex, sendDate, turnId);
    if (index === -1) return false;

    const msg = chat[index];
    if (!msg || typeof msg !== 'object') return false;

    const targetSwipeId = (Number.isInteger(swipeId) && swipeId >= 0)
        ? swipeId
        : resolveActiveSwipeId(msg);

    const cleanData = newTurnData && typeof newTurnData === 'object'
        ? stripPromptSettings(sanitizeTrackerData(deepClone(newTurnData)))
        : newTurnData;

    // Refresh visual snapshot card payload if already present in text
    const updateCardPayloadFromCleanData = (targetText) => {
        if (typeof targetText !== 'string' || (!RPGMT_TAG_REGEX.test(targetText) && !RPGMT_DIV_REGEX.test(targetText))) {
            return targetText;
        }
        try {
            const rawMatch = targetText.match(RPGMT_TAG_REGEX) || targetText.match(RPGMT_DIV_REGEX);
            if (rawMatch && rawMatch[1]) {
                const unescaped = rawMatch[1]
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&#x27;/g, "'")
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .trim();
                const cardObj = JSON.parse(unescaped);
                if (cardObj && typeof cardObj === 'object') {
                    if (cardObj.data && typeof cardObj.data === 'object') {
                        cardObj.data = cleanData;
                    }
                    if (cardObj.chars && typeof cardObj.chars === 'object' && Array.isArray(cleanData?.characters)) {
                        Object.keys(cardObj.chars).forEach(charName => {
                            const freshChar = cleanData.characters.find(c => c.name === charName);
                            if (freshChar) {
                                const currentCardChar = cardObj.chars[charName];
                                if (currentCardChar.status && freshChar.status) currentCardChar.status = freshChar.status;
                                if (currentCardChar.profile && freshChar.profile) currentCardChar.profile = freshChar.profile;
                                if (currentCardChar.relations && freshChar.relations) currentCardChar.relations = freshChar.relations;
                                if (currentCardChar.inventory && freshChar.inventory) currentCardChar.inventory = freshChar.inventory;
                                if (currentCardChar.quests && freshChar.quests) currentCardChar.quests = freshChar.quests;
                            }
                        });
                    }
                    if (cardObj.world && typeof cardObj.world === 'object' && cleanData?.worldState) {
                        const ws = cleanData.worldState;
                        if (cardObj.world.date !== undefined && ws.date) cardObj.world.date = ws.date;
                        if (cardObj.world.time !== undefined && ws.time) cardObj.world.time = ws.time;
                        if (cardObj.world.weather !== undefined && ws.weather) cardObj.world.weather = ws.weather;
                        if (cardObj.world.location !== undefined && ws.location) cardObj.world.location = ws.location;
                        if (cardObj.world.events !== undefined && ws.events) cardObj.world.events = ws.events;
                    }

                    const newTag = `<!-- <rpgmt>${JSON.stringify(cardObj)}</rpgmt> -->`;
                    return targetText.replace(RPGMT_TAG_REGEX, newTag).replace(RPGMT_DIV_REGEX, newTag);
                }
            }
        } catch {
            // Keep unchanged if parsing fails
        }
        return targetText;
    };

    if (typeof msg.mes === 'string') {
        msg.mes = updateCardPayloadFromCleanData(msg.mes);
    }

    if (Array.isArray(msg.swipes) && typeof msg.swipes[targetSwipeId] === 'string') {
        msg.swipes[targetSwipeId] = updateCardPayloadFromCleanData(msg.swipes[targetSwipeId]);
    }

    if (!Array.isArray(msg.swipe_info)) {
        msg.swipe_info = [];
    }
    if (!msg.swipe_info[targetSwipeId]) {
        msg.swipe_info[targetSwipeId] = { extra: {} };
    }
    if (!msg.swipe_info[targetSwipeId].extra) {
        msg.swipe_info[targetSwipeId].extra = {};
    }
    msg.swipe_info[targetSwipeId].extra.rpgTrackerData = cleanData;

    if (targetSwipeId === 0 || !Array.isArray(msg.swipe_info) || msg.swipe_info.length <= 1) {
        if (!msg.extra) msg.extra = {};
        msg.extra.rpgTrackerData = cleanData;
    }

    if (typeof updateMessageFn === 'function') {
        updateMessageFn(index, msg);
    }
    if (typeof saveChatFn === 'function') {
        await saveChatFn();
    }

    return true;
}

/**
 * Deletes snapshot data from a message completely.
 * Supports unified options object or legacy positional arguments.
 */
export async function deleteTurnSnapshot(chat, msgOrIndex, arg3 = null, arg4 = null, arg5 = null, arg6 = null, arg7 = null) {
    let swipeId = null;
    let sendDate = null;
    let turnId = null;
    let updateMessageFn = null;
    let saveChatFn = null;
    let deleteDelta = true;
    let cleanTags = true;

    if (arg3 && typeof arg3 === 'object' && !Array.isArray(arg3)) {
        swipeId = (Number.isInteger(arg3.swipeId) && arg3.swipeId >= 0) ? arg3.swipeId : null;
        sendDate = arg3.sendDate ?? null;
        turnId = arg3.turnId ?? null;
        updateMessageFn = typeof arg3.updateMessageFn === 'function' ? arg3.updateMessageFn : null;
        saveChatFn = typeof arg3.saveChatFn === 'function' ? arg3.saveChatFn : null;
        if (typeof arg3.deleteDelta === 'boolean') {
            deleteDelta = arg3.deleteDelta;
        }
        if (typeof arg3.cleanTags === 'boolean') {
            cleanTags = arg3.cleanTags;
        }
    } else {
        swipeId = typeof arg3 === 'number' ? arg3 : null;
        if (typeof arg4 === 'function') updateMessageFn = arg4;
        else if (typeof arg4 === 'string') sendDate = arg4;
        if (typeof arg5 === 'function') saveChatFn = arg5;
        else if (typeof arg5 === 'string') turnId = arg5;
        if (typeof arg6 === 'function') updateMessageFn = arg6;
        else if (typeof arg6 === 'boolean') deleteDelta = arg6;
        if (typeof arg7 === 'function') saveChatFn = arg7;
        else if (typeof arg7 === 'boolean') deleteDelta = arg7;
    }

    const index = resolveMessageIndex(chat, msgOrIndex, sendDate, turnId);
    if (index === -1) return false;

    const msg = chat[index];
    if (!msg || typeof msg !== 'object') return false;

    const targetSwipeId = (Number.isInteger(swipeId) && swipeId >= 0)
        ? swipeId
        : resolveActiveSwipeId(msg);

    const isCurrentActiveSwipe = resolveActiveSwipeId(msg) === targetSwipeId;

    if (Array.isArray(msg.swipe_info)) {
        if (Number.isInteger(swipeId) && swipeId >= 0) {
            if (msg.swipe_info[swipeId]?.extra) {
                delete msg.swipe_info[swipeId].extra.rpgTrackerData;
                delete msg.swipe_info[swipeId].extra.rpgSnapshotPinned;
                delete msg.swipe_info[swipeId].extra.rpgSnapshotTimestamp;
                if (deleteDelta) {
                    delete msg.swipe_info[swipeId].extra.rpgTrackerDelta;
                }
            }
        } else {
            msg.swipe_info.forEach(swipeObj => {
                if (swipeObj?.extra) {
                    delete swipeObj.extra.rpgTrackerData;
                    delete swipeObj.extra.rpgSnapshotPinned;
                    delete swipeObj.extra.rpgSnapshotTimestamp;
                    if (deleteDelta) {
                        delete swipeObj.extra.rpgTrackerDelta;
                    }
                }
            });
        }
    }

    const hasOtherSwipeData = Array.isArray(msg.swipe_info) && msg.swipe_info.some((s, idx) => {
        if (Number.isInteger(swipeId) && idx === swipeId) return false;
        return Boolean(s?.extra?.rpgTrackerData);
    });

    if (!hasOtherSwipeData || isCurrentActiveSwipe || targetSwipeId === 0 || !Number.isInteger(swipeId)) {
        if (msg.extra) {
            delete msg.extra.rpgTrackerData;
            delete msg.extra.rpgSnapshotPinned;
            delete msg.extra.rpgSnapshotTimestamp;
            if (deleteDelta) {
                delete msg.extra.rpgTrackerDelta;
            }
        }
    }

    if (cleanTags) {
        if (Number.isInteger(swipeId) && swipeId >= 0 && Array.isArray(msg.swipes)) {
            if (msg.swipes[swipeId] && typeof msg.swipes[swipeId] === 'string') {
                msg.swipes[swipeId] = cleanAllMessageTrackerTags(msg.swipes[swipeId], { stripDelta: deleteDelta });
            }
            if (isCurrentActiveSwipe && typeof msg.mes === 'string') {
                msg.mes = cleanAllMessageTrackerTags(msg.mes, { stripDelta: deleteDelta });
            }
        } else {
            if (typeof msg.mes === 'string') {
                msg.mes = cleanAllMessageTrackerTags(msg.mes, { stripDelta: deleteDelta });
            }

            if (Array.isArray(msg.swipes)) {
                msg.swipes = msg.swipes.map(swipe => {
                    if (typeof swipe !== 'string') return swipe;
                    return cleanAllMessageTrackerTags(swipe, { stripDelta: deleteDelta });
                });
            }
        }

        const $msgEl = findChatMessageElement(index);
        if ($msgEl && $msgEl.length > 0) {
            const selector = deleteDelta
                ? '.rpg-snapshot-card, .rpg-delta-card'
                : '.rpg-snapshot-card';
            $msgEl.find(selector).remove();
        }
    }

    if (typeof updateMessageFn === 'function') {
        updateMessageFn(index, msg);
    }
    if (typeof saveChatFn === 'function') {
        await saveChatFn();
    }

    return true;
}

/**
 * Prunes older snapshot backups from chat messages, preserving pinned entries and deltas.
 */
export async function manualPruneBackups(chat, keepCount = 10, saveChatFn = null, updateMessageFn = null) {
    if (!Array.isArray(chat) || chat.length === 0) return { prunedCount: 0, pinnedCount: 0 };

    let foundCount = 0;
    let prunedCount = 0;
    let pinnedCount = 0;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (!msg || typeof msg !== 'object') continue;

        const swipeId = resolveActiveSwipeId(msg);
        const snap = extractTurnSnapshotData(msg);
        const hasBackup = Boolean(
            msg.swipe_info?.[swipeId]?.extra?.rpgTrackerData ||
            (swipeId === 0 && msg.extra?.rpgTrackerData) ||
            snap?.data
        );

        if (hasBackup) {
            foundCount++;
            const isPinned = isTurnSnapshotPinned(msg, swipeId);
            if (isPinned) {
                pinnedCount++;
            } else if (keepCount >= 0 && foundCount > keepCount) {
                await deleteTurnSnapshot(chat, i, {
                    swipeId,
                    updateMessageFn,
                    deleteDelta: false,
                    cleanTags: false
                });
                prunedCount++;
            }
        }
    }

    if (prunedCount > 0 && typeof saveChatFn === 'function') {
        await saveChatFn();
    }

    return { prunedCount, pinnedCount };
}