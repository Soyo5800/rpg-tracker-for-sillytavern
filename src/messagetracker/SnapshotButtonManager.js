import { rehydrateFromHistoryAsync, resolveActiveSwipeId } from "../core/JSONTracker.js";
import { getMessageTrackerPayload } from "./SnapshotRenderer.js";
import { resolveElementMessageIndex } from "./MessageCardRenderer.js";

export function injectSnapshotButtons(getContext) {
    const $ = window.$;
    if (!$) return;

    const $mesElements = $('#chat .mes').length ? $('#chat .mes') : $('#chat .mes_block');
    $mesElements.each(function () {
        const $mes = $(this);
        let $btnContainer = $mes.find('.mes_buttons');
        if ($btnContainer.length === 0) {
            $btnContainer = $mes.find('.extraMesButtons');
        }

        if ($btnContainer.length === 0) return;
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

        $btn.on('click', async function (e) {
            e.stopPropagation();

            const context = getContext();
            if (!context || !Array.isArray(context.chat)) return;

            const $currentMes = $(this).closest('.mes').length ? $(this).closest('.mes') : $(this).closest('.mes_block');
            const targetIndex = resolveElementMessageIndex($currentMes, context.chat);

            if (targetIndex === -1 || !context.chat[targetIndex]) return;

            const msg = context.chat[targetIndex];

            if (!msg.extra) msg.extra = {};
            if (!msg.extra.rpgTurnId) {
                msg.extra.rpgTurnId = `turn_${msg.send_date || Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            }
            msg._rpgTurnId = msg.extra.rpgTurnId;

            const sendDate = msg.send_date || null;
            const turnId = msg.extra.rpgTurnId;

            let histData = null;
            let existingPayload = null;

            if (msg) {
                const swipeId = resolveActiveSwipeId(msg);

                if (msg.swipe_info && msg.swipe_info[swipeId]?.extra?.rpgTrackerData) {
                    histData = msg.swipe_info[swipeId].extra.rpgTrackerData;
                } else if (swipeId === 0 && msg.extra?.rpgTrackerData) {
                    histData = msg.extra.rpgTrackerData;
                }

                if (!histData) {
                    const subChatHistory = context.chat.slice(0, targetIndex + 1);
                    histData = await rehydrateFromHistoryAsync(subChatHistory);
                }

                existingPayload = getMessageTrackerPayload(msg);
            }

            if (window.RPGBridge && typeof window.RPGBridge.openSnapshotModal === 'function') {
                window.RPGBridge.openSnapshotModal(targetIndex, histData, existingPayload, sendDate, turnId);
            }
        });

        $btnContainer.prepend($btn);
    });
}