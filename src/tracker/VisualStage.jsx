import React from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './VisualStage.module.css';
import { resolveEffectiveCharacterVisual } from '../core/AvatarResolver';

export default function VisualStage() {
  const { trackerData, activeVisualCharId, settings, customAvatars } = useRPG();

  if (!activeVisualCharId) {
    return null;
  }

  const char = (trackerData.characters || []).find(c => c.id === activeVisualCharId);
  if (!char) {
    return null;
  }

  const {
    stageImageUrl: imageUrl,
    fallbackAvatarUrl,
    effectiveSelectedSprite,
    viewport
  } = resolveEffectiveCharacterVisual(char, customAvatars);

  if (!imageUrl) {
    return null;
  }

  const isTrackerOnLeft = (settings.panelPosition || 'left') === 'left';
  const dockClass = isTrackerOnLeft ? styles.dockRight : styles.dockLeft;

  const { scale: clampedScale, opacity: clampedOpacity } = viewport;
  const scaleRatio = clampedScale / 100;

  return (
    <div
      className={`${styles.stageContainer} ${dockClass}`}
      style={{
        opacity: clampedOpacity,
        '--rpg-viewport-scale': scaleRatio
      }}
      aria-hidden="true"
    >
      <img
        key={`${char.id}_${effectiveSelectedSprite || 'base'}`}
        src={imageUrl}
        alt=""
        className={styles.stageImage}
        draggable={false}
        onError={(e) => {
          if (fallbackAvatarUrl && e.target.src !== fallbackAvatarUrl) {
            e.target.src = fallbackAvatarUrl;
            return;
          }
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
}