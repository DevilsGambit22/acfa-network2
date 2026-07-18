const TEMPLATE_STORAGE_KEY = "messageTemplates";
const TEMPLATE_SEEDED_KEY = "starterTemplatesSeededV1";

const starterTemplates = [
  {
    id: "builtin-general-announcement",
    builtIn: true,
    category: "Announcements",
    messageType: "announcement",
    name: "General Club Announcement",
    title: "{announcement_title}",
    body: "Hello, {club_name} community!\n\n{announcement_body}\n\nThank you for being part of our growing chess family.",
    includeClub: false,
    includeDiscord: true,
    includeWebsite: true,
    includeTwitch: false,
    includeUpgrade: false
  },
  {
    id: "builtin-event-announcement",
    builtIn: true,
    category: "Announcements",
    messageType: "event",
    name: "HTML Event Announcement",
    title: "{event_name}",
    body: "Join us for {event_name} on {event_date} at {event_time}.\n\n{event_description}\n\nPlayers of every rating are welcome. We hope to see you there!",
    includeClub: true,
    includeDiscord: true,
    includeWebsite: false,
    includeTwitch: false,
    includeUpgrade: false
  },
  {
    id: "builtin-forum-advertisement",
    builtIn: true,
    category: "Forum Posts",
    messageType: "forum",
    name: "HTML Club Forum Advertisement",
    title: "Every Player Belongs. Every Move Matters.",
    body: "Looking for a welcoming and active Chess.com community? {club_name} brings players together through team matches, Vote Chess, tournaments, community events, and friendly competition.\n\nJoin us and become part of a club built for players of every rating and background.",
    includeClub: true,
    includeDiscord: true,
    includeWebsite: true,
    includeTwitch: true,
    includeUpgrade: false
  },
  {
    id: "builtin-club-invitation",
    builtIn: true,
    category: "Direct Messages",
    messageType: "invitation",
    name: "Club Invitation",
    title: "You’re Invited to {club_name}",
    body: "Hello {username}! I’d like to personally invite you to join {club_name}. We are building a welcoming community where players of every rating can play, improve, and connect. We would be glad to have you with us.",
    includeClub: true,
    includeDiscord: false,
    includeWebsite: false,
    includeTwitch: false,
    includeUpgrade: false
  },
  {
    id: "builtin-partnership",
    builtIn: true,
    category: "Club Relations",
    messageType: "partnership",
    name: "Partnership Proposal",
    title: "A Partnership Between Our Clubs",
    body: "Hello! I’m reaching out on behalf of {club_name}. We would be interested in building a friendly partnership with your club through matches, shared events, and community support. Please let us know if your team would be interested.",
    includeClub: true,
    includeDiscord: true,
    includeWebsite: false,
    includeTwitch: false,
    includeUpgrade: false
  },
  {
    id: "builtin-welcome-member",
    builtIn: true,
    category: "Direct Messages",
    messageType: "message",
    name: "New Member Welcome",
    title: "Welcome to {club_name}",
    body: "Welcome, {username}! We’re happy to have you in {club_name}. Take a look around, join an event or team match, and feel free to introduce yourself to the community.",
    includeClub: false,
    includeDiscord: true,
    includeWebsite: true,
    includeTwitch: false,
    includeUpgrade: false
  },
  {
    id: "builtin-match-result",
    builtIn: true,
    category: "Announcements",
    messageType: "announcement",
    name: "Match Result Announcement",
    title: "Match Result: {club_name} vs {opponent}",
    body: "The match between {club_name} and {opponent} has concluded.\n\nFinal result: {result}\n\nThank you to every player who represented the club. Every board and every move mattered.",
    includeClub: true,
    includeDiscord: false,
    includeWebsite: false,
    includeTwitch: false,
    includeUpgrade: false
  },
  {
    id: "builtin-follow-up",
    builtIn: true,
    category: "Recruitment",
    messageType: "message",
    name: "Recruitment Follow-Up",
    title: "Following Up From {club_name}",
    body: "Hello {username}! I wanted to follow up on the invitation to {club_name}. There is no pressure at all—we would simply be glad to welcome you if the community feels like a good fit.",
    includeClub: true,
    includeDiscord: false,
    includeWebsite: false,
    includeTwitch: false,
    includeUpgrade: false
  }
];

async function ensureStarterTemplates() {
  const result = await chrome.storage.local.get([TEMPLATE_STORAGE_KEY, TEMPLATE_SEEDED_KEY]);
  const existing = Array.isArray(result[TEMPLATE_STORAGE_KEY]) ? result[TEMPLATE_STORAGE_KEY] : [];
  if (result[TEMPLATE_SEEDED_KEY]) return existing;
  const existingIds = new Set(existing.map((template) => template.id));
  const merged = [...starterTemplates.filter((template) => !existingIds.has(template.id)), ...existing];
  await chrome.storage.local.set({
    [TEMPLATE_STORAGE_KEY]: merged,
    [TEMPLATE_SEEDED_KEY]: true
  });
  return merged;
}

export async function getTemplates() {
  return ensureStarterTemplates();
}

export async function saveTemplate(template) {
  const templates = await getTemplates();
  const newTemplate = {
    id: crypto.randomUUID(),
    builtIn: false,
    category: template.category || "Custom",
    messageType: template.messageType || "announcement",
    name: template.name,
    title: template.title,
    body: template.body,
    includeClub: template.includeClub,
    includeDiscord: template.includeDiscord,
    includeWebsite: template.includeWebsite,
    includeTwitch: template.includeTwitch,
    includeUpgrade: template.includeUpgrade,
    createdAt: new Date().toISOString()
  };
  templates.push(newTemplate);
  await chrome.storage.local.set({ [TEMPLATE_STORAGE_KEY]: templates });
  return newTemplate;
}

export async function deleteTemplate(templateId) {
  const templates = await getTemplates();
  const target = templates.find((template) => template.id === templateId);
  if (target?.builtIn) return false;
  await chrome.storage.local.set({
    [TEMPLATE_STORAGE_KEY]: templates.filter((template) => template.id !== templateId)
  });
  return true;
}

export async function updateTemplate(templateId, changes) {
  const templates = await getTemplates();
  const updatedTemplates = templates.map((template) => template.id === templateId
    ? { ...template, ...changes, updatedAt: new Date().toISOString() }
    : template);
  await chrome.storage.local.set({ [TEMPLATE_STORAGE_KEY]: updatedTemplates });
}

export async function restoreStarterTemplates() {
  await chrome.storage.local.remove(TEMPLATE_SEEDED_KEY);
  return ensureStarterTemplates();
}
