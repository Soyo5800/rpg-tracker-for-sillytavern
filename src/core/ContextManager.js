import { extension_settings } from "../../../../../extensions.js";

/**
 * Registers generation interceptor for SillyTavern.
 * Isolates quiet history slicing to RPG Tracker calls only.
 * @param {string} extensionName - Extension directory name.
 */
export function registerContextInterceptor(extensionName) {
    const interceptor = function RPGTracker_interceptGeneration(chat, _contextSize, _abort, _type) {
        if (!Array.isArray(chat) || chat.length === 0) return;

        const isMyQuiet = Boolean(globalThis.rpgTracker_isQuietUpdating || window.RPGBridge?.isQuietUpdating);
        if (!isMyQuiet) return;

        const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || extension_settings['rpg-tracker-for-sillytavern'] || {};
        const rawLimit = settings.contextMessageLimit;
        const limit = (rawLimit !== undefined && rawLimit !== null && !isNaN(Number(rawLimit))) ? Math.max(0, Number(rawLimit)) : 4;

        const instructionMessage = chat[chat.length - 1];
        const historyMessages = chat.slice(0, chat.length - 1);

        const validChatMessages = historyMessages.filter(msg => {
            if (!msg) return false;
            if (msg.is_system === true || msg.extra?.is_system === true || msg.extra?.type === 'system') return false;
            if (typeof msg.mes === 'string' && msg.mes.startsWith('[RPG Tracker]')) return false;
            return true;
        });

        const slicedHistory = limit > 0 ? validChatMessages.slice(-limit) : [];
        const finalChat = instructionMessage ? [...slicedHistory, instructionMessage] : slicedHistory;

        chat.splice(0, chat.length, ...finalChat);
    };

    globalThis.RPGTracker_interceptGeneration = interceptor;
    if (typeof window !== 'undefined') {
        window.RPGTracker_interceptGeneration = interceptor;
    }
}