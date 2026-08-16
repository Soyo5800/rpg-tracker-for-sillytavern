import {
  DEFAULT_CYOA_PROMPT,
  DEFAULT_WEATHER_PROMPT,
  DEFAULT_WORLD_EVENTS_PROMPT
} from './PromptSchema.js';

export function buildStaticDefinitionsPrompt(trackerData) {
  const globalDefs = trackerData.globalDefinitions || {};
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

export function getDynamicSchemaExample(trackerData, forcePlayer = null) {
  const guidePrompts = trackerData.guidePrompts || [];
  const characters = trackerData.characters || [];
  const ms = getMasterSwitches(guidePrompts);

  const hasActivePlayer = forcePlayer !== null
    ? forcePlayer
    : characters.some(char => char.isActive !== false && char.activeInjection !== false && char.activePlayer === true);

  const charSchema = {};

  if (forcePlayer !== null) {
    charSchema.activePlayer = forcePlayer;
  }

  if (ms.status) {
    charSchema.status = {
      "Status_Name_1": "new_value (type: consumable, min: 0, max: 100. e.g. HP - reduce on damage, increase on rest)",
      "Status_Name_2": "new_value (type: stacking, min: 0, max: 100. e.g. Fatigue - increase on strenuous actions)",
      "Status_Name_3": "new_value (type: integer, min: 0, max: 100. e.g. Strength, Agility, Intelligence)",
      "Status_Name_4": "new_value (type: text. extremely short current condition)"
    };
  }

  if (ms.profile) {
    charSchema.profile = { "Profile_Key": "new_value (type: text. strictly for non-numerical descriptions e.g. Race, Appearance, Personality. NEVER put numerical status parameters here)" };
  }

  if (ms.relations) {
    charSchema.relations = {
      "Target Name": {
        "description": "Brief summary of emotions/impressions toward Target Name",
        "metrics": { "Metric_Name": "new_value (type: integer. adjust dynamically by -15 to +15 based on interaction)" },
        "targetDescription": "Brief summary of how Target Name feels about this character (use ONLY for minor/one-time NPCs with no separate card)",
        "targetMetrics": { "Metric_Name": "new_value (type: integer. adjust dynamically by -15 to +15)" }
      }
    };
  }

  if (ms.inventory && hasActivePlayer) {
    charSchema.inventory = {
      "equipment": {
        "Slot": { "id": "item_id", "type": "general", "name": "Item Name", "desc": "Description" },
        "Back": { "id": "container_backpack", "type": "general", "name": "Leather Backpack", "isContainer": true, "storageKey": "Backpack" }
      },
      "storage": {
        "Container": [
          { "id": "item_id", "type": "general", "name": "Health Potion", "quantity": 5, "desc": "Restores 50 HP" },
          { "id": "item_id", "type": "currency", "name": "Gold", "quantity": 150 },
          { "id": "item_id", "type": "asset", "name": "Small Cabin", "assetValue": { "amount": 1200, "currencyName": "Gold" }, "desc": "A quiet wooden house" }
        ]
      }
    };
  }

  if (ms.quests && hasActivePlayer) {
    charSchema.quests = {
      "main": { "name": "Quest Name", "description": "Details", "status": "ACTIVE (or COMPLETED)" },
      "sideQuests": [{ "name": "Side Quest", "description": "Details", "status": "ACTIVE (or COMPLETED)" }]
    };
  }

  const exampleCharName = "Character Name";

  const fullSchema = {
    [exampleCharName]: charSchema
  };

  const worldFields = {};
  const wSchema = trackerData.worldSchema || {};

  if (ms.world_date) worldFields["date"] = wSchema.dateCustom || "yyyy-mm-dd";
  if (ms.world_time) worldFields["time"] = wSchema.timeCustom || "14:30";
  if (ms.world_weather) worldFields["weather"] = wSchema.weatherCustom || "Clear/Cloudy...";
  if (ms.world_location) worldFields["location"] = wSchema.locationCustom || "Current Location";
  if (ms.world_events) worldFields["events"] = [{ "name": "Event Name", "desc": "Details" }];

  if (Object.keys(worldFields).length > 0) {
    fullSchema["World"] = worldFields;
  }

  return `\n<!--RPG_TRACKER\n\`\`\`json\n${JSON.stringify(fullSchema, null, 2)}\n\`\`\`\n-->\n`;
}

export function buildDynamicValuesPrompt(trackerData) {
  const characters = trackerData.characters || [];
  const ms = getMasterSwitches(trackerData.guidePrompts || []);
  const activeData = {};

  const worldFields = {};
  if (trackerData.worldState) {
    const ws = trackerData.worldState;
    const wSchema = trackerData.worldSchema || {};
    if (ms.world_date) {
      worldFields["date"] = (ws.date && String(ws.date).trim() !== '')
        ? ws.date
        : `<new_value (type: text. format: ${wSchema.dateCustom || 'yyyy-mm-dd'})>`;
    }
    if (ms.world_time) {
      worldFields["time"] = (ws.time && String(ws.time).trim() !== '')
        ? ws.time
        : `<new_value (type: text. format: ${wSchema.timeCustom || '14:30'})>`;
    }
    if (ms.world_weather) {
      worldFields["weather"] = (ws.weather && String(ws.weather).trim() !== '')
        ? ws.weather
        : `<new_value (type: text. format: ${wSchema.weatherCustom || 'Clear/Cloudy...'})>`;
    }
    if (ms.world_location) {
      worldFields["location"] = (ws.location && String(ws.location).trim() !== '')
        ? ws.location
        : `<new_value (type: text. format: ${wSchema.locationCustom || 'Current Location'})>`;
    }
    if (ms.world_events) {
      const eventsList = Array.isArray(ws.events) ? ws.events : [];
      if (eventsList.length > 0) {
        worldFields["events"] = eventsList.map(e => typeof e === 'string' ? { name: '', desc: e } : { name: e.name || '', desc: e.desc || '' });
      } else {
        worldFields["events"] = [
          { name: "<new_value (type: text. Event name)>", desc: "<new_value (type: text. Event description)>" }
        ];
      }
    }
  }

  if (Object.keys(worldFields).length > 0) {
    activeData["World"] = worldFields;
  }

  const existingCharNames = characters.map(c => c.name?.trim());

  characters.forEach((char) => {
    if (char.isActive !== false && char.activeInjection !== false) {
      const charInfo = {};
      const lockedFields = [];

      if (ms.status) {
        const schemas = char.statusSchema || [];
        const statusMap = char.status || {};
        const statusObj = {};

        schemas.forEach((schema) => {
          if (schema.isInject !== false) {
            const value = statusMap[schema.id];
            const key = schema.name || schema.id;

            if (value !== undefined && value !== null && String(value).trim() !== '') {
              statusObj[key] = value;
            } else {
              const minLimit = schema.min !== undefined ? schema.min : 0;
              const maxLimit = schema.max !== undefined ? schema.max : 100;
              statusObj[key] = `<new_value (type: ${schema.type || 'integer'}, min: ${minLimit}, max: ${maxLimit})>`;
            }

            if (schema.isLocked) lockedFields.push(`status.${key}`);
          }
        });
        if (Object.keys(statusObj).length > 0) {
          charInfo.status = statusObj;
        }
      }

      if (ms.profile) {
        const profile = char.profile || {};
        const profileInjects = char.profileInjects || {};
        const profileLocks = char.profileLocks || {};
        const profileObj = {};

        Object.keys(profile).forEach(key => {
          if (profileInjects[key] !== false) {
            const value = profile[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              profileObj[key] = value;
            } else {
              profileObj[key] = `<new_value (type: text. Describe ${key})>`;
            }
            if (profileLocks[key]) lockedFields.push(`profile.${key}`);
          }
        });
        if (Object.keys(profileObj).length > 0) {
          charInfo.profile = profileObj;
        }
      }

      if (ms.relations) {
        const relations = char.relations || {};
        const relationsObj = {};

        Object.entries(relations).forEach(([targetName, rData]) => {
          if (rData.isInject !== false) {
            const metrics = {};
            if (rData.values) {
              Object.entries(rData.values).forEach(([mName, mVal]) => {
                const isObj = typeof mVal === 'object' && mVal !== null;
                const val = isObj ? mVal.value : mVal;
                const minLimit = isObj && mVal.min !== undefined ? mVal.min : -100;
                const maxLimit = isObj && mVal.max !== undefined ? mVal.max : 100;

                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  metrics[mName] = val;
                } else {
                  metrics[mName] = `<new_value (type: integer, min: ${minLimit}, max: ${maxLimit})>`;
                }
              });
            }

            relationsObj[targetName] = {
              metrics,
              description: (rData.text && rData.text.trim() !== '')
                ? rData.text
                : `<new_value (type: text. Emotions/impressions toward ${targetName})>`
            };

            if (!existingCharNames.includes(targetName?.trim())) {
              relationsObj[targetName].targetDescription = (rData.targetText && rData.targetText.trim() !== '')
                ? rData.targetText
                : `<new_value (type: text. How ${targetName} feels about this character)>`;

              if (rData.targetValues) {
                const targetMetrics = {};
                Object.entries(rData.targetValues).forEach(([tmName, tmVal]) => {
                  const isObj = typeof tmVal === 'object' && tmVal !== null;
                  const val = isObj ? tmVal.value : tmVal;
                  const minLimit = isObj && tmVal.min !== undefined ? tmVal.min : -100;
                  const maxLimit = isObj && tmVal.max !== undefined ? tmVal.max : 100;

                  if (val !== undefined && val !== null && String(val).trim() !== '') {
                    targetMetrics[tmName] = val;
                  } else {
                    targetMetrics[tmName] = `<new_value (type: integer, min: ${minLimit}, max: ${maxLimit})>`;
                  }
                });
                if (Object.keys(targetMetrics).length > 0) {
                  relationsObj[targetName].targetMetrics = targetMetrics;
                }
              }
            }

            if (rData.isLocked) lockedFields.push(`relations.${targetName}`);
          }
        });
        if (Object.keys(relationsObj).length > 0) {
          charInfo.relations = relationsObj;
        }
      }

      if (char.activePlayer === true) {
        if (ms.inventory && char.inventory) {
          const inv = char.inventory;
          const invObj = {};

          if (inv.equipIsInject !== false) {
            const equipObj = {};
            Object.entries(inv.equipment || {}).forEach(([slot, item]) => {
              if (item && item.name && String(item.name).trim() !== '') {
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
                equipObj[slot] = "Empty";
              }
              if (inv.equipmentLocks?.[slot] === true) {
                lockedFields.push(`inventory.equipment.${slot}`);
              }
            });
            invObj.equipment = equipObj;
            if (inv.equipIsLocked) lockedFields.push(`inventory.equipment`);
          }

          if (inv.storageIsInject !== false) {
            const storageObj = {};
            Object.entries(inv.storage || {}).forEach(([container, items]) => {
              const itemList = Array.isArray(items) ? items : [];
              if (itemList.length > 0) {
                storageObj[container] = itemList.map(i => {
                  const itemType = i.type || 'general';
                  const base = { id: i.id, type: i.type || 'general', name: i.name };

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
              } else {
                storageObj[container] = [];
              }

              if (inv.storageLocks?.[container] === true) {
                lockedFields.push(`inventory.storage.${container}`);
              }
            });
            invObj.storage = storageObj;
            if (inv.storageIsLocked) lockedFields.push(`inventory.storage`);
          }

          if (Object.keys(invObj).length > 0) {
            charInfo.inventory = invObj;
          }
        }

        if (ms.quests && char.quests) {
          const q = char.quests;
          const qObj = {};

          const mainName = q.main?.name?.trim();
          qObj.main = {
            name: mainName ? mainName : `<new_value (type: text. Active main quest name)>`,
            description: q.main?.desc?.trim() ? q.main.desc : `<new_value (type: text. Quest details)>`,
            status: mainName ? (q.main?.isCompleted ? 'COMPLETED' : 'ACTIVE') : `<new_value (type: text. "ACTIVE" or "COMPLETED")>`
          };
          if (q.main?.isLocked) lockedFields.push('quests.main');

          const sideQuestsList = Array.isArray(q.sides) ? q.sides : [];
          qObj.sideQuests = sideQuestsList.length > 0 ? sideQuestsList.map((sq, qIdx) => {
            if (sq.isLocked) lockedFields.push(`quests.sideQuests.${qIdx}`);
            return {
              name: sq.name,
              description: sq.desc || '',
              status: sq.isCompleted ? 'COMPLETED' : 'ACTIVE'
            };
          }) : [
            {
              name: `<new_value (type: text. Side quest name)>`,
              description: `<new_value (type: text. Side quest details)>`,
              status: `<new_value (type: text. "ACTIVE" or "COMPLETED")>`
            }
          ];

          charInfo.quests = qObj;
        }
      }

      if (lockedFields.length > 0) {
        charInfo._lockedFields = lockedFields;
      }

      if (Object.keys(charInfo).length > 0) {
        activeData[char.name] = charInfo;
      }
    }
  });

  if (Object.keys(activeData).length === 0) return '';

  return `\n[CURRENT RPG STATUS REFERENCE]\n\`\`\`json\n${JSON.stringify(activeData, null, 2)}\n\`\`\`\n`;
}

export function buildCleanStatusPrompt(trackerData) {
  const characters = trackerData.characters || [];
  const ms = getMasterSwitches(trackerData.guidePrompts || []);
  const cleanData = {};

  if (trackerData.worldState) {
    const ws = trackerData.worldState;
    const worldFields = {};
    if (ms.world_date && ws.date && String(ws.date).trim() !== '') worldFields.date = ws.date;
    if (ms.world_time && ws.time && String(ws.time).trim() !== '') worldFields.time = ws.time;
    if (ms.world_weather && ws.weather && String(ws.weather).trim() !== '') worldFields.weather = ws.weather;
    if (ms.world_location && ws.location && String(ws.location).trim() !== '') worldFields.location = ws.location;
    if (ms.world_events && Array.isArray(ws.events) && ws.events.length > 0) {
      const validEvents = ws.events
        .map(e => typeof e === 'string' ? { desc: e } : { name: e.name || '', desc: e.desc || '' })
        .filter(e => (e.name && e.name.trim() !== '') || (e.desc && e.desc.trim() !== ''));
      if (validEvents.length > 0) worldFields.events = validEvents;
    }
    if (Object.keys(worldFields).length > 0) {
      cleanData["World"] = worldFields;
    }
  }

  characters.forEach(char => {
    if (char.isActive !== false && char.activeInjection !== false) {
      const charInfo = {};

      if (ms.status && Array.isArray(char.statusSchema)) {
        const statusMap = char.status || {};
        const statusObj = {};
        char.statusSchema.forEach(schema => {
          if (schema.isInject !== false) {
            const val = statusMap[schema.id];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              statusObj[schema.name || schema.id] = val;
            }
          }
        });
        if (Object.keys(statusObj).length > 0) charInfo.status = statusObj;
      }

      if (ms.profile && char.profile) {
        const profileInjects = char.profileInjects || {};
        const profileObj = {};
        Object.entries(char.profile).forEach(([k, v]) => {
          if (profileInjects[k] !== false && v !== undefined && v !== null && String(v).trim() !== '') {
            profileObj[k] = v;
          }
        });
        if (Object.keys(profileObj).length > 0) charInfo.profile = profileObj;
      }

      if (ms.relations && char.relations) {
        const relationsObj = {};
        Object.entries(char.relations).forEach(([targetName, rData]) => {
          if (rData.isInject !== false) {
            const metrics = {};
            if (rData.values) {
              Object.entries(rData.values).forEach(([mName, mVal]) => {
                const val = typeof mVal === 'object' && mVal !== null ? mVal.value : mVal;
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  metrics[mName] = val;
                }
              });
            }
            const relEntry = {};
            if (Object.keys(metrics).length > 0) relEntry.metrics = metrics;
            if (rData.text && rData.text.trim() !== '') relEntry.description = rData.text.trim();

            if (Object.keys(relEntry).length > 0) {
              relationsObj[targetName] = relEntry;
            }
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
                const qty = item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : '';
                equipObj[slot] = `${item.name}${qty}`;
              }
            });
            if (Object.keys(equipObj).length > 0) invObj.equipment = equipObj;
          }
          if (inv.storageIsInject !== false && inv.storage) {
            const storageObj = {};
            Object.entries(inv.storage).forEach(([box, items]) => {
              if (Array.isArray(items) && items.length > 0) {
                const validItems = items.filter(i => i && i.name && String(i.name).trim() !== '').map(i => {
                  const qty = i.quantity && i.quantity > 1 ? ` (x${i.quantity})` : '';
                  return `${i.name}${qty}`;
                });
                if (validItems.length > 0) storageObj[box] = validItems;
              }
            });
            if (Object.keys(storageObj).length > 0) invObj.storage = storageObj;
          }
          if (Object.keys(invObj).length > 0) charInfo.inventory = invObj;
        }

        if (ms.quests && char.quests) {
          const q = char.quests;
          const qObj = {};
          if (q.main && q.main.name && q.main.name.trim() !== '') {
            qObj.main = `${q.main.name} (${q.main.isCompleted ? 'COMPLETED' : 'ACTIVE'})`;
          }
          if (Array.isArray(q.sides) && q.sides.length > 0) {
            const validSides = q.sides.filter(s => s && s.name && s.name.trim() !== '').map(s => `${s.name} (${s.isCompleted ? 'COMPLETED' : 'ACTIVE'})`);
            if (validSides.length > 0) qObj.sideQuests = validSides;
          }
          if (Object.keys(qObj).length > 0) charInfo.quests = qObj;
        }
      }

      if (Object.keys(charInfo).length > 0) {
        cleanData[char.name] = charInfo;
      }
    }
  });

  if (Object.keys(cleanData).length === 0) return '';
  return `\n[CURRENT RPG STATUS]\n\`\`\`json\n${JSON.stringify(cleanData, null, 2)}\n\`\`\`\n`;
}

export function buildAddonSection(trackerData) {
  const activeAddons = [];
  const addons = trackerData.addons || {};

  if (addons.worldEvents) {
    const worldEventsText = trackerData.worldEventsPrompt !== undefined ? trackerData.worldEventsPrompt : DEFAULT_WORLD_EVENTS_PROMPT;
    if (worldEventsText && worldEventsText.trim() !== '') activeAddons.push(`- ${worldEventsText.trim()}`);
  }
  if (addons.weather) {
    const weatherText = trackerData.weatherPrompt !== undefined ? trackerData.weatherPrompt : DEFAULT_WEATHER_PROMPT;
    if (weatherText && weatherText.trim() !== '') activeAddons.push(`- ${weatherText.trim()}`);
  }
  if (addons.cyoa) {
    const cyoaText = trackerData.cyoaPrompt !== undefined ? trackerData.cyoaPrompt : DEFAULT_CYOA_PROMPT;
    if (cyoaText && cyoaText.trim() !== '') activeAddons.push(`- ${cyoaText.trim()}`);
  }

  return activeAddons.length > 0
    ? `\n### SPECIAL INSTRUCTIONS / ACTIVE ADD-ONS\n${activeAddons.join('\n')}\n`
    : '';
}

export function buildGuidePromptsSection(trackerData) {
  const guidePromptsData = trackerData.guidePrompts || [];
  const activeGuides = guidePromptsData
    .filter(g => g.enabled && g.prompt && g.prompt.trim() !== '')
    .map(g => `- ${g.prompt.trim()}`);

  return activeGuides.length > 0
    ? `\n### STATUS UPDATE INSTRUCTIONS\n${activeGuides.join('\n')}\n`
    : '';
}

export function buildDefinitionPromptWrapper(trackerData, headerPrompt = '', footerPrompt = '', forcePlayer = null) {
  const staticDefs = buildStaticDefinitionsPrompt(trackerData) || '';
  const schemaExample = getDynamicSchemaExample(trackerData, forcePlayer) || '';
  const statusReference = buildDynamicValuesPrompt(trackerData) || '';
  const guideSection = buildGuidePromptsSection(trackerData);
  const addonSection = buildAddonSection(trackerData);

  const finalPrompt = [
    headerPrompt,
    schemaExample,
    statusReference,
    guideSection,
    footerPrompt,
    addonSection,
    staticDefs
  ].filter(part => part && part.trim() !== '').join('\n');

  return finalPrompt;
}

export function buildUpdatePromptWrapper(trackerData, headerPrompt = '', footerPrompt = '', forcePlayer = null) {
  const staticDefs = buildStaticDefinitionsPrompt(trackerData) || '';
  const schemaExample = getDynamicSchemaExample(trackerData, forcePlayer) || '';
  const statusReference = buildDynamicValuesPrompt(trackerData) || '';
  const guideSection = buildGuidePromptsSection(trackerData);

  const finalPrompt = [
    headerPrompt,
    schemaExample,
    statusReference,
    guideSection,
    footerPrompt,
    staticDefs
  ].filter(part => part && part.trim() !== '').join('\n');

  return finalPrompt;
}

export function buildStatusPromptWrapper(trackerData) {
  return buildDynamicValuesPrompt(trackerData);
}