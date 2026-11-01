import {
    formatCardItem,
    buildCardFrameHtml,
    ensureMessageCardStyles,
    findChatMessageElement,
    resolveElementMessageIndex,
    RPG_DELTA_TAG_REGEX,
    escapeHtml
} from "./MessageCardRenderer.js";
import { resolveActiveSwipeId } from "../core/JSONTracker_History.js";

/**
 * Extracts tracker delta patch from message text comment or metadata.
 */
export function getDeltaLog(msg) {
    if (!msg) return null;

    if (typeof msg.mes === 'string') {
        const match = msg.mes.match(RPG_DELTA_TAG_REGEX);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {
                console.warn("[RPG Tracker] Failed to parse delta log from msg.mes", e);
            }
        }
    }

    const swipeId = resolveActiveSwipeId(msg);

    if (msg.swipe_info && msg.swipe_info[swipeId] && msg.swipe_info[swipeId].extra && msg.swipe_info[swipeId].extra.rpgTrackerDelta) {
        return msg.swipe_info[swipeId].extra.rpgTrackerDelta;
    }

    if ((swipeId === 0 || !Array.isArray(msg.swipes) || msg.swipes.length <= 1) && msg.extra && msg.extra.rpgTrackerDelta) {
        return msg.extra.rpgTrackerDelta;
    }

    return null;
}

/**
 * Stores applied delta patch inside message metadata.
 */
export function setDeltaLog(msg, patch) {
    if (!msg || !patch || Object.keys(patch).length === 0) return;

    msg.extra = msg.extra || {};
    const swipeId = resolveActiveSwipeId(msg);

    if (!Array.isArray(msg.swipe_info)) {
        msg.swipe_info = [];
    }
    if (!msg.swipe_info[swipeId]) {
        msg.swipe_info[swipeId] = { extra: {} };
    }
    if (!msg.swipe_info[swipeId].extra) {
        msg.swipe_info[swipeId].extra = {};
    }

    msg.swipe_info[swipeId].extra.rpgTrackerDelta = patch;

    if (swipeId === 0 || !Array.isArray(msg.swipes) || msg.swipes.length <= 1) {
        msg.extra.rpgTrackerDelta = patch;
    }
}

/**
 * Constructs HTML structure for message tracker changes log.
 */
export function buildDeltaLogHtml(delta) {
    if (!delta || typeof delta !== 'object' || Object.keys(delta).length === 0) return '';

    let contentHtml = '';

    Object.entries(delta).forEach(([charName, updates]) => {
        if (!updates || typeof updates !== 'object') return;

        const charChanges = [];

        // Expression / Sprite Update
        if (updates.expression) {
            let expVal = '';
            if (typeof updates.expression === 'object' && updates.expression !== null) {
                expVal = String(updates.expression.to || updates.expression.name || updates.expression.label || '').trim();
            } else {
                expVal = String(updates.expression).trim();
            }

            if (expVal) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Expression</div>
                        <ul class="rpg-msg-card-list">
                            <li><span class="rpg-msg-card-key">➔</span> <span class="rpg-msg-card-val">${escapeHtml(expVal)}</span></li>
                        </ul>
                    </div>
                `);
            }
        }

        // Status Parameters Update
        let statusUpdates = updates.status || updates.stats || null;
        if (!statusUpdates && !updates.profile && !updates.relations && !updates.inventory && !updates.quests && !updates.expression && charName.toLowerCase() !== 'world') {
            statusUpdates = updates;
        }

        if (statusUpdates && typeof statusUpdates === 'object') {
            const items = [];
            Object.entries(statusUpdates).forEach(([key, val]) => {
                const displayVal = (typeof val === 'object' && val !== null)
                    ? (val.value !== undefined ? val.value : JSON.stringify(val))
                    : val;
                items.push(`<li><span class="rpg-msg-card-key">${escapeHtml(key)}:</span> <span class="rpg-msg-card-val">${escapeHtml(displayVal)}</span></li>`);
            });
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Status</div>
                        <ul class="rpg-msg-card-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        // Profile Update
        if (updates.profile && typeof updates.profile === 'object') {
            const items = [];
            Object.entries(updates.profile).forEach(([key, val]) => {
                items.push(`<li><span class="rpg-msg-card-key">${escapeHtml(key)}:</span> <span class="rpg-msg-card-val">${escapeHtml(val)}</span></li>`);
            });
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Profile</div>
                        <ul class="rpg-msg-card-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        // Inventory Update
        if (updates.inventory && typeof updates.inventory === 'object') {
            const items = [];
            if (updates.inventory.equipment && typeof updates.inventory.equipment === 'object') {
                Object.entries(updates.inventory.equipment).forEach(([slot, val]) => {
                    if (val === null || val === undefined) {
                        items.push(`<li><span class="rpg-msg-card-key">Equip [${escapeHtml(slot)}]:</span> <span class="rpg-msg-card-val">Empty</span></li>`);
                    } else if (typeof val === 'string') {
                        items.push(`<li><span class="rpg-msg-card-key">Equip [${escapeHtml(slot)}]:</span> <span class="rpg-msg-card-val">${escapeHtml(val)}</span></li>`);
                    } else if (typeof val === 'object') {
                        const itemText = formatCardItem(val);
                        const isDeleted = val.quantity !== undefined && Number(val.quantity) <= 0;
                        const desc = (!isDeleted && (val.desc || val.description)) ? ` (${val.desc || val.description})` : '';
                        items.push(`<li><span class="rpg-msg-card-key">Equip [${escapeHtml(slot)}]:</span> <span class="rpg-msg-card-val">${escapeHtml(itemText)}${escapeHtml(desc)}</span></li>`);
                    }
                });
            }
            if (updates.inventory.storage && typeof updates.inventory.storage === 'object') {
                Object.entries(updates.inventory.storage).forEach(([container, arr]) => {
                    if (Array.isArray(arr)) {
                        const itemsStr = arr.map(i => {
                            if (typeof i === 'string') return escapeHtml(i);
                            if (i && typeof i === 'object') {
                                let text = formatCardItem(i);
                                const isDeleted = i.quantity !== undefined && Number(i.quantity) <= 0;
                                if (!isDeleted && (i.desc || i.description)) {
                                    text += ` - ${i.desc || i.description}`;
                                }
                                return escapeHtml(text);
                            }
                            return '';
                        }).filter(Boolean).join('<br/>&nbsp;&nbsp;');

                        if (itemsStr) {
                            items.push(`<li><span class="rpg-msg-card-key">Storage [${escapeHtml(container)}]:</span> <br/>&nbsp;&nbsp;<span class="rpg-msg-card-val">${itemsStr}</span></li>`);
                        } else {
                            items.push(`<li><span class="rpg-msg-card-key">Storage [${escapeHtml(container)}]:</span> <span class="rpg-msg-card-val">Empty</span></li>`);
                        }
                    }
                });
            }
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Inventory</div>
                        <ul class="rpg-msg-card-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        // Quests Update
        if (updates.quests && typeof updates.quests === 'object') {
            const items = [];
            const mainQuestData = updates.quests.main || updates.quests.mainQuest;
            if (mainQuestData) {
                const q = mainQuestData;
                if (typeof q === 'string') {
                    items.push(`<li><span class="rpg-msg-card-key">Main Quest:</span> <span class="rpg-msg-card-val">${escapeHtml(q)}</span></li>`);
                } else if (typeof q === 'object' && q !== null) {
                    const status = q.status || (q.isCompleted ? 'COMPLETED' : 'ACTIVE');
                    const name = q.name || 'Unknown';
                    const desc = q.description || q.desc ? `<br/>&nbsp;&nbsp;↳ <span style="opacity:0.8; font-size:0.9em;">${escapeHtml(q.description || q.desc)}</span>` : '';
                    items.push(`<li><span class="rpg-msg-card-key">Main Quest [${escapeHtml(status)}]:</span> <span class="rpg-msg-card-val">${escapeHtml(name)}${desc}</span></li>`);
                }
            }
            const sideQuestsList = Array.isArray(updates.quests.sideQuests)
                ? updates.quests.sideQuests
                : (Array.isArray(updates.quests.sides) ? updates.quests.sides : null);
            if (sideQuestsList) {
                sideQuestsList.forEach((sq, idx) => {
                    if (typeof sq === 'string') {
                        items.push(`<li><span class="rpg-msg-card-key">Side Quest ${idx + 1}:</span> <span class="rpg-msg-card-val">${escapeHtml(sq)}</span></li>`);
                    } else if (typeof sq === 'object' && sq !== null) {
                        const status = sq.status || (sq.isCompleted ? 'COMPLETED' : 'ACTIVE');
                        const name = sq.name || 'Unknown';
                        const desc = sq.description || sq.desc ? `<br/>&nbsp;&nbsp;↳ <span style="opacity:0.8; font-size:0.9em;">${escapeHtml(sq.description || sq.desc)}</span>` : '';
                        items.push(`<li><span class="rpg-msg-card-key">Side Quest ${idx + 1} [${escapeHtml(status)}]:</span> <span class="rpg-msg-card-val">${escapeHtml(name)}${desc}</span></li>`);
                    }
                });
            }
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Quests</div>
                        <ul class="rpg-msg-card-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        // Relations Update
        if (updates.relations && typeof updates.relations === 'object') {
            const items = [];
            Object.entries(updates.relations).forEach(([target, rData]) => {
                if (rData && typeof rData === 'object') {
                    if (rData.description) {
                        items.push(`<li><span class="rpg-msg-card-key">➔ ${escapeHtml(target)}:</span> <span class="rpg-msg-card-val">${escapeHtml(rData.description)}</span></li>`);
                    }
                    if (rData.metrics && typeof rData.metrics === 'object') {
                        const metricStrs = Object.entries(rData.metrics).map(([mName, mVal]) => {
                            const val = typeof mVal === 'object' && mVal !== null ? mVal.value : mVal;
                            return `${escapeHtml(mName)}: ${escapeHtml(val)}`;
                        }).join(', ');
                        if (metricStrs) {
                            items.push(`<li><span class="rpg-msg-card-key">➔ ${escapeHtml(target)} (Metrics):</span> <span class="rpg-msg-card-val">${metricStrs}</span></li>`);
                        }
                    }
                    if (rData.targetDescription) {
                        items.push(`<li><span class="rpg-msg-card-key">From ${escapeHtml(target)}:</span> <span class="rpg-msg-card-val">${escapeHtml(rData.targetDescription)}</span></li>`);
                    }
                    if (rData.targetMetrics && typeof rData.targetMetrics === 'object') {
                        const metricStrs = Object.entries(rData.targetMetrics).map(([tmName, tmVal]) => {
                            const val = typeof tmVal === 'object' && tmVal !== null ? tmVal.value : tmVal;
                            return `${escapeHtml(tmName)}: ${escapeHtml(val)}`;
                        }).join(', ');
                        if (metricStrs) {
                            items.push(`<li><span class="rpg-msg-card-key">From ${escapeHtml(target)} (Metrics):</span> <span class="rpg-msg-card-val">${metricStrs}</span></li>`);
                        }
                    }
                }
            });
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Relations</div>
                        <ul class="rpg-msg-card-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        // World State Update
        if (charName.toLowerCase() === 'world' && updates && typeof updates === 'object') {
            const items = [];
            if (updates.date) items.push(`<li><span class="rpg-msg-card-key">Date:</span> <span class="rpg-msg-card-val">${escapeHtml(updates.date)}</span></li>`);
            if (updates.time) items.push(`<li><span class="rpg-msg-card-key">Time:</span> <span class="rpg-msg-card-val">${escapeHtml(updates.time)}</span></li>`);
            if (updates.location) items.push(`<li><span class="rpg-msg-card-key">Location:</span> <span class="rpg-msg-card-val">${escapeHtml(updates.location)}</span></li>`);
            if (updates.weather) items.push(`<li><span class="rpg-msg-card-key">Weather:</span> <span class="rpg-msg-card-val">${escapeHtml(updates.weather)}</span></li>`);
            if (Array.isArray(updates.events)) {
                updates.events.forEach((e, idx) => {
                    if (e && typeof e === 'object') {
                        const nameStr = e.name ? `<strong>${escapeHtml(e.name)}</strong>` : '';
                        const descStr = e.desc || e.description ? escapeHtml(e.desc || e.description) : '';
                        const valStr = [nameStr, descStr].filter(Boolean).join(': ');
                        if (valStr) {
                            items.push(`<li><span class="rpg-msg-card-key">Event ${idx + 1}:</span> <span class="rpg-msg-card-val">${valStr}</span></li>`);
                        }
                    }
                });
            }
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">World State</div>
                        <ul class="rpg-msg-card-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (charChanges.length > 0) {
            const labelName = charName.toLowerCase() === 'world' ? 'World' : charName;
            contentHtml += `
                <div class="rpg-msg-card-section">
                    <div class="rpg-msg-card-section-title">${escapeHtml(labelName)}</div>
                    ${charChanges.join('')}
                </div>
            `;
        }
    });

    return buildCardFrameHtml({
        cardClass: 'rpg-delta-card',
        title: 'Tracker Changes',
        contentHtml
    });
}

/**
 * Injects delta change log cards into chat messages.
 */
export function injectAllDeltaLogs(extension_settings, extensionName, getContext) {
    if (!extension_settings[extensionName] || !extension_settings[extensionName].enabled) {
        window.$('.rpg-delta-card').remove();
        return;
    }

    const showDelta = extension_settings[extensionName].showDeltaLog !== false;
    if (!showDelta) {
        window.$('.rpg-delta-card').remove();
        return;
    }

    const context = getContext();
    if (!context || !Array.isArray(context.chat)) return;

    ensureMessageCardStyles();

    const $ = typeof window !== 'undefined' ? window.$ : null;
    if ($) {
        $('#chat .rpg-delta-card').each(function () {
            const $card = $(this);
            const $mes = $card.closest('.mes').length ? $card.closest('.mes') : $card.closest('.mes_block');
            const idx = resolveElementMessageIndex($mes, context.chat);
            const msg = idx >= 0 ? context.chat[idx] : null;
            const delta = msg ? getDeltaLog(msg) : null;
            if (!delta || typeof delta !== 'object' || Object.keys(delta).length === 0) {
                $card.remove();
            }
        });
    }

    const recentStartIndex = Math.max(0, context.chat.length - 10);

    for (let index = 0; index < context.chat.length; index++) {
        const msg = context.chat[index];
        if (!msg) continue;

        const delta = getDeltaLog(msg);
        const hasDelta = Boolean(delta && typeof delta === 'object' && Object.keys(delta).length > 0);
        if (index < recentStartIndex && !hasDelta) continue;

        const $msgEl = findChatMessageElement(index);

        if ($msgEl && $msgEl.length > 0) {
            const $existingCard = $msgEl.find('.rpg-delta-card');

            if (!hasDelta) {
                $existingCard.remove();
                continue;
            }

            const deltaSignature = encodeURIComponent(JSON.stringify(delta));

            if ($existingCard.length > 0) {
                if ($existingCard.attr('data-rpg-sig') === deltaSignature) {
                    continue;
                }
                $existingCard.remove();
            }

            const deltaHtml = buildDeltaLogHtml(delta);
            if (deltaHtml) {
                const $newCard = window.$(deltaHtml);
                $newCard.attr('data-rpg-sig', deltaSignature);

                let $target = $msgEl.find('.mes_text, .system_message_content, .text, .mes_block');
                if ($target.length === 0) {
                    $msgEl.append($newCard);
                } else {
                    $target.first().append($newCard);
                }
            } else {
                $existingCard.remove();
            }
        }
    }
}