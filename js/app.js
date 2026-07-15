const pages = [...document.querySelectorAll(".page")];
const navButtons = [...document.querySelectorAll("[data-page]")];

function showPage(name) {
  pages.forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach(button => {
  button.addEventListener("click", event => {
    if (button.tagName === "A") return;
    event.preventDefault();
    showPage(button.dataset.page);
  });
});

const canvas = document.querySelector("#matrixCanvas");
const context = canvas.getContext("2d");
const characters = "ACFA0123456789♟♞♝♜♛♚";
const fontSize = 16;
let drops = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drops = Array(Math.floor(canvas.width / fontSize)).fill(1);
}

function drawMatrix() {
  context.fillStyle = "rgba(27,26,24,.075)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#81b64c";
  context.font = `${fontSize}px monospace`;

  drops.forEach((drop, index) => {
    const character = characters[Math.floor(Math.random() * characters.length)];
    context.fillText(character, index * fontSize, drop * fontSize);
    if (drop * fontSize > canvas.height && Math.random() > 0.977) drops[index] = 0;
    drops[index] += 0.72;
  });

  requestAnimationFrame(drawMatrix);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
drawMatrix();

const footerLogo = document.querySelector("#footerLogo");
const overlay = document.querySelector("#easterOverlay");
let clickCount = 0;
let resetTimer = null;
let closeTimer = null;

function closeEasterEgg() {
  if (!overlay.classList.contains("active")) return;
  overlay.classList.add("closing");
  clearTimeout(closeTimer);
  setTimeout(() => {
    overlay.classList.remove("active", "closing");
    overlay.setAttribute("aria-hidden", "true");
  }, 1200);
}

footerLogo.addEventListener("click", () => {
  clickCount += 1;
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => clickCount = 0, 2800);

  if (clickCount >= 5) {
    clickCount = 0;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    closeTimer = setTimeout(closeEasterEgg, 5600);
  }
});

overlay.addEventListener("click", event => {
  if (event.target === overlay) closeEasterEgg();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeEasterEgg();
});
