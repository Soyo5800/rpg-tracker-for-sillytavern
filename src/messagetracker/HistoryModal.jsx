import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './HistoryModal.module.css';
import ModalLayout from '../ModalLayout';
import { LockIcon, ResetArrowIcon } from '../Icons';
import { AccordionArrow } from '../utils';

export default function HistoryModal() {
  const { isHistoryModalOpen, setIsHistoryModalOpen } = useRPG();

  const [historyList, setHistoryList] = useState([]);
  const [expandedTurns, setExpandedTurns] = useState({});
  const [editingTurns, setEditingTurns] = useState({});
  const [draftJson, setDraftJson] = useState({});

  const refreshHistory = useCallback(() => {
    if (window.RPGBridge && typeof window.RPGBridge.getChatTurnHistory === 'function') {
      const turns = window.RPGBridge.getChatTurnHistory();
      setHistoryList(turns);
    }
  }, []);

  useEffect(() => {
    if (isHistoryModalOpen) {
      refreshHistory();
    }
  }, [isHistoryModalOpen, refreshHistory]);

  useEffect(() => {
    if (!isHistoryModalOpen) return;

    if (window.RPGBridge && typeof window.RPGBridge.subscribeHistoryChange === 'function') {
      const unsubscribe = window.RPGBridge.subscribeHistoryChange(() => {
        refreshHistory();
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [isHistoryModalOpen, refreshHistory]);

  const stats = useMemo(() => {
    const total = historyList.length;
    const pinned = historyList.filter(t => t.isPinned).length;
    return { total, pinned };
  }, [historyList]);

  if (!isHistoryModalOpen) return null;

  const getTurnKey = (turn) => turn.turnId || `${turn.sendDate || turn.messageIndex}_${turn.swipeId}`;

  const handleToggleExpand = (turn) => {
    const key = getTurnKey(turn);
    const nextState = !expandedTurns[key];

    setExpandedTurns(prev => ({ ...prev, [key]: nextState }));

    if (nextState && draftJson[key] === undefined && turn.data) {
      setDraftJson(prev => ({
        ...prev,
        [key]: JSON.stringify(turn.data, null, 2)
      }));
    }
  };

  const handleTogglePin = async (turn) => {
    if (!window.RPGBridge || typeof window.RPGBridge.setTurnPinned !== 'function') return;

    const nextPinState = !turn.isPinned;
    const success = await window.RPGBridge.setTurnPinned(
      turn.messageRef || turn.messageIndex,
      turn.swipeId,
      nextPinState,
      turn.sendDate,
      turn.turnId
    );

    if (success) {
      refreshHistory();
    }
  };

  const handleRestore = async (turn) => {
    if (!turn.data) {
      alert("No snapshot data found for this message to restore.");
      return;
    }

    const messageLabel = `#${turn.messageIndex}`;
    if (!window.confirm(`Restore active live tracker state to Message ${messageLabel}? Unsaved progress in the current turn will be overwritten.`)) {
      return;
    }

    if (window.RPGBridge && typeof window.RPGBridge.restoreTurnSnapshot === 'function') {
      const success = await window.RPGBridge.restoreTurnSnapshot(turn.data);
      if (success) {
        alert(`Successfully restored live tracker to Message ${messageLabel}.`);
        setIsHistoryModalOpen(false);
      } else {
        alert("Failed to restore snapshot data.");
      }
    }
  };

  const handleDelete = async (turn) => {
    const messageLabel = `#${turn.messageIndex}`;
    if (!window.confirm(`Delete tracker snapshot for Message ${messageLabel}? If this message contains a visual tracker card, it will also be removed.`)) {
      return;
    }

    if (window.RPGBridge && typeof window.RPGBridge.deleteTurnSnapshot === 'function') {
      const success = await window.RPGBridge.deleteTurnSnapshot(
        turn.messageRef || turn.messageIndex,
        turn.swipeId,
        turn.sendDate,
        turn.turnId
      );
      if (success) {
        const key = getTurnKey(turn);
        setExpandedTurns(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setDraftJson(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setEditingTurns(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        refreshHistory();
      } else {
        alert("Failed to delete snapshot.");
      }
    }
  };

  const handleToggleEditMode = (turn) => {
    const key = getTurnKey(turn);
    const currentEditing = Boolean(editingTurns[key]);

    if (currentEditing) {
      setEditingTurns(prev => ({ ...prev, [key]: false }));
    } else {
      if (draftJson[key] === undefined && turn.data) {
        setDraftJson(prev => ({
          ...prev,
          [key]: JSON.stringify(turn.data, null, 2)
        }));
      }
      setEditingTurns(prev => ({ ...prev, [key]: true }));
    }
  };

  const handleJsonDraftChange = (key, text) => {
    setDraftJson(prev => ({ ...prev, [key]: text }));
  };

  const handleSaveJson = async (turn) => {
    const key = getTurnKey(turn);
    const rawText = draftJson[key];

    let parsedData = null;
    try {
      parsedData = JSON.parse(rawText);
    } catch (err) {
      alert(`Invalid JSON format: ${err.message}`);
      return;
    }

    if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
      alert("Snapshot payload must be a valid JSON object.");
      return;
    }

    if (window.RPGBridge && typeof window.RPGBridge.updateTurnSnapshotData === 'function') {
      const success = await window.RPGBridge.updateTurnSnapshotData(
        turn.messageRef || turn.messageIndex,
        turn.swipeId,
        parsedData,
        turn.sendDate,
        turn.turnId
      );

      if (success) {
        if (typeof window.RPGBridge.syncFromHistoryOrMeta === 'function') {
          await window.RPGBridge.syncFromHistoryOrMeta();
        }
        alert(`Snapshot data for Message #${turn.messageIndex} updated.`);
        setEditingTurns(prev => ({ ...prev, [key]: false }));
        refreshHistory();
      } else {
        alert("Failed to update snapshot on server.");
      }
    }
  };

  const handleResetDraft = (turn) => {
    const key = getTurnKey(turn);
    if (turn.data) {
      setDraftJson(prev => ({
        ...prev,
        [key]: JSON.stringify(turn.data, null, 2)
      }));
    }
  };

  return (
    <ModalLayout
      title="Turn History Manager"
      isOpen={isHistoryModalOpen}
      onClose={() => setIsHistoryModalOpen(false)}
      subHeader={
        <div className={styles.subHeaderStats}>
          <span>Total Turns: <strong>{stats.total}</strong></span>
          <span className={styles.statsDivider}>|</span>
          <span>Pinned (Protected): <strong>{stats.pinned}</strong></span>
        </div>
      }
      footerRight={
        <button
          type="button"
          className="rpg-modal-btn"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          Close
        </button>
      }
    >
      {historyList.length === 0 ? (
        <p className="rpg-empty-text">No snapshot history found in this chat.</p>
      ) : (
        <div className={styles.historyList}>
          {historyList.map(turn => {
            const key = getTurnKey(turn);
            const isExpanded = Boolean(expandedTurns[key]);
            const isEditing = Boolean(editingTurns[key]);
            const currentDraft = draftJson[key] !== undefined
              ? draftJson[key]
              : (turn.data ? JSON.stringify(turn.data, null, 2) : '{}');

            return (
              <div key={key} className={styles.turnCard}>
                <div className={styles.turnHeader}>
                  <div className={styles.turnHeaderLeft} onClick={() => handleToggleExpand(turn)}>
                    <AccordionArrow isExpanded={isExpanded} />
                    <span className={styles.turnBadge}>#{turn.messageIndex}</span>
                    <span className={styles.senderBadge}>
                      {turn.sender}
                    </span>
                    <span className={styles.previewText} title={turn.textPreview}>
                      {turn.textPreview}
                    </span>
                  </div>

                  <div className={styles.turnHeaderRight}>
                    <button
                      type="button"
                      className={`${styles.turnActionBtn} ${turn.isPinned ? styles.pinnedActive : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(turn);
                      }}
                      title={turn.isPinned ? "Protected from pruning (Click to unlock)" : "Lock to prevent pruning"}
                    >
                      <LockIcon isLocked={turn.isPinned} size={13} />
                    </button>

                    <button
                      type="button"
                      className={styles.turnActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(turn);
                      }}
                      title="Restore Live State to this Message"
                    >
                      <ResetArrowIcon size={13} />
                    </button>

                    <button
                      type="button"
                      className={`${styles.turnActionBtn} ${styles.deleteAction}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(turn);
                      }}
                      title="Delete Snapshot"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.turnBody}>
                    {!turn.data ? (
                      <p className="rpg-empty-text">No metadata snapshot recorded for this message.</p>
                    ) : (
                      <>
                        <div className={styles.turnMetaBar}>
                          <div className={styles.turnSummaryText}>
                            <span>World: {turn.data.worldState?.location || 'Unknown location'}</span>
                            <span className={styles.statsDivider}>•</span>
                            <span>Characters: {turn.data.characters?.length || 0}</span>
                          </div>

                          <button
                            type="button"
                            className={`rpg-btn-sm ${isEditing ? 'rpg-btn-primary' : ''}`}
                            onClick={() => handleToggleEditMode(turn)}
                          >
                            {isEditing ? 'Lock View' : 'Edit JSON'}
                          </button>
                        </div>

                        <textarea
                          className={`${styles.jsonEditor} ${isEditing ? styles.jsonEditorWritable : ''}`}
                          value={currentDraft}
                          onChange={(e) => handleJsonDraftChange(key, e.target.value)}
                          readOnly={!isEditing}
                          spellCheck="false"
                        />

                        {isEditing && (
                          <div className={styles.editActionsRow}>
                            <button
                              type="button"
                              className="rpg-btn-sm"
                              onClick={() => handleResetDraft(turn)}
                            >
                              Reset Changes
                            </button>
                            <button
                              type="button"
                              className="rpg-modal-btn save"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => handleSaveJson(turn)}
                            >
                              Save to Message
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalLayout>
  );
}