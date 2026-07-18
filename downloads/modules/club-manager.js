const CLUB_STORAGE_KEY = "managedClubs";
const ACTIVE_CLUB_KEY = "activeClubId";

const DEFAULT_CLUBS = [];

async function initializeClubs() {
  const result = await chrome.storage.local.get([CLUB_STORAGE_KEY, ACTIVE_CLUB_KEY, "settings"]);
  const settings = result.settings || {};
  const savedClubs = Array.isArray(result[CLUB_STORAGE_KEY]) ? result[CLUB_STORAGE_KEY] : [];
  const clubs = [...savedClubs];
  const slug = String(settings.homeClubSlug || "").trim();
  if (settings.setupComplete && slug) {
    let home = clubs.find((club) => String(club.slug || "").toLowerCase() === slug.toLowerCase());
    const payload = {
      name: settings.clubName || slug,
      slug,
      clubUrl: settings.clubUrl || `https://www.chess.com/club/${slug}`,
      affiliateUrl: "",
      clubType: "managed",
      status: "active",
      websiteUrl: settings.websiteUrl || "",
      discordUrl: settings.discordUrl || "",
      twitchUrl: settings.twitchUrl || "",
      primaryColor: settings.primaryColor || "#262522",
      accentColor: settings.accentColor || "#81b64c",
      messageFooter: settings.defaultSignature || "",
      contactName: "",
      notes: "Primary managed club.",
      updatedAt: new Date().toISOString()
    };
    if (home) Object.assign(home, payload);
    else {
      home = { id: crypto.randomUUID(), ...payload, dateAdded: new Date().toISOString() };
      clubs.unshift(home);
    }
    await chrome.storage.local.set({ [CLUB_STORAGE_KEY]: clubs, [ACTIVE_CLUB_KEY]: result[ACTIVE_CLUB_KEY] || home.id });
    return;
  }
  await chrome.storage.local.set({ [CLUB_STORAGE_KEY]: clubs, [ACTIVE_CLUB_KEY]: result[ACTIVE_CLUB_KEY] || clubs[0]?.id || "" });
}

async function getClubs() {
  await initializeClubs();

  const result = await chrome.storage.local.get(
    CLUB_STORAGE_KEY
  );

  return result[CLUB_STORAGE_KEY] ?? [];
}

async function saveClubs(clubs) {
  await chrome.storage.local.set({
    [CLUB_STORAGE_KEY]: clubs
  });
}

async function getActiveClubId() {
  await initializeClubs();

  const result = await chrome.storage.local.get(
    ACTIVE_CLUB_KEY
  );

  return result[ACTIVE_CLUB_KEY] ?? "";
}

async function setActiveClubId(clubId) {
  await chrome.storage.local.set({
    [ACTIVE_CLUB_KEY]: clubId
  });
}

async function addClub(clubData) {
  const clubs = await getClubs();

  const duplicate = clubs.some(
    (club) =>
      club.name.toLowerCase() ===
      clubData.name.toLowerCase()
  );

  if (duplicate) {
    throw new Error("A club with that name already exists.");
  }

  const club = {
    id: crypto.randomUUID(),
    ...clubData,
    dateAdded: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  clubs.unshift(club);

  await saveClubs(clubs);

  return club;
}

async function updateClub(clubId, changes) {
  const clubs = await getClubs();

  const updatedClubs = clubs.map((club) => {
    if (club.id !== clubId) {
      return club;
    }

    return {
      ...club,
      ...changes,
      updatedAt: new Date().toISOString()
    };
  });

  await saveClubs(updatedClubs);
}

async function deleteClub(clubId) {
  const clubs = await getClubs();
  const activeClubId = await getActiveClubId();

  const updatedClubs = clubs.filter(
    (club) => club.id !== clubId
  );

  await saveClubs(updatedClubs);

  if (activeClubId === clubId) {
    await setActiveClubId(
      updatedClubs[0]?.id ?? ""
    );
  }
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatClubType(type) {
  const types = {
    managed: "Managed Club",
    partner: "Partner Club",
    community: "Community Club",
    other: "Other"
  };

  return types[type] ?? "Other";
}

function formatClubStatus(status) {
  const statuses = {
    active: "Active",
    planned: "Planned",
    inactive: "Inactive",
    archived: "Archived"
  };

  return statuses[status] ?? "Active";
}

function readClubForm() {
  return {
    name:
      document.querySelector("#clubManagerName").value.trim(),

    slug:
      document.querySelector("#clubManagerSlug").value.trim(),

    clubUrl:
      document.querySelector("#clubManagerUrl").value.trim(),

    affiliateUrl:
      document
        .querySelector("#clubManagerAffiliateUrl")
        .value
        .trim(),

    clubType:
      document.querySelector("#clubManagerType").value,

    status:
      document.querySelector("#clubManagerStatus").value,

    websiteUrl:
      document
        .querySelector("#clubManagerWebsite")
        .value
        .trim(),

    discordUrl:
      document
        .querySelector("#clubManagerDiscord")
        .value
        .trim(),

    twitchUrl:
      document
        .querySelector("#clubManagerTwitch")
        .value
        .trim(),

    primaryColor:
      document
        .querySelector("#clubManagerPrimaryColor")
        .value,

    accentColor:
      document
        .querySelector("#clubManagerAccentColor")
        .value,

    messageFooter:
      document
        .querySelector("#clubManagerFooter")
        .value
        .trim(),

    contactName:
      document
        .querySelector("#clubManagerContact")
        .value
        .trim(),

    notes:
      document.querySelector("#clubManagerNotes").value.trim()
  };
}

function clearClubForm() {
  document.querySelector("#clubManagerForm").reset();

  document.querySelector("#editingClubId").value = "";
  document.querySelector("#clubManagerType").value = "managed";
  document.querySelector("#clubManagerStatus").value =
    "active";

  document.querySelector(
    "#clubManagerPrimaryColor"
  ).value = "#0b0906";

  document.querySelector(
    "#clubManagerAccentColor"
  ).value = "#d6a84b";

  document.querySelector("#saveClubButton").textContent =
    "Add Club";

  document.querySelector("#cancelClubEditButton").hidden =
    true;
}

function showClubStatus(message, isError = false) {
  const status = document.querySelector(
    "#clubStatusMessage"
  );

  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle("error-status", isError);

  window.setTimeout(() => {
    status.textContent = "";
    status.classList.remove("error-status");
  }, 3000);
}

function createClubCard(club, activeClubId) {
  const isActive = club.id === activeClubId;

  return `
    <article class="club-card">
      <div class="club-card-header">
        <div>
          <h3>${escapeText(club.name)}</h3>

          <p class="club-card-type">
            ${escapeText(formatClubType(club.clubType))}
            •
            ${escapeText(formatClubStatus(club.status))}
          </p>
        </div>

        ${
          isActive
            ? `
              <span class="active-club-badge">
                Active Club
              </span>
            `
            : ""
        }
      </div>

      <div class="club-color-preview">
        <span
          style="background:${escapeText(
            club.primaryColor
          )}"
        ></span>

        <span
          style="background:${escapeText(
            club.accentColor
          )}"
        ></span>
      </div>

      <div class="club-card-details">
        ${
          club.slug
            ? `
              <p>
                <strong>Slug:</strong>
                ${escapeText(club.slug)}
              </p>
            `
            : ""
        }

        ${
          club.contactName
            ? `
              <p>
                <strong>Contact:</strong>
                ${escapeText(club.contactName)}
              </p>
            `
            : ""
        }

        ${
          club.messageFooter
            ? `
              <p>
                <strong>Footer:</strong>
                ${escapeText(club.messageFooter)}
              </p>
            `
            : ""
        }
      </div>

      ${
        club.notes
          ? `
            <div class="club-notes">
              ${escapeText(club.notes)}
            </div>
          `
          : ""
      }

      <div class="club-link-actions">
        ${
          club.clubUrl
            ? `
              <a
                href="${escapeText(club.clubUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Club
              </a>
            `
            : ""
        }

        ${
          club.websiteUrl
            ? `
              <a
                href="${escapeText(club.websiteUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Website
              </a>
            `
            : ""
        }

        ${
          club.discordUrl
            ? `
              <a
                href="${escapeText(club.discordUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord
              </a>
            `
            : ""
        }

        ${
          club.twitchUrl
            ? `
              <a
                href="${escapeText(club.twitchUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Twitch
              </a>
            `
            : ""
        }
      </div>

      <div class="club-actions">
        ${
          !isActive
            ? `
              <button
                type="button"
                class="activate-club-button"
                data-club-id="${club.id}"
              >
                Make Active
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="edit-club-button"
          data-club-id="${club.id}"
        >
          Edit
        </button>

        <button
          type="button"
          class="delete-club-button"
          data-club-id="${club.id}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

async function renderClubList(searchText = "") {
  const container = document.querySelector("#clubList");

  if (!container) {
    return;
  }

  const clubs = await getClubs();
  const activeClubId = await getActiveClubId();

  const search = searchText.trim().toLowerCase();

  const filteredClubs = clubs.filter((club) => {
    if (!search) {
      return true;
    }

    return [
      club.name,
      club.slug,
      club.clubType,
      club.status,
      club.contactName,
      club.notes
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(search)
    );
  });

  if (filteredClubs.length === 0) {
    container.innerHTML = `
      <div class="welcome-card">
        <h3>No Clubs Found</h3>
        <p>Add a club using the form above.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="club-grid">
      ${filteredClubs
        .map((club) =>
          createClubCard(club, activeClubId)
        )
        .join("")}
    </div>
  `;

  document
    .querySelectorAll(".activate-club-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await setActiveClubId(button.dataset.clubId);
        await renderClubList(
          document.querySelector("#clubSearch").value
        );
        showClubStatus("Active club changed.");
      });
    });

  document
    .querySelectorAll(".edit-club-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await loadClubIntoForm(button.dataset.clubId);
      });
    });

  document
    .querySelectorAll(".delete-club-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleDeleteClub(button.dataset.clubId);
      });
    });
}

async function loadClubIntoForm(clubId) {
  const clubs = await getClubs();

  const club = clubs.find(
    (item) => item.id === clubId
  );

  if (!club) {
    return;
  }

  document.querySelector("#editingClubId").value = club.id;
  document.querySelector("#clubManagerName").value =
    club.name ?? "";
  document.querySelector("#clubManagerSlug").value =
    club.slug ?? "";
  document.querySelector("#clubManagerUrl").value =
    club.clubUrl ?? "";
  document.querySelector(
    "#clubManagerAffiliateUrl"
  ).value = club.affiliateUrl ?? "";
  document.querySelector("#clubManagerType").value =
    club.clubType ?? "managed";
  document.querySelector("#clubManagerStatus").value =
    club.status ?? "active";
  document.querySelector("#clubManagerWebsite").value =
    club.websiteUrl ?? "";
  document.querySelector("#clubManagerDiscord").value =
    club.discordUrl ?? "";
  document.querySelector("#clubManagerTwitch").value =
    club.twitchUrl ?? "";
  document.querySelector(
    "#clubManagerPrimaryColor"
  ).value = club.primaryColor ?? "#0b0906";
  document.querySelector(
    "#clubManagerAccentColor"
  ).value = club.accentColor ?? "#d6a84b";
  document.querySelector("#clubManagerFooter").value =
    club.messageFooter ?? "";
  document.querySelector("#clubManagerContact").value =
    club.contactName ?? "";
  document.querySelector("#clubManagerNotes").value =
    club.notes ?? "";

  document.querySelector("#saveClubButton").textContent =
    "Save Changes";

  document.querySelector("#cancelClubEditButton").hidden =
    false;

  document
    .querySelector("#clubManagerForm")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

async function handleClubSubmit(event) {
  event.preventDefault();

  const clubData = readClubForm();
  const editingClubId =
    document.querySelector("#editingClubId").value;

  if (!clubData.name) {
    showClubStatus("A club name is required.", true);
    return;
  }

  try {
    if (editingClubId) {
      await updateClub(editingClubId, clubData);
      showClubStatus("Club updated.");
    } else {
      await addClub(clubData);
      showClubStatus("Club added.");
    }

    clearClubForm();

    await renderClubList(
      document.querySelector("#clubSearch").value
    );
  } catch (error) {
    showClubStatus(
      error.message || "Unable to save club.",
      true
    );
  }
}

async function handleDeleteClub(clubId) {
  const confirmed = window.confirm(
    "Delete this club record?"
  );

  if (!confirmed) {
    return;
  }

  await deleteClub(clubId);

  await renderClubList(
    document.querySelector("#clubSearch").value
  );

  showClubStatus("Club deleted.");
}

export async function renderClubManager(container) {
  await initializeClubs();

  container.innerHTML = `
    <div class="club-manager">
      <form id="clubManagerForm" class="settings-card">
        <input id="editingClubId" type="hidden">

        <h3>Add or Edit Club</h3>

        <div class="club-form-grid">
          <label>
            Club Name
            <input
              id="clubManagerName"
              type="text"
              required
            >
          </label>

          <label>
            Chess.com Slug
            <input
              id="clubManagerSlug"
              type="text"
              placeholder="your-club-slug"
            >
          </label>

          <label>
            Club URL
            <input
              id="clubManagerUrl"
              type="url"
            >
          </label>

          <label>
            Affiliate Club URL
            <input
              id="clubManagerAffiliateUrl"
              type="url"
            >
          </label>

          <label>
            Club Type
            <select id="clubManagerType">
              <option value="managed">Managed Club</option>
              <option value="partner">Partner Club</option>
              <option value="community">
                Community Club
              </option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Status
            <select id="clubManagerStatus">
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label>
            Website URL
            <input
              id="clubManagerWebsite"
              type="url"
            >
          </label>

          <label>
            Discord URL
            <input
              id="clubManagerDiscord"
              type="url"
            >
          </label>

          <label>
            Twitch URL
            <input
              id="clubManagerTwitch"
              type="url"
            >
          </label>

          <label>
            Contact or Owner
            <input
              id="clubManagerContact"
              type="text"
              placeholder="@Username"
            >
          </label>

          <label>
            Primary Color
            <input
              id="clubManagerPrimaryColor"
              type="color"
              value="#0b0906"
            >
          </label>

          <label>
            Accent Color
            <input
              id="clubManagerAccentColor"
              type="color"
              value="#d6a84b"
            >
          </label>
        </div>

        <label>
          Default Message Footer
          <textarea
            id="clubManagerFooter"
            rows="3"
          ></textarea>
        </label>

        <label>
          Internal Notes
          <textarea
            id="clubManagerNotes"
            rows="4"
          ></textarea>
        </label>

        <div class="club-form-actions">
          <button
            id="saveClubButton"
            type="submit"
            class="primary-action"
          >
            Add Club
          </button>

          <button
            id="cancelClubEditButton"
            type="button"
            class="secondary-action"
            hidden
          >
            Cancel Edit
          </button>

          <span
            id="clubStatusMessage"
            class="settings-status"
          ></span>
        </div>
      </form>

      <section class="settings-card">
        <div class="club-list-heading">
          <h3>Managed Clubs</h3>

          <input
            id="clubSearch"
            type="search"
            placeholder="Search clubs"
          >
        </div>

        <div id="clubList"></div>
      </section>
    </div>
  `;

  document
    .querySelector("#clubManagerForm")
    .addEventListener("submit", handleClubSubmit);

  document
    .querySelector("#cancelClubEditButton")
    .addEventListener("click", clearClubForm);

  document
    .querySelector("#clubSearch")
    .addEventListener("input", (event) => {
      renderClubList(event.target.value);
    });

  await renderClubList();
}

export {
  getActiveClubId,
  getClubs
};
