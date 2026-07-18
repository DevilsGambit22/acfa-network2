const DEFAULT_SETTINGS = {
  setupComplete: false,
  clubName: "",
  clubUrl: "",
  websiteUrl: "",
  discordUrl: "",
  twitchUrl: "",
  affiliateCode: "",
  signupUrl: "",
  upgradeUrl: "",
  defaultSignature: "",
  memberGoal: 250,
  animationMode: "cinematic",
  homeClubSlug: "",
  messageClubSlug: "",
  defaultMessageType: "announcement",
  primaryColor: "#262522",
  accentColor: "#b8df78",
  themePreset: "chess-classic",
  customLogoData: ""
};

const OWNER_EDITION_MIGRATION_KEY = "clubAssistantPublicV120Migrated";

export async function migrateClubOwnerEdition() {
  const state = await chrome.storage.local.get([OWNER_EDITION_MIGRATION_KEY, "managedClubs", "activeClubId", "settings"]);
  if (state[OWNER_EDITION_MIGRATION_KEY]) return;

  const clubs = Array.isArray(state.managedClubs) ? state.managedClubs : [];
  const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  await chrome.storage.local.set({
    managedClubs: clubs,
    activeClubId: clubs.some((club) => club.id === state.activeClubId) ? state.activeClubId : "",
    settings,
    [OWNER_EDITION_MIGRATION_KEY]: true
  });
}

export async function getSettings() {
  const savedData = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(savedData.settings ?? {}) };
}
export async function saveSettings(settings) { await chrome.storage.local.set({ settings }); }
export async function resetSettings() { await chrome.storage.local.set({ settings: DEFAULT_SETTINGS }); return { ...DEFAULT_SETTINGS }; }
export { DEFAULT_SETTINGS };
