function normalizeKeyword(keyword) {
  return String(keyword || "").trim().toLowerCase();
}

function matchDmTrigger(triggers, message) {
  const text = String(message || "").toLowerCase();
  if (!text || !Array.isArray(triggers)) return null;

  const candidates = triggers
    .filter((t) => t && normalizeKeyword(t.keyword))
    .sort((a, b) => normalizeKeyword(b.keyword).length - normalizeKeyword(a.keyword).length);

  return candidates.find((t) => text.includes(normalizeKeyword(t.keyword))) || null;
}

module.exports = { matchDmTrigger, normalizeKeyword };
