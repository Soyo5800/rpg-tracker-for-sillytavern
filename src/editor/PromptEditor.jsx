import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './PromptEditor.module.css';
import {
  DEFAULT_PROMPT_HEADER_MERGED,
  DEFAULT_PROMPT_FOOTER_MERGED,
  DEFAULT_PROMPT_HEADER_SEP,
  DEFAULT_PROMPT_FOOTER_SEP,
  DEFAULT_READONLY_CONTEXT_HEADER,
  DEFAULT_OUTPUT_ENFORCER,
  DEFAULT_OUTPUT_ENFORCER_SEP,
  DEFAULT_INJECTION_SETTINGS,
  INJECTION_TARGETS,
  normalizeInjectionSettings,
  DEFAULT_GUIDE_PROMPTS,
  DEFAULT_ADD_CHAR_PROMPT,
  DEFAULT_ADD_PLAYER_CHAR_PROMPT,
  DEFAULT_CYOA_PROMPT,
  DEFAULT_WEATHER_PROMPT,
  DEFAULT_WORLD_EVENTS_PROMPT
} from '../core/PromptSchema';
import { getDynamicSchemaExample } from '../core/ActivePrompt';
import { ToggleSwitch, AccordionArrow } from '../utils';
import ModalLayout from '../ModalLayout';

export default function PromptEditor({ onClose }) {
  const { trackerData, promptSettings, updatePromptSettings, settings } = useRPG();
  const [activeTab, setActiveTab] = useState('system');

  // System Prompt State
  const [localMergedHeader, setLocalMergedHeader] = useState('');
  const [localMergedFooter, setLocalMergedFooter] = useState('');
  const [localReadOnlyPrompt, setLocalReadOnlyPrompt] = useState('');
  const [localSepHeader, setLocalSepHeader] = useState('');
  const [localSepFooter, setLocalSepFooter] = useState('');

  // Injection Settings State
  const [localInjectionSettings, setLocalInjectionSettings] = useState(() => {
    const src = promptSettings?.injectionSettings || trackerData?.injectionSettings;
    return normalizeInjectionSettings(src);
  });
  const [localEnforcerPrompt, setLocalEnforcerPrompt] = useState('');
  const [isEditEnforcer, setIsEditEnforcer] = useState(false);
  const [isEnforcerOpen, setIsEnforcerOpen] = useState(false);

  // Add-ons State
  const [localAddCharPrompt, setLocalAddCharPrompt] = useState('');
  const [localAddPlayerCharPrompt, setLocalAddPlayerCharPrompt] = useState('');
  const [localCyoaPrompt, setLocalCyoaPrompt] = useState('');
  const [localWeatherPrompt, setLocalWeatherPrompt] = useState('');
  const [localWorldEventsPrompt, setLocalWorldEventsPrompt] = useState('');

  // UI Edit Modes
  const [isEditMerged, setIsEditMerged] = useState(false);
  const [isEditReadOnly, setIsEditReadOnly] = useState(false);
  const [isEditSep, setIsEditSep] = useState(false);

  const [isEditAddChar, setIsEditAddChar] = useState(false);
  const [isEditAddPlayerChar, setIsEditAddPlayerChar] = useState(false);
  const [isEditCyoa, setIsEditCyoa] = useState(false);
  const [isEditWeather, setIsEditWeather] = useState(false);
  const [isEditWorldEvents, setIsEditWorldEvents] = useState(false);

  // Accordion Expand States
  const [isMergedOpen, setIsMergedOpen] = useState(false);
  const [isReadOnlyOpen, setIsReadOnlyOpen] = useState(false);
  const [isSepOpen, setIsSepOpen] = useState(false);

  const [isSchemaOpen, setIsSchemaOpen] = useState(true);
  const [isAddCharOpen, setIsAddCharOpen] = useState(false);
  const [isAddPlayerCharOpen, setIsAddPlayerCharOpen] = useState(false);
  const [isCyoaOpen, setIsCyoaOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isWorldEventsOpen, setIsWorldEventsOpen] = useState(false);

  // Guide Prompts and World Schema State
  const [localGuidePrompts, setLocalGuidePrompts] = useState([]);
  const [localWorldSchema, setLocalWorldSchema] = useState({});

  const characters = (trackerData.characters && trackerData.characters.length > 0)
    ? trackerData.characters
    : getDefaultCharacters();

  useEffect(() => {
    const src = promptSettings || trackerData || {};

    setLocalMergedHeader(src.systemPromptHeader_merged ?? DEFAULT_PROMPT_HEADER_MERGED);
    setLocalMergedFooter(src.systemPromptFooter_merged ?? DEFAULT_PROMPT_FOOTER_MERGED);
    setLocalReadOnlyPrompt(src.systemPrompt_readonly ?? DEFAULT_READONLY_CONTEXT_HEADER);
    setLocalSepHeader(src.systemPromptHeader_separated ?? DEFAULT_PROMPT_HEADER_SEP);
    setLocalSepFooter(src.systemPromptFooter_separated ?? DEFAULT_PROMPT_FOOTER_SEP);

    setLocalInjectionSettings(normalizeInjectionSettings(src.injectionSettings));
    setLocalEnforcerPrompt(src.outputEnforcerPrompt ?? DEFAULT_OUTPUT_ENFORCER);

    setLocalAddCharPrompt(src.addCharPrompt ?? DEFAULT_ADD_CHAR_PROMPT);
    setLocalAddPlayerCharPrompt(src.addPlayerCharPrompt ?? DEFAULT_ADD_PLAYER_CHAR_PROMPT);
    setLocalCyoaPrompt(src.cyoaPrompt ?? DEFAULT_CYOA_PROMPT);
    setLocalWeatherPrompt(src.weatherPrompt ?? DEFAULT_WEATHER_PROMPT);
    setLocalWorldEventsPrompt(src.worldEventsPrompt ?? DEFAULT_WORLD_EVENTS_PROMPT);

    let savedGuides = src.guidePrompts ? [...src.guidePrompts] : JSON.parse(JSON.stringify(DEFAULT_GUIDE_PROMPTS));

    DEFAULT_GUIDE_PROMPTS.forEach(defaultGuide => {
      if (!savedGuides.find(g => g.id === defaultGuide.id)) {
        savedGuides.push(defaultGuide);
      }
    });

    setLocalGuidePrompts(savedGuides);
    setLocalWorldSchema(src.worldSchema || {
      dateSelect: '1', dateCustom: 'yyyy-mm-dd',
      timeSelect: '1', timeCustom: '14:30',
      weatherSelect: '1', weatherCustom: 'Clear/Cloudy/Rain/Snow',
      locationSelect: '1', locationCustom: 'Current Location'
    });
  }, [promptSettings, trackerData]);

  const DATE_OPTS = [
    { v: '1', l: 'Year/Month/Day', ex: 'yyyy-mm-dd' },
    { v: '2', l: 'Year/Month/Day (Weekday)', ex: 'yyyy-mm-dd (Day)' },
    { v: '3', l: 'Weekday only', ex: 'Monday' },
    { v: '4', l: 'Day 1, Day 2...', ex: 'Day 1' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];
  const TIME_OPTS = [
    { v: '1', l: '24:00 Format', ex: '14:30' },
    { v: '2', l: '12-hour AM/PM', ex: '02:30 PM' },
    { v: '3', l: 'Dawn/Morning...', ex: 'Dawn/Morning/Noon/Evening/Night' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];
  const WEATHER_OPTS = [
    { v: '1', l: 'Text', ex: 'Clear/Cloudy/Rain/Snow' },
    { v: '2', l: 'Emoji only', ex: '☀️/☁️/🌧️/❄️' },
    { v: '3', l: 'Emoji + Text', ex: '☀️ Clear / ☁️ Cloudy / 🌧️ Rain / ❄️ Snow' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];
  const LOCATION_OPTS = [
    { v: '1', l: 'Default', ex: 'Current Location' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];

  const handleGuidePromptChange = (id, newPrompt) => {
    setLocalGuidePrompts(prev => prev.map(g => g.id === id ? { ...g, prompt: newPrompt } : g));
  };


  const handleWorldSchemaChange = (key, value, typeOpts) => {
    let updates = { [key]: value };
    if (typeOpts) {
      const opt = typeOpts.find(o => o.v === value);
      if (opt && value !== 'custom') {
        updates[key.replace('Select', 'Custom')] = opt.ex;
      }
    }
    setLocalWorldSchema(prev => ({ ...prev, ...updates }));
  };

  const handleUpdateModuleField = (moduleKey, field, val) => {
    setLocalInjectionSettings(prev => {
      const modules = { ...(prev.modules || DEFAULT_INJECTION_SETTINGS.modules) };
      const currentMod = { ...(modules[moduleKey] || {}) };
      currentMod[field] = val;
      modules[moduleKey] = currentMod;
      return { ...prev, modules };
    });
  };

  const handleDepthChange = (moduleKey, rawVal) => {
    if (rawVal === '') {
      handleUpdateModuleField(moduleKey, 'depth', '');
    } else {
      const parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed)) {
        handleUpdateModuleField(moduleKey, 'depth', Math.max(0, parsed));
      }
    }
  };

  const handleDepthBlur = (moduleKey, rawVal, fallback = 0) => {
    const parsed = parseInt(rawVal, 10);
    handleUpdateModuleField(moduleKey, 'depth', isNaN(parsed) ? fallback : Math.max(0, parsed));
  };

  const handleApplyInjectionPreset = (presetType) => {
    if (presetType === 'optimized') {
      setLocalInjectionSettings({
        preset: 'optimized',
        modules: {
          rules_defs: { enabled: true, target: INJECTION_TARGETS.SYSTEM, depth: 0 },
          status: { enabled: true, target: INJECTION_TARGETS.CHAT, depth: 1 },
          addons_enforcer: { enabled: true, target: INJECTION_TARGETS.CHAT, depth: 0 }
        }
      });
    } else if (presetType === 'simple') {
      setLocalInjectionSettings({
        preset: 'simple',
        modules: {
          rules_defs: { enabled: true, target: INJECTION_TARGETS.SYSTEM, depth: 0 },
          status: { enabled: true, target: INJECTION_TARGETS.SYSTEM, depth: 0 },
          addons_enforcer: { enabled: true, target: INJECTION_TARGETS.SYSTEM, depth: 0 }
        }
      });
    }
  };

  const handleSave = () => {
    const normalizedInjectionSettings = normalizeInjectionSettings(localInjectionSettings);

    const cleanedWorldSchema = { ...localWorldSchema };
    if (cleanedWorldSchema.relationsFieldType !== undefined) {
      delete cleanedWorldSchema.relationsFieldType;
    }

    const updatedPromptSettings = {
      ...(promptSettings || {}),
      systemPromptHeader_merged: localMergedHeader,
      systemPromptFooter_merged: localMergedFooter,
      systemPrompt_readonly: localReadOnlyPrompt,
      systemPromptHeader_separated: localSepHeader,
      systemPromptFooter_separated: localSepFooter,
      injectionSettings: normalizedInjectionSettings,
      outputEnforcerPrompt: localEnforcerPrompt,
      guidePrompts: localGuidePrompts,
      worldSchema: cleanedWorldSchema,
      addCharPrompt: localAddCharPrompt,
      addPlayerCharPrompt: localAddPlayerCharPrompt,
      cyoaPrompt: localCyoaPrompt,
      weatherPrompt: localWeatherPrompt,
      worldEventsPrompt: localWorldEventsPrompt
    };

    if (updatePromptSettings) {
      updatePromptSettings(updatedPromptSettings);
    }

    if (window.RPGBridge) {
      window.RPGBridge.currentPromptSettings = updatedPromptSettings;
      if (typeof window.RPGBridge.refreshPrompts === 'function') {
        window.RPGBridge.refreshPrompts();
      }
    }

    alert("Prompt configurations and injection settings saved successfully.");
    onClose();
  };

  const handleExport = () => {
    const exportData = {
      systemPromptHeader_merged: localMergedHeader,
      systemPromptFooter_merged: localMergedFooter,
      systemPrompt_readonly: localReadOnlyPrompt,
      systemPromptHeader_separated: localSepHeader,
      systemPromptFooter_separated: localSepFooter,
      injectionSettings: localInjectionSettings,
      outputEnforcerPrompt: localEnforcerPrompt,
      guidePrompts: localGuidePrompts,
      worldSchema: localWorldSchema,
      addCharPrompt: localAddCharPrompt,
      addPlayerCharPrompt: localAddPlayerCharPrompt,
      cyoaPrompt: localCyoaPrompt,
      weatherPrompt: localWeatherPrompt,
      worldEventsPrompt: localWorldEventsPrompt
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rpg-tracker-prompt-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    document.getElementById('prompt-import-file')?.click();
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData && typeof importedData === 'object') {
          if (importedData.systemPromptHeader_merged !== undefined) setLocalMergedHeader(importedData.systemPromptHeader_merged);
          if (importedData.systemPromptFooter_merged !== undefined) setLocalMergedFooter(importedData.systemPromptFooter_merged);
          if (importedData.systemPrompt_readonly !== undefined) setLocalReadOnlyPrompt(importedData.systemPrompt_readonly);
          if (importedData.systemPromptHeader_separated !== undefined) setLocalSepHeader(importedData.systemPromptHeader_separated);
          if (importedData.systemPromptFooter_separated !== undefined) setLocalSepFooter(importedData.systemPromptFooter_separated);
          if (importedData.injectionSettings && typeof importedData.injectionSettings === 'object') setLocalInjectionSettings(normalizeInjectionSettings(importedData.injectionSettings));
          if (importedData.outputEnforcerPrompt !== undefined) setLocalEnforcerPrompt(importedData.outputEnforcerPrompt);
          if (Array.isArray(importedData.guidePrompts)) setLocalGuidePrompts(importedData.guidePrompts);
          if (importedData.worldSchema && typeof importedData.worldSchema === 'object') {
            const nextWorldSchema = { ...importedData.worldSchema };
            delete nextWorldSchema.relationsFieldType;
            setLocalWorldSchema(nextWorldSchema);
          }
          if (importedData.addCharPrompt !== undefined) setLocalAddCharPrompt(importedData.addCharPrompt);
          if (importedData.addPlayerCharPrompt !== undefined) setLocalAddPlayerCharPrompt(importedData.addPlayerCharPrompt);
          if (importedData.cyoaPrompt !== undefined) setLocalCyoaPrompt(importedData.cyoaPrompt);
          if (importedData.weatherPrompt !== undefined) setLocalWeatherPrompt(importedData.weatherPrompt);
          if (importedData.worldEventsPrompt !== undefined) setLocalWorldEventsPrompt(importedData.worldEventsPrompt);

          alert("Prompt configurations imported successfully. Click 'Save Changes' to apply.");
        } else {
          alert("Invalid file format. Please import a valid RPG Tracker prompt settings JSON file.");
        }
      } catch (err) {
        console.error("Failed to import settings:", err);
        alert("Failed to parse settings file. Make sure it is a valid JSON.");
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleGuideToggle = (id, checked) => {
    setLocalGuidePrompts(prev => prev.map(g => g.id === id ? { ...g, enabled: checked } : g));
  };

  const currentPreviewPromptSettings = {
    guidePrompts: localGuidePrompts,
    worldSchema: localWorldSchema
  };
  const previewSchema = getDynamicSchemaExample({ characters }, null, currentPreviewPromptSettings);
  const modulesConfig = localInjectionSettings.modules || DEFAULT_INJECTION_SETTINGS.modules;

  return (
    <ModalLayout
      title="Prompt Editor"
      onClose={onClose}
      subHeader={
        <div className="rpg-tab-nav">
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System Prompt
          </button>
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'injection' ? 'active' : ''}`}
            onClick={() => setActiveTab('injection')}
          >
            Injection
          </button>
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'addons' ? 'active' : ''}`}
            onClick={() => setActiveTab('addons')}
          >
            Add-ons
          </button>
        </div>
      }
      footerLeft={
        <>
          <button type="button" className="rpg-modal-btn" onClick={handleExport}>
            Export
          </button>
          <button type="button" className="rpg-modal-btn" onClick={handleImportClick}>
            Import
          </button>
          <input
            type="file"
            id="prompt-import-file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </>
      }
      footerRight={
        <>
          <button type="button" className="rpg-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rpg-modal-btn save" onClick={handleSave}>
            Save Changes
          </button>
        </>
      }
    >
      {/* SYSTEM PROMPT TAB */}
      {activeTab === 'system' && (
        <div className={styles.sectionStack}>
          {/* 1. MERGED MODE */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsMergedOpen(!isMergedOpen)}>
                <AccordionArrow isExpanded={isMergedOpen} />
                <strong>System Prompt (Merged Mode)</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => { setLocalMergedHeader(DEFAULT_PROMPT_HEADER_MERGED); setLocalMergedFooter(DEFAULT_PROMPT_FOOTER_MERGED); }}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditMerged ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditMerged(!isEditMerged)}>
                  {isEditMerged ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isMergedOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '140px', opacity: isEditMerged ? 1 : 0.7 }}
                  value={localMergedHeader}
                  onChange={e => setLocalMergedHeader(e.target.value)}
                  readOnly={!isEditMerged}
                />
                <div className={styles.slotNotice}>[Previous Status Reference & Delta Schema JSON will be injected here]</div>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '140px', opacity: isEditMerged ? 1 : 0.7 }}
                  value={localMergedFooter}
                  onChange={e => setLocalMergedFooter(e.target.value)}
                  readOnly={!isEditMerged}
                />
              </div>
            )}
          </div>

          {/* 2. SEPARATED MODE */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsReadOnlyOpen(!isReadOnlyOpen)}>
                <AccordionArrow isExpanded={isReadOnlyOpen} />
                <strong>System Prompt (Separated Mode)</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => setLocalReadOnlyPrompt(DEFAULT_READONLY_CONTEXT_HEADER)}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditReadOnly ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditReadOnly(!isEditReadOnly)}>
                  {isEditReadOnly ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isReadOnlyOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '160px', opacity: isEditReadOnly ? 1 : 0.7 }}
                  value={localReadOnlyPrompt}
                  onChange={e => setLocalReadOnlyPrompt(e.target.value)}
                  readOnly={!isEditReadOnly}
                />
                <div className={styles.slotNotice}>[Live RPG Status (Values only) will be appended here]</div>
              </div>
            )}
          </div>

          {/* 3. MANUAL UPDATE MODE */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsSepOpen(!isSepOpen)}>
                <AccordionArrow isExpanded={isSepOpen} />
                <strong>System Prompt (Manual Update Mode)</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => { setLocalSepHeader(DEFAULT_PROMPT_HEADER_SEP); setLocalSepFooter(DEFAULT_PROMPT_FOOTER_SEP); }}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditSep ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditSep(!isEditSep)}>
                  {isEditSep ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isSepOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '140px', opacity: isEditSep ? 1 : 0.7 }}
                  value={localSepHeader}
                  onChange={e => setLocalSepHeader(e.target.value)}
                  readOnly={!isEditSep}
                />
                <div className={styles.slotNotice}>[Previous Status Reference & Delta Schema JSON will be injected here]</div>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '140px', opacity: isEditSep ? 1 : 0.7 }}
                  value={localSepFooter}
                  onChange={e => setLocalSepFooter(e.target.value)}
                  readOnly={!isEditSep}
                />
              </div>
            )}
          </div>

          {/* SCHEMA PROMPT PREVIEW */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsSchemaOpen(!isSchemaOpen)}>
                <AccordionArrow isExpanded={isSchemaOpen} />
                <strong>Schema Prompt Preview</strong>
              </div>
            </div>
            {isSchemaOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '180px', opacity: 0.8, fontFamily: 'monospace', fontSize: '11px' }}
                  value={previewSchema.trim()}
                  readOnly={true}
                />
              </div>
            )}

            {/* SWITCHES */}
            <div className={styles.switchesContainer}>
              {['status', 'profile', 'relations', 'inventory', 'quests'].map(guideId => {
                const guide = localGuidePrompts.find(g => g.id === guideId);
                if (!guide) return null;
                return (
                  <div key={guideId} className={styles.switchCardRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.switchTitle}>Update {guideId.charAt(0).toUpperCase() + guideId.slice(1)}</span>
                      <ToggleSwitch
                        checked={guide.enabled}
                        onChange={(checked) => handleGuideToggle(guideId, checked)}
                      />
                    </div>
                    <textarea
                      className={styles.guidePromptTextarea}
                      value={guide.prompt || ''}
                      onChange={(e) => handleGuidePromptChange(guideId, e.target.value)}
                      placeholder={`Instruction prompt for ${guideId}...`}
                      disabled={!guide.enabled}
                    />
                  </div>
                );
              })}

              <div className={styles.worldStateGroupCard}>
                <div className={styles.groupCardHeader}>World State</div>

                {[
                  { id: 'world_date', name: 'Update Date', selectKey: 'dateSelect', customKey: 'dateCustom', opts: DATE_OPTS },
                  { id: 'world_time', name: 'Update Time', selectKey: 'timeSelect', customKey: 'timeCustom', opts: TIME_OPTS },
                  { id: 'world_weather', name: 'Update Weather', selectKey: 'weatherSelect', customKey: 'weatherCustom', opts: WEATHER_OPTS },
                  { id: 'world_location', name: 'Update Location', selectKey: 'locationSelect', customKey: 'locationCustom', opts: LOCATION_OPTS }
                ].map(f => {
                  const guide = localGuidePrompts.find(g => g.id === f.id);
                  if (!guide) return null;
                  return (
                    <div key={f.id} className={styles.worldStateSubRow} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className={styles.switchCardRow} style={{ padding: 0, background: 'transparent', border: 'none' }}>
                        <span className={styles.switchTitle}>{f.name}</span>
                        <ToggleSwitch
                          checked={guide.enabled}
                          onChange={(checked) => handleGuideToggle(f.id, checked)}
                        />
                      </div>
                      <div className={styles.inlineFormRow}>
                        <select
                          className={`rpg-select-custom ${styles.worldSelect}`}
                          value={localWorldSchema[f.selectKey] || '1'}
                          onChange={e => handleWorldSchemaChange(f.selectKey, e.target.value, f.opts)}
                        >
                          {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                        <input
                          type="text"
                          className={`rpg-input ${styles.worldInput}`}
                          value={localWorldSchema[f.customKey] || ''}
                          onChange={e => handleWorldSchemaChange(f.customKey, e.target.value)}
                          readOnly={localWorldSchema[f.selectKey] !== 'custom'}
                          placeholder="Format Example"
                        />
                      </div>
                      <textarea
                        className={styles.guidePromptTextarea}
                        value={guide.prompt || ''}
                        onChange={(e) => handleGuidePromptChange(f.id, e.target.value)}
                        placeholder={`Instruction prompt for ${f.name.toLowerCase()}...`}
                        disabled={!guide.enabled}
                      />
                    </div>
                  );
                })}

                {(() => {
                  const guide = localGuidePrompts.find(g => g.id === 'world_events');
                  if (!guide) return null;
                  return (
                    <div className={styles.worldStateSubRow} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className={styles.switchCardRow} style={{ padding: '4px 0', background: 'transparent', border: 'none' }}>
                        <span className={styles.switchTitle}>Update Events</span>
                        <ToggleSwitch
                          checked={guide.enabled}
                          onChange={(checked) => handleGuideToggle('world_events', checked)}
                        />
                      </div>
                      <textarea
                        className={styles.guidePromptTextarea}
                        value={guide.prompt || ''}
                        onChange={(e) => handleGuidePromptChange('world_events', e.target.value)}
                        placeholder="Instruction prompt for world events..."
                        disabled={!guide.enabled}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INJECTION TAB */}
      {activeTab === 'injection' && (
        <div className={styles.sectionStack}>
          {/* Preset Buttons & Guidance Bar */}
          <div className={styles.injectionPresetBar}>
            <div className={styles.injectionPresetHeader}>
              <strong>Preset Profiles</strong>
              <span>Choose a proven injection layout or configure each module manually below.</span>
            </div>
            <div className={styles.presetOptionsList}>
              <div className={styles.presetOptionRow}>
                <button
                  type="button"
                  className="rpg-btn"
                  onClick={() => handleApplyInjectionPreset('optimized')}
                >
                  Optimized
                </button>
                <span className={styles.presetOptionDesc}>
                  Rules in System Prompt, Status at Chat Depth 1, Add-ons & Output Enforcer at Chat Depth 0.
                </span>
              </div>
              <div className={styles.presetOptionRow}>
                <button
                  type="button"
                  className="rpg-btn"
                  onClick={() => handleApplyInjectionPreset('simple')}
                >
                  Simple
                </button>
                <span className={styles.presetOptionDesc}>
                  Injects all tracker rules, status reference, and add-ons into the main system prompt.
                </span>
              </div>
            </div>
          </div>

          {/* Module: Rules & Definitions */}
          {(() => {
            const mod = modulesConfig.rules_defs || {};
            const target = mod.target === INJECTION_TARGETS.CHAT ? INJECTION_TARGETS.CHAT : INJECTION_TARGETS.SYSTEM;
            const depth = mod.depth;

            return (
              <div className={styles.injectionModuleCard}>
                <div className={styles.injectionModuleHeader}>
                  <div className={styles.injectionModuleTitleGroup}>
                    <strong>Rules & Definitions</strong>
                    <span className={styles.injectionModuleSub}>
                      Core GM instructions, dynamic delta schema example, update rules, and field definitions.
                    </span>
                  </div>
                </div>

                <div className={styles.injectionControlGrid}>
                  <div className={styles.injectionFieldCol}>
                    <label className={styles.formSubLabel}>Position Mode</label>
                    <select
                      className="rpg-select-custom"
                      value={target}
                      onChange={(e) => handleUpdateModuleField('rules_defs', 'target', e.target.value)}
                    >
                      <option value={INJECTION_TARGETS.SYSTEM}>System Prompt (After Main)</option>
                      <option value={INJECTION_TARGETS.CHAT}>In-Chat Log (@ Depth)</option>
                    </select>
                  </div>

                  {target === INJECTION_TARGETS.CHAT && (
                    <div className={styles.injectionFieldCol}>
                      <label className={styles.formSubLabel}>Chat Depth (0 = End)</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="rpg-input"
                        style={{ height: '28px', maxWidth: '120px' }}
                        value={depth !== undefined ? depth : 0}
                        onChange={(e) => handleDepthChange('rules_defs', e.target.value)}
                        onBlur={(e) => handleDepthBlur('rules_defs', e.target.value, 0)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Module: Status Reference */}
          {(() => {
            const mod = modulesConfig.status || {};
            const target = mod.target === INJECTION_TARGETS.SYSTEM ? INJECTION_TARGETS.SYSTEM : INJECTION_TARGETS.CHAT;
            const depth = mod.depth;

            return (
              <div className={styles.injectionModuleCard}>
                <div className={styles.injectionModuleHeader}>
                  <div className={styles.injectionModuleTitleGroup}>
                    <strong>Status Reference</strong>
                    <span className={styles.injectionModuleSub}>
                      Live character status, profile, inventory, quests, and world state JSON up to the previous turn.
                    </span>
                  </div>
                </div>

                <div className={styles.injectionControlGrid}>
                  <div className={styles.injectionFieldCol}>
                    <label className={styles.formSubLabel}>Position Mode</label>
                    <select
                      className="rpg-select-custom"
                      value={target}
                      onChange={(e) => handleUpdateModuleField('status', 'target', e.target.value)}
                    >
                      <option value={INJECTION_TARGETS.SYSTEM}>System Prompt (After Main)</option>
                      <option value={INJECTION_TARGETS.CHAT}>In-Chat Log (@ Depth)</option>
                    </select>
                  </div>

                  {target === INJECTION_TARGETS.CHAT && (
                    <div className={styles.injectionFieldCol}>
                      <label className={styles.formSubLabel}>Chat Depth (Recommended: 1)</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="rpg-input"
                        style={{ height: '28px', maxWidth: '120px' }}
                        value={depth !== undefined ? depth : 1}
                        onChange={(e) => handleDepthChange('status', e.target.value)}
                        onBlur={(e) => handleDepthBlur('status', e.target.value, 1)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Module: Add-ons & Output Enforcer */}
          {(() => {
            const mod = modulesConfig.addons_enforcer || {};
            const target = mod.target === INJECTION_TARGETS.SYSTEM ? INJECTION_TARGETS.SYSTEM : INJECTION_TARGETS.CHAT;
            const depth = mod.depth;

            return (
              <div className={styles.injectionModuleCard}>
                <div className={styles.injectionModuleHeader}>
                  <div className={styles.injectionModuleTitleGroup}>
                    <strong>Add-ons & Output Enforcer</strong>
                    <span className={styles.injectionModuleSub}>
                      Active addon instructions (Weather, CYOA, World Events) and the mandatory HTML comment output enforcer.
                    </span>
                  </div>
                </div>

                <div className={styles.injectionControlGrid}>
                  <div className={styles.injectionFieldCol}>
                    <label className={styles.formSubLabel}>Position Mode</label>
                    <select
                      className="rpg-select-custom"
                      value={target}
                      onChange={(e) => handleUpdateModuleField('addons_enforcer', 'target', e.target.value)}
                    >
                      <option value={INJECTION_TARGETS.SYSTEM}>System Prompt (After Main)</option>
                      <option value={INJECTION_TARGETS.CHAT}>In-Chat Log (@ Depth)</option>
                    </select>
                  </div>

                  {target === INJECTION_TARGETS.CHAT && (
                    <div className={styles.injectionFieldCol}>
                      <label className={styles.formSubLabel}>Chat Depth (Recommended: 0)</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="rpg-input"
                        style={{ height: '28px', maxWidth: '120px' }}
                        value={depth !== undefined ? depth : 0}
                        onChange={(e) => handleDepthChange('addons_enforcer', e.target.value)}
                        onBlur={(e) => handleDepthBlur('addons_enforcer', e.target.value, 0)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Output Format Enforcer Directive */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsEnforcerOpen(!isEnforcerOpen)}>
                <AccordionArrow isExpanded={isEnforcerOpen} />
                <strong>Output Format Enforcer Directive</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className="rpg-btn"
                  onClick={() => setLocalEnforcerPrompt(
                    (settings?.updateMode || 'merged') === 'merged' ? DEFAULT_OUTPUT_ENFORCER : DEFAULT_OUTPUT_ENFORCER_SEP
                  )}
                >
                  Reset
                </button>
                <button type="button" className={`rpg-btn ${isEditEnforcer ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditEnforcer(!isEditEnforcer)}>
                  {isEditEnforcer ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isEnforcerOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '90px', opacity: isEditEnforcer ? 1 : 0.7 }}
                  value={localEnforcerPrompt}
                  onChange={e => setLocalEnforcerPrompt(e.target.value)}
                  readOnly={!isEditEnforcer}
                />
                <div className={styles.slotNotice}>
                  [Forces the LLM to begin outputting with the JSON block. In Merged mode, it is injected based on the 'Add-ons & Enforcer' module position. During manual [Update], any custom directive set here is automatically appended to the very end of the update prompt across all modes.]
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD-ONS TAB */}
      {activeTab === 'addons' && (
        <div className={styles.sectionStack}>
          {/* 1. BASE NPC GENERATION PROMPT */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsAddCharOpen(!isAddCharOpen)}>
                <AccordionArrow isExpanded={isAddCharOpen} />
                <strong>NPC Generation Base Prompt</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => setLocalAddCharPrompt(DEFAULT_ADD_CHAR_PROMPT)}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditAddChar ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditAddChar(!isEditAddChar)}>
                  {isEditAddChar ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isAddCharOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '100px', opacity: isEditAddChar ? 1 : 0.7 }}
                  value={localAddCharPrompt}
                  onChange={e => setLocalAddCharPrompt(e.target.value)}
                  readOnly={!isEditAddChar}
                />
              </div>
            )}
          </div>

          {/* 2. BASE PLAYER GENERATION PROMPT */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsAddPlayerCharOpen(!isAddPlayerCharOpen)}>
                <AccordionArrow isExpanded={isAddPlayerCharOpen} />
                <strong>Player Generation Base Prompt</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => setLocalAddPlayerCharPrompt(DEFAULT_ADD_PLAYER_CHAR_PROMPT)}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditAddPlayerChar ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditAddPlayerChar(!isEditAddPlayerChar)}>
                  {isEditAddPlayerChar ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isAddPlayerCharOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '100px', opacity: isEditAddPlayerChar ? 1 : 0.7 }}
                  value={localAddPlayerCharPrompt}
                  onChange={e => setLocalAddPlayerCharPrompt(e.target.value)}
                  readOnly={!isEditAddPlayerChar}
                />
              </div>
            )}
          </div>

          {/* 3. WORLD EVENTS ADDON PROMPT */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsWorldEventsOpen(!isWorldEventsOpen)}>
                <AccordionArrow isExpanded={isWorldEventsOpen} />
                <strong>World Events Instruction</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => setLocalWorldEventsPrompt(DEFAULT_WORLD_EVENTS_PROMPT)}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditWorldEvents ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditWorldEvents(!isEditWorldEvents)}>
                  {isEditWorldEvents ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isWorldEventsOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '80px', opacity: isEditWorldEvents ? 1 : 0.7 }}
                  value={localWorldEventsPrompt}
                  onChange={e => setLocalWorldEventsPrompt(e.target.value)}
                  readOnly={!isEditWorldEvents}
                />
              </div>
            )}
          </div>

          {/* 4. DYNAMIC WEATHER ADDON PROMPT */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsWeatherOpen(!isWeatherOpen)}>
                <AccordionArrow isExpanded={isWeatherOpen} />
                <strong>Dynamic Weather Instruction</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => setLocalWeatherPrompt(DEFAULT_WEATHER_PROMPT)}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditWeather ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditWeather(!isEditWeather)}>
                  {isEditWeather ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isWeatherOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '80px', opacity: isEditWeather ? 1 : 0.7 }}
                  value={localWeatherPrompt}
                  onChange={e => setLocalWeatherPrompt(e.target.value)}
                  readOnly={!isEditWeather}
                />
              </div>
            )}
          </div>

          {/* 5. CYOA MODE ADDON PROMPT */}
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div className={styles.accordionHeader} onClick={() => setIsCyoaOpen(!isCyoaOpen)}>
                <AccordionArrow isExpanded={isCyoaOpen} />
                <strong>CYOA Mode Instruction</strong>
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" className="rpg-btn" onClick={() => setLocalCyoaPrompt(DEFAULT_CYOA_PROMPT)}>Reset</button>
                <button type="button" className={`rpg-btn ${isEditCyoa ? 'rpg-btn-primary' : ''}`} onClick={() => setIsEditCyoa(!isEditCyoa)}>
                  {isEditCyoa ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {isCyoaOpen && (
              <div className={styles.textareaStack}>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: '80px', opacity: isEditCyoa ? 1 : 0.7 }}
                  value={localCyoaPrompt}
                  onChange={e => setLocalCyoaPrompt(e.target.value)}
                  readOnly={!isEditCyoa}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </ModalLayout>
  );
}