// src/messagetracker/SnapshotRenderer.js

export const snapshotStyles = `
<style id="rpg-snapshot-styles">
.rpg-snapshot-container {
    margin-top: 10px;
    margin-right: 40px;
    border: 1px solid var(--rpg-border, rgba(255,255,255,0.15));
    border-radius: 6px;
    background: var(--rpg-bg, rgba(0,0,0,0.2));
    font-family: inherit;
    font-size: 0.95em; 
    width: calc(100% - 40px);
    max-width: calc(100% - 40px);
    box-sizing: border-box;
    overflow: hidden;
    clear: both;
    display: block;
}
.rpg-snapshot-header {
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
.rpg-snapshot-header:hover {
    background: rgba(255, 255, 255, 0.05);
}
.rpg-snapshot-header.active {
    border-color: var(--rpg-border, rgba(255,255,255,0.15));
    background: rgba(0,0,0,0.2);
}
.rpg-snapshot-header-title {
    display: flex;
    align-items: center;
    gap: 6px;
}
.rpg-snapshot-header-icon::after {
    content: '▼';
    font-size: 0.75em;
    opacity: 0.7;
    transition: transform 0.15s;
    display: inline-block;
}
.rpg-snapshot-header.active .rpg-snapshot-header-icon::after {
    transform: rotate(180deg);
}
.rpg-snapshot-content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: rgba(0,0,0,0.05);
}
.rpg-snapshot-note {
    font-style: italic;
    opacity: 0.85;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 3px solid var(--rpg-highlight);
    border-radius: 4px;
    margin-top: 4px;
}
.rpg-snapshot-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rpg-snapshot-section-title {
    font-weight: bold;
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    font-size: 1.05em; 
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 3px;
    margin-bottom: 4px;
}
.rpg-snapshot-sub-group {
    background: rgba(0,0,0,0.15);
    border-radius: 4px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 4px;
}
.rpg-snapshot-sub-title {
    font-size: 0.85em;
    font-weight: bold;
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.rpg-snapshot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
}
.rpg-snapshot-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.rpg-snapshot-list li {
    padding-left: 2px;
    display: flex;
    font-size: 0.95em;
}
.rpg-snapshot-key {
    opacity: 0.7;
    color: var(--rpg-text, inherit);
    width: 95px;
    flex-shrink: 0;
    font-weight: 500;
}
.rpg-snapshot-val {
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    font-weight: 500;
    flex: 1;
}
</style>
`;

export function buildSnapshotHtml(payload) {
    if (!payload || Object.keys(payload).length === 0) return '';

    let contentHtml = '';

    // 1. World State 렌더링
    if (payload.world) {
        const w = payload.world;
        let wItems = [];
        if (w.date) wItems.push(`<li><span class="rpg-snapshot-key">Date:</span> <span class="rpg-snapshot-val">${w.date}</span></li>`);
        if (w.time) wItems.push(`<li><span class="rpg-snapshot-key">Time:</span> <span class="rpg-snapshot-val">${w.time}</span></li>`);
        if (w.location) wItems.push(`<li><span class="rpg-snapshot-key">Location:</span> <span class="rpg-snapshot-val">${w.location}</span></li>`);
        if (w.weather) wItems.push(`<li><span class="rpg-snapshot-key">Weather:</span> <span class="rpg-snapshot-val">${w.weather}</span></li>`);

        let eventHtml = '';
        if (Array.isArray(w.events) && w.events.length > 0) {
            const evList = w.events.map(e => {
                const nameStr = e.name ? `<strong>${e.name}</strong>: ` : '';
                const descStr = e.desc || (typeof e === 'string' ? e : '');
                return `<li><span class="rpg-snapshot-val">${nameStr}${descStr}</span></li>`;
            }).join('');
            
            eventHtml = `
                <div class="rpg-snapshot-sub-group" style="margin-top: 6px;">
                    <div class="rpg-snapshot-sub-title">Events</div>
                    <ul class="rpg-snapshot-list">${evList}</ul>
                </div>
            `;
        }

        if (wItems.length > 0 || eventHtml) {
            contentHtml += `
                <div class="rpg-snapshot-section">
                    <div class="rpg-snapshot-section-title">World State</div>
                    ${wItems.length > 0 ? `<ul class="rpg-snapshot-list" style="margin-bottom: 4px;">${wItems.join('')}</ul>` : ''}
                    ${eventHtml}
                </div>
            `;
        }
    }

    // 2. Characters 상세 렌더링
    if (payload.chars) {
        Object.entries(payload.chars).forEach(([charName, data]) => {
            let charSectionsHtml = '';

            // A. Status (능력치)
            if (data.status && Object.keys(data.status).length > 0) {
                let statusItems = [];
                Object.entries(data.status).forEach(([k, v]) => {
                    const valStr = typeof v === 'object' && v !== null ? v.value : v;
                    statusItems.push(`<li><span class="rpg-snapshot-key">${k}:</span> <span class="rpg-snapshot-val">${valStr}</span></li>`);
                });
                charSectionsHtml += `
                    <div class="rpg-snapshot-sub-group">
                        <div class="rpg-snapshot-sub-title">Status</div>
                        <ul class="rpg-snapshot-list rpg-snapshot-grid">${statusItems.join('')}</ul>
                    </div>
                `;
            }

            // B. Profile (프로필 정보)
            if (data.profile && Object.keys(data.profile).length > 0) {
                let profileItems = [];
                Object.entries(data.profile).forEach(([k, v]) => {
                    if (v && String(v).trim() !== '') {
                        profileItems.push(`<li><span class="rpg-snapshot-key">${k}:</span> <span class="rpg-snapshot-val">${v}</span></li>`);
                    }
                });
                if (profileItems.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-snapshot-sub-group">
                            <div class="rpg-snapshot-sub-title">Profile</div>
                            <ul class="rpg-snapshot-list">${profileItems.join('')}</ul>
                        </div>
                    `;
                }
            }

            // C. Inventory (장비 및 소지품)
            if (data.inventory) {
                let invDetails = [];
                
                // 장착 장비 렌더링
                if (data.inventory.equipment && Object.keys(data.inventory.equipment).length > 0) {
                    Object.entries(data.inventory.equipment).forEach(([slot, item]) => {
                        if (item) {
                            const itemName = typeof item === 'object' ? item.name : String(item);
                            invDetails.push(`<li><span class="rpg-snapshot-key">[${slot}]</span> <span class="rpg-snapshot-val">${itemName}</span></li>`);
                        }
                    });
                }
                
                // 보관함 아이템 렌더링
                if (data.inventory.storage && Object.keys(data.inventory.storage).length > 0) {
                    Object.entries(data.inventory.storage).forEach(([container, items]) => {
                        if (Array.isArray(items) && items.length > 0) {
                            const itemNames = items.map(i => {
                                if (typeof i === 'object') {
                                    const qty = i.quantity > 1 ? ` (x${i.quantity})` : '';
                                    return `${i.name}${qty}`;
                                }
                                return String(i);
                            }).join(', ');
                            invDetails.push(`<li><span class="rpg-snapshot-key">${container}:</span> <span class="rpg-snapshot-val">${itemNames}</span></li>`);
                        }
                    });
                }

                if (invDetails.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-snapshot-sub-group">
                            <div class="rpg-snapshot-sub-title">Inventory</div>
                            <ul class="rpg-snapshot-list">${invDetails.join('')}</ul>
                        </div>
                    `;
                }
            }

            // D. Quests (진행 중인 퀘스트)
            if (data.quests) {
                let questItems = [];
                if (data.quests.main && data.quests.main.name) {
                    const statusStr = data.quests.main.isCompleted ? 'COMPLETED' : 'ACTIVE';
                    questItems.push(`<li><span class="rpg-snapshot-key">Main:</span> <span class="rpg-snapshot-val">${data.quests.main.name} (${statusStr})</span></li>`);
                }
                if (Array.isArray(data.quests.sides)) {
                    data.quests.sides.forEach((sq, i) => {
                        if (sq.name) {
                            const statusStr = sq.isCompleted ? 'COMPLETED' : 'ACTIVE';
                            questItems.push(`<li><span class="rpg-snapshot-key">Side ${i + 1}:</span> <span class="rpg-snapshot-val">${sq.name} (${statusStr})</span></li>`);
                        }
                    });
                }

                if (questItems.length > 0) {
                    charSectionsHtml += `
                        <div class="rpg-snapshot-sub-group">
                            <div class="rpg-snapshot-sub-title">Quests</div>
                            <ul class="rpg-snapshot-list">${questItems.join('')}</ul>
                        </div>
                    `;
                }
            }

            if (charSectionsHtml) {
                contentHtml += `
                    <div class="rpg-snapshot-section">
                        <div class="rpg-snapshot-section-title">${charName}</div>
                        ${charSectionsHtml}
                    </div>
                `;
            }
        });
    }

    // 3. Custom Note 렌더링 (가장 하단에 이모티콘 없이 깔끔한 배너로 표시)
    if (payload.note) {
        contentHtml += `<div class="rpg-snapshot-note">Note: ${payload.note}</div>`;
    }

    if (!contentHtml) return '';

    const brandIconSvgInline = `
        <svg viewBox="0 0 24 24" style="width: 1.1em; height: 1.1em; display: block;" fill="currentColor">
            <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
            <circle cx="7" cy="10" r="2.2" />
            <path d="M4 15.5c0-1.8 1.3-3 3-3s3 1.2 3 3v0.5H4v-0.5z" />
            <rect x="12" y="8.5" width="7" height="1.5" rx="0.75" />
            <rect x="12" y="11.5" width="6" height="1.5" rx="0.75" />
            <rect x="12" y="14.5" width="7" height="1.5" rx="0.75" />
        </svg>
    `;

    return `
        <div class="rpg-snapshot-container">
            <div class="rpg-snapshot-header">
                <span class="rpg-snapshot-header-title">${brandIconSvgInline} Message Tracker</span>
                <span class="rpg-snapshot-header-icon"></span>
            </div>
            <div class="rpg-snapshot-content" style="display: none;">
                ${contentHtml}
            </div>
        </div>
    `;
}

// DeltaLogRenderer와 동일하게 DOM이 아닌 SillyTavern의 메모리 메시지 배열에서 원본을 매칭하는 파서
export function getMessageTrackerPayload(msg) {
    if (!msg || typeof msg.mes !== 'string') return null;

    // 주석 처리된 rpgmt, 비주석 구형 rpgmt를 대소문자 가리지 않고 매칭
    const rpgmtRegex = /(?:<!--\s*)?(?:<|&lt;)rpgmt(?:>|&gt;)([\s\S]*?)(?:<|&lt;)\/rpgmt(?:>|&gt;)(?:\s*-->)?/i;
    const match = msg.mes.match(rpgmtRegex);
    if (match && match[1]) {
        try {
            const unescapedJson = match[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .trim();
            return JSON.parse(unescapedJson);
        } catch (e) {
            console.warn("[RPG Tracker] Failed to parse message tracker JSON", e);
        }
    }

    // div 태그 형식의 마이그레이션 백업 대응
    const divRegex = /(?:<!--\s*)?<div\s+class="rpgmt-data">([\s\S]*?)<\/div>(?:\s*-->)?/i;
    const divMatch = msg.mes.match(divRegex);
    if (divMatch && divMatch[1]) {
        try {
            const unescapedJson = divMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .trim();
            return JSON.parse(unescapedJson);
        } catch (e) {
            console.warn("[RPG Tracker] Failed to parse message tracker JSON from div", e);
        }
    }

    return null;
}

export function renderMessageTrackers(getContext) {
    const context = getContext();
    if (!context || !Array.isArray(context.chat)) return;

    if ($('#rpg-snapshot-styles').length === 0) {
        $('head').append(snapshotStyles);
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
            const payload = getMessageTrackerPayload(msg);

            if (!payload || Object.keys(payload).length === 0) {
                $msgEl.find('.rpg-snapshot-container').remove();
                continue;
            }

            // 이미 화면에 렌더링된 컴포넌트가 있다면 중복 주입 방지를 위해 생략
            if ($msgEl.find('.rpg-snapshot-container').length > 0) {
                continue;
            }

            const trackerHtml = buildSnapshotHtml(payload);
            if (trackerHtml) {
                let $target = $msgEl.find('.mes_text, .system_message_content, .text, .mes_block');
                if ($target.length === 0) {
                    $msgEl.append(trackerHtml);
                } else {
                    // 혹시라도 DOM 상에 불필요한 태그 파편 텍스트 노드가 남아있다면 안전하게 소거
                    $target.contents().each(function() {
                        if (this.nodeType === Node.TEXT_NODE && /rpgmt/i.test(this.nodeValue)) {
                            this.nodeValue = '';
                        }
                    });
                    $target.first().append(trackerHtml);
                }
            }
        }
    }
}

export function registerSnapshotClickEvent() {
    $(document).off('click', '#chat .rpg-snapshot-header').on('click', '#chat .rpg-snapshot-header', function () {
        const $header = $(this);
        $header.next('.rpg-snapshot-content').slideToggle(150);
        $header.toggleClass('active');
    });
}