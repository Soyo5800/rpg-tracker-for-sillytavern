export function buildSnapshotPayload(targetData, selections, customNote) {
    if (!targetData) return {};

    const payload = {};

    // 1. Collect granular world state parameters based on selections
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

    // 2. Collect character data based on granular selections
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
                if (charSel.relations && char.relations && Object.keys(char.relations).length > 0) {
                    charData.relations = char.relations;
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

    // 3. Collect optional custom notes
    if (customNote && customNote.trim() !== "") {
        payload.note = customNote.trim();
    }

    return payload;
}

export function generateSnapshotTag(payload) {
    if (!payload || Object.keys(payload).length === 0) return '';
    return `\n\n<!-- <rpgmt>${JSON.stringify(payload)}</rpgmt> -->`;
}