import React, { useState, useRef, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './StatusSection.module.css';
import StatusComponent from './StatusComponent';
import PlayerComponent from './PlayerComponent';
import CharListEditor from '../editor/CharListEditor';
import { getDefaultCharacters } from '../core/PromptSchema';
import { LockIcon, GearIcon, ProfileTabIcon, RelationsTabIcon, InventoryTabIcon, QuestsTabIcon } from '../Icons';
import { AutoGrowingTextArea, resolveSillyTavernAvatarUrl, ToggleSwitch, AccordionArrow } from '../utils';

// Helper for dynamic loading of Cropper.js
async function ensureCropperLoaded() {
  if (window.Cropper) return true;

  const origin = window.location.origin;
  const paths = [
    { js: `${origin}/libs/cropperjs/cropper.min.js`, css: `${origin}/libs/cropperjs/cropper.min.css` },
    { js: `${origin}/libs/cropper/cropper.min.js`, css: `${origin}/libs/cropper/cropper.min.css` },
    { js: './libs/cropperjs/cropper.min.js', css: './libs/cropperjs/cropper.min.css' },
    { js: './libs/cropper/cropper.min.js', css: './libs/cropper/cropper.min.css' }
  ];

  for (const path of paths) {
    try {
      if (!document.querySelector('link[href*="cropper"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = path.css;
        document.head.appendChild(link);
      }
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = path.js;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (window.Cropper) {
        return true;
      }
    } catch (e) {
      // Fall through to next path
    }
  }
  return false;
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default function StatusSection({ onOpenEditor }) {
  const { trackerData, updateTrackerData, settings, updateSettings, patchCharacterField, uiState, updateUiState } = useRPG();

  const fileInputRef = useRef(null);
  const cropperImgRef = useRef(null);
  const cropperInstanceRef = useRef(null);

  const activeUploadIdRef = useRef(null);

  const [showCharList, setShowCharList] = useState(false);
  const [isCropperLibraryReady, setIsCropperLibraryReady] = useState(!!window.Cropper);

  const [cropModal, setCropModal] = useState({
    isOpen: false,
    imageSrc: '',
    charId: null
  });

  const characters = (trackerData.characters && trackerData.characters.length > 0)
    ? trackerData.characters
    : getDefaultCharacters();

  const collapsedChars = uiState.collapsedChars || {};
  const activeInlineTabs = uiState.activeInlineTabs || {};

  useEffect(() => {
    if (cropModal.isOpen) {
      if (window.Cropper) {
        setIsCropperLibraryReady(true);
      } else {
        ensureCropperLoaded().then((success) => {
          setIsCropperLibraryReady(success);
        });
      }
    }
  }, [cropModal.isOpen]);

  useEffect(() => {
    return () => {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
    };
  }, [cropModal.isOpen]);

  useEffect(() => {
    if (cropModal.isOpen && isCropperLibraryReady) {
      const timer = setTimeout(() => {
        initCropperInstance();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [cropModal.isOpen, isCropperLibraryReady]);

  const initCropperInstance = () => {
    if (cropperImgRef.current && window.Cropper && isCropperLibraryReady) {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
      }
      cropperInstanceRef.current = new window.Cropper(cropperImgRef.current, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        restore: false,
        checkCrossOrigin: false
      });
    }
  };

  const handleUpdateCharacters = (nextChars) => {
    if (updateTrackerData) {
      updateTrackerData({ ...trackerData, characters: nextChars });
    }
  };

  const handleValueChange = (charId, statId, newVal) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const schemaItem = (char.statusSchema || []).find(s => s.id === statId);
    let finalVal = newVal;
    if (schemaItem && schemaItem.type !== 'text') {
      const minLimit = schemaItem.min !== undefined && schemaItem.min !== null ? schemaItem.min : 0;
      const maxLimit = schemaItem.max || 100;
      finalVal = Math.min(maxLimit, Math.max(minLimit, newVal));
    }
    patchCharacterField(charId, ['status', statId], finalVal);
  };

  const toggleCollapse = (charId) => {
    const currentCollapsed = collapsedChars[charId] !== false;
    updateUiState({
      collapsedChars: { ...collapsedChars, [charId]: !currentCollapsed }
    });
  };

  const handleToggleInlineTab = (charId, tabName) => {
    const charTabs = activeInlineTabs[charId] || {
      profile: false, relations: false, inventory: false, quests: false
    };
    updateUiState({
      activeInlineTabs: {
        ...activeInlineTabs,
        [charId]: { ...charTabs, [tabName]: !charTabs[tabName] }
      }
    });
  };

  const handleAvatarClick = (charId, avatarUrl) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    if (char.syncedCardType === 'Persona') {
      return;
    }

    if (char.syncedCardType === 'Card' && char.syncedCardAvatar) {
      const cropSource = resolveSillyTavernAvatarUrl(char.syncedCardAvatar, 'Card');
      if (cropSource) {
        setCropModal({
          isOpen: true,
          imageSrc: cropSource,
          charId: charId
        });
      }
      return;
    }

    activeUploadIdRef.current = charId;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    const targetCharId = activeUploadIdRef.current;
    if (!file || !targetCharId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropModal({
        isOpen: true,
        imageSrc: event.target.result,
        charId: targetCharId
      });
    };
    reader.readAsDataURL(file);

    e.target.value = '';
    activeUploadIdRef.current = null;
  };

  const handleCropperImageLoad = () => {
    initCropperInstance();
  };

  const handleSaveCrop = () => {
    if (cropperInstanceRef.current && window.Cropper) {
      const canvas = cropperInstanceRef.current.getCroppedCanvas({
        width: 128,
        height: 128,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      if (canvas) {
        const croppedBase64 = canvas.toDataURL('image/webp', 0.85);

        const currentCropped = settings.croppedAvatars || {};
        updateSettings({
          croppedAvatars: {
            ...currentCropped,
            [cropModal.charId]: croppedBase64
          }
        });

        patchCharacterField(cropModal.charId, ['avatarUrl'], croppedBase64);
      }
    } else {
      const img = cropperImgRef.current;
      if (img) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const size = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - size) / 2;
          const sy = (img.naturalHeight - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
          const croppedBase64 = canvas.toDataURL('image/webp', 0.85);

          const currentCropped = settings.croppedAvatars || {};
          updateSettings({
            croppedAvatars: {
              ...currentCropped,
              [cropModal.charId]: croppedBase64
            }
          });

          patchCharacterField(cropModal.charId, ['avatarUrl'], croppedBase64);
        }
      }
    }
    setCropModal({ isOpen: false, imageSrc: '', charId: null });
  };

  const handleResetToOriginalImage = () => {
    const charId = cropModal.charId;
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const nextCropped = { ...(settings.croppedAvatars || {}) };
    delete nextCropped[charId];
    updateSettings({ croppedAvatars: nextCropped });

    const context = window.SillyTavern?.getContext?.();
    let originalUrl = null;

    if (char.syncedCardType === 'Persona') {
      const userAvatarFile = char.syncedCardAvatar || context?.user_avatar || window.user_avatar;
      originalUrl = resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona');
    } else if (char.syncedCardType === 'Card' && char.syncedCardAvatar) {
      originalUrl = resolveSillyTavernAvatarUrl(char.syncedCardAvatar, 'Card');
    }

    patchCharacterField(charId, ['avatarUrl'], originalUrl);
    if (originalUrl) {
      alert("Profile photo has been reset to the original card image.");
    } else {
      alert("Profile photo reset to default icon.");
    }
    setCropModal({ isOpen: false, imageSrc: '', charId: null });
  };

  const targetCharCard = characters.find(c => c.id === cropModal.charId);

  return (
    <div className={styles.container}>
      <div className={styles.topActionBar}>
        <button
          type="button"
          className="rpg-btn"
          style={{ flex: 1 }}
          onClick={() => {
            const newChar = JSON.parse(JSON.stringify(getDefaultCharacters()[0]));
            newChar.id = `char_${Date.now()}`;
            newChar.name = "New Character";
            newChar.activePlayer = false;
            newChar.activeInjection = true;

            let nextChars = (characters.length === 1 && characters[0].id === 'char_user' && characters[0].name === 'New')
              ? [newChar]
              : [...characters, newChar];
            handleUpdateCharacters(nextChars);
          }}
        >
          + Add Character
        </button>
        <button type="button" className="rpg-btn" style={{ flex: 1 }} onClick={() => setShowCharList(true)}>
          Character List
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {characters.map((char) => {
        const schema = (char.statusSchema || []).filter(s => s.type !== 'relation_schema');
        const dynamicStatus = char.status || {};

        const gaugeFields = schema.filter(item => ['stacking', 'consumable'].includes(item.type));
        const integerFields = schema.filter(item => item.type === 'integer');
        const textFields = schema.filter(item => item.type === 'text');

        const isCollapsed = collapsedChars[char.id] !== false;
        const charTabs = activeInlineTabs[char.id] || {};
        const isPlayerActive = char.activePlayer === true;
        const isInjectionActive = char.activeInjection !== false;

        const hasActiveTab = Object.values(charTabs).some(v => v === true);

        let liveName = char.name;
        let liveAvatarUrl = char.avatarUrl;

        const globalCrop = settings.croppedAvatars?.[char.id];
        if (globalCrop) {
          liveAvatarUrl = globalCrop;
        }

        const isCropped = liveAvatarUrl && liveAvatarUrl.startsWith('data:');

        const context = window.SillyTavern?.getContext?.();
        if (context) {
          if (char.syncedCardType === 'Card' && char.syncedCardAvatar) {
            const matched = context.characters?.find(stChar => stChar.avatar === char.syncedCardAvatar);
            if (matched) {
              liveName = matched.name;
              if (!isCropped) {
                liveAvatarUrl = resolveSillyTavernAvatarUrl(matched.avatar, 'Card');
              }
            } else {
              if (!isCropped) {
                liveAvatarUrl = null;
              }
            }
          } else if (char.syncedCardType === 'Persona') {
            liveName = context.name1 || window.name1 || char.name;
            if (!isCropped) {
              const userAvatarFile = context.user_avatar || window.user_avatar;
              liveAvatarUrl = resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona');
            }
          } else {
            if (!isCropped) {
              liveAvatarUrl = null;
            }
          }
        } else {
          if (!isCropped && !char.syncedCardType) {
            liveAvatarUrl = null;
          }
        }

        const hasValidAvatar = liveAvatarUrl &&
          typeof liveAvatarUrl === 'string' &&
          liveAvatarUrl.trim() !== '' &&
          liveAvatarUrl !== 'null' &&
          liveAvatarUrl !== 'undefined';

        const isPersona = char.syncedCardType === 'Persona';

        return (
          <div key={char.id} className={styles.charBlock}>

            <header className={styles.blockHeader}>
              <div className={styles.headerLeft} onClick={() => toggleCollapse(char.id)}>
                <AccordionArrow isExpanded={!isCollapsed} />
                <span className={styles.charName}>{liveName}</span>
              </div>

              <div className={styles.headerSwitches}>
                <ToggleSwitch
                  label="Player"
                  checked={isPlayerActive}
                  onChange={() => patchCharacterField(char.id, ['activePlayer'], !isPlayerActive)}
                  title="Enable Inventory and Quests Tab"
                />

                <ToggleSwitch
                  label="Inject"
                  checked={isInjectionActive}
                  onChange={() => patchCharacterField(char.id, ['activeInjection'], !isInjectionActive)}
                  title="Inject status into AI context"
                />

                <button
                  type="button"
                  className={styles.settingsGearBtn}
                  title="Edit Character Spec & Schema"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditor && onOpenEditor(char.id);
                  }}
                >
                  <GearIcon />
                </button>
              </div>
            </header>

            {!isCollapsed && (
              <div className={styles.dashboardContainer}>

                <div className={styles.uniformControlGrid}>
                  <button
                    type="button"
                    className={`rpg-btn-icon ${charTabs.profile ? 'active' : ''}`}
                    onClick={() => handleToggleInlineTab(char.id, 'profile')}
                    title="Profile"
                  >
                    <ProfileTabIcon />
                  </button>

                  <button
                    type="button"
                    className={`rpg-btn-icon ${charTabs.relations ? 'active' : ''}`}
                    onClick={() => handleToggleInlineTab(char.id, 'relations')}
                    title="Relations"
                  >
                    <RelationsTabIcon />
                  </button>

                  {isPlayerActive && (
                    <>
                      <button
                        type="button"
                        className={`rpg-btn-icon ${charTabs.inventory ? 'active' : ''}`}
                        onClick={() => handleToggleInlineTab(char.id, 'inventory')}
                        title="Inventory"
                      >
                        <InventoryTabIcon />
                      </button>

                      <button
                        type="button"
                        className={`rpg-btn-icon ${charTabs.quests ? 'active' : ''}`}
                        onClick={() => handleToggleInlineTab(char.id, 'quests')}
                        title="Quest"
                      >
                        <QuestsTabIcon />
                      </button>
                    </>
                  )}

                  <div
                    className={`${styles.avatarContainer} ${isPersona ? styles.readOnlyAvatar : ''}`}
                    onClick={() => handleAvatarClick(char.id, liveAvatarUrl)}
                    title={isPersona ? "" : "Change Photo / Crop"}
                  >
                    {hasValidAvatar ? (
                      <img
                        src={liveAvatarUrl}
                        alt={liveName}
                        className={styles.avatarImg}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={styles.avatarFallback}>
                        <CameraIcon />
                      </div>
                    )}
                  </div>
                </div>

                <div className={`${styles.statusComponentContainer} ${hasActiveTab ? styles.tabActive : ''}`}>
                  <StatusComponent
                    char={char}
                    characters={characters}
                    activeTabs={charTabs}
                    onOpenEditor={(tab) => onOpenEditor && onOpenEditor(char.id, tab)}
                  />

                  {isPlayerActive && (
                    <PlayerComponent
                      char={char}
                      activeTabs={charTabs}
                      onOpenEditor={(tab) => onOpenEditor && onOpenEditor(char.id, tab)}
                    />
                  )}
                </div>

                {gaugeFields.length > 0 && (
                  <div className={styles.gaugeGrid}>
                    {gaugeFields.map((item) => {
                      const rawValue = dynamicStatus[item.id];
                      const currentValue = rawValue !== undefined ? rawValue : (item.max || 100);
                      const minLimit = item.min !== undefined && item.min !== null ? item.min : 0;
                      const maxLimit = item.max || 100;
                      const range = maxLimit - minLimit || 1;
                      const ratio = Math.min(100, Math.max(0, ((Number(currentValue) - minLimit) / range) * 100));
                      const isConsumable = item.type === 'consumable';
                      const isDanger = isConsumable && ratio <= 25;

                      return (
                        <div key={item.id} className={styles.gaugeCard}>
                          <div className={styles.gaugeLabelRow}>
                            <div className={styles.gaugeLabelContainer}>
                              <LockIcon
                                isLocked={item.isLocked}
                                onClick={() => {
                                  const newSchema = (char.statusSchema || []).map(s =>
                                    s.id === item.id ? { ...s, isLocked: !s.isLocked } : s
                                  );
                                  patchCharacterField(char.id, ['statusSchema'], newSchema);
                                }}
                                className={`${styles.lockIcon} ${item.isLocked ? styles.lockIconActive : ''}`}
                              />
                              <span className={`${styles.gaugeName} ${isDanger ? styles.dangerText : ''}`}>
                                {item.name || 'Unnamed'}
                              </span>
                            </div>
                            <div className={styles.gaugeValues}>
                              <input
                                type="number"
                                className={styles.smallNumberInput}
                                value={currentValue}
                                onChange={(e) => handleValueChange(char.id, item.id, Number(e.target.value))}
                              />
                              <span className={`${styles.gaugeMax} ${styles.gaugeMaxText}`}>/{item.max || 100}</span>
                            </div>
                          </div>
                          <div className={`${styles.gaugeTrack} ${isDanger ? styles.dangerTrack : ''}`}>
                            <div
                              className={`${styles.gaugeFill} ${isDanger ? styles.dangerFlash : ''}`}
                              style={{
                                width: `${ratio}%`,
                                backgroundColor: item.color || (isConsumable ? '#e74c3c' : '#3498db')
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {integerFields.length > 0 && (
                  <div className={styles.integerRowGrid}>
                    {integerFields.map((item) => {
                      const rawValue = dynamicStatus[item.id];
                      const currentValue = rawValue !== undefined ? rawValue : 0;

                      return (
                        <div key={item.id} className={styles.integerBlockCard}>
                          <div className={styles.integerFieldLeft}>
                            <LockIcon
                              isLocked={item.isLocked}
                              onClick={() => {
                                const newSchema = (char.statusSchema || []).map(s =>
                                  s.id === item.id ? { ...s, isLocked: !s.isLocked } : s
                                );
                                patchCharacterField(char.id, ['statusSchema'], newSchema);
                              }}
                              className={`${styles.lockIcon} ${item.isLocked ? styles.lockIconActive : ''}`}
                            />
                            <span className={styles.integerFieldName} title={item.name}>{item.name || 'Unnamed'}</span>
                          </div>
                          <div className={styles.integerFieldControlGroup}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleValueChange(char.id, item.id, Number(currentValue) - 1); }}
                              className={styles.integerRowBtn}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              className={styles.smallNumberInput}
                              value={currentValue}
                              onChange={(e) => handleValueChange(char.id, item.id, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleValueChange(char.id, item.id, Number(currentValue) + 1); }}
                              className={styles.integerRowBtn}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {textFields.length > 0 && (
                  <div className={styles.textStack}>
                    {textFields.map((item) => {
                      const rawValue = dynamicStatus[item.id];
                      const currentValue = rawValue !== undefined ? rawValue : '';

                      return (
                        <div key={item.id} className={styles.textBlockCard}>
                          <LockIcon
                            isLocked={item.isLocked}
                            onClick={() => {
                              const newSchema = (char.statusSchema || []).map(s =>
                                s.id === item.id ? { ...s, isLocked: !s.isLocked } : s
                              );
                              patchCharacterField(char.id, ['statusSchema'], newSchema);
                            }}
                            className={`${styles.lockIcon} ${item.isLocked ? styles.lockIconActive : ''}`}
                          />
                          <label className={styles.textBlockLabel}>{item.name || 'Unnamed'}</label>
                          <div className={styles.textBlockInputWrapper}>
                            <AutoGrowingTextArea
                              className={styles.textBlockInput}
                              value={currentValue}
                              onChange={(val) => handleValueChange(char.id, item.id, val)}
                              placeholder={`Enter ${item.name || 'details'}...`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

          </div>
        );
      })}

      {cropModal.isOpen && (
        <div className="rpg-modal-overlay high-priority">
          <div
            className="rpg-modal-container"
            style={{ width: '500px', height: 'auto', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <header className="rpg-modal-header">
              <h4>Set the crop position of the avatar image</h4>
              <button
                type="button"
                className="rpg-modal-close-btn"
                onClick={() => setCropModal({ isOpen: false, imageSrc: '', charId: null })}
              >
                ×
              </button>
            </header>

            <div className="rpg-modal-body" style={{ background: '#0c0d12', padding: '16px' }}>
              <div className={styles.cropperCanvasWrapper}>
                <img
                  ref={cropperImgRef}
                  src={cropModal.imageSrc}
                  onLoad={handleCropperImageLoad}
                  alt="Source"
                  style={{ maxWidth: '100%', maxHeight: '420px', display: 'block' }}
                />
              </div>
            </div>

            <footer className="rpg-modal-footer">
              <div className="rpg-modal-footer-left">
                {(targetCharCard?.syncedCardAvatar || targetCharCard?.id === 'char_user' || targetCharCard?.activePlayer) && (
                  <button
                    type="button"
                    className="rpg-modal-btn reset"
                    onClick={handleResetToOriginalImage}
                  >
                    Reset to Original Card
                  </button>
                )}
              </div>
              <div className="rpg-modal-footer-right">
                <button
                  type="button"
                  className="rpg-modal-btn"
                  onClick={() => setCropModal({ isOpen: false, imageSrc: '', charId: null })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rpg-modal-btn save"
                  onClick={handleSaveCrop}
                >
                  Save Crop
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {showCharList && (
        <CharListEditor
          onClose={() => setShowCharList(false)}
          onOpenStatusEditor={(id) => {
            setShowCharList(false);
            if (onOpenEditor) onOpenEditor(id);
          }}
        />
      )}
    </div>
  );
}