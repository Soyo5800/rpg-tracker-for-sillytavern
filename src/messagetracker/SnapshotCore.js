// src/messagetracker/SnapshotCore.js

export function buildSnapshotPayload(targetData, selections, customNote) {
    if (!targetData) return {};

    const payload = {};

    // 1. 월드 상태 세부 선택 필드별 정밀 수집
    const isWorldObj = selections.world && typeof selections.world === 'object';
    const isWorldSelected = isWorldObj ? selections.world.selected : !!selections.world;

    if (isWorldSelected && targetData.worldState) {
        const w = targetData.worldState;
        const selectedWorld = {};

        const includeDate = isWorldObj ? (selections.world.date !== false) : true;
        const includeTime = isWorldObj ? (selections.world.time !== false) : true;
        const includeWeather = isWorldObj ? (selections.world.weather !== false) : true;
        const includeLocation = isWorldObj ? (selections.world.location !== false) : true;
        const includeEvents = isWorldObj ? !!selections.world.events : false;

        if (includeDate && w.date) selectedWorld.date = w.date;
        if (includeTime && w.time) selectedWorld.time = w.time;
        if (includeWeather && w.weather) selectedWorld.weather = w.weather;
        if (includeLocation && w.location) selectedWorld.location = w.location;
        if (includeEvents && Array.isArray(w.events) && w.events.length > 0) {
            selectedWorld.events = w.events;
        }

        if (Object.keys(selectedWorld).length > 0) {
            payload.world = selectedWorld;
        }
    }

    // 2. 캐릭터별 옵션에 맞춘 정밀 수집
    const activeChars = {};
    if (targetData.characters && Array.isArray(targetData.characters)) {
        targetData.characters.forEach(char => {
            const charSel = selections.chars[char.id];
            
            if (charSel && charSel.selected) {
                const charData = {};

                if (charSel.status && char.status && Object.keys(char.status).length > 0) {
                    charData.status = char.status;
                }
                if (charSel.profile && char.profile && Object.keys(char.profile).length > 0) {
                    charData.profile = char.profile;
                }
                if (charSel.inventory && char.inventory) {
                    charData.inventory = char.inventory;
                }
                if (charSel.quests && char.quests) {
                    charData.quests = char.quests;
                }

                if (Object.keys(charData).length > 0) {
                    activeChars[char.name] = charData;
                }
            }
        });
    }

    if (Object.keys(activeChars).length > 0) {
        payload.chars = activeChars;
    }

    // 3. 커스텀 노트 수집 (가장 마지막에 속하도록 순서 하단 이동)
    if (customNote && customNote.trim() !== "") {
        payload.note = customNote.trim();
    }

    return payload;
}

export function generateSnapshotTag(payload) {
    if (!payload || Object.keys(payload).length === 0) return '';
    // 마크다운 파서 및 DOMPurify 필터링에 구애받지 않고 화면에 완벽히 숨겨지도록 HTML 주석 사용
    return `\n\n<!-- <rpgmt>${JSON.stringify(payload)}</rpgmt> -->`;
}