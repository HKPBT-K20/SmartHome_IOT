import { applySidebarState, applyTheme, getCurrentPageTitle, setMobileSidebarOpen } from "./core/ui.js";
import { initHomeFeature } from "./features/home.js";
import { initAuth } from "./features/auth.js";
import { initScheduleFeature } from "./features/schedule.js";
import { initSecurityFeature } from "./features/security.js";
import { initLogsFeature } from "./features/logs.js";
import { initWeatherWidget } from "./features/weather.js";
import { initRfidManager } from "./features/rfid_manager.js";

const navButtons = document.querySelectorAll(".nav-btn");
const pages = document.querySelectorAll(".page-content");
const pageTitle = document.getElementById("current-page-title");
const modeToggle = document.getElementById("mode-toggle");
const sidebarToggle = document.getElementById("sidebar-toggle");
const mobileSidebarToggle = document.getElementById("mobile-sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");

function setActivePage(targetPageId) {
    navButtons.forEach(button => {
        button.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-2xl transition";
    });

    const activeButton = document.querySelector(`.nav-btn[data-target="${targetPageId}"]`);
    if (activeButton) {
        activeButton.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 bg-sky-600 text-white rounded-2xl transition shadow-sm shadow-sky-500/25";
    }

    pages.forEach(page => page.classList.add("hidden"));
    document.getElementById(targetPageId)?.classList.remove("hidden");
    if (pageTitle) {
        pageTitle.innerText = getCurrentPageTitle(targetPageId);
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
        setMobileSidebarOpen(false);
    }
}

function initNavigation() {
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPageId = btn.dataset.target;
            if (targetPageId) {
                setActivePage(targetPageId);
            }
        });
    });

    setActivePage("page-dashboard");
}

function initThemeAndLayout() {
    const savedTheme = localStorage.getItem("dashboardTheme");
    const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const initialTheme = savedTheme || (systemPrefersLight ? "light" : "dark");
    const savedSidebarState = localStorage.getItem("sidebarCollapsed") === "true";

    applyTheme(initialTheme);
    applySidebarState(savedSidebarState);

    modeToggle?.addEventListener("click", () => {
        applyTheme(document.body.classList.contains("light-theme") ? "dark" : "light");
    });

    sidebarToggle?.addEventListener("click", () => {
        const collapsed = !document.body.classList.contains("sidebar-collapsed");
        applySidebarState(collapsed);
    });

    mobileSidebarToggle?.addEventListener("click", () => {
        setMobileSidebarOpen(!document.body.classList.contains("mobile-sidebar-open"));
    });

    sidebarBackdrop?.addEventListener("click", () => {
        setMobileSidebarOpen(false);
    });

    window.addEventListener("resize", () => {
        if (!window.matchMedia("(max-width: 767px)").matches) {
            setMobileSidebarOpen(false);
        }
    });

    if (!savedTheme) {
        const themeQuery = window.matchMedia("(prefers-color-scheme: light)");
        const handleThemeChange = event => {
            applyTheme(event.matches ? "light" : "dark");
        };

        if (typeof themeQuery.addEventListener === "function") {
            themeQuery.addEventListener("change", handleThemeChange);
        } else if (typeof themeQuery.addListener === "function") {
            themeQuery.addListener(handleThemeChange);
        }
    }
}

initThemeAndLayout();
initNavigation();
initAuth();
initHomeFeature();
initWeatherWidget();
initScheduleFeature();
initSecurityFeature();
initLogsFeature();
initRfidManager();
