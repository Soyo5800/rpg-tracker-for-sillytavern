import { isCharacterExpressionActive } from './ActivePrompt.js';
import { deepClone as clone } from './StateHelpers.js';

const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const normalizedName = value => String(value || '').trim().toLowerCase();

function same(left, right, ignoreIds = false) {
    if (left === right) return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = value => Object.keys(value).filter(key => !ignoreIds || key !== 'id').sort();
    const leftKeys = keys(left);
    const rightKeys = keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key, index) => key === rightKeys[index] && same(left[key], right[key], ignoreIds));
}

function changedFields(before = {}, after = {}, keys = Object.keys(after)) {
    const changes = {};
    for (const key of keys) {
        if (has(after, key) && !same(before?.[key], after[key])) changes[key] = clone(after[key]);
    }
    return changes;
}

function matchingEntry(items, entry) {
    if (!Array.isArray(items) || !entry) return null;
    return items.find(item => entry.id && item.id === entry.id)
        || items.find(item => normalizedName(item.name) === normalizedName(entry.name));
}

function typedValue(value, schema) {
    if (!schema?.type) return clone(value);
    const limits = ['min', 'max'].filter(key => typeof schema[key] === 'number')
        .map(key => `, ${key}: ${schema[key]}`).join('');
    return `${String(value ?? '')} (type: ${schema.type}${limits})`;
}

/**
 * Calculates facial expression changes.
 * Inspects chatMetadata fallback when snapshot objects omit sprite lists.
 */
function expressionDelta(previous, character) {
    if (!character || typeof character !== 'object') return null;
    if (!isCharacterExpressionActive(character)) return null;

    const prevSprite = typeof previous?.selectedSprite === 'string' ? previous.selectedSprite : '';
    const nextSprite = typeof character?.selectedSprite === 'string' ? character.selectedSprite : '';
    if (!nextSprite) return null;

    const cleanPrev = prevSprite.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();
    const cleanNext = nextSprite.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();

    if (previous && cleanPrev === cleanNext) return null;
    return cleanNext;
}

function statusDelta(before, after) {
    const changes = {};
    for (const schema of after.statusSchema || []) {
        if (!has(after.status, schema.id)) continue;
        const previousSchema = (before?.statusSchema || []).find(item => item.id === schema.id);
        const value = after.status[schema.id];
        if (previousSchema && same(before.status?.[schema.id], value)) continue;
        changes[schema.name || schema.id] = previousSchema ? clone(value) : typedValue(value, schema);
    }
    return changes;
}

function inventoryDelta(before = {}, after = {}) {
    const changes = {};

    const beforeEquip = (before && typeof before.equipment === 'object') ? before.equipment : {};
    const afterEquip = (after && typeof after.equipment === 'object') ? after.equipment : {};
    const equipSlots = new Set([
        ...Object.keys(beforeEquip),
        ...Object.keys(afterEquip)
    ]);

    const equipFields = {};
    for (const slot of equipSlots) {
        const prevItem = beforeEquip[slot] ?? null;
        const nextItem = afterEquip[slot] ?? null;
        if (!same(prevItem, nextItem, true)) {
            equipFields[slot] = clone(nextItem);
        }
    }
    if (Object.keys(equipFields).length) {
        changes.equipment = equipFields;
    }

    const beforeStorage = (before && typeof before.storage === 'object') ? before.storage : {};
    const afterStorage = (after && typeof after.storage === 'object') ? after.storage : {};
    const storageContainers = new Set([
        ...Object.keys(beforeStorage),
        ...Object.keys(afterStorage)
    ]);

    const storageFields = {};
    for (const container of storageContainers) {
        const beforeItems = Array.isArray(beforeStorage[container]) ? beforeStorage[container] : [];
        const currentItems = Array.isArray(afterStorage[container]) ? afterStorage[container] : [];

        const changedItems = currentItems.filter(item => {
            const previous = matchingEntry(beforeItems, item);
            return !previous || !same(previous, item, true);
        }).map(clone);

        const removedItems = beforeItems.filter(prevItem => {
            const current = matchingEntry(currentItems, prevItem);
            return !current;
        }).map(prevItem => {
            const itemCopy = clone(prevItem);
            itemCopy.quantity = 0;
            return itemCopy;
        });

        const allContainerDiffs = [...changedItems, ...removedItems];

        if (allContainerDiffs.length) {
            storageFields[container] = allContainerDiffs;
        } else if (beforeItems.length > 0 && currentItems.length === 0) {
            storageFields[container] = [];
        }
    }

    if (Object.keys(storageFields).length) {
        changes.storage = storageFields;
    }

    return changes;
}

function questData(quest = {}) {
    return {
        name: quest.name || '',
        desc: quest.desc || '',
        isCompleted: Boolean(quest.isCompleted),
    };
}

function questsDelta(before = {}, after = {}) {
    const changes = {};
    if (after.main && !same(questData(before.main), questData(after.main))) {
        changes.main = questData(after.main);
    }
    const sideQuests = (after.sides || []).filter(quest => {
        const previous = matchingEntry(before.sides, quest);
        return !previous || !same(questData(previous), questData(quest));
    }).map(questData);
    if (sideQuests.length) changes.sideQuests = sideQuests;
    return changes;
}

function metricDelta(before = {}, after = {}) {
    const changes = {};
    for (const [name, metric] of Object.entries(after)) {
        const value = metric && typeof metric === 'object' ? metric.value : metric;
        const previous = before[name];
        const previousValue = previous && typeof previous === 'object' ? previous.value : previous;
        if (has(before, name) && same(previousValue, value)) continue;
        changes[name] = has(before, name) ? clone(value) : typedValue(value, metric);
    }
    return changes;
}

function relationsDelta(before = {}, after = {}) {
    const changes = {};
    for (const [target, relation] of Object.entries(after)) {
        const previous = before[target] || {};
        const fields = {};
        if (has(relation, 'text') && relation.text !== previous.text) fields.description = relation.text;
        if (has(relation, 'targetText') && relation.targetText !== previous.targetText) fields.targetDescription = relation.targetText;
        const metrics = metricDelta(previous.values, relation.values);
        const targetMetrics = metricDelta(previous.targetValues, relation.targetValues);
        if (Object.keys(metrics).length) fields.metrics = metrics;
        if (Object.keys(targetMetrics).length) fields.targetMetrics = targetMetrics;
        if (Object.keys(fields).length) changes[target] = fields;
    }
    return changes;
}

export function getAppliedDelta(before, after) {
    if (!after || typeof after !== 'object') return {};
    const delta = {};
    const beforeWorld = before?.worldState || {};
    const afterWorld = after.worldState || {};
    const world = changedFields(beforeWorld, afterWorld, ['date', 'time', 'weather', 'location']);
    const events = (afterWorld.events || []).filter(event => {
        const previous = matchingEntry(beforeWorld.events, event);
        return !previous || !same(previous, event, true);
    }).map(clone);
    if (events.length) world.events = events;
    if (Object.keys(world).length) delta.World = world;

    for (const character of after.characters || []) {
        const previous = (before?.characters || []).find(item => normalizedName(item.name) === normalizedName(character.name))
            || (before?.characters || []).find(item => item.id === character.id);
        const changes = {};
        const sections = {
            status: statusDelta(previous, character),
            profile: changedFields(previous?.profile, character.profile || {}),
            inventory: inventoryDelta(previous?.inventory, character.inventory),
            quests: questsDelta(previous?.quests, character.quests),
            relations: relationsDelta(previous?.relations, character.relations),
        };

        const expChange = expressionDelta(previous, character);
        if (expChange) {
            changes.expression = expChange;
        }

        for (const [section, fields] of Object.entries(sections)) {
            if (Object.keys(fields).length) changes[section] = fields;
        }
        if (previous?.activePlayer !== character.activePlayer && typeof character.activePlayer === 'boolean') {
            changes.activePlayer = character.activePlayer;
            if (!Object.keys(sections).some(section => has(changes, section))) changes.status = {};
        }
        if (character.name && Object.keys(changes).length) delta[character.name] = changes;
    }
    return delta;
}