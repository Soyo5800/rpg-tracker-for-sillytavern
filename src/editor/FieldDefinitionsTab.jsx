import React, { useState, useMemo } from 'react';
import statusStyles from './StatusEditor.module.css';
import styles from './CharListEditor.module.css';
import { ToggleSwitch, AccordionArrow, AutoGrowingTextArea } from '../utils';
import { StatusSpecConfig } from './StatusSpecsTab';
import { RelationMetricConfig } from './RelationsTab';

/**
 * Field Definitions and Global AI Guidelines management tab.
 * Aggregates unique fields across all characters and manages unified guidelines.
 */
export default function FieldDefinitionsTab({
  localCharacters,
  setLocalCharacters,
  localDefObj,
  setLocalDefObj
}) {
  const [expandedDefIds, setExpandedDefIds] = useState({});
  const [globalSyncToggles, setGlobalSyncToggles] = useState({});

  // Aggregate unique field definitions across all active character sheets
  const uniqueFields = useMemo(() => {
    const statusMap = new Map();
    const profileMap = new Map();
    const relationMap = new Map();

    localCharacters.forEach(char => {
      (char.statusSchema || []).forEach(s => {
        const idKey = s.id || s.name;
        if (idKey && !statusMap.has(idKey)) {
          statusMap.set(idKey, {
            id: s.id || idKey,
            name: s.name || idKey,
            type: s.type || 'consumable',
            color: s.color || (s.type === 'stacking' ? '#3498db' : '#e74c3c'),
            min: s.min !== undefined ? s.min : 0,
            max: s.max !== undefined ? s.max : 100
          });
        }
      });

      if (char.profile) {
        Object.keys(char.profile).forEach(k => {
          if (!profileMap.has(k)) {
            profileMap.set(k, { id: k, name: k });
          }
        });
      }

      if (char.relations) {
        Object.values(char.relations).forEach(rel => {
          if (rel.values) {
            Object.entries(rel.values).forEach(([mName, mVal]) => {
              if (!relationMap.has(mName)) {
                const isObj = typeof mVal === 'object' && mVal !== null;
                relationMap.set(mName, {
                  id: mName,
                  name: mName,
                  min: isObj && mVal.min !== undefined ? mVal.min : -100,
                  max: isObj && mVal.max !== undefined ? mVal.max : 100,
                  colorPositive: isObj && mVal.colorPositive ? mVal.colorPositive : '#2ecc71',
                  colorNegative: isObj && mVal.colorNegative ? mVal.colorNegative : '#e74c3c'
                });
              }
            });
          }
        });
      }
    });

    const TYPE_PRIORITY = { consumable: 0, stacking: 1, integer: 2, text: 3 };

    const sortStatus = (a, b) => {
      const pA = TYPE_PRIORITY[a.type] !== undefined ? TYPE_PRIORITY[a.type] : 99;
      const pB = TYPE_PRIORITY[b.type] !== undefined ? TYPE_PRIORITY[b.type] : 99;
      if (pA !== pB) return pA - pB;
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    };

    const sortById = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });

    return {
      status: Array.from(statusMap.values()).sort(sortStatus),
      profiles: Array.from(profileMap.values()).sort(sortById),
      relations: Array.from(relationMap.values()).sort(sortById)
    };
  }, [localCharacters]);

  const toggleDefAccordion = (fullKey) => {
    setExpandedDefIds(prev => ({ ...prev, [fullKey]: !prev[fullKey] }));
  };

  const handleToggleGlobalSync = (fieldKey, checked) => {
    setGlobalSyncToggles(prev => ({ ...prev, [fieldKey]: checked }));

    if (checked) {
      if (fieldKey.startsWith('status_')) {
        const fieldId = fieldKey.replace(/^status_/, '');
        const targetItem = uniqueFields.status.find(s => s.id === fieldId);
        if (targetItem) {
          const updatedCharacters = localCharacters.map(char => {
            const cloned = JSON.parse(JSON.stringify(char));
            if (Array.isArray(cloned.statusSchema)) {
              cloned.statusSchema = cloned.statusSchema.map(s => {
                if (s.id === fieldId || s.name === fieldId) {
                  return {
                    ...s,
                    type: targetItem.type,
                    min: targetItem.min,
                    max: targetItem.max,
                    color: targetItem.color
                  };
                }
                return s;
              });
            }
            return cloned;
          });
          setLocalCharacters(updatedCharacters);
        }
      } else if (fieldKey.startsWith('relation_')) {
        const metricId = fieldKey.replace(/^relation_/, '');
        const targetItem = uniqueFields.relations.find(r => r.id === metricId);
        if (targetItem) {
          const updatedCharacters = localCharacters.map(char => {
            const cloned = JSON.parse(JSON.stringify(char));
            if (cloned.relations) {
              Object.values(cloned.relations).forEach(rData => {
                if (rData.values && rData.values[metricId]) {
                  const old = rData.values[metricId];
                  const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0 };
                  rData.values[metricId] = {
                    ...currentObj,
                    min: targetItem.min,
                    max: targetItem.max,
                    colorPositive: targetItem.colorPositive,
                    colorNegative: targetItem.colorNegative
                  };
                }
                if (rData.targetValues && rData.targetValues[metricId]) {
                  const old = rData.targetValues[metricId];
                  const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0 };
                  rData.targetValues[metricId] = {
                    ...currentObj,
                    min: targetItem.min,
                    max: targetItem.max,
                    colorPositive: targetItem.colorPositive,
                    colorNegative: targetItem.colorNegative
                  };
                }
              });
            }
            return cloned;
          });
          setLocalCharacters(updatedCharacters);
        }
      }
    }
  };

  const clearDefinitions = () => {
    if (window.confirm("Clear all field guidelines? (Field styles and values are preserved)")) {
      setLocalDefObj({});
    }
  };

  const handleRenameFieldUnified = (category, oldId, newNameRaw) => {
    const trimmed = newNameRaw.trim();
    if (!trimmed || trimmed === oldId) return false;

    const cleanNewId = trimmed.replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (!cleanNewId) return false;

    // Duplicate identifier validation guards
    if (category === 'status') {
      const exists = uniqueFields.status.some(s =>
        (s.id.toLowerCase() === cleanNewId.toLowerCase() || s.name.trim().toLowerCase() === trimmed.toLowerCase()) &&
        s.id !== oldId
      );
      if (exists) {
        alert(`The status field "${trimmed}" already exists.`);
        return false;
      }
    } else if (category === 'profile') {
      const exists = uniqueFields.profiles.some(p =>
        (p.id.toLowerCase() === cleanNewId.toLowerCase() || p.name.trim().toLowerCase() === trimmed.toLowerCase()) &&
        p.id !== oldId
      );
      if (exists) {
        alert(`The profile field "${trimmed}" already exists.`);
        return false;
      }
    } else if (category === 'relation') {
      const exists = uniqueFields.relations.some(r =>
        (r.id.toLowerCase() === cleanNewId.toLowerCase() || r.name.trim().toLowerCase() === trimmed.toLowerCase()) &&
        r.id !== oldId
      );
      if (exists) {
        alert(`The relation metric "${trimmed}" already exists.`);
        return false;
      }
    }

    const updatedCharacters = localCharacters.map(char => {
      const cloned = JSON.parse(JSON.stringify(char));

      if (category === 'status') {
        if (Array.isArray(cloned.statusSchema)) {
          cloned.statusSchema = cloned.statusSchema.map(s =>
            (s.id === oldId || s.name === oldId) ? { ...s, id: cleanNewId, name: trimmed } : s
          );
        }
        if (cloned.status && cloned.status[oldId] !== undefined) {
          cloned.status[cleanNewId] = cloned.status[oldId];
          delete cloned.status[oldId];
        }
      } else if (category === 'profile') {
        if (cloned.profile && cloned.profile[oldId] !== undefined) {
          const nextProf = {};
          const nextLocks = {};
          const nextInjects = {};
          Object.keys(cloned.profile).forEach(k => {
            const targetKey = (k === oldId) ? cleanNewId : k;
            nextProf[targetKey] = cloned.profile[k];
            if (cloned.profileLocks) nextLocks[targetKey] = cloned.profileLocks[k];
            if (cloned.profileInjects) nextInjects[targetKey] = cloned.profileInjects[k];
          });
          cloned.profile = nextProf;
          cloned.profileLocks = nextLocks;
          cloned.profileInjects = nextInjects;
        }
      } else if (category === 'relation') {
        if (cloned.relations) {
          Object.values(cloned.relations).forEach(rData => {
            if (rData.values && rData.values[oldId] !== undefined) {
              rData.values[cleanNewId] = rData.values[oldId];
              delete rData.values[oldId];
            }
            if (rData.targetValues && rData.targetValues[oldId] !== undefined) {
              rData.targetValues[cleanNewId] = rData.targetValues[oldId];
              delete rData.targetValues[oldId];
            }
          });
        }
      }

      return cloned;
    });

    const oldGuideKey = `${category}_${oldId}`;
    const newGuideKey = `${category}_${cleanNewId}`;
    const nextDefObj = { ...localDefObj };
    if (nextDefObj[oldGuideKey] !== undefined) {
      nextDefObj[newGuideKey] = nextDefObj[oldGuideKey];
      delete nextDefObj[oldGuideKey];
    }

    setLocalCharacters(updatedCharacters);
    setLocalDefObj(nextDefObj);

    setExpandedDefIds(prev => {
      const next = { ...prev };
      if (next[oldGuideKey] !== undefined) {
        next[newGuideKey] = next[oldGuideKey];
        delete next[oldGuideKey];
      }
      return next;
    });

    setGlobalSyncToggles(prev => {
      const next = { ...prev };
      if (next[oldGuideKey] !== undefined) {
        next[newGuideKey] = next[oldGuideKey];
        delete next[oldGuideKey];
      }
      return next;
    });

    return true;
  };

  const handleUpdateStatusProperty = (fieldId, propKey, value) => {
    const isGlobalSyncOn = globalSyncToggles[`status_${fieldId}`] === true;
    if (!isGlobalSyncOn) return;

    const updatedCharacters = localCharacters.map(char => {
      const cloned = JSON.parse(JSON.stringify(char));
      if (Array.isArray(cloned.statusSchema)) {
        cloned.statusSchema = cloned.statusSchema.map(s => {
          if (s.id === fieldId || s.name === fieldId) {
            return { ...s, [propKey]: value };
          }
          return s;
        });
      }
      return cloned;
    });

    setLocalCharacters(updatedCharacters);
  };

  const handleUpdateRelationProperty = (metricId, propKey, value) => {
    const isGlobalSyncOn = globalSyncToggles[`relation_${metricId}`] === true;
    if (!isGlobalSyncOn) return;

    const updatedCharacters = localCharacters.map(char => {
      const cloned = JSON.parse(JSON.stringify(char));
      if (cloned.relations) {
        Object.values(cloned.relations).forEach(rData => {
          if (rData.values && rData.values[metricId]) {
            const old = rData.values[metricId];
            const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0 };
            rData.values[metricId] = { ...currentObj, [propKey]: value };
          }
          if (rData.targetValues && rData.targetValues[metricId]) {
            const old = rData.targetValues[metricId];
            const currentObj = typeof old === 'object' && old !== null ? old : { value: old || 0 };
            rData.targetValues[metricId] = { ...currentObj, [propKey]: value };
          }
        });
      }
      return cloned;
    });

    setLocalCharacters(updatedCharacters);
  };

  return (
    <div className={styles.definitionsContainer}>
      <div className={styles.defTopBar}>
        <span className={styles.defSectionTitle}>
          Field Definitions & Global Guidelines
        </span>
        <button
          type="button"
          className="rpg-btn-sm"
          onClick={clearDefinitions}
          title="Clear all AI guidelines"
        >
          Clear Guidelines
        </button>
      </div>

      <div className={styles.defInfoNotice}>
        <div>Set guidelines for the AI.</div>
        <div>* Turn on 'Global' switch only when you want to overwrite styles and types to all characters.</div>
      </div>

      {uniqueFields.status.length > 0 && (
        <div className={styles.defGroup}>
          <h5 className={styles.defGroupTitle}>Status Fields</h5>
          {uniqueFields.status.map(item => {
            const fullKey = `status_${item.id}`;
            const isExpanded = !!expandedDefIds[fullKey];
            const isGlobalOn = globalSyncToggles[fullKey] || false;

            return (
              <div key={`${fullKey}_${item.name || item.id}`} className={`${statusStyles.schemaItem} ${isExpanded ? statusStyles.itemExpanded : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', background: 'rgba(0, 0, 0, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <AccordionArrow
                        isExpanded={isExpanded}
                        onClick={() => toggleDefAccordion(fullKey)}
                      />
                      <input
                        type="text"
                        className={statusStyles.nameInput}
                        style={{ width: '140px', fontWeight: 'bold', color: 'var(--rpg-highlight)' }}
                        defaultValue={item.name || item.id}
                        placeholder="Field Name"
                        onBlur={(e) => {
                          const success = handleRenameFieldUnified('status', item.id, e.target.value);
                          if (!success) e.target.value = item.name || item.id;
                        }}
                      />
                    </div>

                    <ToggleSwitch
                      label="Global"
                      checked={isGlobalOn}
                      onChange={(checked) => handleToggleGlobalSync(fullKey, checked)}
                      title="When enabled, edits to style/type below will overwrite all characters"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingLeft: '22px', boxSizing: 'border-box' }}>
                    <AutoGrowingTextArea
                      className="rpg-input"
                      value={localDefObj[fullKey] || ''}
                      onChange={(val) => setLocalDefObj({ ...localDefObj, [fullKey]: val })}
                      placeholder={`AI Guide for ${item.name || item.id}...`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className={statusStyles.itemFields} style={{ opacity: isGlobalOn ? 1 : 0.65 }}>
                    <StatusSpecConfig
                      type={item.type}
                      min={item.min}
                      max={item.max}
                      color={item.color}
                      disabled={!isGlobalOn}
                      onChange={(propKey, value) => handleUpdateStatusProperty(item.id, propKey, value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uniqueFields.profiles.length > 0 && (
        <div className={styles.defGroup}>
          <h5 className={styles.defGroupTitle}>Profile Fields</h5>
          {uniqueFields.profiles.map(item => {
            const fullKey = `profile_${item.id}`;
            return (
              <div key={`${fullKey}_${item.name || item.id}`} className={statusStyles.schemaItem}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', background: 'rgba(0, 0, 0, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <span style={{ width: '18px', textAlign: 'center', opacity: 0.4, fontSize: '10px' }}>-</span>
                    <input
                      type="text"
                      className={statusStyles.nameInput}
                      style={{ width: '140px', fontWeight: 'bold', color: 'var(--rpg-highlight)' }}
                      defaultValue={item.name || item.id}
                      placeholder="Field Name"
                      onBlur={(e) => {
                        const success = handleRenameFieldUnified('profile', item.id, e.target.value);
                        if (!success) e.target.value = item.name || item.id;
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingLeft: '18px', boxSizing: 'border-box' }}>
                    <AutoGrowingTextArea
                      className="rpg-input"
                      value={localDefObj[fullKey] || ''}
                      onChange={(val) => setLocalDefObj({ ...localDefObj, [fullKey]: val })}
                      placeholder={`AI Guide for ${item.name || item.id}...`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uniqueFields.relations.length > 0 && (
        <div className={styles.defGroup}>
          <h5 className={styles.defGroupTitle}>Relationship Metrics</h5>
          {uniqueFields.relations.map(item => {
            const fullKey = `relation_${item.id}`;
            const isExpanded = !!expandedDefIds[fullKey];
            const isGlobalOn = globalSyncToggles[fullKey] || false;

            return (
              <div key={`${fullKey}_${item.name || item.id}`} className={`${statusStyles.schemaItem} ${isExpanded ? statusStyles.itemExpanded : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', background: 'rgba(0, 0, 0, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <AccordionArrow
                        isExpanded={isExpanded}
                        onClick={() => toggleDefAccordion(fullKey)}
                      />
                      <input
                        type="text"
                        className={statusStyles.nameInput}
                        style={{ width: '140px', fontWeight: 'bold', color: 'var(--rpg-highlight)' }}
                        defaultValue={item.name || item.id}
                        placeholder="Metric Name"
                        onBlur={(e) => {
                          const success = handleRenameFieldUnified('relation', item.id, e.target.value);
                          if (!success) e.target.value = item.name || item.id;
                        }}
                      />
                    </div>

                    <ToggleSwitch
                      label="Global"
                      checked={isGlobalOn}
                      onChange={(checked) => handleToggleGlobalSync(fullKey, checked)}
                      title="When enabled, metric colors/ranges will overwrite all characters"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingLeft: '22px', boxSizing: 'border-box' }}>
                    <AutoGrowingTextArea
                      className="rpg-input"
                      value={localDefObj[fullKey] || ''}
                      onChange={(val) => setLocalDefObj({ ...localDefObj, [fullKey]: val })}
                      placeholder={`AI Guide for ${item.name || item.id}...`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className={statusStyles.itemFields} style={{ opacity: isGlobalOn ? 1 : 0.65, padding: '8px 10px' }}>
                    <RelationMetricConfig
                      colorNegative={item.colorNegative}
                      colorPositive={item.colorPositive}
                      min={item.min}
                      max={item.max}
                      disabled={!isGlobalOn}
                      onChange={(propKey, value) => handleUpdateRelationProperty(item.id, propKey, value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}