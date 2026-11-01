import { getContext, extension_settings } from "../../../../../extensions.js";
import { eventSource, event_types } from "../../../../../../script.js";
import { injectAllDeltaLogs } from "../messagetracker/DeltaLogRenderer.js";
import { renderMessageTrackers } from "../messagetracker/SnapshotRenderer.js";
import { injectSnapshotButtons } from "../messagetracker/SnapshotButtonManager.js";

let chatObserver = null;
let deltaLogDebounceTimer = null;
let currentExtensionName = "";
let isChatEventsRegistered = false;
let isInjecting = false;
let pendingTrigger = false;

const INTERNAL_DOM_CLASSES = [
    'rpg-delta-card',
    'rpg-snapshot-card',
    'rpg-snapshot-btn',
    'rpg-msg-card-container'
];

/**
 * Checks whether the given DOM mutations are exclusively produced by internal RPG Tracker elements.
 */
function isInternalMutation(mutations) {
    if (!Array.isArray(mutations) || mutations.length === 0) return false;

    return mutations.every(mutation => {
        const added = Array.from(mutation.addedNodes || []);
        const removed = Array.from(mutation.removedNodes || []);
        const targetNodes = [...added, ...removed];

        if (targetNodes.length === 0) return true;

        return targetNodes.every(node => {
            if (!(node instanceof Element)) return true;
            return INTERNAL_DOM_CLASSES.some(cls => node.classList.contains(cls));
        });
    });
}

/**
 * Triggers all DOM injectors with recursion suppression guards.
 */
export function triggerObserverNow() {
    const isEnabled = extension_settings[currentExtensionName]?.enabled !== false;
    if (!isEnabled) {
        if (typeof window !== 'undefined' && window.$) {
            window.$('.rpg-delta-card, .rpg-snapshot-card, .rpg-snapshot-btn').remove();
        }
        return;
    }

    if (isInjecting) {
        pendingTrigger = true;
        return;
    }

    isInjecting = true;
    pendingTrigger = false;

    try {
        injectAllDeltaLogs(extension_settings, currentExtensionName, getContext);
        renderMessageTrackers(getContext);
        injectSnapshotButtons(getContext);
    } catch (err) {
        console.error("[RPG Tracker] Observer injection execution error:", err);
    } finally {
        setTimeout(() => {
            isInjecting = false;
            if (pendingTrigger) {
                pendingTrigger = false;
                triggerObserverNow();
            }
        }, 60);
    }
}

/**
 * Initializes and starts observing the chat container for DOM mutations.
 */
export function startChatObserver(extensionName) {
    currentExtensionName = extensionName;
    if (chatObserver) return;

    const chatContainer = document.getElementById('chat');
    if (!chatContainer) {
        setTimeout(() => startChatObserver(extensionName), 500);
        return;
    }

    chatObserver = new MutationObserver((mutations) => {
        if (isInjecting) return;
        if (isInternalMutation(mutations)) return;

        if (deltaLogDebounceTimer) clearTimeout(deltaLogDebounceTimer);
        deltaLogDebounceTimer = setTimeout(() => {
            triggerObserverNow();
        }, 100);
    });

    chatObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: false
    });
}

/**
 * Registers SillyTavern chat lifecycle events and state synchronizers.
 */
export function registerChatEvents() {
    if (isChatEventsRegistered) return;
    isChatEventsRegistered = true;

    const notifyChange = () => {
        if (window.RPGBridge && typeof window.RPGBridge.notifyHistoryChange === 'function') {
            window.RPGBridge.notifyHistoryChange();
        }
    };

    eventSource.on(event_types.MESSAGE_DELETED, () => {
        notifyChange();
        if (window.RPGBridge && typeof window.RPGBridge.triggerHistoryRollback === 'function') {
            window.RPGBridge.triggerHistoryRollback();
        }
        setTimeout(() => {
            notifyChange();
            triggerObserverNow();
        }, 80);
    });

    eventSource.on(event_types.MESSAGE_SWIPED, () => {
        notifyChange();
        if (window.RPGBridge && typeof window.RPGBridge.triggerHistoryRollback === 'function') {
            window.RPGBridge.triggerHistoryRollback();
        }
        setTimeout(() => {
            notifyChange();
            triggerObserverNow();
        }, 80);
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        notifyChange();
        setTimeout(triggerObserverNow, 100);
    });

    if (event_types.MESSAGE_UPDATED) {
        eventSource.on(event_types.MESSAGE_UPDATED, () => {
            notifyChange();
            setTimeout(triggerObserverNow, 100);
        });
    }

    if (event_types.MESSAGE_EDITED) {
        eventSource.on(event_types.MESSAGE_EDITED, () => {
            notifyChange();
            setTimeout(triggerObserverNow, 100);
        });
    }

    eventSource.on(event_types.CHAT_CHANGED, () => {
        notifyChange();
        if (window.RPGBridge && typeof window.RPGBridge.flushSave === 'function') {
            window.RPGBridge.flushSave();
        }
        if (window.RPGBridge && typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
            window.RPGBridge.syncFromHistoryOrMeta();
        }
        setTimeout(triggerObserverNow, 100);
    });

    eventSource.on(event_types.SETTINGS_UPDATED, () => {
        if (window.RPGBridge && typeof window.RPGBridge.flushSave === 'function') {
            window.RPGBridge.flushSave();
        }
        if (window.RPGBridge && typeof window.RPGBridge.refreshSettingsAndMetadata === 'function') {
            window.RPGBridge.refreshSettingsAndMetadata();
        } else if (window.RPGBridge && typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
            window.RPGBridge.syncFromHistoryOrMeta();
        }
        setTimeout(triggerObserverNow, 100);
    });
}