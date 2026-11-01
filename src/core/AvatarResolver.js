import { isBase64Image, sanitizeAvatarUrl, cleanBase64Avatar } from './JSONTracker_Migrator.js';

/**
 * Encodes individual path segments while preserving directory slashes.
 */
export function encodePathSegments(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') return '';
    return pathStr
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
}

/**
 * Normalizes CSS crop offset coordinates and zoom scale.
 */
export function normalizeCropOffset(offset) {
    if (!offset || typeof offset !== 'object') {
        return { x: 50, y: 50, zoom: 1 };
    }
    const x = typeof offset.x === 'number' && !isNaN(offset.x) ? Math.min(100, Math.max(0, offset.x)) : 50;
    const y = typeof offset.y === 'number' && !isNaN(offset.y) ? Math.min(100, Math.max(0, offset.y)) : 50;
    const zoom = typeof offset.zoom === 'number' && !isNaN(offset.zoom) ? Math.min(3, Math.max(1, offset.zoom)) : 1;
    return { x, y, zoom };
}

/**
 * Normalizes viewport standee configuration (scale 20~100%, opacity 0.1~1.0).
 */
export function normalizeViewportSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        return { scale: 100, opacity: 0.95 };
    }
    const scale = typeof settings.scale === 'number' && !isNaN(settings.scale) ? Math.min(100, Math.max(20, settings.scale)) : 100;
    const opacity = typeof settings.opacity === 'number' && !isNaN(settings.opacity) ? Math.min(1.0, Math.max(0.1, settings.opacity)) : 0.95;
    return { scale, opacity };
}

/**
 * Resolves effective visual metadata (display name, avatar/stage URLs, fallback URL, crop, viewport)
 * for a character by combining character state, chatMetadata custom avatars, and SillyTavern context.
 */
export function resolveEffectiveCharacterVisual(char, customAvatars = {}) {
    if (!char || typeof char !== 'object') {
        return {
            displayName: 'Unnamed',
            avatarUrl: null,
            stageImageUrl: null,
            fallbackAvatarUrl: null,
            effectiveAssetName: null,
            effectiveSelectedSprite: null,
            effectiveIsFolder: true,
            cropOffset: normalizeCropOffset(null),
            viewport: normalizeViewportSettings(null)
        };
    }

    const customMeta = customAvatars?.[char.id] || {};
    const isExplicitlyUnsynced = !char.syncedCardType || char.syncedCardType === 'None';
    const ctx = (typeof window !== 'undefined' && window.SillyTavern?.getContext)
        ? window.SillyTavern.getContext()
        : null;

    let displayName = char.name || 'Unnamed';
    if (!isExplicitlyUnsynced && ctx) {
        if (char.syncedCardType === 'Persona') {
            const livePersonaName = ctx.name1 || window.name1;
            if (livePersonaName) displayName = livePersonaName;
        } else if (char.syncedCardType === 'Card' && char.syncedCardAvatar) {
            const allChars = Array.isArray(ctx.characters) ? ctx.characters : (window.characters || []);
            const matched = allChars.find(st => st.avatar === char.syncedCardAvatar);
            if (matched?.name) displayName = matched.name;
        }
    }

    const effectiveAssetName = char.assetName || customMeta.assetName || null;
    const effectiveSelectedSprite = char.selectedSprite || customMeta.selectedSprite || null;
    const effectiveIsFolder = char.isFolder !== undefined ? Boolean(char.isFolder) : (customMeta.isFolder !== false);

    const spriteUrl = effectiveAssetName
        ? buildCharacterSpriteUrl(effectiveAssetName, effectiveSelectedSprite, effectiveIsFolder)
        : null;
    const cleanCharAvatarUrl = (char.avatarUrl && typeof char.avatarUrl === 'string' && !isBase64Image(char.avatarUrl))
        ? char.avatarUrl
        : null;

    let fallbackAvatarUrl = null;
    if (!isExplicitlyUnsynced) {
        if (char.syncedCardType === 'Persona') {
            const userAvatar = ctx?.user_avatar || (typeof window !== 'undefined' ? window.user_avatar : null);
            const cleanUserAvatar = (userAvatar && typeof userAvatar === 'string' && !isBase64Image(userAvatar) && !['default.png', 'ghost.png', 'user.png', 'none', ''].includes(userAvatar.trim().toLowerCase()))
                ? userAvatar.trim()
                : null;
            if (cleanUserAvatar) {
                fallbackAvatarUrl = resolveSillyTavernAvatarUrl(cleanUserAvatar, 'Persona');
            }
        } else if (char.syncedCardAvatar) {
            fallbackAvatarUrl = resolveSillyTavernAvatarUrl(char.syncedCardAvatar, char.syncedCardType || 'Card');
        }
    }

    const rawAvatarUrl = (effectiveAssetName && effectiveSelectedSprite && spriteUrl)
        ? spriteUrl
        : (cleanCharAvatarUrl || spriteUrl || fallbackAvatarUrl || null);
    const avatarUrl = (
        rawAvatarUrl &&
        typeof rawAvatarUrl === 'string' &&
        rawAvatarUrl.trim() !== '' &&
        !isBase64Image(rawAvatarUrl) &&
        rawAvatarUrl !== 'null' &&
        rawAvatarUrl !== 'undefined'
    )
        ? rawAvatarUrl
        : null;

    const rawStageUrl = spriteUrl || cleanCharAvatarUrl || fallbackAvatarUrl || null;
    const stageImageUrl = (
        rawStageUrl &&
        typeof rawStageUrl === 'string' &&
        rawStageUrl.trim() !== '' &&
        !isBase64Image(rawStageUrl) &&
        rawStageUrl !== 'null' &&
        rawStageUrl !== 'undefined'
    )
        ? rawStageUrl
        : null;

    const cropOffset = normalizeCropOffset(char.cropOffset || customMeta.cropOffset);
    const viewport = normalizeViewportSettings({
        scale: char.viewportScale ?? customMeta.viewportScale,
        opacity: char.viewportOpacity ?? customMeta.viewportOpacity
    });

    return {
        displayName,
        avatarUrl,
        stageImageUrl,
        fallbackAvatarUrl,
        effectiveAssetName,
        effectiveSelectedSprite,
        effectiveIsFolder,
        cropOffset,
        viewport
    };
}

/**
 * Checks whether a given string ends with a standard image file extension.
 */
export function hasImageExtension(filename) {
    if (!filename || typeof filename !== 'string') return false;
    return /\.(png|webp|gif|jpe?g)$/i.test(filename.trim());
}

/**
 * Searches a sprite collection for a neutral or default expression entry.
 */
export function findNeutralSprite(sprites) {
    if (!Array.isArray(sprites) || sprites.length === 0) return null;

    const neutralKeywords = ['neutral', 'normal', 'default', 'idle', 'base', 'calm'];

    const extractLabel = (item) => {
        if (!item) return '';
        const raw = typeof item === 'string' ? item : (item.cleanLabel || item.label || item.fileName || item.name || '');
        return raw.replace(/\.[a-zA-Z0-9]{2,5}$/, '').replace(/[-_]\d+$/, '').trim().toLowerCase();
    };

    for (const kw of neutralKeywords) {
        const found = sprites.find(item => extractLabel(item) === kw);
        if (found) return found;
    }

    for (const kw of neutralKeywords) {
        const found = sprites.find(item => extractLabel(item).includes(kw));
        if (found) return found;
    }

    return sprites[0] || null;
}

/**
 * Builds URL path for SillyTavern character sprite or single image.
 */
export function buildCharacterSpriteUrl(assetName, spriteFile = null, isFolder = true) {
    if (!assetName || typeof assetName !== 'string' || isBase64Image(assetName)) return null;

    let cleanAsset = assetName.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    cleanAsset = cleanAsset.replace(/^(?:data\/default-user\/)?characters\//i, '');
    if (!cleanAsset) return null;

    if (isFolder === false) {
        let filename = cleanAsset;
        if (!hasImageExtension(filename)) {
            filename += '.png';
        }
        const encodedPath = encodePathSegments(filename);
        return `/characters/${encodedPath}`;
    }

    const folderName = cleanAsset.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
    const encodedFolder = encodePathSegments(folderName);

    const rawSprite = (typeof spriteFile === 'object' && spriteFile !== null)
        ? (spriteFile.path || spriteFile.fileName || spriteFile.label || '')
        : String(spriteFile || '');

    if (rawSprite.trim() && rawSprite !== 'default') {
        const cleanSprite = rawSprite.trim().replace(/\\/g, '/');

        if (cleanSprite.startsWith('http://') || cleanSprite.startsWith('https://')) {
            return cleanSprite;
        }

        if (cleanSprite.startsWith('/characters/')) {
            return cleanSprite.replace(/\/characters\/([^/]+)\.[a-zA-Z0-9]{2,5}\//i, '/characters/$1/');
        }
        if (cleanSprite.startsWith('characters/')) {
            return `/${cleanSprite}`.replace(/\/characters\/([^/]+)\.[a-zA-Z0-9]{2,5}\//i, '/characters/$1/');
        }

        const filenameOnly = cleanSprite.split('/').pop().split('?')[0];
        const finalFilename = hasImageExtension(filenameOnly) ? filenameOnly : `${filenameOnly}.png`;
        return `/characters/${encodedFolder}/${encodeURIComponent(finalFilename)}`;
    }

    return `/characters/${encodedFolder}/neutral.png`;
}

/**
 * Queries SillyTavern native API to fetch character sprite list.
 */
export async function fetchSillyTavernSprites(assetName) {
    if (!assetName || typeof assetName !== 'string' || isBase64Image(assetName)) return [];
    let cleanName = assetName.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    cleanName = cleanName.replace(/^(?:data\/default-user\/)?characters\//i, '');
    if (!cleanName) return [];

    const folderName = cleanName.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
    const encodedFolder = encodePathSegments(folderName);
    const headers = {
        ...(window.RPGBridge?.getRequestHeaders?.() || {}),
        ...(typeof window.getRequestHeaders === 'function' ? window.getRequestHeaders() : {})
    };

    try {
        let response = await fetch(`/api/sprites/get?name=${encodeURIComponent(folderName)}`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            response = await fetch('/api/sprites/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ name: folderName })
            });
        }

        if (response.ok) {
            const data = await response.json();
            let rawList = [];

            if (Array.isArray(data)) {
                rawList = data;
            } else if (data && typeof data === 'object') {
                if (Array.isArray(data.sprites)) rawList = data.sprites;
                else if (Array.isArray(data.files)) rawList = data.files;
                else if (Array.isArray(data.data)) rawList = data.data;
                else {
                    rawList = Object.entries(data).map(([k, v]) => (typeof v === 'string' ? { label: k, path: v } : v));
                }
            }

            if (rawList.length > 0) {
                const uniqueSprites = [];
                const seenPaths = new Set();

                for (const item of rawList) {
                    let path = '';
                    let rawLabel = '';

                    if (typeof item === 'string') {
                        const trimmedItem = item.trim().replace(/\\/g, '/');
                        const fileName = trimmedItem.split('/').pop().split('?')[0];
                        path = `/characters/${encodedFolder}/${encodeURIComponent(fileName)}`;
                        rawLabel = fileName.replace(/\.[^/.]+$/, '').trim();
                    } else if (item && typeof item === 'object') {
                        rawLabel = item.label || item.name || '';
                        let rawPath = (item.path || item.imageSrc || item.url || '').trim().replace(/\\/g, '/');

                        if (rawPath) {
                            if (!rawPath.startsWith('/') && !rawPath.startsWith('http')) {
                                rawPath = `/${rawPath}`;
                            }
                            rawPath = rawPath.replace(/^\/(?:public\/|data\/default-user\/)/i, '/');
                            rawPath = rawPath.replace(/\/characters\/([^/]+)\.[a-zA-Z0-9]{2,5}\//i, '/characters/$1/');
                            path = rawPath;
                        } else if (item.fileName) {
                            path = `/characters/${encodedFolder}/${encodeURIComponent(item.fileName)}`;
                        }
                    }

                    if (!path || seenPaths.has(path)) continue;
                    seenPaths.add(path);

                    const fileName = path.split('/').pop().split('?')[0];
                    const cleanLabel = (rawLabel || fileName.replace(/\.[^/.]+$/, '')).replace(/[-_]\d+$/, '').trim().toLowerCase();

                    uniqueSprites.push({
                        label: rawLabel || cleanLabel,
                        cleanLabel: cleanLabel,
                        fileName: fileName,
                        path: path
                    });
                }

                if (uniqueSprites.length > 0) {
                    return uniqueSprites;
                }
            }
        }
    } catch (err) {
        console.warn(`[RPG Tracker] Sprite search error for "${folderName}":`, err);
    }

    return [];
}

/**
 * Checks whether an image asset exists on the server via lightweight HEAD request.
 */
export async function checkAssetImageExists(url) {
    if (!url || typeof url !== 'string' || isBase64Image(url)) return false;
    try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Resolves SillyTavern avatar filenames to accessible URLs.
 */
export function resolveSillyTavernAvatarUrl(avatarFile, type = 'Card') {
    if (!avatarFile || typeof avatarFile !== 'string' || isBase64Image(avatarFile)) return null;
    if (avatarFile.startsWith('http://') || avatarFile.startsWith('https://')) {
        return avatarFile;
    }

    let filename = String(avatarFile).trim().replace(/\\/g, '/');
    filename = filename.replace(/^(?:data\/default-user\/)?characters\//i, '');

    try { filename = decodeURIComponent(filename); } catch { /* ignore decode error */ }

    const lower = filename.toLowerCase();
    if (
        lower === 'default.png' || lower === 'ghost.png' || lower === 'user.png' ||
        lower === 'system.png' || lower === 'default-user' || lower === 'default' ||
        lower === 'user-default.png' || lower === 'user-default' || lower === 'none' ||
        lower === ''
    ) {
        return null;
    }

    if (type === 'Card') {
        if (typeof window.getAvatarPath === 'function') {
            const resolved = window.getAvatarPath(avatarFile);
            if (resolved && (resolved.startsWith('http') || resolved.startsWith('/') || resolved.startsWith('.'))) {
                return resolved;
            }
        }
        return `/characters/${encodePathSegments(filename)}`;
    }

    if (type === 'Persona') {
        try {
            const getThumb = (window.RPGBridge && typeof window.RPGBridge.getThumbnailUrl === 'function')
                ? window.RPGBridge.getThumbnailUrl
                : (typeof window.getThumbnailUrl === 'function' ? window.getThumbnailUrl : null);

            if (getThumb) {
                const url = getThumb('persona', filename) || getThumb('avatar', filename);
                if (url) return url;
            }
        } catch (e) {
            console.warn("[RPG Tracker] Native getThumbnailUrl call failed:", e);
        }

        if (!hasImageExtension(filename)) {
            filename += '.png';
        }
        return `/api/images/avatars/${encodePathSegments(filename)}`;
    }

    return null;
}

/**
 * Synchronizes character visual metadata across chat metadata and active tracker state.
 */
export function hydrateCharacterMetadata(characters, context = null, settings = null) {
    if (!Array.isArray(characters)) return characters;

    const ctx = context || (window.SillyTavern?.getContext ? window.SillyTavern.getContext() : {});
    const chatId = ctx.chatId;
    if (!chatId) return characters;

    const effectiveSettings = settings
        || window.RPGBridge?.latestSettings
        || {};

    const chatSyncs = effectiveSettings?.characterSyncs?.[chatId]
        || (window.RPGBridge?.getSTSettingsCharacterSyncs ? window.RPGBridge.getSTSettingsCharacterSyncs(chatId) : null)
        || {};

    const customAvatars = ctx.chatMetadata?.rpgCustomAvatars || {};
    const allChars = Array.isArray(ctx.characters)
        ? ctx.characters
        : (Array.isArray(window.characters) ? window.characters : []);

    characters.forEach(c => {
        if (!c || !c.id) return;

        cleanBase64Avatar(c);

        const isExplicitlyUnsynced = c.syncedCardAvatar === null && c.syncedCardType === null;

        if (isExplicitlyUnsynced && chatSyncs[c.id]) {
            delete chatSyncs[c.id];
        }

        // 1. Card Sync Lookup
        let savedSync = isExplicitlyUnsynced ? null : (chatSyncs[c.id] || null);

        if (!savedSync && !isExplicitlyUnsynced && c.name) {
            const cleanName = c.name.trim().toLowerCase();
            const foundKey = Object.keys(chatSyncs).find(k => {
                const item = chatSyncs[k];
                return item && item.name && item.name.trim().toLowerCase() === cleanName;
            });
            if (foundKey) {
                savedSync = chatSyncs[foundKey];
                chatSyncs[c.id] = savedSync;
            }
        }

        if (!savedSync && !isExplicitlyUnsynced && c.syncedCardAvatar) {
            const foundKey = Object.keys(chatSyncs).find(k => chatSyncs[k]?.syncedCardAvatar === c.syncedCardAvatar);
            if (foundKey) {
                savedSync = chatSyncs[foundKey];
                chatSyncs[c.id] = savedSync;
            }
        }

        if (savedSync && !isExplicitlyUnsynced) {
            cleanBase64Avatar(savedSync);

            c.syncedCardAvatar = savedSync.syncedCardAvatar || null;
            c.syncedCardType = savedSync.syncedCardType;
            c.name = savedSync.name || c.name;
            const cleanSyncUrl = sanitizeAvatarUrl(savedSync.avatarUrl);
            if (cleanSyncUrl) {
                c.avatarUrl = cleanSyncUrl;
            }
        }

        // 2. Custom Avatar Meta Lookup
        let custom = customAvatars[c.id] || null;

        if (!custom && c.name) {
            const cleanName = c.name.trim().toLowerCase();
            const foundCustomKey = Object.keys(customAvatars).find(k => {
                const meta = customAvatars[k];
                return (meta?.name && meta.name.trim().toLowerCase() === cleanName) ||
                       (meta?.assetName && meta.assetName.trim().toLowerCase() === cleanName);
            });
            if (foundCustomKey) {
                custom = customAvatars[foundCustomKey];
                customAvatars[c.id] = custom;
            }
        }

        if (custom) {
            c.cropOffset = normalizeCropOffset(custom.cropOffset);
            c.isFolder = custom.isFolder !== undefined ? Boolean(custom.isFolder) : (c.isFolder !== undefined ? Boolean(c.isFolder) : true);
            c.enableExpression = c.isFolder ? Boolean(custom.enableExpression) : false;
            c.availableSprites = c.isFolder && Array.isArray(custom.availableSprites) ? custom.availableSprites : [];
            c.assetName = custom.assetName || c.assetName || null;
            c.viewportScale = typeof custom.viewportScale === 'number' ? Math.min(100, Math.max(20, custom.viewportScale)) : (c.viewportScale ?? 100);
            c.viewportOpacity = typeof custom.viewportOpacity === 'number' ? Math.min(1.0, Math.max(0.1, custom.viewportOpacity)) : (c.viewportOpacity ?? 0.95);

            if (c.isFolder) {
                let activeSprite = c.selectedSprite || custom.selectedSprite || null;
                if (!activeSprite && c.availableSprites.length > 0) {
                    const neutral = findNeutralSprite(c.availableSprites);
                    activeSprite = typeof neutral === 'string' ? neutral : (neutral?.fileName || neutral?.label || null);
                }
                c.selectedSprite = activeSprite;
            } else {
                c.selectedSprite = null;
            }

            const effectiveAsset = c.assetName || custom.assetName;
            if (effectiveAsset) {
                let matchedPath = null;
                if (c.isFolder && c.selectedSprite && Array.isArray(c.availableSprites)) {
                    const found = c.availableSprites.find(s =>
                        typeof s === 'object' && s !== null && (s.fileName === c.selectedSprite || s.label === c.selectedSprite || s.path === c.selectedSprite)
                    );
                    if (found?.path) matchedPath = found.path;
                }
                c.avatarUrl = matchedPath || buildCharacterSpriteUrl(effectiveAsset, c.selectedSprite, c.isFolder);
            }
        } else {
            c.cropOffset = normalizeCropOffset(c.cropOffset);
            c.isFolder = c.isFolder !== undefined ? Boolean(c.isFolder) : true;
            c.enableExpression = c.isFolder ? Boolean(c.enableExpression) : false;
            c.availableSprites = c.isFolder && Array.isArray(c.availableSprites) ? c.availableSprites : [];
            c.viewportScale = typeof c.viewportScale === 'number' ? Math.min(100, Math.max(20, c.viewportScale)) : 100;
            c.viewportOpacity = typeof c.viewportOpacity === 'number' ? Math.min(1.0, Math.max(0.1, c.viewportOpacity)) : 0.95;

            if (c.isFolder) {
                if (!c.selectedSprite && c.availableSprites.length > 0) {
                    const neutral = findNeutralSprite(c.availableSprites);
                    c.selectedSprite = typeof neutral === 'string' ? neutral : (neutral?.fileName || neutral?.label || null);
                }
            } else {
                c.selectedSprite = null;
            }

            if (c.assetName) {
                c.avatarUrl = buildCharacterSpriteUrl(c.assetName, c.selectedSprite, c.isFolder);
            }
        }

        // 3. Card/Persona Avatar Sync Fallback
        if (!isExplicitlyUnsynced) {
            if (c.syncedCardType === 'Persona') {
                const liveName = ctx.name1 || window.name1;
                if (liveName && c.name !== liveName) {
                    c.name = liveName;
                }
                const rawUserAvatar = ctx.user_avatar || window.user_avatar || null;
                const cleanUserAvatar = (rawUserAvatar && typeof rawUserAvatar === 'string' && !isBase64Image(rawUserAvatar) && !['default.png', 'ghost.png', 'user.png', 'none', ''].includes(rawUserAvatar.trim().toLowerCase()))
                    ? rawUserAvatar.trim()
                    : null;

                c.syncedCardAvatar = cleanUserAvatar;
                if (!c.avatarUrl && cleanUserAvatar) {
                    c.avatarUrl = resolveSillyTavernAvatarUrl(cleanUserAvatar, 'Persona');
                }
            } else if (c.syncedCardType === 'Card' && c.syncedCardAvatar) {
                const matched = allChars.find(stChar => stChar.avatar === c.syncedCardAvatar);
                if (matched) {
                    if (c.name !== matched.name) {
                        c.name = matched.name;
                    }
                    if (!c.avatarUrl) {
                        c.avatarUrl = resolveSillyTavernAvatarUrl(matched.avatar, 'Card');
                    }
                } else if (!c.avatarUrl) {
                    c.avatarUrl = resolveSillyTavernAvatarUrl(c.syncedCardAvatar, 'Card') || null;
                }
            }
        }
    });

    return characters;
}

/**
 * Extracts and normalizes visual avatar and standee metadata from a source object with fallback.
 */
export function extractVisualMetadata(source = {}, fallback = {}) {
    return {
        assetName: source.assetName !== undefined ? source.assetName : (fallback.assetName || null),
        isFolder: source.isFolder !== undefined ? Boolean(source.isFolder) : (fallback.isFolder ?? true),
        enableExpression: source.enableExpression !== undefined ? Boolean(source.enableExpression) : (fallback.enableExpression ?? true),
        selectedSprite: source.selectedSprite !== undefined ? source.selectedSprite : (fallback.selectedSprite || null),
        availableSprites: Array.isArray(source.availableSprites) ? source.availableSprites : (fallback.availableSprites || []),
        cropOffset: source.cropOffset ? normalizeCropOffset(source.cropOffset) : (fallback.cropOffset ? normalizeCropOffset(fallback.cropOffset) : { x: 50, y: 50, zoom: 1 }),
        viewportScale: typeof source.viewportScale === 'number'
            ? Math.min(100, Math.max(20, source.viewportScale))
            : (typeof fallback.viewportScale === 'number' ? Math.min(100, Math.max(20, fallback.viewportScale)) : 100),
        viewportOpacity: typeof source.viewportOpacity === 'number'
            ? Math.min(1.0, Math.max(0.1, source.viewportOpacity))
            : (typeof fallback.viewportOpacity === 'number' ? Math.min(1.0, Math.max(0.1, fallback.viewportOpacity)) : 0.95)
    };
}
