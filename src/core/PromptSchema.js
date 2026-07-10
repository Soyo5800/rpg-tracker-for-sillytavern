// src/core/PromptSchema.js

export const DEFAULT_STATUS_SCHEMAS = [
  { id: 'HP', name: 'HP', type: 'consumable', min: 0, max: 100, color: '#e74c3c', isLocked: false, isInject: true },
  { id: 'Fatigue', name: 'Fatigue', type: 'stacking', min: 0, max: 100, color: '#f39c12', isLocked: false, isInject: true },
  { id: 'Lv', name: 'Lv', type: 'integer', min: 1, max: 100, isLocked: false, isInject: true },
  { id: 'Condition', name: 'Condition', type: 'text', isLocked: false, isInject: true }
];

export const DEFAULT_STATUS = { HP: 100, Fatigue: 0, Lv: 1, Condition: '' };

export const DEFAULT_WORLD_STATE = {
  date: '',
  time: '',
  location: '',
  weather: '',
  events: []
};

export const DEFAULT_WORLD_SCHEMA = {
  dateSelect: '1',
  dateCustom: 'yyyy-mm-dd',
  timeSelect: '1',
  timeCustom: '14:30',
  weatherSelect: '1',
  weatherCustom: 'Clear/Cloudy/Rain/Snow',
  locationCustom: 'Current Location',
  relationsFieldType: 'integer'
};

export const DEFAULT_GUIDE_PROMPTS = [
  { id: 'status', name: 'Update Status', prompt: 'Update active status parameters based on action outcomes, damage taken, or roleplay events in the chat.', enabled: true },
  { id: 'profile', name: 'Update Profile', prompt: 'Dynamically generate, update, or remove unlocked profile fields and parameters based on character cards, user persona, or chat context.', enabled: true },
  { id: 'relations', name: 'Update Relations', prompt: 'Reflect the latest changes in emotions, relationship metrics, and impressions. If the target is a minor/one-time NPC (no separate character card exists), you can also update "targetDescription" (how they feel about this character) and "targetMetrics" (their metrics toward this character) directly within this relation.', enabled: true },
  { id: 'inventory', name: 'Update Inventory', prompt: 'If any items or equipment are acquired or lost, update the inventory and storage accordingly.', enabled: true },
  { id: 'quests', name: 'Update Quests', prompt: 'If there is progress or a change in ongoing quests, update the quest list. Use status "ACTIVE" or "COMPLETED" to reflect progress.', enabled: true },
  { id: 'world_date', name: 'Update Date', prompt: 'Update world date.', enabled: true },
  { id: 'world_time', name: 'Update Time', prompt: 'Update world time.', enabled: true },
  { id: 'world_weather', name: 'Update Weather', prompt: 'Update world weather.', enabled: true },
  { id: 'world_location', name: 'Update Location', prompt: 'Update world location.', enabled: true },
  { id: 'world_events', name: 'Update Events', prompt: 'Update world events. Keep event names consistent to modify or update ongoing situations instead of duplicating them.', enabled: true }
];

export const getDefaultCharacters = () => {
  return [
    {
      id: 'char_user',
      name: 'New',
      activePlayer: true,
      activeInjection: true,
      statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
      status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
      profile: { Race: '', Height: '', Appearance: '' },
      profileLocks: { Race: false, Height: false, Appearance: false },
      inventory: {
        equipIsLocked: false,
        equipIsInject: true,
        storageIsLocked: false,
        storageIsInject: true,
        equipmentLocks: {},
        storageLocks: {},
        equipment: { 'Right Hand': null, 'Left Hand': null },
        storage: { 'Backpack': [] }
      },
      quests: {
        main: { name: '', desc: '' },
        sides: []
      },
      relations: {
        'Target Example': {
          text: '',
          isLocked: false,
          isInject: true,
          values: { 'Affection': { value: 0, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' } }
        }
      }
    }
  ];
};

export const DEFAULT_ADD_CHAR_PROMPT = `Based on the chat log, create a profile for the character.
CRITICAL CONSTRAINT: You MUST separate numerical status parameters and text-based descriptive profile features.
1. 'status': Put ALL numeric/integer status parameters and variables used for rolls, mechanics, or tests (e.g., Strength, Agility, Level, etc.) inside the 'status' object. Formatted as "value (type: integer, min: 0, max: 100)".
2. 'profile': Keep 'profile' EXCLUSIVELY for text-based, non-numerical descriptions (e.g., Race, Gender, Height, Appearance, Personality, Background). Do NOT put any numeric/integer status parameters here.
Create suitable status, profile features, and relations (including 'targetDescription' to define what the target thinks about this character) that fit their role. Return the result as a JSON block wrapped in an HTML comment with the identifier RPG_TRACKER. Omit inventory and quests unless necessary.`;

export const DEFAULT_ADD_PLAYER_CHAR_PROMPT = `Based on the chat log, create a profile for the player character.
CRITICAL CONSTRAINT: You MUST separate numerical status parameters and text-based descriptive profile features.
1. 'status': Put ALL numeric/integer status parameters and variables used for rolls, mechanics, or tests (e.g., Strength, Agility, Level, etc.) inside the 'status' object. Formatted as "value (type: integer, min: 0, max: 100)".
2. 'profile': Keep 'profile' EXCLUSIVELY for text-based, non-numerical descriptions (e.g., Race, Gender, Height, Appearance, Personality, Background). Do NOT put any numeric/integer status parameters here.
3. 'inventory': Generate starting items. Differentiate item types:
   - "general": Standard items with 'quantity' and 'desc'.
   - "currency": Wealth items (e.g. Gold) with only 'quantity' (amount) and no desc.
   - "asset": Valuable properties (e.g. House) with 'assetValue' (object containing amount and currencyName) and 'desc'.
   Any storage container equipped in an equipment slot must have 'isContainer: true' and a matching 'storageKey' referring to the storage key.
Create suitable status, profile features, relations, starting inventory, and initial quests that fit their role. Return the result as a JSON block wrapped in an HTML comment with the identifier RPG_TRACKER.`;

export const getInitialTrackerData = () => {
  return {
    characters: getDefaultCharacters(),
    worldState: JSON.parse(JSON.stringify(DEFAULT_WORLD_STATE)),
    worldStateLocks: { date: false, time: false, location: false, weather: false },
    worldSchema: JSON.parse(JSON.stringify(DEFAULT_WORLD_SCHEMA)),
    guidePrompts: JSON.parse(JSON.stringify(DEFAULT_GUIDE_PROMPTS)),
    globalDefinitions: {},
    systemPromptHeader_merged: DEFAULT_PROMPT_HEADER_MERGED,
    systemPromptFooter_merged: DEFAULT_PROMPT_FOOTER_MERGED,
    systemPrompt_readonly: DEFAULT_READONLY_CONTEXT_HEADER,
    systemPromptHeader_separated: DEFAULT_PROMPT_HEADER_SEP,
    systemPromptFooter_separated: DEFAULT_PROMPT_FOOTER_SEP,
    addons: { weather: false, worldEvents: false, cyoa: false },
    addCharPrompt: DEFAULT_ADD_CHAR_PROMPT,
    addPlayerCharPrompt: DEFAULT_ADD_PLAYER_CHAR_PROMPT
  };
};

export const DEFAULT_PROMPT_HEADER_MERGED = `[RPG STATUS TRACKER SYSTEM]
At the VERY BEGINNING of your response, you MUST output a JSON code block wrapped inside an HTML comment with the 'RPG_TRACKER' identifier.
CRITICAL: This JSON block must act as a DELTA PATCH containing ONLY parameters or fields that have CHANGED this turn.
Strictly follow this layout:`;

export const DEFAULT_PROMPT_FOOTER_MERGED = `[SYSTEM RULES & GUIDELINES]
1. ROLE & DELTA PATCHING: Act as the Game Master. The provided JSON represents the CURRENT STATE. You must output a JSON status patch.
   - You MUST output ONLY the values, metrics, or items that have CHANGED or UPDATED during this turn.
   - If a status parameter, profile description, or item remains exactly the same as the current reference, completely OMIT it from your JSON response.
   - If an entire category (like 'profile', 'inventory', 'quests') or an entire character has NO changes, OMIT that object entirely. Do NOT output empty objects (e.g., "inventory": {}).
   - Value fields containing "<new_value...>" are blank placeholders. Fill them only if relevant to the turn's updates.
2. REASONING RULES (CRITICAL):
   - STATUS vs PROFILE: STRICT SEPARATION.
     > 'status': ONLY for numerical parameters or game-mechanics (type: consumable, stacking, integer).
     > 'profile': EXCLUSIVELY for text-based descriptions. NEVER put numeric parameters here.
   - Text Parameters (type: text): Keep descriptions extremely concise (e.g., "Healthy", "Injured (Left Leg)").
3. DYNAMIC ENTITIES:
   - Minor NPCs: If no separate card exists, update "targetDescription" and "targetMetrics" directly within their relation object.
   - Quests & Events: Use consistent 'name' values to automatically merge updates. Use status "COMPLETED" or "ACTIVE".
   - Inventory: Diligently reflect item gains, losses, and equipment changes. Support standard items ("type": "general"), monetary units ("type": "currency"), and valuable properties ("type": "asset").
4. LOCKS & SAFETY:
   - Absolutely DO NOT change, override, or delete any element listed in '_lockedFields'.
5. OUTPUT FORMAT (STRICT):
   - The HTML comment block (\`<!--RPG_TRACKER...\`) MUST be the VERY FIRST thing in your response.
   - Absolutely NO conversational filler or prefixes before the JSON block.
   - Write your normal roleplay response immediately AFTER the JSON block.`;

export const DEFAULT_PROMPT_HEADER_SEP = `[RPG STATUS TRACKER SYSTEM]
You MUST output ONLY a JSON code block wrapped inside an HTML comment with the 'RPG_TRACKER' identifier.
CRITICAL: This JSON block must act as a DELTA PATCH containing ONLY parameters or fields that have CHANGED this turn.
Strictly follow this layout:`;

export const DEFAULT_PROMPT_FOOTER_SEP = `[SYSTEM RULES & GUIDELINES]
1. ROLE & DELTA PATCHING: Act as the Game Master. The provided JSON represents the CURRENT STATE. You must output a JSON status patch.
   - You MUST output ONLY the values, metrics, or items that have CHANGED during this turn.
   - If a status, profile description, or item remains exactly the same, completely OMIT it from your JSON response.
   - If an entire category or character has no changes, OMIT it completely from the output.
   - Placeholders containing "<new_value...>" are blank. Fill them only if relevant to the turn's updates.
2. REASONING RULES (CRITICAL):
   - STATUS vs PROFILE: STRICT SEPARATION.
     > 'status': ONLY numerical parameters.
     > 'profile': ONLY text descriptions.
3. LOCKS & SAFETY:
   - Absolutely DO NOT change, override, or delete any element listed in '_lockedFields'.
4. OUTPUT LIMIT (STRICT):
   - Output ONLY the JSON HTML comment block.
   - Absolutely NO normal roleplay response, prefixes, conversational filler, or commentary is allowed.`;

export const DEFAULT_READONLY_CONTEXT_HEADER = `[CURRENT RPG STATUS CONTEXT]
Understand the current situation, parameters, and relationship metrics from the live status data below.
This data is provided for your narrative and contextual reference only.

CRITICAL CONSTRAINT:
- Do NOT output any JSON, HTML comments (such as <!--RPG_TRACKER...-->), or code blocks in your response.
- Do NOT attempt to update these stats in your output.
- Write your normal story roleplay response only, naturally reflecting the status provided.`;