// src/tracker/DeltaLogRenderer.js

export function getDeltaLog(msg) {
    if (!msg) return null;

    if (typeof msg.mes === 'string') {
        const match = msg.mes.match(/<!--RPG_DELTA:([\s\S]*?)-->/);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {
                console.warn("[RPG Tracker] Failed to parse delta log from msg.mes", e);
            }
        }
    }

    let swipeId = msg.swipe_id || 0;
    if (msg.swipes && msg.swipes.length > 0 && typeof msg.mes === 'string') {
        const foundIdx = msg.swipes.findIndex(s => s === msg.mes);
        if (foundIdx !== -1) swipeId = foundIdx;
    }

    if (msg.swipe_info && msg.swipe_info[swipeId] && msg.swipe_info[swipeId].extra && msg.swipe_info[swipeId].extra.rpgTrackerDelta) {
        return msg.swipe_info[swipeId].extra.rpgTrackerDelta;
    }

    if (msg.extra && msg.extra.rpgTrackerDelta) {
        return msg.extra.rpgTrackerDelta;
    }

    return null;
}

export function setDeltaLog(msg, patch) {
    if (!msg || !patch || Object.keys(patch).length === 0) return;

    msg.extra = msg.extra || {};
    msg.extra.rpgTrackerDelta = patch;

    let swipeId = msg.swipe_id || 0;
    if (msg.swipes && msg.swipes.length > 0 && typeof msg.mes === 'string') {
        const foundIdx = msg.swipes.findIndex(s => s === msg.mes);
        if (foundIdx !== -1) swipeId = foundIdx;
    }

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
}

export const deltaStyles = `
<style id="rpg-delta-log-styles">
.rpg-delta-log-container {
    margin-top: 10px;
    margin-right: 40px;
    border: 1px solid var(--rpg-border, rgba(255,255,255,0.15));
    border-radius: 6px;
    background: var(--rpg-bg, rgba(0,0,0,0.2));
    font-family: inherit;
    
    /* 실리터번 글자 크기 설정을 유연하게 상속 (기존 12px 대체) */
    font-size: 0.95em; 
    
    width: calc(100% - 40px);
    max-width: calc(100% - 40px);
    box-sizing: border-box;
    overflow: hidden;
    clear: both;
    display: block;
}
.rpg-delta-header {
    padding: 8px 12px;
    background: rgba(0,0,0,0.1);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
    font-weight: bold;
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    border-bottom: 1px solid transparent;
    transition: background 0.2s, border-color 0.2s;
}
.rpg-delta-header:hover {
    background: rgba(255, 255, 255, 0.05);
}
.rpg-delta-header.active {
    border-color: var(--rpg-border, rgba(255,255,255,0.15));
    background: rgba(0,0,0,0.2);
}
.rpg-delta-header-icon::after {
    content: '▼';
    font-size: 0.75em; /* em 단위 조절 */
    opacity: 0.7;
    transition: transform 0.15s;
    display: inline-block;
}
.rpg-delta-header.active .rpg-delta-header-icon::after {
    transform: rotate(180deg);
}
.rpg-delta-content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(0,0,0,0.05);
}
.rpg-delta-char {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rpg-delta-char-header {
    font-weight: bold;
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    
    /* 비례 확장 적용 (기존 12.5px 대체) */
    font-size: 1.05em; 
    
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.rpg-delta-char-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.rpg-delta-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.rpg-delta-section-title {
    /* 하위 헤더 상대크기 축소 정의 (기존 11px 대체) */
    font-size: 0.9em; 
    
    text-transform: uppercase;
    opacity: 0.5;
    font-weight: bold;
    letter-spacing: 0.5px;
}
.rpg-delta-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.rpg-delta-list li {
    padding-left: 6px;
}
.rpg-delta-key {
    opacity: 0.8;
    color: var(--rpg-text, inherit);
}
.rpg-delta-val {
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    font-weight: 500;
}
</style>
`;

export function buildDeltaLogHtml(delta) {
    let contentHtml = '';

    Object.entries(delta).forEach(([charName, updates]) => {
        if (!updates || typeof updates !== 'object') return;

        let charChanges = [];

        let statusUpdates = updates.status || updates.stats || null;
        if (!statusUpdates && !updates.profile && !updates.relations && !updates.inventory && !updates.quests && charName.toLowerCase() !== 'world') {
            statusUpdates = updates;
        }

        if (statusUpdates && typeof statusUpdates === 'object') {
            const items = [];
            Object.entries(statusUpdates).forEach(([key, val]) => {
                if (typeof val === 'object' && val !== null) {
                    items.push(`<li><span class="rpg-delta-key">${key}:</span> <span class="rpg-delta-val">${val.value !== undefined ? val.value : JSON.stringify(val)}</span></li>`);
                } else {
                    items.push(`<li><span class="rpg-delta-key">${key}:</span> <span class="rpg-delta-val">${val}</span></li>`);
                }
            });
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-delta-section">
                        <div class="rpg-delta-section-title">Status</div>
                        <ul class="rpg-delta-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (updates.profile && typeof updates.profile === 'object') {
            const items = [];
            Object.entries(updates.profile).forEach(([key, val]) => {
                items.push(`<li><span class="rpg-delta-key">${key}:</span> <span class="rpg-delta-val">${val}</span></li>`);
            });
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-delta-section">
                        <div class="rpg-delta-section-title">Profile</div>
                        <ul class="rpg-delta-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (updates.inventory && typeof updates.inventory === 'object') {
            const items = [];
            if (updates.inventory.equipment && typeof updates.inventory.equipment === 'object') {
                Object.entries(updates.inventory.equipment).forEach(([slot, val]) => {
                    const name = val && typeof val === 'object' ? (val.name || 'Empty') : String(val);
                    items.push(`<li><span class="rpg-delta-key">Equip [${slot}]:</span> <span class="rpg-delta-val">${name}</span></li>`);
                });
            }
            if (updates.inventory.storage && typeof updates.inventory.storage === 'object') {
                Object.entries(updates.inventory.storage).forEach(([container, arr]) => {
                    if (Array.isArray(arr)) {
                        const itemsStr = arr.map(i => typeof i === 'string' ? i : `${i.name} (x${i.quantity})`).join(', ');
                        items.push(`<li><span class="rpg-delta-key">Storage [${container}]:</span> <span class="rpg-delta-val">${itemsStr || 'Empty'}</span></li>`);
                    }
                });
            }
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-delta-section">
                        <div class="rpg-delta-section-title">Inventory</div>
                        <ul class="rpg-delta-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (updates.quests && typeof updates.quests === 'object') {
            const items = [];
            if (updates.quests.main) {
                const q = updates.quests.main;
                items.push(`<li><span class="rpg-delta-key">Main Quest:</span> <span class="rpg-delta-val">${q.name || q}</span></li>`);
            }
            if (Array.isArray(updates.quests.sideQuests)) {
                updates.quests.sideQuests.forEach(sq => {
                    const name = typeof sq === 'string' ? sq : (sq.name || 'Unknown');
                    const status = sq.status || (sq.isCompleted ? 'COMPLETED' : 'ACTIVE');
                    items.push(`<li><span class="rpg-delta-key">Side Quest [${status}]:</span> <span class="rpg-delta-val">${name}</span></li>`);
                });
            }
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-delta-section">
                        <div class="rpg-delta-section-title">Quests</div>
                        <ul class="rpg-delta-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (updates.relations && typeof updates.relations === 'object') {
            const items = [];
            Object.entries(updates.relations).forEach(([target, rData]) => {
                if (rData && typeof rData === 'object') {
                    if (rData.description) {
                        items.push(`<li><span class="rpg-delta-key">Relation with ${target}:</span> <span class="rpg-delta-val">${rData.description}</span></li>`);
                    }
                    if (rData.metrics && typeof rData.metrics === 'object') {
                        Object.entries(rData.metrics).forEach(([mName, mVal]) => {
                            const val = typeof mVal === 'object' && mVal !== null ? mVal.value : mVal;
                            items.push(`<li><span class="rpg-delta-key">${target} [${mName}]:</span> <span class="rpg-delta-val">${val}</span></li>`);
                        });
                    }
                }
            });
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-delta-section">
                        <div class="rpg-delta-section-title">Relations</div>
                        <ul class="rpg-delta-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (charName.toLowerCase() === 'world' && updates && typeof updates === 'object') {
            const items = [];
            if (updates.date) items.push(`<li><span class="rpg-delta-key">Date:</span> <span class="rpg-delta-val">${updates.date}</span></li>`);
            if (updates.time) items.push(`<li><span class="rpg-delta-key">Time:</span> <span class="rpg-delta-val">${updates.time}</span></li>`);
            if (updates.location) items.push(`<li><span class="rpg-delta-key">Location:</span> <span class="rpg-delta-val">${updates.location}</span></li>`);
            if (updates.weather) items.push(`<li><span class="rpg-delta-key">Weather:</span> <span class="rpg-delta-val">${updates.weather}</span></li>`);
            if (Array.isArray(updates.events)) {
                const evts = updates.events.map(e => typeof e === 'string' ? e : (e.name || e.desc || '')).join(', ');
                if (evts) items.push(`<li><span class="rpg-delta-key">Events:</span> <span class="rpg-delta-val">${evts}</span></li>`);
            }
            if (items.length > 0) {
                charChanges.push(`
                    <div class="rpg-delta-section">
                        <div class="rpg-delta-section-title">World State</div>
                        <ul class="rpg-delta-list">${items.join('')}</ul>
                    </div>
                `);
            }
        }

        if (charChanges.length > 0) {
            const labelName = charName.toLowerCase() === 'world' ? 'World' : charName;
            contentHtml += `
                <div class="rpg-delta-char">
                    <div class="rpg-delta-char-header">${labelName}</div>
                    <div class="rpg-delta-char-body">
                        ${charChanges.join('')}
                    </div>
                </div>
            `;
        }
    });

    if (!contentHtml) return '';

    return `
        <div class="rpg-delta-log-container">
            <div class="rpg-delta-header">
                <span class="rpg-delta-header-title">Tracker Changes</span>
                <span class="rpg-delta-header-icon"></span>
            </div>
            <div class="rpg-delta-content" style="display: none;">
                ${contentHtml}
            </div>
        </div>
    `;
}

export function injectAllDeltaLogs(extension_settings, extensionName, getContext) {
    if (!extension_settings[extensionName] || !extension_settings[extensionName].enabled) {
        $('.rpg-delta-log-container').remove();
        return;
    }

    const showDelta = extension_settings[extensionName].showDeltaLog !== false;
    if (!showDelta) {
        $('.rpg-delta-log-container').remove();
        return;
    }

    const context = getContext();
    if (!context || !Array.isArray(context.chat)) return;

    if ($('#rpg-delta-log-styles').length === 0) {
        $('head').append(deltaStyles);
    }

    const startIndex = Math.max(0, context.chat.length - 10);

    for (let index = startIndex; index < context.chat.length; index++) {
        const msg = context.chat[index];
        if (!msg) continue;

        let $msgEl = $(`#chat .mes[data-id="${index}"], #chat .mes_block[data-id="${index}"], #chat [data-id="${index}"], #chat [mesId="${index}"]`).first();

        if ($msgEl.length === 0) {
            $msgEl = $('#chat').children('.mes, .sys_mes, .system_message, .mes_block').eq(index);
        }

        if ($msgEl.length > 0) {
            const delta = getDeltaLog(msg);
            if (!delta || Object.keys(delta).length === 0) {
                $msgEl.find('.rpg-delta-log-container').remove();
                if ($msgEl.next('.rpg-delta-log-container').length > 0) {
                    $msgEl.next('.rpg-delta-log-container').remove();
                }
                continue;
            }

            if ($msgEl.find('.rpg-delta-log-container').length > 0) {
                continue;
            }

            if ($msgEl.next('.rpg-delta-log-container').length > 0) {
                $msgEl.next('.rpg-delta-log-container').remove();
            }

            const deltaHtml = buildDeltaLogHtml(delta);
            if (deltaHtml) {
                let $target = $msgEl.find('.mes_text, .system_message_content, .text, .mes_block');
                if ($target.length === 0) {
                    $msgEl.append(deltaHtml);
                } else {
                    $target.first().append(deltaHtml);
                }
            }
        }
    }
}

export function registerDeltaLogClickEvent() {
    $(document).off('click', '#chat .rpg-delta-header').on('click', '#chat .rpg-delta-header', function() {
        const $header = $(this);
        $header.next('.rpg-delta-content').slideToggle(150);
        $header.toggleClass('active');
    });
}