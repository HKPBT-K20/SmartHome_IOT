import {
    USE_MOCK_DEMO,
    db,
    getMockAccessLogs,
    clearMockAccessLogs,
    ref,
    onValue,
    remove
} from "../core/firebase.js";
import { confirmAction, showToast } from "../core/ui.js";

const ACCESS_LOG_PATH = "access_logs";
const LEGACY_ACCESS_LOG_PATH = "access_log";

let latestAccessLogs = {};
let latestLegacyLogs = {};

function normalizeLogEntry(log = {}) {
    const createdAtRaw = log.created_at ?? log.createdAt ?? log.timestamp_ms ?? log.time_ms;
    const createdAt = Number.isFinite(Number(createdAtRaw)) ? Number(createdAtRaw) : 0;
    const displayTime = log.display_time ?? log.timestamp ?? log.time ?? "--";
    const method = log.auth_method ?? log.method ?? "--";
    const user = log.actor_name ?? log.user ?? log.identity_value ?? log.actor_id ?? "--";

    let status = log.result ?? log.status ?? "--";
    if (status === "--" && typeof log.granted === "boolean") {
        status = log.granted ? "Success" : "Denied";
    }

    return {
        createdAt,
        displayTime,
        method,
        user,
        status
    };
}

function renderLogRows(logs) {
    const tableDashboard = document.getElementById("table-access-log");
    const tableFullLogs = document.getElementById("table-full-logs");

    if (!logs || Object.keys(logs).length === 0) {
        const emptyRow = '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">Chưa có dữ liệu lịch sử ra vào.</td></tr>';
        if (tableDashboard) tableDashboard.innerHTML = emptyRow;
        if (tableFullLogs) tableFullLogs.innerHTML = emptyRow;
        return;
    }

    const logEntries = Object.values(logs)
        .map(normalizeLogEntry)
        .sort((a, b) => b.createdAt - a.createdAt);

    if (tableDashboard) tableDashboard.innerHTML = "";
    if (tableFullLogs) tableFullLogs.innerHTML = "";

    logEntries.forEach((log, index) => {
        const isSuccess = log.status === "Success" || log.status === "Granted" || log.status === "Allow";
        const statusStyle = isSuccess
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-red-400 bg-red-500/10";
        const iconType = log.method === "RFID"
            ? "fa-id-card text-purple-400"
            : "fa-fingerprint text-blue-400";

        const rowHtml = `
            <tr class="hover:bg-slate-900/80 border-b border-slate-700/60">
                <td class="px-6 py-4 text-slate-300 font-mono text-xs">${log.displayTime ?? "--"}</td>
                <td class="px-6 py-4 font-medium"><i class="fa-solid ${iconType} mr-2"></i>${log.method ?? "--"}</td>
                <td class="px-6 py-4 text-slate-300">${log.user ?? "--"}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${statusStyle}">${log.status ?? "--"}</span>
                </td>
            </tr>
        `;

        if (index < 4 && tableDashboard) {
            tableDashboard.innerHTML += rowHtml;
        }
        if (tableFullLogs) {
            tableFullLogs.innerHTML += rowHtml;
        }
    });
}

function refreshLogsView() {
    const preferredLogs = Object.keys(latestAccessLogs).length > 0
        ? latestAccessLogs
        : latestLegacyLogs;

    renderLogRows(preferredLogs);
}

export function initLogsFeature() {
    const btnClearLogs = document.getElementById("btn-clear-logs");

    if (USE_MOCK_DEMO) {
        latestAccessLogs = getMockAccessLogs();
        refreshLogsView();
    } else {
        onValue(ref(db, ACCESS_LOG_PATH), snapshot => {
            latestAccessLogs = snapshot.val() || {};
            refreshLogsView();
        });

        onValue(ref(db, LEGACY_ACCESS_LOG_PATH), snapshot => {
            latestLegacyLogs = snapshot.val() || {};
            refreshLogsView();
        });
    }

    btnClearLogs?.addEventListener("click", async () => {
        const confirmed = await confirmAction({
            title: "Xóa lịch sử truy cập?",
            message: "Hành động này sẽ xóa toàn bộ nhật ký ra/vào đang hiển thị trên dashboard.",
            confirmText: "Xóa ngay",
            danger: true
        });

        if (!confirmed) {
            return;
        }

        try {
            if (USE_MOCK_DEMO) {
                clearMockAccessLogs();
                latestAccessLogs = {};
                latestLegacyLogs = {};
                refreshLogsView();
            } else {
                await remove(ref(db, ACCESS_LOG_PATH));
                await remove(ref(db, LEGACY_ACCESS_LOG_PATH));
            }
            showToast("Đã xóa lịch sử truy cập", "Toàn bộ log đã được dọn sạch.", "success");
        } catch (error) {
            console.error("Không thể xóa nhật ký truy cập:", error);
            showToast("Không xóa được nhật ký", "Kiểm tra lại dữ liệu cục bộ.", "error");
        }
    });
}
