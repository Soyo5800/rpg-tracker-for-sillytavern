import {
  DEFAULT_CYOA_PROMPT,
  DEFAULT_WEATHER_PROMPT,
  DEFAULT_WORLD_EVENTS_PROMPT,
  DEFAULT_PROMPT_HEADER_MERGED,
  DEFAULT_PROMPT_FOOTER_MERGED,
  DEFAULT_READONLY_CONTEXT_HEADER,
  DEFAULT_OUTPUT_ENFORCER,
  DEFAULT_OUTPUT_ENFORCER_SEP
} from './PromptSchema.js';

const CORE_EMOTION_PRIORITIES = [
  'neutral', 'normal', 'default', 'calm',
  'joy', 'happy', 'smile', 'smiling', 'cheerful',
  'sadness', 'sad', 'crying', 'cry',
  'anger', 'angry', 'rage', 'annoyed',
  'surprise', 'surprised', 'shocked',
  'fear', 'scared', 'terrified',
  'embarrassment', 'embarrassed', 'blush', 'blushing',
  'love', 'fond', 'affection',
  'disgust', 'disgusted',
  'confusion', 'confused', 'curiosity', 'curious'
];

const MAX_EXPRESSION_CANDIDATES = 35;

/**
 * Resolves active prompt configurations prioritizing metadata settings over legacy tracker data.
 */
function resolvePromptConfig(promptSettings, trackerData) {
  if (promptSettings && typeof promptSettings === 'object' && Object.keys(promptSettings).length > 0) {
    return promptSettings;
  }
  if (typeof window !== 'undefined' && window.RPGBridge?.currentPromptSettings) {
    return window.RPGBridge.currentPromptSettings;
  }
  return trackerData || {};
}

/**
 * Verifies if expression tracking is active for a character.
 * Falls back to chatMetadata configurations if properties are missing on the snapshot character.
 */
export function isCharacterExpressionActive(char) {
  if (!char || typeof char !== 'object') return false;
  if (char.activeInjection === false) return false;

  const ctx = (typeof window !== 'undefined' && window.SillyTavern?.getContext)
    ? window.SillyTavern.getContext()
    : null;
  const customMeta = ctx?.chatMetadata?.rpgCustomAvatars?.[char.id] || {};

  const isFolder = char.isFolder !== undefined ? Boolean(char.isFolder) : (customMeta.isFolder !== false);
  if (!isFolder) return false;

  const enableExpression = char.enableExpression !== undefined ? Boolean(char.enableExpression) : (customMeta.enableExpression === true);
  if (!enableExpression) return false;

  const available = (Array.isArray(char.availableSprites) && char.availableSprites.length > 0)
    ? char.availableSprites
    : (Array.isArray(customMeta.availableSprites) ? customMeta.availableSprites : []);

  if (available.length === 0) return false;
  return true;
}

/**
 * Builds static field definitions and guidelines prompt for active characters.
 */
export function buildStaticDefinitionsPrompt(trackerData) {
  const globalDefs = trackerData?.globalDefinitions || {};
  const lines = [];

  Object.entries(globalDefs).forEach(([key, guide]) => {
    if (guide && guide.trim() !== '') {
      let prefix = '';
      let fieldName = '';
      if (key.startsWith('status_')) {
        prefix = 'Status';
        fieldName = key.replace('status_', '');
      } else if (key.startsWith('profile_')) {
        prefix = 'Profile';
        fieldName = key.replace('profile_', '');
      } else if (key.startsWith('relation_')) {
        prefix = 'Relation';
        fieldName = key.replace('relation_', '');
      }

      if (prefix) {
        lines.push(`[${prefix}: ${fieldName}] Guide: ${guide.trim()}`);
      }
    }
  });

  if (lines.length === 0) return '';

  return `\n### RPG TRACKER - STATUS DEFINITIONS\n` +
    `The following parameters govern active characters. Interpret behaviors based on these guidelines:\n` +
    `${lines.join('\n')}\n`;
}

/**
 * Builds expression candidate rules prompt for active characters with expression tracking enabled.
 * Formats allowed emotion candidate tokens cleaned from available sprite filenames with token-budget capping.
 */
export function buildExpressionRulesPrompt(trackerData) {
  const characters = trackerData?.characters || [];
  const lines = [];

  const ctx = (typeof window !== 'undefined' && window.SillyTavern?.getContext)
    ? window.SillyTavern.getContext()
    : null;
  const customAvatars = ctx?.chatMetadata?.rpgCustomAvatars || {};

  characters.forEach(char => {
    if (!isCharacterExpressionActive(char)) return;

    const customMeta = customAvatars[char.id] || {};
    const available = (Array.isArray(char.availableSprites) && char.availableSprites.length > 0)
      ? char.availableSprites
      : (Array.isArray(customMeta.availableSprites) ? customMeta.availableSprites : []);

    const cleanLabels = available.map(s => {
      const raw = typeof s === 'string' ? s : (s.cleanLabel || s.label || s.fileName || s.name || '');
      return raw.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();
    }).filter(Boolean);

    if (cleanLabels.length > 0) {
      const uniqueLabels = Array.from(new Set(cleanLabels));

      uniqueLabels.sort((a, b) => {
        const aIndex = CORE_EMOTION_PRIORITIES.indexOf(a);
        const bIndex = CORE_EMOTION_PRIORITIES.indexOf(b);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      const cappedLabels = uniqueLabels.slice(0, MAX_EXPRESSION_CANDIDATES);
      lines.push(`- ${char.name}: MUST be one of [${cappedLabels.map(l => `"${l}"`).join(', ')}]`);
    }
  });

  if (lines.length === 0) return '';

  return `\n### CHARACTER EXPRESSION CONSTRAINTS\n` +
    `Characters with expression tracking update their facial sprite dynamically. When a character's emotion or mood changes, output an "expression" field matching one of their allowed values exactly:\n` +
    `${lines.join('\n')}\n`;
}

/**
 * Resolves master category switches from guidePrompts array.
 */
export function getMasterSwitches(guidePrompts = []) {
  const isEnabled = (id, def = true) => {
    const found = guidePrompts.find(g => g.id === id);
    return found ? found.enabled : def;
  };

  return {
    status: isEnabled('status', true),
    profile: isEnabled('profile', true),
    relations: isEnabled('relations', true),
    inventory: isEnabled('inventory', true),
    quests: isEnabled('quests', true),
    world_date: isEnabled('world_date', true),
    world_time: isEnabled('world_time', true),
    world_weather: isEnabled('world_weather', true),
    world_location: isEnabled('world_location', true),
    world_events: isEnabled('world_events', true)
  };
}

/**
 * Generates dynamic JSON delta schema example block for prompting.
 */
export function getDynamicSchemaExample(trackerData, forcePlayer = null, promptSettings = null) {
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);
  const guidePrompts = promptConfig.guidePrompts || trackerData?.guidePrompts || [];
  const characters = trackerData?.characters || [];
  const ms = getMasterSwitches(guidePrompts);

  const hasActivePlayer = forcePlayer !== null
    ? forcePlayer
    : characters.some(char => char.activeInjection !== false && char.activePlayer === true);

  const activeChar = characters.find(c => c.activeInjection !== false);
  const exampleCharName = activeChar?.name?.trim() || "Character Name";

  const charSchema = {};

  if (forcePlayer !== null) {
    charSchema.activePlayer = forcePlayer;
  }

  if (activeChar && isCharacterExpressionActive(activeChar)) {
    const ctx = (typeof window !== 'undefined' && window.SillyTavern?.getContext)
      ? window.SillyTavern.getContext()
      : null;
    const customMeta = ctx?.chatMetadata?.rpgCustomAvatars?.[activeChar.id] || {};
    const available = (Array.isArray(activeChar.availableSprites) && activeChar.availableSprites.length > 0)
      ? activeChar.availableSprites
      : (Array.isArray(customMeta.availableSprites) ? customMeta.availableSprites : []);

    const firstSprite = available[0];
    const rawLabel = typeof firstSprite === 'string' ? firstSprite : (firstSprite?.cleanLabel || firstSprite?.label || firstSprite?.fileName || 'joy');
    const sampleLabel = rawLabel.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase() || 'joy';
    charSchema.expression = sampleLabel;
  }

  if (ms.status) {
    charSchema.status = {
      "HP": 85,
      "Fatigue": 15
    };
  }

  if (ms.profile) {
    charSchema.profile = {
      "Appearance": "Slightly disheveled after the encounter"
    };
  }

  if (ms.relations) {
    charSchema.relations = {
      "Target Name": {
        "description": "Growing trust after fighting together",
        "metrics": { "Affection": 15 }
      }
    };
  }

  if (ms.inventory && hasActivePlayer) {
    charSchema.inventory = {
      "storage": {
        "Backpack": [
          { "name": "Health Potion", "quantity": 2 }
        ]
      }
    };
  }

  if (ms.quests && hasActivePlayer) {
    charSchema.quests = {
      "main": { "status": "COMPLETED" }
    };
  }

  const fullSchema = {
    [exampleCharName]: charSchema
  };

  const worldFields = {};
  if (ms.world_location) worldFields["location"] = "Tavern";
  if (ms.world_weather) worldFields["weather"] = "Rainy";
  if (ms.world_events) worldFields["events"] = [{ "name": "Festival Approaching", "desc": "Town prepares for celebrations." }];

  if (Object.keys(worldFields).length > 0) {
    fullSchema["World"] = worldFields;
  }

  return `\n<!--RPG_TRACKER\n\`\`\`json\n${JSON.stringify(fullSchema, null, 2)}\n\`\`\`\n-->\n`;
}

/**
 * Serializes active tracker state into structured JSON for LLM prompts.
 */
function serializeStatusState(trackerData, options = {}) {
  const { includePlaceholders = false, includeLockedFields = false, promptSettings = null } = options;
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);
  const characters = trackerData?.characters || [];
  const guidePrompts = promptConfig.guidePrompts || trackerData?.guidePrompts || [];
  const ms = getMasterSwitches(guidePrompts);
  const result = {};

  if (trackerData?.worldState) {
    const ws = trackerData.worldState;
    const wSchema = promptConfig.worldSchema || trackerData.worldSchema || {};
    const worldFields = {};

    const hasValue = (val) => val !== undefined && val !== null && String(val).trim() !== '';

    if (ms.world_date) {
      if (hasValue(ws.date)) worldFields.date = ws.date;
      else if (includePlaceholders) worldFields.date = `<new_value (format: ${wSchema.dateCustom || 'yyyy-mm-dd'})>`;
    }
    if (ms.world_time) {
      if (hasValue(ws.time)) worldFields.time = ws.time;
      else if (includePlaceholders) worldFields.time = `<new_value (format: ${wSchema.timeCustom || '14:30'})>`;
    }
    if (ms.world_weather) {
      if (hasValue(ws.weather)) worldFields.weather = ws.weather;
      else if (includePlaceholders) worldFields.weather = `<new_value (format: ${wSchema.weatherCustom || 'Clear/Cloudy...'})>`;
    }
    if (ms.world_location) {
      if (hasValue(ws.location)) worldFields.location = ws.location;
      else if (includePlaceholders) worldFields.location = `<new_value (format: ${wSchema.locationCustom || 'Current Location'})>`;
    }
    if (ms.world_events) {
      const eventsList = Array.isArray(ws.events) ? ws.events : [];
      if (eventsList.length > 0) {
        const validEvents = eventsList
          .map(e => typeof e === 'string' ? { desc: e } : { name: e.name || '', desc: e.desc || '' })
          .filter(e => (e.name && e.name.trim() !== '') || (e.desc && e.desc.trim() !== ''));

        if (validEvents.length > 0) worldFields.events = validEvents;
      } else if (includePlaceholders) {
        worldFields.events = [{ name: "<new_value (Event name)>", desc: "<new_value (Event description)>" }];
      }
    }

    if (Object.keys(worldFields).length > 0) {
      result["World"] = worldFields;
    }
  }

  const existingCharNames = characters
    .map(c => c.name?.trim().toLowerCase())
    .filter(Boolean);

  characters.forEach(char => {
    if (char.activeInjection === false) return;

    const charInfo = {};
    const lockedFields = [];

    if (isCharacterExpressionActive(char)) {
      let currentExp = char.selectedSprite || '';
      if (typeof currentExp === 'string') {
        currentExp = currentExp.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();
      }

      if (currentExp && currentExp !== 'default') {
        charInfo.expression = currentExp;
      } else if (includePlaceholders) {
        charInfo.expression = "<new_value (one of allowed expressions)>";
      }
    }

    if (ms.status && Array.isArray(char.statusSchema)) {
      const statusMap = char.status || {};
      const statusObj = {};

      char.statusSchema.forEach(schema => {
        if (schema.isInject === false) return;
        const val = statusMap[schema.id];
        const key = schema.name || schema.id;
        const hasVal = val !== undefined && val !== null && String(val).trim() !== '';

        if (hasVal) {
          statusObj[key] = val;
        } else if (includePlaceholders) {
          const minLimit = schema.min !== undefined ? schema.min : 0;
          const maxLimit = schema.max !== undefined ? schema.max : 100;
          statusObj[key] = `<new_value (type: ${schema.type || 'integer'}, min: ${minLimit}, max: ${maxLimit})>`;
        }

        if (includeLockedFields && schema.isLocked) {
          lockedFields.push(`status.${key}`);
        }
      });

      if (Object.keys(statusObj).length > 0) charInfo.status = statusObj;
    }

    if (ms.profile && char.profile) {
      const profileInjects = char.profileInjects || {};
      const profileLocks = char.profileLocks || {};
      const profileObj = {};

      Object.entries(char.profile).forEach(([k, v]) => {
        if (profileInjects[k] === false) return;
        const hasVal = v !== undefined && v !== null && String(v).trim() !== '';

        if (hasVal) {
          profileObj[k] = v;
        } else if (includePlaceholders) {
          profileObj[k] = `<new_value (Describe ${k})>`;
        }

        if (includeLockedFields && profileLocks[k]) {
          lockedFields.push(`profile.${k}`);
        }
      });

      if (Object.keys(profileObj).length > 0) charInfo.profile = profileObj;
    }

    if (ms.relations && char.relations) {
      const relationsObj = {};

      Object.entries(char.relations).forEach(([targetName, rData]) => {
        if (rData.isInject === false) return;

        const metrics = {};
        if (rData.values) {
          Object.entries(rData.values).forEach(([mName, mVal]) => {
            const isObj = typeof mVal === 'object' && mVal !== null;
            const val = isObj ? mVal.value : mVal;
            const hasVal = val !== undefined && val !== null && String(val).trim() !== '';

            if (hasVal) {
              metrics[mName] = val;
            } else if (includePlaceholders) {
              const minLimit = isObj && mVal.min !== undefined ? mVal.min : -100;
              const maxLimit = isObj && mVal.max !== undefined ? mVal.max : 100;
              metrics[mName] = `<new_value (min: ${minLimit}, max: ${maxLimit})>`;
            }
          });
        }

        const relEntry = {};
        if (Object.keys(metrics).length > 0) relEntry.metrics = metrics;

        if (rData.text && rData.text.trim() !== '') {
          relEntry.description = rData.text.trim();
        } else if (includePlaceholders) {
          relEntry.description = `<new_value (Emotions/impressions toward ${targetName})>`;
        }

        const isIndependentChar = existingCharNames.includes(targetName?.trim().toLowerCase());
        if (!isIndependentChar) {
          if (rData.targetText && rData.targetText.trim() !== '') {
            relEntry.targetDescription = rData.targetText.trim();
          } else if (includePlaceholders) {
            relEntry.targetDescription = `<new_value (How ${targetName} feels about this character)>`;
          }

          if (rData.targetValues) {
            const targetMetrics = {};
            Object.entries(rData.targetValues).forEach(([tmName, tmVal]) => {
              const isObj = typeof tmVal === 'object' && tmVal !== null;
              const val = isObj ? tmVal.value : tmVal;
              const hasVal = val !== undefined && val !== null && String(val).trim() !== '';

              if (hasVal) {
                targetMetrics[tmName] = val;
              } else if (includePlaceholders) {
                const minLimit = isObj && tmVal.min !== undefined ? tmVal.min : -100;
                const maxLimit = isObj && tmVal.max !== undefined ? tmVal.max : 100;
                targetMetrics[tmName] = `<new_value (min: ${minLimit}, max: ${maxLimit})>`;
              }
            });
            if (Object.keys(targetMetrics).length > 0) {
              relEntry.targetMetrics = targetMetrics;
            }
          }
        }

        if (includeLockedFields && rData.isLocked) {
          lockedFields.push(`relations.${targetName}`);
        }

        if (Object.keys(relEntry).length > 0) {
          relationsObj[targetName] = relEntry;
        }
      });

      if (Object.keys(relationsObj).length > 0) charInfo.relations = relationsObj;
    }

    if (char.activePlayer === true) {
      if (ms.inventory && char.inventory) {
        const inv = char.inventory;
        const invObj = {};

        if (inv.equipIsInject !== false && inv.equipment) {
          const equipObj = {};
          Object.entries(inv.equipment).forEach(([slot, item]) => {
            if (item && item.name && String(item.name).trim() !== '') {
              if (includePlaceholders) {
                const itemType = item.type || 'general';
                const base = { id: item.id, type: itemType, name: item.name };
                if (itemType === 'currency') {
                  base.quantity = item.quantity !== undefined ? item.quantity : 0;
                } else if (itemType === 'asset') {
                  base.assetValue = item.assetValue || { amount: 0, currencyName: "Gold" };
                  base.desc = item.desc || '';
                } else {
                  base.quantity = item.quantity !== undefined ? item.quantity : 1;
                  base.desc = item.desc || '';
                }
                if (item.isContainer) {
                  base.isContainer = true;
                  base.storageKey = item.storageKey;
                }
                equipObj[slot] = base;
              } else {
                const itemType = item.type || 'general';
                if (itemType === 'currency') {
                  equipObj[slot] = `${item.name} (${item.quantity !== undefined ? item.quantity : 0})`;
                } else if (itemType === 'asset') {
                  const amt = item.assetValue?.amount !== undefined ? item.assetValue.amount : 0;
                  const unit = item.assetValue?.currencyName || 'Gold';
                  equipObj[slot] = `${item.name} [Value: ${amt} ${unit}]`;
                } else {
                  const qty = item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : '';
                  equipObj[slot] = `${item.name}${qty}`;
                }
              }
            } else if (includePlaceholders) {
              equipObj[slot] = "Empty";
            }

            if (includeLockedFields && inv.equipmentLocks?.[slot] === true) {
              lockedFields.push(`inventory.equipment.${slot}`);
            }
          });

          if (Object.keys(equipObj).length > 0) invObj.equipment = equipObj;
          if (includeLockedFields && inv.equipIsLocked) lockedFields.push(`inventory.equipment`);
        }

        if (inv.storageIsInject !== false && inv.storage) {
          const storageObj = {};
          Object.entries(inv.storage).forEach(([container, items]) => {
            const itemList = Array.isArray(items) ? items : [];

            if (includePlaceholders) {
              storageObj[container] = itemList.map(i => {
                const itemType = i.type || 'general';
                const base = { id: i.id, type: itemType, name: i.name };
                if (itemType === 'currency') {
                  base.quantity = i.quantity || 0;
                } else if (itemType === 'asset') {
                  base.assetValue = i.assetValue || { amount: 0, currencyName: "Gold" };
                  base.desc = i.desc || '';
                } else {
                  base.quantity = i.quantity || 1;
                  base.desc = i.desc || '';
                }
                return base;
              });
            } else if (itemList.length > 0) {
              const validItems = itemList
                .filter(i => i && i.name && String(i.name).trim() !== '')
                .map(i => {
                  const itemType = i.type || 'general';
                  if (itemType === 'currency') {
                    return `${i.name} (${i.quantity !== undefined ? i.quantity : 0})`;
                  } else if (itemType === 'asset') {
                    const amt = i.assetValue?.amount !== undefined ? i.assetValue.amount : 0;
                    const unit = i.assetValue?.currencyName || 'Gold';
                    return `${i.name} [Value: ${amt} ${unit}]`;
                  } else {
                    const qty = i.quantity && i.quantity > 1 ? ` (x${i.quantity})` : '';
                    return `${i.name}${qty}`;
                  }
                });
              if (validItems.length > 0) storageObj[container] = validItems;
            }

            if (includeLockedFields && inv.storageLocks?.[container] === true) {
              lockedFields.push(`inventory.storage.${container}`);
            }
          });

          if (Object.keys(storageObj).length > 0) invObj.storage = storageObj;
          if (includeLockedFields && inv.storageIsLocked) lockedFields.push(`inventory.storage`);
        }

        if (Object.keys(invObj).length > 0) charInfo.inventory = invObj;
      }

      if (ms.quests && char.quests) {
        const q = char.quests;
        const qObj = {};

        if (includePlaceholders) {
          const mainName = q.main?.name?.trim();
          qObj.main = {
            name: mainName ? mainName : `<new_value (Active main quest name)>`,
            description: q.main?.desc?.trim() ? q.main.desc : `<new_value (Quest objective details)>`,
            status: mainName ? (q.main?.isCompleted ? 'COMPLETED' : 'ACTIVE') : `<new_value ("ACTIVE" or "COMPLETED")>`
          };
          if (includeLockedFields && q.main?.isLocked) lockedFields.push('quests.main');

          const sideQuestsList = (Array.isArray(q.sides) ? q.sides : []).filter(
            sq => sq && ((sq.name && sq.name.trim() !== '') || (sq.desc && sq.desc.trim() !== ''))
          );
          qObj.sideQuests = sideQuestsList.length > 0 ? sideQuestsList.map((sq, qIdx) => {
            if (includeLockedFields && sq.isLocked) lockedFields.push(`quests.sideQuests.${qIdx}`);
            return {
              name: sq.name,
              description: sq.desc || '',
              status: sq.isCompleted ? 'COMPLETED' : 'ACTIVE'
            };
          }) : [
            {
              name: `<new_value (Side quest name)>`,
              description: `<new_value (Side quest details)>`,
              status: `<new_value ("ACTIVE" or "COMPLETED")>`
            }
          ];
        } else {
          if (q.main && q.main.name && q.main.name.trim() !== '') {
            qObj.main = `${q.main.name} (${q.main.isCompleted ? 'COMPLETED' : 'ACTIVE'})`;
          }
          if (Array.isArray(q.sides) && q.sides.length > 0) {
            const validSides = q.sides
              .filter(s => s && s.name && s.name.trim() !== '')
              .map(s => `${s.name} (${s.isCompleted ? 'COMPLETED' : 'ACTIVE'})`);
            if (validSides.length > 0) qObj.sideQuests = validSides;
          }
        }

        if (Object.keys(qObj).length > 0) charInfo.quests = qObj;
      }
    }

    if (includeLockedFields && lockedFields.length > 0) {
      charInfo._lockedFields = lockedFields;
    }

    if (Object.keys(charInfo).length > 0) {
      result[char.name] = charInfo;
    }
  });

  return result;
}

/**
 * Builds baseline status reference JSON string with delta placeholders.
 */
export function buildDynamicValuesPrompt(trackerData, options = {}) {
  const activeData = serializeStatusState(trackerData, { ...options, includePlaceholders: true, includeLockedFields: true });
  if (Object.keys(activeData).length === 0) return '';
  return `\n[BASELINE RPG STATUS REFERENCE (COMPARE AGAINST RECENT CHAT)]\n\`\`\`json\n${JSON.stringify(activeData, null, 2)}\n\`\`\`\n`;
}

/**
 * Builds clean status JSON string without delta placeholders or locked fields.
 */
export function buildCleanStatusPrompt(trackerData, options = {}) {
  const cleanData = serializeStatusState(trackerData, { ...options, includePlaceholders: false, includeLockedFields: false });
  if (Object.keys(cleanData).length === 0) return '';
  return `\n[CURRENT RPG STATUS CONTEXT]\n\`\`\`json\n${JSON.stringify(cleanData, null, 2)}\n\`\`\`\n`;
}

/**
 * Builds active add-on guidelines section.
 */
export function buildAddonSection(trackerData, promptSettings = null) {
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);
  const activeAddons = [];
  const addons = promptConfig.addons || trackerData?.addons || {};

  if (addons.worldEvents) {
    const worldEventsText = promptConfig.worldEventsPrompt !== undefined
      ? promptConfig.worldEventsPrompt
      : DEFAULT_WORLD_EVENTS_PROMPT;
    if (worldEventsText && worldEventsText.trim() !== '') activeAddons.push(`- ${worldEventsText.trim()}`);
  }
  if (addons.weather) {
    const weatherText = promptConfig.weatherPrompt !== undefined
      ? promptConfig.weatherPrompt
      : DEFAULT_WEATHER_PROMPT;
    if (weatherText && weatherText.trim() !== '') activeAddons.push(`- ${weatherText.trim()}`);
  }
  if (addons.cyoa) {
    const cyoaText = promptConfig.cyoaPrompt !== undefined
      ? promptConfig.cyoaPrompt
      : DEFAULT_CYOA_PROMPT;
    if (cyoaText && cyoaText.trim() !== '') activeAddons.push(`- ${cyoaText.trim()}`);
  }

  return activeAddons.length > 0
    ? `\n### SPECIAL INSTRUCTIONS / ACTIVE ADD-ONS\n${activeAddons.join('\n')}\n`
    : '';
}

/**
 * Builds update instructions section based on active master switches.
 */
export function buildGuidePromptsSection(trackerData, promptSettings = null) {
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);
  const guidePromptsData = promptConfig.guidePrompts || trackerData?.guidePrompts || [];
  const activeGuides = guidePromptsData
    .filter(g => g.enabled && g.prompt && g.prompt.trim() !== '')
    .map(g => `- ${g.prompt.trim()}`);

  return activeGuides.length > 0
    ? `\n### STATUS UPDATE INSTRUCTIONS\n${activeGuides.join('\n')}\n`
    : '';
}

/**
 * Module 1: Builds System Rules, Schema Example, Guide Prompts, Expression Rules, and Definitions.
 */
export function buildRulesDefsModule(trackerData, updateMode = 'merged', forcePlayer = null, promptSettings = null) {
  if (updateMode === 'isolated') {
    return '';
  }

  const promptConfig = resolvePromptConfig(promptSettings, trackerData);

  if (updateMode === 'separated') {
    const readOnlyHeader = promptConfig.systemPrompt_readonly !== undefined
      ? promptConfig.systemPrompt_readonly
      : DEFAULT_READONLY_CONTEXT_HEADER;
    const staticDefs = buildStaticDefinitionsPrompt(trackerData);

    return [readOnlyHeader, staticDefs]
      .filter(part => part && part.trim() !== '')
      .join('\n\n');
  }

  const header = promptConfig.systemPromptHeader_merged !== undefined
    ? promptConfig.systemPromptHeader_merged
    : DEFAULT_PROMPT_HEADER_MERGED;
  const schemaExample = getDynamicSchemaExample(trackerData, forcePlayer, promptConfig);
  const guideSection = buildGuidePromptsSection(trackerData, promptConfig);
  const expressionRules = buildExpressionRulesPrompt(trackerData);
  const footer = promptConfig.systemPromptFooter_merged !== undefined
    ? promptConfig.systemPromptFooter_merged
    : DEFAULT_PROMPT_FOOTER_MERGED;
  const staticDefs = buildStaticDefinitionsPrompt(trackerData);

  return [header, schemaExample, guideSection, expressionRules, footer, staticDefs]
    .filter(part => part && part.trim() !== '')
    .join('\n\n');
}

/**
 * Module 2: Builds Status Reference JSON block.
 */
export function buildStatusModule(trackerData, updateMode = 'merged', promptSettings = null) {
  if (updateMode === 'isolated') {
    return '';
  }

  const promptConfig = resolvePromptConfig(promptSettings, trackerData);

  if (updateMode === 'separated') {
    return buildCleanStatusPrompt(trackerData, { promptSettings: promptConfig });
  }

  return buildDynamicValuesPrompt(trackerData, { promptSettings: promptConfig });
}

/**
 * Module 3: Builds Add-ons and Output Format Enforcer.
 */
export function buildAddonsEnforcerModule(trackerData, updateMode = 'merged', promptSettings = null) {
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);
  const addonSection = buildAddonSection(trackerData, promptConfig);

  if (updateMode === 'separated' || updateMode === 'isolated') {
    return addonSection.trim();
  }

  const enforcer = promptConfig.outputEnforcerPrompt !== undefined
    ? promptConfig.outputEnforcerPrompt
    : DEFAULT_OUTPUT_ENFORCER;

  return [addonSection, enforcer]
    .filter(part => part && part.trim() !== '')
    .join('\n\n');
}

/**
 * Modular orchestrator returning all 3 decoupled prompt sections as a keyed object.
 */
export function buildModularPrompts(trackerData, updateMode = 'merged', options = {}) {
  const { forcePlayer = null, promptSettings = null } = options;
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);

  return {
    rules_defs: buildRulesDefsModule(trackerData, updateMode, forcePlayer, promptConfig),
    status: buildStatusModule(trackerData, updateMode, promptConfig),
    addons_enforcer: buildAddonsEnforcerModule(trackerData, updateMode, promptConfig)
  };
}

/**
 * Builds standalone update prompt specifically for quiet prompt manual updates and character generation.
 */
export function buildUpdatePromptWrapper(trackerData, headerPrompt = '', footerPrompt = '', forcePlayer = null, promptSettings = null) {
  const promptConfig = resolvePromptConfig(promptSettings, trackerData);
  const staticDefs = buildStaticDefinitionsPrompt(trackerData) || '';
  const expressionRules = buildExpressionRulesPrompt(trackerData) || '';
  const schemaExample = getDynamicSchemaExample(trackerData, forcePlayer, promptConfig) || '';
  const statusReference = buildDynamicValuesPrompt(trackerData, { promptSettings: promptConfig }) || '';
  const guideSection = buildGuidePromptsSection(trackerData, promptConfig);
  const customEnforcer = promptConfig.outputEnforcerPrompt;
  const enforcer = (
    typeof customEnforcer === 'string' &&
    customEnforcer.trim() !== '' &&
    customEnforcer.trim() !== DEFAULT_OUTPUT_ENFORCER.trim()
  )
    ? customEnforcer
    : DEFAULT_OUTPUT_ENFORCER_SEP;

  return [
    headerPrompt,
    schemaExample,
    statusReference,
    guideSection,
    expressionRules,
    footerPrompt,
    staticDefs,
    enforcer
  ].filter(part => part && part.trim() !== '').join('\n\n');
}