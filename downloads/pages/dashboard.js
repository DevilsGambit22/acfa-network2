import { applyTheme, THEME_PRESETS, loadAndApplyTheme } from "../modules/theme.js";

import {
  getSettings,
  resetSettings,
  saveSettings,
  migrateClubOwnerEdition
} from "../modules/storage.js";

import {
  renderMessageBuilder
} from "../modules/message-builder.js";

import {
  deleteTemplate,
  getTemplates
} from "../modules/templates.js";

import {
  renderProspectManager
} from "../modules/prospect-manager.js";

import {
  renderMemberManager
} from "../modules/member-manager.js";

import {
  getClubs,
  renderClubManager
} from "../modules/club-manager.js";

const LOCAL_LOGO_PATH = "../assests/club-assistant-logo.png";
const CLUB_API_ROOT = "https://api.chess.com/pub/club";
const DEFAULT_PRODUCT_LOGO = "../assests/club-assistant-logo.png";
const CLUB_CACHE_KEY = "clubOwnerSnapshot";
const ACTIVITY_KEY = "activityLog";

await loadAndApplyTheme();

const sectionTitle =
  document.querySelector("#sectionTitle");

const sectionDescription =
  document.querySelector("#sectionDescription");

const sectionContent =
  document.querySelector("#sectionContent");

const navigationButtons =
  document.querySelectorAll(".nav-button");
const returnToChessButton = document.querySelector("#returnToChessButton");
const reopenSidebarButton = document.querySelector("#reopenSidebarButton");
const helpModeButton = document.querySelector("#helpModeButton");


const moduleGuidance = {
  dashboard: ["Command Center", "Review live club status, recent activity, and shortcuts to every tool.", "Start by confirming your home club and refreshing roster data."],
  "message-builder": ["Build a Message", "Choose the destination club, edit the content, then copy either HTML or plain text.", "Use HTML for formatted Chess.com posts and plain text for direct conversations."],
  prospects: ["Track Recruitment", "Save potential members, record contact history, and update each prospect as they move toward joining.", "Add a username first; notes and tags can be refined later."],
  members: ["Manage Members", "Search, import, edit, and recognize club members from one registry.", "Use roster sync for speed, then add notes only where they are useful."],
  clubs: ["Configure Clubs", "Store each club's links, branding, relationship, and message defaults.", "Set one home club so the sidebar and builder always know your default."],
  templates: ["Reuse Messages", "Open, preview, copy, or delete saved templates without rebuilding common messages.", "Give templates clear names such as Welcome, Match Reminder, or Partnership Invite."],
  settings: ["Personalize Club Assistant", "Control default club identity, links, animation level, backups, and message behavior.", "Save changes before leaving this page. Export a backup after major setup work."],
  help: ["Help Board", "Follow the workflows below whenever you are unsure where to begin.", "The recommended order is Setup → Clubs → Members → Templates → Messages."]
};

function showUxToast(message, isError = false) {
  let toast = document.querySelector("#globalUxToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalUxToast";
    toast.className = "global-ux-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(showUxToast.timer);
  showUxToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function enhanceRenderedModule(sectionName) {
  initializeGlobalPageEffects(sectionName);
  const guidance = moduleGuidance[sectionName];
  if (guidance && !sectionContent.querySelector(".module-guide")) {
    const guide = document.createElement("section");
    guide.className = "module-guide";
    guide.innerHTML = `<div><span class="guide-step">QUICK GUIDE</span><h3>${guidance[0]}</h3><p>${guidance[1]}</p></div><div class="guide-tip"><strong>Best next step</strong><span>${guidance[2]}</span></div>`;
    sectionContent.prepend(guide);
  }

  sectionContent.querySelectorAll("button").forEach((button) => {
    if (!button.title) button.title = button.textContent.trim().replace(/\s+/g, " ");
  });
  sectionContent.querySelectorAll("input, textarea, select").forEach((field) => {
    if (!field.getAttribute("aria-label")) {
      const label = field.closest("label")?.childNodes?.[0]?.textContent?.trim();
      if (label) field.setAttribute("aria-label", label);
    }
  });
  sectionContent.querySelectorAll("input[required], textarea[required], select[required]").forEach((field) => {
    const label = field.closest("label");
    if (label && !label.querySelector(".required-mark")) {
      const mark = document.createElement("span");
      mark.className = "required-mark";
      mark.textContent = " Required";
      label.insertBefore(mark, field);
    }
  });
}


let globalPageEffectCleanup = null;

function initializeGlobalPageEffects(sectionName) {
  if (typeof globalPageEffectCleanup === "function") {
    globalPageEffectCleanup();
    globalPageEffectCleanup = null;
  }

  // Dashboard and Help Board keep their purpose-built canvases, but use the
  // same green Matrix language and moving scanner as every other module.
  if (sectionName === "dashboard" || sectionName === "help") return;

  const canvas = document.createElement("canvas");
  canvas.className = "global-matrix-rain";
  canvas.setAttribute("aria-hidden", "true");

  const scan = document.createElement("div");
  scan.className = "global-scan-layer";
  scan.setAttribute("aria-hidden", "true");

  sectionContent.prepend(scan);
  sectionContent.prepend(canvas);

  const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (motionReduced) {
    canvas.hidden = true;
    scan.hidden = true;
    return;
  }

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const characters = "CLUB0123456789KQRBNe4d4Nf3Bc4O-O+#♔♕♖♗♘♙";
  const fontSize = 17;
  let columns = 0;
  let drops = [];
  let frameId = 0;
  let lastFrame = 0;
  let stopped = false;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(sectionContent.clientWidth, sectionContent.scrollWidth);
    const height = Math.max(sectionContent.clientHeight, sectionContent.scrollHeight);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    columns = Math.ceil(width / fontSize);
    drops = Array.from({ length: columns }, (_, index) => drops[index] ?? -Math.random() * 36);
  };

  const draw = (timestamp) => {
    if (stopped) return;
    frameId = requestAnimationFrame(draw);
    if (document.hidden || timestamp - lastFrame < 72) return;
    lastFrame = timestamp;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.fillStyle = "rgba(5, 10, 5, 0.105)";
    context.fillRect(0, 0, width, height);
    context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textAlign = "center";

    for (let column = 0; column < drops.length; column += 1) {
      if (Math.random() > 0.88) continue;
      const glyph = characters[Math.floor(Math.random() * characters.length)];
      const x = column * fontSize + fontSize / 2;
      const y = drops[column] * fontSize;
      context.shadowBlur = Math.random() > 0.92 ? 10 : 3;
      context.shadowColor = "rgba(91, 215, 80, .85)";
      context.fillStyle = Math.random() > 0.94 ? "rgba(205, 255, 190, .78)" : "rgba(91, 215, 80, .34)";
      context.fillText(glyph, x, y);
      if (y > height && Math.random() > 0.974) drops[column] = -Math.random() * 20;
      else drops[column] += 0.44;
    }
    context.shadowBlur = 0;
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(sectionContent);
  resize();
  frameId = requestAnimationFrame(draw);

  globalPageEffectCleanup = () => {
    stopped = true;
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    canvas.remove();
    scan.remove();
  };
}

function openHelpOverlay() {
  document.querySelector(".ux-help-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "ux-help-overlay";
  overlay.innerHTML = `<div class="ux-help-dialog" role="dialog" aria-modal="true" aria-labelledby="uxHelpTitle"><button class="ux-help-close" type="button" aria-label="Close help">×</button><img src="${DEFAULT_PRODUCT_LOGO}" alt="Club Assistant logo"><p class="panel-kicker">CLUB ASSISTANT WORKFLOW</p><h3 id="uxHelpTitle">A simple path through every feature</h3><ol><li><strong>Settings:</strong> complete your club identity and links.</li><li><strong>Club Manager:</strong> add your home club and any partner clubs.</li><li><strong>Member Manager:</strong> synchronize or add members.</li><li><strong>Prospect Manager:</strong> track potential recruits and follow-ups.</li><li><strong>Templates:</strong> save messages you use repeatedly.</li><li><strong>Message Builder:</strong> generate content and copy it into Chess.com.</li><li><strong>Sidebar:</strong> use quick actions while browsing Chess.com.</li></ol><p class="ux-help-note">Tip: Hover over controls for a short description. Nothing is sent automatically; copy or save actions always require your click.</p></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".ux-help-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
}

const sections = {
  dashboard: {
    title: "Dashboard",
    description:
      "Manage club tools, members, prospects, clubs, and messages.",
    render: renderDashboard
  },

  "message-builder": {
    title: "Message Builder",
    description:
      "Create HTML and plain-text club messages.",
    render: renderMessageBuilderSection
  },

  prospects: {
    title: "Prospect Manager",
    description:
      "Track recruitment prospects, outreach, and notes.",
    render: renderProspectManagerSection
  },

  members: {
    title: "Member Manager",
    description:
      "Track member roles, activity, participation, and recognition.",
    render: renderMemberManagerSection
  },

  clubs: {
    title: "Club Manager",
    description:
      "Manage owned clubs, partner clubs, links, branding, and defaults.",
    render: renderClubManagerSection
  },

  templates: {
    title: "Templates",
    description:
      "Open, manage, and reuse saved message templates.",
    render: renderTemplates
  },

  settings: {
    title: "Settings",
    description:
      "Configure club branding, links, and message defaults.",
    render: renderSettings
  },

  help: {
    title: "Help Board",
    description:
      "Learn the club-management workflows and operating controls.",
    render: renderHelpBoard
  }
};

async function renderDashboard() {
  const settings = await getSettings();
  if (!settings.setupComplete) { await renderOwnerSetup(); return; }
  const clubName = settings.clubName || "My Club";
  const clubSlug = settings.homeClubSlug || "";
  const clubLogoPath = settings.customLogoData || LOCAL_LOGO_PATH;
  sectionContent.innerHTML = `
    <section class="command-center" data-animation-mode="standard">
      <canvas id="matrixRain" class="matrix-rain" aria-hidden="true"></canvas>
      <div id="bootSequence" class="boot-sequence" aria-live="polite">
        <div class="boot-logo-shell">
          <img class="boot-logo" src="${clubLogoPath}" alt="Club logo">
          <div class="boot-light-sweep" aria-hidden="true"></div>
        </div>
        <p class="boot-kicker">CLUB OPERATIONS SYSTEM</p>
        <h3>Initializing Command Center</h3>
        <div class="boot-progress"><span id="bootProgress"></span></div>
        <p id="bootStatus" class="boot-status">Loading configuration…</p>
      </div>

      <img class="command-watermark" src="${clubLogoPath}" alt="" aria-hidden="true">
      <div class="scanline-layer" aria-hidden="true"></div>

      <div class="command-ribbon panel-rise" aria-label="Command Center status ribbon">
        <div class="ribbon-item"><span class="ribbon-dot online"></span><div><small>Chess.com Link</small><strong id="ribbonConnection">CONNECTED</strong></div></div>
        <div class="ribbon-item"><small>Live Roster</small><strong id="ribbonMembers">— MEMBERS</strong></div>
        <div class="ribbon-item ribbon-wide"><small>Current Context</small><strong id="ribbonContext">CLUB DASHBOARD</strong></div>
        <div class="ribbon-item"><small>Last Sync</small><strong id="ribbonSync">PENDING</strong></div>
      </div>

      <header class="command-hero panel-rise">
        <div class="club-emblem-wrap">
          <div class="emblem-rings" aria-hidden="true"></div>
          <img id="clubLogo" class="club-logo" src="${clubLogoPath}" alt="Club logo">
        </div>

        <div class="hero-copy">
          <p class="eyebrow">${escapeTemplateText(clubName)} • Club Operations Console</p>
          <h3>${escapeTemplateText(clubName)} Command Center</h3>
          <p class="hero-subtitle">Live administration, recruitment, communications, and club intelligence.</p>
          <p class="command-motto">${escapeTemplateText(settings.defaultSignature || "Club Operations Online")}</p>
        </div>

        <div class="hero-status">
          <span id="globalStatusLight" class="status-light pending"></span>
          <div>
            <strong id="globalStatusText">INITIALIZING</strong>
            <small id="lastSyncText">Preparing live systems</small>
          </div>
        </div>
      </header>

      <div class="command-grid">
        <article class="command-panel growth-panel panel-rise delay-1">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">Expansion Protocol</p>
              <h4>Member Growth</h4>
            </div>
            <button id="refreshClubData" class="icon-command" type="button" aria-label="Refresh club data" title="Refresh club data">↻</button>
          </div>

          <div class="growth-numbers">
            <div><strong id="memberCount">—</strong><span>Current Members</span></div>
            <div class="growth-divider" aria-hidden="true"></div>
            <div><strong id="memberGoal">250</strong><span>Mission Target</span></div>
          </div>

          <div class="progress-shell" aria-label="Member growth progress">
            <div id="memberProgress" class="progress-energy" style="width:0%"></div>
            <div class="progress-grid" aria-hidden="true"></div>
            <div class="progress-beacon" aria-hidden="true"></div>
          </div>

          <div class="growth-caption">
            <span id="progressPercent">0%</span>
            <span id="membersRemaining">Synchronizing roster…</span>
          </div>
        </article>

        <article class="command-panel telemetry-panel panel-rise delay-2">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">Live Diagnostics</p>
              <h4>System Telemetry</h4>
            </div>
          </div>

          <div class="telemetry-list">
            <div class="telemetry-row"><span><i id="apiStatus" class="status-dot pending"></i>Chess.com PubAPI</span><strong id="apiStatusText" class="telemetry-badge pending">CONNECTING</strong></div>
            <div class="telemetry-row"><span><i class="status-dot online"></i>Local Database</span><strong class="telemetry-badge online">ONLINE</strong></div>
            <div class="telemetry-row"><span><i class="status-dot online"></i>Auto Logging</span><strong class="telemetry-badge online">ACTIVE</strong></div>
            <div class="telemetry-row"><span><i class="status-dot standby"></i>Context Engine</span><strong class="telemetry-badge standby">STANDBY</strong></div>
          </div>
        </article>

        <article class="command-panel stats-panel panel-rise delay-3">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">Operations Snapshot</p>
              <h4>Local Records</h4>
            </div>
          </div>
          <div class="stat-grid">
            <button class="stat-tile" type="button" data-open-section="members"><i class="stat-glyph" aria-hidden="true">♟</i><strong id="trackedMembers">0</strong><span>Members Tracked</span><em>Open Registry →</em></button>
            <button class="stat-tile" type="button" data-open-section="prospects"><i class="stat-glyph" aria-hidden="true">◎</i><strong id="trackedProspects">0</strong><span>Prospects</span><em>Open Recruitment →</em></button>
            <button class="stat-tile" type="button" data-open-section="clubs"><i class="stat-glyph" aria-hidden="true">♜</i><strong id="trackedClubs">0</strong><span>Clubs</span><em>Open Network →</em></button>
            <button class="stat-tile" type="button" data-open-section="templates"><i class="stat-glyph" aria-hidden="true">▤</i><strong id="trackedTemplates">0</strong><span>Templates</span><em>Open Library →</em></button>
          </div>
        </article>

        <article class="command-panel events-panel panel-rise delay-4">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">Home Club Schedule</p>
              <h4>Current & Upcoming Events</h4>
            </div>
            <button id="refreshEvents" class="icon-command" type="button" title="Refresh events">↻</button>
          </div>
          <div class="event-tabs">
            <button type="button" class="event-tab active" data-event-filter="current">Current</button>
            <button type="button" class="event-tab" data-event-filter="upcoming">Upcoming</button>
            <button type="button" class="event-tab" data-event-filter="all">All</button>
          </div>
          <div id="clubEvents" class="club-events"><p class="empty-feed">Synchronizing home-club events…</p></div>
        </article>

        <article class="command-panel feed-panel panel-rise delay-4">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">Mission Feed</p>
              <h4>Recent Activity</h4>
            </div>
            <span class="live-tag"><i></i> LIVE</span>
          </div>
          <div id="commandFeed" class="command-feed" aria-live="polite"></div>
        </article>
      </div>
    </section>
  `;

  await initializeCommandCenter();
}

async function initializeCommandCenter() {
  const settings = await getSettings();
  const mode = settings.animationMode || "cinematic";
  const commandCenter = document.querySelector(".command-center");
  commandCenter.dataset.animationMode = mode;
  initializeMatrixRain(mode);
  document.querySelector("#memberGoal").textContent = formatNumber(settings.memberGoal || 250);

  const bootPromise = runBootSequence(mode);
  await loadLocalDashboardStats();
  await updateCurrentContext();
  await addActivity("Command Center initialized", "system");
  await renderActivityFeed();
  await synchronizeClubData(settings, false);
  await synchronizeClubEvents(settings, false);
  await bootPromise;

  document.querySelector("#refreshClubData")?.addEventListener("click", async () => {
    await synchronizeClubData(settings, true);
  });

  document.querySelector("#refreshEvents")?.addEventListener("click", async () => {
    await synchronizeClubEvents(await getSettings(), true);
  });

  document.querySelectorAll("[data-event-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-event-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderClubEvents(button.dataset.eventFilter);
    });
  });

  document.querySelectorAll("[data-open-section]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.openSection));
  });
}

function initializeMatrixRain(mode) {
  const canvas = document.querySelector("#matrixRain");
  if (!canvas || mode === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const glyphs = "CLUB0123456789KQRBNe4d4Nf3Bc4O-O+#♔♕♖♗♘♙";
  const fontSize = mode === "cinematic" ? 15 : 18;
  let columns = 0;
  let drops = [];
  let animationFrame = 0;
  let lastFrame = 0;
  const frameInterval = mode === "cinematic" ? 54 : 82;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
    canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    columns = Math.ceil(bounds.width / fontSize);
    drops = Array.from({ length: columns }, (_, index) => drops[index] ?? -Math.random() * 45);
  };

  const draw = (timestamp) => {
    animationFrame = requestAnimationFrame(draw);
    if (document.hidden || timestamp - lastFrame < frameInterval) return;
    lastFrame = timestamp;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.fillStyle = "rgba(5, 10, 5, 0.105)";
    context.fillRect(0, 0, width, height);
    context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textAlign = "center";
    for (let column = 0; column < drops.length; column += 1) {
      if (Math.random() > (mode === "cinematic" ? 0.79 : 0.9)) continue;
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      const x = column * fontSize + fontSize / 2;
      const y = drops[column] * fontSize;
      context.shadowBlur = Math.random() > 0.92 ? 9 : 3;
      context.shadowColor = "rgba(91, 215, 80, .85)";
      context.fillStyle = Math.random() > 0.94 ? "rgba(205, 255, 190, .78)" : "rgba(91, 215, 80, .34)";
      context.fillText(glyph, x, y);
      if (y > height && Math.random() > 0.975) drops[column] = -Math.random() * 18;
      else drops[column] += mode === "cinematic" ? 0.72 : 0.38;
    }
    context.shadowBlur = 0;
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  animationFrame = requestAnimationFrame(draw);
  window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame), { once: true });
}

async function synchronizeClubData(settings, manualRefresh) {
  setApiState("pending", manualRefresh ? "REFRESHING" : "CONNECTING");
  setGlobalState("pending", manualRefresh ? "SYNCHRONIZING" : "INITIALIZING", "Contacting Chess.com");

  try {
    const [clubResponse, membersResponse] = await Promise.all([
      fetch(`${CLUB_API_ROOT}/${settings.homeClubSlug}`, { cache: "no-store" }),
      fetch(`${CLUB_API_ROOT}/${settings.homeClubSlug}/members`, { cache: "no-store" })
    ]);

    if (!clubResponse.ok || !membersResponse.ok) {
      throw new Error(`Chess.com API returned ${clubResponse.status}/${membersResponse.status}`);
    }

    const club = await clubResponse.json();
    const memberGroups = await membersResponse.json();
    const memberCount = countUniqueClubMembers(memberGroups);
    const snapshot = {
      memberCount,
      icon: club.icon || "",
      name: club.name || settings.clubName,
      syncedAt: Date.now()
    };

    await chrome.storage.local.set({ [CLUB_CACHE_KEY]: snapshot });
    updateClubDashboard(snapshot, Number(settings.memberGoal) || 250, false);
    setApiState("online", "ONLINE");
    setGlobalState("online", "SYSTEM ONLINE", `Live sync ${formatTime(snapshot.syncedAt)}`);
    await addActivity(`Roster synchronized: ${memberCount} members`, "sync");
    await renderActivityFeed();
  } catch (error) {
    console.error("Unable to synchronize club data", error);
    const cached = await chrome.storage.local.get(CLUB_CACHE_KEY);
    const snapshot = cached[CLUB_CACHE_KEY];

    if (snapshot) {
      updateClubDashboard(snapshot, Number(settings.memberGoal) || 250, true);
      setApiState("standby", "CACHED");
      setGlobalState("standby", "LIMITED MODE", `Cached sync ${formatTime(snapshot.syncedAt)}`);
      await addActivity("PubAPI unavailable — cached roster loaded", "warning");
    } else {
      setApiState("offline", "OFFLINE");
      setGlobalState("offline", "DATA LINK OFFLINE", "No cached roster available");
      document.querySelector("#membersRemaining").textContent = "Unable to retrieve roster";
      await addActivity("PubAPI connection failed", "error");
    }

    await renderActivityFeed();
  }
}

let cachedClubEvents = [];

async function synchronizeClubEvents(settings, manualRefresh) {
  const homeSlug = settings.homeClubSlug || "";
  const container = document.querySelector("#clubEvents");
  if (container && manualRefresh) container.innerHTML = '<p class="empty-feed">Refreshing club events…</p>';

  try {
    const response = await fetch(`${CLUB_API_ROOT}/${encodeURIComponent(homeSlug)}/matches`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Match API returned ${response.status}`);
    const payload = await response.json();
    const groups = [
      ...(payload.in_progress || []).map((item) => ({ ...item, eventState: "current" })),
      ...(payload.registered || []).map((item) => ({ ...item, eventState: "upcoming" })),
      ...(payload.finished || []).slice(0, 3).map((item) => ({ ...item, eventState: "finished" }))
    ];
    cachedClubEvents = groups;
    await chrome.storage.local.set({ clubAssistantClubEvents: groups, clubAssistantEventsSyncedAt: Date.now() });
    renderClubEvents(document.querySelector(".event-tab.active")?.dataset.eventFilter || "current");
    await addActivity(`Club events synchronized: ${groups.length} records`, "sync");
  } catch (error) {
    console.warn("Unable to load club matches", error);
    const stored = await chrome.storage.local.get("clubAssistantClubEvents");
    cachedClubEvents = Array.isArray(stored.clubAssistantClubEvents) ? stored.clubAssistantClubEvents : [];
    renderClubEvents(document.querySelector(".event-tab.active")?.dataset.eventFilter || "current", true);
  }
}

function classifyMatchType(event) {
  const text = `${event.name || ""} ${event.url || ""}`.toLowerCase();
  if (text.includes("vote")) return "Vote Chess";
  if (text.includes("960") || text.includes("chess960")) return "Chess960";
  if (text.includes("swiss")) return "Swiss";
  if (text.includes("arena")) return "Arena";
  return "Daily Match";
}

function renderClubEvents(filter = "current", cached = false) {
  const container = document.querySelector("#clubEvents");
  if (!container) return;
  let events = cachedClubEvents;
  if (filter !== "all") events = events.filter((event) => event.eventState === filter);
  if (!events.length) {
    container.innerHTML = `<p class="empty-feed">${cached ? "Live events unavailable. " : ""}No ${filter === "all" ? "club" : filter} events found.</p>`;
    return;
  }
  container.innerHTML = events.slice(0, 8).map((event) => {
    const opponent = event.opponent || event.opposing_club || {};
    const opponentName = opponent.name || opponent.username || "Opponent pending";
    const url = event.url || event.web_url || "#";
    return `
      <a class="club-event-card ${escapeTemplateText(event.eventState)}" href="${escapeTemplateText(url)}" target="_blank" rel="noopener noreferrer">
        <span class="event-type">${classifyMatchType(event)}</span>
        <strong>${escapeTemplateText(event.name || `${opponentName} Match`)}</strong>
        <small>${escapeTemplateText(opponentName)} • ${escapeTemplateText(event.eventState.toUpperCase())}</small>
      </a>`;
  }).join("");
}

function countUniqueClubMembers(groups) {
  const usernames = new Set();
  Object.values(groups || {}).forEach((group) => {
    if (!Array.isArray(group)) return;
    group.forEach((member) => {
      const username = typeof member === "string" ? member : member?.username;
      if (username) usernames.add(username.toLowerCase());
    });
  });
  return usernames.size;
}

function updateClubDashboard(snapshot, goal, cached) {
  const count = Number(snapshot.memberCount) || 0;
  const percentage = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - count, 0);
  animateNumber(document.querySelector("#memberCount"), count);
  document.querySelector("#memberGoal").textContent = formatNumber(goal);
  requestAnimationFrame(() => {
    document.querySelector("#memberProgress").style.width = `${percentage}%`;
  });
  document.querySelector("#progressPercent").textContent = `${percentage.toFixed(1)}%`;
  document.querySelector("#membersRemaining").textContent = remaining > 0
    ? `${formatNumber(remaining)} members until target`
    : "Mission target achieved";
  document.querySelector("#lastSyncText").textContent = `${cached ? "Cached" : "Live"} sync ${formatTime(snapshot.syncedAt)}`;
  const ribbonMembers = document.querySelector("#ribbonMembers");
  const ribbonSync = document.querySelector("#ribbonSync");
  if (ribbonMembers) ribbonMembers.textContent = `${formatNumber(count)} MEMBERS`;
  if (ribbonSync) ribbonSync.textContent = `${cached ? "CACHED" : "LIVE"} • ${formatTime(snapshot.syncedAt)}`;
}

async function runBootSequence(mode) {
  const boot = document.querySelector("#bootSequence");
  const bar = document.querySelector("#bootProgress");
  const status = document.querySelector("#bootStatus");
  if (!boot) return;

  if (mode === "reduced") {
    boot.remove();
    return;
  }

  const steps = [
    ["Loading configuration…", 22],
    ["Connecting local database…", 48],
    ["Synchronizing club systems…", 76],
    ["Command Center online", 100]
  ];
  const wait = mode === "cinematic" ? 210 : 90;

  for (const [message, progress] of steps) {
    status.textContent = message;
    bar.style.width = `${progress}%`;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  boot.classList.add("boot-complete");
  await new Promise((resolve) => setTimeout(resolve, mode === "cinematic" ? 320 : 120));
  boot.remove();
}

async function loadLocalDashboardStats() {
  const data = await chrome.storage.local.get(["members", "prospects", "managedClubs", "messageTemplates"]);
  const counts = {
    trackedMembers: Array.isArray(data.members) ? data.members.length : 0,
    trackedProspects: Array.isArray(data.prospects) ? data.prospects.length : 0,
    trackedClubs: Array.isArray(data.managedClubs) ? data.managedClubs.length : 0,
    trackedTemplates: Array.isArray(data.messageTemplates) ? data.messageTemplates.length : 0
  };
  Object.entries(counts).forEach(([id, value]) => animateNumber(document.querySelector(`#${id}`), value));
}

async function addActivity(message, type = "system") {
  const stored = await chrome.storage.local.get(ACTIVITY_KEY);
  const entries = Array.isArray(stored[ACTIVITY_KEY]) ? stored[ACTIVITY_KEY] : [];
  const duplicate = entries[0] && entries[0].message === message && Date.now() - entries[0].timestamp < 3000;
  if (duplicate) return;
  entries.unshift({ id: crypto.randomUUID(), message, type, timestamp: Date.now() });
  await chrome.storage.local.set({ [ACTIVITY_KEY]: entries.slice(0, 100) });
}

async function renderActivityFeed() {
  const feed = document.querySelector("#commandFeed");
  if (!feed) return;
  const stored = await chrome.storage.local.get(ACTIVITY_KEY);
  const entries = Array.isArray(stored[ACTIVITY_KEY]) ? stored[ACTIVITY_KEY].slice(0, 6) : [];
  feed.innerHTML = entries.length ? entries.map((entry) => `
    <div class="feed-entry ${escapeTemplateText(entry.type)}">
      <time>${formatTime(entry.timestamp, true)}</time>
      <span>${escapeTemplateText(entry.message || entry.label || entry.action || "Activity recorded")}</span>
    </div>
  `).join("") : '<p class="empty-feed">No command activity recorded yet.</p>';
}

function setApiState(state, label) {
  const dot = document.querySelector("#apiStatus");
  const text = document.querySelector("#apiStatusText");
  if (!dot || !text) return;
  dot.className = `status-dot ${state}`;
  text.className = `telemetry-badge ${state}`;
  text.textContent = label;
  const ribbon = document.querySelector("#ribbonConnection");
  const ribbonDot = document.querySelector(".command-ribbon .ribbon-dot");
  if (ribbon) ribbon.textContent = state === "online" ? "CONNECTED" : label;
  if (ribbonDot) ribbonDot.className = `ribbon-dot ${state}`;
}

function setGlobalState(state, headline, detail) {
  const light = document.querySelector("#globalStatusLight");
  if (!light) return;
  light.className = `status-light ${state}`;
  document.querySelector("#globalStatusText").textContent = headline;
  document.querySelector("#lastSyncText").textContent = detail;
}

function animateNumber(element, target) {
  if (!element) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || target <= 0) {
    element.textContent = formatNumber(target);
    return;
  }
  const duration = 650;
  const started = performance.now();
  const step = (now) => {
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatNumber(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatTime(timestamp, includeSeconds = false) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {})
  }).format(new Date(timestamp));
}

async function updateCurrentContext() {
  const context = document.querySelector("#ribbonContext");
  if (!context) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";
    const title = tab?.title || "";
    let label = "CLUB DASHBOARD";

    if (url.includes("chess.com/member/")) label = `PLAYER PROFILE • ${title.replace(/ - Chess.com.*/i, "").toUpperCase()}`;
    else if (url.includes("chess.com/club/")) label = `CLUB PAGE • ${title.replace(/ - Chess.com.*/i, "").toUpperCase()}`;
    else if (url.includes("/clubs/forums/")) label = "CHESS.COM CLUB FORUM";
    else if (url.includes("chess.com/play/")) label = "CHESS.COM PLAY AREA";
    else if (url.includes("chess.com")) label = "CHESS.COM ACTIVE";

    context.textContent = label;
  } catch (error) {
    console.debug("Unable to determine current tab context", error);
  }
}

async function renderMessageBuilderSection() {
  await renderMessageBuilder(sectionContent);
}

async function renderProspectManagerSection() {
  await renderProspectManager(sectionContent);
}

async function renderMemberManagerSection() {
  await renderMemberManager(sectionContent);
}

async function renderClubManagerSection() {
  await renderClubManager(sectionContent);
}

async function renderSettings() {
  sectionContent.innerHTML = `
    <form id="settingsForm" class="settings-form">
      <section class="settings-card">
        <h3>Club Profile</h3>
        <div class="logo-preview-wrap"><img id="settingsLogoPreview" class="settings-logo-preview" src="${(await getSettings()).customLogoData || LOCAL_LOGO_PATH}" alt="Club logo preview"></div>
        <label>Club Logo<input id="clubLogoUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>

        <label>
          Club Name

          <input
            id="clubName"
            type="text"
          >
        </label>

        <label>
          Club URL

          <input
            id="clubUrl"
            type="url"
          >
        </label>
        <div class="color-field-row">
          <label class="color-field">Primary Color<input id="primaryColor" type="color"><small>Main buttons, active navigation, progress bars, and focus highlights.</small></label>
          <label class="color-field">Secondary Color<input id="accentColor" type="color"><small>Text accents, glows, badges, borders, and hover details.</small></label>
        </div>
        <input id="themePreset" type="hidden">
        <div>
          <p class="settings-help"><strong>Theme Presets</strong> — choose a starting style, then customize either color.</p>
          <div id="themePresets" class="theme-presets"></div>
        </div>
        <div class="theme-preview" aria-live="polite">
          <div class="theme-preview-head"><span class="theme-preview-title">Live Theme Preview</span><button class="theme-preview-button" type="button">Primary Action</button></div>
          <div class="theme-preview-accent"></div>
        </div>
      </section>

      <section class="settings-card">
        <h3>Community Links</h3>

        <label>
          Website URL

          <input
            id="websiteUrl"
            type="url"
          >
        </label>

        <label>
          Discord URL

          <input
            id="discordUrl"
            type="url"
          >
        </label>

        <label>
          Twitch URL

          <input
            id="twitchUrl"
            type="url"
          >
        </label>
      </section>

      <section class="settings-card">
        <h3>Affiliate Information</h3>

        <label>
          Affiliate Code

          <input
            id="affiliateCode"
            type="text"
          >
        </label>

        <label>
          Chess.com Signup URL

          <input
            id="signupUrl"
            type="url"
          >
        </label>

        <label>
          Membership Upgrade URL

          <input
            id="upgradeUrl"
            type="url"
          >
        </label>
      </section>

      <section class="settings-card">
        <h3>Command Center</h3>

        <label>
          Member Growth Goal
          <input id="memberGoal" type="number" min="1" step="1">
        </label>

        <label>
          Animation Mode
          <select id="animationMode">
            <option value="cinematic">Cinematic</option>
            <option value="standard">Standard</option>
            <option value="reduced">Reduced Motion</option>
          </select>
        </label>
      </section>

      <section class="settings-card">
        <h3>Club Control</h3>
        <label>
          Home Club
          <select id="homeClubSlug"></select>
        </label>
        <label>
          Message Builder Club
          <select id="messageClubSlug"></select>
        </label>
        <p class="settings-help">The currently viewed Chess.com club never changes these settings automatically.</p>
      </section>

      <section class="settings-card">
        <h3>Message Defaults</h3>
        <label>
          Default Message Type
          <select id="defaultMessageType">
            <option value="announcement">Announcement</option>
            <option value="message">Direct Message</option>
            <option value="forum">Forum Post</option>
            <option value="invitation">Club Invitation</option>
            <option value="partnership">Partnership Message</option>
            <option value="event">Event Promotion</option>
          </select>
        </label>

        <label>
          Default Signature

          <textarea
            id="defaultSignature"
            rows="4"
          ></textarea>
        </label>
      </section>

      <section class="settings-card">
        <h3>Backup & Transfer</h3>
        <p class="settings-help">Export all Club Assistant settings and local records, or restore a previous backup.</p>
        <div class="settings-actions">
          <button id="exportBackup" type="button" class="secondary-button">Export Backup</button>
          <label class="secondary-button file-button">Import Backup<input id="importBackup" type="file" accept="application/json" hidden></label>
        </div>
      </section>

      <div class="settings-actions">
        <button type="submit">
          Save Settings
        </button>

        <button
          id="resetSettings"
          type="button"
          class="secondary-button"
        >
          Reset Defaults
        </button>

        <span
          id="settingsStatus"
          class="settings-status"
        ></span>
      </div>
    </form>
  `;

  const settings = await getSettings();
  const clubs = await getClubs();
  for (const selectId of ["homeClubSlug", "messageClubSlug"]) {
    const select = document.querySelector(`#${selectId}`);
    select.innerHTML = clubs.map((club) => `<option value="${escapeTemplateText(club.slug)}">${escapeTemplateText(club.name)}</option>`).join("");
  }

  populateSettingsForm(settings);
  renderThemePresets(settings);
  applyTheme(settings);
  const primaryInput = document.querySelector("#primaryColor");
  const accentInput = document.querySelector("#accentColor");
  [primaryInput, accentInput].forEach((input) => input?.addEventListener("input", () => {
    document.querySelector("#themePreset").value = "custom";
    document.querySelectorAll(".theme-preset").forEach((button) => button.classList.remove("active"));
    applyTheme({ primaryColor: primaryInput.value, accentColor: accentInput.value, themePreset: "custom" });
  }));
  const upload = document.querySelector("#clubLogoUpload");
  upload?.addEventListener("change", async () => { const file = upload.files?.[0]; if (file) document.querySelector("#settingsLogoPreview").src = await fileToDataUrl(file); });

  document
    .querySelector("#settingsForm")
    .addEventListener(
      "submit",
      handleSaveSettings
    );

  document
    .querySelector("#resetSettings")
    .addEventListener(
      "click",
      handleResetSettings
    );

  document.querySelector("#exportBackup")?.addEventListener("click", exportClubAssistantBackup);
  document.querySelector("#importBackup")?.addEventListener("change", importClubAssistantBackup);
}

function renderThemePresets(settings) {
  const container = document.querySelector("#themePresets");
  if (!container) return;
  container.innerHTML = Object.entries(THEME_PRESETS).map(([id, preset]) => `
    <button type="button" class="theme-preset ${settings.themePreset === id ? "active" : ""}" data-theme-preset="${id}" title="Apply ${preset.name}">
      <span class="theme-swatches"><i class="theme-swatch" style="background:${preset.primaryColor}"></i><i class="theme-swatch" style="background:${preset.accentColor}"></i></span>
      <span>${preset.name}</span>
    </button>`).join("");
  container.querySelectorAll("[data-theme-preset]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.themePreset;
    const preset = THEME_PRESETS[id];
    if (!preset) return;
    document.querySelector("#primaryColor").value = preset.primaryColor;
    document.querySelector("#accentColor").value = preset.accentColor;
    document.querySelector("#themePreset").value = id;
    container.querySelectorAll(".theme-preset").forEach((item) => item.classList.toggle("active", item === button));
    applyTheme({ ...preset, themePreset: id });
    showSettingsStatus(`${preset.name} preview applied. Click Save Settings to keep it.`);
  }));
}

async function exportClubAssistantBackup() {
  const data = await chrome.storage.local.get(null);
  const payload = { product: "Club Assistant", version: "1.2.4", exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `club-assistant-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showSettingsStatus("Backup exported.");
}

async function importClubAssistantBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.product !== "Club Assistant" || typeof payload.data !== "object") throw new Error("Invalid Club Assistant backup.");
    await chrome.storage.local.clear();
    await chrome.storage.local.set(payload.data);
    showSettingsStatus("Backup restored. Reloading…");
    setTimeout(() => location.reload(), 650);
  } catch (error) {
    showSettingsStatus(error.message || "Unable to import backup.");
  } finally {
    event.target.value = "";
  }
}

function populateSettingsForm(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    const field = document.querySelector(`#${key}`);

    if (field) {
      field.value = value ?? "";
    }
  });
}

async function handleSaveSettings(event) {
  event.preventDefault();

  const previousSettings = await getSettings();
  const logoFile = document.querySelector("#clubLogoUpload")?.files?.[0];
  const customLogoData = logoFile ? await fileToDataUrl(logoFile) : previousSettings.customLogoData;
  const clubUrlValue = document.querySelector("#clubUrl").value.trim();
  const derivedSlug = extractClubSlug(clubUrlValue);

  const settings = {
    setupComplete: true,
    customLogoData,
    primaryColor: document.querySelector("#primaryColor").value,
    accentColor: document.querySelector("#accentColor").value,
    themePreset: document.querySelector("#themePreset")?.value || "custom",
    clubName:
      document
        .querySelector("#clubName")
        .value
        .trim(),

    clubUrl:
      document
        .querySelector("#clubUrl")
        .value
        .trim(),

    websiteUrl:
      document
        .querySelector("#websiteUrl")
        .value
        .trim(),

    discordUrl:
      document
        .querySelector("#discordUrl")
        .value
        .trim(),

    twitchUrl:
      document
        .querySelector("#twitchUrl")
        .value
        .trim(),

    affiliateCode:
      document
        .querySelector("#affiliateCode")
        .value
        .trim(),

    signupUrl:
      document
        .querySelector("#signupUrl")
        .value
        .trim(),

    upgradeUrl:
      document
        .querySelector("#upgradeUrl")
        .value
        .trim(),

    defaultSignature:
      document
        .querySelector("#defaultSignature")
        .value
        .trim(),

    memberGoal:
      Math.max(1, Number(document.querySelector("#memberGoal").value) || 250),

    animationMode:
      document.querySelector("#animationMode").value,

    homeClubSlug: document.querySelector("#homeClubSlug").value || derivedSlug,

    messageClubSlug: document.querySelector("#messageClubSlug").value || derivedSlug,

    defaultMessageType:
      document.querySelector("#defaultMessageType").value
  };

  await saveSettings(settings);
  applyTheme(settings);

  showSettingsStatus("Settings saved.");
}

async function handleResetSettings() {
  const settings = await resetSettings();

  populateSettingsForm(settings);
  renderThemePresets(settings);
  applyTheme(settings);
  const primaryInput = document.querySelector("#primaryColor");
  const accentInput = document.querySelector("#accentColor");
  [primaryInput, accentInput].forEach((input) => input?.addEventListener("input", () => {
    document.querySelector("#themePreset").value = "custom";
    document.querySelectorAll(".theme-preset").forEach((button) => button.classList.remove("active"));
    applyTheme({ primaryColor: primaryInput.value, accentColor: accentInput.value, themePreset: "custom" });
  }));
  const upload = document.querySelector("#clubLogoUpload");
  upload?.addEventListener("change", async () => { const file = upload.files?.[0]; if (file) document.querySelector("#settingsLogoPreview").src = await fileToDataUrl(file); });

  showSettingsStatus("Defaults restored.");
}

function showSettingsStatus(message) {
  const status =
    document.querySelector("#settingsStatus");

  if (!status) {
    return;
  }

  status.textContent = message;

  window.setTimeout(() => {
    status.textContent = "";
  }, 2500);
}

async function renderTemplates() {
  const templates = await getTemplates();

  if (templates.length === 0) {
    sectionContent.innerHTML = `
      <div class="welcome-card">
        <h3>No Saved Templates</h3>

        <p>
          Open Message Builder and use
          Save as Template to create your
          first reusable message.
        </p>
      </div>
    `;

    return;
  }

  sectionContent.innerHTML = `
    <div class="template-grid">
      ${templates
        .map(
          (template) => `
            <article class="template-card">
              <div class="template-card-heading">
                <h3>${escapeTemplateText(template.name)}</h3>
                <span class="telemetry-badge ${template.builtIn ? "online" : "standby"}">${escapeTemplateText(template.category || (template.builtIn ? "Built In" : "Custom"))}</span>
              </div>

              <p class="template-title">
                ${escapeTemplateText(template.title)}
              </p>

              <p class="template-preview">
                ${escapeTemplateText(
                  shortenText(template.body, 150)
                )}
              </p>

              <div class="template-actions">
                <button
                  type="button"
                  class="open-template-button"
                  data-template-id="${template.id}"
                >
                  Open
                </button>

                <button
                  type="button"
                  class="delete-template-button"
                  data-template-id="${template.id}"
                  ${template.builtIn ? 'disabled title="Built-in templates are protected"' : ""}
                >
                  ${template.builtIn ? "Built In" : "Delete"}
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  document
    .querySelectorAll(".open-template-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await openTemplate(
          button.dataset.templateId,
          templates
        );
      });
    });

  document
    .querySelectorAll(".delete-template-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleDeleteTemplate(
          button.dataset.templateId
        );
      });
    });
}

async function openTemplate(templateId, templates) {
  const template = templates.find(
    (item) => item.id === templateId
  );

  if (!template) {
    return;
  }

  await chrome.storage.local.set({
    activeMessageTemplate: template
  });

  await showSection("message-builder");
}

async function handleDeleteTemplate(templateId) {
  const confirmed = window.confirm(
    "Delete this template?"
  );

  if (!confirmed) {
    return;
  }

  await deleteTemplate(templateId);

  await renderTemplates();
}

function shortenText(value, maximumLength) {
  const text = String(value ?? "");

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength)}…`;
}

function escapeTemplateText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function renderHelpBoard() {
  const settings = await getSettings();
  sectionContent.innerHTML = `
    <section class="help-board" aria-labelledby="helpBoardTitle">
      <canvas id="helpMatrix" class="help-matrix" aria-hidden="true"></canvas>
      <div class="help-scanline" aria-hidden="true"></div>
      <header class="help-hero help-reveal">
        <div class="help-emblem-shell"><img src="${LOCAL_LOGO_PATH}" alt="Club Assistant logo"><span class="help-orbit"></span></div>
        <div><p class="panel-kicker">OPERATIONS MANUAL</p><h3 id="helpBoardTitle">Club Assistant Help Board</h3><p>Practical guidance for configuring and operating Club Assistant with any Chess.com club.</p></div>
      </header>
      <nav class="help-jump help-reveal delay-1" aria-label="Help topics">
        <button data-help-target="help-setup">Setup</button><button data-help-target="help-dashboard">Dashboard</button><button data-help-target="help-context">Sidebar</button><button data-help-target="help-messages">Messages</button><button data-help-target="help-members">Members</button><button data-help-target="help-clubs">Clubs</button><button data-help-target="help-troubleshooting">Troubleshooting</button>
      </nav>
      <div class="help-grid">
        <article id="help-setup" class="help-card help-reveal delay-1"><span class="help-step">01</span><h4>First-Run Setup</h4><ol><li>Enter your primary Chess.com club name and URL.</li><li>Upload your club logo and choose your colors.</li><li>Add your motto, member goal, and community links.</li><li>Save setup to create your Home Club record.</li></ol><div class="help-note">Home Club controls the dashboard. Message Club controls message branding. Viewed Club is simply the club open in your browser.</div></article>
        <article id="help-dashboard" class="help-card help-reveal delay-2"><span class="help-step">02</span><h4>Dashboard</h4><ul><li>Use Refresh to synchronize your public roster and club matches.</li><li>Member Growth compares the live roster with your goal.</li><li>Local Records open the corresponding managers.</li><li>The Command Feed records actions completed through the extension.</li></ul></article>
        <article id="help-context" class="help-card help-reveal delay-3"><span class="help-step">03</span><h4>Context Sidebar</h4><ul><li>Open a player profile for prospect, member, note, and message actions.</li><li>Open a club page to save it, classify the relationship, or draft outreach.</li><li>The viewed page never changes your Home Club or Message Club automatically.</li></ul></article>
        <article id="help-messages" class="help-card help-reveal delay-1"><span class="help-step">04</span><h4>Message Builder</h4><ul><li>Choose a message type and template.</li><li>Select the club whose links and branding should be used.</li><li>Use Copy HTML for rich-text editors and Copy Plain Text for stripped editors or direct messages.</li><li>Preview the result before posting because Chess.com may sanitize some markup.</li></ul></article>
        <article id="help-members" class="help-card help-reveal delay-2"><span class="help-step">05</span><h4>Members & Prospects</h4><ul><li>Member Manager can import the public roster for your Home Club.</li><li>Roster sync updates public data while preserving private notes and history.</li><li>Prospect Manager tracks discovered, invited, follow-up, and joined players.</li></ul></article>
        <article id="help-clubs" class="help-card help-reveal delay-3"><span class="help-step">06</span><h4>Club Manager</h4><ul><li>Your Home Club is added after first-run setup.</li><li>Other clubs begin empty and are added manually or from the context sidebar.</li><li>Classify external clubs as partners, community clubs, or other relationships.</li></ul></article>
        <article id="help-troubleshooting" class="help-card help-reveal delay-1"><span class="help-step">07</span><h4>Troubleshooting</h4><ol><li>Confirm you are on a Chess.com page when using context tools.</li><li>Verify the Home Club URL and slug in Settings if live data fails.</li><li>Reload Club Assistant from <code>chrome://extensions</code> after updating files.</li><li>Open the extension error panel for the exact JavaScript error.</li></ol></article>
      </div>
    </section>`;
  document.querySelectorAll("[data-help-target]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.helpTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  initializeHelpMatrix(settings.animationMode || "cinematic");
}

function initializeHelpMatrix(mode) {
  const canvas = document.querySelector("#helpMatrix");
  if (!canvas || mode === "reduced") return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const characters = "CLUB01KQRBNe4Nf30-0+#";
  const fontSize = mode === "cinematic" ? 15 : 18;
  let columns = 0;
  let drops = [];
  let frameId = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    columns = Math.ceil(rect.width / fontSize);
    drops = Array.from({ length: columns }, () => Math.random() * -30);
  };

  const draw = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.fillStyle = "rgba(5,10,5,0.10)";
    context.fillRect(0, 0, width, height);
    context.font = `${fontSize}px Consolas, monospace`;
    context.fillStyle = mode === "cinematic" ? "rgba(91,215,80,.30)" : "rgba(91,215,80,.18)";
    drops.forEach((drop, index) => {
      const character = characters[Math.floor(Math.random() * characters.length)];
      context.fillText(character, index * fontSize, drop * fontSize);
      if (drop * fontSize > height && Math.random() > 0.975) drops[index] = 0;
      else drops[index] += mode === "cinematic" ? 0.42 : 0.25;
    });
    frameId = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize, { once: true });
  draw();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    }
  });
  observer.observe(sectionContent, { childList: true });
}

function extractClubSlug(url) {
  try { const parsed = new URL(url); const match = parsed.pathname.match(/\/club\/([^/?#]+)/i); return match ? match[1] : ""; }
  catch { return String(url || "").replace(/^.*\/club\//i, "").split(/[/?#]/)[0]; }
}
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function renderOwnerSetup() {
  sectionTitle.textContent = "First-Run Setup";
  sectionDescription.textContent = "Create your club command center.";
  sectionContent.innerHTML = `
    <section class="owner-setup-shell">
      <img class="owner-setup-product-logo" src="${LOCAL_LOGO_PATH}" alt="Club Assistant logo">
      <p class="panel-kicker">CLUB OWNER EDITION</p>
      <h3>Build Your Command Center</h3>
      <p>Connect your primary Chess.com club, upload its logo, and choose its command-center identity.</p>
      <form id="ownerSetupForm" class="owner-setup-form">
        <label>Club Name<input id="setupClubName" required placeholder="Your Club Name"></label>
        <label>Chess.com Club URL<input id="setupClubUrl" type="url" required placeholder="https://www.chess.com/club/your-club"></label>
        <label>Club Logo<input id="setupClubLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
        <div class="owner-color-grid"><label>Primary Color<input id="setupPrimaryColor" type="color" value="#262522"></label><label>Accent Color<input id="setupAccentColor" type="color" value="#81b64c"></label></div>
        <label>Club Motto<input id="setupMotto" value="Every Player Belongs • Every Move Matters."></label>
        <label>Member Goal<input id="setupMemberGoal" type="number" min="1" value="250"></label>
        <button type="submit">Activate Command Center</button>
      </form>
      <small class="owner-setup-credit">Professional Club Management Suite</small>
    </section>`;
  document.querySelector("#ownerSetupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const clubUrl = document.querySelector("#setupClubUrl").value.trim();
    const slug = extractClubSlug(clubUrl);
    if (!slug) return alert("Enter a valid Chess.com club URL.");
    const file = document.querySelector("#setupClubLogo").files?.[0];
    const settings = await getSettings();
    await saveSettings({ ...settings, setupComplete:true, clubName:document.querySelector("#setupClubName").value.trim(), clubUrl, homeClubSlug:slug, messageClubSlug:slug, customLogoData:file ? await fileToDataUrl(file) : "", primaryColor:document.querySelector("#setupPrimaryColor").value, accentColor:document.querySelector("#setupAccentColor").value, defaultSignature:document.querySelector("#setupMotto").value.trim(), memberGoal:Math.max(1, Number(document.querySelector("#setupMemberGoal").value)||250) });
    await showSection("dashboard");
  });
}

async function findChessTab() {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => /^https:\/\/(www\.)?chess\.com\//i.test(tab.url || ""));
}

async function returnToChessAndOpenSidebar(openPanel = true) {
  let tab = await findChessTab();
  if (!tab) tab = await chrome.tabs.create({ url: "https://www.chess.com/", active: true });
  else {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
  }
  if (openPanel && tab?.id != null) {
    try { await chrome.sidePanel.open({ tabId: tab.id }); }
    catch (error) { console.warn("Sidebar could not be opened automatically.", error); }
  }
}

returnToChessButton?.addEventListener("click", () => returnToChessAndOpenSidebar(false));
reopenSidebarButton?.addEventListener("click", () => returnToChessAndOpenSidebar(true));

async function showSection(sectionName) {
  const resolvedName = sections[sectionName]
    ? sectionName
    : "dashboard";

  const resolvedSection =
    sections[resolvedName];

  sectionTitle.textContent =
    resolvedSection.title;

  sectionDescription.textContent =
    resolvedSection.description;

  await migrateClubOwnerEdition();

navigationButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.section === resolvedName
    );
  });

  try {
    sectionContent.classList.remove("module-enter");
    await resolvedSection.render(resolvedName);
    enhanceRenderedModule(resolvedName);
    requestAnimationFrame(() => sectionContent.classList.add("module-enter"));
  } catch (error) {
    console.error(
      `Unable to render section: ${resolvedName}`,
      error
    );

    sectionContent.innerHTML = `
      <div class="welcome-card">
        <h3>Unable to Open This Module</h3>

        <p>
          Reload the extension and try again. If the problem continues, open the Help Board for recovery steps.
        </p>
      </div>
    `;
  }
}

helpModeButton?.addEventListener("click", openHelpOverlay);

navigationButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await showSection(
      button.dataset.section
    );
  });
});

const initialParameters =
  new URLSearchParams(window.location.search);

const initialSection =
  initialParameters.get("section") ||
  "dashboard";

showSection(initialSection);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelector(".ux-help-overlay")?.remove();
  if ((event.ctrlKey || event.metaKey) && event.key === "/") { event.preventDefault(); openHelpOverlay(); }
});

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
          <img class="ca-easter-logo" src="../assests/lady-justice-logo.jpg" alt="Lady Justice logo">
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
