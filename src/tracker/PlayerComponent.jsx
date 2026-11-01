import React from 'react';
import styles from './PlayerComponent.module.css';
import { LockIcon, CheckIcon } from '../Icons';
import { useRPG } from '../core/RPGControl';
import { AutoGrowingTextArea, ToggleSwitch } from '../utils';

/**
 * Formats slot and container keys into clean Title Case labels.
 */
function formatSlotName(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return rawKey
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function PlayerComponent({ char, activeTabs, onOpenEditor }) {
  const { patchCharacterField } = useRPG();

  const inventory = char.inventory || {
    equipIsLocked: false,
    equipIsInject: true,
    storageIsLocked: false,
    storageIsInject: true,
    equipmentLocks: {},
    storageLocks: {},
    equipment: { 'Right Hand': null, 'Left Hand': null },
    storage: { 'Backpack': [] }
  };

  const quests = char.quests || {
    main: { name: '', desc: '', isCompleted: false, isLocked: false },
    sides: []
  };

  const handleUpdateMainQuest = (key, value) => {
    patchCharacterField(char.id, ['quests', 'main', key], value);
  };

  const handleAddSideQuest = () => {
    const currentSides = Array.isArray(quests.sides) ? quests.sides : [];
    patchCharacterField(char.id, ['quests', 'sides'], [
      ...currentSides,
      {
        id: `quest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: '',
        desc: '',
        isCompleted: false,
        isLocked: false
      }
    ]);
  };

  const handleUpdateSideQuest = (id, key, value) => {
    const currentSides = Array.isArray(quests.sides) ? quests.sides : [];
    const index = currentSides.findIndex(q => q.id === id);
    if (index === -1) return;

    patchCharacterField(char.id, ['quests', 'sides', index, key], value);
  };

  const handleRemoveSideQuest = (id) => {
    if (!window.confirm("Are you sure you want to delete this side quest?")) return;
    const currentSides = Array.isArray(quests.sides) ? quests.sides : [];
    patchCharacterField(char.id, ['quests', 'sides'], currentSides.filter(q => q.id !== id));
  };

  return (
    <div className={styles.tabContentStack}>
      {/* 1. Inventory Tab View */}
      {activeTabs.inventory && (
        <div className={styles.inlineTabContent}>
          <div className={styles.inlineHeaderLabelRow}>
            <span className={styles.inlineSheetTitle}>Inventory</span>
            <div className={styles.flexCenterGap}>
              <button
                type="button"
                className="rpg-btn-sm"
                onClick={() => onOpenEditor && onOpenEditor('inventory')}
              >
                Open Editor
              </button>
            </div>
          </div>

          <div className={styles.sidebarInventoryGrid}>
            {/* Equipment Section */}
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <div className={styles.sidebarSectionTitleRow}>
                  <LockIcon
                    isLocked={inventory.equipIsLocked}
                    onClick={() => patchCharacterField(char.id, ['inventory', 'equipIsLocked'], !inventory.equipIsLocked)}
                    title={inventory.equipIsLocked ? "Equipment is locked" : "Lock all equipment slots"}
                  />
                  <span className={styles.sidebarSectionTitle}>Equipment</span>
                </div>
                <ToggleSwitch
                  label="Inject"
                  title="Toggle Prompt Injection"
                  checked={inventory.equipIsInject !== false}
                  onChange={(checked) => patchCharacterField(char.id, ['inventory', 'equipIsInject'], checked)}
                />
              </div>

              <div className={styles.sideBySideRow}>
                {Object.entries(inventory.equipment || {}).map(([slotKey, item]) => {
                  const isSlotLocked = inventory.equipIsLocked || inventory.equipmentLocks?.[slotKey] === true;

                  return (
                    <div key={slotKey} className={styles.sidebarEquipSlot} title={item?.desc || ''}>
                      <div className={styles.sidebarStorageHeaderRow}>
                        <span className={styles.slotSmallLabel} style={{ margin: 0 }}>
                          {formatSlotName(slotKey)}
                        </span>
                        <LockIcon
                          isLocked={isSlotLocked}
                          onClick={() => {
                            const nextLocks = { ...(inventory.equipmentLocks || {}) };
                            nextLocks[slotKey] = !nextLocks[slotKey];
                            patchCharacterField(char.id, ['inventory', 'equipmentLocks'], nextLocks);
                          }}
                          size={11}
                          title={isSlotLocked ? "Slot is locked" : "Lock this slot"}
                        />
                      </div>

                      <div className={styles.itemInfoStack}>
                        <span className={styles.itemSidebarText}>
                          {item ? item.name : 'Empty'}
                          {item && item.isContainer && (
                            <span className={styles.containerBadge}>Container</span>
                          )}
                        </span>
                        {item && item.desc && (
                          <span className={styles.itemSidebarDescText}>
                            {item.desc}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Storage Containers Section */}
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <div className={styles.sidebarSectionTitleRow}>
                  <LockIcon
                    isLocked={inventory.storageIsLocked}
                    onClick={() => patchCharacterField(char.id, ['inventory', 'storageIsLocked'], !inventory.storageIsLocked)}
                    title={inventory.storageIsLocked ? "Storage is locked" : "Lock all storage containers"}
                  />
                  <span className={styles.sidebarSectionTitle}>Storage Containers</span>
                </div>
                <ToggleSwitch
                  label="Inject"
                  title="Toggle Prompt Injection"
                  checked={inventory.storageIsInject !== false}
                  onChange={(checked) => patchCharacterField(char.id, ['inventory', 'storageIsInject'], checked)}
                />
              </div>

              <div className={styles.sideBySideRow}>
                {Object.entries(inventory.storage || {}).map(([storageKey, items]) => {
                  const itemList = Array.isArray(items) ? items : [];
                  const isContainerLocked = inventory.storageIsLocked || inventory.storageLocks?.[storageKey] === true;

                  return (
                    <div key={storageKey} className={styles.sidebarStorageSlot}>
                      <div className={styles.sidebarStorageHeaderRow}>
                        <span className={styles.slotSmallLabel} style={{ margin: 0 }}>
                          {formatSlotName(storageKey)} ({itemList.length})
                        </span>
                        <LockIcon
                          isLocked={isContainerLocked}
                          onClick={() => {
                            const nextLocks = { ...(inventory.storageLocks || {}) };
                            nextLocks[storageKey] = !nextLocks[storageKey];
                            patchCharacterField(char.id, ['inventory', 'storageLocks'], nextLocks);
                          }}
                          size={11}
                          title={isContainerLocked ? "Container is locked" : "Lock this container"}
                        />
                      </div>

                      <div className={styles.sidebarStorageList}>
                        {itemList.map((item, idx) => {
                          const itemType = item?.type || 'general';
                          const itemName = item?.name || '(Unnamed)';

                          return (
                            <div key={item?.id || idx} className={`${styles.storageItemBlock} ${styles[itemType]}`} title={item?.desc || ''}>
                              <div className={styles.itemMainLine}>
                                <span className={styles.itemBullet}>&bull;</span>
                                <span className={styles.itemSidebarText}>
                                  {itemName}
                                </span>

                                {itemType === 'general' && item.quantity > 1 && (
                                  <span className={styles.qtyBadge}>x{item.quantity}</span>
                                )}
                                {itemType === 'currency' && (
                                  <span className={styles.currencyBadge}>
                                    {item.quantity !== undefined ? item.quantity : 0}
                                  </span>
                                )}
                                {itemType === 'asset' && (
                                  <span className={styles.assetBadge}>
                                    {item.assetValue?.amount || 0} {item.assetValue?.currencyName || 'Gold'}
                                  </span>
                                )}
                              </div>
                              {itemType !== 'currency' && item?.desc && (
                                <span className={styles.itemSidebarDescTextIndented}>
                                  {item.desc}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {itemList.length === 0 && (
                          <span className="rpg-empty-text" style={{ fontSize: '10px', padding: '4px 0' }}>
                            No items
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Quests Tab View */}
      {activeTabs.quests && (
        <div className={styles.inlineTabContent}>
          <div className={styles.inlineHeaderLabelRow}>
            <span className={styles.inlineSheetTitle}>Quest</span>
          </div>

          <div className={styles.questContainer}>
            {/* Main Quest Block */}
            <div className={`${styles.questContentBlock} ${quests.main?.isCompleted ? styles.questCompleted : ''}`}>
              <div className={styles.questHeaderRow}>
                <CheckIcon
                  checked={quests.main?.isCompleted || false}
                  onClick={() => handleUpdateMainQuest('isCompleted', !quests.main?.isCompleted)}
                />
                <input
                  type="text"
                  className={`${styles.textBlockInput} ${styles.questTitleInputText} ${quests.main?.isCompleted ? styles.textStrike : ''}`}
                  value={quests.main?.name || ''}
                  onChange={e => handleUpdateMainQuest('name', e.target.value)}
                  placeholder="Main Quest Title..."
                />
                <LockIcon
                  isLocked={quests.main?.isLocked}
                  onClick={() => handleUpdateMainQuest('isLocked', !quests.main?.isLocked)}
                />
              </div>
              <div className={quests.main?.isCompleted ? styles.textStrike : ''}>
                <AutoGrowingTextArea
                  className={styles.textBlockInput}
                  value={quests.main?.desc || ''}
                  onChange={val => handleUpdateMainQuest('desc', val)}
                  placeholder="Quest details..."
                />
              </div>
            </div>
          </div>

          {/* Side Quests Section */}
          <div className={`${styles.inlineHeaderLabelRow} ${styles.sideQuestHeader}`}>
            <span className={styles.inlineSheetTitle}>Side Quests</span>
            <button type="button" className="rpg-btn-sm" onClick={handleAddSideQuest}>
              + Add Side
            </button>
          </div>

          <div className={styles.questsListContainer}>
            {(!quests.sides || quests.sides.length === 0) ? (
              <p className="rpg-empty-text">No active side quests.</p>
            ) : (
              quests.sides.map((q, idx) => (
                <div key={q.id} className={`${styles.questContentBlock} ${q.isCompleted ? styles.questCompleted : ''}`}>
                  <div className={styles.questSideHeaderRow}>
                    <span className={styles.questSideIndex}>Side Quest {idx + 1}</span>
                    <button
                      type="button"
                      className="rpg-btn-del-text"
                      onClick={() => handleRemoveSideQuest(q.id)}
                      title="Delete this side quest"
                    >
                      &times;
                    </button>
                  </div>
                  <div className={styles.questHeaderRow}>
                    <CheckIcon
                      checked={q.isCompleted || false}
                      onClick={() => handleUpdateSideQuest(q.id, 'isCompleted', !q.isCompleted)}
                    />
                    <input
                      type="text"
                      className={`${styles.textBlockInput} ${styles.questTitleInputText} ${q.isCompleted ? styles.textStrike : ''}`}
                      value={q.name || ''}
                      onChange={e => handleUpdateSideQuest(q.id, 'name', e.target.value)}
                      placeholder="Side Quest Title..."
                    />
                    <LockIcon
                      isLocked={q.isLocked}
                      onClick={() => handleUpdateSideQuest(q.id, 'isLocked', !q.isLocked)}
                    />
                  </div>
                  <div className={q.isCompleted ? styles.textStrike : ''}>
                    <AutoGrowingTextArea
                      className={styles.textBlockInput}
                      value={q.desc || ''}
                      onChange={val => handleUpdateSideQuest(q.id, 'desc', val)}
                      placeholder="Quest details..."
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}