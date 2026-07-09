// src/tracker/TrackerPanel.jsx

import React, { useState } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './TrackerPanel.module.css';
import { CollapseArrowIcon, BrandIcon, PlayIcon, PenIcon, GearIcon, ResetArrowIcon } from '../Icons';

import StatusSection from './StatusSection';
import StatusEditor from '../editor/StatusEditor';
import PromptEditor from '../editor/PromptEditor';
import SettingsEditor from '../editor/SettingsEditor';
import WorldSection from './WorldSection';

export default function TrackerPanel() {
  const {
    settings,
    updateSettings,
    trackerData,
    isChatConnected,
    revertToOriginalTurnState,
    uiState,          // UI 보존 전역 상태 참조
    updateUiState     // UI 전역 상태 업데이트 함수 참조
  } = useRPG();

  // 글로벌 uiState 바인딩
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

  return (
    <div className={`${styles.panelContainer} ${styles[panelPosition]}`}>
      <button
        className={`${styles.collapseButton} ${styles[panelPosition]}`}
        onClick={handleClose}
        title="Collapse Panel"
      >
        <CollapseArrowIcon
          className={styles.collapseIcon}
          direction={panelPosition}
        />
      </button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0
        }}
      >
        <header className={styles.panelHeader}>
          {/* 좌측 영역: 브랜드 정보 수직 중앙 정렬 */}
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

          {/* 우측 영역: 그리드 정렬된 버튼 그룹 */}
          <div className={styles.headerRightArea}>
            {/* 첫 번째 줄 버튼 그룹 */}
            <div className={styles.headerButtonRow}>
              <button
                className={styles.headerBtn}
                onClick={() => setShowPromptEditor(true)}
              >
                <PenIcon className={styles.headerBtnIcon} />
                <span>Prompt</span>
              </button>
              <button
                className={styles.headerBtn}
                onClick={() => setShowSettings(true)}
              >
                <GearIcon className={styles.headerBtnIcon} />
                <span>Settings</span>
              </button>
            </div>

            {/* 두 번째 줄 버튼 그룹 */}
            <div className={styles.headerButtonRow}>
              {(settings.updateMode === 'isolated' || settings.updateMode === 'separated') && (
                <button
                  className={styles.headerBtn}
                  onClick={async () => {
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
                  }}
                >
                  <PlayIcon className={styles.headerBtnIcon} />
                  <span>Update</span>
                </button>
              )}
              <button
                className={styles.headerBtn}
                title="Revert to Original Turn State"
                onClick={revertToOriginalTurnState}
              >
                <ResetArrowIcon className={styles.headerBtnIcon} />
                <span>Turn Back</span>
              </button>
            </div>
          </div>
        </header>

        <div className={styles.scrollContainer}>
          <div className={styles.contentWrapper}>
            <nav className={styles.panelNav}>
              {['status', 'world'].map((tab) => (
                <button
                  key={tab}
                  className={activeTab === tab ? styles.activeTab : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'status' && 'Status'}
                  {tab === 'world' && 'World'}
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