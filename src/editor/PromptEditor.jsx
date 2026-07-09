// src/editor/PromptEditor.jsx
import React, { useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './PromptEditor.module.css';
import {
  DEFAULT_PROMPT_HEADER_MERGED,
  DEFAULT_PROMPT_FOOTER_MERGED,
  DEFAULT_PROMPT_HEADER_SEP,
  DEFAULT_PROMPT_FOOTER_SEP,
  DEFAULT_READONLY_CONTEXT_HEADER,
  getDefaultCharacters,
  DEFAULT_GUIDE_PROMPTS,
  DEFAULT_ADD_CHAR_PROMPT,
  DEFAULT_ADD_PLAYER_CHAR_PROMPT
} from '../core/PromptSchema';
import { getDynamicSchemaExample } from '../core/ActivePrompt';

export default function PromptEditor({ onClose }) {
  const { trackerData, updateTrackerData, isChatConnected } = useRPG();
  const [activeTab, setActiveTab] = useState('system'); // 'system', 'addons', 'definitions'

  const [localMergedHeader, setLocalMergedHeader] = useState('');
  const [localMergedFooter, setLocalMergedFooter] = useState('');
  const [localReadOnlyPrompt, setLocalReadOnlyPrompt] = useState('');
  const [localSepHeader, setLocalSepHeader] = useState('');
  const [localSepFooter, setLocalSepFooter] = useState('');

  const [localAddCharPrompt, setLocalAddCharPrompt] = useState('');
  const [localAddPlayerCharPrompt, setLocalAddPlayerCharPrompt] = useState('');

  const [charNameInput, setCharNameInput] = useState('');
  const [playerCharNameInput, setPlayerCharNameInput] = useState('');

  const [isEditMerged, setIsEditMerged] = useState(false);
  const [isEditReadOnly, setIsEditReadOnly] = useState(false);
  const [isEditSep, setIsEditSep] = useState(false);
  const [isEditAddChar, setIsEditAddChar] = useState(false);
  const [isEditAddPlayerChar, setIsEditAddPlayerChar] = useState(false);

  // 시스템 프롬프트 에디터 아코디언 기본 상태를 전부 닫힘(false)으로 수정
  const [isMergedOpen, setIsMergedOpen] = useState(false);
  const [isReadOnlyOpen, setIsReadOnlyOpen] = useState(false);
  const [isSepOpen, setIsSepOpen] = useState(false);

  const [isSchemaOpen, setIsSchemaOpen] = useState(true);
  const [isAddCharOpen, setIsAddCharOpen] = useState(false);
  const [isAddPlayerCharOpen, setIsAddPlayerCharOpen] = useState(false);

  const [localGuidePrompts, setLocalGuidePrompts] = useState([]);
  const [localDefObj, setLocalDefObj] = useState({});
  const [localWorldSchema, setLocalWorldSchema] = useState({});

  const characters = (trackerData.characters && trackerData.characters.length > 0)
    ? trackerData.characters
    : getDefaultCharacters();

  const getUniqueFields = () => {
    const status = new Set();
    const profiles = new Set();
    const relations = new Set();

    characters.forEach(char => {
      (char.statusSchema || []).forEach(s => {
        if (s.name) status.add(s.name);
      });

      if (char.profile) {
        Object.keys(char.profile).forEach(k => profiles.add(k));
      }

      if (char.relations) {
        Object.values(char.relations).forEach(rel => {
          if (rel.values) {
            Object.keys(rel.values).forEach(m => relations.add(m));
          }
        });
      }
    });

    return {
      status: Array.from(status),
      profiles: Array.from(profiles),
      relations: Array.from(relations)
    };
  };

  const uniqueFields = getUniqueFields();

  useEffect(() => {
    setLocalMergedHeader(trackerData.systemPromptHeader_merged ?? DEFAULT_PROMPT_HEADER_MERGED);
    setLocalMergedFooter(trackerData.systemPromptFooter_merged ?? DEFAULT_PROMPT_FOOTER_MERGED);
    setLocalReadOnlyPrompt(trackerData.systemPrompt_readonly ?? DEFAULT_READONLY_CONTEXT_HEADER);
    setLocalSepHeader(trackerData.systemPromptHeader_separated ?? DEFAULT_PROMPT_HEADER_SEP);
    setLocalSepFooter(trackerData.systemPromptFooter_separated ?? DEFAULT_PROMPT_FOOTER_SEP);

    setLocalAddCharPrompt(trackerData.addCharPrompt ?? DEFAULT_ADD_CHAR_PROMPT);
    setLocalAddPlayerCharPrompt(trackerData.addPlayerCharPrompt ?? DEFAULT_ADD_PLAYER_CHAR_PROMPT);

    let savedGuides = trackerData.guidePrompts ? [...trackerData.guidePrompts] : JSON.parse(JSON.stringify(DEFAULT_GUIDE_PROMPTS));

    DEFAULT_GUIDE_PROMPTS.forEach(defaultGuide => {
      if (!savedGuides.find(g => g.id === defaultGuide.id)) {
        savedGuides.push(defaultGuide);
      }
    });

    setLocalGuidePrompts(savedGuides);
    setLocalDefObj(trackerData.globalDefinitions || {});
    setLocalWorldSchema(trackerData.worldSchema || {
      dateSelect: '1', dateCustom: 'yyyy-mm-dd',
      timeSelect: '1', timeCustom: '14:30',
      weatherSelect: '1', weatherCustom: 'Clear/Cloudy/Rain/Snow',
      locationSelect: '1', locationCustom: 'Current Location',
      relationsFieldType: 'integer'
    });
  }, [trackerData]);

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
    { v: '4', l: 'Emojis', ex: '🌅/☀️/🕛/🌇/🌙' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];
  const WEATHER_OPTS = [
    { v: '1', l: 'Text', ex: 'Clear/Cloudy/Rain/Snow' },
    { v: '2', l: 'Emojis', ex: '☀️/☁️/🌧️/❄️' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];
  const LOC_OPTS = [
    { v: '1', l: 'Default', ex: 'Current Location' },
    { v: 'custom', l: 'Custom', ex: '' }
  ];

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

  const handleSave = () => {
    updateTrackerData({
      ...trackerData,
      systemPromptHeader_merged: localMergedHeader,
      systemPromptFooter_merged: localMergedFooter,
      systemPrompt_readonly: localReadOnlyPrompt,
      systemPromptHeader_separated: localSepHeader,
      systemPromptFooter_separated: localSepFooter,
      guidePrompts: localGuidePrompts,
      globalDefinitions: localDefObj,
      worldSchema: localWorldSchema,
      addCharPrompt: localAddCharPrompt,
      addPlayerCharPrompt: localAddPlayerCharPrompt
    });
    alert("Prompt configurations saved successfully.");
    onClose();
  };

  const handleExport = () => {
    const exportData = {
      systemPromptHeader_merged: localMergedHeader,
      systemPromptFooter_merged: localMergedFooter,
      systemPrompt_readonly: localReadOnlyPrompt,
      systemPromptHeader_separated: localSepHeader,
      systemPromptFooter_separated: localSepFooter,
      guidePrompts: localGuidePrompts,
      globalDefinitions: localDefObj,
      worldSchema: localWorldSchema,
      addCharPrompt: localAddCharPrompt,
      addPlayerCharPrompt: localAddPlayerCharPrompt
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
          if (Array.isArray(importedData.guidePrompts)) setLocalGuidePrompts(importedData.guidePrompts);
          if (importedData.globalDefinitions && typeof importedData.globalDefinitions === 'object') setLocalDefObj(importedData.globalDefinitions);
          if (importedData.worldSchema && typeof importedData.worldSchema === 'object') setLocalWorldSchema(importedData.worldSchema);
          if (importedData.addCharPrompt !== undefined) setLocalAddCharPrompt(importedData.addCharPrompt);
          if (importedData.addPlayerCharPrompt !== undefined) setLocalAddPlayerCharPrompt(importedData.addPlayerCharPrompt);

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

  const handleSendRequest = async (type) => {
    if (!isChatConnected) {
      alert("Not connected to a chat room. Please connect to a chat room to use this feature.");
      return;
    }
    const isPlayer = type === 'player';
    const name = isPlayer ? playerCharNameInput.trim() : charNameInput.trim();
    const basePrompt = isPlayer ? localAddPlayerCharPrompt : localAddCharPrompt;

    let cardDescription = "";
    try {
      const stContext = window.SillyTavern?.getContext?.();
      if (stContext && name) {
        const matchedCard = stContext.characters?.find(
          c => c.name?.toLowerCase() === name.toLowerCase()
        );

        if (matchedCard) {
          cardDescription = `\n\n[ORIGINAL CHARACTER CARD DETAILS FOR '${name}']`;
          if (matchedCard.description) cardDescription += `\nDescription:\n${matchedCard.description}`;
          if (matchedCard.personality) cardDescription += `\nPersonality:\n${matchedCard.personality}`;
        }
      }
    } catch (err) {
      console.warn("SillyTavern context is not fully available or character search failed:", err);
    }

    const schemaExample = getDynamicSchemaExample({ guidePrompts: localGuidePrompts, characters }, isPlayer);

    let finalPrompt = "";
    if (name) {
      finalPrompt = `Based on the chat log, create a profile for '${name}' following these guidelines:\n${basePrompt}`;
      if (cardDescription) {
        finalPrompt += cardDescription;
      }
      finalPrompt += `\n\nStrictly output the JSON block following this exact schema layout:\n${schemaExample.trim()}`;
    } else {
      finalPrompt = `Based on the recent chat log, identify a new or existing character that needs a profile and generate one. Guidelines:\n${basePrompt}\n\nStrictly output the JSON block following this exact schema layout:\n${schemaExample.trim()}`;
    }

    if (window.RPGBridge && typeof window.RPGBridge.triggerCharacterGeneration === 'function') {
      alert(`Requesting to add ${isPlayer ? 'Player Character' : 'Character'} '${name || 'Auto-Detect'}'... This may take a moment.`);
      try {
        await window.RPGBridge.triggerCharacterGeneration(finalPrompt, isPlayer);
      } catch (err) {
        console.error(err);
        alert("An error occurred during character generation.");
      }
    }
  };

  const handleGuideToggle = (id, checked) => {
    setLocalGuidePrompts(prev => prev.map(g => g.id === id ? { ...g, enabled: checked } : g));
  };

  const clearDefinitions = () => {
    if (window.confirm("Clear all field definitions?")) {
      setLocalDefObj({});
    }
  };

  const previewSchema = getDynamicSchemaExample({ guidePrompts: localGuidePrompts, characters });

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <h4>Prompt Editor</h4>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.editorTabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'system' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System Prompt
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'addons' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('addons')}
          >
            Add-ons
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'definitions' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('definitions')}
          >
            Field Definitions
          </button>
        </div>

        <div className={styles.body} style={{ padding: '16px', overflowY: 'auto' }}>
          {activeTab === 'system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* 1. MERGED MODE */}
              <div style={{ border: '1px solid var(--rpg-border)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsMergedOpen(!isMergedOpen)}>
                    <span style={{ color: 'var(--rpg-highlight)' }}>{isMergedOpen ? '▼' : '▶'}</span>
                    <strong style={{ color: 'var(--rpg-highlight)' }}>System Prompt (Merged Mode)</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => { setLocalMergedHeader(DEFAULT_PROMPT_HEADER_MERGED); setLocalMergedFooter(DEFAULT_PROMPT_FOOTER_MERGED); }}>reset</button>
                    <button className={isEditMerged ? styles.saveBtn : styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setIsEditMerged(!isEditMerged)}>edit</button>
                  </div>
                </div>
                {isMergedOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className={styles.textarea}
                      style={{ minHeight: '140px', opacity: isEditMerged ? 1 : 0.7 }}
                      value={localMergedHeader}
                      onChange={e => setLocalMergedHeader(e.target.value)}
                      readOnly={!isEditMerged}
                    />
                    <div style={{ fontSize: '11px', textAlign: 'center', opacity: 0.5, color: 'var(--rpg-text)' }}>[Schema Block will be injected here]</div>
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

              {/* 2. SEPARATED MODE (매턴 상태값 참조 주입 헤더 설정) */}
              <div style={{ border: '1px solid var(--rpg-border)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsReadOnlyOpen(!isReadOnlyOpen)}>
                    <span style={{ color: 'var(--rpg-highlight)' }}>{isReadOnlyOpen ? '▼' : '▶'}</span>
                    <strong style={{ color: 'var(--rpg-highlight)' }}>System Prompt (Separated Mode)</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setLocalReadOnlyPrompt(DEFAULT_READONLY_CONTEXT_HEADER)}>reset</button>
                    <button className={isEditReadOnly ? styles.saveBtn : styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setIsEditReadOnly(!isEditReadOnly)}>edit</button>
                  </div>
                </div>
                {isReadOnlyOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className={styles.textarea}
                      style={{ minHeight: '160px', opacity: isEditReadOnly ? 1 : 0.7 }}
                      value={localReadOnlyPrompt}
                      onChange={e => setLocalReadOnlyPrompt(e.target.value)}
                      readOnly={!isEditReadOnly}
                    />
                    <div style={{ fontSize: '11px', textAlign: 'center', opacity: 0.5, color: 'var(--rpg-text)' }}>[Live RPG Status & Static Definitions will be appended here]</div>
                  </div>
                )}
              </div>

              {/* 3. MANUAL UPDATE MODE (Separated & Isolated 모드용 수동 갱신 프롬프트) */}
              <div style={{ border: '1px solid var(--rpg-border)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsSepOpen(!isSepOpen)}>
                    <span style={{ color: 'var(--rpg-highlight)' }}>{isSepOpen ? '▼' : '▶'}</span>
                    <strong style={{ color: 'var(--rpg-highlight)' }}>System Prompt (Manual Update Mode)</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => { setLocalSepHeader(DEFAULT_PROMPT_HEADER_SEP); setLocalSepFooter(DEFAULT_PROMPT_FOOTER_SEP); }}>reset</button>
                    <button className={isEditSep ? styles.saveBtn : styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setIsEditSep(!isEditSep)}>edit</button>
                  </div>
                </div>
                {isSepOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className={styles.textarea}
                      style={{ minHeight: '140px', opacity: isEditSep ? 1 : 0.7 }}
                      value={localSepHeader}
                      onChange={e => setLocalSepHeader(e.target.value)}
                      readOnly={!isEditSep}
                    />
                    <div style={{ fontSize: '11px', textAlign: 'center', opacity: 0.5, color: 'var(--rpg-text)' }}>[Schema Block will be injected here]</div>
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
              <div style={{ border: '1px solid var(--rpg-border)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsSchemaOpen(!isSchemaOpen)}>
                    <span style={{ color: 'var(--rpg-highlight)' }}>{isSchemaOpen ? '▼' : '▶'}</span>
                    <strong style={{ color: 'var(--rpg-highlight)' }}>Schema Prompt Preview</strong>
                  </div>
                </div>
                {isSchemaOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className={styles.textarea}
                      style={{ minHeight: '180px', opacity: 0.8, fontFamily: 'monospace', fontSize: '11px' }}
                      value={previewSchema.trim()}
                      readOnly={true}
                    />
                  </div>
                )}

                {/* SWITCHES */}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['status', 'profile'].map(guideId => {
                    const guide = localGuidePrompts.find(g => g.id === guideId);
                    if (!guide) return null;
                    return (
                      <div key={guideId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--rpg-bg)', border: '1px solid var(--rpg-border)', borderRadius: '4px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--rpg-text)' }}>Update {guideId.charAt(0).toUpperCase() + guideId.slice(1)}</span>
                        <label className={styles.switch} style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={guide.enabled}
                            onChange={(e) => handleGuideToggle(guideId, e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                    );
                  })}

                  {(() => {
                    const guide = localGuidePrompts.find(g => g.id === 'relations');
                    if (!guide) return null;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--rpg-bg)', border: '1px solid var(--rpg-border)', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: 'var(--rpg-text)' }}>Update Relations</span>
                          <label className={styles.switch} style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={guide.enabled}
                              onChange={(e) => handleGuideToggle('relations', e.target.checked)}
                            />
                            <span className={styles.slider}></span>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--rpg-text)', opacity: 0.8, whiteSpace: 'nowrap' }}>Field type</span>
                          <select
                            style={{ flex: 1, height: '28px', boxSizing: 'border-box', margin: 0, verticalAlign: 'middle', lineHeight: 'normal', background: 'rgba(0,0,0,0.2)', color: 'var(--rpg-text)', border: '1px solid var(--rpg-border)', borderRadius: '4px', fontSize: '11px', padding: '0 6px', outline: 'none' }}
                            value={localWorldSchema.relationsFieldType || 'integer'}
                            onChange={e => handleWorldSchemaChange('relationsFieldType', e.target.value)}
                          >
                            <option value="none">none</option>
                            <option value="integer">integer</option>
                            <option value="stacking">stacking</option>
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {['inventory', 'quests'].map(guideId => {
                    const guide = localGuidePrompts.find(g => g.id === guideId);
                    if (!guide) return null;
                    return (
                      <div key={guideId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--rpg-bg)', border: '1px solid var(--rpg-border)', borderRadius: '4px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--rpg-text)' }}>Update {guideId.charAt(0).toUpperCase() + guideId.slice(1)}</span>
                        <label className={styles.switch} style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={guide.enabled}
                            onChange={(e) => handleGuideToggle(guideId, e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                    );
                  })}

                  <div style={{ padding: '12px', background: 'var(--rpg-bg)', border: '1px solid var(--rpg-border)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--rpg-highlight)', marginBottom: '4px' }}>World State</div>

                    {[
                      { id: 'world_date', name: 'Update Date', selectKey: 'dateSelect', customKey: 'dateCustom', opts: DATE_OPTS },
                      { id: 'world_time', name: 'Update Time', selectKey: 'timeSelect', customKey: 'timeCustom', opts: TIME_OPTS },
                      { id: 'world_weather', name: 'Update Weather', selectKey: 'weatherSelect', customKey: 'weatherCustom', opts: WEATHER_OPTS }
                    ].map(f => {
                      const guide = localGuidePrompts.find(g => g.id === f.id);
                      if (!guide) return null;
                      return (
                        <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--rpg-text)' }}>{f.name}</span>
                            <label className={styles.switch} style={{ margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={guide.enabled}
                                onChange={(e) => handleGuideToggle(f.id, e.target.checked)}
                              />
                              <span className={styles.slider}></span>
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select
                              style={{ flex: 1, height: '28px', boxSizing: 'border-box', margin: 0, verticalAlign: 'middle', lineHeight: 'normal', background: 'rgba(0,0,0,0.2)', color: 'var(--rpg-text)', border: '1px solid var(--rpg-border)', borderRadius: '4px', fontSize: '11px', padding: '0 6px', outline: 'none' }}
                              value={localWorldSchema[f.selectKey] || '1'}
                              onChange={e => handleWorldSchemaChange(f.selectKey, e.target.value, f.opts)}
                            >
                              {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                            <input
                              style={{ flex: 2, height: '28px', boxSizing: 'border-box', margin: 0, verticalAlign: 'middle', lineHeight: 'normal', background: 'rgba(0,0,0,0.2)', color: 'var(--rpg-text)', border: '1px solid var(--rpg-border)', borderRadius: '4px', fontSize: '11px', padding: '0 8px', outline: 'none' }}
                              value={localWorldSchema[f.customKey] || ''}
                              onChange={e => handleWorldSchemaChange(f.customKey, e.target.value)}
                              readOnly={localWorldSchema[f.selectKey] !== 'custom'}
                              placeholder="Format Example"
                            />
                          </div>
                        </div>
                      );
                    })}

                    {(() => {
                      const guide = localGuidePrompts.find(g => g.id === 'world_location');
                      if (!guide) return null;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: 'var(--rpg-text)' }}>Update Location</span>
                          <label className={styles.switch} style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={guide.enabled}
                              onChange={(e) => handleGuideToggle('world_location', e.target.checked)}
                            />
                            <span className={styles.slider}></span>
                          </label>
                        </div>
                      );
                    })()}

                    {(() => {
                      const guide = localGuidePrompts.find(g => g.id === 'world_events');
                      if (!guide) return null;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: 'var(--rpg-text)' }}>Update Events</span>
                          <label className={styles.switch} style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={guide.enabled}
                              onChange={(e) => handleGuideToggle('world_events', e.target.checked)}
                            />
                            <span className={styles.slider}></span>
                          </label>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'addons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', opacity: 0.8, color: 'var(--rpg-text)' }}>Character Generation</p>

              {/* ADD CHARACTER */}
              <div style={{ border: '1px solid var(--rpg-border)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsAddCharOpen(!isAddCharOpen)}>
                    <span style={{ color: 'var(--rpg-highlight)' }}>{isAddCharOpen ? '▼' : '▶'}</span>
                    <strong style={{ color: 'var(--rpg-highlight)' }}>Add Character</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setLocalAddCharPrompt(DEFAULT_ADD_CHAR_PROMPT)}>reset</button>
                    <button className={isEditAddChar ? styles.saveBtn : styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setIsEditAddChar(!isEditAddChar)}>edit</button>
                    <button className={styles.saveBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => handleSendRequest('npc')}>Send Request</button>
                  </div>
                </div>
                {isAddCharOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--rpg-text)' }}>Target Name (Optional)</span>
                      <input
                        className={styles.defInput}
                        style={{ padding: '6px' }}
                        value={charNameInput}
                        onChange={e => setCharNameInput(e.target.value)}
                        placeholder="Leave blank to auto-detect from chat log"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--rpg-text)' }}>Base Prompt</span>
                      <textarea
                        className={styles.textarea}
                        style={{ minHeight: '80px', opacity: isEditAddChar ? 1 : 0.7 }}
                        value={localAddCharPrompt}
                        onChange={e => setLocalAddCharPrompt(e.target.value)}
                        readOnly={!isEditAddChar}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ADD PLAYER CHARACTER */}
              <div style={{ border: '1px solid var(--rpg-border)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsAddPlayerCharOpen(!isAddPlayerCharOpen)}>
                    <span style={{ color: 'var(--rpg-highlight)' }}>{isAddPlayerCharOpen ? '▼' : '▶'}</span>
                    <strong style={{ color: 'var(--rpg-highlight)' }}>Add Player Character</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setLocalAddPlayerCharPrompt(DEFAULT_ADD_PLAYER_CHAR_PROMPT)}>reset</button>
                    <button className={isEditAddPlayerChar ? styles.saveBtn : styles.cancelBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setIsEditAddPlayerChar(!isEditAddPlayerChar)}>edit</button>
                    <button className={styles.saveBtn} style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => handleSendRequest('player')}>Send Request</button>
                  </div>
                </div>
                {isAddPlayerCharOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--rpg-text)' }}>Target Name (Optional)</span>
                      <input
                        className={styles.defInput}
                        style={{ padding: '6px' }}
                        value={playerCharNameInput}
                        onChange={e => setPlayerCharNameInput(e.target.value)}
                        placeholder="Leave blank to auto-detect from chat log"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--rpg-text)' }}>Base Prompt</span>
                      <textarea
                        className={styles.textarea}
                        style={{ minHeight: '80px', opacity: isEditAddPlayerChar ? 1 : 0.7 }}
                        value={localAddPlayerCharPrompt}
                        onChange={e => setLocalAddPlayerCharPrompt(e.target.value)}
                        readOnly={!isEditAddPlayerChar}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'definitions' && (
            <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', marginTop: '8px' }}>
                <label className={styles.label} style={{ margin: 0 }}>Field Definitions</label>
                <button
                  onClick={clearDefinitions}
                  style={{ background: 'transparent', border: 'none', color: 'var(--rpg-highlight)', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Clear All
                </button>
              </div>
              <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, color: 'var(--rpg-text)' }}>Define guidelines for your fields. Leave empty to skip injection.</p>

              {uniqueFields.status.length > 0 && (
                <div className={styles.defGroup}>
                  <h5 className={styles.defGroupTitle}>Stat</h5>
                  {uniqueFields.status.map(f => (
                    <div key={`status_${f}`} className={styles.defRow}>
                      <span className={styles.defLabel}>{f}</span>
                      <input
                        className={styles.defInput}
                        value={localDefObj[`status_${f}`] || ''}
                        onChange={e => setLocalDefObj({ ...localDefObj, [`status_${f}`]: e.target.value })}
                        placeholder={`Guide for ${f}...`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {uniqueFields.profiles.length > 0 && (
                <div className={styles.defGroup}>
                  <h5 className={styles.defGroupTitle}>Profile</h5>
                  {uniqueFields.profiles.map(f => (
                    <div key={`profile_${f}`} className={styles.defRow}>
                      <span className={styles.defLabel}>{f}</span>
                      <input
                        className={styles.defInput}
                        value={localDefObj[`profile_${f}`] || ''}
                        onChange={e => setLocalDefObj({ ...localDefObj, [`profile_${f}`]: e.target.value })}
                        placeholder={`Guide for ${f}...`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {uniqueFields.relations.length > 0 && (
                <div className={styles.defGroup}>
                  <h5 className={styles.defGroupTitle}>Relations</h5>
                  {uniqueFields.relations.map(f => (
                    <div key={`relation_${f}`} className={styles.defRow}>
                      <span className={styles.defLabel}>{f}</span>
                      <input
                        className={styles.defInput}
                        value={localDefObj[`relation_${f}`] || ''}
                        onChange={e => setLocalDefObj({ ...localDefObj, [`relation_${f}`]: e.target.value })}
                        placeholder={`Guide for ${f}...`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className={styles.footer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '6px 12px' }} onClick={handleExport}>Export</button>
            <button className={styles.cancelBtn} style={{ fontSize: '11px', padding: '6px 12px' }} onClick={handleImportClick}>Import</button>
            <input
              type="file"
              id="prompt-import-file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
          </div>
        </footer>
      </div>
    </div>
  );
}