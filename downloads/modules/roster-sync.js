import { getSettings } from "./storage.js";
import { logActivity } from "./activity.js";

const MEMBER_STORAGE_KEY = "members";
const ROSTER_META_KEY = "rosterSyncMeta";
const CLUB_API_ROOT = "https://api.chess.com/pub/club";
const PLAYER_API_ROOT = "https://api.chess.com/pub/player";

function flattenRoster(payload) {
  const candidates = [];
  for (const value of Object.values(payload || {})) {
    if (Array.isArray(value)) candidates.push(...value);
  }
  const byUsername = new Map();
  for (const item of candidates) {
    const username = String(item?.username || "").trim();
    if (!username) continue;
    byUsername.set(username.toLowerCase(), { ...item, username });
  }
  return [...byUsername.values()];
}

async function getMembers() {
  const stored = await chrome.storage.local.get(MEMBER_STORAGE_KEY);
  return Array.isArray(stored[MEMBER_STORAGE_KEY]) ? stored[MEMBER_STORAGE_KEY] : [];
}

async function enrichProfile(username) {
  try {
    const response = await fetch(`${PLAYER_API_ROOT}/${encodeURIComponent(username)}`);
    if (!response.ok) return {};
    const profile = await response.json();
    return {
      avatar: profile.avatar || "",
      country: profile.country || "",
      title: profile.title || "",
      displayName: profile.name || "",
      profileUrl: profile.url || `https://www.chess.com/member/${encodeURIComponent(username)}`,
      followers: Number(profile.followers || 0),
      lastOnline: profile.last_online ? new Date(profile.last_online * 1000).toISOString() : ""
    };
  } catch {
    return {};
  }
}

export async function syncHomeClubRoster({ enrichLimit = 12 } = {}) {
  const settings = await getSettings();
  const slug = settings.homeClubSlug || "and-chess-for-all-official";
  const response = await fetch(`${CLUB_API_ROOT}/${encodeURIComponent(slug)}/members`);
  if (!response.ok) throw new Error(`Chess.com roster request failed (${response.status}).`);
  const roster = flattenRoster(await response.json());
  const existing = await getMembers();
  const existingMap = new Map(existing.map((member) => [String(member.username || "").toLowerCase(), member]));
  const rosterNames = new Set(roster.map((item) => item.username.toLowerCase()));
  const now = new Date().toISOString();
  let added = 0;
  let returning = 0;

  const merged = [];
  for (let index = 0; index < roster.length; index += 1) {
    const apiMember = roster[index];
    const key = apiMember.username.toLowerCase();
    const old = existingMap.get(key);
    const enrichment = index < enrichLimit ? await enrichProfile(apiMember.username) : {};
    if (!old) added += 1;
    if (old?.membershipStatus === "former") returning += 1;
    merged.push({
      id: old?.id || crypto.randomUUID(),
      username: apiMember.username,
      displayName: old?.displayName || enrichment.displayName || "",
      role: old?.role || (enrichment.title ? "titled-player" : "member"),
      activity: old?.activity || "active",
      clubs: Array.from(new Set([...(Array.isArray(old?.clubs) ? old.clubs : []), settings.clubName || "My Club"])),
      joinDate: old?.joinDate || (apiMember.joined ? new Date(apiMember.joined * 1000).toISOString().slice(0, 10) : ""),
      lastInteraction: old?.lastInteraction || "",
      tags: old?.tags || "",
      notes: old?.notes || "",
      streamParticipant: Boolean(old?.streamParticipant),
      eventParticipant: Boolean(old?.eventParticipant),
      spotlightStatus: old?.spotlightStatus || "not-featured",
      recognitionHistory: old?.recognitionHistory || "",
      dateAdded: old?.dateAdded || now,
      updatedAt: now,
      membershipStatus: "active",
      rosterSource: slug,
      lastRosterSync: now,
      publicData: {
        ...(old?.publicData || {}),
        username: apiMember.username,
        joined: apiMember.joined || null,
        profileUrl: enrichment.profileUrl || old?.publicData?.profileUrl || `https://www.chess.com/member/${encodeURIComponent(apiMember.username)}`,
        avatar: enrichment.avatar || old?.publicData?.avatar || "",
        country: enrichment.country || old?.publicData?.country || "",
        title: enrichment.title || old?.publicData?.title || "",
        followers: enrichment.followers ?? old?.publicData?.followers ?? 0,
        lastOnline: enrichment.lastOnline || old?.publicData?.lastOnline || ""
      }
    });
  }

  let departed = 0;
  for (const member of existing) {
    const key = String(member.username || "").toLowerCase();
    if (!key || rosterNames.has(key)) continue;
    if (member.rosterSource === slug || (Array.isArray(member.clubs) && member.clubs.includes(settings.clubName || "My Club"))) {
      if (member.membershipStatus !== "former") departed += 1;
      merged.push({ ...member, membershipStatus: "former", leftDetectedAt: member.leftDetectedAt || now, updatedAt: now });
    } else {
      merged.push(member);
    }
  }

  await chrome.storage.local.set({
    [MEMBER_STORAGE_KEY]: merged,
    [ROSTER_META_KEY]: { slug, count: roster.length, added, departed, returning, syncedAt: now }
  });
  await logActivity("roster_synced", {
    entityType: "club",
    entityId: slug,
    clubSlug: slug,
    source: "pubapi",
    label: `Roster synchronized: ${roster.length} active members`,
    metadata: { added, departed, returning }
  });
  return { count: roster.length, added, departed, returning, syncedAt: now };
}

export async function getRosterMeta() {
  const stored = await chrome.storage.local.get(ROSTER_META_KEY);
  return stored[ROSTER_META_KEY] || null;
}
