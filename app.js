// ... [Keep all the existing code from app.js exactly as it is above this point] ...

// ---------- 19. Theme Toggle & Menus ----------
const themeToggle = $("theme-toggle");
const themeIcon = $("theme-icon");
const menuBtn = $("menu-btn");
const menuDropdown = $("menu-dropdown");

// Initialize Theme
const savedTheme = localStorage.getItem("bgRemoverTheme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.body.setAttribute("data-theme", "dark");
  themeIcon.textContent = "☀️";
} else {
  document.body.setAttribute("data-theme", "light");
  themeIcon.textContent = "🌙";
}

themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("bgRemoverTheme", next);
  themeIcon.textContent = next === "dark" ? "☀️" : "🌙";
});

// Menu Dropdown
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.hidden = !menuDropdown.hidden;
});
document.addEventListener("click", (e) => {
  if (!menuDropdown.hidden && !menuDropdown.contains(e.target)) {
    menuDropdown.hidden = true;
  }
});

// Modals
document.querySelectorAll("[data-dialog]").forEach(btn => {
  btn.addEventListener("click", () => {
    const dialogId = btn.getAttribute("data-dialog");
    const dialog = $(dialogId);
    if (dialog) {
      dialog.showModal();
      menuDropdown.hidden = true; // Close menu after clicking
    }
  });
});

document.querySelectorAll(".modal-close").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.closest("dialog").close();
  });
});

// Close modal on clicking backdrop
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      dialog.close();
    }
  });
});

// ... [Keep the rest of the code: checkSavedModels, loadSettings, etc.] ...