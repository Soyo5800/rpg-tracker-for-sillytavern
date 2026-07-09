// src/messagetracker/SnapshotButtonManager.js
export function injectSnapshotButtons(getContext) {
    $('#chat .mes').each(function () {
        const $mes = $(this);
        const mesId = $mes.attr('mesid');
        const $btnContainer = $mes.find('.mes_buttons');
        
        if ($btnContainer.find('.rpg-snapshot-btn').length > 0) return;

        const brandIconSvg = `
            <svg viewBox="0 0 24 24" 
                 style="width: 1.1em; height: 1.1em; display: block; fill: currentColor;" 
                 fill="currentColor">
                <rect x="1" y="2.5" width="22" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                <circle cx="7" cy="8" r="2.5" />
                <path d="M3,14.5 C3,12 4.5,10.5 7,10.5 C9.5,10.5 11,12 11,14.5 L3,14.5 Z" />
                <rect x="13" y="6.5" width="8" height="2" rx="1" />
                <rect x="13" y="10" width="6" height="2" rx="1" />
                <rect x="13" y="13.5" width="8" height="2" rx="1" />
            </svg>
        `;

        const $btn = $(`
            <div class="mes_button rpg-snapshot-btn" 
                 title="Add/Edit Message Tracker"
                 style="display: inline-flex !important; align-items: center !important; justify-content: center !important; vertical-align: middle !important; line-height: 0 !important;">
                ${brandIconSvg}
            </div>
        `);
        
        $btn.on('click', () => {
            const context = getContext();
            const msg = context.chat.find(m => String(m.mesId) === String(mesId) || String(context.chat.indexOf(m)) === String(mesId));
            
            let histData = null;
            let existingPayload = null;

            if (msg) {
                // 기존 데이터(히스토리) 추출
                let swipeId = msg.swipe_id || 0;
                if (msg.swipes && msg.swipes.length > 0 && typeof msg.mes === 'string') {
                    const foundIdx = msg.swipes.findIndex(s => s === msg.mes);
                    if (foundIdx !== -1) swipeId = foundIdx;
                }
                if (msg.swipe_info && msg.swipe_info[swipeId]?.extra?.rpgTrackerData) {
                    histData = msg.swipe_info[swipeId].extra.rpgTrackerData;
                }

                // 메시지 텍스트에서 기존 <rpgmt> 태그 추출 (양방향 바인딩 용도)
                const rpgmtRegex = /(?:<|&lt;)rpgmt(?:>|&gt;)([\s\S]*?)(?:<|&lt;)\/rpgmt(?:>|&gt;)/i;
                const match = msg.mes.match(rpgmtRegex);
                if (match && match[1]) {
                    try {
                        const cleanJson = match[1]
                            .replace(/<br\s*\/?>/gi, '\n') // 혹시 모를 br 태그 제거
                            .replace(/&quot;/g, '"')
                            .replace(/&apos;/g, "'")
                            .replace(/&#x27;/g, "'")
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&');
                        existingPayload = JSON.parse(cleanJson);
                    } catch (e) {
                        console.warn("[RPG Tracker] Failed to parse existing rpgmt tag", e);
                    }
                }
            }

            if (window.RPGBridge && typeof window.RPGBridge.openSnapshotModal === 'function') {
                window.RPGBridge.openSnapshotModal(mesId, histData, existingPayload);
            }
        });
        
        $btnContainer.prepend($btn);
    });
}