import React from 'react';
import styles from './StatusComponent.module.css';
import { LockIcon } from '../Icons';
import { useRPG } from '../core/RPGControl';
import { AutoGrowingTextArea, AccordionArrow } from '../utils';

/**
 * Relation metric gauge helper (50% center-split bipolar algorithm).
 */
function calculateRelationGauge(min, max, val, colorPositive, colorNegative) {
  const isBipolar = min < 0 && max > 0;
  let left = '0%';
  let width = '0%';
  let color = colorPositive;

  if (isBipolar) {
    if (val > 0) {
      // Positive (> 0): fills right from the 50% center line
      const ratio = Math.min(1, Math.max(0, val / (max || 1)));
      left = '50%';
      width = `${ratio * 50}%`;
      color = colorPositive;
    } else if (val < 0) {
      // Negative (< 0): fills left from the 50% center line
      const ratio = Math.min(1, Math.max(0, Math.abs(val) / (Math.abs(min) || 1)));
      const barWidth = ratio * 50;
      left = `${50 - barWidth}%`;
      width = `${barWidth}%`;
      color = colorNegative;
    } else {
      // Neutral (0): stays at center with 0 width
      left = '50%';
      width = '0%';
    }
  } else if (min >= 0) {
    // Positive-only gauge (e.g. 0 ~ 100)
    const range = max - min || 1;
    const ratio = Math.min(100, Math.max(0, ((val - min) / range) * 100));
    left = '0%';
    width = `${ratio}%`;
    color = colorPositive;
  } else {
    // Negative-only gauge (e.g. -100 ~ 0)
    const ratio = Math.min(100, Math.max(0, (Math.abs(val) / (Math.abs(min) || 1)) * 100));
    left = '0%';
    width = `${ratio}%`;
    color = colorNegative;
  }

  return { left, width, color, isBipolar };
}

export default function StatusComponent({ char, characters = [], activeTabs, onOpenEditor }) {
  const { patchCharacterField, uiState, updateUiState } = useRPG();

  // Retrieve relation collapse state from global uiState (persisted in localStorage)
  const collapsedRelations = uiState.collapsedRelations || {};

  const toggleTarget = (targetName) => {
    const key = `${char.id}_${targetName}`;
    const isCurrentlyExpanded = collapsedRelations[key] === true;
    updateUiState({
      collapsedRelations: {
        ...collapsedRelations,
        [key]: !isCurrentlyExpanded
      }
    });
  };

  const profile = (char.profile && typeof char.profile === 'object') ? char.profile : {};
  const relations = char.relations || {};

  // Filter relations to only show targets where isInject is NOT false
  const activeRelations = Object.entries(relations).filter(([_, data]) => data.isInject !== false);

  return (
    <div className={styles.tabContentStack}>

      {/* Profile Tab Content */}
      {activeTabs.profile && (
        <div className={styles.inlineTabContent}>
          <div className={styles.inlineHeaderLabelRow}>
            <span className={styles.inlineSheetTitle}>Profile</span>
          </div>
          <div className={styles.appearanceGrid}>
            {Object.keys(profile).length === 0 ? (
              <span className="rpg-empty-text">No profile fields defined.</span>
            ) : (
              Object.keys(profile).map((field) => {
                const isLocked = char.profileLocks?.[field] || false;
                return (
                  <div key={field} className={styles.appearanceRow}>
                    <LockIcon
                      isLocked={isLocked}
                      onClick={() => patchCharacterField(char.id, ['profileLocks', field], !isLocked)}
                      className={styles.profileLockIcon}
                    />
                    <span className={styles.fieldLabel}>
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </span>
                    <div className={styles.appearanceInputWrapper}>
                      <AutoGrowingTextArea
                        className={styles.textBlockInput}
                        value={profile[field] || ''}
                        onChange={val => patchCharacterField(char.id, ['profile', field], val)}
                        placeholder={`Enter ${field}...`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Relations Tab Content */}
      {activeTabs.relations && (
        <div className={styles.inlineTabContent}>
          <div className={styles.inlineHeaderLabelRow}>
            <span className={styles.inlineSheetTitle}>Relations</span>
            <button
              type="button"
              className="rpg-btn-sm"
              onClick={() => onOpenEditor && onOpenEditor('relations')}
            >
              Open Editor
            </button>
          </div>

          {activeRelations.length === 0 ? (
            <p className="rpg-empty-text">No recorded relations.</p>
          ) : (
            activeRelations.map(([targetName, data]) => {
              const cleanTargetName = targetName.trim().toLowerCase();
              const targetChar = characters.find(c => (c.name || '').trim().toLowerCase() === cleanTargetName);
              const isTargetExist = !!targetChar;

              // Unique key for persisting state per character and target relation
              const relKey = `${char.id}_${targetName}`;
              const isExpanded = collapsedRelations[relKey] === true;

              // 1. Normalize character -> target metrics (enforce integer and bounds)
              const metricsList = Object.entries(data.values || {}).map(([mName, mVal]) => {
                const isObj = typeof mVal === 'object' && mVal !== null;
                const parsedMin = parseInt(isObj && mVal.min !== undefined ? mVal.min : -100, 10);
                const parsedMax = parseInt(isObj && mVal.max !== undefined ? mVal.max : 100, 10);
                const rawVal = parseInt(isObj ? mVal.value : mVal, 10);

                const min = !isNaN(parsedMin) ? parsedMin : -100;
                const max = !isNaN(parsedMax) ? parsedMax : 100;
                const safeMin = Math.min(min, max);
                const safeMax = Math.max(min, max);
                const val = !isNaN(rawVal) ? Math.min(safeMax, Math.max(safeMin, rawVal)) : 0;

                return {
                  name: mName,
                  value: val,
                  min: safeMin,
                  max: safeMax,
                  colorNegative: isObj && mVal.colorNegative ? mVal.colorNegative : '#e74c3c',
                  colorPositive: isObj && mVal.colorPositive ? mVal.colorPositive : '#2ecc71'
                };
              });

              let targetText = "";
              let targetMetricsSource = {};
              if (isTargetExist) {
                const myName = (char.name || 'New Character').trim().toLowerCase();
                const matchedKey = Object.keys(targetChar.relations || {}).find(k => k.trim().toLowerCase() === myName);
                const counterRelation = matchedKey ? targetChar.relations[matchedKey] : {};
                targetText = counterRelation.text || "";
                targetMetricsSource = counterRelation.values || {};
              } else {
                targetText = data.targetText || "";
                targetMetricsSource = data.targetValues || {};
              }

              // 2. Normalize target -> character metrics (enforce integer and bounds)
              const targetMetricsList = Object.entries(targetMetricsSource).map(([mName, mVal]) => {
                const isObj = typeof mVal === 'object' && mVal !== null;
                const parsedMin = parseInt(isObj && mVal.min !== undefined ? mVal.min : -100, 10);
                const parsedMax = parseInt(isObj && mVal.max !== undefined ? mVal.max : 100, 10);
                const rawVal = parseInt(isObj ? mVal.value : mVal, 10);

                const min = !isNaN(parsedMin) ? parsedMin : -100;
                const max = !isNaN(parsedMax) ? parsedMax : 100;
                const safeMin = Math.min(min, max);
                const safeMax = Math.max(min, max);
                const val = !isNaN(rawVal) ? Math.min(safeMax, Math.max(safeMin, rawVal)) : 0;

                return {
                  name: mName,
                  value: val,
                  min: safeMin,
                  max: safeMax,
                  colorNegative: isObj && mVal.colorNegative ? mVal.colorNegative : '#e74c3c',
                  colorPositive: isObj && mVal.colorPositive ? mVal.colorPositive : '#2ecc71'
                };
              });

              return (
                <div key={targetName} className={styles.relationTargetCard}>
                  <div className={styles.relationTargetHeader}>
                    <div className={styles.targetHeaderLeft}>
                      <AccordionArrow
                        isExpanded={isExpanded}
                        onClick={() => toggleTarget(targetName)}
                      />
                      <strong className={styles.targetNameText}>
                        {targetName}
                      </strong>
                      {isTargetExist && <span className="rpg-sync-badge">Synced</span>}
                    </div>
                    <div className={styles.flexCenterGap}>
                      <LockIcon
                        isLocked={data.isLocked}
                        onClick={() => patchCharacterField(char.id, ['relations', targetName, 'isLocked'], !data.isLocked)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      {/* Perspective: Current Character -> Target */}
                      <div className={styles.relationSectionMyPerspective}>
                        <span className={styles.relationSectionSubTitle}>{char.name || 'Character'} ➔ {targetName}</span>
                        <div className={styles.relationDescriptionArea}>
                          <div className={`${styles.textBlockInput} ${styles.readOnlyBlock}`}>
                            {data.text || <span className={styles.emptyPlaceholderInline}>No description defined.</span>}
                          </div>
                        </div>
                        {metricsList.length > 0 && (
                          <div className={styles.relationMetricsGrid}>
                            {metricsList.map((m) => {
                              const { left, width, color, isBipolar } = calculateRelationGauge(
                                m.min,
                                m.max,
                                m.value,
                                m.colorPositive,
                                m.colorNegative
                              );

                              return (
                                <div key={m.name} className={styles.gaugeCard}>
                                  <div className={styles.gaugeLabelRow}>
                                    <span className={styles.gaugeName}>{m.name}</span>
                                    <div className={styles.gaugeValues}>
                                      <span className={styles.readOnlyNumberValue}>{m.value}</span>
                                    </div>
                                  </div>
                                  <div className={styles.gaugeTrackWrapper}>
                                    {isBipolar && (
                                      <div className={styles.gaugeZeroMarker} style={{ left: '50%' }} />
                                    )}
                                    <div className={styles.gaugeFill} style={{ left, width, backgroundColor: color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Perspective: Target -> Current Character */}
                      <div className={styles.relationSectionTargetPerspective}>
                        <span className={styles.relationSectionSubTitle}>{targetName} ➔ {char.name || 'Character'}</span>
                        <div className={styles.relationDescriptionArea}>
                          <div className={`${styles.textBlockInput} ${styles.readOnlyBlock}`}>
                            {targetText || <span className={styles.emptyPlaceholderInline}>No description defined.</span>}
                          </div>
                        </div>
                        {targetMetricsList.length > 0 && (
                          <div className={styles.relationMetricsGrid}>
                            {targetMetricsList.map((m) => {
                              const { left, width, color, isBipolar } = calculateRelationGauge(
                                m.min,
                                m.max,
                                m.value,
                                m.colorPositive,
                                m.colorNegative
                              );

                              return (
                                <div key={m.name} className={styles.gaugeCard}>
                                  <div className={styles.gaugeLabelRow}>
                                    <span className={styles.gaugeName}>{m.name}</span>
                                    <div className={styles.gaugeValues}>
                                      <span className={styles.readOnlyNumberValue}>{m.value}</span>
                                    </div>
                                  </div>
                                  <div className={styles.gaugeTrackWrapper}>
                                    {isBipolar && (
                                      <div className={styles.gaugeZeroMarker} style={{ left: '50%' }} />
                                    )}
                                    <div className={styles.gaugeFill} style={{ left, width, backgroundColor: color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}