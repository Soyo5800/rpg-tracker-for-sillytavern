import { extension_settings } from "../../../../../extensions.js";

/**
 * Registers global generation interceptor for SillyTavern.
 * Matches manifest.json "generate_interceptor": "RPGTracker_interceptGeneration"
 * @param {string} extensionName - Extension directory name.
 */
export function registerContextInterceptor(extensionName) {
    const interceptor = function RPGTracker_interceptGeneration(chat, _contextSize, _abort, type) {
        const isQuiet = type === 'quiet' || globalThis.rpgTracker_isQuietUpdating || window.RPGBridge?.isQuietUpdating;
        if (!isQuiet) return;
        if (!Array.isArray(chat) || chat.length === 0) return;

        const settings = window.RPGBridge?.latestSettings || extension_settings[extensionName] || extension_settings['rpg-tracker-for-sillytavern'] || {};
        const rawLimit = settings.contextMessageLimit;
        const limit = (rawLimit !== undefined && rawLimit !== null && !isNaN(Number(rawLimit))) ? Math.max(0, Number(rawLimit)) : 4;

        // Check if the trailing message is a quiet prompt instruction injected by SillyTavern
        const lastMsg = chat[chat.length - 1];
        const isQuietInstruction = lastMsg && (
            lastMsg.is_quiet === true ||
            (typeof lastMsg.mes === 'string' && (
                lastMsg.mes.includes("Analyze the recent chat log above") ||
                lastMsg.mes.includes("Output the generated character's status JSON block only")
            ))
        );

        const historyMessages = isQuietInstruction ? chat.slice(0, chat.length - 1) : chat.slice();
        const instructionMessage = isQuietInstruction ? lastMsg : null;

        // Filter out SillyTavern system messages (/sys) and tracker notification logs
        const validChatMessages = historyMessages.filter(msg => {
            if (!msg) return false;
            if (msg.is_system === true || msg.extra?.is_system === true || msg.extra?.type === 'system') return false;
            if (typeof msg.mes === 'string' && msg.mes.startsWith('[RPG Tracker]')) return false;
            return true;
        });

        // Slice exact amount of recent chat messages based on configured limit
        const slicedHistory = limit > 0 ? validChatMessages.slice(-limit) : [];

        // Reconstruct chat array preserving exact history count and trailing instruction if present
        const finalChat = instructionMessage ? [...slicedHistory, instructionMessage] : slicedHistory;
        chat.splice(0, chat.length, ...finalChat);
    };

    globalThis.RPGTracker_interceptGeneration = interceptor;
    if (typeof window !== 'undefined') {
        window.RPGTracker_interceptGeneration = interceptor;
    }
}