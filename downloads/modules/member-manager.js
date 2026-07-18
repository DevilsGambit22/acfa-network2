import { syncHomeClubRoster, getRosterMeta } from "./roster-sync.js";
import { logActivity } from "./activity.js";

const MEMBER_STORAGE_KEY = "members";

async function getMembers() {
  const result = await chrome.storage.local.get(
    MEMBER_STORAGE_KEY
  );

  return result[MEMBER_STORAGE_KEY] ?? [];
}

async function saveMembers(members) {
  await chrome.storage.local.set({
    [MEMBER_STORAGE_KEY]: members
  });
}

async function addMember(memberData) {
  const members = await getMembers();

  const usernameExists = members.some(
    (member) =>
      member.username.toLowerCase() ===
      memberData.username.toLowerCase()
  );

  if (usernameExists) {
    throw new Error("That member is already saved.");
  }

  const member = {
    id: crypto.randomUUID(),
    username: memberData.username,
    displayName: memberData.displayName,
    role: memberData.role,
    activity: memberData.activity,
    clubs: memberData.clubs,
    joinDate: memberData.joinDate,
    lastInteraction: memberData.lastInteraction,
    tags: memberData.tags,
    notes: memberData.notes,
    streamParticipant: memberData.streamParticipant,
    eventParticipant: memberData.eventParticipant,
    spotlightStatus: memberData.spotlightStatus,
    recognitionHistory: memberData.recognitionHistory,
    dateAdded: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  members.unshift(member);

  await saveMembers(members);

  return member;
}

async function updateMember(memberId, changes) {
  const members = await getMembers();

  const updatedMembers = members.map((member) => {
    if (member.id !== memberId) {
      return member;
    }

    return {
      ...member,
      ...changes,
      updatedAt: new Date().toISOString()
    };
  });

  await saveMembers(updatedMembers);
}

async function deleteMember(memberId) {
  const members = await getMembers();

  const updatedMembers = members.filter(
    (member) => member.id !== memberId
  );

  await saveMembers(updatedMembers);
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
    return "Not recorded";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleDateString();
}

function formatRole(role) {
  const roles = {
    member: "Member",
    coordinator: "Coordinator",
    moderator: "Moderator",
    admin: "Admin",
    owner: "Owner",
    partner: "Partner",
    streamer: "Streamer",
    "titled-player": "Titled Player"
  };

  return roles[role] ?? "Member";
}

function formatActivity(activity) {
  const activityLevels = {
    new: "New Member",
    active: "Active",
    "very-active": "Very Active",
    occasional: "Occasional",
    inactive: "Inactive",
    "needs-follow-up": "Needs Follow-Up"
  };

  return activityLevels[activity] ?? "Active";
}

function formatSpotlightStatus(status) {
  const statuses = {
    "not-featured": "Not Featured",
    planned: "Planned",
    featured: "Featured",
    archived: "Archived"
  };

  return statuses[status] ?? "Not Featured";
}

function readMemberForm() {
  const selectedClubs = Array.from(
    document.querySelectorAll(
      'input[name="memberClubs"]:checked'
    )
  ).map((input) => input.value);

  return {
    username:
      document.querySelector("#memberUsername").value.trim(),

    displayName:
      document.querySelector("#memberDisplayName").value.trim(),

    role:
      document.querySelector("#memberRole").value,

    activity:
      document.querySelector("#memberActivity").value,

    clubs: selectedClubs,

    joinDate:
      document.querySelector("#memberJoinDate").value,

    lastInteraction:
      document.querySelector("#memberLastInteraction").value,

    tags:
      document.querySelector("#memberTags").value.trim(),

    notes:
      document.querySelector("#memberNotes").value.trim(),

    streamParticipant:
      document.querySelector("#memberStreamParticipant").checked,

    eventParticipant:
      document.querySelector("#memberEventParticipant").checked,

    spotlightStatus:
      document.querySelector("#memberSpotlightStatus").value,

    recognitionHistory:
      document
        .querySelector("#memberRecognitionHistory")
        .value
        .trim()
  };
}

function clearMemberForm() {
  const form = document.querySelector("#memberForm");

  form.reset();

  document.querySelector("#editingMemberId").value = "";
  document.querySelector("#memberRole").value = "member";
  document.querySelector("#memberActivity").value = "active";
  document.querySelector("#memberSpotlightStatus").value =
    "not-featured";

  document.querySelector("#saveMemberButton").textContent =
    "Add Member";

  document.querySelector("#cancelMemberEditButton").hidden =
    true;
}

function showMemberStatus(message, isError = false) {
  const status = document.querySelector(
    "#memberStatusMessage"
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

function createMemberCard(member) {
  const profileUrl =
    `https://www.chess.com/member/${encodeURIComponent(
      member.username
    )}`;

  const clubs = Array.isArray(member.clubs)
    ? member.clubs
    : [];

  return `
    <article class="member-card">
      <div class="member-card-header">
        <div>
          <h3>
            <a
              href="${profileUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              @${escapeText(member.username)}
            </a>
          </h3>

          ${
            member.displayName
              ? `
                <p class="member-display-name">
                  ${escapeText(member.displayName)}
                </p>
              `
              : ""
          }
        </div>

        <span class="member-role-badge">
          ${escapeText(formatRole(member.role))}
        </span>
      </div>

      <div class="member-details">
        <p>
          <strong>Membership:</strong>
          ${escapeText(member.membershipStatus === "former" ? "Former Member" : "Active Member")}
        </p>

        <p>
          <strong>Activity:</strong>
          ${escapeText(formatActivity(member.activity))}
        </p>

        ${member.publicData?.title ? `<p><strong>Title:</strong> ${escapeText(member.publicData.title)}</p>` : ""}

        <p>
          <strong>Joined:</strong>
          ${escapeText(formatDate(member.joinDate))}
        </p>

        <p>
          <strong>Last Interaction:</strong>
          ${escapeText(
            formatDate(member.lastInteraction)
          )}
        </p>

        <p>
          <strong>Spotlight:</strong>
          ${escapeText(
            formatSpotlightStatus(
              member.spotlightStatus
            )
          )}
        </p>

        ${
          clubs.length
            ? `
              <p>
                <strong>Clubs:</strong>
                ${escapeText(clubs.join(", "))}
              </p>
            `
            : ""
        }

        ${
          member.tags
            ? `
              <p>
                <strong>Tags:</strong>
                ${escapeText(member.tags)}
              </p>
            `
            : ""
        }
      </div>

      <div class="member-flags">
        ${
          member.streamParticipant
            ? `<span>Stream Participant</span>`
            : ""
        }

        ${
          member.eventParticipant
            ? `<span>Event Participant</span>`
            : ""
        }
      </div>

      ${
        member.notes
          ? `
            <div class="member-notes">
              <strong>Notes</strong>
              <div>${escapeText(member.notes)}</div>
            </div>
          `
          : ""
      }

      ${
        member.recognitionHistory
          ? `
            <div class="member-recognition">
              <strong>Recognition</strong>
              <div>
                ${escapeText(
                  member.recognitionHistory
                )}
              </div>
            </div>
          `
          : ""
      }

      <div class="member-actions">
        <button
          type="button"
          class="edit-member-button"
          data-member-id="${member.id}"
        >
          Edit
        </button>

        <button
          type="button"
          class="delete-member-button"
          data-member-id="${member.id}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

async function renderMemberList(searchText = "") {
  const listContainer =
    document.querySelector("#memberList");

  if (!listContainer) {
    return;
  }

  const members = await getMembers();
  const normalizedSearch =
    searchText.trim().toLowerCase();

  const filteredMembers = members.filter((member) => {
    if (!normalizedSearch) {
      return true;
    }

    return [
      member.username,
      member.displayName,
      member.role,
      member.activity,
      member.tags,
      member.notes,
      member.spotlightStatus,
      member.recognitionHistory,
      ...(member.clubs ?? [])
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });

  if (filteredMembers.length === 0) {
    listContainer.innerHTML = `
      <div class="welcome-card">
        <h3>No Members Found</h3>

        <p>
          Add a club member using the form above.
        </p>
      </div>
    `;

    return;
  }

  listContainer.innerHTML = `
    <div class="member-grid">
      ${filteredMembers
        .map((member) => createMemberCard(member))
        .join("")}
    </div>
  `;

  document
    .querySelectorAll(".edit-member-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await loadMemberIntoForm(
          button.dataset.memberId
        );
      });
    });

  document
    .querySelectorAll(".delete-member-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleDeleteMember(
          button.dataset.memberId
        );
      });
    });
}

async function loadMemberIntoForm(memberId) {
  const members = await getMembers();

  const member = members.find(
    (item) => item.id === memberId
  );

  if (!member) {
    return;
  }

  document.querySelector("#editingMemberId").value =
    member.id;

  document.querySelector("#memberUsername").value =
    member.username ?? "";

  document.querySelector("#memberDisplayName").value =
    member.displayName ?? "";

  document.querySelector("#memberRole").value =
    member.role ?? "member";

  document.querySelector("#memberActivity").value =
    member.activity ?? "active";

  document.querySelector("#memberJoinDate").value =
    member.joinDate ?? "";

  document.querySelector("#memberLastInteraction").value =
    member.lastInteraction ?? "";

  document.querySelector("#memberTags").value =
    member.tags ?? "";

  document.querySelector("#memberNotes").value =
    member.notes ?? "";

  document.querySelector(
    "#memberStreamParticipant"
  ).checked = Boolean(member.streamParticipant);

  document.querySelector(
    "#memberEventParticipant"
  ).checked = Boolean(member.eventParticipant);

  document.querySelector(
    "#memberSpotlightStatus"
  ).value = member.spotlightStatus ?? "not-featured";

  document.querySelector(
    "#memberRecognitionHistory"
  ).value = member.recognitionHistory ?? "";

  document
    .querySelectorAll('input[name="memberClubs"]')
    .forEach((input) => {
      input.checked = (member.clubs ?? []).includes(
        input.value
      );
    });

  document.querySelector("#saveMemberButton").textContent =
    "Save Changes";

  document.querySelector(
    "#cancelMemberEditButton"
  ).hidden = false;

  document
    .querySelector("#memberForm")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

async function handleMemberSubmit(event) {
  event.preventDefault();

  const memberData = readMemberForm();

  const editingMemberId =
    document.querySelector("#editingMemberId").value;

  if (!memberData.username) {
    showMemberStatus(
      "A Chess.com username is required.",
      true
    );

    return;
  }

  try {
    if (editingMemberId) {
      await updateMember(
        editingMemberId,
        memberData
      );

      showMemberStatus("Member updated.");
    } else {
      await addMember(memberData);

      showMemberStatus("Member added.");
    }

    clearMemberForm();

    await renderMemberList(
      document.querySelector("#memberSearch").value
    );
  } catch (error) {
    showMemberStatus(
      error.message || "Unable to save member.",
      true
    );
  }
}

async function handleDeleteMember(memberId) {
  const confirmed = window.confirm(
    "Delete this member record?"
  );

  if (!confirmed) {
    return;
  }

  await deleteMember(memberId);

  await renderMemberList(
    document.querySelector("#memberSearch").value
  );

  showMemberStatus("Member deleted.");
}

export async function renderMemberManager(container) {
  const clubState = await chrome.storage.local.get("managedClubs");
  const managedClubs = Array.isArray(clubState.managedClubs) ? clubState.managedClubs : [];
  const managedClubOptions = managedClubs.length
    ? managedClubs.map((club) => `<label class="checkbox-label"><input type="checkbox" name="memberClubs" value="${escapeText(club.name || club.slug || "Club")}">${escapeText(club.name || club.slug || "Club")}</label>`).join("")
    : `<p class="empty-state">No managed clubs yet. Add clubs in Club Manager first.</p>`;
  container.innerHTML = `
    <div class="member-manager">
      <form id="memberForm" class="settings-card">
        <input
          id="editingMemberId"
          type="hidden"
        >

        <h3>Add or Edit Member</h3>

        <div class="member-form-grid">
          <label>
            Chess.com Username

            <input
              id="memberUsername"
              type="text"
              placeholder="ExamplePlayer"
              required
            >
          </label>

          <label>
            Display Name

            <input
              id="memberDisplayName"
              type="text"
              placeholder="Optional"
            >
          </label>

          <label>
            Role

            <select id="memberRole">
              <option value="member">Member</option>
              <option value="coordinator">
                Coordinator
              </option>
              <option value="moderator">
                Moderator
              </option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
              <option value="partner">Partner</option>
              <option value="streamer">
                Streamer
              </option>
              <option value="titled-player">
                Titled Player
              </option>
            </select>
          </label>

          <label>
            Activity Level

            <select id="memberActivity">
              <option value="new">New Member</option>
              <option value="active" selected>
                Active
              </option>
              <option value="very-active">
                Very Active
              </option>
              <option value="occasional">
                Occasional
              </option>
              <option value="inactive">
                Inactive
              </option>
              <option value="needs-follow-up">
                Needs Follow-Up
              </option>
            </select>
          </label>

          <label>
            Join Date

            <input
              id="memberJoinDate"
              type="date"
            >
          </label>

          <label>
            Last Interaction

            <input
              id="memberLastInteraction"
              type="date"
            >
          </label>

          <label>
            Spotlight Status

            <select id="memberSpotlightStatus">
              <option value="not-featured">
                Not Featured
              </option>
              <option value="planned">
                Planned
              </option>
              <option value="featured">
                Featured
              </option>
              <option value="archived">
                Archived
              </option>
            </select>
          </label>

          <label>
            Tags

            <input
              id="memberTags"
              type="text"
              placeholder="Vote Chess, streamer, arena regular"
            >
          </label>
        </div>

        <fieldset class="member-club-fieldset">
          <legend>Managed Clubs</legend>

          <div class="member-club-options">${managedClubOptions}</div>
        </fieldset>

        <div class="member-participation-options">
          <label class="checkbox-label">
            <input
              id="memberStreamParticipant"
              type="checkbox"
            >
            Stream Participant
          </label>

          <label class="checkbox-label">
            <input
              id="memberEventParticipant"
              type="checkbox"
            >
            Event Participant
          </label>
        </div>

        <label>
          Notes

          <textarea
            id="memberNotes"
            rows="5"
            placeholder="Add internal member notes."
          ></textarea>
        </label>

        <label>
          Recognition History

          <textarea
            id="memberRecognitionHistory"
            rows="4"
            placeholder="Arena winner, spotlight, volunteer recognition..."
          ></textarea>
        </label>

        <div class="member-form-actions">
          <button
            id="saveMemberButton"
            type="submit"
            class="primary-action"
          >
            Add Member
          </button>

          <button
            id="cancelMemberEditButton"
            type="button"
            class="secondary-action"
            hidden
          >
            Cancel Edit
          </button>

          <span
            id="memberStatusMessage"
            class="settings-status"
          ></span>
        </div>
      </form>

      <section class="settings-card">
        <div class="member-list-heading">
          <div>
            <h3>Live Club Member Registry</h3>
            <p id="rosterSyncSummary" class="settings-status">Loading roster status…</p>
          </div>

          <div class="member-list-tools">
            <button id="syncRosterButton" type="button" class="secondary-action">Sync Club Roster</button>
            <input
              id="memberSearch"
              type="search"
              placeholder="Search members"
            >
          </div>
        </div>

        <div id="memberList"></div>
      </section>
    </div>
  `;

  document
    .querySelector("#memberForm")
    .addEventListener(
      "submit",
      handleMemberSubmit
    );

  document
    .querySelector("#cancelMemberEditButton")
    .addEventListener("click", () => {
      clearMemberForm();
    });

  document
    .querySelector("#memberSearch")
    .addEventListener("input", (event) => {
      renderMemberList(event.target.value);
    });

  const syncButton = document.querySelector("#syncRosterButton");
  const syncSummary = document.querySelector("#rosterSyncSummary");
  const updateSummary = async () => {
    const meta = await getRosterMeta();
    syncSummary.textContent = meta
      ? `${meta.count} active • ${meta.added} new • ${meta.departed} departed • synced ${new Date(meta.syncedAt).toLocaleString()}`
      : "Roster has not been synchronized yet.";
  };
  syncButton.addEventListener("click", async () => {
    syncButton.disabled = true;
    syncButton.textContent = "Synchronizing…";
    try {
      const result = await syncHomeClubRoster({ enrichLimit: 20 });
      await renderMemberList(document.querySelector("#memberSearch").value);
      await updateSummary();
      showMemberStatus(`Roster synchronized: ${result.count} active members.`);
    } catch (error) {
      showMemberStatus(error.message || "Roster sync failed.", true);
    } finally {
      syncButton.disabled = false;
      syncButton.textContent = "Sync Club Roster";
    }
  });

  await renderMemberList();
  await updateSummary();

  const members = await getMembers();
  if (members.length === 0) {
    syncButton.click();
  }
}
