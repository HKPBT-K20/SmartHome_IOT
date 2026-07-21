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

let lastMotionDetected = null;
let motionAlertTimer = null;

function hideMotionAlert() {
    const modal = document.getElementById("motion-alert-modal");
    if (!modal) return;

    modal.classList.add("hidden");
    modal.classList.remove("flex");

    if (motionAlertTimer) {
        clearTimeout(motionAlertTimer);
        motionAlertTimer = null;
    }
}

function showMotionAlert() {
    const modal = document.getElementById("motion-alert-modal");
    const title = document.getElementById("motion-alert-title");
    const message = document.getElementById("motion-alert-message");

    if (!modal) return;

    if (title) title.innerText = "Phát hiện chuyển động";
    if (message) message.innerText = "Cảm biến PIR vừa ghi nhận chuyển động bất thường. Hệ thống đang theo dõi.";

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    if (motionAlertTimer) {
        clearTimeout(motionAlertTimer);
    }

    motionAlertTimer = setTimeout(() => {
        hideMotionAlert();
    }, 4500);
}

function renderSecurityUi(security) {
    const divMotionBg = document.getElementById("div-motion-bg");
    const iconMotion = document.getElementById("icon-motion");
    const lblMotionStatus = document.getElementById("lbl-motion-status");
    const lblAlarmStatus = document.getElementById("lbl-alarm-status");
    const btnClearAlarm = document.getElementById("btn-clear-alarm");
    const btnToggleAlarm = document.getElementById("btn-toggle-alarm");
    const btnSaveSecurityMode = document.getElementById("btn-save-security-mode");
    const securityCard = document.querySelector("#page-security .panel-card");

    const state = security || {};
    const motionDetected = Boolean(state.motion_detected);
    const alarmActive = Boolean(state.alarm_status);
    const mode = state.mode || "always";
    const isLightTheme = document.body.classList.contains("light-theme");

    if (securityCard) {
        securityCard.classList.toggle("security-alert-active", alarmActive || motionDetected);
    }

    if (divMotionBg) {
        if (motionDetected) {
            divMotionBg.className = isLightTheme
                ? "p-4 rounded-3xl bg-rose-50/95 flex items-center gap-4 border border-rose-300/70 animate-pulse shadow-[0_16px_30px_rgba(248,113,113,0.12)]"
                : "p-4 rounded-3xl bg-rose-500/15 flex items-center gap-4 border border-rose-500/30 animate-pulse";
        } else {
            divMotionBg.className = isLightTheme
                ? "p-4 rounded-3xl bg-slate-100/95 flex items-center gap-4 border border-slate-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                : "p-4 rounded-3xl bg-slate-900/70 flex items-center gap-4 border border-slate-700/60";
        }
    }

    if (iconMotion) {
        iconMotion.className = motionDetected
            ? isLightTheme
                ? "text-2xl text-rose-500"
                : "text-2xl text-rose-400"
            : isLightTheme
                ? "text-2xl text-slate-600"
                : "text-2xl text-slate-400";
    }

    if (lblMotionStatus) {
        lblMotionStatus.innerText = motionDetected
            ? "Có chuyển động - PIR đang kích hoạt"
            : "Không phát hiện chuyển động";
        lblMotionStatus.className = motionDetected
            ? isLightTheme
                ? "font-bold text-rose-700"
                : "font-bold text-rose-300"
            : isLightTheme
                ? "text-sm text-slate-700"
                : "text-sm text-slate-400";
    }

    if (btnToggleAlarm) {
        btnToggleAlarm.innerText = alarmActive ? "CÒI ĐANG HÚ (BẤM ĐỂ TẮT)" : "HỆ THỐNG AN TOÀN";
        if (alarmActive) {
            btnToggleAlarm.className = isLightTheme
                ? "w-full py-3 bg-rose-500 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-500/25 animate-bounce"
                : "w-full py-3 bg-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-600/25 animate-bounce";
        } else {
            btnToggleAlarm.className = isLightTheme
                ? "w-full py-3 bg-rose-500 text-white font-bold rounded-2xl cursor-pointer hover:bg-rose-400 border border-rose-400/40 transition shadow-lg shadow-rose-500/15"
                : "w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl cursor-pointer hover:bg-slate-700 transition";
        }
        btnToggleAlarm.dataset.active = alarmActive ? "true" : "false";
    }

    if (lblAlarmStatus) {
        lblAlarmStatus.innerText = motionDetected
            ? "Còi đang xử lý cảnh báo chuyển động"
            : alarmActive
                ? "Hệ thống còi hú: ĐANG BẬT"
                : "Hệ thống còi hú: Bình thường";
        lblAlarmStatus.className = motionDetected
            ? isLightTheme
                ? "text-xs text-rose-700 font-semibold mt-1 animate-pulse"
                : "text-xs text-rose-300 font-semibold mt-1 animate-pulse"
            : alarmActive
                ? isLightTheme
                    ? "text-xs text-rose-500 font-semibold mt-1"
                    : "text-xs text-rose-300 font-semibold mt-1"
                : isLightTheme
                    ? "text-xs text-slate-500 mt-1"
                    : "text-xs text-slate-500 mt-1";
    }

    btnClearAlarm?.classList.toggle("hidden", !alarmActive);

    const checkedRadio = document.querySelector(`input[name="security-mode"][value="${mode}"]`);
    if (checkedRadio) {
        checkedRadio.checked = true;
    }

    const demoBadge = document.getElementById("security-demo-badge");
    demoBadge?.classList.toggle("hidden", !USE_MOCK_DEMO);
    btnSaveSecurityMode && (btnSaveSecurityMode.disabled = false);

    if (lastMotionDetected === false && motionDetected) {
        showMotionAlert();
    } else if (lastMotionDetected !== null && !motionDetected) {
        hideMotionAlert();
    }

    lastMotionDetected = motionDetected;
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
    const motionAlertModal = document.getElementById("motion-alert-modal");
    const motionAlertClose = document.getElementById("motion-alert-close");

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
            const selectedRadio = document.querySelector('input[name="security-mode"]:checked');
            const currentMode = selectedRadio?.value || "always";
            const nextSecurity = USE_MOCK_DEMO
                ? { ...getMockSecurity(), alarm_status: false, motion_detected: false, mode: currentMode }
                : { alarm_status: false, motion_detected: false, mode: currentMode };
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

    motionAlertClose?.addEventListener("click", hideMotionAlert);
    motionAlertModal?.addEventListener("click", event => {
        if (event.target === motionAlertModal) {
            hideMotionAlert();
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            hideMotionAlert();
        }
    });
}
