// src/core/ResponseParser.js

/**
 * HTML 특수 엔티티 문자를 안전하게 원본 기호로 디코딩
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 미완성되거나 중간에 끊긴 JSON 문자열을 보정하여 최대한 파싱 가능한 구조로.
 * 열린 따옴표, 중괄호, 대괄호를 역순으로 매칭하여 안전하게 닫아줌.
 */
export function repairJson(jsonStr) {
  let cleaned = jsonStr.trim();
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

  // 따옴표 내부에서 문자열이 잘렸을 때 따옴표 강제 종결
  if (inString) {
    repaired += '"';
  }

  // 닫는 중괄호/대괄호 직전 구조적 유효성을 저해하는 뒤처진 문자(쉼표, 콜론 등) 정리
  repaired = repaired.trim();
  while (repaired.length > 0 && /[,:\s]$/.test(repaired)) {
    repaired = repaired.slice(0, -1);
  }

  // 누적된 열린 괄호들을 역순으로 안전하게 폐합
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
}

/**
 * Extracts the JSON patch from the LLM response text and returns the cleaned text and the patch object.
 * @param {string} text - The raw response text from the LLM.
 * @returns {{ cleanedText: string, patch: object|null }}
 */
export function parseResponse(text) {
  if (!text) return { cleanedText: '', patch: null };

  const decodedText = decodeHtmlEntities(text);

  // 1순위: 마크다운 코드 블록 + 핵심 키워드가 포함된 경우 (인사말 무시, 텍스트 내 어디서든 추출)
  const jsonBlockRegex = /(?:\s*<!--(?:RPG_TRACKER)?\s*)?```(?:json|markdown)?\s*\n?(\{[\s\S]*?(?:"status"|"statusSchema"|"stats"|"profile"|"inventory"|"quests"|"Character Name"|"World"|"relations"|"events")[\s\S]*?\})\s*\n?```(?:\s*-->)?/i;
  const match = decodedText.match(jsonBlockRegex);

  if (match && match[1]) {
    try {
      const repairedString = repairJson(match[1]);
      const patch = JSON.parse(repairedString);
      const cleanedText = decodedText.replace(match[0], '').trim();
      return { cleanedText, patch };
    } catch (e) {
      console.error("[RPG Tracker] Failed to parse JSON patch from block:", e);
    }
  }

  // 2순위: 마크다운 없이 <!--RPG_TRACKER...--> HTML 주석으로만 감싸진 객체 (어디서든 추출)
  const commentRegex = /<!--(?:RPG_TRACKER)?\s*(\{[\s\S]*?\})\s*-->/i;
  const commentMatch = decodedText.match(commentRegex);

  if (commentMatch && commentMatch[1]) {
    try {
      const repairedString = repairJson(commentMatch[1]);
      const patch = JSON.parse(repairedString);
      const cleanedText = decodedText.replace(commentMatch[0], '').trim();
      return { cleanedText, patch };
    } catch (e) {
      console.error("[RPG Tracker] Failed to parse JSON patch from comment:", e);
    }
  }

  // 3순위: 마크다운도 주석도 없는 순수 객체 (매우 보수적으로 문장 맨 앞에 있을 때만 캐치)
  const rawJsonRegex = /^\s*(\{[\s\S]*?\})\s*(?=\n|$)/;
  const rawMatch = decodedText.match(rawJsonRegex);

  if (rawMatch && rawMatch[1]) {
    try {
      const repairedString = repairJson(rawMatch[1]);
      const patch = JSON.parse(repairedString);
      const cleanedText = decodedText.replace(rawMatch[0], '').trim();
      return { cleanedText, patch };
    } catch (e) { }
  }

  return { cleanedText: text, patch: null };
}