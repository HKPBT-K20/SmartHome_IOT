import {
    USE_MOCK_DEMO,
    db,
    ref,
    get,
    onValue,
    set,
    update,
    remove
} from "../core/firebase.js";
import { confirmAction, showToast } from "../core/ui.js";

// ── STATE ─────────────────────────────────────────────────────
const panelExpanded = { 1: false, 2: false, 3: false, 4: false };
const panelLoaded = { 1: false, 2: false, 3: false, 4: false };
let _approveTargetUid = null;

// ── NAV BADGE (REALTIME) ──────────────────────────────────────
function initNavBadgeListener() {
    const badge = document.getElementById("rfid-nav-badge");
    if (!badge) return;

    if (USE_MOCK_DEMO) {
        badge.classList.add("hidden");
        return;
    }

    onValue(ref(db, "pending_cards"), snapshot => {
        const data = snapshot.val() || {};
        const count = Object.values(data).filter(card =>
            card.status === "pending" && !card.reject_rescan
        ).length;

        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    });
}

// ── LAZY FETCH HELPER ─────────────────────────────────────────
async function fetchNode(path) {
    if (USE_MOCK_DEMO) return {};
    try {
        const snapshot = await get(ref(db, path));
        return snapshot.val() || {};
    } catch (err) {
        console.error(`[RFID] Fetch error at ${path}:`, err);
        return {};
    }
}

// ── SPINNER TEMPLATE ──────────────────────────────────────────
function renderLoadingState() {
    return `
        <div class="flex items-center justify-center gap-3 py-8 text-slate-400 text-sm">
            <i class="fa-solid fa-spinner fa-spin text-lg text-sky-400"></i>
            <span>Đang tải dữ liệu...</span>
        </div>`;
}

// ── RENDER PANEL 1: THẺ ĐƯỢC CẤP QUYỀN (Emerald/Green) ─────────
async function loadPanel1(force = false) {
    const listEl = document.getElementById("panel1-list");
    const countEl = document.getElementById("panel1-count");
    if (!listEl) return;

    if (!panelLoaded[1] || force) {
        listEl.innerHTML = renderLoadingState();
    }

    const [localCards, authorizedCards] = await Promise.all([
        fetchNode("local_cards"),
        fetchNode("authorized_cards")
    ]);

    // Local / Firmware default cards
    const localEntries = Object.entries(localCards).map(([uid, item]) => ({
        uid,
        label: item.label || "Thẻ mặc định",
        isLocal: true
    }));

    // Authorized cards (locked != true & deleted != true)
    const authEntries = Object.entries(authorizedCards)
        .filter(([, card]) => !card.locked && !card.deleted)
        .map(([uid, card]) => ({
            uid,
            label: card.label || "(Chưa đặt tên)",
            addedAt: card.added_at ? new Date(card.added_at).toLocaleString("vi-VN") : "--",
            isLocal: false
        }));

    const totalCount = localEntries.length + authEntries.length;
    if (countEl) countEl.textContent = totalCount;

    if (totalCount === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-shield-halved text-2xl mb-3 block opacity-40"></i>
                Chưa có thẻ nào được cấp quyền.
            </div>`;
        panelLoaded[1] = true;
        return;
    }

    let html = "";

    // 1. Thẻ mặc định
    localEntries.forEach(card => {
        html += `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border border-emerald-500/35 bg-emerald-50/60 dark:bg-transparent">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                        <i class="fa-solid fa-memory text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-sm font-bold text-slate-900 dark:text-white">${card.uid}</span>
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">Thẻ mặc định</span>
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">${card.label} &nbsp;·&nbsp; Tích hợp firmware</p>
                    </div>
                </div>
                <div class="text-xs text-slate-600 dark:text-slate-500 italic shrink-0">Không thể sửa/xoá</div>
            </div>`;
    });

    // 2. Thẻ Firebase
    authEntries.forEach(card => {
        html += `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border border-emerald-500/35 bg-emerald-50/45 dark:bg-transparent" data-uid="${card.uid}">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                        <i class="fa-solid fa-id-badge text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="font-mono text-sm font-semibold text-slate-900 dark:text-white">${card.uid}</p>
                        <p class="text-xs text-slate-600 dark:text-slate-400 truncate">${card.label} &nbsp;·&nbsp; Cấp lúc: ${card.addedAt}</p>
                    </div>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button class="btn-lock px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30 transition" data-uid="${card.uid}">
                        <i class="fa-solid fa-lock mr-1"></i>Khoá
                    </button>
                    <button class="btn-delete px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition" data-uid="${card.uid}">
                        <i class="fa-solid fa-trash-can mr-1"></i>Xoá
                    </button>
                </div>
            </div>`;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll(".btn-lock").forEach(btn => {
        btn.addEventListener("click", () => lockCard(btn.dataset.uid));
    });
    listEl.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteCard(btn.dataset.uid));
    });

    panelLoaded[1] = true;
}

// ── RENDER PANEL 2: THẺ BỊ KHÓA (Amber/Orange) ────────────────
async function loadPanel2(force = false) {
    const listEl = document.getElementById("panel2-list");
    const countEl = document.getElementById("panel2-count");
    if (!listEl) return;

    if (!panelLoaded[2] || force) {
        listEl.innerHTML = renderLoadingState();
    }

    const authorizedCards = await fetchNode("authorized_cards");

    const entries = Object.entries(authorizedCards)
        .filter(([, card]) => card.locked && !card.deleted)
        .map(([uid, card]) => ({
            uid,
            label: card.label || "(Chưa đặt tên)",
            addedAt: card.added_at ? new Date(card.added_at).toLocaleString("vi-VN") : "--"
        }));

    if (countEl) countEl.textContent = entries.length;

    if (entries.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-lock text-2xl mb-3 block opacity-40"></i>
                Không có thẻ nào đang bị khoá.
            </div>`;
        panelLoaded[2] = true;
        return;
    }

    listEl.innerHTML = entries.map(card => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border border-amber-500/30" data-uid="${card.uid}">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                    <i class="fa-solid fa-lock text-sm"></i>
                </div>
                <div class="min-w-0">
                    <p class="font-mono text-sm font-semibold text-white">${card.uid}</p>
                    <p class="text-xs text-slate-400 truncate">${card.label} &nbsp;·&nbsp; Thêm lúc: ${card.addedAt}</p>
                </div>
            </div>
            <div class="flex gap-2 shrink-0">
                <button class="btn-unlock px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 transition" data-uid="${card.uid}">
                    <i class="fa-solid fa-lock-open mr-1"></i>Mở khoá
                </button>
                <button class="btn-delete px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition" data-uid="${card.uid}">
                    <i class="fa-solid fa-trash-can mr-1"></i>Xoá
                </button>
            </div>
        </div>`).join("");

    listEl.querySelectorAll(".btn-unlock").forEach(btn => {
        btn.addEventListener("click", () => unlockCard(btn.dataset.uid));
    });
    listEl.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteCard(btn.dataset.uid));
    });

    panelLoaded[2] = true;
}

// ── RENDER PANEL 3: THẺ CHƯA ĐĂNG KÝ (Emerald/Green) ──────────
async function loadPanel3(force = false) {
    const listEl = document.getElementById("panel3-list");
    const countEl = document.getElementById("panel3-count");
    if (!listEl) return;

    if (!panelLoaded[3] || force) {
        listEl.innerHTML = renderLoadingState();
    }

    const pendingCards = await fetchNode("pending_cards");

    const entries = Object.entries(pendingCards)
        .filter(([, card]) => card.status !== "approved");

    // Sort timestamp DESC (newest at top)
    entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    if (countEl) countEl.textContent = entries.length;

    if (entries.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-credit-card text-2xl mb-3 block opacity-40"></i>
                Không có thẻ chưa đăng ký nào trong nhật ký.
            </div>`;
        panelLoaded[3] = true;
        return;
    }

    listEl.innerHTML = entries.map(([uid, card]) => {
        const { status = "pending", display_time = "--", label = "", reject_rescan = false } = card;

        let badge = "";
        let rowBorder = "";
        let actionButtons = "";

        if (status === "pending" && !reject_rescan) {
            badge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/15 border border-amber-400/30 text-amber-300">
                        <i class="fa-solid fa-circle-dot text-[9px]"></i>Chờ duyệt
                     </span>`;
            rowBorder = "border-amber-500/25";
            actionButtons = `
                <div class="flex gap-2 shrink-0">
                    <button class="btn-approve px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 transition" data-uid="${uid}">
                        <i class="fa-solid fa-check mr-1"></i>Duyệt
                    </button>
                    <button class="btn-reject px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition" data-uid="${uid}">
                        <i class="fa-solid fa-xmark mr-1"></i>Từ chối
                    </button>
                </div>`;
        } else if (status === "approved") {
            badge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                        <i class="fa-solid fa-circle-check text-[9px]"></i>Đã duyệt
                     </span>`;
            rowBorder = "border-emerald-500/20";
        } else if (status === "rejected" && reject_rescan) {
            badge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600/20 border border-rose-500/40 text-rose-300">
                        <i class="fa-solid fa-triangle-exclamation text-[9px]"></i>&nbsp;Thẻ bị từ chối quẹt lại
                     </span>`;
            rowBorder = "border-rose-500/30";
            actionButtons = `
                <button class="btn-reapprove px-3 py-1.5 text-xs font-semibold rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 transition" data-uid="${uid}">
                    <i class="fa-solid fa-rotate-left mr-1"></i>Duyệt lại
                </button>`;
        } else {
            // rejected & !reject_rescan
            badge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 border border-slate-600/40 text-slate-400">
                        <i class="fa-solid fa-ban text-[9px]"></i>Đã từ chối
                     </span>`;
            rowBorder = "border-slate-700/40";
            actionButtons = `
                <button class="btn-reapprove px-3 py-1.5 text-xs font-semibold rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 transition" data-uid="${uid}">
                    <i class="fa-solid fa-rotate-left mr-1"></i>Duyệt lại
                </button>`;
        }

        const labelDisplay = label
            ? `<span class="text-xs text-slate-600 dark:text-slate-400">Nhãn: <span class="text-emerald-700 dark:text-emerald-300 font-medium">${label}</span></span>`
            : "";

        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border ${rowBorder} bg-rose-50/50 dark:bg-transparent" data-uid="${uid}">
                <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0 mt-0.5 sm:mt-0">
                        <i class="fa-solid fa-credit-card text-sm"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="font-mono text-sm font-bold text-slate-900 dark:text-white">${uid}</span>
                            ${badge}
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-500">${display_time}</p>
                        ${labelDisplay}
                    </div>
                </div>
                ${actionButtons}
            </div>`;
    }).join("");

    listEl.querySelectorAll(".btn-approve, .btn-reapprove").forEach(btn => {
        btn.addEventListener("click", () => openApproveModal(btn.dataset.uid));
    });
    listEl.querySelectorAll(".btn-reject").forEach(btn => {
        btn.addEventListener("click", () => rejectCard(btn.dataset.uid));
    });

    panelLoaded[3] = true;
}

// ── RENDER PANEL 4: THẺ BỊ XOÁ (Rose/Red) ─────────────────────
async function loadPanel4(force = false) {
    const listEl = document.getElementById("panel4-list");
    const countEl = document.getElementById("panel4-count");
    if (!listEl) return;

    if (!panelLoaded[4] || force) {
        listEl.innerHTML = renderLoadingState();
    }

    const authorizedCards = await fetchNode("authorized_cards");

    const entries = Object.entries(authorizedCards)
        .filter(([, card]) => card.deleted)
        .map(([uid, card]) => ({
            uid,
            label: card.label || "(Chưa đặt tên)",
            addedAt: card.added_at ? new Date(card.added_at).toLocaleString("vi-VN") : "--"
        }));

    if (countEl) countEl.textContent = entries.length;

    if (entries.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-trash-can text-2xl mb-3 block opacity-40"></i>
                Không có thẻ nào đã bị xoá.
            </div>`;
        panelLoaded[4] = true;
        return;
    }

    listEl.innerHTML = entries.map(card => `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border border-rose-500/35 bg-rose-50/60 dark:bg-transparent" data-uid="${card.uid}">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="font-mono text-sm font-semibold text-slate-900 dark:text-white">${card.uid}</p>
                        <p class="text-xs text-slate-600 dark:text-slate-400 truncate">${card.label} &nbsp;·&nbsp; Thêm lúc: ${card.addedAt}</p>
                    </div>
                </div>
            <div class="flex gap-2 shrink-0">
                <button class="btn-restore px-3 py-1.5 text-xs font-semibold rounded-xl bg-teal-500/15 hover:bg-teal-500 text-teal-300 hover:text-white border border-teal-500/30 transition" data-uid="${card.uid}">
                    <i class="fa-solid fa-rotate-left mr-1"></i>Khôi phục
                </button>
                <button class="btn-purge px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition" data-uid="${card.uid}">
                    <i class="fa-solid fa-circle-xmark mr-1"></i>Xoá vĩnh viễn
                </button>
            </div>
        </div>`).join("");

    listEl.querySelectorAll(".btn-restore").forEach(btn => {
        btn.addEventListener("click", () => restoreCard(btn.dataset.uid));
    });
    listEl.querySelectorAll(".btn-purge").forEach(btn => {
        btn.addEventListener("click", () => purgeCard(btn.dataset.uid));
    });

    panelLoaded[4] = true;
}

// ── ACTIONS ───────────────────────────────────────────────────

// [Khoá]: set locked=true + write revoked_cards
async function lockCard(uid) {
    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        await update(ref(db, `authorized_cards/${uid}`), { locked: true });
        await set(ref(db, `revoked_cards/${uid}`), true);
        showToast("Đã khoá thẻ", `Thẻ ${uid} đã chuyển sang mục Thẻ bị khoá. ESP32 cập nhật trong ~5s.`, "info");

        loadPanel1(true);
        if (panelExpanded[2] || panelLoaded[2]) loadPanel2(true);
    } catch (err) {
        console.error("[RFID] lockCard error:", err);
        showToast("Lỗi khoá thẻ", err.message, "error");
    }
}

// [Mở khoá]: set locked=false + delete revoked_cards
async function unlockCard(uid) {
    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        await update(ref(db, `authorized_cards/${uid}`), { locked: false });
        await remove(ref(db, `revoked_cards/${uid}`));
        showToast("Đã mở khoá thẻ", `Thẻ ${uid} đã khôi phục quyền truy cập.`, "success");

        loadPanel2(true);
        if (panelExpanded[1] || panelLoaded[1]) loadPanel1(true);
    } catch (err) {
        console.error("[RFID] unlockCard error:", err);
        showToast("Lỗi mở khoá", err.message, "error");
    }
}

// [Xoá]: set deleted=true + write revoked_cards (với confirm modal)
async function deleteCard(uid) {
    const confirmed = await confirmAction({
        title: "Xoá thẻ RFID?",
        message: `Bạn có chắc muốn xoá thẻ ${uid}? Bạn có thể khôi phục lại thẻ này ở mục Thẻ bị xoá.`,
        confirmText: "Xoá thẻ",
        danger: true
    });

    if (!confirmed) return;

    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        await update(ref(db, `authorized_cards/${uid}`), { deleted: true });
        await set(ref(db, `revoked_cards/${uid}`), true);
        showToast("Đã xoá thẻ", `Thẻ ${uid} đã chuyển sang mục Thẻ bị xoá.`, "info");

        if (panelExpanded[1] || panelLoaded[1]) loadPanel1(true);
        if (panelExpanded[2] || panelLoaded[2]) loadPanel2(true);
        if (panelExpanded[4] || panelLoaded[4]) loadPanel4(true);
    } catch (err) {
        console.error("[RFID] deleteCard error:", err);
        showToast("Lỗi xoá thẻ", err.message, "error");
    }
}

// [Khôi phục]: set deleted=false & locked=false + remove revoked_cards
async function restoreCard(uid) {
    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        await update(ref(db, `authorized_cards/${uid}`), { deleted: false, locked: false });
        await remove(ref(db, `revoked_cards/${uid}`));
        showToast("Đã khôi phục thẻ", `Thẻ ${uid} đã được cấp lại quyền ra/vào.`, "success");

        loadPanel4(true);
        if (panelExpanded[1] || panelLoaded[1]) loadPanel1(true);
    } catch (err) {
        console.error("[RFID] restoreCard error:", err);
        showToast("Lỗi khôi phục thẻ", err.message, "error");
    }
}

// [Xoá vĩnh viễn]: xoá hẳn khỏi database (với confirm modal)
async function purgeCard(uid) {
    const confirmed = await confirmAction({
        title: "Xoá vĩnh viễn thẻ?",
        message: `Xoá vĩnh viễn thẻ ${uid}? Hành động này KHÔNG THỂ hoàn tác — thẻ sẽ biến mất hoàn toàn khỏi hệ thống.`,
        confirmText: "Xoá vĩnh viễn",
        danger: true
    });

    if (!confirmed) return;

    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        await Promise.all([
            remove(ref(db, `authorized_cards/${uid}`)),
            remove(ref(db, `revoked_cards/${uid}`)),
            remove(ref(db, `pending_cards/${uid}`))
        ]);
        showToast("Đã xoá vĩnh viễn", `Thẻ ${uid} đã bị xoá hoàn toàn khỏi hệ thống.`, "success");

        loadPanel4(true);
        if (panelExpanded[1] || panelLoaded[1]) loadPanel1(true);
    } catch (err) {
        console.error("[RFID] purgeCard error:", err);
        showToast("Lỗi xoá vĩnh viễn", err.message, "error");
    }
}

// [Từ chối]: update pending_cards status="rejected" (với confirm modal)
async function rejectCard(uid) {
    const confirmed = await confirmAction({
        title: "Từ chối thẻ?",
        message: `Bạn có chắc muốn từ chối thẻ ${uid}? Bạn vẫn có thể Duyệt lại thẻ này sau.`,
        confirmText: "Từ chối",
        danger: true
    });

    if (!confirmed) return;

    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        await update(ref(db, `pending_cards/${uid}`), { status: "rejected", reject_rescan: false });
        showToast("Đã từ chối thẻ", `Thẻ ${uid} bị từ chối.`, "info");

        loadPanel3(true);
    } catch (err) {
        console.error("[RFID] rejectCard error:", err);
        showToast("Lỗi từ chối thẻ", err.message, "error");
    }
}

// [Duyệt / Duyệt lại]: Mở modal nhập nhãn
function openApproveModal(uid) {
    _approveTargetUid = uid;
    const modal = document.getElementById("modal-add-card");
    const input = document.getElementById("modal-card-label-input");
    const uidDisplay = document.getElementById("modal-card-uid-display");
    if (!modal) return;
    if (uidDisplay) uidDisplay.textContent = uid;
    if (input) input.value = "";
    modal.classList.remove("hidden");
    setTimeout(() => input?.focus(), 80);
}

async function confirmApprove() {
    const uid = _approveTargetUid;
    if (!uid) return;
    const input = document.getElementById("modal-card-label-input");
    const label = input?.value.trim() || `Thẻ ${uid.slice(-4)}`;
    closeApproveModal();

    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Thao tác bị bỏ qua trong mock mode.", "warning");
            return;
        }
        const now = Date.now();
        await set(ref(db, `authorized_cards/${uid}`), {
            added_at: now,
            label,
            locked: false,
            deleted: false
        });
        await update(ref(db, `pending_cards/${uid}`), { status: "approved", label });
        await remove(ref(db, `revoked_cards/${uid}`));

        showToast("Đã duyệt thẻ", `UID ${uid} — nhãn "${label}" đã được cấp quyền.`, "success");

        loadPanel3(true);
        if (panelExpanded[1] || panelLoaded[1]) loadPanel1(true);
    } catch (err) {
        console.error("[RFID] approveCard error:", err);
        showToast("Lỗi duyệt thẻ", err.message, "error");
    }
}

function closeApproveModal() {
    _approveTargetUid = null;
    document.getElementById("modal-add-card")?.classList.add("hidden");
}

// ── ACCORDION TOGGLE & REFRESH ────────────────────────────────
function togglePanel(panelId) {
    const body = document.getElementById(`panel${panelId}-body`);
    const icon = document.getElementById(`accordion-icon-${panelId}`);
    if (!body) return;

    const isExpanded = !body.classList.contains("hidden");

    if (isExpanded) {
        // Collapse
        body.classList.add("hidden");
        icon?.classList.remove("rotate-180");
        panelExpanded[panelId] = false;
    } else {
        // Expand
        body.classList.remove("hidden");
        icon?.classList.add("rotate-180");
        panelExpanded[panelId] = true;

        // Lazy fetch if not loaded yet
        if (!panelLoaded[panelId]) {
            if (panelId === 1) loadPanel1();
            else if (panelId === 2) loadPanel2();
            else if (panelId === 3) loadPanel3();
            else if (panelId === 4) loadPanel4();
        }
    }
}

function refreshPanel(panelId) {
    const body = document.getElementById(`panel${panelId}-body`);
    const icon = document.getElementById(`accordion-icon-${panelId}`);

    // Ensure expanded
    if (body?.classList.contains("hidden")) {
        body.classList.remove("hidden");
        icon?.classList.add("rotate-180");
        panelExpanded[panelId] = true;
    }

    if (panelId === 1) loadPanel1(true);
    else if (panelId === 2) loadPanel2(true);
    else if (panelId === 3) loadPanel3(true);
    else if (panelId === 4) loadPanel4(true);
}

// ── INIT ──────────────────────────────────────────────────────
export function initRfidManager() {
    // Nav badge realtime listener
    initNavBadgeListener();

    // Accordion headers
    document.querySelectorAll(".accordion-header").forEach(header => {
        header.addEventListener("click", e => {
            // Prevent toggling when clicking the refresh icon button
            if (e.target.closest(".btn-refresh-panel")) return;
            const panelId = Number(header.dataset.panel);
            if (panelId) togglePanel(panelId);
        });
    });

    // Refresh buttons
    document.querySelectorAll(".btn-refresh-panel").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const panelId = Number(btn.dataset.panel);
            if (panelId) refreshPanel(panelId);
        });
    });

    // Modal buttons
    document.getElementById("modal-add-card-confirm")?.addEventListener("click", confirmApprove);
    document.getElementById("modal-add-card-cancel")?.addEventListener("click", closeApproveModal);
    document.getElementById("modal-add-card")?.addEventListener("click", e => {
        if (e.target === e.currentTarget) closeApproveModal();
    });
    document.getElementById("modal-card-label-input")?.addEventListener("keydown", e => {
        if (e.key === "Enter") confirmApprove();
        if (e.key === "Escape") closeApproveModal();
    });
}
