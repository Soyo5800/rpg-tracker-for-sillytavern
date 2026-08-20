import React, { useState } from 'react';
import styles from './StatusEditor.module.css';
import { ToggleSwitch, SortButtons, AccordionArrow } from '../utils';

// Form component for configuring individual relation metric properties
export function RelationMetricConfig({
  colorNegative = '#e74c3c',
  colorPositive = '#2ecc71',
  min = -100,
  max = 100,
  disabled = false,
  onChange
}) {
  return (
    <div className={styles.metricConfigRow} style={{ borderTop: 'none', paddingTop: 0 }}>
      <div className={styles.flexCenterGroupSmall} title="Negative Color">
        <span className={styles.metricLimitLabel}>Col(-):</span>
        <input
          type="color"
          disabled={disabled}
          value={colorNegative}
          onChange={(e) => onChange && onChange('colorNegative', e.target.value)}
          className={styles.colorPickerInput}
        />
      </div>

      <div className={styles.flexCenterGroupSmall} title="Positive Color">
        <span className={styles.metricLimitLabel}>Col(+):</span>
        <input
          type="color"
          disabled={disabled}
          value={colorPositive}
          onChange={(e) => onChange && onChange('colorPositive', e.target.value)}
          className={styles.colorPickerInput}
        />
      </div>

      <div className={styles.flexCenterGroupSmall}>
        <span className={styles.metricLimitLabel}>Min:</span>
        <input
          type="number"
          disabled={disabled}
          value={min !== undefined && min !== null ? min : -100}
          onChange={(e) => onChange && onChange('min', Number(e.target.value))}
          className={styles.metricLimitInput}
        />
      </div>

      <div className={styles.flexCenterGroupSmall}>
        <span className={styles.metricLimitLabel}>Max:</span>
        <input
          type="number"
          disabled={disabled}
          value={max !== undefined && max !== null ? max : 100}
          onChange={(e) => onChange && onChange('max', Number(e.target.value))}
          className={styles.metricLimitInput}
        />
      </div>
    </div>
  );
}

export default function RelationsTab({
  charId,
  targetChar,
  localCharacters,
  setLocalCharacters,
  expandedIds,
  setExpandedIds
}) {
  const [relationPreset, setRelationPreset] = useState('-100~100');
  const [relationMin, setRelationMin] = useState(-100);
  const [relationMax, setRelationMax] = useState(100);

  // Update current character's perspective toward target
  const handleUpdateRelations = (targetName, action, data) => {
    setLocalCharacters(localCharacters.map(c => {
      if (c.id !== charId) return c;
      const nextRelations = { ...(c.relations || {}) };

      if (action === 'add') {
        if (!nextRelations[targetName]) {
          nextRelations[targetName] = {
            text: '',
            targetText: '',
            isLocked: false,
            isInject: true,
            values: {
              'Affection': {
                value: 0,
                min: relationMin,
                max: relationMax,
                colorNegative: '#e74c3c',
                colorPositive: '#2ecc71'
              }
            },
            targetValues: {}
          };
        }
        return { ...c, relations: nextRelations };
      }

      if (action === 'remove') {
        delete nextRelations[targetName];
        return { ...c, relations: nextRelations };
      }

      const targetData = nextRelations[targetName]
        ? JSON.parse(JSON.stringify(nextRelations[targetName]))
        : { text: '', targetText: '', isLocked: false, isInject: true, values: {}, targetValues: {} };

      if (action === 'updateField') {
        targetData.text = data.value;
      } else if (action === 'updateMetricValue') {
        const old = targetData.values[data.field];
        if (typeof old === 'object' && old !== null) {
          targetData.values[data.field] = { ...old, value: data.value };
        } else {
          targetData.values[data.field] = { value: data.value, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
        }
      } else if (action === 'updateMetricConfig') {
        const mKey = data.metric;
        const old = targetData.values[mKey];
        const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
        targetData.values[mKey] = { ...currentObj, ...data.config };
      } else if (action === 'renameMetric') {
        const nextValues = { ...targetData.values };
        nextValues[data.newKey] = nextValues[data.oldKey];
        delete nextValues[data.oldKey];
        targetData.values = nextValues;
      } else if (action === 'removeMetric') {
        const nextValues = { ...targetData.values };
        delete nextValues[data.metric];
        targetData.values = nextValues;
      } else if (action === 'addMetric') {
        targetData.values = {
          ...(targetData.values || {}),
          [data.metric]: { value: 0, min: relationMin, max: relationMax, colorNegative: '#e74c3c', colorPositive: '#2ecc71' }
        };
      }
      nextRelations[targetName] = targetData;
      return { ...c, relations: nextRelations };
    }));
  };

  // Update target's perspective toward current character
  const handleUpdateTargetRelation = (targetName, action, data) => {
    const targetCharObj = localCharacters.find(c => (c.name || '').trim().toLowerCase() === targetName.trim().toLowerCase());
    const myName = (targetChar.name || 'New Character').trim();

    setLocalCharacters(localCharacters.map(c => {
      // If target is an independent character card, update that card directly
      if (targetCharObj && c.id === targetCharObj.id) {
        const nextRelations = { ...(c.relations || {}) };
        const matchedKey = Object.keys(nextRelations).find(k => k.trim().toLowerCase() === myName.toLowerCase()) || myName;
        const myDataInTarget = nextRelations[matchedKey]
          ? JSON.parse(JSON.stringify(nextRelations[matchedKey]))
          : { text: '', isLocked: false, isInject: true, values: {} };

        if (action === 'updateField') {
          myDataInTarget.text = data.value;
        } else if (action === 'updateMetricValue') {
          const old = myDataInTarget.values[data.field];
          if (typeof old === 'object' && old !== null) {
            myDataInTarget.values[data.field] = { ...old, value: data.value };
          } else {
            myDataInTarget.values[data.field] = { value: data.value, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
          }
        } else if (action === 'updateMetricConfig') {
          const old = myDataInTarget.values[data.metric];
          const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
          myDataInTarget.values[data.metric] = { ...currentObj, ...data.config };
        } else if (action === 'renameMetric') {
          const nextValues = { ...myDataInTarget.values };
          nextValues[data.newKey] = nextValues[data.oldKey];
          delete nextValues[data.oldKey];
          myDataInTarget.values = nextValues;
        } else if (action === 'removeMetric') {
          const nextValues = { ...myDataInTarget.values };
          delete nextValues[data.metric];
          myDataInTarget.values = nextValues;
        } else if (action === 'addMetric') {
          myDataInTarget.values = {
            ...(myDataInTarget.values || {}),
            [data.metric]: { value: 0, min: relationMin, max: relationMax, colorNegative: '#e74c3c', colorPositive: '#2ecc71' }
          };
        }
        nextRelations[matchedKey] = myDataInTarget;
        return { ...c, relations: nextRelations };
      }

      // If target is a minor NPC without a card, update targetText/targetValues in this character's relation object
      if (!targetCharObj && c.id === charId) {
        const nextRelations = { ...(c.relations || {}) };
        const targetData = nextRelations[targetName]
          ? JSON.parse(JSON.stringify(nextRelations[targetName]))
          : { text: '', targetText: '', isLocked: false, isInject: true, values: {}, targetValues: {} };

        if (action === 'updateField') {
          targetData.targetText = data.value;
        } else if (action === 'updateMetricValue') {
          targetData.targetValues = targetData.targetValues || {};
          const old = targetData.targetValues[data.field];
          if (typeof old === 'object' && old !== null) {
            targetData.targetValues[data.field] = { ...old, value: data.value };
          } else {
            targetData.targetValues[data.field] = { value: data.value, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
          }
        } else if (action === 'updateMetricConfig') {
          targetData.targetValues = targetData.targetValues || {};
          const mKey = data.metric;
          const old = targetData.targetValues[mKey];
          const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0, min: -100, max: 100, colorNegative: '#e74c3c', colorPositive: '#2ecc71' };
          targetData.targetValues[mKey] = { ...currentObj, ...data.config };
        } else if (action === 'renameMetric') {
          targetData.targetValues = targetData.targetValues || {};
          const nextValues = { ...targetData.targetValues };
          nextValues[data.newKey] = nextValues[data.oldKey];
          delete nextValues[data.oldKey];
          targetData.targetValues = nextValues;
        } else if (action === 'removeMetric') {
          targetData.targetValues = targetData.targetValues || {};
          const nextValues = { ...targetData.targetValues };
          delete nextValues[data.metric];
          targetData.targetValues = nextValues;
        } else if (action === 'addMetric') {
          targetData.targetValues = {
            ...(targetData.targetValues || {}),
            [data.metric]: { value: 0, min: relationMin, max: relationMax, colorNegative: '#e74c3c', colorPositive: '#2ecc71' }
          };
        }
        nextRelations[targetName] = targetData;
        return { ...c, relations: nextRelations };
      }

      return c;
    }));
  };

  const handleReorderRelation = (targetName, direction) => {
    setLocalCharacters(localCharacters.map(c => {
      if (c.id !== charId) return c;
      const relations = c.relations || {};
      const keys = Object.keys(relations);
      const index = keys.indexOf(targetName);
      if (index === -1) return c;

      const nextKeys = [...keys];
      if (direction === 'up' && index > 0) {
        const temp = nextKeys[index];
        nextKeys[index] = nextKeys[index - 1];
        nextKeys[index - 1] = temp;
      } else if (direction === 'down' && index < keys.length - 1) {
        const temp = nextKeys[index];
        nextKeys[index] = nextKeys[index + 1];
        nextKeys[index + 1] = temp;
      } else return c;

      const nextRelations = {};
      nextKeys.forEach(k => { nextRelations[k] = relations[k]; });
      return { ...c, relations: nextRelations };
    }));
  };

  const relationsList = Object.entries(targetChar.relations || {});
  const totalRelations = relationsList.length;

  return (
    <div className={styles.relationsTabBody}>
      <div className={styles.tabHeaderRow}>
        <span>Relations</span>
        <div className={styles.flexCenterGroup}>
          <select
            value={relationPreset}
            onChange={e => {
              setRelationPreset(e.target.value);
              if (e.target.value === '-100~100') {
                setRelationMin(-100);
                setRelationMax(100);
              }
            }}
            className="rpg-select-custom"
          >
            <option value="-100~100">-100~100</option>
            <option value="custom">custom</option>
          </select>
          <div className={styles.metricLimitWrapper}>
            <span className={styles.metricLimitLabel}>min</span>
            <input
              type="number"
              value={relationMin}
              disabled={relationPreset !== 'custom'}
              onChange={e => setRelationMin(Number(e.target.value))}
              className={styles.limitInput}
            />
            <span className={styles.metricLimitLabel}>max</span>
            <input
              type="number"
              value={relationMax}
              disabled={relationPreset !== 'custom'}
              onChange={e => setRelationMax(Number(e.target.value))}
              className={styles.limitInput}
            />
          </div>
          <button
            type="button"
            className="rpg-btn-sm"
            onClick={() => {
              const existingTargets = Object.keys(targetChar.relations || {});
              let baseName = 'NewTarget';
              let name = baseName;
              let counter = 1;
              while (existingTargets.includes(name)) {
                name = `${baseName}_${counter}`;
                counter++;
              }
              handleUpdateRelations(name, 'add');
            }}
          >
            + Add Target
          </button>
        </div>
      </div>

      {totalRelations === 0 ? (
        <p className={styles.emptySectionText}>No relations recorded.</p>
      ) : (
        relationsList.map(([targetName, data], rIdx) => {
          const isExpanded = !!expandedIds[`relation_${targetName}`];
          const existingCharNames = localCharacters.map(c => c.name?.trim().toLowerCase()).filter(Boolean);
          const isRealCharacter = existingCharNames.includes(targetName?.trim().toLowerCase());

          let targetText = '';
          let targetMetricsSource = {};
          if (isRealCharacter) {
            const targetCharObj = localCharacters.find(c => c.name?.trim().toLowerCase() === targetName.trim().toLowerCase());
            const myName = (targetChar.name || 'New Character').trim().toLowerCase();
            const matchedKey = Object.keys(targetCharObj?.relations || {}).find(k => k.trim().toLowerCase() === myName);
            const counterRelation = matchedKey ? targetCharObj.relations[matchedKey] : {};
            targetText = counterRelation.text || '';
            targetMetricsSource = counterRelation.values || {};
          } else {
            targetText = data.targetText || '';
            targetMetricsSource = data.targetValues || {};
          }

          return (
            <div key={targetName} className={styles.relationCard}>
              <div className={styles.relationCardHeader}>
                <AccordionArrow
                  isExpanded={isExpanded}
                  onClick={() => setExpandedIds(prev => ({ ...prev, [`relation_${targetName}`]: !prev[`relation_${targetName}`] }))}
                />
                <input
                  type="text"
                  defaultValue={targetName}
                  onBlur={e => {
                    const newName = e.target.value.trim();
                    if (!newName) { e.target.value = targetName; return; }
                    if (newName !== targetName && (targetChar.relations || {})[newName] !== undefined) {
                      alert(`The relation target "${newName}" already exists.`);
                      e.target.value = targetName;
                      return;
                    }
                    if (newName !== targetName) {
                      const nextRelations = { ...(targetChar.relations || {}) };
                      nextRelations[newName] = nextRelations[targetName];
                      delete nextRelations[targetName];
                      setLocalCharacters(localCharacters.map(c => c.id === charId ? { ...c, relations: nextRelations } : c));
                    }
                  }}
                  className={styles.nameInput}
                  style={{ flex: 1, fontWeight: 'bold', marginLeft: '6px' }}
                />
                <div className={styles.flexItemLine}>
                  <SortButtons
                    isFirst={rIdx === 0}
                    isLast={rIdx === totalRelations - 1}
                    onMoveUp={() => handleReorderRelation(targetName, 'up')}
                    onMoveDown={() => handleReorderRelation(targetName, 'down')}
                  />
                  {isRealCharacter && <span className={styles.syncBadge}>Synced</span>}

                  <ToggleSwitch
                    label="Inject"
                    title="Toggle Prompt Injection"
                    checked={data.isInject !== false}
                    onChange={(checked) => {
                      const nextRelations = { ...(targetChar.relations || {}) };
                      nextRelations[targetName] = { ...data, isInject: checked };
                      setLocalCharacters(localCharacters.map(c => c.id === charId ? { ...c, relations: nextRelations } : c));
                    }}
                  />

                  <button
                    type="button"
                    className="rpg-btn-del"
                    onClick={() => handleUpdateRelations(targetName, 'remove')}
                  >
                    ×
                  </button>
                </div>
              </div>

              {isExpanded && (
                <>
                  {/* Subject -> Target Perspective */}
                  <div className={styles.sectionWrapper} style={{ borderLeft: '3px solid var(--rpg-text)', marginBottom: '10px' }}>
                    <div className={styles.sectionHeaderLine}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--rpg-text)' }}>
                        {targetChar.name} ➔ {targetName}
                      </span>
                      <button
                        type="button"
                        className="rpg-btn-sm"
                        onClick={() => {
                          const existingMetrics = Object.keys(data.values || {});
                          let mName = 'NewMetric';
                          let counter = 1;
                          while (existingMetrics.includes(mName)) { mName = `NewMetric_${counter++}`; }
                          handleUpdateRelations(targetName, 'addMetric', { metric: mName });
                        }}
                      >
                        + Add Metric
                      </button>
                    </div>

                    <textarea
                      value={data.text || ''}
                      placeholder={`How ${targetChar.name} feels about ${targetName}...`}
                      onChange={e => handleUpdateRelations(targetName, 'updateField', { value: e.target.value })}
                      className={styles.descTextarea}
                    />

                    {Object.entries(data.values || {}).map(([mName, mVal]) => {
                      const isObj = typeof mVal === 'object' && mVal !== null;
                      const mValue = isObj ? mVal.value : mVal;
                      const mMin = isObj && mVal.min !== undefined ? mVal.min : -100;
                      const mMax = isObj && mVal.max !== undefined ? mVal.max : 100;
                      const mColorNegative = isObj && mVal.colorNegative ? mVal.colorNegative : '#e74c3c';
                      const mColorPositive = isObj && mVal.colorPositive ? mVal.colorPositive : '#2ecc71';

                      return (
                        <div key={mName} className={styles.metricBlock} style={{ marginTop: '6px' }}>
                          <div className={styles.metricHeaderRow}>
                            <input
                              type="text"
                              defaultValue={mName}
                              onBlur={e => {
                                const trimmed = e.target.value.trim();
                                if (!trimmed) { e.target.value = mName; return; }
                                const cleanId = trimmed.replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                                const newId = cleanId || `NewMetric_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                                if (newId !== mName) {
                                  if ((data.values || {})[newId] !== undefined) {
                                    alert(`Metric "${trimmed}" already exists.`);
                                    e.target.value = mName;
                                    return;
                                  }
                                  handleUpdateRelations(targetName, 'renameMetric', { oldKey: mName, newKey: newId });
                                }
                              }}
                              className={styles.metricNameInput}
                            />
                            <div className={styles.metricValueGroup}>
                              <input
                                type="number"
                                value={mValue !== undefined ? mValue : 0}
                                onChange={e => handleUpdateRelations(targetName, 'updateMetricValue', { field: mName, value: Number(e.target.value) })}
                                className={styles.metricValueInput}
                              />
                              <button
                                type="button"
                                className="rpg-btn-del"
                                onClick={() => handleUpdateRelations(targetName, 'removeMetric', { metric: mName })}
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          <RelationMetricConfig
                            colorNegative={mColorNegative}
                            colorPositive={mColorPositive}
                            min={mMin}
                            max={mMax}
                            onChange={(key, val) => handleUpdateRelations(targetName, 'updateMetricConfig', { metric: mName, config: { [key]: val } })}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Target -> Subject Perspective */}
                  <div className={styles.sectionWrapper} style={{ borderLeft: '3px solid var(--rpg-text)' }}>
                    <div className={styles.sectionHeaderLine}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--rpg-text)' }}>
                        {targetName} ➔ {targetChar.name}
                      </span>
                      <button
                        type="button"
                        className="rpg-btn-sm"
                        onClick={() => {
                          const existingTargetMetrics = Object.keys(targetMetricsSource || {});
                          let mName = 'NewMetric';
                          let counter = 1;
                          while (existingTargetMetrics.includes(mName)) { mName = `NewMetric_${counter++}`; }
                          handleUpdateTargetRelation(targetName, 'addMetric', { metric: mName });
                        }}
                      >
                        + Add Metric
                      </button>
                    </div>

                    <textarea
                      value={targetText}
                      placeholder={`How ${targetName} feels about ${targetChar.name}...`}
                      onChange={e => handleUpdateTargetRelation(targetName, 'updateField', { value: e.target.value })}
                      className={styles.descTextarea}
                    />

                    {Object.entries(targetMetricsSource || {}).map(([tmName, tmVal]) => {
                      const isObj = typeof tmVal === 'object' && tmVal !== null;
                      const tmValue = isObj ? tmVal.value : tmVal;
                      const tmMin = isObj && tmVal.min !== undefined ? tmVal.min : -100;
                      const tmMax = isObj && tmVal.max !== undefined ? tmVal.max : 100;
                      const tmColorNegative = isObj && tmVal.colorNegative ? tmVal.colorNegative : '#e74c3c';
                      const tmColorPositive = isObj && tmVal.colorPositive ? tmVal.colorPositive : '#2ecc71';

                      return (
                        <div key={tmName} className={styles.metricBlock} style={{ marginTop: '6px' }}>
                          <div className={styles.metricHeaderRow}>
                            <input
                              type="text"
                              defaultValue={tmName}
                              onBlur={e => {
                                const trimmed = e.target.value.trim();
                                if (!trimmed) { e.target.value = tmName; return; }
                                const cleanId = trimmed.replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                                const newId = cleanId || `NewMetric_${Date.now()}`;
                                if (newId !== tmName) {
                                  if ((targetMetricsSource || {})[newId] !== undefined) {
                                    alert(`Metric "${trimmed}" already exists.`);
                                    e.target.value = tmName;
                                    return;
                                  }
                                  handleUpdateTargetRelation(targetName, 'renameMetric', { oldKey: tmName, newKey: newId });
                                }
                              }}
                              className={styles.metricNameInput}
                            />
                            <div className={styles.metricValueGroup}>
                              <input
                                type="number"
                                value={tmValue !== undefined ? tmValue : 0}
                                onChange={e => handleUpdateTargetRelation(targetName, 'updateMetricValue', { field: tmName, value: Number(e.target.value) })}
                                className={styles.metricValueInput}
                              />
                              <button
                                type="button"
                                className="rpg-btn-del"
                                onClick={() => handleUpdateTargetRelation(targetName, 'removeMetric', { metric: tmName })}
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          <RelationMetricConfig
                            colorNegative={tmColorNegative}
                            colorPositive={tmColorPositive}
                            min={tmMin}
                            max={tmMax}
                            onChange={(key, val) => handleUpdateTargetRelation(targetName, 'updateMetricConfig', { metric: tmName, config: { [key]: val } })}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}