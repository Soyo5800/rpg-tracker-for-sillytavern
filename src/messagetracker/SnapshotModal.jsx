import React, { useState, useEffect, useMemo } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './SnapshotModal.module.css';
import { buildSnapshotPayload, generateSnapshotTag } from './SnapshotCore';
import ModalLayout from '../ModalLayout';
import { resolveMessageIndex, sanitizeTrackerData, resolveActiveSwipeId, stripPromptSettings } from '../core/JSONTracker';
import { deepClone } from '../core/StateHelpers';
import { findChatMessageElement, cleanAllMessageTrackerTags } from './MessageCardRenderer';

export default function SnapshotModal() {
  const { trackerData, snapshotModalData } = useRPG();

  const isHistorical = !!snapshotModalData?.historicalData;

  const [activeTab, setActiveTab] = useState('select');

  const [selections, setSelections] = useState({
    world: { selected: false, date: true, time: true, weather: true, location: true, events: false },
    chars: {}
  });

  const [workingData, setWorkingData] = useState(null);
  const [customNote, setCustomNote] = useState('');

  const [isEditable, setIsEditable] = useState(false);
  const [jsonText, setJsonText] = useState('{}');
  const [hasManualJsonOverride, setHasManualJsonOverride] = useState(false);

  const targetData = snapshotModalData?.historicalData || trackerData;

  useEffect(() => {
    if (snapshotModalData?.isOpen && targetData && targetData.characters) {
      const initChars = {};
      targetData.characters.forEach(c => {
        initChars[c.id] = { selected: false, status: false, profile: false, relations: false, inventory: false, quests: false };
      });

      let initWorld = { selected: false, date: true, time: true, weather: true, location: true, events: false };
      let initNote = '';

      const clonedWorkingData = deepClone(targetData);
      const ep = snapshotModalData.existingPayload;

      if (ep) {
        if (ep.note) initNote = ep.note;
        if (ep.world) {
          initWorld = {
            selected: true,
            date: ep.world.date !== undefined,
            time: ep.world.time !== undefined,
            weather: ep.world.weather !== undefined,
            location: ep.world.location !== undefined,
            events: ep.world.events !== undefined
          };
          clonedWorkingData.worldState = {
            ...(clonedWorkingData.worldState || {}),
            ...ep.world
          };
        }
        if (ep.chars) {
          Object.entries(ep.chars).forEach(([cName, cData]) => {
            const trimmedTarget = String(cName || '').trim().toLowerCase();
            const charObj = clonedWorkingData.characters.find(c => c.name === cName)
              || clonedWorkingData.characters.find(c => String(c.name || '').trim().toLowerCase() === trimmedTarget);
            if (charObj) {
              initChars[charObj.id] = {
                selected: true,
                status: !!cData.status,
                profile: !!cData.profile,
                relations: !!cData.relations,
                inventory: !!cData.inventory,
                quests: !!cData.quests
              };
              if (cData.status) charObj.status = { ...(charObj.status || {}), ...cData.status };
              if (cData.profile) charObj.profile = { ...(charObj.profile || {}), ...cData.profile };
              if (cData.relations) charObj.relations = { ...(charObj.relations || {}), ...cData.relations };
              if (cData.inventory) charObj.inventory = { ...(charObj.inventory || {}), ...cData.inventory };
              if (cData.quests) charObj.quests = { ...(charObj.quests || {}), ...cData.quests };
            }
          });
        }
      }

      setSelections({ world: initWorld, chars: initChars });
      setWorkingData(clonedWorkingData);
      setCustomNote(initNote);
      setIsEditable(false);
      setHasManualJsonOverride(false);
      setActiveTab('select');
    }
  }, [snapshotModalData?.isOpen, targetData, snapshotModalData?.existingPayload]);

  const syncParsedPayloadToState = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return;
    setCustomNote(typeof parsed.note === 'string' ? parsed.note : '');

    setWorkingData(prev => {
      if (!prev) return prev;
      const nextWorking = deepClone(prev);
      if (parsed.world && typeof parsed.world === 'object') {
        nextWorking.worldState = {
          ...(nextWorking.worldState || {}),
          ...parsed.world
        };
      }
      if (parsed.chars && typeof parsed.chars === 'object' && Array.isArray(nextWorking.characters)) {
        Object.entries(parsed.chars).forEach(([cName, cData]) => {
          if (!cData || typeof cData !== 'object') return;
          const charObj = nextWorking.characters.find(c => c.name === cName);
          if (charObj) {
            if (cData.status) charObj.status = { ...(charObj.status || {}), ...cData.status };
            if (cData.profile) charObj.profile = { ...(charObj.profile || {}), ...cData.profile };
            if (cData.relations) charObj.relations = { ...(charObj.relations || {}), ...cData.relations };
            if (cData.inventory) charObj.inventory = { ...(charObj.inventory || {}), ...cData.inventory };
            if (cData.quests) charObj.quests = { ...(charObj.quests || {}), ...cData.quests };
          }
        });
      }
      return nextWorking;
    });

    setSelections(prev => {
      const nextWorld = parsed.world && typeof parsed.world === 'object'
        ? {
            selected: true,
            date: parsed.world.date !== undefined,
            time: parsed.world.time !== undefined,
            weather: parsed.world.weather !== undefined,
            location: parsed.world.location !== undefined,
            events: parsed.world.events !== undefined
          }
        : { ...(prev.world || {}), selected: false };

      const nextChars = { ...(prev.chars || {}) };
      if (workingData?.characters) {
        workingData.characters.forEach(c => {
          const cData = parsed.chars?.[c.name];
          if (cData && typeof cData === 'object') {
            nextChars[c.id] = {
              selected: true,
              status: !!cData.status,
              profile: !!cData.profile,
              relations: !!cData.relations,
              inventory: !!cData.inventory,
              quests: !!cData.quests
            };
          } else if (nextChars[c.id]) {
            nextChars[c.id] = { ...nextChars[c.id], selected: false };
          }
        });
      }
      return { world: nextWorld, chars: nextChars };
    });
  };

  const updateWorkingCharValue = (charId, section, fieldKey, newVal) => {
    setHasManualJsonOverride(false);
    setWorkingData(prev => {
      if (!prev || !prev.characters) return prev;
      const nextChars = prev.characters.map(c => {
        if (c.id === charId) {
          const secObj = { ...(c[section] || {}) };
          secObj[fieldKey] = newVal;
          return { ...c, [section]: secObj };
        }
        return c;
      });
      return { ...prev, characters: nextChars };
    });
  };

  const handleCopyCurrentSidebarState = () => {
    if (window.confirm("Overwrite the editor with the current live sidebar status? This will sync values and reset options.")) {
      const liveClone = deepClone(trackerData);
      setHasManualJsonOverride(false);
      setWorkingData(liveClone);

      const nextChars = {};
      liveClone.characters.forEach(c => {
        nextChars[c.id] = {
          selected: true,
          status: true,
          profile: true,
          relations: true,
          inventory: c.activePlayer,
          quests: c.activePlayer
        };
      });

      setSelections({
        world: { selected: true, date: true, time: true, weather: true, location: true, events: true },
        chars: nextChars
      });

      setActiveTab('editor');
    }
  };

  const autoGeneratedPayload = useMemo(() => {
    if (!workingData) return {};
    return buildSnapshotPayload(workingData, selections, customNote);
  }, [workingData, selections, customNote]);

  useEffect(() => {
    if (!isEditable && !hasManualJsonOverride) {
      setJsonText(JSON.stringify(autoGeneratedPayload, null, 2) || '{}');
    }
  }, [autoGeneratedPayload, isEditable, hasManualJsonOverride]);

  if (!snapshotModalData?.isOpen) return null;

  const handleClose = () => {
    if (window.RPGBridge && typeof window.RPGBridge.closeSnapshotModal === 'function') {
      window.RPGBridge.closeSnapshotModal();
    }
  };

  const handleDeselectAll = () => {
    setHasManualJsonOverride(false);
    const resetChars = {};
    if (targetData && targetData.characters) {
      targetData.characters.forEach(c => {
        resetChars[c.id] = { selected: false, status: false, profile: false, relations: false, inventory: false, quests: false };
      });
    }

    setSelections({
      world: { selected: false, date: false, time: false, weather: false, location: false, events: false },
      chars: resetChars
    });
    setCustomNote('');
  };

  const handleWorldToggle = (field, checked) => {
    setHasManualJsonOverride(false);
    setSelections(prev => {
      const worldSel = prev.world || { selected: false, date: true, time: true, weather: true, location: true, events: false };
      return {
        ...prev,
        world: { ...worldSel, [field]: checked }
      };
    });
  };

  const handleCharToggle = (charId, field, checked) => {
    setHasManualJsonOverride(false);
    setSelections(prev => {
      const charSel = prev.chars[charId] || { selected: false, status: false, profile: false, relations: false, inventory: false, quests: false };

      if (field === 'selected' && checked) {
        const targetCharCard = targetData?.characters?.find(c => c.id === charId);
        const isPlayer = targetCharCard ? targetCharCard.activePlayer : false;
        return {
          ...prev,
          chars: {
            ...prev.chars,
            [charId]: { ...charSel, selected: true, status: true, profile: true, relations: true, inventory: isPlayer, quests: isPlayer }
          }
        };
      }

      return {
        ...prev,
        chars: {
          ...prev.chars,
          [charId]: { ...charSel, [field]: checked }
        }
      };
    });
  };

  const handleAttach = async () => {
    const context = window.SillyTavern?.getContext?.();
    if (!context || !Array.isArray(context.chat)) return;

    let finalPayload;
    try {
      finalPayload = JSON.parse(jsonText);
    } catch (e) {
      alert("Invalid JSON format. Please correct the syntax before saving.");
      return;
    }

    const { mesId, sendDate, turnId } = snapshotModalData;
    const targetIndex = resolveMessageIndex(context.chat, mesId, sendDate, turnId);

    if (targetIndex === -1 || !context.chat[targetIndex]) {
      alert("Target message no longer exists or the chat history has changed.");
      handleClose();
      return;
    }

    const targetMsg = context.chat[targetIndex];
    const swipeId = resolveActiveSwipeId(targetMsg);

    const isPayloadEmpty = !finalPayload || Object.keys(finalPayload).length === 0;

    if (isPayloadEmpty) {
      targetMsg.mes = cleanAllMessageTrackerTags(targetMsg.mes, { stripDelta: true });

      if (Array.isArray(targetMsg.swipes)) {
        targetMsg.swipes = targetMsg.swipes.map(s => cleanAllMessageTrackerTags(s, { stripDelta: true }));
      }

      if (Array.isArray(targetMsg.swipe_info)) {
        targetMsg.swipe_info.forEach(swipeObj => {
          if (swipeObj?.extra) {
            delete swipeObj.extra.rpgTrackerData;
            delete swipeObj.extra.rpgSnapshotPinned;
            delete swipeObj.extra.rpgSnapshotTimestamp;
            delete swipeObj.extra.rpgTrackerDelta;
          }
        });
      }
      if (targetMsg.extra) {
        delete targetMsg.extra.rpgTrackerData;
        delete targetMsg.extra.rpgSnapshotPinned;
        delete targetMsg.extra.rpgSnapshotTimestamp;
        delete targetMsg.extra.rpgTrackerDelta;
      }
    } else {
      const cleanedBaseText = cleanAllMessageTrackerTags(targetMsg.mes, { stripDelta: false });
      const newTag = generateSnapshotTag(finalPayload);
      targetMsg.mes = `${cleanedBaseText}${newTag}`;

      if (Array.isArray(targetMsg.swipes)) {
        targetMsg.swipes = targetMsg.swipes.map((swipe, idx) => {
          const cleanedSwipe = cleanAllMessageTrackerTags(swipe || '', { stripDelta: false });
          return idx === swipeId ? `${cleanedSwipe}${newTag}` : cleanedSwipe;
        });
      }

      if (!Array.isArray(targetMsg.swipe_info)) {
        targetMsg.swipe_info = [];
      }
      if (!targetMsg.swipe_info[swipeId]) {
        targetMsg.swipe_info[swipeId] = { extra: {} };
      }
      if (!targetMsg.swipe_info[swipeId].extra) {
        targetMsg.swipe_info[swipeId].extra = {};
      }

      const activeStateToStore = workingData
        ? stripPromptSettings(sanitizeTrackerData(deepClone(workingData)))
        : {};

      targetMsg.swipe_info[swipeId].extra.rpgTrackerData = activeStateToStore;
      targetMsg.swipe_info[swipeId].extra.rpgSnapshotPinned = true;
      targetMsg.swipe_info[swipeId].extra.rpgSnapshotTimestamp = Date.now();

      if (swipeId === 0 || !Array.isArray(targetMsg.swipes) || targetMsg.swipes.length <= 1) {
        targetMsg.extra = targetMsg.extra || {};
        targetMsg.extra.rpgTrackerData = activeStateToStore;
        targetMsg.extra.rpgSnapshotPinned = true;
        targetMsg.extra.rpgSnapshotTimestamp = Date.now();
      }
    }

    const $msgEl = findChatMessageElement(targetIndex);
    if ($msgEl && $msgEl.length > 0) {
      $msgEl.find('.rpg-snapshot-card').remove();
    }

    if (window.RPGBridge) {
      if (typeof window.RPGBridge.cancelPendingSave === 'function') {
        window.RPGBridge.cancelPendingSave();
      }

      if (typeof window.RPGBridge.updateMessageBlock === 'function') {
        window.RPGBridge.updateMessageBlock(targetIndex, targetMsg);
      }
      if (typeof window.RPGBridge.saveChat === 'function') {
        await window.RPGBridge.saveChat();
      }

      const isLatestMessage = targetIndex === context.chat.length - 1;
      if (isLatestMessage && !isPayloadEmpty && workingData) {
        const sanitizedLiveState = sanitizeTrackerData(deepClone(workingData));
        window.RPGBridge.currentTrackerData = sanitizedLiveState;
        if (typeof window.RPGBridge.recordChatLocks === 'function') {
          window.RPGBridge.recordChatLocks(sanitizedLiveState);
        }
        if (typeof window.RPGBridge.syncChatData === 'function') {
          window.RPGBridge.syncChatData(sanitizedLiveState);
        }
      }

      if (typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
        await window.RPGBridge.syncFromHistoryOrMeta();
      } else if (isLatestMessage && typeof window.RPGBridge.syncChatData === 'function' && !isPayloadEmpty && workingData) {
        const sanitizedLiveState = sanitizeTrackerData(deepClone(workingData));
        window.RPGBridge.currentTrackerData = sanitizedLiveState;
        window.RPGBridge.syncChatData(sanitizedLiveState);
      }

      if (typeof window.RPGBridge.triggerObserverNow === 'function') {
        window.RPGBridge.triggerObserverNow();
      } else if (typeof window.RPGBridge.triggerSnapshotRender === 'function') {
        window.RPGBridge.triggerSnapshotRender();
      }
      if (typeof window.RPGBridge.notifyHistoryChange === 'function') {
        window.RPGBridge.notifyHistoryChange();
      }
    }

    handleClose();
  };

  const handleClearSingleMessage = async () => {
    const context = window.SillyTavern?.getContext?.();
    if (!context || !Array.isArray(context.chat)) return;

    const { mesId, sendDate, turnId } = snapshotModalData;
    const targetIndex = resolveMessageIndex(context.chat, mesId, sendDate, turnId);

    if (targetIndex === -1 || !context.chat[targetIndex]) {
      alert("Target message no longer exists or the chat history has changed.");
      handleClose();
      return;
    }

    if (!window.confirm("Remove all tracker data, snapshot cards, and delta logs attached to this message?")) {
      return;
    }

    const targetMsg = context.chat[targetIndex];
    const swipeId = resolveActiveSwipeId(targetMsg);

    if (window.RPGBridge && typeof window.RPGBridge.cancelPendingSave === 'function') {
      window.RPGBridge.cancelPendingSave();
    }

    if (window.RPGBridge && typeof window.RPGBridge.deleteTurnSnapshot === 'function') {
      await window.RPGBridge.deleteTurnSnapshot(targetIndex, swipeId, sendDate, turnId);
    } else {
      targetMsg.mes = cleanAllMessageTrackerTags(targetMsg.mes, { stripDelta: true });
      if (Array.isArray(targetMsg.swipes)) {
        targetMsg.swipes = targetMsg.swipes.map(s => cleanAllMessageTrackerTags(s, { stripDelta: true }));
      }
      if (Array.isArray(targetMsg.swipe_info)) {
        targetMsg.swipe_info.forEach(swipeObj => {
          if (swipeObj?.extra) {
            delete swipeObj.extra.rpgTrackerData;
            delete swipeObj.extra.rpgSnapshotPinned;
            delete swipeObj.extra.rpgSnapshotTimestamp;
            delete swipeObj.extra.rpgTrackerDelta;
          }
        });
      }
      if (targetMsg.extra) {
        delete targetMsg.extra.rpgTrackerData;
        delete targetMsg.extra.rpgSnapshotPinned;
        delete targetMsg.extra.rpgSnapshotTimestamp;
        delete targetMsg.extra.rpgTrackerDelta;
      }
      const $msgEl = findChatMessageElement(targetIndex);
      if ($msgEl && $msgEl.length > 0) {
        $msgEl.find('.rpg-snapshot-card, .rpg-delta-card').remove();
      }
    }

    handleClose();
  };

  return (
    <ModalLayout
      isOpen={Boolean(snapshotModalData?.isOpen)}
      title="Message Tracker"
      onClose={handleClose}
      subHeader={
        <nav className="rpg-tab-nav">
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTab('select')}
          >
            Select Targets
          </button>
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Edit Parameters
          </button>
          <button
            type="button"
            className={`rpg-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview JSON
          </button>
        </nav>
      }
      footerLeft={
        <button type="button" className="rpg-modal-btn reset" onClick={handleClearSingleMessage}>
          Clear
        </button>
      }
      footerRight={
        <>
          <button type="button" className="rpg-modal-btn" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" className="rpg-modal-btn save" onClick={handleAttach}>
            Attach Tracker
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'bold' }}>
          {isHistorical
            ? "Loaded historical state from this turn."
            : "No historical data found. Using current live data."}
        </div>
        <button
          type="button"
          className="rpg-btn-sm"
          onClick={handleCopyCurrentSidebarState}
          title="Pull values and check options from the active live sidebar tracker panel"
        >
          Copy Live Status
        </button>
      </div>

      {activeTab === 'select' && (
        <div className={styles.tabContentFadeIn} onChangeCapture={() => setHasManualJsonOverride(false)}>
          <div className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitle}>Entities & Options</div>
              <button
                type="button"
                className="rpg-btn-sm"
                onClick={handleDeselectAll}
                title="Deselect all elements & notes"
              >
                Deselect All
              </button>
            </div>

            <div className={`${styles.charRow} ${styles.worldRow}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <label className={styles.checkboxItem} style={{ marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    checked={selections.world?.selected || false}
                    onChange={e => handleWorldToggle('selected', e.target.checked)}
                  />
                  <span className={styles.charNameLabel}>World State</span>
                </label>

                <div className={`${styles.worldOptionsContainer} ${selections.world?.selected ? styles.activeOps : styles.disabledOps}`}>
                  <div className={styles.worldOptionsRow}>
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        disabled={!selections.world?.selected}
                        checked={selections.world?.date ?? true}
                        onChange={e => handleWorldToggle('date', e.target.checked)}
                      /> Date
                    </label>
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        disabled={!selections.world?.selected}
                        checked={selections.world?.time ?? true}
                        onChange={e => handleWorldToggle('time', e.target.checked)}
                      /> Time
                    </label>
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        disabled={!selections.world?.selected}
                        checked={selections.world?.weather ?? true}
                        onChange={e => handleWorldToggle('weather', e.target.checked)}
                      /> Weather
                    </label>
                  </div>
                  <div className={styles.worldOptionsRow} style={{ marginTop: '4px' }}>
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        disabled={!selections.world?.selected}
                        checked={selections.world?.location ?? true}
                        onChange={e => handleWorldToggle('location', e.target.checked)}
                      /> Location
                    </label>
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        disabled={!selections.world?.selected}
                        checked={selections.world?.events ?? false}
                        onChange={e => handleWorldToggle('events', e.target.checked)}
                      /> World Events
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {targetData && targetData.characters?.map(char => {
              const charSel = selections.chars[char.id] || {};
              return (
                <div key={char.id} className={styles.charRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <label className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={charSel.selected || false}
                        onChange={e => handleCharToggle(char.id, 'selected', e.target.checked)}
                      />
                      <span className={styles.charNameLabel}>{char.name}</span>
                    </label>

                    <div className={`${styles.charOptionsRow} ${charSel.selected ? styles.activeOps : styles.disabledOps}`} style={{ marginLeft: 'auto', gap: '10px' }}>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" disabled={!charSel.selected} checked={charSel.status || false} onChange={e => handleCharToggle(char.id, 'status', e.target.checked)} /> Status
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" disabled={!charSel.selected} checked={charSel.profile || false} onChange={e => handleCharToggle(char.id, 'profile', e.target.checked)} /> Profile
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" disabled={!charSel.selected} checked={charSel.relations || false} onChange={e => handleCharToggle(char.id, 'relations', e.target.checked)} /> Relations
                      </label>
                    </div>
                  </div>

                  {char.activePlayer && (
                    <div className={`${styles.charOptionsRow} ${charSel.selected ? styles.activeOps : styles.disabledOps}`} style={{ paddingLeft: '18px', marginTop: '4px', gap: '10px' }}>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" disabled={!charSel.selected} checked={charSel.inventory || false} onChange={e => handleCharToggle(char.id, 'inventory', e.target.checked)} /> Inventory
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" disabled={!charSel.selected} checked={charSel.quests || false} onChange={e => handleCharToggle(char.id, 'quests', e.target.checked)} /> Quests
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.section} style={{ marginTop: '12px' }}>
            <div className={styles.sectionTitle}>Custom Note (Optional)</div>
            <textarea
              className={styles.textarea}
              placeholder="e.g. Received the mysterious key from the merchant."
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
            />
          </div>
        </div>
      )}

      {activeTab === 'editor' && (
        <div className={styles.tabContentFadeIn} onChangeCapture={() => setHasManualJsonOverride(false)}>
          <div className={styles.section}>
            <div className={styles.sectionTitle} style={{ marginBottom: '8px' }}>Active Values Tuning</div>

            {selections.world?.selected && workingData?.worldState && (
              <div className={styles.editorGroupBlock}>
                <div className={styles.editorGroupTitle}>World Parameters</div>
                {selections.world.date && (
                  <div className={styles.visualEditorRow}>
                    <span className={styles.visualEditorLabel}>Date</span>
                    <input
                      type="text"
                      className={styles.visualEditorInput}
                      value={workingData.worldState.date || ''}
                      onChange={e => setWorkingData(prev => ({
                        ...prev,
                        worldState: { ...(prev.worldState || {}), date: e.target.value }
                      }))}
                    />
                  </div>
                )}
                {selections.world.time && (
                  <div className={styles.visualEditorRow}>
                    <span className={styles.visualEditorLabel}>Time</span>
                    <input
                      type="text"
                      className={styles.visualEditorInput}
                      value={workingData.worldState.time || ''}
                      onChange={e => setWorkingData(prev => ({
                        ...prev,
                        worldState: { ...(prev.worldState || {}), time: e.target.value }
                      }))}
                    />
                  </div>
                )}
                {selections.world.weather && (
                  <div className={styles.visualEditorRow}>
                    <span className={styles.visualEditorLabel}>Weather</span>
                    <input
                      type="text"
                      className={styles.visualEditorInput}
                      value={workingData.worldState.weather || ''}
                      onChange={e => setWorkingData(prev => ({
                        ...prev,
                        worldState: { ...(prev.worldState || {}), weather: e.target.value }
                      }))}
                    />
                  </div>
                )}
                {selections.world.location && (
                  <div className={styles.visualEditorRow}>
                    <span className={styles.visualEditorLabel}>Location</span>
                    <input
                      type="text"
                      className={styles.visualEditorInput}
                      value={workingData.worldState.location || ''}
                      onChange={e => setWorkingData(prev => ({
                        ...prev,
                        worldState: { ...(prev.worldState || {}), location: e.target.value }
                      }))}
                    />
                  </div>
                )}

                {selections.world.events && workingData.worldState?.events && workingData.worldState.events.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                    <div className={styles.visualEditorSubLabel}>Active World Events</div>
                    {workingData.worldState.events.map((evtObj, idx) => {
                      return (
                        <div key={evtObj.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '4px' }}>
                          <div className={styles.visualEditorRow}>
                            <span className={styles.visualEditorLabel}>Event {idx + 1}</span>
                            <input
                              type="text"
                              className={styles.visualEditorInput}
                              value={evtObj.name || ''}
                              onChange={e => {
                                const nextEvents = [...(workingData.worldState.events || [])];
                                nextEvents[idx] = { ...evtObj, name: e.target.value };
                                setWorkingData(prev => ({
                                  ...prev,
                                  worldState: { ...(prev.worldState || {}), events: nextEvents }
                                }));
                              }}
                              placeholder="Event Title..."
                            />
                          </div>
                          <div className={styles.visualEditorRow}>
                            <span className={styles.visualEditorLabel}>Desc</span>
                            <textarea
                              rows={1}
                              className={styles.visualEditorTextarea}
                              value={evtObj.desc || ''}
                              onChange={e => {
                                const nextEvents = [...(workingData.worldState.events || [])];
                                nextEvents[idx] = { ...evtObj, desc: e.target.value };
                                setWorkingData(prev => ({
                                  ...prev,
                                  worldState: { ...(prev.worldState || {}), events: nextEvents }
                                }));
                              }}
                              placeholder="Event Description..."
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {workingData && workingData.characters?.map(char => {
              const charSel = selections.chars[char.id] || {};
              if (!charSel.selected) return null;

              return (
                <div key={char.id} className={styles.editorGroupBlock}>
                  <div className={styles.editorGroupTitle}>{char.name} Parameters</div>

                  {charSel.status && char.statusSchema?.map(schema => {
                    const val = char.status?.[schema.id] ?? '';
                    return (
                      <div key={schema.id} className={styles.visualEditorRow}>
                        <span className={styles.visualEditorLabel}>{schema.name}</span>
                        <input
                          type={schema.type === 'text' ? 'text' : 'number'}
                          className={styles.visualEditorInput}
                          value={val}
                          onChange={e => {
                            const finalVal = schema.type === 'text' ? e.target.value : Number(e.target.value);
                            updateWorkingCharValue(char.id, 'status', schema.id, finalVal);
                          }}
                        />
                      </div>
                    );
                  })}

                  {charSel.profile && Object.keys(char.profile || {}).map(profKey => {
                    const val = char.profile[profKey] ?? '';
                    return (
                      <div key={profKey} className={styles.visualEditorRow} style={{ alignItems: 'flex-start' }}>
                        <span className={styles.visualEditorLabel} style={{ marginTop: '5px' }}>{profKey}</span>
                        <textarea
                          rows={1}
                          className={styles.visualEditorTextarea}
                          value={val}
                          onChange={e => updateWorkingCharValue(char.id, 'profile', profKey, e.target.value)}
                        />
                      </div>
                    );
                  })}

                  {charSel.inventory && char.inventory?.equipment && (
                    <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                      <div className={styles.visualEditorSubLabel}>Equipment Items</div>
                      {Object.entries(char.inventory.equipment).map(([slot, item]) => (
                        <div key={slot} className={styles.visualEditorRow}>
                          <span className={styles.visualEditorLabel}>[{slot}]</span>
                          <input
                            type="text"
                            className={styles.visualEditorInput}
                            value={item?.name || ''}
                            onChange={e => {
                              const nextEquip = { ...(char.inventory.equipment || {}) };
                              if (e.target.value.trim() === '') {
                                nextEquip[slot] = null;
                              } else {
                                nextEquip[slot] = { ...(nextEquip[slot] || { id: `item_${Date.now()}` }), name: e.target.value };
                              }
                              updateWorkingCharValue(char.id, 'inventory', 'equipment', nextEquip);
                            }}
                            placeholder="Empty"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {charSel.inventory && char.inventory?.storage && (
                    <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                      <div className={styles.visualEditorSubLabel}>Storage Container Items</div>
                      {Object.entries(char.inventory.storage).map(([container, items]) => {
                        const itemList = Array.isArray(items) ? items : [];
                        return (
                          <div key={container} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                            <div style={{ fontSize: '10px', opacity: 0.5, fontWeight: 'bold' }}>{container} items</div>
                            {itemList.map((item, idx) => (
                              <div key={item.id || idx} className={styles.visualEditorRow}>
                                <input
                                  type="text"
                                  className={styles.visualEditorInput}
                                  style={{ flex: 3 }}
                                  value={item.name || ''}
                                  onChange={e => {
                                    const nextStorage = { ...(char.inventory.storage || {}) };
                                    const nextList = [...(nextStorage[container] || [])];
                                    nextList[idx] = { ...nextList[idx], name: e.target.value };
                                    nextStorage[container] = nextList;
                                    updateWorkingCharValue(char.id, 'inventory', 'storage', nextStorage);
                                  }}
                                  placeholder="Item Name"
                                />
                                <input
                                  type="number"
                                  className={styles.visualEditorInput}
                                  style={{ flex: 1, maxWidth: '60px', textAlign: 'center' }}
                                  value={item.quantity !== undefined ? item.quantity : 1}
                                  onChange={e => {
                                    const nextStorage = { ...(char.inventory.storage || {}) };
                                    const nextList = [...(nextStorage[container] || [])];
                                    nextList[idx] = { ...nextList[idx], quantity: Number(e.target.value) || 1 };
                                    nextStorage[container] = nextList;
                                    updateWorkingCharValue(char.id, 'inventory', 'storage', nextStorage);
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {charSel.quests && char.quests && (
                    <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className={styles.visualEditorSubLabel}>Quest State</div>
                      <div className={styles.visualEditorRow}>
                        <span className={styles.visualEditorLabel}>Main Title</span>
                        <input
                          type="text"
                          className={styles.visualEditorInput}
                          value={char.quests.main?.name || ''}
                          onChange={e => {
                            const main = { ...(char.quests.main || {}), name: e.target.value };
                            updateWorkingCharValue(char.id, 'quests', 'main', main);
                          }}
                        />
                      </div>
                      <div className={styles.visualEditorRow}>
                        <span className={styles.visualEditorLabel}>Completed</span>
                        <input
                          type="checkbox"
                          checked={char.quests.main?.isCompleted || false}
                          onChange={e => {
                            const main = { ...(char.quests.main || {}), isCompleted: e.target.checked };
                            updateWorkingCharValue(char.id, 'quests', 'main', main);
                          }}
                        />
                      </div>

                      {char.quests.sides && char.quests.sides.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <div style={{ fontSize: '10px', opacity: 0.5, fontWeight: 'bold' }}>Side Quests</div>
                          {char.quests.sides.map((sq, sIdx) => (
                            <div key={sq.id || sIdx} className={styles.visualEditorRow}>
                              <input
                                type="text"
                                className={styles.visualEditorInput}
                                style={{ flex: 3 }}
                                value={sq.name || ''}
                                onChange={e => {
                                  const nextSides = [...(char.quests.sides || [])];
                                  nextSides[sIdx] = { ...nextSides[sIdx], name: e.target.value };
                                  updateWorkingCharValue(char.id, 'quests', 'sides', nextSides);
                                }}
                                placeholder="Side Quest Title"
                              />
                              <label className={styles.checkboxItem} style={{ fontSize: '11px', flex: 1, minWidth: '70px', justifyContent: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={sq.isCompleted || false}
                                  onChange={e => {
                                    const nextSides = [...(char.quests.sides || [])];
                                    nextSides[sIdx] = { ...nextSides[sIdx], isCompleted: e.target.checked };
                                    updateWorkingCharValue(char.id, 'quests', 'sides', nextSides);
                                  }}
                                /> Clear
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {workingData && !selections.world?.selected && !Object.values(selections.chars).some(c => c.selected) && (
              <div style={{ padding: '24px 0', opacity: 0.4, fontSize: '12px', textAlign: 'center' }}>
                No entities are selected.<br />Please check entities to edit in 'Select Targets' tab.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className={styles.tabContentFadeIn}>
          <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className={styles.sectionTitle} style={{ margin: 0 }}>Payload Code</div>
              <button
                type="button"
                className={`rpg-btn-sm ${isEditable ? 'rpg-btn-primary' : ''}`}
                onClick={() => {
                  if (isEditable) {
                    try {
                      const parsed = JSON.parse(jsonText);
                      syncParsedPayloadToState(parsed);
                      setJsonText(JSON.stringify(parsed, null, 2));
                      setHasManualJsonOverride(true);
                      setIsEditable(false);
                    } catch (err) {
                      alert("Syntax error inside JSON. Please fix it before locking.");
                    }
                  } else {
                    setIsEditable(true);
                  }
                }}
              >
                {isEditable ? 'Lock Data' : 'Edit JSON'}
              </button>
            </div>

            <textarea
              className={`${styles.jsonEditor} ${isEditable ? styles.jsonEditorWritable : ''}`}
              value={jsonText}
              onChange={e => {
                if (isEditable) {
                  setHasManualJsonOverride(true);
                  setJsonText(e.target.value);
                }
              }}
              readOnly={!isEditable}
              placeholder="Select entities in Tab 1 or type custom JSON direct..."
              spellCheck="false"
            />
          </div>
        </div>
      )}
    </ModalLayout>
  );
}