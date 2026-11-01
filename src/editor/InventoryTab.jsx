import React, { useRef, useState, useEffect } from 'react';
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

function EquipItemEditor({
  item,
  slotKey,
  onCommit,
  onDelete,
  onDragStart,
  onDragEnd
}) {
  const [name, setName] = useState(item?.name || '');
  const [id, setId] = useState(item?.id || '');
  const [quantity, setQuantity] = useState(item?.quantity !== undefined ? item.quantity : 1);
  const [assetAmount, setAssetAmount] = useState(item?.assetValue?.amount !== undefined ? item.assetValue.amount : 0);
  const [assetCurrency, setAssetCurrency] = useState(item?.assetValue?.currencyName || 'Gold');
  const [desc, setDesc] = useState(item?.desc || '');

  useEffect(() => {
    setName(item?.name || '');
    setId(item?.id || '');
    setQuantity(item?.quantity !== undefined ? item.quantity : 1);
    setAssetAmount(item?.assetValue?.amount !== undefined ? item.assetValue.amount : 0);
    setAssetCurrency(item?.assetValue?.currencyName || 'Gold');
    setDesc(item?.desc || '');
  }, [item]);

  const itemType = item?.isContainer ? 'container' : (item?.type || 'general');

  const commit = (overrides = {}) => {
    const nextName = overrides.name !== undefined ? overrides.name : name;
    const nextId = overrides.id !== undefined ? overrides.id : id.trim();
    const nextDesc = overrides.desc !== undefined ? overrides.desc : desc;
    const nextType = overrides.type !== undefined ? overrides.type : itemType;
    const nextQty = overrides.quantity !== undefined ? overrides.quantity : (Number(quantity) || 0);
    const nextAssetAmt = overrides.assetAmount !== undefined ? overrides.assetAmount : (Number(assetAmount) || 0);
    const nextAssetCur = overrides.assetCurrency !== undefined ? overrides.assetCurrency : (assetCurrency || 'Gold');

    const base = {
      ...item,
      name: nextName,
      id: nextId,
      type: nextType
    };

    if (nextType === 'currency') {
      delete base.desc;
      delete base.assetValue;
      base.quantity = nextQty;
    } else if (nextType === 'asset') {
      delete base.quantity;
      base.assetValue = { amount: nextAssetAmt, currencyName: nextAssetCur };
      base.desc = nextDesc;
    } else {
      base.quantity = nextQty || 1;
      base.desc = nextDesc;
      delete base.assetValue;
    }

    onCommit(base);
  };

  return (
    <div className={styles.invItemRow} style={{ border: 'none', background: 'rgba(255,255,255,0.03)', padding: '8px' }}>
      <div className={styles.flexColumnFull} style={{ gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <div
              draggable={true}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              className={styles.dragHandleIconWrapper}
              title="Drag to move."
            >
              <DragHandle type={item.isContainer ? 'container' : itemType} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }} onBlur={() => commit({ name })}>
              <AutoGrowingTextArea
                className={styles.itemTitleInputRefactored}
                value={name}
                placeholder="Item name..."
                onChange={val => setName(val)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div className={styles.itemTypeSelectWrapper}>
              <select
                className="rpg-select-custom"
                value={itemType}
                disabled={item.isContainer}
                onChange={e => commit({ type: e.target.value })}
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
              onClick={onDelete}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          <input
            type="text"
            className={styles.slotRenameInputRefactored}
            style={{ flex: 1, minWidth: 0, fontSize: '10.5px', padding: '3px 6px', height: '22px', boxSizing: 'border-box' }}
            value={id}
            placeholder="Item ID..."
            title="Unique Item ID"
            onChange={e => setId(e.target.value)}
            onBlur={() => commit({ id: id.trim() })}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {itemType === 'general' && !item.isContainer && (
              <div className={styles.itemQtyBox}>
                <input
                  type="number"
                  className={styles.itemQtyInputRefactored}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  onBlur={() => commit({ quantity: Number(quantity) || 0 })}
                />
              </div>
            )}

            {itemType === 'currency' && (
              <div className={styles.itemQtyBox}>
                <input
                  type="number"
                  className={styles.itemQtyInputRefactored}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  onBlur={() => commit({ quantity: Number(quantity) || 0 })}
                />
              </div>
            )}

            {itemType === 'asset' && (
              <div className={styles.assetValueGroup}>
                <input
                  type="number"
                  className={styles.assetAmountInput}
                  value={assetAmount}
                  onChange={e => setAssetAmount(e.target.value)}
                  onBlur={() => commit({ assetAmount: Number(assetAmount) || 0 })}
                />
                <input
                  type="text"
                  className={styles.assetCurrencyInput}
                  value={assetCurrency}
                  onChange={e => setAssetCurrency(e.target.value)}
                  onBlur={() => commit({ assetCurrency })}
                />
              </div>
            )}
          </div>
        </div>

        {itemType !== 'currency' && (
          <div style={{ width: '100%', marginTop: '1px' }} onBlur={() => commit({ desc })}>
            <AutoGrowingTextArea
              className={styles.itemDescInputRefactored}
              value={desc}
              placeholder="Description..."
              onChange={val => setDesc(val)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StorageItemEditor({
  item,
  onCommit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDrop
}) {
  const [name, setName] = useState(item?.name || '');
  const [id, setId] = useState(item?.id || '');
  const [quantity, setQuantity] = useState(item?.quantity !== undefined ? item.quantity : 1);
  const [assetAmount, setAssetAmount] = useState(item?.assetValue?.amount !== undefined ? item.assetValue.amount : 0);
  const [assetCurrency, setAssetCurrency] = useState(item?.assetValue?.currencyName || 'Gold');
  const [desc, setDesc] = useState(item?.desc || '');

  useEffect(() => {
    setName(item?.name || '');
    setId(item?.id || '');
    setQuantity(item?.quantity !== undefined ? item.quantity : 1);
    setAssetAmount(item?.assetValue?.amount !== undefined ? item.assetValue.amount : 0);
    setAssetCurrency(item?.assetValue?.currencyName || 'Gold');
    setDesc(item?.desc || '');
  }, [item]);

  const itemType = item?.type || 'general';

  const commit = (overrides = {}) => {
    const nextName = overrides.name !== undefined ? overrides.name : name;
    const nextId = overrides.id !== undefined ? overrides.id : id.trim();
    const nextDesc = overrides.desc !== undefined ? overrides.desc : desc;
    const nextType = overrides.type !== undefined ? overrides.type : itemType;
    const nextQty = overrides.quantity !== undefined ? overrides.quantity : (Number(quantity) || 0);
    const nextAssetAmt = overrides.assetAmount !== undefined ? overrides.assetAmount : (Number(assetAmount) || 0);
    const nextAssetCur = overrides.assetCurrency !== undefined ? overrides.assetCurrency : (assetCurrency || 'Gold');

    const base = {
      ...item,
      name: nextName,
      id: nextId,
      type: nextType
    };

    if (nextType === 'currency') {
      delete base.desc;
      delete base.assetValue;
      base.quantity = nextQty;
    } else if (nextType === 'asset') {
      delete base.quantity;
      base.assetValue = { amount: nextAssetAmt, currencyName: nextAssetCur };
      base.desc = nextDesc;
    } else {
      base.quantity = nextQty || 1;
      base.desc = nextDesc;
      delete base.assetValue;
    }

    onCommit(base);
  };

  return (
    <div
      className={styles.invItemRow}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ padding: '8px' }}
    >
      <div className={styles.flexColumnFull} style={{ gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <div
              draggable={true}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              className={styles.dragHandleIconWrapper}
              title="Drag to move."
            >
              <DragHandle type={itemType} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }} onBlur={() => commit({ name })}>
              <AutoGrowingTextArea
                className={styles.itemTitleInputRefactored}
                value={name}
                placeholder="Item name..."
                onChange={val => setName(val)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div className={styles.itemTypeSelectWrapper}>
              <select
                className="rpg-select-custom"
                value={itemType}
                onChange={e => commit({ type: e.target.value })}
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
              onClick={onDelete}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          <input
            type="text"
            className={styles.slotRenameInputRefactored}
            style={{ flex: 1, minWidth: 0, fontSize: '10.5px', padding: '3px 6px', height: '22px', boxSizing: 'border-box' }}
            value={id}
            placeholder="Item ID..."
            title="Unique Item ID"
            onChange={e => setId(e.target.value)}
            onBlur={() => commit({ id: id.trim() })}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {itemType === 'general' && (
              <div className={styles.itemQtyBox}>
                <input
                  type="number"
                  className={styles.itemQtyInputRefactored}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  onBlur={() => commit({ quantity: Number(quantity) || 0 })}
                />
              </div>
            )}

            {itemType === 'currency' && (
              <div className={styles.itemQtyBox}>
                <input
                  type="number"
                  className={styles.itemQtyInputRefactored}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  onBlur={() => commit({ quantity: Number(quantity) || 0 })}
                />
              </div>
            )}

            {itemType === 'asset' && (
              <div className={styles.assetValueGroup}>
                <input
                  type="number"
                  className={styles.assetAmountInput}
                  value={assetAmount}
                  placeholder="Value"
                  onChange={e => setAssetAmount(e.target.value)}
                  onBlur={() => commit({ assetAmount: Number(assetAmount) || 0 })}
                />
                <input
                  type="text"
                  className={styles.assetCurrencyInput}
                  value={assetCurrency}
                  placeholder="Unit"
                  onChange={e => setAssetCurrency(e.target.value)}
                  onBlur={() => commit({ assetCurrency })}
                />
              </div>
            )}
          </div>
        </div>

        {itemType !== 'currency' && (
          <div style={{ width: '100%', marginTop: '1px' }} onBlur={() => commit({ desc })}>
            <AutoGrowingTextArea
              className={styles.itemDescInputRefactored}
              value={desc}
              placeholder="Description..."
              onChange={val => setDesc(val)}
            />
          </div>
        )}
      </div>
    </div>
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
      e.dataTransfer.setData('application/x-rpg-item', '1');
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

    if (!e.dataTransfer) return;
    const isRpgItem = e.dataTransfer.types.includes('application/x-rpg-item') ||
                      e.dataTransfer.getData('application/x-rpg-item') === '1' ||
                      e.dataTransfer.getData('text/plain') === 'rpg_tracker_item';
    const payload = e.dataTransfer.getData('application/json');
    if (!payload || !isRpgItem) return;

    let dragItem;
    try {
      dragItem = JSON.parse(payload);
    } catch (err) {
      return;
    }
    if (!dragItem || !dragItem.item) return;

    const nextEquip = { ...(targetChar.inventory?.equipment || {}) };
    const nextStorage = { ...(targetChar.inventory?.storage || {}) };

    if (dragItem.loc === 'container') {
      if (destLoc === 'storage') return;

      if (destLoc === 'equipment') {
        const storageKey = dragItem.item.storageKey || dragItem.item.name;
        const containerItem = {
          id: `container_${storageKey}_${Date.now()}`,
          name: storageKey,
          isContainer: true,
          storageKey: storageKey,
          type: 'general',
          desc: 'Equipped storage container.'
        };

        const targetItem = nextEquip[destKey];
        if (targetItem && targetItem.isContainer && targetItem.storageKey === storageKey) {
          return;
        }

        if (targetItem && !targetItem.isContainer) {
          if (!nextStorage[storageKey]) nextStorage[storageKey] = [];
          nextStorage[storageKey].push(targetItem);
        }

        nextEquip[destKey] = containerItem;

        setLocalCharacters(localCharacters.map(c => {
          if (c.id !== charId) return c;
          return {
            ...c,
            inventory: { ...(c.inventory || {}), equipment: nextEquip, storage: nextStorage }
          };
        }));
        return;
      }
    }

    let itemToMove = { ...dragItem.item };
    if (itemToMove.isContainer && destLoc === 'storage') {
      alert("Container items cannot be placed inside another storage container.");
      return;
    }

    if (destLoc === 'equipment' && dragItem.loc !== 'equipment') {
      const targetItem = nextEquip[destKey];
      if (targetItem && targetItem.isContainer) {
        alert("Cannot swap items with an equipped container. Please unequip or empty the container first.");
        return;
      }
    }

    const sourceQty = Number(dragItem.item.quantity) || 1;
    const isStackable = dragItem.item.type === 'general' || dragItem.item.type === 'currency';

    let isPartialMove = false;
    let qtyToMove = sourceQty;

    const isTargetOccupiedDifferentItem = destLoc === 'equipment' &&
      nextEquip[destKey] &&
      nextEquip[destKey].name?.trim().toLowerCase() !== itemToMove.name?.trim().toLowerCase();

    if (isStackable && sourceQty > 1 && !isTargetOccupiedDifferentItem) {
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

    itemToMove.quantity = qtyToMove;

    if (destLoc === 'equipment') {
      const targetItem = nextEquip[destKey];

      if (!targetItem) {
        if (dragItem.loc === 'equipment') {
          if (isPartialMove) {
            nextEquip[dragItem.key] = { ...nextEquip[dragItem.key], quantity: sourceQty - qtyToMove };
          } else {
            nextEquip[dragItem.key] = null;
          }
        } else {
          const srcList = [...(nextStorage[dragItem.key] || [])];
          if (isPartialMove) {
            srcList[dragItem.index] = { ...srcList[dragItem.index], quantity: sourceQty - qtyToMove };
          } else {
            srcList.splice(dragItem.index, 1);
          }
          nextStorage[dragItem.key] = srcList;
        }
        nextEquip[destKey] = itemToMove;
      } else if (isStackable && targetItem.name?.trim().toLowerCase() === itemToMove.name?.trim().toLowerCase()) {
        const targetQty = Number(targetItem.quantity) || 1;
        if (dragItem.loc === 'equipment') {
          if (isPartialMove) {
            nextEquip[dragItem.key] = { ...nextEquip[dragItem.key], quantity: sourceQty - qtyToMove };
          } else {
            nextEquip[dragItem.key] = null;
          }
        } else {
          const srcList = [...(nextStorage[dragItem.key] || [])];
          if (isPartialMove) {
            srcList[dragItem.index] = { ...srcList[dragItem.index], quantity: sourceQty - qtyToMove };
          } else {
            srcList.splice(dragItem.index, 1);
          }
          nextStorage[dragItem.key] = srcList;
        }
        nextEquip[destKey] = { ...targetItem, quantity: targetQty + qtyToMove };
      } else {
        if (dragItem.loc === 'equipment') {
          nextEquip[destKey] = itemToMove;
          nextEquip[dragItem.key] = targetItem;
        } else {
          const srcList = [...(nextStorage[dragItem.key] || [])];
          srcList[dragItem.index] = targetItem;
          nextStorage[dragItem.key] = srcList;
          nextEquip[destKey] = itemToMove;
        }
      }
    } else {
      if (dragItem.loc === 'equipment') {
        if (isPartialMove) {
          nextEquip[dragItem.key] = { ...nextEquip[dragItem.key], quantity: sourceQty - qtyToMove };
        } else {
          nextEquip[dragItem.key] = null;
        }
      } else {
        const srcList = [...(nextStorage[dragItem.key] || [])];
        if (isPartialMove) {
          srcList[dragItem.index] = { ...srcList[dragItem.index], quantity: sourceQty - qtyToMove };
        } else {
          srcList.splice(dragItem.index, 1);
        }
        nextStorage[dragItem.key] = srcList;
      }

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
    if (!e.dataTransfer || (!e.dataTransfer.types.includes('application/x-rpg-item') && !e.dataTransfer.types.includes('application/json'))) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const clientY = e.clientY;
    const scrollParent = e.currentTarget.closest('[class*="rpg-modal-body"], [class*="editorBody"]');
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
              return (
                <div
                  key={slotKey}
                  className={styles.invSlotCard}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, 'equipment', slotKey)}
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
                            const currentEquip = targetChar.inventory?.equipment || {};
                            const nextEquip = {};
                            Object.keys(currentEquip).forEach(k => {
                              if (k === slotKey) {
                                nextEquip[newKey] = currentEquip[slotKey];
                              } else {
                                nextEquip[k] = currentEquip[k];
                              }
                            });

                            const currentLocks = targetChar.inventory?.equipmentLocks || {};
                            const nextLocks = {};
                            Object.keys(currentLocks).forEach(k => {
                              if (k === slotKey) {
                                nextLocks[newKey] = currentLocks[slotKey];
                              } else {
                                nextLocks[k] = currentLocks[k];
                              }
                            });

                            setLocalCharacters(localCharacters.map(c => {
                              if (c.id !== charId) return c;
                              return {
                                ...c,
                                inventory: {
                                  ...(c.inventory || {}),
                                  equipment: nextEquip,
                                  equipmentLocks: nextLocks
                                }
                              };
                            }));
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

                            const locks = { ...(targetChar.inventory?.equipmentLocks || {}) };
                            delete locks[slotKey];

                            setLocalCharacters(localCharacters.map(c => {
                              if (c.id !== charId) return c;
                              return {
                                ...c,
                                inventory: {
                                  ...(c.inventory || {}),
                                  equipment: equip,
                                  equipmentLocks: locks
                                }
                              };
                            }));
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Slot Item Content */}
                  {item ? (
                    <EquipItemEditor
                      slotKey={slotKey}
                      item={item}
                      onCommit={updatedItem => {
                        const equip = { ...(targetChar.inventory?.equipment || {}) };
                        equip[slotKey] = updatedItem;
                        handleUpdateNestedField('inventory', 'equipment', equip);
                      }}
                      onDelete={() => {
                        if (window.confirm("Are you sure you want to delete this equipped item?")) {
                          const equip = { ...(targetChar.inventory?.equipment || {}) };
                          equip[slotKey] = null;
                          handleUpdateNestedField('inventory', 'equipment', equip);
                        }
                      }}
                      onDragStart={e => handleDragStart(e, 'equipment', slotKey, null, item)}
                      onDragEnd={handleDragEnd}
                    />
                  ) : <span className="rpg-empty-text">Empty</span>}
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
                            const currentStorage = targetChar.inventory?.storage || {};
                            const storage = {};
                            Object.keys(currentStorage).forEach(k => {
                              if (k === storageKey) {
                                storage[newKey] = currentStorage[storageKey];
                              } else {
                                storage[k] = currentStorage[k];
                              }
                            });

                            const currentLocks = targetChar.inventory?.storageLocks || {};
                            const locks = {};
                            Object.keys(currentLocks).forEach(k => {
                              if (k === storageKey) {
                                locks[newKey] = currentLocks[storageKey] || false;
                              } else {
                                locks[k] = currentLocks[k];
                              }
                            });

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
                      {itemList.length === 0 ? <span className="rpg-empty-text">Empty container</span> : (
                        itemList.map((item, idx) => {
                          if (!item._clientKey) {
                            Object.defineProperty(item, '_clientKey', {
                              value: `c_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                              enumerable: false,
                              writable: true
                            });
                          }

                          return (
                            <StorageItemEditor
                              key={item._clientKey}
                              item={item}
                              onCommit={updatedItem => {
                                const storage = { ...(targetChar.inventory?.storage || {}) };
                                storage[storageKey][idx] = updatedItem;
                                handleUpdateNestedField('inventory', 'storage', storage);
                              }}
                              onDelete={() => {
                                if (window.confirm("Are you sure you want to delete this item from the container?")) {
                                  const storage = { ...(targetChar.inventory?.storage || {}) };
                                  storage[storageKey].splice(idx, 1);
                                  handleUpdateNestedField('inventory', 'storage', storage);
                                }
                              }}
                              onDragStart={e => handleDragStart(e, 'storage', storageKey, idx, item)}
                              onDragEnd={stopAutoScroll}
                              onDragEnter={handleDragOver}
                              onDragOver={handleDragOver}
                              onDrop={e => {
                                e.stopPropagation();
                                handleDrop(e, 'storage', storageKey, idx);
                              }}
                            />
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