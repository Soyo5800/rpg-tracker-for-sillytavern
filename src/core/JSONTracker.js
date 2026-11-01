/**
 * Unified facade module for RPG Tracker state management.
 * Aggregates and re-exports migrator, patcher, timeline, and history utilities.
 */

export {
    CURRENT_TRACKER_SCHEMA_VERSION,
    PROMPT_SETTING_KEYS,
    extractPromptSettings,
    stripPromptSettings,
    isBase64Image,
    sanitizeAvatarUrl,
    cleanBase64Avatar,
    hasBase64Avatar,
    generateUniqueId,
    getNextCharacterId,
    cleanIdString,
    parseMetadata,
    normalizeSingleInventoryItem,
    migrateCharacterSchema,
    reindexCharactersSequentially,
    remapAssociatedMetadata,
    syncChatHistoryCharacterIds,
    sanitizeTrackerData,
    pruneOrphanedChatLocks,
    migrateChatHistoryMessages
} from './JSONTracker_Migrator.js';

export {
    applyLLMPatch,
    syncCrossRelations,
    extractNormalizedPatch
} from './JSONTracker_Patcher.js';

export {
    defensiveMerge,
    purgeOldBackups,
    backupToMessage,
    rehydrateFromHistory,
    rehydrateFromHistoryAsync
} from './JSONTracker_Timeline.js';

export {
    resolveActiveSwipeId,
    resolveMessageIndex,
    extractTurnSnapshotData,
    isTurnSnapshotPinned,
    setTurnSnapshotPinned,
    getChatTurnHistory,
    updateTurnSnapshotData,
    deleteTurnSnapshot,
    restoreTurnSnapshotToLive,
    manualPruneBackups
} from './JSONTracker_History.js';