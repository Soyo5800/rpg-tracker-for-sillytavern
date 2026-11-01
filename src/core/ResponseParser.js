/**
 * Decodes HTML special entities back to their original characters.
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Safely strips single-line (//) and multi-line (/* ... *\/) comments from a JSON-like string
 * while preserving comments and slashes within quoted string literals.
 */
export function stripJsonComments(str) {
  if (!str || typeof str !== 'string') return '';

  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (!inString) {
      if (char === '/' && str[i + 1] === '/') {
        i += 2;
        while (i < str.length && str[i] !== '\n' && str[i] !== '\r') {
          i++;
        }
        result += '\n';
        continue;
      }
      if (char === '/' && str[i + 1] === '*') {
        i += 2;
        while (i < str.length - 1 && !(str[i] === '*' && str[i + 1] === '/')) {
          i++;
        }
        i++;
        continue;
      }
    }

    result += char;
  }

  return result;
}

/**
 * Repairs incomplete, unclosed, or control-character-corrupted JSON strings into a valid JSON structure.
 * Strips comments, escapes raw newlines and tabs inside strings, and balances unclosed brackets.
 */
export function repairJson(jsonStr) {
  const decommented = stripJsonComments(jsonStr);
  let cleaned = decommented.trim();
  if (!cleaned) return "{}";

  let inString = false;
  let escaped = false;
  const stack = [];
  let repaired = "";

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      repaired += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      repaired += char;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        repaired += '\\n';
        continue;
      }
      if (char === '\r') {
        continue;
      }
      if (char === '\t') {
        repaired += '\\t';
        continue;
      }
      const charCode = char.charCodeAt(0);
      if (charCode < 0x20) {
        continue;
      }
    }

    repaired += char;

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    repaired += '"';
  }

  repaired = repaired.trim();
  while (repaired.length > 0 && /[,:\s]$/.test(repaired)) {
    repaired = repaired.slice(0, -1);
  }

  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
}

/**
 * Validates whether an extracted JSON object is a legitimate RPG Tracker patch.
 * Recognizes entity-level subkeys including dynamic expressions, emotions, and character names.
 */
export function isValidTrackerPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false;

  const topKeys = Object.keys(patch);
  if (topKeys.length === 0) return false;

  const lowerTopKeys = topKeys.map(k => k.toLowerCase());

  if (
    lowerTopKeys.includes('world') ||
    lowerTopKeys.includes('worldstate') ||
    lowerTopKeys.includes('characters')
  ) {
    return true;
  }

  const knownCharNames = new Set(
    (window.RPGBridge?.currentTrackerData?.characters || [])
      .map(c => (c.name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const trackerSubKeys = new Set([
    'status', 'stats', 'statusschema', 'profile', 'profilelocks', 'profileinjects',
    'relations', 'inventory', 'quests', 'activeplayer', 'activeinjection',
    'expression', 'emotion', 'mood'
  ]);

  for (const key of topKeys) {
    const val = patch[key];
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;

    const subKeys = Object.keys(val).map(k => k.toLowerCase());
    if (subKeys.some(k => trackerSubKeys.has(k))) {
      return true;
    }

    if (knownCharNames.has(key.trim().toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Scans string from a starting offset and extracts a balanced JSON object by counting brace depth.
 * Accurately handles string literals, escape sequences, JS comments, and token truncation.
 */
export function extractBalancedJson(text, startIndex = 0) {
  if (!text || typeof text !== 'string') return null;

  let firstBrace = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '/' && text[i + 1] === '/') {
        i += 2;
        while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
          i++;
        }
        continue;
      }

      if (char === '/' && text[i + 1] === '*') {
        i += 2;
        while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) {
          i++;
        }
        i++;
        continue;
      }

      if (char === '{') {
        if (depth === 0) {
          firstBrace = i;
        }
        depth++;
      } else if (char === '}') {
        if (depth > 0) {
          depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }
  }

  if (firstBrace !== -1 && endIndex !== -1) {
    return {
      rawJson: text.slice(firstBrace, endIndex + 1),
      startIndex: firstBrace,
      endIndex: endIndex,
      isTruncated: false
    };
  }

  if (firstBrace !== -1 && depth > 0) {
    return {
      rawJson: text.slice(firstBrace),
      startIndex: firstBrace,
      endIndex: text.length - 1,
      isTruncated: true
    };
  }

  return null;
}

/**
 * Extracts JSON patch from LLM response text and returns cleaned narrative text with the patch object.
 * Preserves the original narrative text formatting while parsing and repairing the isolated JSON payload.
 */
export function parseResponse(text) {
  if (!text || typeof text !== 'string') return { cleanedText: '', patch: null };

  const trackerCommentRegex = /(?:<!--|&lt;!--)\s*RPG_TRACKER:?[\s\S]*?(?:-->|--&gt;|$)/i;
  const trackerCommentMatch = text.match(trackerCommentRegex);

  if (trackerCommentMatch) {
    const commentStartIndex = trackerCommentMatch.index;
    const commentFullText = trackerCommentMatch[0];
    const commentEndIndex = commentStartIndex + commentFullText.length;

    const decodedComment = decodeHtmlEntities(commentFullText);
    const extracted = extractBalancedJson(decodedComment, 0);

    if (extracted) {
      try {
        const repairedString = repairJson(extracted.rawJson);
        const patch = JSON.parse(repairedString);

        const cleanedText = (text.slice(0, commentStartIndex) + text.slice(commentEndIndex)).trim();
        return { cleanedText, patch };
      } catch (e) {
        console.error("[RPG Tracker] Failed to parse JSON patch from tracker comment:", e);
      }
    }
  }

  const codeBlockHeaderRegex = /```(?:json|markdown)?/gi;
  let codeBlockMatch;

  while ((codeBlockMatch = codeBlockHeaderRegex.exec(text)) !== null) {
    const blockStartIndex = codeBlockMatch.index;
    const extracted = extractBalancedJson(text, blockStartIndex);

    if (extracted && extracted.startIndex > blockStartIndex) {
      try {
        const decodedJson = decodeHtmlEntities(extracted.rawJson);
        const repairedString = repairJson(decodedJson);
        const patch = JSON.parse(repairedString);

        if (isValidTrackerPatch(patch)) {
          const textAfterJson = text.slice(extracted.endIndex + 1);
          const closingBackticksMatch = textAfterJson.match(/^\s*```/);
          const blockEndIndex = extracted.endIndex + 1 + (closingBackticksMatch ? closingBackticksMatch[0].length : 0);

          const cleanedText = (text.slice(0, blockStartIndex) + text.slice(blockEndIndex)).trim();
          return { cleanedText, patch };
        }
      } catch (e) {
        // Continue scanning subsequent code blocks
      }

      codeBlockHeaderRegex.lastIndex = Math.max(codeBlockHeaderRegex.lastIndex, extracted.endIndex + 1);
    }
  }

  let searchIndex = 0;
  while (searchIndex < text.length) {
    const braceIndex = text.indexOf('{', searchIndex);
    if (braceIndex === -1) break;

    const extracted = extractBalancedJson(text, braceIndex);
    if (extracted) {
      try {
        const decodedJson = decodeHtmlEntities(extracted.rawJson);
        const repairedString = repairJson(decodedJson);
        const patch = JSON.parse(repairedString);

        if (isValidTrackerPatch(patch)) {
          const cleanedText = (text.slice(0, extracted.startIndex) + text.slice(extracted.endIndex + 1)).trim();
          return { cleanedText, patch };
        }
      } catch (e) {
        // Continue scanning
      }

      searchIndex = extracted.endIndex + 1;
    } else {
      searchIndex = braceIndex + 1;
    }
  }

  return { cleanedText: text, patch: null };
}