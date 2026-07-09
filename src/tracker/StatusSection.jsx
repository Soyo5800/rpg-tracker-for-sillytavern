// src/tracker/StatusSection.jsx

import React, { useState } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './StatusSection.module.css';
import StatusComponent from './StatusComponent';
import PlayerComponent from './PlayerComponent';
import CharListEditor from '../editor/CharListEditor';
import { DEFAULT_STATUS_SCHEMAS, DEFAULT_STATUS, getDefaultCharacters } from '../core/PromptSchema';
import { LockIcon, GearIcon, ProfileTabIcon, RelationsTabIcon, InventoryTabIcon, QuestsTabIcon } from '../Icons';
import { AutoGrowingTextArea } from '../utils';

export default function StatusSection({ onOpenEditor }) {
  // UI 보존 상태를 불러오기 위해 uiState, updateUiState 추가 구독
  const { trackerData, updateTrackerData, settings, patchCharacterField, uiState, updateUiState } = useRPG();

  const characters = (trackerData.characters && trackerData.characters.length > 0)
    ? trackerData.characters
    : getDefaultCharacters();

  // 로컬 useState 상태 대신 전역 uiState 바인딩
  const collapsedChars = uiState.collapsedChars || {};
  const activeInlineTabs = uiState.activeInlineTabs || {};
  const [showCharList, setShowCharList] = useState(false);

  // 캐릭터 배열 전체를 교체할 때 사용되는 내부 도우미 함수
  const handleUpdateCharacters = (nextChars) => {
    if (updateTrackerData) {
      updateTrackerData({ ...trackerData, characters: nextChars });
    }
  };

  // 개별 능력치(Status) 값 정밀 업데이트 핸들러
  const handleValueChange = (charId, statId, newVal) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const schemaItem = (char.statusSchema || []).find(s => s.id === statId);
    let finalVal = newVal;
    if (schemaItem && schemaItem.type !== 'text') {
      const minLimit = schemaItem.min !== undefined && schemaItem.min !== null ? schemaItem.min : 0;
      const maxLimit = schemaItem.max || 100;
      finalVal = Math.min(maxLimit, Math.max(minLimit, newVal));
    }

    // status 객체 내부의 특정 능력치 값만 정밀 업데이트 경로로 주입
    patchCharacterField(charId, ['status', statId], finalVal);
  };

  // 접기 상태 토글 시 전역 상태 업데이트 함수 호출 (지정 값이 없으면 기본 접힘 상태)
  const toggleCollapse = (charId) => {
    const currentCollapsed = collapsedChars[charId] !== false;
    updateUiState({
      collapsedChars: {
        ...collapsedChars,
        [charId]: !currentCollapsed
      }
    });
  };

  // 다중 서브 탭 변경 시 전역 상태 업데이트 함수 호출
  const handleToggleInlineTab = (charId, tabName) => {
    const charTabs = activeInlineTabs[charId] || {
      profile: false,
      relations: false,
      inventory: false,
      quests: false
    };
    updateUiState({
      activeInlineTabs: {
        ...activeInlineTabs,
        [charId]: {
          ...charTabs,
          [tabName]: !charTabs[tabName]
        }
      }
    });
  };

  return (
    <div className={styles.container}>
      {/* 캐릭터 목록 편집 및 일괄 추가 영역 */}
      <div className={styles.topActionBar}>
        <button
          className={styles.topActionBtn}
          onClick={() => {
            const newChar = {
              id: `char_${Date.now()}`,
              name: "New Character",
              activePlayer: false,
              activeInjection: true,
              statusSchema: JSON.parse(JSON.stringify(DEFAULT_STATUS_SCHEMAS)),
              status: JSON.parse(JSON.stringify(DEFAULT_STATUS)),
              relations: {}
            };
            let nextChars;
            if (characters.length === 1 && characters[0].id === 'char_user' && characters[0].name === 'New') {
              nextChars = [newChar];
            } else {
              nextChars = [...characters, newChar];
            }
            handleUpdateCharacters(nextChars);
          }}
        >
          + Add Character
        </button>
        <button
          className={styles.topActionBtn}
          onClick={() => setShowCharList(true)}
        >
          Character List
        </button>
      </div>

      {/* 캐릭터 카드 목록 루프 */}
      {characters.map((char) => {
        const schema = (char.statusSchema || []).filter(s => s.type !== 'relation_schema');
        const dynamicStatus = char.status || {};

        const gaugeFields = schema.filter(item => ['stacking', 'consumable'].includes(item.type));
        const integerFields = schema.filter(item => item.type === 'integer');
        const textFields = schema.filter(item => item.type === 'text');

        // 상태 기록이 등록되지 않았거나 값이 없으면 기본값을 접힘(true) 상태로 설정
        const isCollapsed = collapsedChars[char.id] !== false;
        const charTabs = activeInlineTabs[char.id] || {};
        const isPlayerActive = char.activePlayer === true;
        const isInjectionActive = char.activeInjection !== false;

        const hasActiveTab = Object.values(charTabs).some(v => v === true);

        return (
          <div key={char.id} className={styles.charBlock}>

            {/* 카드 상단 제어 바 */}
            <header className={styles.blockHeader}>
              <div className={styles.headerLeft} onClick={() => toggleCollapse(char.id)}>
                <button
                  type="button"
                  className={`${styles.collapseArrowBtn} ${!isCollapsed ? styles.arrowExpanded : ''}`}
                >
                  ▶
                </button>
                <span className={styles.charName}>{char.name}</span>
              </div>

              <div className={styles.headerSwitches}>
                <label className={styles.switchRow} title="Enable Inventory and Quests Tab">
                  <span>Player</span>
                  <div className={styles.switchContainer}>
                    <input
                      type="checkbox"
                      checked={isPlayerActive}
                      onChange={() => patchCharacterField(char.id, ['activePlayer'], !isPlayerActive)}
                    />
                    <span className={styles.switchSlider} />
                  </div>
                </label>

                <label className={styles.switchRow} title="Inject status into AI context">
                  <span>Inject</span>
                  <div className={styles.switchContainer}>
                    <input
                      type="checkbox"
                      checked={isInjectionActive}
                      onChange={() => patchCharacterField(char.id, ['activeInjection'], !isInjectionActive)}
                    />
                    <span className={styles.switchSlider} />
                  </div>
                </label>

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

                {/* 탭 다중 전개용 내비게이션 그리드 */}
                <div className={styles.uniformControlGrid}>
                  <button
                    type="button"
                    className={`${styles.iconGridBtn} ${charTabs.profile ? styles.activeGridBtn : ''}`}
                    onClick={() => handleToggleInlineTab(char.id, 'profile')}
                    title="Profile"
                  >
                    <ProfileTabIcon />
                  </button>

                  <button
                    type="button"
                    className={`${styles.iconGridBtn} ${charTabs.relations ? styles.activeGridBtn : ''}`}
                    onClick={() => handleToggleInlineTab(char.id, 'relations')}
                    title="Relations"
                  >
                    <RelationsTabIcon />
                  </button>

                  {isPlayerActive && (
                    <>
                      <button
                        type="button"
                        className={`${styles.iconGridBtn} ${charTabs.inventory ? styles.activeGridBtn : ''}`}
                        onClick={() => handleToggleInlineTab(char.id, 'inventory')}
                        title="Inventory"
                      >
                        <InventoryTabIcon />
                      </button>

                      <button
                        type="button"
                        className={`${styles.iconGridBtn} ${charTabs.quests ? styles.activeGridBtn : ''}`}
                        onClick={() => handleToggleInlineTab(char.id, 'quests')}
                        title="Quest"
                      >
                        <QuestsTabIcon />
                      </button>

                      <div className={styles.avatarGridCell}>
                        {char.avatarUrl ? (
                          <img src={char.avatarUrl} alt={char.name} className={styles.avatarGridImage} />
                        ) : (
                          <div className={styles.avatarGridFallback}>
                            {char.name ? char.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 자식 서브 탭 뷰 */}
                <div className={`${styles.statusComponentContainer} ${hasActiveTab ? styles.tabActive : ''}`}>
                  {/* StatusComponent는 Profile과 Relations 담당 */}
                  <StatusComponent
                    char={char}
                    characters={characters}
                    activeTabs={charTabs}
                    onOpenEditor={(tab) => onOpenEditor && onOpenEditor(char.id, tab)}
                  />

                  {/* PlayerComponent는 Inventory와 Quests 담당 */}
                  {isPlayerActive && (
                    <PlayerComponent
                      char={char}
                      activeTabs={charTabs}
                      onOpenEditor={(tab) => onOpenEditor && onOpenEditor(char.id, tab)}
                    />
                  )}
                </div>

                {/* 1. 소모성 & 게이지형 스탯 필드 (HP, Fatigue 등) */}
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
                                value={currentValue}
                                onChange={(e) => handleValueChange(char.id, item.id, Number(e.target.value))}
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

                {/* 2. 정수형 변수 스탯 필드 (Lv, 스탯 등) */}
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
                              value={currentValue}
                              onChange={(e) => handleValueChange(char.id, item.id, Number(e.target.value))}
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

                {/* 3. 단순 텍스트 서술형 스탯 필드 (Condition 등) */}
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

      {/* 캐릭터 목록 에디터 모달 오버레이 */}
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