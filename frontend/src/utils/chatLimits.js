export const MAX_CHAT_LENGTH = 200;
export const MIN_CHAT_LENGTH = 1;
export const CHAT_COOLDOWN_MS = 2000;
export const MAX_CHAT_PER_MINUTE = 10;
export const MAX_IDENTICAL_MESSAGES = 3;
export const MAX_CHAT_HISTORY = 50;

const CONTROL_CHARS_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;
const MULTI_SPACE_RE = /\s+/g;

export function normalizeChatText(text) {
  return text.trim().replace(CONTROL_CHARS_RE, "").replace(MULTI_SPACE_RE, " ");
}

export function validateChatMessage(text, { lastSentAt = 0, sentTimestamps = [], recentTexts = [] } = {}) {
  const normalized = normalizeChatText(text);

  if (normalized.length < MIN_CHAT_LENGTH) {
    return { ok: false, error: "Message cannot be empty" };
  }
  if (normalized.length > MAX_CHAT_LENGTH) {
    return { ok: false, error: `Message is too long (max ${MAX_CHAT_LENGTH} characters)` };
  }

  const now = Date.now();
  if (lastSentAt && now - lastSentAt < CHAT_COOLDOWN_MS) {
    const waitSec = Math.ceil((CHAT_COOLDOWN_MS - (now - lastSentAt)) / 1000);
    return { ok: false, error: `Wait ${waitSec}s before sending another message` };
  }

  const recentMinute = sentTimestamps.filter((t) => now - t < 60_000);
  if (recentMinute.length >= MAX_CHAT_PER_MINUTE) {
    return { ok: false, error: "Message limit reached. Try again in a minute." };
  }

  const duplicates = [...recentTexts, normalized].slice(-MAX_IDENTICAL_MESSAGES);
  if (
    duplicates.length >= MAX_IDENTICAL_MESSAGES &&
    duplicates.every((t) => t === normalized)
  ) {
    return { ok: false, error: "Please do not repeat the same message" };
  }

  return { ok: true, text: normalized };
}

export function cooldownRemainingMs(lastSentAt) {
  if (!lastSentAt) return 0;
  return Math.max(0, CHAT_COOLDOWN_MS - (Date.now() - lastSentAt));
}
