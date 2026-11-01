import { pruneOrphanedChatLocks } from './JSONTracker_Migrator.js';
import { extractPromptSettings } from './PromptSchema.js';
import { deepClone as clone } from './StateHelpers.js';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const WORLD_FIELDS = ['date', 'time', 'weather', 'location'];

export const CHAT_LOCKS_KEY = 'rpgTrackerLocks';
export const CHAT_PROMPTS_KEY = 'rpgPromptSettings';

/**
 * Generates a unique key identifying the current active chat session.
 */
export function getChatKey(context) {
    if (!context?.chatId) return null;
    return JSON.stringify([context.groupId ?? null, context.characterId ?? null, context.chatId]);
}

function flagsFor(values = {}, flags = {}) {
    values ||= {};
    flags ||= {};
    return Object.fromEntries(
        Object.keys(values).map(key => [key, flags[key] === true])
    );
}

function lockedValues(values = {}, flags = {}) {
    values ||= {};
    flags ||= {};
    return Object.fromEntries(
        Object.keys(flags)
            .filter(key => flags[key] && own(values, key))
            .map(key => [key, clone(values[key])])
    );
}

/**
 * Captures current locked fields and their values across world state and active characters.
 */
export function captureLocks(tracker = {}) {
    tracker ||= {};
    const worldFlags = Object.fromEntries(
        WORLD_FIELDS.map(key => [key, tracker.worldStateLocks?.[key] === true])
    );

    const characters = Object.create(null);
    for (const char of tracker.characters || []) {
        if (!char?.id) continue;

        const profileFlags = flagsFor(char.profile, char.profileLocks);
        const inventory = char.inventory || {};
        const equipmentLocks = flagsFor(inventory.equipment, inventory.equipmentLocks);
        const storageLocks = flagsFor(inventory.storage, inventory.storageLocks);

        const status = Object.create(null);
        for (const schema of char.statusSchema || []) {
            if (!schema.id) continue;
            status[schema.id] = { locked: schema.isLocked === true };
            if (schema.isLocked) {
                status[schema.id].schema = clone(schema);
                if (own(char.status, schema.id)) {
                    status[schema.id].value = clone(char.status[schema.id]);
                }
            }
        }

        characters[char.id] = {
            identity: Object.fromEntries(
                ['id', 'name', 'activePlayer', 'activeInjection', 'syncedCardType', 'syncedCardAvatar']
                    .filter(key => own(char, key)).map(key => [key, clone(char[key])])
            ),
            status,
            profile: {
                flags: profileFlags,
                values: lockedValues(char.profile, profileFlags),
                injects: lockedValues(char.profileInjects, profileFlags),
            },
            inventory: {
                equipIsLocked: inventory.equipIsLocked === true,
                storageIsLocked: inventory.storageIsLocked === true,
                equipmentLocks,
                storageLocks,
                equipment: inventory.equipIsLocked
                    ? clone(inventory.equipment || {})
                    : lockedValues(inventory.equipment, equipmentLocks),
                storage: inventory.storageIsLocked
                    ? clone(inventory.storage || {})
                    : lockedValues(inventory.storage, storageLocks),
            },
            quests: {
                main: {
                    locked: char.quests?.main?.isLocked === true,
                    ...(char.quests?.main?.isLocked ? { value: clone(char.quests.main) } : {}),
                },
                sides: (char.quests?.sides || []).map(quest => ({
                    id: quest.id,
                    name: quest.name,
                    locked: quest.isLocked === true,
                    ...(quest.isLocked ? { value: clone(quest) } : {}),
                })),
            },
            relations: Object.fromEntries(
                Object.entries(char.relations || {}).map(([name, relation]) => [
                    name,
                    { locked: relation?.isLocked === true, ...(relation?.isLocked ? { value: clone(relation) } : {}) },
                ])
            ),
        };
    }

    return {
        version: 1,
        world: { flags: worldFlags, values: lockedValues(tracker.worldState, worldFlags) },
        characters,
    };
}

function restoreValues(target, values, flags) {
    for (const [key, locked] of Object.entries(flags)) {
        if (!locked) continue;
        if (own(values, key)) {
            Object.defineProperty(target, key, {
                value: clone(values[key]),
                enumerable: true,
                configurable: true,
                writable: true,
            });
        } else {
            delete target[key];
        }
    }
}

function applyCharacterLocks(char, record) {
    char.statusSchema = (char.statusSchema || []).map(schema => ({
        ...schema,
        isLocked: record.status[schema.id]?.locked === true,
    }));

    char.status = char.status || {};
    for (const [id, field] of Object.entries(record.status)) {
        if (!field.locked) continue;
        const index = char.statusSchema.findIndex(schema => schema.id === id);
        if (index === -1) {
            if (field.schema) char.statusSchema.push(clone(field.schema));
        } else {
            char.statusSchema[index] = { ...char.statusSchema[index], isLocked: true };
        }

        if (own(field, 'value')) char.status[id] = clone(field.value);
        else delete char.status[id];
    }

    char.profile = char.profile || {};
    char.profileLocks = clone(record.profile.flags);
    restoreValues(char.profile, record.profile.values, record.profile.flags);
    char.profileInjects = { ...(char.profileInjects || {}), ...clone(record.profile.injects) };

    char.inventory = char.inventory || {};
    const inventory = record.inventory;
    char.inventory.equipIsLocked = inventory.equipIsLocked;
    char.inventory.storageIsLocked = inventory.storageIsLocked;
    char.inventory.equipmentLocks = clone(inventory.equipmentLocks);
    char.inventory.storageLocks = clone(inventory.storageLocks);
    char.inventory.equipment = inventory.equipIsLocked
        ? clone(inventory.equipment)
        : (char.inventory.equipment || {});
    char.inventory.storage = inventory.storageIsLocked
        ? clone(inventory.storage)
        : (char.inventory.storage || {});

    if (!inventory.equipIsLocked) restoreValues(char.inventory.equipment, inventory.equipment, inventory.equipmentLocks);
    if (!inventory.storageIsLocked) restoreValues(char.inventory.storage, inventory.storage, inventory.storageLocks);

    char.quests = char.quests || {};
    char.quests.main = record.quests.main.locked
        ? clone(record.quests.main.value)
        : { ...(char.quests.main || {}), isLocked: false };

    const matchesQuest = (a, b) => a.id && b.id ? a.id === b.id : a.name === b.name;
    char.quests.sides = (char.quests.sides || []).map(quest => {
        const saved = record.quests.sides.find(item => matchesQuest(item, quest));
        return saved?.locked ? clone(saved.value) : { ...quest, isLocked: false };
    });

    for (const quest of record.quests.sides) {
        if (quest.locked && !char.quests.sides.some(item => matchesQuest(item, quest))) {
            char.quests.sides.push(clone(quest.value));
        }
    }

    char.relations = Object.fromEntries(
        Object.entries(char.relations || {}).map(([name, relation]) => [
            name,
            { ...relation, isLocked: false },
        ])
    );
    for (const [name, relation] of Object.entries(record.relations)) {
        if (relation.locked) char.relations[name] = clone(relation.value);
    }
}

/**
 * Enforces lock rules on existing candidate tracker data.
 * Prunes orphaned locks and strictly matches characters by ID (with resilient name fallback)
 * without resurrecting deleted characters.
 */
export function applyLocks(candidate, lockState) {
    const result = clone(candidate || {});
    if (lockState?.version !== 1 || !lockState.world || !lockState.characters) return result;

    pruneOrphanedChatLocks(lockState, result);

    result.worldState = result.worldState || {};
    result.worldStateLocks = clone(lockState.world.flags);
    restoreValues(result.worldState, lockState.world.values, lockState.world.flags);

    result.characters = result.characters || [];
    for (const [id, record] of Object.entries(lockState.characters)) {
        let char = result.characters.find(item => item.id === id);
        if (!char && record?.identity?.name) {
            const cleanRecName = record.identity.name.trim().toLowerCase();
            char = result.characters.find(item => item.name?.trim().toLowerCase() === cleanRecName);
        }
        if (!char) continue;

        applyCharacterLocks(char, record);
    }

    return result;
}

/**
 * Manages persistent storage of tracker locks within chat metadata.
 */
export function createChatLockStore(getContext) {
    function remember(tracker, expectedKey = getChatKey(getContext())) {
        const context = getContext();
        if (!expectedKey || getChatKey(context) !== expectedKey || !context.chatMetadata) return;

        const locks = captureLocks(tracker);
        pruneOrphanedChatLocks(locks, tracker);

        if (JSON.stringify(context.chatMetadata[CHAT_LOCKS_KEY]) === JSON.stringify(locks)) return;

        context.chatMetadata[CHAT_LOCKS_KEY] = locks;
        Promise.resolve(context.saveMetadata?.()).catch(error => {
            console.error('[RPG Tracker] Could not save chat locks:', error);
        });
    }

    function restore(tracker, expectedKey = getChatKey(getContext())) {
        const context = getContext();
        if (!expectedKey || getChatKey(context) !== expectedKey) return tracker;

        const saved = context.chatMetadata?.[CHAT_LOCKS_KEY];
        if (saved?.version === 1) {
            const beforeJson = JSON.stringify(saved);
            const applied = applyLocks(tracker, saved);

            if (JSON.stringify(saved) !== beforeJson) {
                Promise.resolve(context.saveMetadata?.()).catch(error => {
                    console.error('[RPG Tracker] Could not save pruned chat locks:', error);
                });
            }
            return applied;
        }

        remember(tracker, expectedKey);
        return tracker;
    }

    return { remember, restore };
}

/**
 * Manages persistent storage of prompt configuration within chat metadata.
 */
export function createChatPromptStore(getContext) {
    function get(expectedKey = getChatKey(getContext())) {
        const context = getContext();
        if (!expectedKey || getChatKey(context) !== expectedKey || !context?.chatMetadata) return null;
        const saved = context.chatMetadata[CHAT_PROMPTS_KEY];
        return (saved && typeof saved === 'object') ? clone(saved) : null;
    }

    function save(source, expectedKey = getChatKey(getContext())) {
        const context = getContext();
        if (!expectedKey || getChatKey(context) !== expectedKey || !context?.chatMetadata) return;
        if (!source || typeof source !== 'object') return;

        const cleanSettings = extractPromptSettings(source);
        if (Object.keys(cleanSettings).length === 0) return;

        if (JSON.stringify(context.chatMetadata[CHAT_PROMPTS_KEY]) === JSON.stringify(cleanSettings)) return;

        context.chatMetadata[CHAT_PROMPTS_KEY] = cleanSettings;
        Promise.resolve(context.saveMetadata?.()).catch(error => {
            console.error('[RPG Tracker] Could not save chat prompt settings:', error);
        });
    }

    return { get, save };
}