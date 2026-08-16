import React, { useState, useRef, useEffect } from 'react';
import { resolveSillyTavernAvatarUrl } from '../utils';

// 캐릭터 카드 메타데이터에 프리셋 데이터를 저장하는 공식 API 및 폴백 함수
export async function savePresetToSillyTavernCard(avatarFile, presetData) {
  if (!avatarFile) return false;

  const context = window.SillyTavern?.getContext?.() || {};
  // 그룹 채팅 스코프 배열이 아닌 글로벌 캐릭터 전체 배열을 최우선 참조
  const globalCharacters = Array.isArray(window.characters)
    ? window.characters
    : (Array.isArray(context.characters) ? context.characters : []);

  if (globalCharacters.length === 0) return false;

  const charIndex = globalCharacters.findIndex(c => c.avatar === avatarFile);
  if (charIndex === -1) return false;

  const char = globalCharacters[charIndex];

  try {
    // 1순위: SillyTavern 공식 writeExtensionField API 사용 (절대 인덱스 전달)
    if (window.RPGBridge && typeof window.RPGBridge.writeExtensionFieldNatively === 'function') {
      const success = await window.RPGBridge.writeExtensionFieldNatively(charIndex, 'rpg_tracker', presetData);
      if (success) {
        if (!char.data) char.data = {};
        if (!char.data.extensions) char.data.extensions = {};
        if (presetData === null) {
          delete char.data.extensions.rpg_tracker;
        } else {
          char.data.extensions.rpg_tracker = presetData;
        }
        if (char.extensions) {
          if (presetData === null) {
            delete char.extensions.rpg_tracker;
          } else {
            char.extensions.rpg_tracker = presetData;
          }
        }
        return true;
      }
    }

    // 2순위 (폴백): REST API를 이용한 기존 업데이트 방식
    const currentExtensions = JSON.parse(JSON.stringify(char.data?.extensions || char.extensions || {}));
    if (presetData === null) {
      delete currentExtensions.rpg_tracker;
    } else {
      currentExtensions.rpg_tracker = presetData;
    }

    const getField = (fieldName, fallback = '') => {
      if (char.data && char.data[fieldName] !== undefined) return char.data[fieldName];
      if (char[fieldName] !== undefined) return char[fieldName];
      return fallback;
    };

    const editPayload = {
      avatar: char.avatar,
      name: getField('name', char.name),
      description: getField('description'),
      personality: getField('personality'),
      scenario: getField('scenario'),
      first_mes: getField('first_mes'),
      mes_example: getField('mes_example'),
      creator_notes: getField('creator_notes'),
      system_prompt: getField('system_prompt'),
      post_history_instructions: getField('post_history_instructions'),
      alternate_greetings: getField('alternate_greetings', []),
      tags: getField('tags', []),
      creator: getField('creator'),
      character_version: getField('character_version'),
      extensions: currentExtensions
    };

    const response = await fetch('/api/characters/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(window.RPGBridge?.getRequestHeaders?.() || {})
      },
      body: JSON.stringify(editPayload)
    });

    if (response.ok) {
      if (!char.data) char.data = {};
      char.data.extensions = currentExtensions;
      if (char.extensions) char.extensions = currentExtensions;
      return true;
    }
    return false;
  } catch (err) {
    console.error("[RPG Tracker] Exception during savePresetToSillyTavernCard:", err);
    return false;
  }
}

export default function CardSyncComponent({ onSync, isSynced }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [targets, setTargets] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenDropdown = () => {
    const context = window.SillyTavern?.getContext?.() || {};
    const list = [];

    const allCharacters = Array.isArray(context.characters)
      ? context.characters
      : (Array.isArray(window.characters) ? window.characters : []);

    const currentName2 = context.name2 || window.name2;
    const currentCharacterAvatar = window.character_avatar;
    const currentCharacterId = context.character_id !== undefined ? context.character_id : window.character_id;

    if (isSynced) {
      list.push({
        id: "unsync_action",
        name: "Unsync",
        type: "Unsync",
        avatarFile: null,
        avatarUrl: null,
        preset: null
      });
    }

    const currentName1 = context.name1 || window.name1;
    if (currentName1) {
      const userAvatarFile = context.user_avatar || window.user_avatar || 'default.png';
      list.push({
        id: "persona_user",
        name: currentName1,
        type: "Persona",
        avatarFile: userAvatarFile,
        avatarUrl: resolveSillyTavernAvatarUrl(userAvatarFile, 'Persona'),
        preset: null
      });
    }

    let activeAvatars = [];
    const currentGroupId = context.groupId || window.groupId;

    if (currentGroupId) {
      const groupsList = Array.isArray(context.groups) ? context.groups : (Array.isArray(window.groups) ? window.groups : []);
      const currentGroup = groupsList.find(g => g.id === currentGroupId);
      if (currentGroup && Array.isArray(currentGroup.members)) {
        activeAvatars = [...currentGroup.members];
      }
    } else {
      if (currentCharacterAvatar) {
        activeAvatars.push(currentCharacterAvatar);
      }
      if (context.character_avatar && !activeAvatars.includes(context.character_avatar)) {
        activeAvatars.push(context.character_avatar);
      }
      if (typeof currentCharacterId === 'number' || typeof currentCharacterId === 'string') {
        const activeChar = allCharacters[currentCharacterId];
        if (activeChar && activeChar.avatar && !activeAvatars.includes(activeChar.avatar)) {
          activeAvatars.push(activeChar.avatar);
        }
      }
      if (currentName2) {
        const matchedByName = allCharacters.find(c => c.name === currentName2);
        if (matchedByName && matchedByName.avatar && !activeAvatars.includes(matchedByName.avatar)) {
          activeAvatars.push(matchedByName.avatar);
        }
      }
    }

    if (allCharacters.length > 0) {
      allCharacters.forEach((char) => {
        if (char && char.name && activeAvatars.includes(char.avatar)) {
          list.push({
            id: `char_card_${char.avatar || char.name}`,
            name: char.name,
            type: "Card",
            avatarFile: char.avatar || null,
            avatarUrl: resolveSillyTavernAvatarUrl(char.avatar, 'Card'),
            preset: char.data?.extensions?.rpg_tracker || null
          });
        }
      });
    }

    setTargets(list);
    setShowDropdown(!showDropdown);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="rpg-btn"
        style={{ height: '28px', gap: '6px' }}
        onClick={handleOpenDropdown}
      >
        <span>Sync Card</span>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isSynced ? '#2ecc71' : '#e74c3c',
            boxShadow: isSynced ? '0 0 6px #2ecc71' : '0 0 6px #e74c3c',
            display: 'inline-block',
            flexShrink: 0
          }}
        />
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--rpg-bg)',
            border: '1px solid var(--rpg-border)',
            borderRadius: '6px',
            minWidth: '240px',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            padding: '4px 0',
          }}
        >
          {targets.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5, textAlign: 'center' }}>
              No active cards in chat.
            </div>
          ) : (
            targets.map((t) => {
              const isUnsync = t.type === 'Unsync';
              return (
                <div
                  key={t.id}
                  style={{
                    padding: '8px 12px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: isUnsync ? '#ff6b6b' : 'var(--rpg-text)',
                    borderBottom: isUnsync ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                    fontWeight: isUnsync ? 'bold' : 'normal',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    onSync(t);
                    setShowDropdown(false);
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                    {t.name}
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      opacity: 0.6,
                      border: isUnsync ? '1px solid rgba(231, 76, 60, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: isUnsync ? 'rgba(231, 76, 60, 0.15)' : 'rgba(0,0,0,0.2)'
                    }}
                  >
                    {t.type}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}