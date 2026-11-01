import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRPG } from '../core/RPGControl';
import ModalLayout from '../ModalLayout';
import styles from './AssetManagerModal.module.css';
import { ToggleSwitch } from '../utils';
import { PresetLoadIcon, ScissorIcon } from '../Icons';
import {
  fetchSillyTavernSprites,
  checkAssetImageExists,
  buildCharacterSpriteUrl,
  normalizeCropOffset,
  hasImageExtension,
  findNeutralSprite,
  resolveSillyTavernAvatarUrl
} from '../core/AvatarResolver';
import { isBase64Image } from '../core/JSONTracker';

export default function AssetManagerModal({ charId, onClose }) {
  const { trackerData, updateTrackerData, updateCustomAvatar, customAvatars } = useRPG();

  const char = (trackerData.characters || []).find(c => c.id === charId);
  const savedMeta = customAvatars?.[charId] || {};

  const [viewMode, setViewMode] = useState('config');

  const [assetName, setAssetName] = useState(() => {
    if (savedMeta.assetName) return savedMeta.assetName;
    if (char?.assetName) return char.assetName;
    if (char?.syncedCardAvatar) return char.syncedCardAvatar.replace(/\.[^/.]+$/, '');
    return char?.name || '';
  });

  const [isFolder, setIsFolder] = useState(() => {
    if (savedMeta.isFolder !== undefined) return Boolean(savedMeta.isFolder);
    if (char?.isFolder !== undefined) return Boolean(char.isFolder);
    return true;
  });

  const [sprites, setSprites] = useState([]);
  const [selectedSprite, setSelectedSprite] = useState(() => char?.selectedSprite || savedMeta.selectedSprite || '');
  const [availableSprites, setAvailableSprites] = useState(() => savedMeta.availableSprites || char?.availableSprites || []);
  const [enableExpression, setEnableExpression] = useState(() => savedMeta.enableExpression ?? char?.enableExpression ?? true);
  const [cropOffset, setCropOffset] = useState(() => normalizeCropOffset(savedMeta.cropOffset || char?.cropOffset));

  const [viewportScale, setViewportScale] = useState(() => {
    const raw = savedMeta.viewportScale ?? char?.viewportScale ?? 100;
    return Math.min(100, Math.max(20, raw));
  });
  const [viewportOpacity, setViewportOpacity] = useState(() => {
    const raw = savedMeta.viewportOpacity ?? char?.viewportOpacity ?? 0.95;
    return Math.min(1.0, Math.max(0.1, raw));
  });

  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  const [tempCrop, setTempCrop] = useState(cropOffset);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  // Refs for tracking mutable states without triggering scan re-runs
  const initialScanDoneRef = useRef(false);
  const selectedSpriteRef = useRef(selectedSprite);
  selectedSpriteRef.current = selectedSprite;
  const availableSpritesRef = useRef(availableSprites);
  availableSpritesRef.current = availableSprites;

  const handleScan = useCallback(async (targetName = assetName, targetIsFolder = isFolder) => {
    const cleanRaw = (targetName || '').trim();
    if (!cleanRaw) {
      setStatusNotice('Please enter a folder name or image filename.');
      return;
    }

    setIsLoading(true);
    setStatusNotice('Scanning SillyTavern characters directory...');

    try {
      if (!targetIsFolder) {
        let filename = cleanRaw;
        if (!hasImageExtension(filename)) {
          filename += '.png';
        }
        const testUrl = buildCharacterSpriteUrl(filename, null, false);
        const exists = await checkAssetImageExists(testUrl);

        const singleList = [{
          label: 'default',
          cleanLabel: filename.replace(/\.[^/.]+$/, '').trim(),
          fileName: filename,
          path: testUrl
        }];

        setSprites(singleList);
        setSelectedSprite(filename);
        setAvailableSprites([filename]);

        if (exists) {
          setStatusNotice(`Single character image verified: ${filename}`);
        } else {
          setStatusNotice(`Image file not found: data/default-user/characters/${filename}`);
        }
        setIsLoading(false);
        return;
      }

      const folderName = cleanRaw.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
      const fetchedSprites = await fetchSillyTavernSprites(folderName);

      if (fetchedSprites && fetchedSprites.length > 0) {
        setSprites(fetchedSprites);

        const currentSelected = selectedSpriteRef.current;
        const currentValid = fetchedSprites.some(s =>
          s.fileName === currentSelected || s.label === currentSelected || s.cleanLabel === currentSelected || s.path === currentSelected
        );
        let nextSelected = currentSelected;

        if (!currentValid || !nextSelected) {
          const neutral = findNeutralSprite(fetchedSprites);
          nextSelected = neutral ? (neutral.fileName || neutral.label) : fetchedSprites[0].fileName;
          setSelectedSprite(nextSelected);
        }

        const isConfiguredForThisFolder = Boolean(savedMeta.assetName && savedMeta.assetName === folderName);
        if (!isConfiguredForThisFolder && (!availableSpritesRef.current || availableSpritesRef.current.length === 0)) {
          setAvailableSprites(fetchedSprites.map(s => s.fileName || s.label));
        }

        setStatusNotice(`Directory detected: Found ${fetchedSprites.length} sprite asset(s).`);
      } else {
        setSprites([]);
        setStatusNotice(`No sprite assets found in data/default-user/characters/${folderName}`);
      }
    } catch (err) {
      console.warn('[RPG Tracker] Asset scan error:', err);
      setStatusNotice('An error occurred while scanning character assets.');
    } finally {
      setIsLoading(false);
    }
  }, [assetName, isFolder, savedMeta.assetName]);

  // Initial single-run scan on modal mount
  useEffect(() => {
    if (initialScanDoneRef.current) return;
    initialScanDoneRef.current = true;

    let candidate = assetName;
    if (!candidate && char?.syncedCardAvatar) {
      candidate = char.syncedCardAvatar.replace(/\.[^/.]+$/, '');
      setAssetName(candidate);
    } else if (!candidate && char?.name) {
      candidate = char.name.trim();
      setAssetName(candidate);
    }

    if (candidate) {
      handleScan(candidate, isFolder);
    }
  }, [charId, assetName, isFolder, handleScan, char?.syncedCardAvatar, char?.name]);

  const handleToggleSpriteAvailability = (identifier) => {
    setAvailableSprites(prev => (
      prev.includes(identifier) ? prev.filter(l => l !== identifier) : [...prev, identifier]
    ));
  };

  const handleCheckAllSprites = () => {
    if (!isFolder || sprites.length === 0) return;
    const allKeys = sprites.map(s => s.fileName || s.label);
    setAvailableSprites(allKeys);
  };

  const handleUncheckAllSprites = () => {
    if (!isFolder) return;
    setAvailableSprites([]);
  };

  const handleSelectSprite = (identifier) => {
    setSelectedSprite(identifier);
  };

  const handleToggleExpressionSwitch = (checked) => {
    setEnableExpression(checked);
    if (checked && !selectedSprite && sprites.length > 0) {
      const neutral = findNeutralSprite(sprites);
      const defaultIdentifier = neutral ? (neutral.fileName || neutral.label) : (sprites[0].fileName || sprites[0].label);
      setSelectedSprite(defaultIdentifier);
    }
  };

  const getBaseCropImageUrl = () => {
    const clean = (assetName || '').trim();
    if (!isFolder) {
      if (clean) {
        return buildCharacterSpriteUrl(clean, null, false) || '';
      }
    }

    const folderName = clean.replace(/\.[a-zA-Z0-9]{2,5}$/, '');

    const matchedSelected = sprites.find(s => s.fileName === selectedSprite || s.label === selectedSprite || s.path === selectedSprite);
    if (matchedSelected?.path) return matchedSelected.path;

    const neutralSprite = findNeutralSprite(sprites);
    if (neutralSprite?.path) return neutralSprite.path;
    if (sprites.length > 0 && sprites[0].path) return sprites[0].path;

    if (folderName) {
      const built = buildCharacterSpriteUrl(folderName, selectedSprite, true);
      if (built) return built;
    }

    if (char?.avatarUrl && !isBase64Image(char.avatarUrl)) {
      return char.avatarUrl;
    }

    if (char?.syncedCardAvatar) {
      return resolveSillyTavernAvatarUrl(char.syncedCardAvatar, char.syncedCardType || 'Card');
    }

    return '';
  };

  const handleCropMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    const onMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartPosRef.current.x;
      const deltaY = moveEvent.clientY - dragStartPosRef.current.y;

      dragStartPosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };

      const percentDeltaX = (deltaX / 260) * 100;
      const percentDeltaY = (deltaY / 260) * 100;

      setTempCrop(prev => ({
        ...prev,
        x: Math.min(100, Math.max(0, prev.x - percentDeltaX)),
        y: Math.min(100, Math.max(0, prev.y - percentDeltaY))
      }));
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCropTouchStart = (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    const onTouchMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const currentTouch = moveEvent.touches[0];
      if (!currentTouch) return;

      const deltaX = currentTouch.clientX - dragStartPosRef.current.x;
      const deltaY = currentTouch.clientY - dragStartPosRef.current.y;

      dragStartPosRef.current = { x: currentTouch.clientX, y: currentTouch.clientY };

      const percentDeltaX = (deltaX / 260) * 100;
      const percentDeltaY = (deltaY / 260) * 100;

      setTempCrop(prev => ({
        ...prev,
        x: Math.min(100, Math.max(0, prev.x - percentDeltaX)),
        y: Math.min(100, Math.max(0, prev.y - percentDeltaY))
      }));
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleSaveAll = () => {
    // Prevent saving if expression tracking is active but no candidate sprites are checked
    if (isFolder && enableExpression) {
      if (!Array.isArray(availableSprites) || availableSprites.length === 0) {
        alert("Expression Tracking is enabled, but no candidate sprites are selected in the sprite list.\nPlease check at least one sprite or disable Expression Tracking.");
        return;
      }
    }

    const cleanRaw = (assetName || '').trim();
    const cleanAssetName = isFolder ? cleanRaw.replace(/\.[a-zA-Z0-9]{2,5}$/, '') : cleanRaw;

    // Resolve final selected sprite
    let finalSelected = isFolder ? (selectedSprite || null) : null;

    if (isFolder) {
      if (enableExpression && availableSprites.length > 0) {
        if (!finalSelected || !availableSprites.includes(finalSelected)) {
          finalSelected = availableSprites[0];
        }
      } else if (!finalSelected && sprites.length > 0) {
        const neutral = findNeutralSprite(sprites);
        finalSelected = neutral ? (neutral.fileName || neutral.label) : (sprites[0].fileName || sprites[0].label);
      }
    } else if (!isFolder && sprites.length > 0) {
      finalSelected = sprites[0].fileName;
    }

    // Resolve final avatar URL
    let finalAvatarUrl = null;
    if (cleanAssetName) {
      if (isFolder) {
        const matched = sprites.find(s =>
          s.fileName === finalSelected ||
          s.label === finalSelected ||
          s.cleanLabel === finalSelected ||
          s.path === finalSelected
        );
        finalAvatarUrl = matched?.path || buildCharacterSpriteUrl(cleanAssetName, finalSelected, true);
      } else {
        finalAvatarUrl = buildCharacterSpriteUrl(cleanAssetName, null, false);
      }
    } else if (char?.syncedCardAvatar) {
      finalAvatarUrl = resolveSillyTavernAvatarUrl(char.syncedCardAvatar, char.syncedCardType || 'Card');
    }

    const normalizedCrop = normalizeCropOffset(cropOffset);

    const metaPayload = {
      assetName: cleanAssetName || null,
      isFolder,
      selectedSprite: isFolder ? finalSelected : null,
      availableSprites: isFolder
        ? (enableExpression ? availableSprites : (availableSprites.length > 0 ? availableSprites : (finalSelected ? [finalSelected] : [])))
        : (finalSelected ? [finalSelected] : []),
      cropOffset: normalizedCrop,
      enableExpression: isFolder ? Boolean(enableExpression) : false,
      viewportScale: Math.min(100, Math.max(20, viewportScale)),
      viewportOpacity: Math.min(1.0, Math.max(0.1, viewportOpacity))
    };

    if (updateCustomAvatar) {
      updateCustomAvatar(charId, metaPayload);
    }

    if (updateTrackerData) {
      const nextCharacters = (trackerData.characters || []).map(c => {
        if (c.id === charId) {
          return {
            ...c,
            ...metaPayload,
            selectedSprite: isFolder ? finalSelected : null,
            avatarUrl: finalAvatarUrl
          };
        }
        return c;
      });
      updateTrackerData({ ...trackerData, characters: nextCharacters });
    }

    onClose();
  };

  if (!char) return null;

  return (
    <ModalLayout
      title={viewMode === 'crop' ? `Crop Avatar - ${char.name}` : `Asset Manager - ${char.name}`}
      onClose={onClose}
      footerLeft={
        viewMode === 'crop' ? (
          <button
            type="button"
            className="rpg-modal-btn reset"
            onClick={() => setTempCrop({ x: 50, y: 50, zoom: 1 })}
          >
            Reset Position
          </button>
        ) : (
          <span className={styles.footerHelpText}>
            * Assets relative to data/default-user/characters
          </span>
        )
      }
      footerRight={
        viewMode === 'crop' ? (
          <>
            <button
              type="button"
              className="rpg-modal-btn"
              onClick={() => {
                setTempCrop(cropOffset);
                setViewMode('config');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rpg-modal-btn save"
              onClick={() => {
                setCropOffset(tempCrop);
                setViewMode('config');
              }}
            >
              Save Crop
            </button>
          </>
        ) : (
          <>
            <button type="button" className="rpg-modal-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="rpg-modal-btn save" onClick={handleSaveAll}>
              Save & Apply
            </button>
          </>
        )
      }
    >
      {viewMode === 'crop' ? (
        <div className={styles.cropperViewContainer}>
          <div className={styles.cropInstruction}>
            Drag the portrait to center the face within the guide and adjust zoom below.
          </div>

          <div
            className={styles.cropViewportFrame}
            onMouseDown={handleCropMouseDown}
            onTouchStart={handleCropTouchStart}
          >
            <img
              src={getBaseCropImageUrl()}
              alt="Crop Base"
              className={styles.cropTargetImage}
              draggable={false}
              style={{
                objectPosition: `${tempCrop.x}% ${tempCrop.y}%`,
                transformOrigin: `${tempCrop.x}% ${tempCrop.y}%`,
                transform: `scale(${tempCrop.zoom})`
              }}
            />
            <div className={styles.cropCenterGuideCircle} />
          </div>

          <div className={styles.cropControlsBar}>
            <div className={styles.zoomControlRow}>
              <span className={styles.controlLabel}>Zoom:</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={tempCrop.zoom}
                onChange={(e) => setTempCrop(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                className={styles.zoomSlider}
              />
              <span className={styles.zoomValueLabel}>{tempCrop.zoom.toFixed(2)}x</span>
            </div>

            <div className={styles.cropPresetButtons}>
              <button
                type="button"
                className="rpg-btn-sm"
                onClick={() => setTempCrop(prev => ({ ...prev, x: 50, y: 20 }))}
              >
                Face/Top (50%, 20%)
              </button>
              <button
                type="button"
                className="rpg-btn-sm"
                onClick={() => setTempCrop(prev => ({ ...prev, x: 50, y: 50 }))}
              >
                Center (50%, 50%)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.configViewContainer}>
          <div className={styles.inputSectionBox}>
            <label className={styles.sectionLabel}>Character Asset (Folder Name or Image Filename)</label>
            <div className={styles.assetConfigRow}>
              <div className={styles.assetInputsCol}>
                <input
                  type="text"
                  className={styles.assetInput}
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. Eileen (folder) or Eileen.png (single image)"
                />
                <select
                  className={`${styles.typeSelect} rpg-select-custom`}
                  value={isFolder ? 'folder' : 'png'}
                  onChange={(e) => {
                    const nextIsFolder = e.target.value === 'folder';
                    setIsFolder(nextIsFolder);
                    handleScan(assetName, nextIsFolder);
                  }}
                >
                  <option value="folder">Sprite Folder</option>
                  <option value="png">Single Image (.png)</option>
                </select>
              </div>

              <div className={styles.assetButtonsCol}>
                <button
                  type="button"
                  className={`rpg-btn ${styles.stackedActionBtn}`}
                  disabled={isLoading}
                  onClick={() => handleScan(assetName, isFolder)}
                  title="Scan / Load Asset"
                >
                  <PresetLoadIcon size={14} />
                  <span>{isLoading ? 'Loading...' : 'Load'}</span>
                </button>
                <button
                  type="button"
                  className={`rpg-btn ${styles.stackedActionBtn}`}
                  onClick={() => {
                    setTempCrop(cropOffset);
                    setViewMode('crop');
                  }}
                  title="Adjust Avatar Crop Offset"
                >
                  <ScissorIcon size={14} />
                  <span>Crop</span>
                </button>
              </div>
            </div>
            {statusNotice && <div className={styles.statusNoticeText}>{statusNotice}</div>}
          </div>

          <div className={styles.unifiedConfigCard}>
            <div className={styles.toggleRowItem}>
              <div className={styles.labelGroup}>
                <span className={styles.highlightTitle}>Expression Tracking</span>
                <span className={styles.subText}>
                  {isFolder
                    ? 'Automatically update portrait expressions based on LLM response deltas.'
                    : 'Single image mode active. Fixed image used for portrait and standee.'}
                </span>
              </div>
              <ToggleSwitch
                checked={isFolder && enableExpression}
                disabled={!isFolder}
                onChange={handleToggleExpressionSwitch}
              />
            </div>

            <div className={styles.innerDivider} />

            <div className={styles.activeSpriteIndicatorRow}>
              <span className={styles.indicatorLabel}>Current Active Expression:</span>
              <span className={styles.activeSpriteBadge}>
                {selectedSprite || '(None selected)'}
              </span>
            </div>

            <div className={styles.innerDivider} />

            <div className={styles.gridHeaderRow}>
              <div className={styles.gridHeaderTopBar}>
                <span className={styles.gridListTitle}>
                  Sprite List ({isFolder ? availableSprites.length : sprites.length})
                </span>
                {isFolder && sprites.length > 0 && (
                  <div className={styles.bulkCheckButtons}>
                    <button
                      type="button"
                      className="rpg-btn-sm"
                      onClick={handleCheckAllSprites}
                      title="Select all sprites for AI prompt candidate list"
                    >
                      Check All
                    </button>
                    <button
                      type="button"
                      className="rpg-btn-sm"
                      onClick={handleUncheckAllSprites}
                      title="Deselect all sprites"
                    >
                      Uncheck All
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.gridHelperNotice}>
                [Checkbox]: AI prompt / [Click Image or Name]: Select expression
              </div>
            </div>

            <div className={styles.spriteScrollArea}>
              {sprites.length === 0 ? (
                <div className={styles.emptyGridNotice}>
                  No sprite assets found. Enter a folder name above and click 'Load'.
                </div>
              ) : (
                <div className={styles.spriteGrid}>
                  {sprites.map((sprite, idx) => {
                    const spriteKey = sprite.fileName || sprite.label;
                    const isChecked = isFolder ? availableSprites.includes(spriteKey) : true;
                    const isCurrent = selectedSprite === spriteKey || selectedSprite === sprite.label;
                    const displayLabel = sprite.cleanLabel || String(sprite.label).replace(/\.[a-zA-Z0-9]{2,5}$/, '');

                    return (
                      <div
                        key={`${spriteKey}_${idx}`}
                        className={`${styles.spriteTile} ${isCurrent ? styles.currentActiveTile : ''}`}
                        onClick={() => handleSelectSprite(spriteKey)}
                        title={`Click to set '${displayLabel}' as active expression`}
                      >
                        <div className={styles.tileHeader}>
                          <input
                            type="checkbox"
                            className={styles.tileCheckbox}
                            checked={isChecked}
                            disabled={!isFolder}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isFolder) handleToggleSpriteAvailability(spriteKey);
                            }}
                            title={isFolder ? "Include in AI prompt choices" : "Fixed for single image"}
                          />
                          <span className={styles.spriteLabelText} title={displayLabel}>
                            {displayLabel}
                          </span>
                        </div>

                        <div className={styles.thumbnailWrapper}>
                          <img
                            src={sprite.path}
                            alt={displayLabel}
                            className={styles.spriteThumbnail}
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.opacity = '0.35';
                            }}
                          />
                          {isCurrent && <div className={styles.selectedBadge}>Selected</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={styles.standeeSectionBox}>
            <div className={styles.labelGroup}>
              <span className={styles.sectionLabel}>Visual Stage Standee</span>
              <span className={styles.subText}>Adjust the size and opacity of the character standee illustration.</span>
            </div>
            <div className={styles.standeeControlsContainer}>
              <div className={styles.standeeSliderRow}>
                <span className={styles.standeeControlLabel}>Size:</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={viewportScale}
                  onChange={(e) => setViewportScale(parseInt(e.target.value, 10))}
                  className={styles.sliderInput}
                />
                <span className={styles.standeeValueBadge}>
                  {viewportScale}%
                </span>
              </div>
              <div className={styles.standeeSliderRow}>
                <span className={styles.standeeControlLabel}>Opacity:</span>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={viewportOpacity}
                  onChange={(e) => setViewportOpacity(parseFloat(e.target.value))}
                  className={styles.sliderInput}
                />
                <span className={styles.standeeValueBadge}>
                  {Math.round(viewportOpacity * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalLayout>
  );
}