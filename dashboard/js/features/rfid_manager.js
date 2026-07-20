import {
    USE_MOCK_DEMO,
    db,
    ref,
    onValue,
    set,
    update,
    remove
} from "../core/firebase.js";
import { showToast } from "../core/ui.js";

// ── STATE ─────────────────────────────────────────────────────
let _pendingSnapshot = {};
let _authorizedSnapshot = {};
let _approveTargetUid = null;

// ── BADGE UPDATE ──────────────────────────────────────────────
function updateNavBadge(pendingCardsData) {
    const badge = document.getElementById("rfid-nav-badge");
    if (!badge) return;

    const count = Object.values(pendingCardsData || {}).filter(card =>
        card.status === "pending" && !card.reject_rescan
    ).length;

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

// ── RENDER AUTHORIZED CARDS ───────────────────────────────────
function renderAuthorizedCards(authorizedData) {
    const container = document.getElementById("authorized-cards-list");
    if (!container) return;

    const entries = Object.entries(authorizedData || {});

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-id-card text-2xl mb-3 block opacity-40"></i>
                Chưa có thẻ nào được cấp quyền.
            </div>`;
        return;
    }

    entries.sort((a, b) => (a[1].added_at || 0) - (b[1].added_at || 0));

    container.innerHTML = entries.map(([uid, card]) => {
        const addedAt = card.added_at
            ? new Date(card.added_at).toLocaleString("vi-VN")
            : "--";
        const label = card.label || "(Không có nhãn)";
        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border border-emerald-500/20" data-uid="${uid}">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-emerald-300 shrink-0">
                        <i class="fa-solid fa-id-badge text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="font-mono text-sm font-semibold text-white">${uid}</p>
                        <p class="text-xs text-slate-400 truncate">${label} &nbsp;&middot;&nbsp; Thêm lúc: ${addedAt}</p>
                    </div>
                </div>
                <button
                    class="btn-revoke shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition"
                    data-uid="${uid}">
                    <i class="fa-solid fa-ban mr-1"></i>Thu hồi
                </button>
            </div>`;
    }).join("");

    container.querySelectorAll(".btn-revoke").forEach(btn => {
        btn.addEventListener("click", () => revokeCard(btn.dataset.uid));
    });
}

// ── RENDER PENDING CARDS ──────────────────────────────────────
function renderPendingCards(pendingData) {
    const container = document.getElementById("pending-cards-list");
    if (!container) return;

    const entries = Object.entries(pendingData || {});

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-satellite-dish text-2xl mb-3 block opacity-40"></i>
                Không có thẻ nào đang chờ xử lý.
            </div>`;
        return;
    }

    entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

    container.innerHTML = entries.map(([uid, card]) => {
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
        } else {
            badge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 border border-slate-600/40 text-slate-400">
                        <i class="fa-solid fa-ban text-[9px]"></i>Đã từ chối
                     </span>`;
            rowBorder = "border-slate-700/40";
        }

        const labelDisplay = label
            ? `<span class="text-xs text-slate-400">Nhãn: <span class="text-emerald-300 font-medium">${label}</span></span>`
            : "";

        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-2xl border ${rowBorder}" data-uid="${uid}">
                <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-xl bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 sm:mt-0">
                        <i class="fa-solid fa-credit-card text-sm"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="font-mono text-sm font-bold text-white">${uid}</span>
                            ${badge}
                        </div>
                        <p class="text-xs text-slate-500">${display_time}</p>
                        ${labelDisplay}
                    </div>
                </div>
                ${actionButtons}
            </div>`;
    }).join("");

    container.querySelectorAll(".btn-approve").forEach(btn => {
        btn.addEventListener("click", () => openApproveModal(btn.dataset.uid));
    });
    container.querySelectorAll(".btn-reject").forEach(btn => {
        btn.addEventListener("click", () => rejectCard(btn.dataset.uid));
    });
}

// ── APPROVE FLOW ──────────────────────────────────────────────
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
    const label = input?.value.trim() || `The ${uid.slice(-4)}`;
    closeApproveModal();
    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Firebase khong kha dung — thao tac bi bo qua.", "warning");
            return;
        }
        const now = Date.now();
        await set(ref(db, `authorized_cards/${uid}`), { added_at: now, label });
        await update(ref(db, `pending_cards/${uid}`), { status: "approved", label });
        showToast("Da duyet the", `UID ${uid} nhan "${label}" da duoc cap quyen.`, "success");
    } catch (err) {
        console.error("[RFID] approveCard error:", err);
        showToast("Loi duyet the", err.message, "error");
    }
}

function closeApproveModal() {
    _approveTargetUid = null;
    document.getElementById("modal-add-card")?.classList.add("hidden");
}

async function rejectCard(uid) {
    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Firebase khong kha dung — thao tac bi bo qua.", "warning");
            return;
        }
        await update(ref(db, `pending_cards/${uid}`), { status: "rejected", reject_rescan: false });
        showToast("Da tu choi the", `UID ${uid} bi tu choi.`, "info");
    } catch (err) {
        console.error("[RFID] rejectCard error:", err);
        showToast("Loi tu choi the", err.message, "error");
    }
}

async function revokeCard(uid) {
    try {
        if (USE_MOCK_DEMO) {
            showToast("Mock mode", "Firebase khong kha dung — thao tac bi bo qua.", "warning");
            return;
        }
        // Ghi /revoked_cards/{uid}=true TRƯỚC — ESP32 poll 5s sẽ bắt ngay
        // và xóa UID khỏi authorizedUIDs trong RAM, không đợi sync 30s
        await set(ref(db, `revoked_cards/${uid}`), true);
        await remove(ref(db, `authorized_cards/${uid}`));
        if (_pendingSnapshot[uid]) {
            await update(ref(db, `pending_cards/${uid}`), { status: "rejected", reject_rescan: false });
        }
        showToast("Da thu hoi quyen", `UID ${uid} da bi xoa khoi danh sach. ESP32 cap nhat trong ~5s.`, "info");
    } catch (err) {
        console.error("[RFID] revokeCard error:", err);
        showToast("Loi thu hoi quyen", err.message, "error");
    }
}

// ── INIT ──────────────────────────────────────────────────────
export function initRfidManager() {
    document.getElementById("modal-add-card-confirm")?.addEventListener("click", confirmApprove);
    document.getElementById("modal-add-card-cancel")?.addEventListener("click", closeApproveModal);
    document.getElementById("modal-add-card")?.addEventListener("click", e => {
        if (e.target === e.currentTarget) closeApproveModal();
    });
    document.getElementById("modal-card-label-input")?.addEventListener("keydown", e => {
        if (e.key === "Enter") confirmApprove();
        if (e.key === "Escape") closeApproveModal();
    });

    if (USE_MOCK_DEMO) {
        renderAuthorizedCards({});
        renderPendingCards({});
        updateNavBadge({});
        return;
    }

    onValue(ref(db, "authorized_cards"), snapshot => {
        _authorizedSnapshot = snapshot.val() || {};
        renderAuthorizedCards(_authorizedSnapshot);
    });

    onValue(ref(db, "pending_cards"), snapshot => {
        _pendingSnapshot = snapshot.val() || {};
        renderPendingCards(_pendingSnapshot);
        updateNavBadge(_pendingSnapshot);
    });
}
