import {
    USE_MOCK_DEMO,
    db,
    getMockSecurity,
    setMockSecurity,
    ref,
    onValue,
    update
} from "../core/firebase.js";
import { showToast } from "../core/ui.js";

function renderSecurityUi(security) {
    const divMotionBg = document.getElementById("div-motion-bg");
    const iconMotion = document.getElementById("icon-motion");
    const lblMotionStatus = document.getElementById("lbl-motion-status");
    const lblAlarmStatus = document.getElementById("lbl-alarm-status");
    const btnClearAlarm = document.getElementById("btn-clear-alarm");
    const btnToggleAlarm = document.getElementById("btn-toggle-alarm");
    const btnSaveSecurityMode = document.getElementById("btn-save-security-mode");

    const state = security || {};
    const motionDetected = Boolean(state.motion_detected);
    const alarmActive = Boolean(state.alarm_status);
    const mode = state.mode || "always";

    if (divMotionBg) {
        divMotionBg.className = motionDetected
            ? "p-4 rounded-3xl bg-rose-500/15 flex items-center gap-4 border border-rose-500/30 animate-pulse"
            : "p-4 rounded-3xl bg-slate-900/70 flex items-center gap-4 border border-slate-700/60";
    }
    if (iconMotion) {
        iconMotion.className = motionDetected ? "text-2xl text-rose-400" : "text-2xl text-slate-400";
    }
    if (lblMotionStatus) {
        lblMotionStatus.innerText = motionDetected ? "Cảnh báo: Phát hiện chuyển động" : "Không phát hiện đột nhập";
        lblMotionStatus.className = motionDetected ? "font-bold text-rose-300" : "text-sm text-slate-400";
    }

    if (btnToggleAlarm) {
        btnToggleAlarm.innerText = alarmActive ? "CÒI ĐANG HÚ (BẤM ĐỂ TẮT)" : "HỆ THỐNG AN TOÀN";
        btnToggleAlarm.className = alarmActive
            ? "w-full py-3 bg-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-600/25 animate-bounce"
            : "w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl cursor-pointer hover:bg-slate-700 transition";
        btnToggleAlarm.dataset.active = alarmActive ? "true" : "false";
    }
    if (lblAlarmStatus) {
        lblAlarmStatus.innerText = alarmActive ? "Hệ thống còi hú: ĐANG BẬT" : "Hệ thống còi hú: Bình thường";
        lblAlarmStatus.className = alarmActive ? "text-xs text-rose-300 font-semibold mt-1" : "text-xs text-slate-500 mt-1";
    }
    btnClearAlarm?.classList.toggle("hidden", !alarmActive);

    const checkedRadio = document.querySelector(`input[name="security-mode"][value="${mode}"]`);
    if (checkedRadio) {
        checkedRadio.checked = true;
    }

    const demoBadge = document.getElementById("security-demo-badge");
    demoBadge?.classList.toggle("hidden", !USE_MOCK_DEMO);
    btnSaveSecurityMode && (btnSaveSecurityMode.disabled = false);
}

async function writeSecurity(nextSecurity) {
    if (USE_MOCK_DEMO) {
        setMockSecurity(nextSecurity);
        renderSecurityUi(nextSecurity);
        return;
    }

    await update(ref(db, "security"), nextSecurity);
}

export function initSecurityFeature() {
    const btnClearAlarm = document.getElementById("btn-clear-alarm");
    const btnToggleAlarm = document.getElementById("btn-toggle-alarm");
    const btnSaveSecurityMode = document.getElementById("btn-save-security-mode");

    if (btnToggleAlarm) {
        btnToggleAlarm.dataset.active = "false";
    }

    if (USE_MOCK_DEMO) {
        renderSecurityUi(getMockSecurity());
    } else {
        onValue(ref(db, "security"), snapshot => {
            renderSecurityUi(snapshot.val() || {});
        });
    }

    btnSaveSecurityMode?.addEventListener("click", async () => {
        const selectedRadio = document.querySelector('input[name="security-mode"]:checked');
        if (!selectedRadio) {
            showToast("Chưa chọn chế độ", "Hãy chọn một chế độ bảo vệ trước khi cập nhật.", "warning");
            return;
        }

        try {
            const nextSecurity = USE_MOCK_DEMO
                ? { ...getMockSecurity(), mode: selectedRadio.value }
                : { mode: selectedRadio.value };
            await writeSecurity(nextSecurity);
            showToast("Đã cập nhật chế độ an ninh", "Cấu hình bảo vệ đã được lưu thành công.", "success");
        } catch (error) {
            console.error("Không thể lưu chế độ an ninh:", error);
            showToast("Không lưu được chế độ an ninh", "Kiểm tra lại dữ liệu cục bộ.", "error");
        }
    });

    btnClearAlarm?.addEventListener("click", async () => {
        try {
            const nextSecurity = USE_MOCK_DEMO
                ? { ...getMockSecurity(), alarm_status: false, motion_detected: false }
                : { alarm_status: false, motion_detected: false, mode: "always" };
            await writeSecurity(nextSecurity);
            showToast("Đã tắt còi báo động", "Tín hiệu khẩn cấp đã được reset.", "success");
        } catch (error) {
            console.error("Không thể tắt còi báo động:", error);
            showToast("Không tắt được còi báo động", "Kiểm tra lại dữ liệu cục bộ.", "error");
        }
    });

    btnToggleAlarm?.addEventListener("click", async () => {
        const isAlarmHuming = btnToggleAlarm.dataset.active === "true";
        try {
            const nextSecurity = USE_MOCK_DEMO
                ? { ...getMockSecurity(), alarm_status: !isAlarmHuming }
                : { alarm_status: !isAlarmHuming };
            await writeSecurity(nextSecurity);
            showToast(
                !isAlarmHuming ? "Đã kích hoạt còi thử" : "Đã tắt còi thử",
                !isAlarmHuming ? "Dùng để demo âm báo động." : "Còi báo động đã trở về trạng thái bình thường.",
                !isAlarmHuming ? "warning" : "info"
            );
        } catch (error) {
            console.error("Không thể đổi trạng thái còi báo động:", error);
            showToast("Không đổi được trạng thái còi", "Kiểm tra lại dữ liệu cục bộ.", "error");
        }
    });
}
