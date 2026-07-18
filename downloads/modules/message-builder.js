import { getSettings } from "./storage.js";
import { saveTemplate } from "./templates.js";
import { logActivity } from "./activity.js";

import {
  getActiveClubId,
  getClubs
} from "./club-manager.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createButton(
  label,
  url,
  background,
  color = "#ffffff",
  accent = "#81b64c"
) {
  if (!url) {
    return "";
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 10px;border-collapse:separate"><tr><td align="center" style="border:1px solid ${escapeHtml(accent)};border-radius:999px;background:${escapeHtml(background)};padding:0"><a href="${escapeHtml(url)}" style="display:block;padding:13px 18px;border-radius:999px;color:${escapeHtml(color)};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;line-height:1.2;text-align:center;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}
async function getMessageClub(settings = null) {
  const resolvedSettings = settings || await getSettings();
  const clubs = await getClubs();
  const preferredSlug = resolvedSettings.messageClubSlug || resolvedSettings.homeClubSlug;

  return (
    clubs.find((club) => club.slug === preferredSlug) ??
    clubs.find((club) => club.slug === resolvedSettings.homeClubSlug) ??
    clubs[0] ??
    null
  );
}

function buildMessageContext(activeClub, settings) {
  if (!activeClub) {
    return {
      clubName: settings.clubName || "My Club",
      clubUrl: settings.clubUrl || "",
      websiteUrl: settings.websiteUrl || "",
      discordUrl: settings.discordUrl || "",
      twitchUrl: settings.twitchUrl || "",
      primaryColor: "#262522",
      accentColor: "#81b64c",
      messageFooter:
        settings.defaultSignature ||
        "Every Player Belongs • Every Move Matters."
    };
  }

  return {
    clubName:
      activeClub.name ||
      settings.clubName ||
      "My Club",

    clubUrl:
      activeClub.affiliateUrl ||
      activeClub.clubUrl ||
      settings.clubUrl ||
      "",

    websiteUrl:
      activeClub.websiteUrl ||
      settings.websiteUrl ||
      "",

    discordUrl:
      activeClub.discordUrl ||
      settings.discordUrl ||
      "",

    twitchUrl:
      activeClub.twitchUrl ||
      settings.twitchUrl ||
      "",

    primaryColor:
      activeClub.primaryColor ||
      "#262522",

    accentColor:
      activeClub.accentColor ||
      "#81b64c",

    messageFooter:
      activeClub.messageFooter ||
      settings.defaultSignature ||
      "Every Player Belongs • Every Move Matters."
  };
}

function createHtmlMessage(
  formData,
  context,
  settings
) {
  const buttons = [];

  if (formData.includeClub) {
    buttons.push(
      createButton(
        `Join ${context.clubName}`,
        context.clubUrl,
        context.accentColor,
        "#ffffff",
        context.accentColor
      )
    );
  }

  if (formData.includeDiscord) {
    buttons.push(
      createButton(
        "Join Discord",
        context.discordUrl,
        "#5865f2",
        "#ffffff",
        context.accentColor
      )
    );
  }

  if (formData.includeWebsite) {
    buttons.push(
      createButton(
        "Visit Website",
        context.websiteUrl,
        "#f8eed8",
        "#ffffff",
        context.accentColor
      )
    );
  }

  if (formData.includeTwitch) {
    buttons.push(
      createButton(
        "Watch on Twitch",
        context.twitchUrl,
        "#9146ff",
        "#ffffff",
        context.accentColor
      )
    );
  }

  if (formData.includeUpgrade) {
    buttons.push(
      createButton(
        "Support Club",
        settings.upgradeUrl,
        "#4aa3df",
        "#ffffff",
        context.accentColor
      )
    );
  }

  const title = escapeHtml(formData.title);

  const body = escapeHtml(formData.body)
    .replaceAll("\n", "<br>");

  const footer = escapeHtml(
    context.messageFooter
  );

  const safeAccent = escapeHtml(context.accentColor);
  const safePrimary = escapeHtml(context.primaryColor);

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px;margin:20px auto;border:3px solid ${safeAccent};border-radius:24px;border-collapse:separate;background:${safePrimary};color:#f8eed8;font-family:Arial,Helvetica,sans-serif;text-align:center"><tr><td style="overflow:hidden;border-radius:20px;background:${safePrimary}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate"><tr><td style="padding:14px 20px;border-radius:19px 19px 0 0;background:${safeAccent};color:#160f05;font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase">${escapeHtml(context.clubName)} • ${escapeHtml(formData.messageType || "Message")}</td></tr><tr><td style="padding:30px 22px 24px;border-radius:0 0 19px 19px;background:${safePrimary}"><marquee behavior="alternate" direction="left" scrollamount="3" scrolldelay="45" style="display:block;margin:0 0 14px;color:${safeAccent};font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase">${footer} &nbsp; ♛ &nbsp; ${escapeHtml(context.clubName)} &nbsp; ♛ &nbsp; ${footer}</marquee><h2 style="margin:0 0 16px;color:#fff4d2;font-size:26px;line-height:1.25">${title}</h2><div style="color:#f8eed8;font-size:16px;line-height:1.65">${body}</div>${buttons.length ? `<div style="width:100%;max-width:390px;margin:22px auto 0">${buttons.join("")}</div>` : ""}<div style="margin-top:24px;padding-top:14px;border-top:1px solid ${safeAccent};color:#c9b98f;font-size:13px;font-weight:700">${footer}</div></td></tr></table></td></tr></table>`;
}

function createPlainTextMessage(
  formData,
  context,
  settings
) {
  const links = [];

  if (
    formData.includeClub &&
    context.clubUrl
  ) {
    links.push(
      `Join ${context.clubName}: ${context.clubUrl}`
    );
  }

  if (
    formData.includeDiscord &&
    context.discordUrl
  ) {
    links.push(
      `Discord: ${context.discordUrl}`
    );
  }

  if (
    formData.includeWebsite &&
    context.websiteUrl
  ) {
    links.push(
      `Website: ${context.websiteUrl}`
    );
  }

  if (
    formData.includeTwitch &&
    context.twitchUrl
  ) {
    links.push(
      `Twitch: ${context.twitchUrl}`
    );
  }

  if (
    formData.includeUpgrade &&
    settings.upgradeUrl
  ) {
    links.push(
      `Support Club: ${settings.upgradeUrl}`
    );
  }

  return [
    context.clubName,
    "",
    formData.title.trim(),
    "",
    formData.body.trim(),
    links.length ? "" : null,
    ...links,
    "",
    context.messageFooter
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function readMessageForm() {
  return {
    messageType: document.querySelector("#messageType")?.value || "message",

    title:
      document
        .querySelector("#messageTitle")
        .value,

    body:
      document
        .querySelector("#messageBody")
        .value,

    includeClub:
      document
        .querySelector("#includeClub")
        .checked,

    includeDiscord:
      document
        .querySelector("#includeDiscord")
        .checked,

    includeWebsite:
      document
        .querySelector("#includeWebsite")
        .checked,

    includeTwitch:
      document
        .querySelector("#includeTwitch")
        .checked,

    includeUpgrade:
      document
        .querySelector("#includeUpgrade")
        .checked
  };
}

function showBuilderStatus(message) {
  const status =
    document.querySelector("#builderStatus");

  if (!status) {
    return;
  }

  status.textContent = message;

  window.setTimeout(() => {
    status.textContent = "";
  }, 2500);
}

async function updatePreview() {
  const settings = await getSettings();
  const activeClub = await getMessageClub(settings);

  const context = buildMessageContext(
    activeClub,
    settings
  );

  const formData = readMessageForm();

  document.querySelector("#htmlOutput").value =
    createHtmlMessage(
      formData,
      context,
      settings
    );

  document.querySelector(
    "#plainTextOutput"
  ).value = createPlainTextMessage(
    formData,
    context,
    settings
  );
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

async function copyOutput(
  elementId,
  statusMessage
) {
  const output =
    document.querySelector(elementId);

  if (elementId === "#htmlOutput") {
    await copyFormattedHtml(
      output.value,
      document.querySelector("#plainTextOutput")?.value || ""
    );
    statusMessage = "Formatted HTML copied. Paste directly into Chess.com.";
  } else {
    await navigator.clipboard.writeText(
      output.value
    );
  }

  const settings = await getSettings();
  const activeClub = await getMessageClub(settings);
  await logActivity(elementId === "#htmlOutput" ? "html_message_copied" : "plain_text_message_copied", {
    entityType: "club",
    entityId: activeClub?.slug || settings.messageClubSlug || "",
    clubSlug: activeClub?.slug || settings.messageClubSlug || "",
    source: "message-builder",
    label: statusMessage.replace(/\.$/, ""),
    metadata: { messageType: document.querySelector("#messageType")?.value || "message" }
  });

  showBuilderStatus(statusMessage);
}

async function handleSaveTemplate() {
  const formData = readMessageForm();
  const settings = await getSettings();
  const activeClub = await getMessageClub(settings);

  const templateName = window.prompt(
    "Enter a name for this template:"
  );

  if (!templateName?.trim()) {
    return;
  }

  await saveTemplate({
    name: templateName.trim(),
    activeClubId: activeClub?.id ?? "",
    clubName: activeClub?.name ?? "",
    ...formData
  });

  await logActivity("template_saved", {
    entityType: "template",
    entityId: templateName.trim(),
    clubSlug: activeClub?.slug || "",
    source: "message-builder",
    label: `Template saved: ${templateName.trim()}`
  });

  showBuilderStatus("Template saved.");
}

async function loadActiveTemplate() {
  const result =
    await chrome.storage.local.get(
      "activeMessageTemplate"
    );

  const template =
    result.activeMessageTemplate;

  if (!template) {
    return;
  }

  if (document.querySelector("#messageType")) {
    document.querySelector("#messageType").value = template.messageType || "message";
  }

  document.querySelector(
    "#messageTitle"
  ).value = template.title ?? "";

  document.querySelector(
    "#messageBody"
  ).value = template.body ?? "";

  document.querySelector(
    "#includeClub"
  ).checked = Boolean(
    template.includeClub
  );

  document.querySelector(
    "#includeDiscord"
  ).checked = Boolean(
    template.includeDiscord
  );

  document.querySelector(
    "#includeWebsite"
  ).checked = Boolean(
    template.includeWebsite
  );

  document.querySelector(
    "#includeTwitch"
  ).checked = Boolean(
    template.includeTwitch
  );

  document.querySelector(
    "#includeUpgrade"
  ).checked = Boolean(
    template.includeUpgrade
  );

  await chrome.storage.local.remove(
    "activeMessageTemplate"
  );
}

export async function renderMessageBuilder(
  container
) {
  const settings = await getSettings();
  const activeClub = await getMessageClub(settings);

  const context = buildMessageContext(
    activeClub,
    settings
  );

  container.innerHTML = `
    <div class="builder-layout">
      <section class="settings-card">
        <h3>Message Club</h3>
        <p>The builder defaults to your home club and never follows the club page you are browsing.</p>
        <label>
          Club
          <select id="messageClubSelect">
            ${(await getClubs()).map((club) => `
              <option value="${escapeHtml(club.slug)}" ${club.slug === activeClub?.slug ? "selected" : ""}>
                ${escapeHtml(club.name)}${club.slug === settings.homeClubSlug ? " (Home)" : ""}
              </option>
            `).join("")}
          </select>
        </label>
      </section>

      <section class="settings-card">
        <h3>Message Content</h3>

        <label>
          Message Type
          <select id="messageType">
            <option value="announcement">Announcement</option>
            <option value="message">Direct Message</option>
            <option value="forum">Forum Post</option>
            <option value="invitation">Club Invitation</option>
            <option value="partnership">Partnership Message</option>
            <option value="event">Event Promotion</option>
          </select>
        </label>

        <label>
          Title

          <input
            id="messageTitle"
            type="text"
            value="Join the ${escapeHtml(
              context.clubName
            )} Community"
          >
        </label>

        <label>
          Message

          <textarea
            id="messageBody"
            rows="8"
          >${escapeHtml(
            `${context.clubName} is a welcoming Chess.com community built for players of every rating and background.`
          )}</textarea>
        </label>
      </section>

      <section class="settings-card">
        <h3>Include Buttons and Links</h3>

        <div class="builder-options">
          <label class="checkbox-label">
            <input
              id="includeClub"
              type="checkbox"
              checked
            >

            Join ${escapeHtml(
              context.clubName
            )}
          </label>

          <label class="checkbox-label">
            <input
              id="includeDiscord"
              type="checkbox"
              checked
            >

            Discord
          </label>

          <label class="checkbox-label">
            <input
              id="includeWebsite"
              type="checkbox"
              checked
            >

            Website
          </label>

          <label class="checkbox-label">
            <input
              id="includeTwitch"
              type="checkbox"
              checked
            >

            Twitch
          </label>

          <label class="checkbox-label">
            <input
              id="includeUpgrade"
              type="checkbox"
            >

            Support Club
          </label>
        </div>

        <div class="builder-actions">
          <button
            id="generateMessage"
            type="button"
            class="primary-action"
          >
            Generate Message
          </button>

          <button
            id="saveTemplate"
            type="button"
            class="secondary-action"
          >
            Save as Template
          </button>

          <span
            id="builderStatus"
            class="settings-status"
          ></span>
        </div>
      </section>

      <section class="settings-card">
        <div class="output-heading">
          <h3>HTML Version</h3>

          <button
            id="copyHtml"
            type="button"
            class="small-button"
          >
            Copy HTML
          </button>
        </div>

        <textarea
          id="htmlOutput"
          class="code-output"
          rows="14"
          readonly
        ></textarea>
      </section>

      <section class="settings-card">
        <div class="output-heading">
          <h3>Plain-Text Version</h3>

          <button
            id="copyPlainText"
            type="button"
            class="small-button"
          >
            Copy Plain Text
          </button>
        </div>

        <textarea
          id="plainTextOutput"
          class="code-output"
          rows="12"
          readonly
        ></textarea>
      </section>
    </div>
  `;

  document
    .querySelector("#generateMessage")
    .addEventListener(
      "click",
      updatePreview
    );

  document
    .querySelector("#saveTemplate")
    .addEventListener(
      "click",
      handleSaveTemplate
    );

  document
    .querySelector("#copyHtml")
    .addEventListener("click", () => {
      copyOutput(
        "#htmlOutput",
        "HTML copied."
      );
    });

  document
    .querySelector("#copyPlainText")
    .addEventListener("click", () => {
      copyOutput(
        "#plainTextOutput",
        "Plain text copied."
      );
    });

  await loadActiveTemplate();

  document.querySelector("#messageType").value = settings.defaultMessageType || "announcement";
  document.querySelector("#messageClubSelect")?.addEventListener("change", async (event) => {
    const nextSettings = await getSettings();
    nextSettings.messageClubSlug = event.target.value;
    await chrome.storage.local.set({ settings: nextSettings });
    await renderMessageBuilder(container);
  });

  await updatePreview();
}
