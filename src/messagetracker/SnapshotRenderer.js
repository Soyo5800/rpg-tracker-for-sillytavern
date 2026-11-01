import {
    formatCardItem,
    buildCardFrameHtml,
    ensureMessageCardStyles,
    findChatMessageElement,
    resolveElementMessageIndex,
    RPGMT_TAG_REGEX,
    RPGMT_DIV_REGEX,
    escapeHtml
} from "./MessageCardRenderer.js";

const SNAPSHOT_ICON_SVG = `
    <svg viewBox="0 0 24 24" style="width: 1.1em; height: 1.1em; display: block;" fill="currentColor">
        <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
        <circle cx="7" cy="10" r="2.2" />
        <path d="M4 15.5c0-1.8 1.3-3 3-3s3 1.2 3 3v0.5H4v-0.5z" />
        <rect x="12" y="8.5" width="7" height="1.5" rx="0.75" />
        <rect x="12" y="11.5" width="6" height="1.5" rx="0.75" />
        <rect x="12" y="14.5" width="7" height="1.5" rx="0.75" />
    </svg>
`;

export function buildSnapshotHtml(payload) {
    if (!payload || Object.keys(payload).length === 0) return '';

    let contentHtml = '';

    if (payload.world) {
        const w = payload.world;
        const wItems = [];
        if (w.date) wItems.push(`<li><span class="rpg-msg-card-key">Date:</span> <span class="rpg-msg-card-val">${escapeHtml(w.date)}</span></li>`);
        if (w.time) wItems.push(`<li><span class="rpg-msg-card-key">Time:</span> <span class="rpg-msg-card-val">${escapeHtml(w.time)}</span></li>`);
        if (w.location) wItems.push(`<li><span class="rpg-msg-card-key">Location:</span> <span class="rpg-msg-card-val">${escapeHtml(w.location)}</span></li>`);
        if (w.weather) wItems.push(`<li><span class="rpg-msg-card-key">Weather:</span> <span class="rpg-msg-card-val">${escapeHtml(w.weather)}</span></li>`);

        let eventHtml = '';
        if (Array.isArray(w.events) && w.events.length > 0) {
            const evList = w.events.map(e => {
                const nameStr = e.name ? `<strong>${escapeHtml(e.name)}</strong>: ` : '';
                const descStr = e.desc ? escapeHtml(e.desc) : (typeof e === 'string' ? escapeHtml(e) : '');
                return `<li><span class="rpg-msg-card-val">${nameStr}${descStr}</span></li>`;
            }).join('');

            eventHtml = `
                <div class="rpg-msg-card-sub-group" style="margin-top: 6px;">
                    <div class="rpg-msg-card-sub-title">Events</div>
                    <ul class="rpg-msg-card-list">${evList}</ul>
                </div>
            `;
        }

        if (wItems.length > 0 || eventHtml) {
            contentHtml += `
                <div class="rpg-msg-card-section">
                    <div class="rpg-msg-card-section-title">World State</div>
                    ${wItems.length > 0 ? `<ul class="rpg-msg-card-list" style="margin-bottom: 4px;">${wItems.join('')}</ul>` : ''}
                    ${eventHtml}
                </div>
            `;
        }
    }

    if (payload.chars) {
        Object.entries(payload.chars).forEach(([charName, data]) => {
            let charSectionsHtml = '';

            const statusObj = data.status || data.stats;
            if (statusObj && Object.keys(statusObj).length > 0) {
                const statusItems = [];
                Object.entries(statusObj).forEach(([k, v]) => {
                    const valStr = typeof v === 'object' && v !== null ? v.value : v;
                    statusItems.push(`<li><span class="rpg-msg-card-key">${escapeHtml(k)}:</span> <span class="rpg-msg-card-val">${escapeHtml(valStr)}</span></li>`);
                });
                charSectionsHtml += `
                    <div class="rpg-msg-card-sub-group">
                        <div class="rpg-msg-card-sub-title">Status</div>
                        <ul class="rpg-msg-card-list rpg-msg-card-grid">${statusItems.join('')}</ul>
                    </div>
                `;
            }

            if (data.profile && Object.keys(data.profile).length > 0) {
                const profileItems = [];
                Object.entries(data.profile).forEach(([k, v]) => {
                    if (v && String(v).trim() !== '') {
                        profileItems.push(`<li><span class="rpg-msg-card-key">${escapeHtml(k)}:</span> <span class="rpg-msg-card-val">${escapeHtml(v)}</span></li>`);
                    }
                });
                if (profileItems.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-msg-card-sub-group">
                            <div class="rpg-msg-card-sub-title">Profile</div>
                            <ul class="rpg-msg-card-list">${profileItems.join('')}</ul>
                        </div>
                    `;
                }
            }

            if (data.relations && Object.keys(data.relations).length > 0) {
                const relationItems = [];
                Object.entries(data.relations).forEach(([targetName, rData]) => {
                    if (rData && typeof rData === 'object') {
                        const metrics = rData.values || rData.metrics || {};
                        const metricsStr = Object.entries(metrics).map(([mName, mVal]) => {
                            const val = typeof mVal === 'object' && mVal !== null ? mVal.value : mVal;
                            return `${escapeHtml(mName)}: ${escapeHtml(val)}`;
                        }).join(', ');

                        const metricsPart = metricsStr ? `[${metricsStr}]` : '';
                        const desc = rData.text || rData.description || '';
                        const descPart = (desc && desc.trim() !== '') ? ` ${escapeHtml(desc.trim())}` : '';

                        if (metricsPart || descPart) {
                            relationItems.push(`
                                <li>
                                    <span class="rpg-msg-card-key" style="opacity: 0.85;">➔ ${escapeHtml(targetName)}</span> 
                                    <span class="rpg-msg-card-val">
                                        ${metricsPart ? `<strong style="font-size: 0.9em; opacity: 0.95;">${metricsPart}</strong>` : ''} 
                                        ${descPart}
                                    </span>
                                </li>
                            `);
                        }

                        const targetMetrics = rData.targetValues || rData.targetMetrics || {};
                        const targetMetricsStr = Object.entries(targetMetrics).map(([tmName, tmVal]) => {
                            const val = typeof tmVal === 'object' && tmVal !== null ? tmVal.value : tmVal;
                            return `${escapeHtml(tmName)}: ${escapeHtml(val)}`;
                        }).join(', ');

                        const targetMetricsPart = targetMetricsStr ? `[${targetMetricsStr}]` : '';
                        const targetDesc = rData.targetText || rData.targetDescription || '';
                        const targetDescPart = (targetDesc && targetDesc.trim() !== '') ? ` ${escapeHtml(targetDesc.trim())}` : '';

                        if (targetMetricsPart || targetDescPart) {
                            relationItems.push(`
                                <li>
                                    <span class="rpg-msg-card-key" style="opacity: 0.7;">↳ From ${escapeHtml(targetName)}</span> 
                                    <span class="rpg-msg-card-val" style="opacity: 0.9;">
                                        ${targetMetricsPart ? `<strong style="font-size: 0.9em;">${targetMetricsPart}</strong>` : ''} 
                                        ${targetDescPart}
                                    </span>
                                </li>
                            `);
                        }
                    }
                });

                if (relationItems.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-msg-card-sub-group">
                            <div class="rpg-msg-card-sub-title">Relations</div>
                            <ul class="rpg-msg-card-list">${relationItems.join('')}</ul>
                        </div>
                    `;
                }
            }

            if (data.inventory) {
                const invDetails = [];
                if (data.inventory.equipment && Object.keys(data.inventory.equipment).length > 0) {
                    Object.entries(data.inventory.equipment).forEach(([slot, item]) => {
                        if (item) {
                            const itemText = formatCardItem(item);
                            invDetails.push(`<li><span class="rpg-msg-card-key">[${escapeHtml(slot)}]</span> <span class="rpg-msg-card-val">${escapeHtml(itemText)}</span></li>`);
                        }
                    });
                }
                if (data.inventory.storage && Object.keys(data.inventory.storage).length > 0) {
                    Object.entries(data.inventory.storage).forEach(([container, items]) => {
                        if (Array.isArray(items) && items.length > 0) {
                            const itemNames = items.map(i => escapeHtml(formatCardItem(i))).join(', ');
                            invDetails.push(`<li><span class="rpg-msg-card-key">${escapeHtml(container)}:</span> <span class="rpg-msg-card-val">${itemNames}</span></li>`);
                        }
                    });
                }

                if (invDetails.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-msg-card-sub-group">
                            <div class="rpg-msg-card-sub-title">Inventory</div>
                            <ul class="rpg-msg-card-list">${invDetails.join('')}</ul>
                        </div>
                    `;
                }
            }

            if (data.quests) {
                const questItems = [];
                if (data.quests.main && data.quests.main.name) {
                    const statusStr = data.quests.main.isCompleted ? 'COMPLETED' : 'ACTIVE';
                    questItems.push(`<li><span class="rpg-msg-card-key">Main:</span> <span class="rpg-msg-card-val">${escapeHtml(data.quests.main.name)} (${statusStr})</span></li>`);
                }
                if (Array.isArray(data.quests.sides)) {
                    data.quests.sides.forEach((sq, i) => {
                        if (sq.name) {
                            const statusStr = sq.isCompleted ? 'COMPLETED' : 'ACTIVE';
                            questItems.push(`<li><span class="rpg-msg-card-key">Side ${i + 1}:</span> <span class="rpg-msg-card-val">${escapeHtml(sq.name)} (${statusStr})</span></li>`);
                        }
                    });
                }

                if (questItems.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-msg-card-sub-group">
                            <div class="rpg-msg-card-sub-title">Quests</div>
                            <ul class="rpg-msg-card-list">${questItems.join('')}</ul>
                        </div>
                    `;
                }
            }

            if (charSectionsHtml) {
                contentHtml += `
                    <div class="rpg-msg-card-section">
                        <div class="rpg-msg-card-section-title">${escapeHtml(charName)}</div>
                        ${charSectionsHtml}
                    </div>
                `;
            }
        });
    }

    if (payload.note) {
        contentHtml += `<div class="rpg-msg-card-note">Note: ${escapeHtml(payload.note)}</div>`;
    }

    return buildCardFrameHtml({
        cardClass: 'rpg-snapshot-card',
        title: 'Message Tracker',
        iconSvg: SNAPSHOT_ICON_SVG,
        contentHtml
    });
}

export function getMessageTrackerPayload(msg) {
    if (!msg || typeof msg.mes !== 'string') return null;

    const match = msg.mes.match(RPGMT_TAG_REGEX) || msg.mes.match(RPGMT_DIV_REGEX);
    if (match && match[1]) {
        try {
            const unescapedJson = match[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .trim();
            return JSON.parse(unescapedJson);
        } catch (e) {
            console.warn("[RPG Tracker] Failed to parse message tracker JSON", e);
        }
    }

    return null;
}

export function renderMessageTrackers(getContext) {
    const context = getContext();
    if (!context || !Array.isArray(context.chat)) return;

    ensureMessageCardStyles();

    const $ = typeof window !== 'undefined' ? window.$ : null;
    if ($) {
        $('#chat .rpg-snapshot-card').each(function () {
            const $card = $(this);
            const $mes = $card.closest('.mes').length ? $card.closest('.mes') : $card.closest('.mes_block');
            const idx = resolveElementMessageIndex($mes, context.chat);
            const msg = idx >= 0 ? context.chat[idx] : null;
            const payload = msg ? getMessageTrackerPayload(msg) : null;
            if (!payload || Object.keys(payload).length === 0) {
                $card.remove();
            }
        });
    }

    const recentStartIndex = Math.max(0, context.chat.length - 10);

    for (let index = 0; index < context.chat.length; index++) {
        const msg = context.chat[index];
        if (!msg) continue;

        const hasRpgmt = typeof msg.mes === 'string' && /rpgmt/i.test(msg.mes);
        if (index < recentStartIndex && !hasRpgmt) continue;

        const $msgEl = findChatMessageElement(index);

        if ($msgEl && $msgEl.length > 0) {
            const payload = getMessageTrackerPayload(msg);
            const $existingCard = $msgEl.find('.rpg-snapshot-card');

            if (!payload || Object.keys(payload).length === 0) {
                $existingCard.remove();
                continue;
            }

            const payloadSignature = encodeURIComponent(JSON.stringify(payload));

            if ($existingCard.length > 0) {
                if ($existingCard.attr('data-rpg-sig') === payloadSignature) {
                    continue;
                }
                $existingCard.remove();
            }

            const trackerHtml = buildSnapshotHtml(payload);
            if (trackerHtml) {
                const $newCard = window.$(trackerHtml);
                $newCard.attr('data-rpg-sig', payloadSignature);

                let $target = $msgEl.find('.mes_text, .system_message_content, .text, .mes_block');
                if ($target.length === 0) {
                    $msgEl.append($newCard);
                } else {
                    $target.contents().each(function () {
                        if (this.nodeType === Node.TEXT_NODE && /rpgmt/i.test(this.nodeValue)) {
                            this.nodeValue = '';
                        }
                    });
                    $target.first().append($newCard);
                }
            } else {
                $existingCard.remove();
            }
        }
    }
}