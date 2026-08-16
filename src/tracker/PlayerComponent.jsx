import React from 'react';
import styles from './PlayerComponent.module.css';
import { LockIcon, CheckIcon } from '../Icons';
import { useRPG } from '../core/RPGControl';
import { AutoGrowingTextArea, ToggleSwitch } from '../utils';

export default function PlayerComponent({ char, activeTabs, onOpenEditor }) {
  const { patchCharacterField } = useRPG();

  const inventory = char.inventory || {
    equipment: { right_hand: null, left_hand: null },
    storage: { backpack: [], pouch: [] },
    storageLocks: {}
  };
  const quests = char.quests || {
    main: { name: '', desc: '' },
    sides: []
  };

  const handleUpdateMainQuest = (key, value) => {
    patchCharacterField(char.id, ['quests', 'main', key], value);
  };

  const handleAddSideQuest = () => {
    const currentSides = quests.sides || [];
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
    const currentSides = quests.sides || [];
    const index = currentSides.findIndex(q => q.id === id);
    if (index === -1) return;

    patchCharacterField(char.id, ['quests', 'sides', index, key], value);
  };

  const handleRemoveSideQuest = (id) => {
    const currentSides = quests.sides || [];
    patchCharacterField(char.id, ['quests', 'sides'], currentSides.filter(q => q.id !== id));
  };

  return (
    <div className={styles.tabContentStack}>
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
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <div className={styles.sidebarSectionTitleRow}>
                  <LockIcon
                    isLocked={inventory.equipIsLocked}
                    onClick={() => patchCharacterField(char.id, ['inventory', 'equipIsLocked'], !inventory.equipIsLocked)}
                    className={`${styles.lockIcon} ${inventory.equipIsLocked ? styles.lockIconActive : ''}`}
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
                {Object.entries(inventory.equipment || {}).map(([slotKey, item]) => (
                  <div key={slotKey} className={styles.sidebarEquipSlot} title={item?.desc || ''}>
                    <span className={styles.slotSmallLabel}>
                      {slotKey.charAt(0).toUpperCase() + slotKey.slice(1).replace('_', ' ')}
                    </span>
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
                ))}
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <div className={styles.sidebarSectionTitleRow}>
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
                  const isContainerLocked = inventory.storageLocks?.[storageKey] || false;
                  return (
                    <div key={storageKey} className={styles.sidebarStorageSlot}>
                      <div className={styles.sidebarStorageHeaderRow}>
                        <span className={styles.slotSmallLabel} style={{ margin: 0 }}>
                          {storageKey.charAt(0).toUpperCase() + storageKey.slice(1)} ({itemList.length})
                        </span>
                        <LockIcon
                          isLocked={isContainerLocked}
                          onClick={() => patchCharacterField(char.id, ['inventory', 'storageLocks', storageKey], !isContainerLocked)}
                          className={`${styles.lockIcon} ${isContainerLocked ? styles.lockIconActive : ''}`}
                          size={11}
                        />
                      </div>
                      <div className={styles.sidebarStorageList}>
                        {itemList.map((item, idx) => {
                          const itemType = item.type || 'general';
                          return (
                            <div key={item.id || idx} className={`${styles.storageItemBlock} ${styles[itemType]}`} title={item.desc || ''}>
                              <div className={styles.itemMainLine}>
                                <span className={styles.itemBullet}>&bull;</span>
                                <span className={styles.itemSidebarText}>
                                  {item.name || '(Unnamed)'}
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
                              {itemType !== 'currency' && item.desc && (
                                <span className={styles.itemSidebarDescTextIndented}>
                                  {item.desc}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {itemList.length === 0 && <span className={styles.emptyTextIndicator}>No items</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTabs.quests && (
        <div className={styles.inlineTabContent}>
          <div className={styles.inlineHeaderLabelRow}>
            <span className={styles.inlineSheetTitle}>Quest</span>
          </div>

          <div className={styles.questContainer}>
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
                  className={`${styles.lockIcon} ${quests.main?.isLocked ? styles.lockIconActive : ''}`}
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

          <div className={`${styles.inlineHeaderLabelRow} ${styles.sideQuestHeader}`}>
            <span className={styles.inlineSheetTitle}>Side Quests</span>
            <button type="button" className="rpg-btn-sm" onClick={handleAddSideQuest}>
              + Add Side
            </button>
          </div>

          <div className={styles.questsListContainer}>
            {(!quests.sides || quests.sides.length === 0) ? (
              <p className={styles.emptyPlaceholder}>No active side quests.</p>
            ) : (
              quests.sides.map((q, idx) => (
                <div key={q.id} className={`${styles.questContentBlock} ${q.isCompleted ? styles.questCompleted : ''}`}>
                  <div className={styles.questSideHeaderRow}>
                    <span className={styles.questSideIndex}>Side Quest {idx + 1}</span>
                    <button type="button" className="rpg-btn-del-text" onClick={() => handleRemoveSideQuest(q.id)}>
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
                      className={`${styles.lockIcon} ${q.isLocked ? styles.lockIconActive : ''}`}
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