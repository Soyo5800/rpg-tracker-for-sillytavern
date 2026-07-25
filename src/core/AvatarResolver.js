// src/core/AvatarResolver.js
import { getThumbnailUrl } from "../../../../../../script.js";

/**
 * Resolves SillyTavern avatar filenames to accessible URLs.
 * Returns null for default/placeholder filenames to prevent console 404 errors.
 */
export function resolveSillyTavernAvatarUrl(avatarFile, type = 'Card') {
    if (!avatarFile || typeof avatarFile !== 'string') return null;
    if (avatarFile.startsWith('http://') || avatarFile.startsWith('https://') || avatarFile.startsWith('data:')) {
        return avatarFile;
    }

    let filename = String(avatarFile);
    if (filename.includes('/')) {
        filename = filename.split('/').pop();
    }

    try { filename = decodeURIComponent(filename); } catch (e) { }

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
        return `/characters/${encodeURIComponent(filename)}`;
    }

    if (type === 'Persona') {
        try {
            if (typeof getThumbnailUrl === 'function') {
                const url = getThumbnailUrl('persona', filename) || getThumbnailUrl('avatar', filename);
                if (url) return url;
            }
        } catch (e) {
            console.warn("[RPG Tracker] Native getThumbnailUrl call failed:", e);
        }

        if (!/\.[a-zA-Z0-9]{2,5}$/.test(filename)) {
            filename += '.png';
        }
        return `/api/images/avatars/${encodeURIComponent(filename)}`;
    }

    return null;
}