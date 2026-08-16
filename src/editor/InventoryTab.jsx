import React, { useRef, useState } from 'react';
import styles from './StatusEditor.module.css';
import { AutoGrowingTextArea, SortButtons, AccordionArrow } from '../utils';

function DragHandle({ type, size = 16, ...props }) {
  if (type === 'container') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    );
  }
  if (type === 'currency') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="8" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    );
  }
  if (type === 'asset') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export default function InventoryTab({
  charId,
  targetChar,
  localCharacters,
  setLocalCharacters,
  expandedIds,
  setExpandedIds,
  handleUpdateNestedField
}) {
  const scrollIntervalRef = useRef(null);
  const [equipExpanded, setEquipExpanded] = useState(true);
  const [containersExpanded, setContainersExpanded] = useState(true);

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

  const handleDragEnd = () => {
    stopAutoScroll();
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

    if (dragItem.loc === 'container' && destLoc === 'storage' && dragItem.item.storageKey === destKey) {
      return;
    }

    if (dragItem.loc === 'container' && destLoc === 'equipment') {
      const storageKey = dragItem.item.storageKey;
      const containerItem = {
        id: `container_${storageKey}_${Date.now()}`,
        name: storageKey,
        isContainer: true,
        storageKey: storageKey,
        type: 'general',
        desc: 'Equipped storage container.'
      };

      const targetItem = nextEquip[destKey];
      if (!targetItem) {
        nextEquip[destKey] = containerItem;
      } else {
        const equipEntries = Object.entries(nextEquip);
        const targetIndex = equipEntries.findIndex(([k]) => k === destKey);

        const existingKeys = new Set(Object.keys(nextEquip));
        let newSlotKey = 'Slot';
        let counter = 1;
        while (existingKeys.has(newSlotKey)) {
          newSlotKey = `Slot_${counter++}`;
        }

        const insertIndex = (destIdx === 'before') ? Math.max(0, targetIndex) : targetIndex + 1;
        equipEntries.splice(insertIndex, 0, [newSlotKey, containerItem]);

        const reorderedEquip = {};
        equipEntries.forEach(([k, v]) => { reorderedEquip[k] = v; });
        Object.keys(nextEquip).forEach(k => delete nextEquip[k]);
        Object.assign(nextEquip, reorderedEquip);
      }

      setLocalCharacters(localCharacters.map(c => {
        if (c.id !== charId) return c;
        return {
          ...c,
          inventory: { ...(c.inventory || {}), equipment: nextEquip }
        };
      }));
      return;
    }

    let itemToMove = { ...dragItem.item };

    if (itemToMove.isContainer && destLoc === 'storage') {
      return;
    }

    const sourceQty = Number(dragItem.item.quantity) || 1;
    const isStackable = dragItem.item.type === 'general' || dragItem.item.type === 'currency';

    let isPartialMove = false;
    let qtyToMove = sourceQty;

    if (isStackable && sourceQty > 1) {
      const inputVal = prompt(`Enter quantity to move (Max: ${sourceQty}):`, sourceQty);
      if (inputVal === null) return;

      const parsedQty = parseInt(inputVal, 10);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        alert("Invalid quantity.");
        return;
      }
      if (parsedQty < sourceQty) {
        isPartialMove = true;
        qtyToMove = Math.min(parsedQty, sourceQty);
      }
    }

    if (dragItem.loc === 'equipment') {
      if (isPartialMove) {
        nextEquip[dragItem.key] = {
          ...nextEquip[dragItem.key],
          quantity: sourceQty - qtyToMove
        };
      } else {
        nextEquip[dragItem.key] = null;
      }
    } else {
      const srcList = [...(nextStorage[dragItem.key] || [])];
      if (isPartialMove) {
        srcList[dragItem.index] = {
          ...srcList[dragItem.index],
          quantity: sourceQty - qtyToMove
        };
      } else {
        srcList.splice(dragItem.index, 1);
      }
      nextStorage[dragItem.key] = srcList;
    }

    itemToMove.quantity = qtyToMove;

    if (destLoc === 'equipment') {
      const targetItem = nextEquip[destKey];

      if (targetItem && targetItem.name?.trim().toLowerCase() === itemToMove.name?.trim().toLowerCase() && isStackable) {
        const targetQty = Number(targetItem.quantity) || 1;
        nextEquip[destKey] = {
          ...targetItem,
          quantity: targetQty + qtyToMove
        };
      } else if (!targetItem) {
        nextEquip[destKey] = itemToMove;
      } else {
        const equipEntries = Object.entries(nextEquip);
        const targetIndex = equipEntries.findIndex(([k]) => k === destKey);

        const existingKeys = new Set(Object.keys(nextEquip));
        let newSlotKey = 'Slot';
        let counter = 1;
        while (existingKeys.has(newSlotKey)) {
          newSlotKey = `Slot_${counter++}`;
        }

        const insertIndex = (destIdx === 'before') ? Math.max(0, targetIndex) : targetIndex + 1;
        equipEntries.splice(insertIndex, 0, [newSlotKey, itemToMove]);

        const reorderedEquip = {};
        equipEntries.forEach(([k, v]) => {
          reorderedEquip[k] = v;
        });

        Object.keys(nextEquip).forEach(k => delete nextEquip[k]);
        Object.assign(nextEquip, reorderedEquip);
      }
    } else {
      if (!nextStorage[destKey]) nextStorage[destKey] = [];
      let destList = [...(nextStorage[destKey] || [])];

      const existingItemIdx = destList.findIndex(i =>
        i.name?.trim().toLowerCase() === itemToMove.name?.trim().toLowerCase()
      );

      if (existingItemIdx !== -1 && isStackable) {
        destList[existingItemIdx] = {
          ...destList[existingItemIdx],
          quantity: (Number(destList[existingItemIdx].quantity) || 0) + qtyToMove
        };
      } else {
        if (destIdx !== null && destIdx !== undefined) {
          destList.splice(destIdx, 0, itemToMove);
        } else {
          destList.push(itemToMove);
        }
      }
      nextStorage[destKey] = destList;
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
    const scrollParent = e.currentTarget.closest('[class*="editorBody"], [class*="panelBody"], [class*="rpg-modal-body"]');
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
      {/* 1. Equipment Slots Header */}
      <div className={styles.flatHeaderRow}>
        <div className={styles.headerLeftZone} onClick={() => setEquipExpanded(!equipExpanded)} style={{ cursor: 'pointer' }}>
          <AccordionArrow isExpanded={equipExpanded} />
          <span className={styles.flatHeaderTitle}>Equipment Slots</span>
        </div>
        <button
          type="button"
          className="rpg-btn-sm"
          onClick={() => {
            const equip = { ...(targetChar.inventory?.equipment || {}) };
            let name = 'Slot';
            let counter = 1;
            while (equip[name] !== undefined) {
              name = `Slot_${counter++}`;
            }
            equip[name] = null;
            handleUpdateNestedField('inventory', 'equipment', equip);
          }}
        >
          + Add Slot
        </button>
      </div>

      {/* Equipment Slots Grid */}
      {equipExpanded && (
        <div className={styles.invEquipGrid}>
          {(() => {
            const slotsList = Object.entries(targetChar.inventory?.equipment || {});
            const totalSlots = slotsList.length;
            return slotsList.map(([slotKey, item], slotIdx) => {
              const itemType = item?.isContainer ? 'container' : (item?.type || 'general');
              return (
                <div
                  key={slotKey}
                  className={styles.invSlotCard}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDrop={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isUpperHalf = (e.clientY - rect.top) < (rect.height / 2);
                    handleDrop(e, 'equipment', slotKey, isUpperHalf ? 'before' : 'after');
                  }}
                >
                  {/* Slot Header */}
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
                            alert(`Slot "${newKey}" already exists.`);
                            e.target.value = slotKey;
                            return;
                          }
                          if (newKey !== slotKey) {
                            const equip = { ...(targetChar.inventory?.equipment || {}) };
                            equip[newKey] = equip[slotKey];
                            delete equip[slotKey];
                            handleUpdateNestedField("inventory", "equipment", equip);
                          }
                        }}
                      />
                    </div>
                    <div className={styles.flexCenterGroupSmall} style={{ gap: '4px' }}>
                      <SortButtons
                        onMoveUp={() => handleReorderEquipmentSlot(slotKey, "up")}
                        onMoveDown={() => handleReorderEquipmentSlot(slotKey, "down")}
                        isFirst={slotIdx === 0}
                        isLast={slotIdx === totalSlots - 1}
                      />
                      <button
                        type="button"
                        className="rpg-btn-del"
                        style={{ padding: '2px 5px', fontSize: '9px' }}
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the equipment slot "${slotKey}"?`)) {
                            const equip = { ...(targetChar.inventory?.equipment || {}) };
                            delete equip[slotKey];
                            handleUpdateNestedField('inventory', 'equipment', equip);
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Slot Item Row */}
                  {item ? (
                    <div className={styles.invItemRow} style={{ border: 'none', background: 'rgba(255,255,255,0.03)', padding: '8px' }}>
                      <div className={styles.flexColumnFull} style={{ gap: '6px' }}>
                        
                        {/* Line 1: [Icon + Item Name] ------------------ [Item Type + Delete Button] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <div
                              draggable={true}
                              onDragStart={e => handleDragStart(e, 'equipment', slotKey, null, item)}
                              onDragEnd={handleDragEnd}
                              className={styles.dragHandleIconWrapper}
                              title="Drag to move."
                            >
                              <DragHandle type={item.isContainer ? 'container' : itemType} />
                            </div>
                            <AutoGrowingTextArea
                              className={styles.itemTitleInputRefactored}
                              value={item.name || ''}
                              placeholder="Item name..."
                              onChange={val => {
                                const equip = { ...(targetChar.inventory?.equipment || {}) };
                                equip[slotKey] = { ...(equip[slotKey] || {}), name: val };
                                handleUpdateNestedField('inventory', 'equipment', equip);
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <div className={styles.itemTypeSelectWrapper}>
                              <select
                                className="rpg-select-custom"
                                value={itemType}
                                disabled={item.isContainer}
                                onChange={e => {
                                  const equip = { ...(targetChar.inventory?.equipment || {}) };
                                  const targetVal = e.target.value;
                                  equip[slotKey].type = targetVal;
                                  if (targetVal === 'currency') {
                                    delete equip[slotKey].desc;
                                    delete equip[slotKey].assetValue;
                                    equip[slotKey].quantity = equip[slotKey].quantity || 1;
                                  } else if (targetVal === 'asset') {
                                    delete equip[slotKey].quantity;
                                    equip[slotKey].assetValue = equip[slotKey].assetValue || { amount: 0, currencyName: 'Gold' };
                                    equip[slotKey].desc = equip[slotKey].desc || '';
                                  } else {
                                    equip[slotKey].quantity = equip[slotKey].quantity || 1;
                                    equip[slotKey].desc = equip[slotKey].desc || '';
                                    delete equip[slotKey].assetValue;
                                  }
                                  handleUpdateNestedField('inventory', 'equipment', equip);
                                }}
                              >
                                {item.isContainer ? (
                                  <option value="container">Container</option>
                                ) : (
                                  <>
                                    <option value="general">General</option>
                                    <option value="currency">Currency</option>
                                    <option value="asset">Asset</option>
                                  </>
                                )}
                              </select>
                            </div>
                            <button
                              type="button"
                              className="rpg-btn-del"
                              style={{ padding: '2px 6px', fontSize: '11px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this equipped item?")) {
                                  const equip = { ...(targetChar.inventory?.equipment || {}) };
                                  equip[slotKey] = null;
                                  handleUpdateNestedField('inventory', 'equipment', equip);
                                }
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Line 2: [Item ID] ------------------ [Quantity / Amount] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                          <input
                            type="text"
                            className={styles.slotRenameInputRefactored}
                            style={{ flex: 1, minWidth: 0, fontSize: '10.5px', padding: '3px 6px', height: '22px', boxSizing: 'border-box' }}
                            value={item.id || ''}
                            placeholder="Item ID..."
                            title="Unique Item ID"
                            onChange={e => {
                              const equip = { ...(targetChar.inventory?.equipment || {}) };
                              equip[slotKey] = { ...(equip[slotKey] || {}), id: e.target.value.trim() };
                              handleUpdateNestedField('inventory', 'equipment', equip);
                            }}
                          />

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {itemType === 'general' && !item.isContainer && (
                              <div className={styles.itemQtyBox}>
                                <input
                                  type="number"
                                  className={styles.itemQtyInputRefactored}
                                  value={item.quantity || 1}
                                  onChange={e => {
                                    const equip = { ...(targetChar.inventory?.equipment || {}) };
                                    equip[slotKey].quantity = Number(e.target.value) || 0;
                                    handleUpdateNestedField('inventory', 'equipment', equip);
                                  }}
                                />
                              </div>
                            )}

                            {itemType === 'currency' && (
                              <div className={styles.itemQtyBox}>
                                <input
                                  type="number"
                                  className={styles.itemQtyInputRefactored}
                                  value={item.quantity !== undefined ? item.quantity : 0}
                                  onChange={e => {
                                    const equip = { ...(targetChar.inventory?.equipment || {}) };
                                    equip[slotKey].quantity = Number(e.target.value) || 0;
                                    handleUpdateNestedField('inventory', 'equipment', equip);
                                  }}
                                />
                              </div>
                            )}

                            {itemType === 'asset' && (
                              <div className={styles.assetValueGroup}>
                                <input
                                  type="number"
                                  className={styles.assetAmountInput}
                                  value={item.assetValue?.amount !== undefined ? item.assetValue.amount : 0}
                                  onChange={e => {
                                    const equip = { ...(targetChar.inventory?.equipment || {}) };
                                    equip[slotKey].assetValue = {
                                      ...(equip[slotKey].assetValue || {}),
                                      amount: Number(e.target.value) || 0
                                    };
                                    handleUpdateNestedField('inventory', 'equipment', equip);
                                  }}
                                />
                                <input
                                  type="text"
                                  className={styles.assetCurrencyInput}
                                  value={item.assetValue?.currencyName || 'Gold'}
                                  onChange={e => {
                                    const equip = { ...(targetChar.inventory?.equipment || {}) };
                                    equip[slotKey].assetValue = {
                                      ...(equip[slotKey].assetValue || {}),
                                      currencyName: e.target.value
                                    };
                                    handleUpdateNestedField('inventory', 'equipment', equip);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Line 3: [Description] */}
                        {itemType !== 'currency' && (
                          <div style={{ width: '100%', marginTop: '1px' }}>
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
                        )}

                      </div>
                    </div>
                  ) : <span className={styles.emptyText}>Empty</span>}
                </div>
              );
            });
          })()}
        </div>
      )}

      <div className={styles.accordionSeparator} />

      {/* 2. Containers & Items Header */}
      <div className={styles.flatHeaderRow}>
        <div className={styles.headerLeftZone} onClick={() => setContainersExpanded(!containersExpanded)} style={{ cursor: 'pointer' }}>
          <AccordionArrow isExpanded={containersExpanded} />
          <span className={styles.flatHeaderTitle}>Containers & Items</span>
        </div>
        <button
          type="button"
          className="rpg-btn-sm"
          onClick={() => {
            const storage = { ...(targetChar.inventory?.storage || {}) };
            let name = 'Container';
            let counter = 1;
            while (storage[name] !== undefined) {
              name = `Container_${counter++}`;
            }
            storage[name] = [];
            handleUpdateNestedField('inventory', 'storage', storage);
          }}
        >
          + Add Container
        </button>
      </div>

      {/* Containers Grid */}
      {containersExpanded && (
        <div className={styles.invStorageGrid}>
          {(() => {
            const storagesList = Object.entries(targetChar.inventory?.storage || {});
            const totalStorages = storagesList.length;
            return storagesList.map(([storageKey, items], sIdx) => {
              const itemList = Array.isArray(items) ? items : [];
              const isContainerOpen = expandedIds[`storage_${storageKey}`] !== false;

              return (
                <div
                  key={storageKey}
                  className={styles.invStorageBox}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, 'storage', storageKey)}
                >
                  {/* Container Header */}
                  <div className={styles.slotHeader} style={{ cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div className={styles.slotInputOuter} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <div
                        draggable={true}
                        onDragStart={e => handleDragStart(e, 'container', null, null, { name: storageKey, isContainer: true, storageKey: storageKey })}
                        onDragEnd={stopAutoScroll}
                        className={styles.dragHandleIconWrapper}
                        title="Drag to equip."
                      >
                        <DragHandle type="container" />
                      </div>

                      <AccordionArrow
                        isExpanded={isContainerOpen}
                        onClick={() => {
                          setExpandedIds(prev => ({
                            ...prev,
                            [`storage_${storageKey}`]: prev[`storage_${storageKey}`] === false ? true : false
                          }));
                        }}
                      />

                      <input
                        type="text"
                        className={styles.slotRenameInputRefactored}
                        defaultValue={storageKey}
                        onBlur={e => {
                          const newKey = e.target.value.trim();
                          if (!newKey) { e.target.value = storageKey; return; }
                          if (newKey !== storageKey && (targetChar.inventory?.storage || {})[newKey] !== undefined) {
                            alert(`Container "${newKey}" already exists.`);
                            e.target.value = storageKey;
                            return;
                          }
                          if (newKey !== storageKey) {
                            const storage = { ...(targetChar.inventory?.storage || {}) };
                            storage[newKey] = storage[storageKey];
                            delete storage[storageKey];

                            const locks = { ...(targetChar.inventory?.storageLocks || {}) };
                            locks[newKey] = locks[storageKey] || false;
                            delete locks[storageKey];

                            const equip = { ...(targetChar.inventory?.equipment || {}) };
                            let hasLinkChanges = false;
                            Object.entries(equip).forEach(([slot, eqItem]) => {
                              if (eqItem && eqItem.isContainer && eqItem.storageKey === storageKey) {
                                equip[slot] = { ...eqItem, name: newKey, storageKey: newKey };
                                hasLinkChanges = true;
                              }
                            });

                            setLocalCharacters(localCharacters.map(c => {
                              if (c.id !== charId) return c;
                              const nextInv = { ...(c.inventory || {}), storage, storageLocks: locks };
                              if (hasLinkChanges) nextInv.equipment = equip;
                              return { ...c, inventory: nextInv };
                            }));
                          }
                        }}
                      />
                    </div>

                    <div className={styles.spacedHeaderButtonGroup} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SortButtons
                        onMoveUp={() => handleReorderStorage(storageKey, 'up')}
                        onMoveDown={() => handleReorderStorage(storageKey, 'down')}
                        isFirst={sIdx === 0}
                        isLast={sIdx === totalStorages - 1}
                      />

                      <button
                        type="button"
                        className="rpg-btn-sm"
                        onClick={() => {
                          const storage = { ...(targetChar.inventory?.storage || {}) };
                          if (!storage[storageKey]) storage[storageKey] = [];
                          storage[storageKey] = [
                            { id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: '', desc: '', quantity: 1, type: 'general' },
                            ...storage[storageKey]
                          ];
                          handleUpdateNestedField('inventory', 'storage', storage);
                        }}
                      >
                        + Item
                      </button>

                      <button
                        type="button"
                        className="rpg-btn-del"
                        onClick={() => {
                          const storage = { ...(targetChar.inventory?.storage || {}) };
                          if (storage[storageKey]?.length > 0 && !window.confirm(`The container "${storageKey}" contains items. Do you want to delete it?`)) return;

                          delete storage[storageKey];
                          const locks = { ...(targetChar.inventory?.storageLocks || {}) };
                          delete locks[storageKey];

                          const equip = { ...(targetChar.inventory?.equipment || {}) };
                          Object.entries(equip).forEach(([slot, eqItem]) => {
                            if (eqItem && eqItem.isContainer && eqItem.storageKey === storageKey) {
                              equip[slot] = null;
                            }
                          });

                          setLocalCharacters(localCharacters.map(c => {
                            if (c.id !== charId) return c;
                            return {
                              ...c,
                              inventory: { ...(c.inventory || {}), storage, storageLocks: locks, equipment: equip }
                            };
                          }));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Container Items List */}
                  {isContainerOpen && (
                    <div className={styles.invStorageItemsList}>
                      {itemList.length === 0 ? <span className={styles.emptyText}>Empty container</span> : (
                        itemList.map((item, idx) => {
                          const itemType = item.type || 'general';
                          return (
                            <div
                              key={item.id || idx}
                              className={styles.invItemRow}
                              onDragEnter={handleDragOver}
                              onDragOver={handleDragOver}
                              onDrop={e => { e.stopPropagation(); handleDrop(e, 'storage', storageKey, idx); }}
                              style={{ padding: '8px' }}
                            >
                              <div className={styles.flexColumnFull} style={{ gap: '6px' }}>
                                
                                {/* Line 1: [Icon + Item Name] ------------------ [Item Type + Delete Button] */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                    <div
                                      draggable={true}
                                      onDragStart={e => handleDragStart(e, 'storage', storageKey, idx, item)}
                                      onDragEnd={stopAutoScroll}
                                      className={styles.dragHandleIconWrapper}
                                      title="Drag to move."
                                    >
                                      <DragHandle type={itemType} />
                                    </div>
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
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    <div className={styles.itemTypeSelectWrapper}>
                                      <select
                                        className="rpg-select-custom"
                                        value={itemType}
                                        onChange={e => {
                                          const storage = { ...(targetChar.inventory?.storage || {}) };
                                          const targetVal = e.target.value;
                                          storage[storageKey][idx].type = targetVal;
                                          if (targetVal === 'currency') {
                                            delete storage[storageKey][idx].desc;
                                            delete storage[storageKey][idx].assetValue;
                                            storage[storageKey][idx].quantity = storage[storageKey][idx].quantity || 1;
                                          } else if (targetVal === 'asset') {
                                            delete storage[storageKey][idx].quantity;
                                            storage[storageKey][idx].assetValue = storage[storageKey][idx].assetValue || { amount: 0, currencyName: 'Gold' };
                                            storage[storageKey][idx].desc = storage[storageKey][idx].desc || '';
                                          } else {
                                            storage[storageKey][idx].quantity = storage[storageKey][idx].quantity || 1;
                                            storage[storageKey][idx].desc = storage[storageKey][idx].desc || '';
                                            delete storage[storageKey][idx].assetValue;
                                          }
                                          handleUpdateNestedField('inventory', 'storage', storage);
                                        }}
                                      >
                                        <option value="general">General</option>
                                        <option value="currency">Currency</option>
                                        <option value="asset">Asset</option>
                                      </select>
                                    </div>
                                    <button
                                      type="button"
                                      className="rpg-btn-del"
                                      style={{ padding: '2px 6px', fontSize: '11px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      onClick={() => {
                                        if (window.confirm("Are you sure you want to delete this item from the container?")) {
                                          const storage = { ...(targetChar.inventory?.storage || {}) };
                                          storage[storageKey].splice(idx, 1);
                                          handleUpdateNestedField('inventory', 'storage', storage);
                                        }
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>

                                {/* Line 2: [Item ID] ------------------ [Quantity / Amount] */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                                  <input
                                    type="text"
                                    className={styles.slotRenameInputRefactored}
                                    style={{ flex: 1, minWidth: 0, fontSize: '10.5px', padding: '3px 6px', height: '22px', boxSizing: 'border-box' }}
                                    value={item.id || ''}
                                    placeholder="Item ID..."
                                    title="Unique Item ID"
                                    onChange={e => {
                                      const storage = { ...(targetChar.inventory?.storage || {}) };
                                      storage[storageKey][idx].id = e.target.value.trim();
                                      handleUpdateNestedField('inventory', 'storage', storage);
                                    }}
                                  />

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    {itemType === 'general' && (
                                      <div className={styles.itemQtyBox}>
                                        <input
                                          type="number"
                                          className={styles.itemQtyInputRefactored}
                                          value={item.quantity || 1}
                                          onChange={e => {
                                            const storage = { ...(targetChar.inventory?.storage || {}) };
                                            storage[storageKey][idx].quantity = Number(e.target.value) || 0;
                                            handleUpdateNestedField('inventory', 'storage', storage);
                                          }}
                                        />
                                      </div>
                                    )}

                                    {itemType === 'currency' && (
                                      <div className={styles.itemQtyBox}>
                                        <input
                                          type="number"
                                          className={styles.itemQtyInputRefactored}
                                          value={item.quantity !== undefined ? item.quantity : 0}
                                          onChange={e => {
                                            const storage = { ...(targetChar.inventory?.storage || {}) };
                                            storage[storageKey][idx].quantity = Number(e.target.value) || 0;
                                            handleUpdateNestedField('inventory', 'storage', storage);
                                          }}
                                        />
                                      </div>
                                    )}

                                    {itemType === 'asset' && (
                                      <div className={styles.assetValueGroup}>
                                        <input
                                          type="number"
                                          className={styles.assetAmountInput}
                                          value={item.assetValue?.amount !== undefined ? item.assetValue.amount : 0}
                                          placeholder="Value"
                                          onChange={e => {
                                            const storage = { ...(targetChar.inventory?.storage || {}) };
                                            storage[storageKey][idx].assetValue = {
                                              ...(storage[storageKey][idx].assetValue || {}),
                                              amount: Number(e.target.value) || 0
                                            };
                                            handleUpdateNestedField('inventory', 'storage', storage);
                                          }}
                                        />
                                        <input
                                          type="text"
                                          className={styles.assetCurrencyInput}
                                          value={item.assetValue?.currencyName || 'Gold'}
                                          placeholder="Unit"
                                          onChange={e => {
                                            const storage = { ...(targetChar.inventory?.storage || {}) };
                                            storage[storageKey][idx].assetValue = {
                                              ...(storage[storageKey][idx].assetValue || {}),
                                              currencyName: e.target.value
                                            };
                                            handleUpdateNestedField('inventory', 'storage', storage);
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Line 3: [Description] */}
                                {itemType !== 'currency' && (
                                  <div style={{ width: '100%', marginTop: '1px' }}>
                                    <AutoGrowingTextArea
                                      className={styles.itemDescInputRefactored}
                                      value={item.desc || ''}
                                      placeholder="Description..."
                                      onChange={val => {
                                        const storage = { ...(targetChar.inventory?.storage || {}) };
                                        storage[storageKey][idx].desc = val;
                                        handleUpdateNestedField('inventory', 'storage', storage);
                                      }}
                                    />
                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}