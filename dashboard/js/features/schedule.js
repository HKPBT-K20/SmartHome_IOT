import {
    USE_MOCK_DEMO,
    db,
    getMockSchedules,
    setMockSchedules,
    ref,
    onValue,
    update
} from "../core/firebase.js";
import {
    buildScheduleState,
    formatDuration,
    isValidTime,
    showToast
} from "../core/ui.js";

const CHANNELS = ["ch1", "ch3"];
const LABELS = {
    ch1: "Đèn phòng làm việc",
    ch3: "Đèn phòng khách"
};

let timeSyncReady = true;
const scheduleCache = { ch1: null, ch3: null };

function getScheduleElements(ch) {
    return {
        timeOnInput: document.getElementById(`time-on-${ch}`),
        timeOffInput: document.getElementById(`time-off-${ch}`),
        toggleBtn: document.getElementById(`btn-toggle-sch-${ch}`),
        saveBtn: document.getElementById(`btn-save-sch-${ch}`),
        statusLabel: document.getElementById(`lbl-schedule-status-${ch}`),
        summaryLabel: document.getElementById(`schedule-summary-${ch}`)
    };
}

function renderTimeSyncBanner(isSynced) {
    timeSyncReady = Boolean(isSynced);
    const banner = document.getElementById("schedule-time-sync-banner");
    const text = document.getElementById("schedule-time-sync-text");

    if (!banner) return;

    banner.classList.toggle("hidden", timeSyncReady);
    if (text) {
        text.innerText = timeSyncReady
            ? "ESP32 đã đồng bộ NTP, lịch hẹn giờ đang hoạt động."
            : "ESP32 chưa đồng bộ NTP, lịch hẹn giờ sẽ tạm dừng.";
    }
}

function renderScheduleUi(ch, schedule) {
    const { timeOnInput, timeOffInput, toggleBtn, saveBtn, statusLabel, summaryLabel } = getScheduleElements(ch);
    if (!timeOnInput || !timeOffInput || !toggleBtn || !saveBtn || !statusLabel || !summaryLabel) {
        return;
    }

    scheduleCache[ch] = schedule || null;

    const state = buildScheduleState(schedule);
    timeOnInput.value = state.onTime;
    timeOffInput.value = state.offTime;

    if (!schedule) {
        statusLabel.innerText = "Chưa có lịch hẹn giờ";
        statusLabel.className = "text-xs text-slate-400 block";
        summaryLabel.innerText = "Nhập giờ bật/tắt rồi bấm Lưu để tạo lịch demo.";
        summaryLabel.className = "text-xs text-slate-500 mt-2";
        toggleBtn.innerText = "Bật";
        toggleBtn.dataset.enabled = "false";
        toggleBtn.disabled = true;
        toggleBtn.className = "px-3 py-1.5 bg-slate-800 text-slate-300 rounded-2xl transition text-sm cursor-not-allowed opacity-60";
        saveBtn.disabled = false;
        return;
    }

    if (state.hasConfig) {
        statusLabel.innerText = `Tự động: ${state.enabled ? "Bật" : "Tắt"} · ${state.statusText}`;
        statusLabel.className = state.enabled ? "text-xs text-sky-300 font-medium block" : "text-xs text-slate-500 block";
        summaryLabel.innerText = state.overnight
            ? `Khung giờ qua đêm: ${state.onTime} → ${state.offTime}.`
            : `Khung giờ hằng ngày: ${state.onTime} → ${state.offTime}.`;
        summaryLabel.innerText += state.enabled
            ? ` Chu kỳ chạy: ${formatDuration(state.durationMinutes)}.`
            : " Bấm Bật để đưa vào demo.";
    } else {
        statusLabel.innerText = "Lịch đã lưu nhưng chưa hợp lệ";
        statusLabel.className = "text-xs text-amber-300 block";
        summaryLabel.innerText = "Cần nhập đủ 2 mốc giờ hợp lệ.";
    }

    if (!timeSyncReady) {
        statusLabel.innerText = "Chưa đồng bộ NTP · lịch đang tạm dừng";
        statusLabel.className = "text-xs text-amber-300 font-medium block";
    }

    toggleBtn.innerText = state.enabled ? "Tắt hẹn giờ" : "Bật hẹn giờ";
    toggleBtn.dataset.enabled = state.enabled ? "true" : "false";
    toggleBtn.disabled = !state.hasConfig || (!timeSyncReady && !state.enabled);
    toggleBtn.className = state.enabled
        ? "px-3 py-1.5 bg-sky-600/25 text-sky-300 border border-sky-500/30 rounded-2xl transition text-sm"
        : state.hasConfig
            ? (!timeSyncReady
                ? "px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-2xl transition text-sm cursor-not-allowed opacity-80"
                : "px-3 py-1.5 bg-slate-800 text-slate-300 rounded-2xl transition text-sm hover:bg-slate-700")
            : "px-3 py-1.5 bg-slate-800 text-slate-500 rounded-2xl transition text-sm cursor-not-allowed opacity-60";
    saveBtn.disabled = false;
}

function bindScheduleActions(ch) {
    const { timeOnInput, timeOffInput, toggleBtn, saveBtn } = getScheduleElements(ch);
    if (!timeOnInput || !timeOffInput || !toggleBtn || !saveBtn) {
        return;
    }

    saveBtn.addEventListener("click", async () => {
        const onTime = timeOnInput.value.trim();
        const offTime = timeOffInput.value.trim();

        if (!isValidTime(onTime) || !isValidTime(offTime) || onTime === offTime) {
            showToast("Giờ hẹn không hợp lệ", "Cần nhập 2 mốc giờ khác nhau theo định dạng HH:MM.", "warning");
            return;
        }

        saveBtn.disabled = true;
        try {
            if (USE_MOCK_DEMO) {
                const schedules = getMockSchedules();
                const currentSchedule = schedules[ch] || {};
                schedules[ch] = {
                    ...currentSchedule,
                    on_time: onTime,
                    off_time: offTime,
                    enabled: Boolean(currentSchedule.enabled),
                    mode: "daily",
                    duration_minutes: null,
                    updated_at: new Date().toISOString()
                };
                setMockSchedules(schedules);
                renderScheduleUi(ch, schedules[ch]);
            } else {
                await update(ref(db, `schedules/${ch}`), {
                    on_time: onTime,
                    off_time: offTime,
                    mode: "daily"
                });
            }
            showToast("Đã lưu lịch hẹn giờ", `${LABELS[ch]} đã được cập nhật.`, "success");
        } catch (error) {
            console.error(`Không thể lưu lịch trình cho ${ch}:`, error);
            showToast("Không lưu được lịch trình", "Kiểm tra lại dữ liệu cục bộ.", "error");
        } finally {
            saveBtn.disabled = false;
        }
    });

    toggleBtn.addEventListener("click", async () => {
        const isCurrentlyEnabled = toggleBtn.dataset.enabled === "true";
        const nextEnabled = !isCurrentlyEnabled;
        const onTime = timeOnInput.value.trim();
        const offTime = timeOffInput.value.trim();

        if (nextEnabled && !timeSyncReady) {
            showToast("Chưa đồng bộ NTP", "ESP32 chưa có giờ thật nên lịch không thể bật. Hãy chờ đồng bộ thời gian rồi bật lại.", "error");
            return;
        }

        if (nextEnabled && (!isValidTime(onTime) || !isValidTime(offTime) || onTime === offTime)) {
            showToast("Không thể bật hẹn giờ", "Cần lưu một khung giờ hợp lệ trước khi bật.", "warning");
            return;
        }

        toggleBtn.disabled = true;
        try {
            if (USE_MOCK_DEMO) {
                const schedules = getMockSchedules();
                const currentSchedule = schedules[ch] || {
                    on_time: onTime,
                    off_time: offTime,
                    mode: "daily",
                    duration_minutes: null
                };
                schedules[ch] = {
                    ...currentSchedule,
                    enabled: nextEnabled,
                    updated_at: new Date().toISOString()
                };
                setMockSchedules(schedules);
                renderScheduleUi(ch, schedules[ch]);
            } else {
                await update(ref(db, `schedules/${ch}`), {
                    enabled: nextEnabled
                });
            }
            showToast(
                nextEnabled ? "Đã bật hẹn giờ" : "Đã tắt hẹn giờ",
                `Thiết bị ${ch.toUpperCase()} đã được ${nextEnabled ? "kích hoạt" : "dừng"} chế độ tự động.`,
                nextEnabled ? "success" : "info"
            );
        } catch (error) {
            console.error(`Không thể đổi trạng thái hẹn giờ cho ${ch}:`, error);
            showToast("Không đổi được trạng thái hẹn giờ", "Kiểm tra lại dữ liệu cục bộ.", "error");
        } finally {
            toggleBtn.disabled = false;
        }
    });
}

export function initScheduleFeature() {
    CHANNELS.forEach(bindScheduleActions);

    if (USE_MOCK_DEMO) {
        const schedules = getMockSchedules();
        CHANNELS.forEach(ch => {
            scheduleCache[ch] = schedules[ch] || null;
            renderScheduleUi(ch, scheduleCache[ch]);
        });
        renderTimeSyncBanner(true);
        return;
    }

    onValue(ref(db, "system/time_synced"), snapshot => {
        const synced = snapshot.val() === true;
        renderTimeSyncBanner(synced);
        CHANNELS.forEach(ch => renderScheduleUi(ch, scheduleCache[ch]));
    });

    onValue(ref(db, "schedules"), snapshot => {
        const schedules = snapshot.val() || {};
        CHANNELS.forEach(ch => {
            scheduleCache[ch] = schedules[ch] || null;
            renderScheduleUi(ch, scheduleCache[ch]);
        });
    });
}
