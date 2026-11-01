import { getDefaultCharacters } from './PromptSchema.js';
import { sanitizeTrackerData, cleanIdString, parseMetadata, getNextCharacterId } from './JSONTracker_Migrator.js';
import { buildCharacterSpriteUrl } from './AvatarResolver.js';

const IGNORED_CHAR_KEYS = new Set([
  'character name',
  'character_name',
  'character',
  'target name',
  'target_name',
  'target example',
  'target_example',
  'your character',
  'player character'
]);

const EXPRESSION_KEYS = new Set(['expression', 'emotion', 'mood']);

/**
 * Bidirectional emotion synonym mapping table.
 */
const EMOTION_SYNONYMS = {
  joy: ['happy', 'smile', 'smiling', 'grin', 'cheerful', 'pleased', 'glad', 'delighted', 'laugh', 'laughing'],
  happy: ['joy', 'smile', 'smiling', 'grin', 'cheerful', 'pleased', 'glad'],
  smile: ['joy', 'happy', 'smiling', 'grin', 'cheerful'],
  anger: ['angry', 'mad', 'furious', 'rage', 'annoyed', 'irritated', 'grumpy'],
  angry: ['anger', 'mad', 'furious', 'rage', 'annoyed', 'irritated'],
  sadness: ['sad', 'unhappy', 'depressed', 'crying', 'cry', 'tearful', 'grief', 'sorrow'],
  sad: ['sadness', 'unhappy', 'depressed', 'crying', 'cry', 'tearful', 'grief'],
  surprise: ['surprised', 'shocked', 'astonished', 'amazed', 'gasp'],
  surprised: ['surprise', 'shocked', 'astonished', 'amazed'],
  fear: ['scared', 'frightened', 'terrified', 'afraid', 'panicked'],
  scared: ['fear', 'frightened', 'terrified', 'afraid'],
  embarrassment: ['embarrassed', 'blush', 'blushing', 'shy', 'flustered', 'ashamed'],
  embarrassed: ['embarrassment', 'blush', 'blushing', 'shy', 'flustered'],
  blush: ['embarrassment', 'embarrassed', 'blushing', 'shy', 'flustered'],
  neutral: ['normal', 'default', 'idle', 'calm', 'blank', 'base'],
  love: ['loving', 'affection', 'enamored', 'heart_eyes', 'fond'],
  disgust: ['disgusted', 'gross', 'repulsed', 'revolted'],
  curiosity: ['curious', 'interested', 'inquisitive', 'wondering'],
  confusion: ['confused', 'puzzled', 'perplexed', 'questioning']
};

function isPlaceholderValue(val) {
  if (typeof val === 'string' && val.toLowerCase().includes('<new_value')) return true;
  return false;
}

function normalizeKeys(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const normalized = {};
  Object.entries(obj).forEach(([k, v]) => {
    normalized[k.toLowerCase()] = v;
  });
  return normalized;
}

function clampNumeric(value, min = 0, max = 100) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return null;
  const minBound = min !== null && min !== undefined ? min : 0;
  const maxBound = max !== null && max !== undefined ? max : 100;
  return Math.min(maxBound, Math.max(minBound, parsed));
}

function mergeWorldState(currentWorldState, rawUpdates, worldStateLocks) {
  const worldState = currentWorldState || { date: '', time: '', location: '', weather: '', events: [] };
  const locks = worldStateLocks || {};
  const updates = normalizeKeys(rawUpdates);

  if (updates.date !== undefined && !locks.date && !isPlaceholderValue(updates.date)) worldState.date = String(updates.date);
  if (updates.time !== undefined && !locks.time && !isPlaceholderValue(updates.time)) worldState.time = String(updates.time);
  if (updates.location !== undefined && !locks.location && !isPlaceholderValue(updates.location)) worldState.location = String(updates.location);
  if (updates.weather !== undefined && !locks.weather && !isPlaceholderValue(updates.weather)) worldState.weather = String(updates.weather);

  if (Array.isArray(updates.events)) {
    const existingEvents = worldState.events || [];
    const parsedNewEvents = updates.events.map(e => {
      let name = '';
      let desc = '';
      if (typeof e === 'string') {
        desc = e.trim();
      } else if (e && typeof e === 'object') {
        const normE = normalizeKeys(e);
        name = normE.name || '';
        desc = normE.desc || normE.description || '';
      }
      if (!name && !desc) return null;
      if (isPlaceholderValue(name) || isPlaceholderValue(desc)) return null;
      const id = cleanIdString(name, 'event');
      return { id, name, desc };
    }).filter(Boolean);

    const mergedEvents = [...existingEvents];
    parsedNewEvents.forEach(newEvt => {
      const index = mergedEvents.findIndex(evt =>
        (evt.id && evt.id === newEvt.id) ||
        (evt.name && evt.name.trim().toLowerCase() === newEvt.name.trim().toLowerCase())
      );
      if (index !== -1) {
        mergedEvents[index] = { ...mergedEvents[index], ...newEvt };
      } else {
        mergedEvents.push(newEvt);
      }
    });
    worldState.events = mergedEvents;
  }
  return worldState;
}

function getOrCreateCharacter(charactersArray, charName, isPlayer, rawUpdates) {
  const cleanCharId = cleanIdString(charName, 'char');
  const targetKey = charName.trim().toLowerCase();

  let charIndex = charactersArray.findIndex(c =>
    c.id?.toLowerCase() === targetKey ||
    c.id === cleanCharId ||
    c.name?.trim().toLowerCase() === targetKey
  );

  if (charIndex === -1) {
    const strippedName = targetKey.split(/[:(]/)[0].trim();
    if (strippedName) {
      charIndex = charactersArray.findIndex(c =>
        c.name?.trim().toLowerCase() === strippedName
      );
    }
  }

  const updates = normalizeKeys(rawUpdates);

  if (charIndex === -1) {
    const newChar = JSON.parse(JSON.stringify(getDefaultCharacters()[0]));
    newChar.name = charName;
    const isUserPlayer = updates.activeplayer !== undefined ? Boolean(updates.activeplayer) : isPlayer;
    newChar.activePlayer = isUserPlayer;

    newChar.statusSchema = [];
    newChar.status = {};
    newChar.profile = {};
    newChar.profileLocks = {};
    newChar.relations = {};

    newChar.isFolder = true;
    newChar.enableExpression = false;
    newChar.selectedSprite = null;
    newChar.availableSprites = [];

    const hasUserChar = charactersArray.some(c => c.id === 'char_user');
    if (charactersArray.length === 1 && charactersArray[0].id === 'char_user' && charactersArray[0].name === 'New') {
      newChar.id = 'char_user';
      charactersArray.length = 0;
      charactersArray.push(newChar);
      charIndex = 0;
    } else if (isUserPlayer && !hasUserChar) {
      newChar.id = 'char_user';
      charactersArray.push(newChar);
      charIndex = charactersArray.length - 1;
    } else {
      newChar.id = getNextCharacterId(charactersArray);
      charactersArray.push(newChar);
      charIndex = charactersArray.length - 1;
    }
  }

  const char = charactersArray[charIndex];
  if (updates.activeplayer !== undefined) {
    char.activePlayer = Boolean(updates.activeplayer);
  }
  return char;
}

function resolveStatusField(patchKey, rawPatchVal, existingSchemaList) {
  const metaInfo = parseMetadata(rawPatchVal);
  const patchVal = metaInfo.value;
  const cleanPatchKey = patchKey.toLowerCase().replace(/\s+/g, '');

  const matchedSchema = existingSchemaList.find(schema => {
    const cleanId = (schema.id || '').toLowerCase().replace(/\s+/g, '');
    const cleanName = (schema.name || '').toLowerCase().replace(/\s+/g, '');
    return cleanId === cleanPatchKey || cleanName === cleanPatchKey;
  });

  let targetId = matchedSchema ? matchedSchema.id : cleanIdString(patchKey, '');
  let finalType = matchedSchema?.type || metaInfo.type || 'text';
  let finalMin = matchedSchema?.min ?? (metaInfo.min !== null ? metaInfo.min : 0);
  let finalMax = matchedSchema?.max ?? (metaInfo.max !== null ? metaInfo.max : 100);
  let isLocked = matchedSchema?.isLocked || false;
  let isInject = matchedSchema?.isInject !== false;

  if (!matchedSchema && !metaInfo.type) {
    const parsedInt = parseInt(patchVal, 10);
    if (!isNaN(parsedInt) && String(patchVal).trim() === String(parsedInt)) {
      finalType = 'integer';
    }
  }

  let finalVal = patchVal !== null && patchVal !== undefined ? String(patchVal) : '';
  if (['integer', 'consumable', 'stacking'].includes(finalType)) {
    const clamped = clampNumeric(patchVal, finalMin, finalMax);
    if (clamped !== null) {
      finalVal = clamped;
    } else {
      finalVal = finalType === 'consumable' ? finalMax : finalMin;
    }
  }

  return {
    id: targetId,
    name: matchedSchema ? matchedSchema.name : patchKey,
    type: finalType,
    min: finalMin,
    max: finalMax,
    isLocked,
    isInject,
    value: finalVal,
    matchedSchema
  };
}

/**
 * Matches candidate emotion token to available character sprites and mutates character state.
 * Strictly bypassed when expression tracking or sprite folders are disabled.
 */
function mergeCharacterExpression(char, rawExpression) {
  if (!char || isPlaceholderValue(rawExpression)) return;
  if (typeof rawExpression !== 'string') return;

  const cleanRaw = rawExpression.trim();
  if (!cleanRaw) return;

  const ctx = (typeof window !== 'undefined' && window.SillyTavern?.getContext)
    ? window.SillyTavern.getContext()
    : null;
  const customMeta = ctx?.chatMetadata?.rpgCustomAvatars?.[char.id] || {};

  const isFolder = char.isFolder !== undefined ? Boolean(char.isFolder) : (customMeta.isFolder !== false);
  const enableExpression = char.enableExpression !== undefined ? Boolean(char.enableExpression) : (customMeta.enableExpression === true);

  if (!isFolder || !enableExpression) {
    if (!isFolder) {
      char.selectedSprite = null;
      char.enableExpression = false;
      char.availableSprites = [];
    }
    return;
  }

  const available = (Array.isArray(char.availableSprites) && char.availableSprites.length > 0)
    ? char.availableSprites
    : (Array.isArray(customMeta.availableSprites) ? customMeta.availableSprites : []);

  if (available.length === 0) return;

  const candidate = cleanRaw.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();
  let matched = null;

  const getCleanItemLabel = (item) => {
    const raw = typeof item === 'string' ? item : (item.cleanLabel || item.label || item.fileName || item.name || '');
    return raw.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();
  };

  // 1. Exact clean label or filename match
  for (const item of available) {
    if (getCleanItemLabel(item) === candidate) {
      matched = typeof item === 'string' ? item : (item.fileName || item.label);
      break;
    }
  }

  // 2. Emotion synonym dictionary forward matching
  if (!matched) {
    const synonyms = EMOTION_SYNONYMS[candidate] || [];
    for (const item of available) {
      const clean = getCleanItemLabel(item);
      if (synonyms.includes(clean)) {
        matched = typeof item === 'string' ? item : (item.fileName || item.label);
        break;
      }
    }
  }

  // 3. Emotion synonym dictionary reverse matching
  if (!matched) {
    for (const item of available) {
      const clean = getCleanItemLabel(item);
      const spriteSynonyms = EMOTION_SYNONYMS[clean] || [];
      if (spriteSynonyms.includes(candidate)) {
        matched = typeof item === 'string' ? item : (item.fileName || item.label);
        break;
      }
    }
  }

  // 4. Substring containment match
  if (!matched) {
    for (const item of available) {
      const clean = getCleanItemLabel(item);
      if (clean && (clean.includes(candidate) || candidate.includes(clean))) {
        matched = typeof item === 'string' ? item : (item.fileName || item.label);
        break;
      }
    }
  }

  if (!matched) return;

  char.selectedSprite = matched;

  const effectiveAsset = char.assetName
    || customMeta.assetName
    || (typeof char.syncedCardAvatar === 'string' ? char.syncedCardAvatar.replace(/\.[^/.]+$/, '') : char.name);

  if (effectiveAsset) {
    char.avatarUrl = buildCharacterSpriteUrl(effectiveAsset, char.selectedSprite, isFolder);
  }
}

function mergeCharacterStatus(char, statusUpdates, updateType) {
  const statusSchema = char.statusSchema || [];
  const currentStatus = char.status || {};

  if (updateType === 'replace') {
    const nextStatusSchema = [];
    const nextStatus = {};

    Object.entries(statusUpdates).forEach(([patchKey, rawPatchVal]) => {
      if (isPlaceholderValue(rawPatchVal)) return;
      if (EXPRESSION_KEYS.has(patchKey.toLowerCase())) return;

      const resolved = resolveStatusField(patchKey, rawPatchVal, statusSchema);
      nextStatusSchema.push({
        id: resolved.id,
        name: resolved.name,
        type: resolved.type,
        min: resolved.min,
        max: resolved.max,
        isLocked: resolved.isLocked,
        isInject: resolved.isInject
      });
      nextStatus[resolved.id] = resolved.value;
    });

    for (const schema of statusSchema) {
      if (schema.isLocked && !nextStatusSchema.some(item => item.id === schema.id)) {
        nextStatusSchema.push({ ...schema });
        if (currentStatus[schema.id] !== undefined) nextStatus[schema.id] = currentStatus[schema.id];
      }
    }

    char.status = nextStatus;
    char.statusSchema = nextStatusSchema;
  } else {
    const newStatus = {};
    statusSchema.forEach(schema => {
      if (currentStatus[schema.id] !== undefined) {
        newStatus[schema.id] = currentStatus[schema.id];
      } else {
        const minLimit = schema.min !== undefined && schema.min !== null ? schema.min : 0;
        const maxLimit = schema.max !== undefined && schema.max !== null ? schema.max : 100;
        newStatus[schema.id] = ['consumable'].includes(schema.type) ? maxLimit : minLimit;
      }
    });

    Object.entries(statusUpdates).forEach(([patchKey, rawPatchVal]) => {
      if (isPlaceholderValue(rawPatchVal)) return;
      if (EXPRESSION_KEYS.has(patchKey.toLowerCase())) return;

      const resolved = resolveStatusField(patchKey, rawPatchVal, statusSchema);

      if (resolved.matchedSchema) {
        newStatus[resolved.id] = resolved.value;
      } else {
        statusSchema.push({
          id: resolved.id,
          name: resolved.name,
          type: resolved.type,
          min: resolved.min,
          max: resolved.max,
          isLocked: false,
          isInject: true
        });
        newStatus[resolved.id] = resolved.value;
      }
    });

    char.status = newStatus;
    char.statusSchema = statusSchema;
  }
}

function mergeCharacterProfile(char, profileUpdates, updateType) {
  char.profileLocks = char.profileLocks || {};
  char.profile = char.profile || {};

  const actualKeys = {};
  Object.keys(char.profile).forEach(k => actualKeys[k.toLowerCase()] = k);

  const safeStringify = (val) => {
    if (typeof val === 'object' && val !== null) {
      try { return JSON.stringify(val); } catch (e) { return String(val); }
    }
    return String(val);
  };

  const processProfilePatch = (targetProfile) => {
    Object.entries(profileUpdates).forEach(([pKey, pVal]) => {
      if (isPlaceholderValue(pVal)) return;
      const lowerKey = pKey.toLowerCase();
      if (EXPRESSION_KEYS.has(lowerKey)) return;

      const actualKey = actualKeys[lowerKey] || pKey;

      if (!char.profileLocks[actualKey] && pVal !== undefined && pVal !== null) {
        targetProfile[actualKey] = safeStringify(pVal);
      }
    });
  };

  if (updateType === 'replace') {
    const nextProfile = {};
    Object.entries(char.profile || {}).forEach(([pKey, pVal]) => {
      if (char.profileLocks[pKey] === true) nextProfile[pKey] = pVal;
    });
    processProfilePatch(nextProfile);
    char.profile = nextProfile;
  } else {
    processProfilePatch(char.profile);
  }
}

function parseInventoryItem(rawItem) {
  if (!rawItem || isPlaceholderValue(rawItem)) return null;

  if (typeof rawItem === 'string') {
    const trimmed = rawItem.trim();
    const qtyMatch = trimmed.match(/^([\s\S]*?)\s*(?:\(|\[)?\s*x?\s*(\d+)\s*(?:\)|\])?$/i);
    const itemName = qtyMatch ? qtyMatch[1].trim() : trimmed;
    const quantity = qtyMatch ? (parseInt(qtyMatch[2], 10) || 1) : 1;

    return {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: itemName,
      quantity: quantity,
      type: 'general'
    };
  }

  if (typeof rawItem === 'object') {
    const normItem = normalizeKeys(rawItem);
    const itemType = normItem.type || 'general';
    const baseItem = {
      id: normItem.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: normItem.name ? String(normItem.name).trim() : 'Unknown',
      type: itemType
    };

    if (normItem.quantity !== undefined) {
      baseItem.quantity = normItem.quantity;
    }

    const itemDesc = normItem.desc !== undefined ? normItem.desc : normItem.description;
    if (itemDesc !== undefined && !isPlaceholderValue(itemDesc)) {
      baseItem.desc = String(itemDesc);
    }

    if (normItem.assetvalue !== undefined && !isPlaceholderValue(normItem.assetvalue)) {
      baseItem.assetValue = normItem.assetvalue;
    }

    if (normItem.iscontainer !== undefined) {
      baseItem.isContainer = Boolean(normItem.iscontainer);
    }
    if (normItem.storagekey !== undefined) {
      baseItem.storageKey = normItem.storagekey;
    }

    return baseItem;
  }

  return null;
}

function mergeCharacterInventory(char, rawInventoryUpdates, updateType = 'patch') {
  const inventoryUpdates = normalizeKeys(rawInventoryUpdates);

  char.inventory = char.inventory || {};
  char.inventory.equipmentLocks = char.inventory.equipmentLocks || {};
  char.inventory.storageLocks = char.inventory.storageLocks || {};

  if (inventoryUpdates.equipment && typeof inventoryUpdates.equipment === 'object') {
    char.inventory.equipment = char.inventory.equipment || {};
    const actualSlots = {};
    Object.keys(char.inventory.equipment).forEach(k => actualSlots[k.toLowerCase()] = k);

    Object.entries(inventoryUpdates.equipment).forEach(([slot, itemVal]) => {
      if (isPlaceholderValue(itemVal)) return;

      const actualSlot = actualSlots[slot.toLowerCase()] || slot;
      const isSlotLocked = char.inventory.equipIsLocked || char.inventory.equipmentLocks[actualSlot] === true;
      if (isSlotLocked) return;

      const isExplicitlyRemoved = typeof itemVal === 'object' && itemVal !== null && (
        (itemVal.quantity !== undefined && Number(itemVal.quantity) <= 0) ||
        itemVal.deleted === true
      );

      if (itemVal === 'Empty' || itemVal === 'none' || itemVal === 'empty' || !itemVal || isExplicitlyRemoved) {
        char.inventory.equipment[actualSlot] = null;
      } else {
        const baseItem = parseInventoryItem(itemVal);
        if (baseItem) {
          const existingItem = char.inventory.equipment[actualSlot];
          if (existingItem && typeof existingItem === 'object' &&
            existingItem.name?.trim().toLowerCase() === baseItem.name?.trim().toLowerCase()) {
            char.inventory.equipment[actualSlot] = {
              ...existingItem,
              ...baseItem,
              id: existingItem.id || baseItem.id
            };
          } else {
            if (baseItem.quantity === undefined) baseItem.quantity = 1;
            if (baseItem.type !== 'currency' && baseItem.desc === undefined) baseItem.desc = '';
            if (baseItem.type === 'asset' && !baseItem.assetValue) {
              baseItem.assetValue = { amount: 0, currencyName: 'Gold' };
            }
            char.inventory.equipment[actualSlot] = baseItem;
          }
        }
      }
    });
  }

  if (inventoryUpdates.storage && typeof inventoryUpdates.storage === 'object') {
    char.inventory.storage = char.inventory.storage || {};
    const actualContainers = {};
    Object.keys(char.inventory.storage).forEach(k => actualContainers[k.toLowerCase()] = k);

    Object.entries(inventoryUpdates.storage).forEach(([container, items]) => {
      const actualContainer = actualContainers[container.toLowerCase()] || container;
      const isContainerLocked = char.inventory.storageIsLocked || char.inventory.storageLocks[actualContainer] === true;
      if (isContainerLocked) return;

      if (!Array.isArray(items)) return;

      const parsedIncomingItems = items.map(parseInventoryItem).filter(Boolean);

      if (updateType === 'replace') {
        char.inventory.storage[actualContainer] = parsedIncomingItems.map(item => {
          if (item.quantity === undefined) item.quantity = 1;
          if (item.type !== 'currency' && item.desc === undefined) item.desc = '';
          if (item.type === 'asset' && !item.assetValue) {
            item.assetValue = { amount: 0, currencyName: 'Gold' };
          }
          return item;
        });
      } else {
        const currentList = Array.isArray(char.inventory.storage[actualContainer])
          ? [...char.inventory.storage[actualContainer]]
          : [];

        parsedIncomingItems.forEach(incoming => {
          const matchedIdx = currentList.findIndex(existing =>
            (incoming.id && existing.id === incoming.id) ||
            (existing.name && existing.name.trim().toLowerCase() === incoming.name.trim().toLowerCase())
          );

          const isZeroOrNegative = incoming.quantity !== undefined && Number(incoming.quantity) <= 0;

          if (matchedIdx !== -1) {
            if (isZeroOrNegative) {
              currentList.splice(matchedIdx, 1);
            } else {
              currentList[matchedIdx] = {
                ...currentList[matchedIdx],
                ...incoming,
                id: currentList[matchedIdx].id || incoming.id
              };
            }
          } else if (!isZeroOrNegative) {
            if (incoming.quantity === undefined) incoming.quantity = 1;
            if (incoming.type !== 'currency' && incoming.desc === undefined) incoming.desc = '';
            if (incoming.type === 'asset' && !incoming.assetValue) {
              incoming.assetValue = { amount: 0, currencyName: 'Gold' };
            }
            currentList.push(incoming);
          }
        });

        char.inventory.storage[actualContainer] = currentList;
      }
    });
  }
}

function mergeCharacterQuests(char, rawQuestUpdates) {
  const questUpdates = normalizeKeys(rawQuestUpdates);
  if (questUpdates.mainquest && !questUpdates.main) questUpdates.main = questUpdates.mainquest;
  if (questUpdates.main_quest && !questUpdates.main) questUpdates.main = questUpdates.main_quest;
  if (questUpdates.sidequests) questUpdates.sideQuests = questUpdates.sidequests;
  if (questUpdates.side_quests && !questUpdates.sideQuests) questUpdates.sideQuests = questUpdates.side_quests;
  if (questUpdates.sides) questUpdates.sideQuests = questUpdates.sides;

  char.quests = char.quests || {};

  if (questUpdates.main && typeof questUpdates.main === 'object') {
    const mainUpdate = normalizeKeys(questUpdates.main);
    char.quests.main = char.quests.main || {};
    if (!char.quests.main.isLocked) {
      if (mainUpdate.name !== undefined && !isPlaceholderValue(mainUpdate.name)) {
        char.quests.main.name = String(mainUpdate.name);
      }
      if (mainUpdate.description !== undefined && !isPlaceholderValue(mainUpdate.description)) {
        char.quests.main.desc = String(mainUpdate.description);
      } else if (mainUpdate.desc !== undefined && !isPlaceholderValue(mainUpdate.desc)) {
        char.quests.main.desc = String(mainUpdate.desc);
      }
      if (mainUpdate.status !== undefined && !isPlaceholderValue(mainUpdate.status)) {
        char.quests.main.isCompleted = (String(mainUpdate.status).toUpperCase() === 'COMPLETED');
      } else if (mainUpdate.iscompleted !== undefined) {
        char.quests.main.isCompleted = Boolean(mainUpdate.iscompleted === true || mainUpdate.iscompleted === 'true');
      }
    }
  }

  if (Array.isArray(questUpdates.sideQuests)) {
    const existingSides = char.quests.sides || [];
    const nextSides = [...existingSides];

    questUpdates.sideQuests.forEach(sq => {
      if (isPlaceholderValue(sq)) return;
      let qName = 'Unknown', qDesc = '', isCompleted = false;

      if (typeof sq === 'string') {
        qName = sq;
      } else if (sq && typeof sq === 'object') {
        const normSq = normalizeKeys(sq);
        qName = normSq.name || 'Unknown';
        qDesc = normSq.description || normSq.desc || '';
        const statusStr = String(normSq.status || '').toUpperCase();
        isCompleted = statusStr === 'COMPLETED' || normSq.iscompleted === true || normSq.iscompleted === 'true';
      }

      if (isPlaceholderValue(qName) || isPlaceholderValue(qDesc)) return;

      const cleanId = cleanIdString(qName, 'quest');
      const matchedIdx = nextSides.findIndex(q =>
        (q.id && q.id === cleanId) ||
        (q.name && q.name.trim().toLowerCase() === qName.trim().toLowerCase())
      );

      if (matchedIdx !== -1) {
        if (!nextSides[matchedIdx].isLocked) {
          nextSides[matchedIdx].name = qName;
          if (qDesc) nextSides[matchedIdx].desc = qDesc;
          nextSides[matchedIdx].isCompleted = isCompleted;
        }
      } else {
        nextSides.push({
          id: cleanId,
          name: qName,
          desc: qDesc,
          isCompleted,
          isLocked: false
        });
      }
    });

    char.quests.sides = nextSides;
  }
}

function mergeMetricEntries(targetGroup, incomingGroup) {
  if (!incomingGroup || typeof incomingGroup !== 'object') return;

  Object.entries(incomingGroup).forEach(([mName, rawMVal]) => {
    if (isPlaceholderValue(rawMVal)) return;

    const metaInfo = parseMetadata(rawMVal);
    const parsedInt = parseInt(metaInfo.value, 10);
    if (isNaN(parsedInt)) return;

    const defaultMin = metaInfo.min !== null && !isNaN(parseInt(metaInfo.min, 10))
      ? parseInt(metaInfo.min, 10)
      : -100;
    const defaultMax = metaInfo.max !== null && !isNaN(parseInt(metaInfo.max, 10))
      ? parseInt(metaInfo.max, 10)
      : 100;

    const actualKey = Object.keys(targetGroup).find(k => k.toLowerCase() === mName.toLowerCase()) || mName;
    const existingMetric = targetGroup[actualKey];

    if (existingMetric && typeof existingMetric === 'object' && existingMetric !== null) {
      const minBound = existingMetric.min !== undefined && existingMetric.min !== null
        ? parseInt(existingMetric.min, 10)
        : defaultMin;
      const maxBound = existingMetric.max !== undefined && existingMetric.max !== null
        ? parseInt(existingMetric.max, 10)
        : defaultMax;
      const clamped = Math.min(maxBound, Math.max(minBound, parsedInt));

      existingMetric.value = clamped;
      existingMetric.type = 'integer';
      existingMetric.min = minBound;
      existingMetric.max = maxBound;
    } else {
      const clamped = Math.min(defaultMax, Math.max(defaultMin, parsedInt));
      targetGroup[actualKey] = {
        value: clamped,
        type: 'integer',
        min: defaultMin,
        max: defaultMax,
        colorNegative: '#e74c3c',
        colorPositive: '#2ecc71'
      };
    }
  });
}

function mergeCharacterRelations(char, relationUpdates, updateType) {
  if (updateType === 'replace') {
    const nextRelations = {};
    Object.entries(char.relations || {}).forEach(([targetName, rData]) => {
      if (rData && rData.isLocked) nextRelations[targetName] = rData;
    });
    char.relations = nextRelations;
  } else {
    char.relations = char.relations || {};
  }

  const actualTargets = {};
  Object.keys(char.relations).forEach(k => actualTargets[k.toLowerCase()] = k);

  Object.entries(relationUpdates).forEach(([targetName, rawRData]) => {
    if (!rawRData || typeof rawRData !== 'object' || isPlaceholderValue(targetName)) return;

    const actualTarget = actualTargets[targetName.toLowerCase()] || targetName;
    const rData = normalizeKeys(rawRData);

    const existingRelation = char.relations[actualTarget] || { text: '', isLocked: false, isInject: true, values: {} };
    if (existingRelation.isLocked) return;

    const descStr = rData.description || rData.desc;
    if (descStr !== undefined && !isPlaceholderValue(descStr)) {
      existingRelation.text = String(descStr);
    }

    const metricsObj = rData.metrics || rData.values;
    if (metricsObj && typeof metricsObj === 'object') {
      existingRelation.values = existingRelation.values || {};
      mergeMetricEntries(existingRelation.values, metricsObj);
    }

    const tDescStr = rData.targetdescription || rData.targettext;
    if (tDescStr !== undefined && !isPlaceholderValue(tDescStr)) {
      existingRelation.targetText = String(tDescStr);
    }

    const tMetricsObj = rData.targetmetrics || rData.targetvalues;
    if (tMetricsObj && typeof tMetricsObj === 'object') {
      existingRelation.targetValues = existingRelation.targetValues || {};
      mergeMetricEntries(existingRelation.targetValues, tMetricsObj);
    }

    char.relations[actualTarget] = existingRelation;
  });
}

export function syncCrossRelations(characters) {
  if (!Array.isArray(characters)) return;

  const charMap = new Map(characters.map(c => [c.name?.trim().toLowerCase(), c]));

  const truthMap = new Map();
  for (const char of characters) {
    if (!char.relations) continue;
    for (const [targetName, rData] of Object.entries(char.relations)) {
      const key = `${char.name?.trim().toLowerCase()}->${targetName.trim().toLowerCase()}`;
      truthMap.set(key, {
        text: rData.text || '',
        values: rData.values || {}
      });
    }
  }

  for (const char of characters) {
    if (!char.relations) continue;
    for (const [targetName, rData] of Object.entries(char.relations)) {
      if (rData.isLocked) continue;

      const targetChar = charMap.get(targetName.trim().toLowerCase());
      if (targetChar) {
        const counterKey = `${targetName.trim().toLowerCase()}->${char.name?.trim().toLowerCase()}`;
        const counterTruth = truthMap.get(counterKey);
        if (counterTruth) {
          rData.targetText = counterTruth.text;
          rData.targetValues = counterTruth.values;
        }
      }
    }
  }
}

export function extractNormalizedPatch(patch) {
  if (!patch || typeof patch !== 'object') return patch;

  let normalizedPatch = patch;

  if (Array.isArray(patch.characters)) {
    normalizedPatch = {};
    patch.characters.forEach(c => {
      if (c && typeof c === 'object' && c.name) {
        const { name, ...rest } = c;
        normalizedPatch[name] = rest;
      }
    });
    if (patch.world || patch.worldState || patch.World) {
      normalizedPatch.World = patch.world || patch.worldState || patch.World;
    }
  } else if (patch.characters && typeof patch.characters === 'object') {
    normalizedPatch = { ...patch.characters };
    if (patch.world || patch.worldState || patch.World) {
      normalizedPatch.World = patch.world || patch.worldState || patch.World;
    }
  }

  return normalizedPatch;
}

export function applyLLMPatch(trackerData, patch, isPlayer = false, updateType = 'patch', mutateInPlace = false) {
  if (!patch || typeof patch !== 'object') return trackerData;

  const baseData = mutateInPlace ? trackerData : JSON.parse(JSON.stringify(trackerData));
  const updatedData = sanitizeTrackerData(baseData);

  const normalizedPatch = extractNormalizedPatch(patch);

  if (Array.isArray(updatedData.characters)) {
    Object.entries(normalizedPatch).forEach(([charName, rawUpdates]) => {
      if (!rawUpdates || typeof rawUpdates !== 'object') return;

      const cleanName = charName.trim();
      const lowerName = cleanName.toLowerCase();

      if (lowerName === 'world' || lowerName === 'worldstate') {
        const updates = normalizeKeys(rawUpdates);
        updatedData.worldState = mergeWorldState(updatedData.worldState, updates, updatedData.worldStateLocks);
        return;
      }

      if (IGNORED_CHAR_KEYS.has(lowerName) || isPlaceholderValue(cleanName)) {
        return;
      }

      let existingChar = updatedData.characters.find(c => c.name?.trim().toLowerCase() === lowerName);
      if (!existingChar) {
        const stripped = lowerName.split(/[:(]/)[0].trim();
        if (stripped) {
          existingChar = updatedData.characters.find(c => c.name?.trim().toLowerCase() === stripped);
        }
      }

      if (existingChar && existingChar.activeInjection === false) {
        return;
      }

      const char = getOrCreateCharacter(updatedData.characters, cleanName, isPlayer, rawUpdates);
      const updates = normalizeKeys(rawUpdates);

      const ctx = (typeof window !== 'undefined' && window.SillyTavern?.getContext)
        ? window.SillyTavern.getContext()
        : null;
      const customMeta = ctx?.chatMetadata?.rpgCustomAvatars?.[char.id] || {};
      const isFolder = char.isFolder !== undefined ? Boolean(char.isFolder) : (customMeta.isFolder !== false);

      const normStatus = (updates.status && typeof updates.status === 'object')
        ? normalizeKeys(updates.status)
        : ((updates.stats && typeof updates.stats === 'object') ? normalizeKeys(updates.stats) : null);

      const normProfile = (updates.profile && typeof updates.profile === 'object')
        ? normalizeKeys(updates.profile)
        : null;

      const rawExpression = updates.expression
        ?? updates.emotion
        ?? updates.mood
        ?? normStatus?.expression
        ?? normStatus?.emotion
        ?? normStatus?.mood
        ?? normProfile?.expression
        ?? normProfile?.emotion
        ?? normProfile?.mood;

      let statusUpdates = updates.status || updates.stats || null;
      if (!statusUpdates && !updates.profile && !updates.relations && !updates.inventory && !updates.quests && rawExpression === undefined) {
        statusUpdates = rawUpdates;
      }

      if (!isFolder) {
        char.selectedSprite = null;
        char.enableExpression = false;
        char.availableSprites = [];

        const effectiveAsset = char.assetName
          || customMeta.assetName
          || (typeof char.syncedCardAvatar === 'string' ? char.syncedCardAvatar.replace(/\.[^/.]+$/, '') : char.name);

        if (effectiveAsset) {
          char.avatarUrl = buildCharacterSpriteUrl(effectiveAsset, null, false);
        }
      } else if (rawExpression !== undefined) {
        mergeCharacterExpression(char, rawExpression);
      }

      if (statusUpdates) mergeCharacterStatus(char, statusUpdates, updateType);
      if (updates.profile) mergeCharacterProfile(char, updates.profile, updateType);
      if (updates.inventory) mergeCharacterInventory(char, updates.inventory, updateType);
      if (updates.quests) mergeCharacterQuests(char, updates.quests);
      if (updates.relations) mergeCharacterRelations(char, updates.relations, updateType);
    });

    syncCrossRelations(updatedData.characters);
  }

  return updatedData;
}