import { deepClone } from './StateHelpers.js';

export const DEFAULT_STATUS_SCHEMAS = [
  { id: 'HP', name: 'HP', type: 'consumable', min: 0, max: 100, color: '#e74c3c', isLocked: false, isInject: true },
  { id: 'Fatigue', name: 'Fatigue', type: 'stacking', min: 0, max: 100, color: '#f39c12', isLocked: false, isInject: true },
  { id: 'Lv', name: 'Lv', type: 'integer', min: 1, max: 100, isLocked: false, isInject: true },
  { id: 'Condition', name: 'Condition', type: 'text', isLocked: false, isInject: true }
];

export const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "default",
  updateMode: "merged",
  panelPosition: "left",
  contextMessageLimit: 4,
  showDeltaLog: true,
  keepAllBackups: false,
  maxBackupCount: 20,
  presets: [],
  characterSyncs: {},
  useCustomModel: false,
  customModel: "",
  customProviders: [],
  customAllowFallbacks: true,
  customColors: {
    bg: '#1a1a2e',
    accent: '#4a7ba7',
    text: '#ffffff',
    highlight: '#4a9eff',
    border: '#4a7ba7'
  }
};

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
  locationSelect: '1',
  locationCustom: 'Current Location'
};

export const DEFAULT_GUIDE_PROMPTS = [
  { id: 'status', name: 'Update Status', prompt: 'Update active status parameters based on action outcomes, damage taken, or roleplay events in the chat.', enabled: true },
  { id: 'profile', name: 'Update Profile', prompt: 'Dynamically generate, update, or remove unlocked profile fields and parameters based on character cards, user persona, or chat context.', enabled: true },
  { id: 'relations', name: 'Update Relations', prompt: 'Reflect changes in emotions, relationship metrics, and impressions. For targets with an existing character card, update only this character\'s perspective. For minor NPCs without separate cards, you may update "targetDescription" and "targetMetrics" directly.', enabled: true },
  { id: 'inventory', name: 'Update Inventory', prompt: 'If any items or equipment are acquired or lost, update the inventory and storage accordingly. Applicable ONLY to the active player character.', enabled: true },
  { id: 'quests', name: 'Update Quests', prompt: 'If there is progress or a change in ongoing quests, update the quest list. Use status "ACTIVE" or "COMPLETED" to reflect progress. Applicable ONLY to the active player character.', enabled: true },
  { id: 'world_date', name: 'Update Date', prompt: 'Update world date ONLY if the narrative explicitly indicates that days or nights have passed (e.g. overnight rest, long journey). Otherwise, omit.', enabled: true },
  { id: 'world_time', name: 'Update Time', prompt: 'Update world time ONLY if the narrative explicitly states an elapsed duration (e.g. "two hours later", resting) or names a specific time of day. Never advance time for standard dialogues or short actions.', enabled: true },
  { id: 'world_weather', name: 'Update Weather', prompt: 'Update world weather ONLY if environmental conditions change in the story.', enabled: true },
  { id: 'world_location', name: 'Update Location', prompt: 'Update world location if characters have moved to a different place.', enabled: true },
  { id: 'world_events', name: 'Update Events', prompt: 'Update world events if new occurrences arise or ongoing situations resolve. Keep event names consistent to modify existing events instead of duplicating them.', enabled: true }
];

export const DEFAULT_PROFILE = { Race: '', Height: '', Appearance: '' };
export const DEFAULT_PROFILE_LOCKS = { Race: false, Height: false, Appearance: false };

export const DEFAULT_RELATIONS = {
  'Target Example': {
    text: '',
    isLocked: false,
    isInject: true,
    values: { 'Affection': { value: 0, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' } }
  }
};

export const createDefaultCharacter = ({ id = 'char_user', name = 'New', activePlayer = true } = {}) => {
  const isPlayer = Boolean(activePlayer);
  return {
    id,
    name,
    activePlayer: isPlayer,
    activeInjection: true,
    statusSchema: deepClone(DEFAULT_STATUS_SCHEMAS),
    status: deepClone(DEFAULT_STATUS),
    profile: isPlayer ? deepClone(DEFAULT_PROFILE) : {},
    profileLocks: isPlayer ? deepClone(DEFAULT_PROFILE_LOCKS) : {},
    profileInjects: {},
    inventory: isPlayer ? {
      equipIsLocked: false,
      equipIsInject: true,
      storageIsLocked: false,
      storageIsInject: true,
      equipmentLocks: {},
      storageLocks: {},
      equipment: { 'Right Hand': null, 'Left Hand': null },
      storage: { 'Backpack': [] }
    } : {
      equipIsLocked: false,
      equipIsInject: false,
      storageIsLocked: false,
      storageIsInject: false,
      equipmentLocks: {},
      storageLocks: {},
      equipment: {},
      storage: {}
    },
    quests: isPlayer ? {
      main: { name: '', desc: '' },
      sides: []
    } : {
      main: { name: '', desc: '' },
      sides: []
    },
    relations: isPlayer ? deepClone(DEFAULT_RELATIONS) : {}
  };
};

export const getDefaultCharacters = () => {
  return [createDefaultCharacter({ id: 'char_user', name: 'New', activePlayer: true })];
};

export const DEFAULT_ADD_CHAR_PROMPT = `Based on the chat log, create a profile for the character.
CRITICAL CONSTRAINTS:
1. 'status': Put ALL numerical/integer status parameters and variables used for rolls, mechanics, or tests (e.g., Strength, Agility, Level, etc.) inside the 'status' object. Formatted as "value (type: integer, min: 0, max: 100)".
2. 'profile': Keep 'profile' EXCLUSIVELY for text-based, non-numerical descriptions (e.g., Race, Gender, Height, Appearance, Personality, Background). NEVER put numerical status parameters here.
3. 'inventory' & 'quests': Non-player characters must NEVER possess inventory or quests objects. Omit them entirely.
Create suitable status, profile features, and relations (including 'targetDescription' to define what the target thinks about this character) that fit their role. Return the result as a JSON block wrapped in an HTML comment with the identifier RPG_TRACKER.`;

export const DEFAULT_ADD_PLAYER_CHAR_PROMPT = `Based on the chat log, create a profile for the player character.
CRITICAL CONSTRAINTS:
1. 'status': Put ALL numerical/integer status parameters and variables used for rolls, mechanics, or tests (e.g., Strength, Agility, Level, etc.) inside the 'status' object. Formatted as "value (type: integer, min: 0, max: 100)".
2. 'profile': Keep 'profile' EXCLUSIVELY for text-based, non-numerical descriptions (e.g., Race, Gender, Height, Appearance, Personality, Background). NEVER put numerical status parameters here.
3. 'inventory': Generate starting items. Differentiate item types:
   - "general": Standard items with 'quantity' and 'desc'.
   - "currency": Wealth items (e.g. Gold) with only 'quantity' (amount) and no desc.
   - "asset": Valuable properties (e.g. House) with 'assetValue' (object containing amount and currencyName) and 'desc'.
   Any storage container equipped in an equipment slot must have 'isContainer: true' and a matching 'storageKey' referring to the storage key.
Create suitable status, profile features, relations, starting inventory, and initial quests that fit their role. Return the result as a JSON block wrapped in an HTML comment with the identifier RPG_TRACKER.`;

export const DEFAULT_CYOA_PROMPT = "CYOA Mode: Act as an interactive adventure where you present choices to the player at the end of each response.";
export const DEFAULT_WEATHER_PROMPT = "Dynamic Weather: Include weather changes and environmental descriptions.";
export const DEFAULT_WORLD_EVENTS_PROMPT = "World Events: Generate random world events that affect the current situation.";

export const DEFAULT_PROMPT_HEADER_MERGED = `[RPG STATUS TRACKER SYSTEM]
Act as the Game Master. Before writing your narrative roleplay response, output a DELTA PATCH JSON wrapped in an HTML comment (\`<!--RPG_TRACKER\` ... \`-->\`).
CRITICAL: The provided reference represents the BASELINE status before current events. Output ONLY fields that have actually CHANGED during this turn. Completely omit unchanged parameters.
Strictly follow this layout:`;

export const DEFAULT_PROMPT_FOOTER_MERGED = `[SYSTEM RULES & DELTA GUIDELINES]
1. DELTA PATCHING PRINCIPLES:
   - Output ONLY values, metrics, or items that changed, were acquired, or were lost during this turn.
   - If a status parameter, profile description, item, or entire category remains unchanged from the baseline reference, completely OMIT it.
   - Do NOT output empty objects (e.g. "inventory": {}, "World": {}).
   - Do NOT output placeholder tags (e.g. "<new_value...>"). Output concrete updated values only.

2. CATEGORY SEPARATION & REASONING:
   - 'status': Strictly for numerical game-mechanics parameters (HP, MP, Fatigue, Level).
   - 'profile': Exclusively for narrative text traits (Race, Appearance, Titles). NEVER place numbers or game stats here.
   - 'relations': Track emotions and relationship metrics. For main characters with separate cards, update only this character's side. Use 'targetDescription' and 'targetMetrics' ONLY for minor NPCs without separate cards.
   - 'inventory' & 'quests': Tracked EXCLUSIVELY for the active player character (activePlayer: true). NEVER generate or patch inventory or quests for non-player NPCs.

3. WORLD STATE & TIME PRESERVATION (STRICT):
   - Date and Time are STATIC by default.
   - Do NOT advance time or change date unless the narrative explicitly states that significant time elapsed (e.g. "three hours later", sleeping overnight, multi-day travel). Standard conversation and immediate combat rounds NEVER advance time.

4. BOUNDARY & LOCK ENFORCEMENT:
   - Strictly respect Min and Max limits for all parameters and metrics. Clamp values at boundaries; never exceed limits.
   - Keep text parameter values concise.
   - Absolutely DO NOT modify, overwrite, or delete any property listed under '_lockedFields'.`;

export const DEFAULT_PROMPT_HEADER_SEP = `[RPG STATUS TRACKER SYSTEM]
Output ONLY a JSON code block wrapped inside an HTML comment with the 'RPG_TRACKER' identifier.
CRITICAL: The provided reference represents the BASELINE status before the recent chat events. Output a DELTA PATCH containing ONLY parameters or fields that have CHANGED in the recent chat log.
Strictly follow this layout:`;

export const DEFAULT_PROMPT_FOOTER_SEP = `[SYSTEM RULES & DELTA GUIDELINES]
1. DELTA PATCHING PRINCIPLES:
   - Output ONLY parameters, metrics, or items that changed during the recent chat log.
   - If a parameter, profile description, or item remains unchanged, completely OMIT it.
   - Do NOT output empty objects or unchanged character blocks.
   - Do NOT output placeholder tags like "<new_value...>".

2. CATEGORY SEPARATION & REASONING:
   - 'status': Numerical stats and mechanics only.
   - 'profile': Narrative text descriptions only.
   - 'relations': Metrics and emotions. Use 'targetDescription' ONLY for minor NPCs without cards.
   - 'inventory' & 'quests': Active player character only. Never generate for NPCs.

3. WORLD STATE & TIME PRESERVATION (STRICT):
   - Date and Time are STATIC by default.
   - Do NOT advance time or change date unless the chat log explicitly describes substantial time passing.

4. OUTPUT CONSTRAINT (STRICT):
   - Output ONLY the HTML comment block (\`<!--RPG_TRACKER\` ... \`-->\`).
   - Absolutely NO conversational filler, roleplay narrative, prefixes, or commentary is allowed.`;

export const DEFAULT_READONLY_CONTEXT_HEADER = `[CURRENT RPG STATUS CONTEXT]
The following parameters and world state represent the CURRENT ESTABLISHED REALITY of this scene.
Use this status as the baseline narrative context for your response.

CRITICAL CONSTRAINTS:
- Do NOT output any JSON, HTML comments (such as <!--RPG_TRACKER...-->), or code blocks in your response.
- Do NOT attempt to update these stats in your output.
- Write your normal story roleplay response only, naturally reflecting the established current status and environment.`;

export const DEFAULT_OUTPUT_ENFORCER = `[OUTPUT MANDATE]
Provide your delta JSON block wrapped in \`<!--RPG_TRACKER\` and \`-->\` at the start of your turn output, immediately followed by your normal roleplay response narrative.`;

export const DEFAULT_OUTPUT_ENFORCER_SEP = `[OUTPUT MANDATE]
Output ONLY the \`<!--RPG_TRACKER\` ... \`-->\` block containing the delta JSON. Do NOT write any story narrative, conversational filler, or introductory commentary.`;

export const INJECTION_TARGETS = {
  SYSTEM: 'system',
  CHAT: 'chat'
};

export const DEFAULT_INJECTION_SETTINGS = {
  preset: 'optimized',
  modules: {
    rules_defs: {
      enabled: true,
      target: INJECTION_TARGETS.SYSTEM,
      depth: 0
    },
    status: {
      enabled: true,
      target: INJECTION_TARGETS.CHAT,
      depth: 1
    },
    addons_enforcer: {
      enabled: true,
      target: INJECTION_TARGETS.CHAT,
      depth: 0
    }
  }
};

/**
 * Normalizes injection settings and falls back any unsupported or legacy targets to module defaults.
 */
export function normalizeInjectionSettings(rawSettings) {
  const base = deepClone(DEFAULT_INJECTION_SETTINGS);
  if (!rawSettings || typeof rawSettings !== 'object') {
    return base;
  }

  const validTargets = new Set(Object.values(INJECTION_TARGETS));
  const rawModules = (rawSettings.modules && typeof rawSettings.modules === 'object') ? rawSettings.modules : {};
  const modules = {};

  Object.keys(base.modules).forEach(moduleKey => {
    const defaultMod = base.modules[moduleKey];
    const incomingMod = rawModules[moduleKey];

    if (!incomingMod || typeof incomingMod !== 'object') {
      modules[moduleKey] = defaultMod;
      return;
    }

    const target = validTargets.has(incomingMod.target) ? incomingMod.target : defaultMod.target;
    const parsedDepth = typeof incomingMod.depth === 'number' ? incomingMod.depth : parseInt(incomingMod.depth, 10);
    const depth = !isNaN(parsedDepth) ? Math.max(0, parsedDepth) : defaultMod.depth;

    modules[moduleKey] = {
      enabled: incomingMod.enabled !== false,
      target,
      depth
    };
  });

  return {
    preset: typeof rawSettings.preset === 'string' ? rawSettings.preset : base.preset,
    modules
  };
}

export const PROMPT_SETTING_KEYS = [
  'systemPromptHeader_merged',
  'systemPromptFooter_merged',
  'systemPrompt_readonly',
  'systemPromptHeader_separated',
  'systemPromptFooter_separated',
  'outputEnforcerPrompt',
  'injectionSettings',
  'guidePrompts',
  'worldSchema',
  'addons',
  'addCharPrompt',
  'addPlayerCharPrompt',
  'cyoaPrompt',
  'weatherPrompt',
  'worldEventsPrompt'
];

export const DEFAULT_PROMPT_SETTINGS = {
  systemPromptHeader_merged: DEFAULT_PROMPT_HEADER_MERGED,
  systemPromptFooter_merged: DEFAULT_PROMPT_FOOTER_MERGED,
  systemPrompt_readonly: DEFAULT_READONLY_CONTEXT_HEADER,
  systemPromptHeader_separated: DEFAULT_PROMPT_HEADER_SEP,
  systemPromptFooter_separated: DEFAULT_PROMPT_FOOTER_SEP,
  outputEnforcerPrompt: DEFAULT_OUTPUT_ENFORCER,
  injectionSettings: DEFAULT_INJECTION_SETTINGS,
  guidePrompts: DEFAULT_GUIDE_PROMPTS,
  worldSchema: DEFAULT_WORLD_SCHEMA,
  addons: { weather: false, worldEvents: false, cyoa: false },
  addCharPrompt: DEFAULT_ADD_CHAR_PROMPT,
  addPlayerCharPrompt: DEFAULT_ADD_PLAYER_CHAR_PROMPT,
  cyoaPrompt: DEFAULT_CYOA_PROMPT,
  weatherPrompt: DEFAULT_WEATHER_PROMPT,
  worldEventsPrompt: DEFAULT_WORLD_EVENTS_PROMPT
};

export const getDefaultPromptSettings = () => {
  return deepClone(DEFAULT_PROMPT_SETTINGS);
};

/**
 * Extracts prompt configuration keys from a source object.
 */
export function extractPromptSettings(source = {}) {
  if (!source || typeof source !== 'object') return {};
  const extracted = {};
  PROMPT_SETTING_KEYS.forEach(key => {
    if (source[key] !== undefined && source[key] !== null) {
      extracted[key] = key === 'injectionSettings'
        ? normalizeInjectionSettings(source[key])
        : deepClone(source[key]);
    }
  });
  return extracted;
}

/**
 * Strips prompt configuration keys from a target object to keep message snapshots compact.
 */
export function stripPromptSettings(data) {
  if (!data || typeof data !== 'object') return data;
  PROMPT_SETTING_KEYS.forEach(key => {
    delete data[key];
  });
  return data;
}

export const getInitialTrackerData = () => {
  return {
    characters: getDefaultCharacters(),
    worldState: deepClone(DEFAULT_WORLD_STATE),
    worldStateLocks: { date: false, time: false, location: false, weather: false },
    globalDefinitions: {}
  };
};