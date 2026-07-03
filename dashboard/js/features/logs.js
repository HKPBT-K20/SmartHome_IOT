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

function renderLogRows(logs) {
    const tableDashboard = document.getElementById("table-access-log");
    const tableFullLogs = document.getElementById("table-full-logs");

    if (!logs || Object.keys(logs).length === 0) {
        const emptyRow = '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">Chưa có dữ liệu lịch sử ra vào.</td></tr>';
        if (tableDashboard) tableDashboard.innerHTML = emptyRow;
        if (tableFullLogs) tableFullLogs.innerHTML = emptyRow;
        return;
    }

    const logEntries = Object.values(logs).reverse();
    if (tableDashboard) tableDashboard.innerHTML = "";
    if (tableFullLogs) tableFullLogs.innerHTML = "";

    logEntries.forEach((log, index) => {
        const statusStyle = log.status === "Success"
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-red-400 bg-red-500/10";
        const iconType = log.method === "RFID"
            ? "fa-id-card text-purple-400"
            : "fa-fingerprint text-blue-400";

        const rowHtml = `
            <tr class="hover:bg-slate-900/80 border-b border-slate-700/60">
                <td class="px-6 py-4 text-slate-300 font-mono text-xs">${log.timestamp ?? "--"}</td>
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

export function initLogsFeature() {
    const btnClearLogs = document.getElementById("btn-clear-logs");

    if (USE_MOCK_DEMO) {
        renderLogRows(getMockAccessLogs());
    } else {
        onValue(ref(db, "access_log"), snapshot => {
            renderLogRows(snapshot.val());
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
                renderLogRows({});
            } else {
                await remove(ref(db, "access_log"));
            }
            showToast("Đã xóa lịch sử truy cập", "Toàn bộ log đã được dọn sạch.", "success");
        } catch (error) {
            console.error("Không thể xóa nhật ký truy cập:", error);
            showToast("Không xóa được nhật ký", "Kiểm tra lại dữ liệu cục bộ.", "error");
        }
    });
}
