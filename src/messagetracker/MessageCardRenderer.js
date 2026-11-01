/**
 * Common card container renderer, regex registry, and DOM injection manager for chat message trackers.
 * Handles unified CSS, item text formatting, shared regular expressions, and element resolution.
 */

// Shared Regular Expressions
export const RPGMT_TAG_REGEX = /(?:<!--|&lt;!--)?\s*(?:<|&lt;)rpgmt(?:>|&gt;)([\s\S]*?)(?:<|&lt;)\/rpgmt(?:>|&gt;)\s*(?:-->|--&gt;)?/i;
export const RPGMT_DIV_REGEX = /(?:<!--|&lt;!--)?\s*<div\s+class=["']?rpgmt-data["']?>([\s\S]*?)<\/div>\s*(?:-->|--&gt;)?/i;
export const RPGMT_TAG_GLOBAL_REGEX = /(?:\n\n)?(?:<!--|&lt;!--)?\s*(?:<|&lt;)rpgmt(?:>|&gt;)[\s\S]*?(?:<|&lt;)\/rpgmt(?:>|&gt;)\s*(?:-->|--&gt;)?/gi;
export const RPGMT_DIV_GLOBAL_REGEX = /(?:\n\n)?(?:<!--|&lt;!--)?\s*<div\s+class=["']?rpgmt-data["']?>[\s\S]*?<\/div>\s*(?:-->|--&gt;)?/gi;

export const RPG_DELTA_TAG_REGEX = /(?:<!--|&lt;!--)\s*RPG_DELTA:?([\s\S]*?)(?:-->|--&gt;)/i;
export const RPG_DELTA_TAG_GLOBAL_REGEX = /(?:\n\n)?(?:<!--|&lt;!--)\s*RPG_DELTA:?[\s\S]*?(?:-->|--&gt;)\s*/gi;
export const RPG_TRACKER_TAG_GLOBAL_REGEX = /(?:\n\n)?(?:<!--|&lt;!--)\s*RPG_TRACKER:?[\s\S]*?(?:-->|--&gt;)\s*/gi;

/**
 * Escapes HTML characters to prevent XSS and layout breakage.
 */
export function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


/**
 * Strips RPG Tracker comment tags from text while preserving regular message narrative.
 * @param {string} text - Source message text.
 * @param {Object} options - Cleanup options.
 * @param {boolean} options.stripDelta - Whether to also purge RPG_DELTA and RPG_TRACKER blocks.
 * @returns {string} Cleaned text content.
 */
export function cleanAllMessageTrackerTags(text, { stripDelta = true } = {}) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text
        .replace(RPGMT_TAG_GLOBAL_REGEX, '')
        .replace(RPGMT_DIV_GLOBAL_REGEX, '');

    if (stripDelta) {
        cleaned = cleaned
            .replace(RPG_DELTA_TAG_GLOBAL_REGEX, '')
            .replace(RPG_TRACKER_TAG_GLOBAL_REGEX, '');
    }

    return cleaned.trimEnd();
}

/**
 * Finds the jQuery DOM element of a chat message by index using robust multi-attribute fallback.
 * @param {number|string} index - Target message array index.
 * @returns {jQuery|null} Resolved jQuery element or empty jQuery collection.
 */
export function findChatMessageElement(index) {
    const $ = (typeof window !== 'undefined' && (window.$ || window.jQuery)) ? window.$ : null;
    if (!$) return null;

    const numericIndex = typeof index === 'number' ? index : parseInt(index, 10);
    if (isNaN(numericIndex) || numericIndex < 0) return $();

    let $msgEl = $(`#chat .mes[data-id="${numericIndex}"], #chat .mes_block[data-id="${numericIndex}"], #chat [data-id="${numericIndex}"], #chat [mesId="${numericIndex}"], #chat [mesid="${numericIndex}"]`).first();
    if ($msgEl.length === 0) {
        $msgEl = $('#chat').children('.mes, .sys_mes, .system_message, .mes_block').eq(numericIndex);
    }
    return $msgEl;
}

/**
 * Resolves chat message index from a clicked DOM message element.
 * @param {jQuery} $element - Message DOM element.
 * @param {Array<Object>} chatArray - SillyTavern active chat array.
 * @returns {number} Resolved array index or -1 if unresolved.
 */
export function resolveElementMessageIndex($element, chatArray) {
    if (!$element || $element.length === 0) return -1;

    const $ = (typeof window !== 'undefined' && (window.$ || window.jQuery)) ? window.$ : null;
    const $mesRoot = ($ && $element.closest('.mes, .sys_mes, .system_message').length)
        ? $element.closest('.mes, .sys_mes, .system_message')
        : $element;

    const liveMesId = $mesRoot.attr('mesId') || $mesRoot.attr('mesid') || $mesRoot.attr('data-id');
    const rawIdx = parseInt(liveMesId, 10);

    if (Array.isArray(chatArray) && !isNaN(rawIdx) && rawIdx >= 0 && rawIdx < chatArray.length) {
        return rawIdx;
    }
    if (Array.isArray(chatArray) && liveMesId !== undefined) {
        const found = chatArray.findIndex((_, idx) => String(idx) === String(liveMesId));
        if (found !== -1) return found;
    }

    if ($) {
        const domIndex = $('#chat').children('.mes, .sys_mes, .system_message').index($mesRoot);
        if (Array.isArray(chatArray) && domIndex >= 0 && domIndex < chatArray.length) {
            return domIndex;
        }
        const domIndexAll = $('#chat').children('.mes, .sys_mes, .system_message, .mes_block').index($mesRoot);
        if (Array.isArray(chatArray) && domIndexAll >= 0 && domIndexAll < chatArray.length) {
            return domIndexAll;
        }
    }

    return -1;
}

export const commonMessageCardStyles = `
<style id="rpg-message-card-styles">
.rpg-msg-card-container {
    margin-top: 10px;
    margin-right: 40px;
    border: 1px solid var(--rpg-border, rgba(255,255,255,0.15));
    border-radius: 6px;
    background: var(--rpg-bg, rgba(0,0,0,0.2));
    font-family: inherit;
    font-size: 0.95em; 
    width: calc(100% - 40px);
    max-width: calc(100% - 40px);
    box-sizing: border-box;
    overflow: hidden;
    clear: both;
    display: block;
}
.rpg-msg-card-header {
    padding: 8px 12px;
    background: rgba(0,0,0,0.1);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
    font-weight: bold;
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    border-bottom: 1px solid transparent;
    transition: background 0.2s, border-color 0.2s;
}
.rpg-msg-card-header:hover {
    background: rgba(255, 255, 255, 0.05);
}
.rpg-msg-card-header.active {
    border-color: var(--rpg-border, rgba(255,255,255,0.15));
    background: rgba(0,0,0,0.2);
}
.rpg-msg-card-header-title {
    display: flex;
    align-items: center;
    gap: 6px;
}
.rpg-msg-card-header-icon::after {
    content: '▼';
    font-size: 0.75em;
    opacity: 0.7;
    transition: transform 0.15s;
    display: inline-block;
}
.rpg-msg-card-header.active .rpg-msg-card-header-icon::after {
    transform: rotate(180deg);
}
.rpg-msg-card-content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(0,0,0,0.05);
}
.rpg-msg-card-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rpg-msg-card-section-title {
    font-weight: bold;
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    font-size: 1.05em; 
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 3px;
    margin-bottom: 4px;
}
.rpg-msg-card-sub-group {
    background: rgba(0,0,0,0.15);
    border-radius: 4px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 4px;
}
.rpg-msg-card-sub-title {
    font-size: 0.85em;
    font-weight: bold;
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.rpg-msg-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
}
.rpg-msg-card-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.rpg-msg-card-list li {
    padding-left: 2px;
    display: flex;
    font-size: 0.95em;
    line-height: 1.4;
}
.rpg-msg-card-key {
    opacity: 0.75;
    color: var(--rpg-text, inherit);
    font-weight: 500;
    margin-right: 4px;
    flex-shrink: 0;
}
.rpg-msg-card-val {
    color: var(--rpg-highlight, var(--rpg-text, inherit));
    font-weight: 500;
    flex: 1;
}
.rpg-msg-card-note {
    font-style: italic;
    opacity: 0.85;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 3px solid var(--rpg-highlight);
    border-radius: 4px;
    margin-top: 4px;
}
</style>
`;

/**
 * Formats inventory/asset items into displayable text.
 * Flags deleted items with quantity <= 0 as Deleted.
 */
export function formatCardItem(item) {
    if (!item) return '';
    if (typeof item !== 'object') return String(item);

    const name = item.name || 'Unknown';
    const isDeleted = item.quantity !== undefined && Number(item.quantity) <= 0;

    if (isDeleted) {
        return `${name}: Deleted`;
    }

    const type = item.type || 'general';
    let formatted = name;

    if (type === 'currency') {
        const qty = item.quantity !== undefined ? item.quantity : 0;
        formatted += ` (${qty})`;
    } else if (type === 'asset') {
        const amount = item.assetValue?.amount || 0;
        const currency = item.assetValue?.currencyName || 'Gold';
        formatted += ` [Asset: ${amount} ${currency}]`;
    } else {
        if (item.quantity && item.quantity > 1) {
            formatted += ` (x${item.quantity})`;
        }
    }

    if (item.isContainer) {
        formatted += ` [Container]`;
    }

    return formatted;
}

/**
 * Wraps generated section HTML inside collapsible card container.
 */
export function buildCardFrameHtml({ cardClass, title, iconSvg = '', contentHtml }) {
    if (!contentHtml || contentHtml.trim() === '') return '';

    return `
        <div class="rpg-msg-card-container ${cardClass}">
            <div class="rpg-msg-card-header">
                <span class="rpg-msg-card-header-title">${iconSvg} ${title}</span>
                <span class="rpg-msg-card-header-icon"></span>
            </div>
            <div class="rpg-msg-card-content" style="display: none;">
                ${contentHtml}
            </div>
        </div>
    `;
}

/**
 * Ensures shared CSS styles are injected into document head.
 */
export function ensureMessageCardStyles() {
    if ($('#rpg-message-card-styles').length === 0) {
        $('head').append(commonMessageCardStyles);
    }
}

/**
 * Registers click handler for all folding cards.
 */
export function registerMessageCardClickEvent() {
    $(document).off('click', '#chat .rpg-msg-card-header').on('click', '#chat .rpg-msg-card-header', function () {
        const $header = $(this);
        $header.next('.rpg-msg-card-content').slideToggle(150);
        $header.toggleClass('active');
    });
}