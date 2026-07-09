import React, { useRef } from 'react';
import styles from './StatusEditor.module.css';
import { AutoGrowingTextArea } from '../utils';

export default function InventoryTab({
  charId, targetChar, localCharacters, setLocalCharacters,
  expandedIds, setExpandedIds, handleUpdateNestedField
}) {

  const scrollIntervalRef = useRef(null);

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleDragStart = (e, loc, key, index, item) => {
    const payload = JSON.stringify({ loc, key, index, item });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', 'rpg_tracker_item');
    }
  };

  const handleDrop = (e, destLoc, destKey, destIdx = null) => {
    e.preventDefault();
    e.stopPropagation();
    stopAutoScroll();

    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;

    let dragItem;
    try {
      dragItem = JSON.parse(payload);
    } catch (err) {
      return;
    }

    const nextEquip = { ...(targetChar.inventory?.equipment || {}) };
    const nextStorage = { ...(targetChar.inventory?.storage || {}) };

    if (destLoc === 'storage' && dragItem.loc === 'storage' && dragItem.key === destKey && destIdx !== null) {
      const newList = [...(nextStorage[destKey] || [])];
      const [removed] = newList.splice(dragItem.index, 1);
      let insertIdx = destIdx;
      if (destIdx > dragItem.index) insertIdx -= 1;
      newList.splice(insertIdx, 0, removed);
      nextStorage[destKey] = newList;
    } else {
      let itemToMove = dragItem.item;
      if (dragItem.loc === 'equipment') {
        nextEquip[dragItem.key] = null;
      } else {
        const srcList = [...(nextStorage[dragItem.key] || [])];
        const [removed] = srcList.splice(dragItem.index, 1);
        if (removed) itemToMove = removed;
        nextStorage[dragItem.key] = srcList;
      }

      if (destLoc === 'equipment') {
        const displaced = nextEquip[destKey];
        nextEquip[destKey] = itemToMove;
        if (displaced) {
          const firstStore = Object.keys(nextStorage)[0] || 'backpack';
          if (!nextStorage[firstStore]) nextStorage[firstStore] = [];
          nextStorage[firstStore].push(displaced);
        }
      } else {
        if (!nextStorage[destKey]) nextStorage[destKey] = [];
        let destList = [...(nextStorage[destKey] || [])];
        if (destIdx !== null && destIdx !== undefined) {
          destList.splice(destIdx, 0, itemToMove);
        } else {
          destList.push(itemToMove);
        }
        nextStorage[destKey] = destList;
      }
    }

    setLocalCharacters(localCharacters.map(c => {
      if (c.id !== charId) return c;
      return {
        ...c,
        inventory: { ...(c.inventory || {}), equipment: nextEquip, storage: nextStorage }
      };
    }));
  };

  const handleReorderEquipmentSlot = (slotKey, direction) => {
    setLocalCharacters(localCharacters.map(c => {
      if (c.id !== charId) return c;
      const equip = c.inventory?.equipment || {};
      const keys = Object.keys(equip);
      const index = keys.indexOf(slotKey);
      if (index === -1) return c;

      const nextKeys = [...keys];
      if (direction === 'up' && index > 0) {
        const temp = nextKeys[index]; nextKeys[index] = nextKeys[index - 1]; nextKeys[index - 1] = temp;
      } else if (direction === 'down' && index < keys.length - 1) {
        const temp = nextKeys[index]; nextKeys[index] = nextKeys[index + 1]; nextKeys[index + 1] = temp;
      } else return c;

      const nextEquip = {};
      nextKeys.forEach(k => { nextEquip[k] = equip[k]; });
      return { ...c, inventory: { ...(c.inventory || {}), equipment: nextEquip } };
    }));
  };

  const handleReorderStorage = (storageKey, direction) => {
    setLocalCharacters(localCharacters.map(c => {
      if (c.id !== charId) return c;
      const storage = c.inventory?.storage || {};
      const keys = Object.keys(storage);
      const index = keys.indexOf(storageKey);
      if (index === -1) return c;

      const nextKeys = [...keys];
      if (direction === 'up' && index > 0) {
        const temp = nextKeys[index]; nextKeys[index] = nextKeys[index - 1]; nextKeys[index - 1] = temp;
      } else if (direction === 'down' && index < keys.length - 1) {
        const temp = nextKeys[index]; nextKeys[index] = nextKeys[index + 1]; nextKeys[index + 1] = temp;
      } else return c;

      const nextStorage = {};
      nextKeys.forEach(k => { nextStorage[k] = storage[k]; });
      return { ...c, inventory: { ...(c.inventory || {}), storage: nextStorage } };
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const clientY = e.clientY;
    const scrollParent = e.currentTarget.closest('[class*="editorBody"], [class*="panelBody"]');
    if (!scrollParent) return;

    const rect = scrollParent.getBoundingClientRect();
    const threshold = 50;
    const speed = 10;

    if (clientY < rect.top + threshold) {
      if (!scrollIntervalRef.current) {
        scrollIntervalRef.current = setInterval(() => {
          scrollParent.scrollTop -= speed;
        }, 16);
      }
    } else if (clientY > rect.bottom - threshold) {
      if (!scrollIntervalRef.current) {
        scrollIntervalRef.current = setInterval(() => {
          scrollParent.scrollTop += speed;
        }, 16);
      }
    } else {
      stopAutoScroll();
    }
  };

  return (
    <div className={styles.inventoryTabBody} onDragOver={handleDragOver}>
      <div className={styles.invActionBar}>
        <button type="button" className={styles.invActionBtn} onClick={() => {
          const equip = { ...(targetChar.inventory?.equipment || {}) };
          let name = 'NewSlot'; let counter = 1;
          while (equip[name] !== undefined) { name = `NewSlot_${counter++}`; }
          equip[name] = null;
          handleUpdateNestedField('inventory', 'equipment', equip);
        }}>+ Add Slot</button>
        <button type="button" className={styles.invActionBtn} onClick={() => {
          const storage = { ...(targetChar.inventory?.storage || {}) };
          let name = 'NewContainer'; let counter = 1;
          while (storage[name] !== undefined) { name = `NewContainer_${counter++}`; }
          storage[name] = [];
          handleUpdateNestedField('inventory', 'storage', storage);
        }}>+ Add Container</button>
        <button type="button" className={styles.invActionBtn} onClick={() => {
          const storage = { ...(targetChar.inventory?.storage || {}) };
          const storageKeys = Object.keys(storage);
          let targetKey = storageKeys[0] || 'backpack';
          if (!storage[targetKey]) storage[targetKey] = [];
          storage[targetKey] = [{ id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: '', desc: '', quantity: 1, isNew: true }, ...storage[targetKey]];
          handleUpdateNestedField('inventory', 'storage', storage);
        }}>+ Add Item</button>
      </div>

      <div className={styles.invSection}>
        <h5 className={styles.invSectionTitle}>Equipment Slots</h5>
        <div className={styles.invEquipGrid}>
          {(() => {
            const slotsList = Object.entries(targetChar.inventory?.equipment || {});
            const totalSlots = slotsList.length;
            return slotsList.map(([slotKey, item], slotIdx) => (
              <div
                key={slotKey}
                className={styles.invSlotCard}
                onDragEnter={handleDragOver}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, 'equipment', slotKey)}
              >
                <div className={styles.slotHeader}>
                  <div className={styles.slotInputOuter}>
                    <input
                      type="text"
                      className={styles.slotRenameInputRefactored}
                      defaultValue={slotKey}
                      onBlur={e => {
                        const newKey = e.target.value.trim();
                        if (!newKey) { e.target.value = slotKey; return; }
                        if (newKey !== slotKey && (targetChar.inventory?.equipment || {})[newKey] !== undefined) {
                          alert(`Slot "${newKey}" exists.`); e.target.value = slotKey; return;
                        }
                        if (newKey !== slotKey) {
                          const equip = { ...(targetChar.inventory?.equipment || {}) };
                          equip[newKey] = equip[slotKey]; delete equip[slotKey];
                          handleUpdateNestedField("inventory", "equipment", equip);
                        }
                      }}
                    />
                  </div>
                  <div className={styles.flexCenterGroupSmall}>
                    <button type="button" className={`${styles.sortBtn} ${styles.miniSortBtn}`} disabled={slotIdx === 0} onClick={() => handleReorderEquipmentSlot(slotKey, "up")}>▲</button>
                    <button type="button" className={`${styles.sortBtn} ${styles.miniSortBtn}`} disabled={slotIdx === totalSlots - 1} onClick={() => handleReorderEquipmentSlot(slotKey, "down")}>▼</button>
                    <button type="button" className={styles.removeInlineBtn} onClick={() => {
                      const equip = { ...(targetChar.inventory?.equipment || {}) };
                      // 아이템이 장착되어 있으면 경고
                      if (equip[slotKey] && !window.confirm(`"${slotKey}" slot has an item. Delete anyway?`)) return;
                      delete equip[slotKey]; handleUpdateNestedField("inventory", "equipment", equip);
                    }}>X</button>
                  </div>
                </div>

                {item ? (
                  <div
                    className={styles.equippedItem}
                    draggable={true}
                    onDragStart={e => handleDragStart(e, 'equipment', slotKey, null, item)}
                    onDragEnd={stopAutoScroll}
                  >
                    <div className={styles.flexColumnFull}>
                      <div className={styles.itemTitleLine}>
                        <AutoGrowingTextArea
                          className={styles.itemTitleInputRefactored}
                          value={item.name || ''}
                          placeholder="Equipped item name..."
                          onChange={val => {
                            const equip = { ...(targetChar.inventory?.equipment || {}) };
                            equip[slotKey] = { ...(equip[slotKey] || {}), name: val };
                            handleUpdateNestedField('inventory', 'equipment', equip);
                          }}
                        />
                      </div>
                      <div className={styles.itemDescLine}>
                        <AutoGrowingTextArea
                          className={styles.itemDescInputRefactored}
                          value={item.desc || ''}
                          placeholder="Description..."
                          onChange={val => {
                            const equip = { ...(targetChar.inventory?.equipment || {}) };
                            equip[slotKey] = { ...(equip[slotKey] || {}), desc: val };
                            handleUpdateNestedField('inventory', 'equipment', equip);
                          }}
                        />
                      </div>
                    </div>
                    <button type="button" className={styles.unequipBtn} onClick={() => {
                      const equip = { ...(targetChar.inventory?.equipment || {}) }; equip[slotKey] = null;
                      const storage = { ...(targetChar.inventory?.storage || {}) };
                      const firstStore = Object.keys(storage)[0] || 'backpack';
                      if (!storage[firstStore]) storage[firstStore] = []; storage[firstStore].push(item);
                      handleUpdateNestedField('inventory', null, { equipment: equip, storage });
                    }}>Unequip</button>
                  </div>
                ) : <span className={styles.emptyText}>Empty</span>}
              </div>
            ));
          })()}
        </div>
      </div>

      <div className={styles.invSection}>
        <h5 className={styles.invSectionTitle}>Containers & Items</h5>
        <div className={styles.invStorageGrid}>
          {(() => {
            const storagesList = Object.entries(targetChar.inventory?.storage || {});
            const totalStorages = storagesList.length;
            return storagesList.map(([storageKey, items], sIdx) => {
              const itemList = Array.isArray(items) ? items : [];
              return (
                <div
                  key={storageKey}
                  className={styles.invStorageBox}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, 'storage', storageKey)}
                >
                  <div className={styles.slotHeader}>
                    <div className={styles.slotInputOuter}>
                      <button
                        type="button"
                        className={`${styles.accordionToggleBtn} ${expandedIds[`storage_${storageKey}`] !== false ? styles.activeToggle : ''}`}
                        onClick={() => setExpandedIds(prev => ({ ...prev, [`storage_${storageKey}`]: prev[`storage_${storageKey}`] === false ? true : false }))}
                      >▶</button>
                      <input
                        type="text"
                        className={styles.slotRenameInputRefactored}
                        defaultValue={storageKey}
                        onBlur={e => {
                          const newKey = e.target.value.trim();
                          if (!newKey) { e.target.value = storageKey; return; }
                          if (newKey !== storageKey && (targetChar.inventory?.storage || {})[newKey] !== undefined) {
                            alert(`Container "${newKey}" exists.`); e.target.value = storageKey; return;
                          }
                          if (newKey !== storageKey) {
                            const storage = { ...(targetChar.inventory?.storage || {}) };
                            storage[newKey] = storage[storageKey]; delete storage[storageKey];
                            handleUpdateNestedField('inventory', 'storage', storage);
                          }
                        }}
                      />
                    </div>
                    <div className={styles.flexCenterGroupSmall}>
                      <button type="button" className={`${styles.sortBtn} ${styles.miniSortBtn}`} disabled={sIdx === 0} onClick={() => handleReorderStorage(storageKey, 'up')}>▲</button>
                      <button type="button" className={`${styles.sortBtn} ${styles.miniSortBtn}`} disabled={sIdx === totalStorages - 1} onClick={() => handleReorderStorage(storageKey, 'down')}>▼</button>
                      <button type="button" className={styles.removeInlineBtn} onClick={() => {
                        const storage = { ...(targetChar.inventory?.storage || {}) };
                        // 아이템이 들어있으면 경고
                        if (storage[storageKey]?.length > 0 && !window.confirm(`"${storageKey}" contains items. Delete anyway?`)) return;
                        delete storage[storageKey]; handleUpdateNestedField('inventory', 'storage', storage);
                      }}>X</button>
                    </div>
                  </div>

                  {expandedIds[`storage_${storageKey}`] !== false && (
                    <div className={styles.invStorageItemsList}>
                      {itemList.length === 0 ? <span className={styles.emptyText}>Empty container</span> : (
                        itemList.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className={styles.invItemRow}
                            draggable={true}
                            onDragStart={e => handleDragStart(e, 'storage', storageKey, idx, item)}
                            onDragEnd={stopAutoScroll}
                            onDragEnter={handleDragOver}
                            onDragOver={handleDragOver}
                            onDrop={e => { e.stopPropagation(); handleDrop(e, 'storage', storageKey, idx); }}
                          >
                            <div className={styles.flexColumnFull}>
                              <div className={styles.itemTitleLine}>
                                <AutoGrowingTextArea
                                  className={styles.itemTitleInputRefactored}
                                  value={item.name}
                                  placeholder="Item name..."
                                  onChange={val => {
                                    const storage = { ...(targetChar.inventory?.storage || {}) };
                                    storage[storageKey][idx].name = val;
                                    handleUpdateNestedField('inventory', 'storage', storage);
                                  }}
                                />
                                <div className={styles.itemQtyBox}>
                                  <input
                                    type="number"
                                    className={styles.itemQtyInputRefactored}
                                    value={item.quantity || 1}
                                    onChange={e => {
                                      const storage = { ...(targetChar.inventory?.storage || {}) };
                                      storage[storageKey][idx].quantity = Number(e.target.value);
                                      handleUpdateNestedField('inventory', 'storage', storage);
                                    }}
                                  />
                                </div>
                              </div>
                              <div className={styles.itemDescLine}>
                                <AutoGrowingTextArea
                                  className={styles.itemDescInputRefactored}
                                  value={item.desc}
                                  placeholder="Description..."
                                  onChange={val => {
                                    const storage = { ...(targetChar.inventory?.storage || {}) };
                                    storage[storageKey][idx].desc = val;
                                    handleUpdateNestedField('inventory', 'storage', storage);
                                  }}
                                />
                                <button type="button" className={styles.itemDeleteBtn} onClick={() => {
                                  const storage = { ...(targetChar.inventory?.storage || {}) };
                                  storage[storageKey].splice(idx, 1);
                                  handleUpdateNestedField('inventory', 'storage', storage);
                                }}>×</button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}