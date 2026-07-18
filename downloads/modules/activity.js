const ACTIVITY_KEY = "activityLog";
const MAX_ENTRIES = 500;

export async function getActivityLog(limit = MAX_ENTRIES) {
  const stored = await chrome.storage.local.get(ACTIVITY_KEY);
  const entries = Array.isArray(stored[ACTIVITY_KEY]) ? stored[ACTIVITY_KEY] : [];
  return entries.slice(0, Math.max(0, limit));
}

export async function logActivity(action, details = {}) {
  const entries = await getActivityLog();
  const now = Date.now();
  const entry = {
    id: crypto.randomUUID(),
    timestamp: now,
    occurredAt: new Date(now).toISOString(),
    action,
    entityType: details.entityType || "system",
    entityId: details.entityId || "",
    clubSlug: details.clubSlug || "",
    source: details.source || "extension",
    label: details.label || action,
    message: details.label || action,
    type: details.type || details.source || "system",
    metadata: details.metadata || {}
  };
  entries.unshift(entry);
  await chrome.storage.local.set({ [ACTIVITY_KEY]: entries.slice(0, MAX_ENTRIES) });
  return entry;
}

export { ACTIVITY_KEY };
