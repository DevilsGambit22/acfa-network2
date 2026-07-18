import { loadAndApplyTheme } from "../theme.js";
import { logActivity, getActivityLog } from "../activity.js";
import { getTemplates } from "../templates.js";

await loadAndApplyTheme();

const PROSPECT_STORAGE_KEY = "prospects";
const MEMBER_STORAGE_KEY = "members";
const CLUB_STORAGE_KEY = "managedClubs";
const ACTIVE_CLUB_KEY = "activeClubId";
const HOME_CLUB_SLUG = "";

const connectionBadge = document.querySelector("#connectionBadge");
const pageType = document.querySelector("#pageType");
const pageUrl = document.querySelector("#pageUrl");
const playerSection = document.querySelector("#playerSection");
const unsupportedSection = document.querySelector("#unsupportedSection");
const playerProfileLink = document.querySelector("#playerProfileLink");
const prospectStatus = document.querySelector("#prospectStatus");
const memberStatus = document.querySelector("#memberStatus");
const addProspectButton = document.querySelector("#addProspectButton");
const addMemberButton = document.querySelector("#addMemberButton");
const draftInvitationButton = document.querySelector("#draftInvitationButton");
const draftFollowUpButton = document.querySelector("#draftFollowUpButton");
const addPlayerNoteButton = document.querySelector("#addPlayerNoteButton");
const viewTimelineButton = document.querySelector("#viewTimelineButton");
const playerRecommendation = document.querySelector("#playerRecommendation");
const clubSection = document.querySelector("#clubSection");
const activeClubName = document.querySelector("#activeClubName");
const activeClubSlug = document.querySelector("#activeClubSlug");
const clubRelationshipBadge = document.querySelector("#clubRelationshipBadge");
const copyClubLinkButton = document.querySelector("#copyClubLinkButton");
const openClubButton = document.querySelector("#openClubButton");
const addPartnerClubButton = document.querySelector("#addPartnerClubButton");
const openClubManagerButton = document.querySelector("#openClubManagerButton");
const openDashboardButton = document.querySelector("#openDashboardButton");
const openMessageBuilderButton = document.querySelector("#openMessageBuilderButton");
const sidebarStatus = document.querySelector("#sidebarStatus");
const sidebarMessageClub = document.querySelector("#sidebarMessageClub");
const sidebarMessageType = document.querySelector("#sidebarMessageType");
const sidebarMessageTitle = document.querySelector("#sidebarMessageTitle");
const sidebarMessageBody = document.querySelector("#sidebarMessageBody");
const copySidebarHtml = document.querySelector("#copySidebarHtml");
const copySidebarPlain = document.querySelector("#copySidebarPlain");
const firstRunSetupCard = document.querySelector("#firstRunSetupCard");
const startSetupButton = document.querySelector("#startSetupButton");
const sidebarTemplateSelect = document.querySelector("#sidebarTemplateSelect");
const sidebarTemplatePreview = document.querySelector("#sidebarTemplatePreview");
const useTemplateButton = document.querySelector("#useTemplateButton");
const openTemplatesButton = document.querySelector("#openTemplatesButton");
const refreshTemplatesButton = document.querySelector("#refreshTemplatesButton");

let currentUsername = "";
let currentProfileUrl = "";
let currentClubContext = null;
let lastObservedUrl = "";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function initializeQuickBuilder() {
  const result = await chrome.storage.local.get([CLUB_STORAGE_KEY, "settings"]);
  const clubs = Array.isArray(result[CLUB_STORAGE_KEY]) ? result[CLUB_STORAGE_KEY] : [];
  const settings = result.settings || {};
  const homeSlug = settings.messageClubSlug || settings.homeClubSlug || HOME_CLUB_SLUG;
  sidebarMessageClub.innerHTML = clubs.map((club) => `<option value="${escapeHtml(club.slug)}">${escapeHtml(club.name)}${club.slug === settings.homeClubSlug ? " (Home)" : ""}</option>`).join("");
  sidebarMessageClub.value = clubs.some((club) => club.slug === homeSlug) ? homeSlug : HOME_CLUB_SLUG;
  sidebarMessageType.value = settings.defaultMessageType || "announcement";
  sidebarMessageTitle.value = `${settings.clubName || "Club"} Community Update`;
}

async function initializeFirstRunExperience() {
  const result = await chrome.storage.local.get("settings");
  const setupComplete = Boolean(result.settings?.setupComplete);
  firstRunSetupCard.hidden = setupComplete;
  document.querySelectorAll(".sidebar-tool-card").forEach((card) => {
    card.classList.toggle("setup-locked", !setupComplete);
    card.setAttribute("aria-hidden", String(!setupComplete));
  });
}

async function initializeTemplateDock() {
  const templates = await getTemplates();
  sidebarTemplateSelect.innerHTML = templates.map((template) =>
    `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)} — ${escapeHtml(template.category || "Custom")}</option>`
  ).join("");
  renderTemplatePreview(templates);
}

async function renderTemplatePreview(preloadedTemplates = null) {
  const templates = preloadedTemplates || await getTemplates();
  const selected = templates.find((template) => template.id === sidebarTemplateSelect.value);
  if (!selected) {
    sidebarTemplatePreview.textContent = "No templates are available yet.";
    useTemplateButton.disabled = true;
    return;
  }
  useTemplateButton.disabled = false;
  sidebarTemplatePreview.innerHTML = `<strong>${escapeHtml(selected.title || selected.name)}</strong><span>${escapeHtml(String(selected.body || "").slice(0, 180))}${String(selected.body || "").length > 180 ? "…" : ""}</span>`;
}

async function useSelectedTemplate() {
  const templates = await getTemplates();
  const selected = templates.find((template) => template.id === sidebarTemplateSelect.value);
  if (!selected) return showStatus("Choose a template first.", true);
  const result = await chrome.storage.local.get("settings");
  const clubName = result.settings?.clubName || "your club";
  sidebarMessageType.value = selected.messageType || "announcement";
  sidebarMessageTitle.value = String(selected.title || selected.name || "").replaceAll("{club_name}", clubName);
  sidebarMessageBody.value = String(selected.body || "").replaceAll("{club_name}", clubName);
  document.querySelector(".compact-builder-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  showStatus(`Loaded template: ${selected.name}`);
}

async function buildSidebarMessage(htmlMode) {
  const clubs = await getStoredArray(CLUB_STORAGE_KEY);
  const result = await chrome.storage.local.get("settings");
  const settings = result.settings || {};
  const club = clubs.find((item) => item.slug === sidebarMessageClub.value) || clubs.find((item) => item.slug === HOME_CLUB_SLUG) || {};
  const name = club.name || settings.clubName || "My Club";
  const url = club.affiliateUrl || club.clubUrl || settings.clubUrl || "";
  const discordUrl = club.discordUrl || settings.discordUrl || "";
  const twitchUrl = club.twitchUrl || settings.twitchUrl || "";
  const title = sidebarMessageTitle.value.trim();
  const body = sidebarMessageBody.value.trim();
  const type = sidebarMessageType.options[sidebarMessageType.selectedIndex]?.text || "Message";
  const signature = club.messageFooter || settings.defaultSignature || "Every Player Belongs • Every Move Matters.";
  const creatorCredit = "Professional Club Management Suite";
  if (!title || !body) throw new Error("Add a title and message first.");

  if (!htmlMode) {
    const links = [
      url ? `Join ${name}: ${url}` : "",
      discordUrl ? `Discord: ${discordUrl}` : "",
      twitchUrl ? `Twitch: ${twitchUrl}` : ""
    ].filter(Boolean).join("\n");
    return `${name} — ${type}\n\n${title}\n\n${body}${links ? `\n\n${links}` : ""}\n\n${signature}\n\n${creatorCredit}`;
  }

  const safeAccent = escapeHtml(club.accentColor || "#d6a84b");
  const safePrimary = escapeHtml(club.primaryColor || "#0b0906");
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replaceAll("\n", "<br>");
  const safeSignature = escapeHtml(signature);

  const button = (href, label, background, foreground) => {
    if (!href) return "";
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 10px;border-collapse:separate"><tr><td align="center" style="border:1px solid ${safeAccent};border-radius:999px;background:${background};padding:0"><a href="${escapeHtml(href)}" style="display:block;padding:13px 18px;border-radius:999px;color:${foreground};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;line-height:1.2;text-align:center;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
  };

  const buttons = [
    button(url, `Join ${name}`, safeAccent, "#160f05"),
    button(discordUrl, "Join Discord", "#5865F2", "#ffffff"),
    button(twitchUrl, "Watch on Twitch", "#9146FF", "#ffffff")
  ].filter(Boolean).join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px;margin:20px auto;border:3px solid ${safeAccent};border-radius:24px;border-collapse:separate;background:${safePrimary};color:#f8eed8;font-family:Arial,Helvetica,sans-serif;text-align:center"><tr><td style="overflow:hidden;border-radius:20px;background:${safePrimary}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate"><tr><td style="padding:14px 18px;border-radius:19px 19px 0 0;background:${safeAccent};color:#160f05;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">${safeName} • ${escapeHtml(type)}</td></tr><tr><td style="padding:28px 22px 24px;border-radius:0 0 19px 19px;background:${safePrimary}"><marquee behavior="alternate" direction="left" scrollamount="3" scrolldelay="45" style="display:block;margin:0 0 14px;color:${safeAccent};font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase">${safeSignature} &nbsp; ♛ &nbsp; ${safeName} &nbsp; ♛ &nbsp; ${safeSignature}</marquee><h2 style="margin:0 0 14px;color:#fff4d2;font-size:25px;line-height:1.25">${safeTitle}</h2><div style="margin:0 auto 20px;max-width:620px;color:#f4ead4;font-size:16px;line-height:1.65">${safeBody}</div><div style="width:100%;max-width:390px;margin:0 auto 14px">${buttons}</div><div style="margin-top:18px;padding-top:14px;border-top:1px solid ${safeAccent};color:#9f8d67;font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase">${creatorCredit}</div></td></tr></table></td></tr></table>`;
}

async function copyFormattedHtml(html, plainText) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" })
    });
    await navigator.clipboard.write([item]);
    return;
  }

  const staging = document.createElement("div");
  staging.contentEditable = "true";
  staging.setAttribute("aria-hidden", "true");
  staging.style.cssText = "position:fixed;left:-10000px;top:0;width:720px;opacity:0;pointer-events:none";
  staging.innerHTML = html;
  document.body.appendChild(staging);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(staging);
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  staging.remove();

  if (!copied) throw new Error("Formatted clipboard access is unavailable.");
}

async function copyQuickMessage(htmlMode) {
  try {
    const output = await buildSidebarMessage(htmlMode);
    if (htmlMode) {
      const plainText = await buildSidebarMessage(false);
      await copyFormattedHtml(output, plainText);
    } else {
      await navigator.clipboard.writeText(output);
    }
    await logActivity(htmlMode ? "html_message_copied" : "plain_text_message_copied", {
      entityType: currentUsername ? "player" : "club",
      entityId: currentUsername || sidebarMessageClub.value,
      clubSlug: sidebarMessageClub.value,
      source: "sidepanel",
      label: `${htmlMode ? "HTML" : "Plain text"} ${sidebarMessageType.value} copied`
    });
    showStatus(htmlMode ? "Formatted HTML copied. Paste directly into Chess.com." : "Plain text copied.");
  } catch (error) {
    showStatus(error.message, true);
  }
}

function showStatus(message, isError = false) {
  sidebarStatus.textContent = message;
  sidebarStatus.classList.toggle("error", isError);
  window.setTimeout(() => {
    sidebarStatus.textContent = "";
    sidebarStatus.classList.remove("error");
  }, 3000);
}

function parseChessContext(urlValue) {
  try {
    const url = new URL(urlValue);
    if (!["www.chess.com", "chess.com"].includes(url.hostname)) {
      return { type: "external", label: "Not a Chess.com page", url: urlValue };
    }

    const memberMatch = url.pathname.match(/^\/member\/([^/?#]+)/i);
    if (memberMatch) {
      return {
        type: "member",
        label: "Member Profile",
        username: decodeURIComponent(memberMatch[1]),
        url: url.href
      };
    }

    const clubMatch = url.pathname.match(/^\/club\/([^/?#]+)/i);
    if (clubMatch) {
      return {
        type: "club",
        label: "Club Page",
        slug: decodeURIComponent(clubMatch[1]).toLowerCase(),
        clubUrl: `${url.origin}/club/${encodeURIComponent(decodeURIComponent(clubMatch[1]))}`,
        url: url.href
      };
    }

    const path = url.pathname.toLowerCase();
    if (path.includes("/forums/")) return { type: "forum", label: "Forum Page", url: url.href };
    if (path.startsWith("/play/")) return { type: "play", label: "Play Page", url: url.href };
    if (path.includes("/game/")) return { type: "game", label: "Game Page", url: url.href };
    return { type: "chess", label: "Chess.com Page", url: url.href };
  } catch {
    return { type: "unknown", label: "Unknown Page", url: urlValue };
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function getStoredArray(key) {
  const result = await chrome.storage.local.get(key);
  return Array.isArray(result[key]) ? result[key] : [];
}

async function playerExists(storageKey, username) {
  const records = await getStoredArray(storageKey);
  return records.some((record) => String(record.username ?? "").toLowerCase() === username.toLowerCase());
}

async function updatePlayerStatuses() {
  if (!currentUsername) return;
  const [isProspect, isMember] = await Promise.all([
    playerExists(PROSPECT_STORAGE_KEY, currentUsername),
    playerExists(MEMBER_STORAGE_KEY, currentUsername)
  ]);
  prospectStatus.textContent = isProspect ? "Saved" : "Not Saved";
  memberStatus.textContent = isMember ? "Saved" : "Not Saved";
  const activity = (await getActivityLog()).filter((entry) => String(entry.entityId || "").toLowerCase() === currentUsername.toLowerCase());
  const last = activity[0];
  playerRecommendation.textContent = isMember
    ? `Home-club member${last ? ` • Last interaction ${new Date(last.timestamp).toLocaleDateString()}` : ""}`
    : isProspect
      ? `Prospect tracked${last ? ` • Last interaction ${new Date(last.timestamp).toLocaleDateString()}` : ""}`
      : "New player detected • Recommended action: Draft Invitation";
  addProspectButton.disabled = isProspect;
  addMemberButton.disabled = isMember;
  addProspectButton.textContent = isProspect ? "Prospect Saved" : "Add Prospect";
  addMemberButton.textContent = isMember ? "Member Saved" : "Add Member";
}

async function resolveClubName(slug) {
  try {
    const response = await fetch(`https://api.chess.com/pub/club/${encodeURIComponent(slug)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.name || slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  } catch {
    return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
}

async function renderCurrentClub(slug, clubUrl) {
  const clubs = await getStoredArray(CLUB_STORAGE_KEY);
  const savedClub = clubs.find((club) =>
    String(club.slug ?? "").toLowerCase() === slug ||
    String(club.clubUrl ?? "").toLowerCase().includes(`/club/${slug}`)
  );
  const name = savedClub?.name || await resolveClubName(slug);
  const relationship = slug === HOME_CLUB_SLUG
    ? "home"
    : savedClub?.clubType === "partner"
      ? "partner"
      : savedClub
        ? "saved"
        : "new";

  currentClubContext = {
    id: savedClub?.id || "",
    name,
    slug,
    clubUrl: savedClub?.clubUrl || clubUrl,
    affiliateUrl: savedClub?.affiliateUrl || "",
    clubType: savedClub?.clubType || "",
    relationship
  };

  clubSection.hidden = false;
  activeClubName.textContent = name;
  activeClubSlug.textContent = `chess.com/club/${slug}`;
  clubRelationshipBadge.className = `relationship-badge ${relationship}`;
  clubRelationshipBadge.textContent = {
    home: "Home Club",
    partner: "Partner",
    saved: "Saved Club",
    new: "New Club"
  }[relationship];

  const isPartner = relationship === "partner";
  const isHome = relationship === "home";
  addPartnerClubButton.hidden = isPartner || isHome;
  addPartnerClubButton.disabled = false;
  addPartnerClubButton.textContent = relationship === "saved" ? "Mark as Partner" : "Add as Partner";
  copyClubLinkButton.disabled = false;
  openClubButton.disabled = false;
}

function clearClubContext() {
  currentClubContext = null;
  clubSection.hidden = true;
}

async function refreshCurrentPage() {
  const activeTab = await getActiveTab();
  if (!activeTab?.url) {
    connectionBadge.textContent = "Unavailable";
    connectionBadge.className = "connection-badge disconnected";
    pageType.textContent = "No active browser page found.";
    clearClubContext();
    return;
  }

  lastObservedUrl = activeTab.url;
  const context = parseChessContext(activeTab.url);
  const isChessCom = context.type !== "external" && context.type !== "unknown";
  connectionBadge.textContent = isChessCom ? "Connected" : "Not Connected";
  connectionBadge.className = isChessCom ? "connection-badge connected" : "connection-badge disconnected";
  pageType.textContent = context.label;
  pageUrl.textContent = activeTab.url;

  currentUsername = context.type === "member" ? context.username : "";
  currentProfileUrl = currentUsername ? `https://www.chess.com/member/${encodeURIComponent(currentUsername)}` : "";

  if (currentUsername) {
    playerSection.hidden = false;
    unsupportedSection.hidden = true;
    playerProfileLink.textContent = `@${currentUsername}`;
    playerProfileLink.href = currentProfileUrl;
    await updatePlayerStatuses();
  } else {
    playerSection.hidden = true;
    unsupportedSection.hidden = context.type === "club";
  }

  if (context.type === "club") {
    await renderCurrentClub(context.slug, context.clubUrl);
  } else {
    clearClubContext();
  }
}

async function addCurrentProspect() {
  if (!currentUsername) return showStatus("Open a Chess.com member profile first.", true);
  const prospects = await getStoredArray(PROSPECT_STORAGE_KEY);
  if (prospects.some((p) => String(p.username ?? "").toLowerCase() === currentUsername.toLowerCase())) {
    showStatus("Prospect is already saved.");
    return updatePlayerStatuses();
  }
  prospects.unshift({
    id: crypto.randomUUID(), username: currentUsername, displayName: "", status: "not-contacted",
    priority: 3, tags: "", notes: "", dateAdded: new Date().toISOString(), lastContact: "",
    updatedAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ [PROSPECT_STORAGE_KEY]: prospects });
  await logActivity("prospect_added", { entityType: "player", entityId: currentUsername, source: "sidepanel", label: `@${currentUsername} added as a prospect` });
  showStatus(`@${currentUsername} added as a prospect.`);
  await updatePlayerStatuses();
}

async function addCurrentMember() {
  if (!currentUsername) return showStatus("Open a Chess.com member profile first.", true);
  const members = await getStoredArray(MEMBER_STORAGE_KEY);
  if (members.some((m) => String(m.username ?? "").toLowerCase() === currentUsername.toLowerCase())) {
    showStatus("Member is already saved.");
    return updatePlayerStatuses();
  }
  members.unshift({
    id: crypto.randomUUID(), username: currentUsername, displayName: "", role: "member",
    activity: "active", clubs: currentClubContext?.name ? [currentClubContext.name] : [], joinDate: "",
    lastInteraction: "", tags: "", notes: "", streamParticipant: false, eventParticipant: false,
    spotlightStatus: "not-featured", recognitionHistory: "", dateAdded: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ [MEMBER_STORAGE_KEY]: members });
  await logActivity("member_added", { entityType: "player", entityId: currentUsername, source: "sidepanel", label: `@${currentUsername} added as a member` });
  showStatus(`@${currentUsername} added as a member.`);
  await updatePlayerStatuses();
}

async function addOrMarkPartnerClub() {
  if (!currentClubContext) return showStatus("Open a Chess.com club page first.", true);
  const clubs = await getStoredArray(CLUB_STORAGE_KEY);
  const existingIndex = clubs.findIndex((club) =>
    String(club.slug ?? "").toLowerCase() === currentClubContext.slug ||
    String(club.clubUrl ?? "").toLowerCase().includes(`/club/${currentClubContext.slug}`)
  );
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    clubs[existingIndex] = { ...clubs[existingIndex], clubType: "partner", status: "active", updatedAt: now };
  } else {
    clubs.unshift({
      id: crypto.randomUUID(),
      name: currentClubContext.name,
      slug: currentClubContext.slug,
      clubUrl: currentClubContext.clubUrl,
      affiliateUrl: "",
      clubType: "partner",
      status: "active",
      websiteUrl: "",
      discordUrl: "",
      twitchUrl: "",
      primaryColor: "#0b0906",
      accentColor: "#d6a84b",
      messageFooter: "",
      contactName: "",
      notes: "Added from the club-owner sidebar.",
      dateAdded: now,
      updatedAt: now
    });
  }

  await chrome.storage.local.set({ [CLUB_STORAGE_KEY]: clubs });
  await logActivity("partner_club_saved", { entityType: "club", entityId: currentClubContext.slug, clubSlug: currentClubContext.slug, source: "sidepanel", label: `${currentClubContext.name} saved as a partner club` });
  showStatus(`${currentClubContext.name} saved as a partner club.`);
  await renderCurrentClub(currentClubContext.slug, currentClubContext.clubUrl);
}

async function copyCurrentClubLink() {
  const link = currentClubContext?.affiliateUrl || currentClubContext?.clubUrl || "";
  if (!link) return showStatus("No current club link is available.", true);
  await navigator.clipboard.writeText(link);
  showStatus("Current club link copied.");
}

async function openCurrentClub() {
  const link = currentClubContext?.affiliateUrl || currentClubContext?.clubUrl || "";
  if (!link) return showStatus("No current club link is available.", true);
  await chrome.tabs.create({ url: link });
}

async function draftForPlayer(kind) {
  const result = await chrome.storage.local.get("settings");
  const settings = result.settings || {};
  if (!currentUsername) return showStatus("Open a Chess.com member profile first.", true);
  sidebarMessageType.value = kind === "invitation" ? "invitation" : "message";
  sidebarMessageTitle.value = kind === "invitation" ? `You’re Invited to ${settings.clubName || "Our Club"}, @${currentUsername}` : `Following Up, @${currentUsername}`;
  sidebarMessageBody.value = kind === "invitation"
    ? `Hello @${currentUsername}! I’d like to personally invite you to join ${settings.clubName || "our club"}. We are building a welcoming community where players of every rating can play, improve, and connect.`
    : `Hello @${currentUsername}! I wanted to follow up on the invitation to ${settings.clubName || "our club"}. There is no pressure—we would simply be glad to welcome you if the community feels like a good fit.`;
  await logActivity(kind === "invitation" ? "invitation_drafted" : "follow_up_drafted", { entityType: "player", entityId: currentUsername, source: "sidepanel", label: `${kind === "invitation" ? "Invitation" : "Follow-up"} drafted for @${currentUsername}` });
  showStatus(`${kind === "invitation" ? "Invitation" : "Follow-up"} loaded in Quick Message Builder.`);
}

async function addPlayerNote() {
  if (!currentUsername) return showStatus("Open a Chess.com member profile first.", true);
  const note = window.prompt(`Add an internal note for @${currentUsername}:`);
  if (!note?.trim()) return;
  const [members, prospects] = await Promise.all([getStoredArray(MEMBER_STORAGE_KEY), getStoredArray(PROSPECT_STORAGE_KEY)]);
  let updated = false;
  for (const records of [members, prospects]) {
    const record = records.find((item) => String(item.username || "").toLowerCase() === currentUsername.toLowerCase());
    if (record) {
      record.notes = [record.notes, `[${new Date().toLocaleDateString()}] ${note.trim()}`].filter(Boolean).join("\n");
      record.updatedAt = new Date().toISOString();
      updated = true;
    }
  }
  if (!updated) return showStatus("Save the player as a prospect or member before adding notes.", true);
  await chrome.storage.local.set({ [MEMBER_STORAGE_KEY]: members, [PROSPECT_STORAGE_KEY]: prospects });
  await logActivity("note_added", { entityType: "player", entityId: currentUsername, source: "sidepanel", label: `Note added for @${currentUsername}`, metadata: { note: note.trim() } });
  showStatus(`Note added for @${currentUsername}.`);
}

async function viewPlayerTimeline() {
  if (!currentUsername) return showStatus("Open a Chess.com member profile first.", true);
  const entries = (await getActivityLog()).filter((entry) => String(entry.entityId || "").toLowerCase() === currentUsername.toLowerCase()).slice(0, 8);
  window.alert(entries.length ? entries.map((entry) => `${new Date(entry.timestamp).toLocaleString()} — ${entry.label}`).join("\n") : `No recorded interactions for @${currentUsername}.`);
}

async function openDashboard(section = "") {
  const sectionQuery = section ? `?section=${encodeURIComponent(section)}` : "";
  await chrome.tabs.create({ url: chrome.runtime.getURL(`pages/dashboard.html${sectionQuery}`) });
}

addProspectButton.addEventListener("click", addCurrentProspect);
addMemberButton.addEventListener("click", addCurrentMember);
draftInvitationButton.addEventListener("click", () => draftForPlayer("invitation"));
draftFollowUpButton.addEventListener("click", () => draftForPlayer("follow-up"));
addPlayerNoteButton.addEventListener("click", addPlayerNote);
viewTimelineButton.addEventListener("click", viewPlayerTimeline);
copyClubLinkButton.addEventListener("click", copyCurrentClubLink);
openClubButton.addEventListener("click", openCurrentClub);
addPartnerClubButton.addEventListener("click", addOrMarkPartnerClub);
openClubManagerButton.addEventListener("click", () => openDashboard("clubs"));
openDashboardButton.addEventListener("click", () => openDashboard());
openMessageBuilderButton.addEventListener("click", () => openDashboard("message-builder"));
startSetupButton.addEventListener("click", () => openDashboard("dashboard"));
sidebarTemplateSelect.addEventListener("change", () => renderTemplatePreview());
useTemplateButton.addEventListener("click", useSelectedTemplate);
openTemplatesButton.addEventListener("click", () => openDashboard("templates"));
refreshTemplatesButton.addEventListener("click", async () => { await initializeTemplateDock(); showStatus("Templates refreshed."); });
copySidebarHtml.addEventListener("click", () => copyQuickMessage(true));
copySidebarPlain.addEventListener("click", () => copyQuickMessage(false));

chrome.tabs.onActivated.addListener(refreshCurrentPage);
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === "complete")) {
    await refreshCurrentPage();
  }
});
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[CLUB_STORAGE_KEY] && currentClubContext) {
    await renderCurrentClub(currentClubContext.slug, currentClubContext.clubUrl);
  }
  if (changes[PROSPECT_STORAGE_KEY] || changes[MEMBER_STORAGE_KEY]) await updatePlayerStatuses();
  if (changes.settings) await initializeFirstRunExperience();
  if (changes.messageTemplates) await initializeTemplateDock();
});

window.setInterval(async () => {
  const tab = await getActiveTab();
  if (tab?.url && tab.url !== lastObservedUrl) {
    await refreshCurrentPage();
  }
}, 1000);

await initializeFirstRunExperience();
await initializeQuickBuilder();
await initializeTemplateDock();
await refreshCurrentPage();

(function installCreatorEasterEgg() {
  let clickCount = 0;
  let resetTimer = null;
  let closeTimer = null;
  let isClosing = false;

  function closeOverlay() {
    const overlay = document.querySelector(".ca-easter-overlay");
    if (!overlay || isClosing) return;

    isClosing = true;
    clearTimeout(closeTimer);
    overlay.classList.add("is-closing");

    window.setTimeout(() => {
      overlay.remove();
      isClosing = false;
    }, 1250);
  }

  function openOverlay() {
    document.querySelector(".ca-easter-overlay")?.remove();
    isClosing = false;

    const overlay = document.createElement("div");
    overlay.className = "ca-easter-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Club Assistant creator copyright");

    overlay.innerHTML = `
      <section class="ca-easter-card">
        <div class="ca-easter-logo-stage" aria-hidden="true">
          <span class="ca-easter-orbit ca-easter-orbit-one"><i></i><i></i><i></i></span>
          <span class="ca-easter-orbit ca-easter-orbit-two"><i></i><i></i></span>
          <span class="ca-easter-energy-ring"></span>
          <img class="ca-easter-logo" src="../../assests/lady-justice-logo.jpg" alt="Lady Justice logo">
        </div>

        <p class="ca-easter-kicker">ORIGINAL SOFTWARE</p>
        <h2>Club Assistant</h2>
        <p class="ca-easter-copyright">© 2026 <strong>DevilsGambit22</strong><br>All Rights Reserved</p>
        <p>Built for Chess.com club communities</p>
        <p class="ca-easter-motto">Every Player Belongs • Every Move Matters</p>
        <small>Version 1.2.1 Public Beta</small>
      </section>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeOverlay();
    });

    closeTimer = window.setTimeout(closeOverlay, 6500);
  }

  document.querySelectorAll(".product-credit img").forEach((logo) => {
    logo.title = "Copyright mark";
    logo.setAttribute("tabindex", "0");
    logo.setAttribute("role", "button");
    logo.setAttribute("aria-label", "Club Assistant copyright logo");

    const activate = () => {
      clickCount += 1;
      clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => { clickCount = 0; }, 3000);

      if (clickCount >= 5) {
        clickCount = 0;
        clearTimeout(resetTimer);
        openOverlay();
      }
    };

    logo.addEventListener("click", activate);
    logo.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOverlay();
  });
})();
