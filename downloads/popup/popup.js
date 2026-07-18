const openSidebarButton =
  document.querySelector("#openSidebar");

const openDashboardButton =
  document.querySelector("#openDashboard");

const popupStatus =
  document.querySelector("#popupStatus");

openSidebarButton.addEventListener("click", async () => {
  try {
    const currentWindow =
      await chrome.windows.getCurrent();

    await chrome.sidePanel.open({
      windowId: currentWindow.id
    });

    window.close();
  } catch (error) {
    console.error("Unable to open side panel:", error);

    popupStatus.textContent =
      "Unable to open the sidebar.";
  }
});

openDashboardButton.addEventListener("click", async () => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(
      "pages/dashboard.html"
    )
  });
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
