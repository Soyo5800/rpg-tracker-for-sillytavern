import React, { useState } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './StatusSection.module.css';
import StatusComponent from './StatusComponent';
import PlayerComponent from './PlayerComponent';
import CharListEditor from '../editor/CharListEditor';
import { getDefaultCharacters, createDefaultCharacter } from '../core/PromptSchema';
import {
  LockIcon,
  GearIcon,
  ProfileTabIcon,
  RelationsTabIcon,
  InventoryTabIcon,
  QuestsTabIcon,
  CameraIcon
} from '../Icons';
import { AutoGrowingTextArea, ToggleSwitch, AccordionArrow } from '../utils';
import { getNextCharacterId } from '../core/JSONTracker';
import { resolveEffectiveCharacterVisual } from '../core/AvatarResolver';

export default function StatusSection({ onOpenEditor, onOpenAssetManager }) {
  const {
    trackerData,
    updateTrackerData,
    patchCharacterField,
    uiState,
    updateUiState,
    activeVisualCharId,
    toggleVisualStage,
    customAvatars
  } = useRPG();

  const [showCharList, setShowCharList] = useState(false);

  const characters = (trackerData.characters && trackerData.characters.length > 0)
    ? trackerData.characters
    : getDefaultCharacters();

  const collapsedChars = uiState.collapsedChars || {};
  const activeInlineTabs = uiState.activeInlineTabs || {};

  const handleUpdateCharacters = (nextChars) => {
    if (updateTrackerData) {
      updateTrackerData({ ...trackerData, characters: nextChars });
    }
  };

  const handleValueChange = (charId, statId, newVal) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const schemaItem = (char.statusSchema || []).find(s => s.id === statId);
    let finalVal = newVal;
    if (schemaItem && schemaItem.type !== 'text') {
      if (newVal === '' || newVal === null || isNaN(newVal)) {
        patchCharacterField(charId, ['status', statId], '');
        return;
      }
      const minLimit = (schemaItem.min !== undefined && schemaItem.min !== null) ? Number(schemaItem.min) : 0;
      const maxLimit = (schemaItem.max !== undefined && schemaItem.max !== null) ? Number(schemaItem.max) : 100;
      finalVal = Math.min(maxLimit, Math.max(minLimit, Number(newVal)));
    }
    patchCharacterField(charId, ['status', statId], finalVal);
  };

  const toggleCollapse = (charId) => {
    const currentCollapsed = collapsedChars[charId] !== false;
    updateUiState({
      collapsedChars: { ...collapsedChars, [charId]: !currentCollapsed }
    });
  };

  const handleToggleInlineTab = (charId, tabName) => {
    const charTabs = activeInlineTabs[charId] || {
      profile: false, relations: false, inventory: false, quests: false
    };
    updateUiState({
      activeInlineTabs: {
        ...activeInlineTabs,
        [charId]: { ...charTabs, [tabName]: !charTabs[tabName] }
      }
    });
  };

  const handleCameraClick = (charId) => {
    if (typeof onOpenAssetManager === 'function') {
      onOpenAssetManager(charId);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topActionBar}>
        <button
          type="button"
          className="rpg-btn"
          style={{ flex: 1 }}
          onClick={() => {
            const newChar = createDefaultCharacter({ id: getNextCharacterId(characters), name: "New Character", activePlayer: false });

            let nextChars = (characters.length === 1 && characters[0].id === 'char_user' && characters[0].name === 'New')
              ? [newChar]
              : [...characters, newChar];
            handleUpdateCharacters(nextChars);
          }}
        >
          + Add Character
        </button>
        <button type="button" className="rpg-btn" style={{ flex: 1 }} onClick={() => setShowCharList(true)}>
          Character List
        </button>
      </div>

      {characters.map((char) => {
        const schema = (char.statusSchema || []).filter(s => s.type !== 'relation_schema');
        const dynamicStatus = char.status || {};

        const gaugeFields = schema.filter(item => ['stacking', 'consumable'].includes(item.type));
        const integerFields = schema.filter(item => item.type === 'integer');
        const textFields = schema.filter(item => item.type === 'text');

        const isCollapsed = collapsedChars[char.id] !== false;
        const charTabs = activeInlineTabs[char.id] || {};
        const isPlayerActive = char.activePlayer === true;
        const isInjectionActive = char.activeInjection !== false;

        const hasActiveTab = Object.values(charTabs).some(v => v === true);

        const {
          displayName: liveName,
          avatarUrl: liveAvatarUrl,
          fallbackAvatarUrl,
          cropOffset
        } = resolveEffectiveCharacterVisual(char, customAvatars);

        const hasValidAvatar = Boolean(liveAvatarUrl);
        const isVisualActive = activeVisualCharId === char.id;

        return (
          <div key={char.id} className={styles.charBlock}>

            <header className={styles.blockHeader}>
              <div className={styles.headerLeft} onClick={() => toggleCollapse(char.id)}>
                <AccordionArrow
                  isExpanded={!isCollapsed}
                  onClick={() => toggleCollapse(char.id)}
                />
                <span className={styles.charName}>{liveName}</span>
              </div>

              <div className={styles.headerSwitches}>
                <ToggleSwitch
                  label="Player"
                  checked={isPlayerActive}
                  onChange={() => patchCharacterField(char.id, ['activePlayer'], !isPlayerActive)}
                  title="Enable Inventory and Quests Tab"
                />

                <ToggleSwitch
                  label="Inject"
                  checked={isInjectionActive}
                  onChange={() => patchCharacterField(char.id, ['activeInjection'], !isInjectionActive)}
                  title="Inject status into AI context"
                />

                <button
                  type="button"
                  className={styles.settingsGearBtn}
                  title="Edit Character Spec & Schema"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditor && onOpenEditor(char.id);
                  }}
                >
                  <GearIcon />
                </button>
              </div>
            </header>

            {!isCollapsed && (
              <div className={styles.dashboardContainer}>

                <div className={styles.uniformControlGrid}>
                  <button
                    type="button"
                    className={`rpg-btn-icon ${charTabs.profile ? 'active' : ''}`}
                    onClick={() => handleToggleInlineTab(char.id, 'profile')}
                    title="Profile"
                  >
                    <ProfileTabIcon />
                  </button>

                  <button
                    type="button"
                    className={`rpg-btn-icon ${charTabs.relations ? 'active' : ''}`}
                    onClick={() => handleToggleInlineTab(char.id, 'relations')}
                    title="Relations"
                  >
                    <RelationsTabIcon />
                  </button>

                  {isPlayerActive && (
                    <>
                      <button
                        type="button"
                        className={`rpg-btn-icon ${charTabs.inventory ? 'active' : ''}`}
                        onClick={() => handleToggleInlineTab(char.id, 'inventory')}
                        title="Inventory"
                      >
                        <InventoryTabIcon />
                      </button>

                      <button
                        type="button"
                        className={`rpg-btn-icon ${charTabs.quests ? 'active' : ''}`}
                        onClick={() => handleToggleInlineTab(char.id, 'quests')}
                        title="Quest"
                      >
                        <QuestsTabIcon />
                      </button>
                    </>
                  )}

                  <div className={styles.avatarControlWrapper}>
                    <button
                      type="button"
                      className={styles.cameraBtn}
                      onClick={() => handleCameraClick(char.id)}
                      title="Manage Character Assets & Expressions"
                    >
                      <CameraIcon />
                    </button>

                    <div
                      className={`${styles.avatarContainer} ${isVisualActive ? styles.avatarActive : ''}`}
                      onClick={() => toggleVisualStage && toggleVisualStage(char.id)}
                      title="Click to toggle Visual Stage illustration"
                    >
                      {hasValidAvatar ? (
                        <>
                          <img
                            src={liveAvatarUrl}
                            alt={liveName}
                            className={styles.avatarImg}
                            style={{
                              objectPosition: `${cropOffset.x}% ${cropOffset.y}%`,
                              transformOrigin: `${cropOffset.x}% ${cropOffset.y}%`,
                              transform: `scale(${cropOffset.zoom})`
                            }}
                            onError={(e) => {
                              if (fallbackAvatarUrl && e.target.src !== fallbackAvatarUrl) {
                                e.target.src = fallbackAvatarUrl;
                                return;
                              }
                              e.target.style.display = 'none';
                              const fallbackEl = e.target.parentElement?.querySelector('[class*="avatarFallback"]');
                              if (fallbackEl) fallbackEl.style.display = 'flex';
                            }}
                          />
                          <div className={styles.avatarFallback} style={{ display: 'none' }}>
                            <CameraIcon />
                          </div>
                        </>
                      ) : (
                        <div className={styles.avatarFallback}>
                          <CameraIcon />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${styles.statusComponentContainer} ${hasActiveTab ? styles.tabActive : ''}`}>
                  <StatusComponent
                    char={char}
                    characters={characters}
                    activeTabs={charTabs}
                    onOpenEditor={(tab) => onOpenEditor && onOpenEditor(char.id, tab)}
                  />

                  {isPlayerActive && (
                    <PlayerComponent
                      char={char}
                      activeTabs={charTabs}
                      onOpenEditor={(tab) => onOpenEditor && onOpenEditor(char.id, tab)}
                    />
                  )}
                </div>

                {gaugeFields.length > 0 && (
                  <div className={styles.gaugeGrid}>
                    {gaugeFields.map((item) => {
                      const rawValue = dynamicStatus[item.id];
                      const currentValue = rawValue !== undefined ? rawValue : (item.max || 100);
                      const minLimit = item.min !== undefined && item.min !== null ? item.min : 0;
                      const maxLimit = item.max || 100;
                      const range = maxLimit - minLimit || 1;
                      const ratio = Math.min(100, Math.max(0, ((Number(currentValue) - minLimit) / range) * 100));
                      const isConsumable = item.type === 'consumable';
                      const isDanger = isConsumable && ratio <= 25;

                      return (
                        <div key={item.id} className={styles.gaugeCard}>
                          <div className={styles.gaugeLabelRow}>
                            <div className={styles.gaugeLabelContainer}>
                              <LockIcon
                                isLocked={item.isLocked}
                                onClick={() => {
                                  const newSchema = (char.statusSchema || []).map(s =>
                                    s.id === item.id ? { ...s, isLocked: !s.isLocked } : s
                                  );
                                  patchCharacterField(char.id, ['statusSchema'], newSchema);
                                }}
                                className={`${styles.lockIcon} ${item.isLocked ? styles.lockIconActive : ''}`}
                              />
                              <span className={`${styles.gaugeName} ${isDanger ? styles.dangerText : ''}`}>
                                {item.name || 'Unnamed'}
                              </span>
                            </div>
                            <div className={styles.gaugeValues}>
                              <input
                                type="number"
                                className={styles.smallNumberInput}
                                value={currentValue !== undefined ? currentValue : ''}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => {
                                  if (e.target.value === '' || isNaN(Number(e.target.value))) {
                                    const minLimit = (item.min !== undefined && item.min !== null) ? Number(item.min) : 0;
                                    handleValueChange(char.id, item.id, minLimit);
                                  }
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleValueChange(char.id, item.id, val === '' ? '' : Number(val));
                                }}
                              />
                              <span className={`${styles.gaugeMax} ${styles.gaugeMaxText}`}>/{item.max || 100}</span>
                            </div>
                          </div>
                          <div className={`${styles.gaugeTrack} ${isDanger ? styles.dangerTrack : ''}`}>
                            <div
                              className={`${styles.gaugeFill} ${isDanger ? styles.dangerFlash : ''}`}
                              style={{
                                width: `${ratio}%`,
                                backgroundColor: item.color || (isConsumable ? '#e74c3c' : '#3498db')
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {integerFields.length > 0 && (
                  <div className={styles.integerRowGrid}>
                    {integerFields.map((item) => {
                      const rawValue = dynamicStatus[item.id];
                      const currentValue = rawValue !== undefined ? rawValue : 0;

                      return (
                        <div key={item.id} className={styles.integerBlockCard}>
                          <div className={styles.integerFieldLeft}>
                            <LockIcon
                              isLocked={item.isLocked}
                              onClick={() => {
                                const newSchema = (char.statusSchema || []).map(s =>
                                  s.id === item.id ? { ...s, isLocked: !s.isLocked } : s
                                );
                                patchCharacterField(char.id, ['statusSchema'], newSchema);
                              }}
                              className={`${styles.lockIcon} ${item.isLocked ? styles.lockIconActive : ''}`}
                            />
                            <span className={styles.integerFieldName} title={item.name}>{item.name || 'Unnamed'}</span>
                          </div>
                          <div className={styles.integerFieldControlGroup}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleValueChange(char.id, item.id, Number(currentValue) - 1); }}
                              className={styles.integerRowBtn}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              className={styles.smallNumberInput}
                              value={currentValue !== undefined ? currentValue : ''}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => {
                                if (e.target.value === '' || isNaN(Number(e.target.value))) {
                                  const minLimit = (item.min !== undefined && item.min !== null) ? Number(item.min) : 0;
                                  handleValueChange(char.id, item.id, minLimit);
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleValueChange(char.id, item.id, val === '' ? '' : Number(val));
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleValueChange(char.id, item.id, Number(currentValue) + 1); }}
                              className={styles.integerRowBtn}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {textFields.length > 0 && (
                  <div className={styles.textStack}>
                    {textFields.map((item) => {
                      const rawValue = dynamicStatus[item.id];
                      const currentValue = rawValue !== undefined ? rawValue : '';

                      return (
                        <div key={item.id} className={styles.textBlockCard}>
                          <LockIcon
                            isLocked={item.isLocked}
                            onClick={() => {
                              const newSchema = (char.statusSchema || []).map(s =>
                                s.id === item.id ? { ...s, isLocked: !s.isLocked } : s
                              );
                              patchCharacterField(char.id, ['statusSchema'], newSchema);
                            }}
                            className={`${styles.lockIcon} ${item.isLocked ? styles.lockIconActive : ''}`}
                          />
                          <label className={styles.textBlockLabel}>{item.name || 'Unnamed'}</label>
                          <div className={styles.textBlockInputWrapper}>
                            <AutoGrowingTextArea
                              className={styles.textBlockInput}
                              value={currentValue}
                              onChange={(val) => handleValueChange(char.id, item.id, val)}
                              placeholder={`Enter ${item.name || 'details'}...`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

          </div>
        );
      })}

      {showCharList && (
        <CharListEditor
          onClose={() => setShowCharList(false)}
          onOpenStatusEditor={(id) => {
            setShowCharList(false);
            if (onOpenEditor) onOpenEditor(id);
          }}
        />
      )}
    </div>
  );
}