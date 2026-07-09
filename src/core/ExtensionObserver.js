// src/core/ExtensionObserver.js
import { getContext, extension_settings } from "../../../../../extensions.js";
import { eventSource, event_types } from "../../../../../../script.js";
import { injectAllDeltaLogs } from "../tracker/DeltaLogRenderer.js";

// 의존성 경로 수정 적용 (src/core/에서 한 단계 올라가 messagetracker로 접근)
import { renderMessageTrackers } from "../messagetracker/SnapshotRenderer.js";
import { injectSnapshotButtons } from "../messagetracker/SnapshotButtonManager.js";

let chatObserver = null;
let deltaLogDebounceTimer = null;
let currentExtensionName = "";

export function triggerObserverNow() {
    injectAllDeltaLogs(extension_settings, currentExtensionName, getContext);
    renderMessageTrackers(getContext);
    injectSnapshotButtons(getContext);
}

export function startChatObserver(extensionName) {
    currentExtensionName = extensionName;
    if (chatObserver) return;

    const chatContainer = document.getElementById('chat');
    if (!chatContainer) {
        setTimeout(() => startChatObserver(extensionName), 500);
        return;
    }

    chatObserver = new MutationObserver(() => {
        if (deltaLogDebounceTimer) clearTimeout(deltaLogDebounceTimer);
        deltaLogDebounceTimer = setTimeout(() => {
            triggerObserverNow();
        }, 100);
    });

    chatObserver.observe(chatContainer, { childList: true, subtree: true, characterData: false });
}

export function registerChatEvents() {
    eventSource.on(event_types.MESSAGE_DELETED, () => {
        if (window.RPGBridge && typeof window.RPGBridge.triggerHistoryRollback === 'function') {
            window.RPGBridge.triggerHistoryRollback();
        }
        setTimeout(triggerObserverNow, 100);
    });

    eventSource.on(event_types.MESSAGE_SWIPED, () => {
        if (window.RPGBridge && typeof window.RPGBridge.triggerHistoryRollback === 'function') {
            window.RPGBridge.triggerHistoryRollback();
        }
        setTimeout(triggerObserverNow, 100);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        if (window.RPGBridge && typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
            window.RPGBridge.syncFromHistoryOrMeta();
        }
        setTimeout(triggerObserverNow, 100);
    });
}