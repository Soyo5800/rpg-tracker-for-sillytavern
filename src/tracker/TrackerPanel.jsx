import React, { useState } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './TrackerPanel.module.css';
import { CollapseArrowIcon, BrandIcon, PlayIcon, PenIcon, GearIcon, ResetArrowIcon } from '../Icons';

import StatusSection from './StatusSection';
import StatusEditor from '../editor/StatusEditor';
import PromptEditor from '../editor/PromptEditor';
import SettingsEditor from '../editor/SettingsEditor';
import WorldSection from './WorldSection';
import FuncSection from './FuncSection';

export default function TrackerPanel() {
  const {
    settings,
    updateSettings,
    isChatConnected,
    revertToOriginalTurnState,
    uiState,
    updateUiState
  } = useRPG();

  const activeTab = uiState.activeTab || 'status';
  const setActiveTab = (tab) => updateUiState({ activeTab: tab });

  const [editorCharId, setEditorCharId] = useState(null);
  const [editorTab, setEditorTab] = useState('status');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isPanelOpen = settings.isPanelOpen || false;
  const panelPosition = settings.panelPosition === 'right' ? 'right' : 'left';

  if (!isPanelOpen) {
    return null;
  }

  const handleClose = () => {
    updateSettings({ isPanelOpen: false });
  };

  const handleManualUpdateClick = async () => {
    if (!isChatConnected) {
      alert("Not connected to a chat room. Please connect to a chat room to use this feature.");
      return;
    }
    if (window.RPGBridge && typeof window.RPGBridge.triggerManualUpdate === 'function') {
      try {
        await window.RPGBridge.triggerManualUpdate();
      } catch (e) {
        console.error('[RPG Tracker] Manual update failed', e);
      }
    }
  };

  return (
    <div className={`${styles.panelContainer} ${styles[panelPosition]}`}>
      <button
        type="button"
        className={`${styles.collapseButton} ${styles[panelPosition]}`}
        onClick={handleClose}
        title="Collapse Panel"
      >
        <CollapseArrowIcon
          className={styles.collapseIcon}
          direction={panelPosition}
        />
      </button>

      <div className={styles.panelInner}>
        <header className={styles.panelHeader}>
          <div className={styles.headerLeftArea}>
            <div className={styles.brand}>
              <BrandIcon className={styles.headerIcon} />
              <span className={styles.headerTitle}>RPG Tracker</span>
              <div
                className={`${styles.statusDot} ${isChatConnected ? styles.statusDotConnected : styles.statusDotDisconnected}`}
                title={isChatConnected ? "Connected to Chat" : "Disconnected"}
              />
            </div>
          </div>

          <div className={styles.headerRightArea}>
            <div className={styles.headerButtonRow}>
              <button
                type="button"
                className={`rpg-btn ${styles.headerBtn}`}
                onClick={() => setShowPromptEditor(true)}
              >
                <PenIcon className={styles.headerBtnIcon} />
                <span>Prompt</span>
              </button>
              <button
                type="button"
                className={`rpg-btn ${styles.headerBtn}`}
                onClick={() => setShowSettings(true)}
              >
                <GearIcon className={styles.headerBtnIcon} />
                <span>Settings</span>
              </button>
            </div>

            <div className={styles.headerButtonRow}>
              {(settings.updateMode === 'isolated' || settings.updateMode === 'separated') && (
                <button
                  type="button"
                  className={`rpg-btn ${styles.headerBtn}`}
                  onClick={handleManualUpdateClick}
                >
                  <PlayIcon className={styles.headerBtnIcon} />
                  <span>Update</span>
                </button>
              )}
              <button
                type="button"
                className={`rpg-btn ${styles.headerBtn}`}
                title="Revert to Original Turn State"
                onClick={revertToOriginalTurnState}
              >
                <ResetArrowIcon className={styles.headerBtnIcon} />
                <span>TurnBack</span>
              </button>
            </div>
          </div>
        </header>

        <div className={styles.scrollContainer}>
          <div className={styles.contentWrapper}>
            <nav className="rpg-tab-nav">
              {['status', 'world', 'function'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`rpg-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'status' && 'Status'}
                  {tab === 'world' && 'World'}
                  {tab === 'function' && 'Function'}
                </button>
              ))}
            </nav>

            <main className={styles.panelBody}>
              {activeTab === 'status' && (
                <StatusSection onOpenEditor={(charId, tab = 'status') => {
                  setEditorCharId(charId);
                  setEditorTab(tab);
                }} />
              )}

              {activeTab === 'world' && (
                <WorldSection />
              )}

              {activeTab === 'function' && (
                <FuncSection />
              )}
            </main>
          </div>
        </div>
      </div>

      {editorCharId && (
        <StatusEditor
          charId={editorCharId}
          initialTab={editorTab}
          onClose={() => setEditorCharId(null)}
        />
      )}

      {showPromptEditor && (
        <PromptEditor onClose={() => setShowPromptEditor(false)} />
      )}

      {showSettings && (
        <SettingsEditor onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}