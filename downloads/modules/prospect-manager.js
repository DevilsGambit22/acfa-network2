const PROSPECT_STORAGE_KEY = "prospects";

async function getProspects() {
  const result = await chrome.storage.local.get(
    PROSPECT_STORAGE_KEY
  );

  return result[PROSPECT_STORAGE_KEY] ?? [];
}

async function saveProspects(prospects) {
  await chrome.storage.local.set({
    [PROSPECT_STORAGE_KEY]: prospects
  });
}

async function addProspect(prospectData) {
  const prospects = await getProspects();

  const usernameExists = prospects.some(
    (prospect) =>
      prospect.username.toLowerCase() ===
      prospectData.username.toLowerCase()
  );

  if (usernameExists) {
    throw new Error("That username is already saved.");
  }

  const prospect = {
    id: crypto.randomUUID(),
    username: prospectData.username,
    displayName: prospectData.displayName,
    status: prospectData.status,
    priority: prospectData.priority,
    tags: prospectData.tags,
    notes: prospectData.notes,
    dateAdded: new Date().toISOString(),
    lastContact: prospectData.lastContact || "",
    updatedAt: new Date().toISOString()
  };

  prospects.unshift(prospect);

  await saveProspects(prospects);

  return prospect;
}

async function updateProspect(prospectId, changes) {
  const prospects = await getProspects();

  const updatedProspects = prospects.map((prospect) => {
    if (prospect.id !== prospectId) {
      return prospect;
    }

    return {
      ...prospect,
      ...changes,
      updatedAt: new Date().toISOString()
    };
  });

  await saveProspects(updatedProspects);
}

async function deleteProspect(prospectId) {
  const prospects = await getProspects();

  const updatedProspects = prospects.filter(
    (prospect) => prospect.id !== prospectId
  );

  await saveProspects(updatedProspects);
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Never";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleDateString();
}

function createPriorityStars(priority) {
  const rating = Number(priority) || 1;

  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

function readProspectForm() {
  return {
    username:
      document.querySelector("#prospectUsername").value.trim(),

    displayName:
      document.querySelector("#prospectDisplayName").value.trim(),

    status:
      document.querySelector("#prospectStatus").value,

    priority:
      Number(document.querySelector("#prospectPriority").value),

    tags:
      document.querySelector("#prospectTags").value.trim(),

    lastContact:
      document.querySelector("#prospectLastContact").value,

    notes:
      document.querySelector("#prospectNotes").value.trim()
  };
}

function clearProspectForm() {
  document.querySelector("#prospectForm").reset();
  document.querySelector("#prospectPriority").value = "3";
  document.querySelector("#prospectStatus").value = "not-contacted";
  document.querySelector("#editingProspectId").value = "";
  document.querySelector("#saveProspectButton").textContent =
    "Add Prospect";
  document.querySelector("#cancelEditButton").hidden = true;
}

function showProspectStatus(message, isError = false) {
  const status = document.querySelector("#prospectStatusMessage");

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

function createProspectCard(prospect) {
  const profileUrl = `https://www.chess.com/member/${encodeURIComponent(
    prospect.username
  )}`;

  return `
    <article class="prospect-card">
      <div class="prospect-card-header">
        <div>
          <h3>
            <a
              href="${profileUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              @${escapeText(prospect.username)}
            </a>
          </h3>

          ${
            prospect.displayName
              ? `
                <p class="prospect-display-name">
                  ${escapeText(prospect.displayName)}
                </p>
              `
              : ""
          }
        </div>

        <span class="prospect-priority">
          ${createPriorityStars(prospect.priority)}
        </span>
      </div>

      <div class="prospect-details">
        <p>
          <strong>Status:</strong>
          ${escapeText(formatStatus(prospect.status))}
        </p>

        <p>
          <strong>Added:</strong>
          ${escapeText(formatDate(prospect.dateAdded))}
        </p>

        <p>
          <strong>Last Contact:</strong>
          ${escapeText(formatDate(prospect.lastContact))}
        </p>

        ${
          prospect.tags
            ? `
              <p>
                <strong>Tags:</strong>
                ${escapeText(prospect.tags)}
              </p>
            `
            : ""
        }
      </div>

      ${
        prospect.notes
          ? `
            <div class="prospect-notes">
              ${escapeText(prospect.notes)}
            </div>
          `
          : ""
      }

      <div class="prospect-actions">
        <button
          type="button"
          class="edit-prospect-button"
          data-prospect-id="${prospect.id}"
        >
          Edit
        </button>

        <button
          type="button"
          class="delete-prospect-button"
          data-prospect-id="${prospect.id}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function formatStatus(status) {
  const statuses = {
    "not-contacted": "Not Contacted",
    contacted: "Contacted",
    invited: "Invited",
    interested: "Interested",
    joined: "Joined",
    declined: "Declined"
  };

  return statuses[status] ?? "Not Contacted";
}

async function renderProspectList(searchText = "") {
  const listContainer =
    document.querySelector("#prospectList");

  if (!listContainer) {
    return;
  }

  const prospects = await getProspects();
  const normalizedSearch = searchText.trim().toLowerCase();

  const filteredProspects = prospects.filter((prospect) => {
    if (!normalizedSearch) {
      return true;
    }

    return [
      prospect.username,
      prospect.displayName,
      prospect.status,
      prospect.tags,
      prospect.notes
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });

  if (filteredProspects.length === 0) {
    listContainer.innerHTML = `
      <div class="welcome-card">
        <h3>No Prospects Found</h3>

        <p>
          Add a Chess.com player using the form above.
        </p>
      </div>
    `;

    return;
  }

  listContainer.innerHTML = `
    <div class="prospect-grid">
      ${filteredProspects
        .map((prospect) => createProspectCard(prospect))
        .join("")}
    </div>
  `;

  document
    .querySelectorAll(".edit-prospect-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await loadProspectIntoForm(
          button.dataset.prospectId
        );
      });
    });

  document
    .querySelectorAll(".delete-prospect-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleDeleteProspect(
          button.dataset.prospectId
        );
      });
    });
}

async function loadProspectIntoForm(prospectId) {
  const prospects = await getProspects();

  const prospect = prospects.find(
    (item) => item.id === prospectId
  );

  if (!prospect) {
    return;
  }

  document.querySelector("#editingProspectId").value =
    prospect.id;

  document.querySelector("#prospectUsername").value =
    prospect.username ?? "";

  document.querySelector("#prospectDisplayName").value =
    prospect.displayName ?? "";

  document.querySelector("#prospectStatus").value =
    prospect.status ?? "not-contacted";

  document.querySelector("#prospectPriority").value =
    String(prospect.priority ?? 3);

  document.querySelector("#prospectTags").value =
    prospect.tags ?? "";

  document.querySelector("#prospectLastContact").value =
    prospect.lastContact ?? "";

  document.querySelector("#prospectNotes").value =
    prospect.notes ?? "";

  document.querySelector("#saveProspectButton").textContent =
    "Save Changes";

  document.querySelector("#cancelEditButton").hidden = false;

  document
    .querySelector("#prospectForm")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

async function handleProspectSubmit(event) {
  event.preventDefault();

  const prospectData = readProspectForm();
  const editingProspectId =
    document.querySelector("#editingProspectId").value;

  if (!prospectData.username) {
    showProspectStatus(
      "A Chess.com username is required.",
      true
    );

    return;
  }

  try {
    if (editingProspectId) {
      await updateProspect(
        editingProspectId,
        prospectData
      );

      showProspectStatus("Prospect updated.");
    } else {
      await addProspect(prospectData);
      showProspectStatus("Prospect added.");
    }

    clearProspectForm();
    await renderProspectList(
      document.querySelector("#prospectSearch").value
    );
  } catch (error) {
    showProspectStatus(
      error.message || "Unable to save prospect.",
      true
    );
  }
}

async function handleDeleteProspect(prospectId) {
  const confirmed = window.confirm(
    "Delete this prospect?"
  );

  if (!confirmed) {
    return;
  }

  await deleteProspect(prospectId);

  await renderProspectList(
    document.querySelector("#prospectSearch").value
  );

  showProspectStatus("Prospect deleted.");
}

export async function renderProspectManager(container) {
  container.innerHTML = `
    <div class="prospect-manager">
      <form id="prospectForm" class="settings-card">
        <input
          id="editingProspectId"
          type="hidden"
        >

        <h3>Add or Edit Prospect</h3>

        <div class="prospect-form-grid">
          <label>
            Chess.com Username

            <input
              id="prospectUsername"
              type="text"
              placeholder="ExamplePlayer"
              required
            >
          </label>

          <label>
            Display Name

            <input
              id="prospectDisplayName"
              type="text"
              placeholder="Optional"
            >
          </label>

          <label>
            Status

            <select id="prospectStatus">
              <option value="not-contacted">
                Not Contacted
              </option>

              <option value="contacted">
                Contacted
              </option>

              <option value="invited">
                Invited
              </option>

              <option value="interested">
                Interested
              </option>

              <option value="joined">
                Joined
              </option>

              <option value="declined">
                Declined
              </option>
            </select>
          </label>

          <label>
            Priority

            <select id="prospectPriority">
              <option value="1">1 Star</option>
              <option value="2">2 Stars</option>
              <option value="3" selected>3 Stars</option>
              <option value="4">4 Stars</option>
              <option value="5">5 Stars</option>
            </select>
          </label>

          <label>
            Tags

            <input
              id="prospectTags"
              type="text"
              placeholder="streamer, club owner, active player"
            >
          </label>

          <label>
            Last Contact

            <input
              id="prospectLastContact"
              type="date"
            >
          </label>
        </div>

        <label>
          Notes

          <textarea
            id="prospectNotes"
            rows="5"
            placeholder="Add recruitment notes here."
          ></textarea>
        </label>

        <div class="prospect-form-actions">
          <button
            id="saveProspectButton"
            type="submit"
            class="primary-action"
          >
            Add Prospect
          </button>

          <button
            id="cancelEditButton"
            type="button"
            class="secondary-action"
            hidden
          >
            Cancel Edit
          </button>

          <span
            id="prospectStatusMessage"
            class="settings-status"
          ></span>
        </div>
      </form>

      <section class="settings-card">
        <div class="prospect-list-heading">
          <h3>Saved Prospects</h3>

          <input
            id="prospectSearch"
            type="search"
            placeholder="Search prospects"
          >
        </div>

        <div id="prospectList"></div>
      </section>
    </div>
  `;

  document
    .querySelector("#prospectForm")
    .addEventListener(
      "submit",
      handleProspectSubmit
    );

  document
    .querySelector("#cancelEditButton")
    .addEventListener("click", () => {
      clearProspectForm();
    });

  document
    .querySelector("#prospectSearch")
    .addEventListener("input", (event) => {
      renderProspectList(event.target.value);
    });

  await renderProspectList();
}
