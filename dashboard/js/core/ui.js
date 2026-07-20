export function ensureToastContainer() {
    const existing = document.getElementById("toast-container");
    if (existing) {
        return existing;
    }

    const container = document.createElement("div");
    container.id = "toast-container";
    container.className = "fixed top-4 right-4 z-50 flex w-[92vw] max-w-sm flex-col gap-3 pointer-events-none";
    document.body.appendChild(container);
    return container;
}

export function showToast(title, message = "", type = "info") {
    const container = ensureToastContainer();
    const palette = {
        success: { border: "border-emerald-500/30", background: "bg-emerald-500/15", icon: "fa-circle-check text-emerald-400" },
        warning: { border: "border-amber-500/30", background: "bg-amber-500/15", icon: "fa-triangle-exclamation text-amber-400" },
        error: { border: "border-rose-500/30", background: "bg-rose-500/15", icon: "fa-circle-xmark text-rose-400" },
        info: { border: "border-sky-500/30", background: "bg-sky-500/15", icon: "fa-circle-info text-sky-400" }
    };

    const theme = palette[type] || palette.info;
    const toast = document.createElement("div");
    toast.className = `pointer-events-auto rounded-3xl border ${theme.border} ${theme.background} backdrop-blur-xl shadow-2xl shadow-slate-950/40 px-4 py-3 text-slate-100 transform transition duration-300 ease-out translate-y-2 opacity-0`;
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="mt-0.5 text-lg"><i class="fa-solid ${theme.icon}"></i></div>
            <div class="min-w-0 flex-1">
                <p class="font-semibold leading-5"></p>
                ${message ? `<p class="text-sm text-slate-300 mt-1 leading-5"></p>` : ""}
            </div>
            <button type="button" class="text-slate-400 hover:text-white transition" aria-label="Đóng thông báo">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    const titleEl = toast.querySelector("p");
    const messageEl = toast.querySelector(".text-sm");
    const closeBtn = toast.querySelector("button");
    if (titleEl) titleEl.innerText = title;
    if (messageEl) messageEl.innerText = message;

    const removeToast = () => {
        toast.classList.add("opacity-0", "translate-y-2");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
        setTimeout(() => {
            if (toast.isConnected) {
                toast.remove();
            }
        }, 300);
    };

    closeBtn?.addEventListener("click", removeToast);
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    });
    setTimeout(removeToast, 3800);
}

export function setAppLocked(locked) {
    const appShell = document.getElementById("app-shell");
    const authScreen = document.getElementById("auth-screen");
    appShell?.classList.toggle("hidden", locked);
    authScreen?.classList.toggle("hidden", !locked);
}

export function setLoginStatus(message, type = "info") {
    const loginStatus = document.getElementById("login-status");
    if (!loginStatus) {
        return;
    }

    const colors = {
        info: "text-slate-400",
        success: "text-emerald-400",
        warning: "text-amber-400",
        error: "text-rose-400"
    };

    loginStatus.innerText = message;
    loginStatus.className = `text-sm ${colors[type] || colors.info}`;
}

export function confirmAction({ title, message, confirmText = "Xác nhận", danger = true }) {
    return new Promise(resolve => {
        const confirmModal = document.getElementById("confirm-modal");
        const confirmModalTitle = document.getElementById("confirm-modal-title");
        const confirmModalMessage = document.getElementById("confirm-modal-message");
        const confirmModalOk = document.getElementById("confirm-modal-ok");
        const confirmModalCancel = document.getElementById("confirm-modal-cancel");

        if (!confirmModal || !confirmModalTitle || !confirmModalMessage || !confirmModalOk || !confirmModalCancel) {
            resolve(window.confirm(message));
            return;
        }

        confirmModalTitle.innerText = title;
        confirmModalMessage.innerText = message;
        confirmModalOk.innerText = confirmText;
        confirmModalOk.className = danger
            ? "px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
            : "px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition";

        const cleanup = () => {
            confirmModal.classList.add("hidden");
            confirmModalOk.onclick = null;
            confirmModalCancel.onclick = null;
        };

        confirmModal.classList.remove("hidden");
        confirmModalOk.onclick = () => {
            cleanup();
            resolve(true);
        };
        confirmModalCancel.onclick = () => {
            cleanup();
            resolve(false);
        };
    });
}

export function isValidTime(value) {
    return /^\d{2}:\d{2}$/.test(value);
}

export function toMinutes(value) {
    if (!isValidTime(value)) {
        return null;
    }

    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}

export function formatDuration(minutes) {
    if (minutes === null || Number.isNaN(minutes)) {
        return "--";
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!hours) {
        return `${mins} phút`;
    }
    if (!mins) {
        return `${hours} giờ`;
    }
    return `${hours} giờ ${mins} phút`;
}

export function buildScheduleState(schedule) {
    const onTime = schedule?.on_time || "";
    const offTime = schedule?.off_time || "";
    const enabled = Boolean(schedule?.enabled);
    const hasConfig = isValidTime(onTime) && isValidTime(offTime);
    const onMinutes = hasConfig ? toMinutes(onTime) : null;
    const offMinutes = hasConfig ? toMinutes(offTime) : null;
    const overnight = hasConfig ? offMinutes <= onMinutes : false;
    const durationMinutes = hasConfig ? (offMinutes - onMinutes + 24 * 60) % (24 * 60) : null;

    let summary = "Chưa có cấu hình hẹn giờ.";
    let statusText = "Thiết bị đang vận hành thủ công.";
    let tone = "neutral";

    if (hasConfig) {
        summary = overnight ? `Chạy qua đêm từ ${onTime} đến ${offTime}` : `Chạy hằng ngày từ ${onTime} đến ${offTime}`;
        statusText = enabled ? `Đang bật · Chu kỳ ${formatDuration(durationMinutes)}` : `Đã lưu · Chu kỳ ${formatDuration(durationMinutes)}`;
        tone = enabled ? "active" : "inactive";
    }

    return {
        hasConfig,
        enabled,
        onTime,
        offTime,
        overnight,
        durationMinutes,
        summary,
        statusText,
        tone
    };
}

export function getCurrentPageTitle(pageId) {
    const pageTitles = {
        "page-dashboard": "Tổng quan hệ thống",
        "page-schedule": "Cấu hình hẹn giờ tự động",
        "page-security": "Hệ thống quản lý an ninh",
        "page-logs": "Nhật ký truy cập chi tiết",
        "page-rfid": "Quản lý thẻ RFID"
    };
    return pageTitles[pageId] || "SmartHome Dashboard";
}

export function applySidebarState(collapsed) {
    const sidebarToggle = document.getElementById("sidebar-toggle");
    document.body.classList.remove("mobile-sidebar-open");
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    if (sidebarToggle) {
        sidebarToggle.innerHTML = '<i class="fa-solid fa-bars text-lg"></i>';
    }
    localStorage.setItem("sidebarCollapsed", String(collapsed));
}

export function setMobileSidebarOpen(open) {
    document.body.classList.toggle("mobile-sidebar-open", open);
}

export function applyTheme(theme) {
    const modeToggle = document.getElementById("mode-toggle");
    const modeToggleIcon = document.getElementById("mode-toggle-icon");
    const isLight = theme === "light";

    document.body.classList.toggle("light-theme", isLight);
    document.body.classList.toggle("dark-theme", !isLight);

    if (isLight) {
        modeToggleIcon && (modeToggleIcon.className = "fa-solid fa-moon");
        modeToggle && (modeToggle.className = "flex items-center justify-center px-4 py-2 bg-white/90 hover:bg-white text-slate-900 rounded-full border border-slate-200 shadow-sm transition");
    } else {
        modeToggleIcon && (modeToggleIcon.className = "fa-solid fa-sun");
        modeToggle && (modeToggle.className = "flex items-center justify-center px-4 py-2 bg-slate-800/85 hover:bg-slate-700 text-slate-100 rounded-full border border-slate-700/70 shadow-sm transition");
    }

    localStorage.setItem("dashboardTheme", theme);
    document.dispatchEvent(new CustomEvent("smarthome-theme-changed", { detail: { theme } }));
}
