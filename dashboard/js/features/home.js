import {
    db,
    ref,
    onValue,
    update
} from "../core/firebase.js";
import { showToast } from "../core/ui.js";

const RELAYS = [
    { ch: 1, relayKey: "ch1", commandKey: "relay_1", label: "Đèn 1" },
    { ch: 2, relayKey: "ch2", commandKey: "relay_2", label: "Đèn 2" }
];

function setMetric(id, value, suffix = "") {
    const el = document.getElementById(id);
    if (!el) {
        return;
    }

    el.innerText = value === null || value === undefined || value === ""
        ? `--${suffix}`
        : `${value}${suffix}`;
}

function setRelayButtonState(ch, isOn) {
    const btn = document.getElementById(`btn-ch${ch}`);
    const status = document.getElementById(`status-ch${ch}`);
    if (!btn || !status) {
        return;
    }

    btn.innerText = isOn ? "ON" : "OFF";
    btn.className = isOn
        ? "px-4 py-2 bg-emerald-500 text-white rounded-2xl font-semibold transition shadow-sm shadow-emerald-900/25"
        : "px-4 py-2 bg-slate-800 text-white rounded-2xl font-semibold transition shadow-sm shadow-slate-900/40";
    status.innerText = isOn ? "Đang bật" : "Đang tắt";
    status.className = isOn ? "text-xs text-emerald-300" : "text-xs text-slate-400";
}

function bindRelayControl(ch, commandKey, label) {
    const btn = document.getElementById(`btn-ch${ch}`);
    if (!btn) {
        return;
    }

    btn.addEventListener("click", async () => {
        const nextOn = btn.innerText !== "ON";
        btn.disabled = true;
        try {
            await update(ref(db, "commands"), {
                [commandKey]: nextOn
            });
            showToast(
                nextOn ? "Đã gửi lệnh bật" : "Đã gửi lệnh tắt",
                `${label} đã được cập nhật lên Firebase.`,
                "success"
            );
        } catch (error) {
            console.error(`Không thể cập nhật ${label}:`, error);
            showToast("Không gửi được lệnh", "Kiểm tra kết nối Firebase.", "error");
        } finally {
            btn.disabled = false;
        }
    });
}

export function initHomeFeature() {
    onValue(ref(db, "sensors"), snapshot => {
        const sensors = snapshot.val() || {};
        setMetric("txt-temp", sensors.temp ?? sensors.temperature, " °C");
        setMetric("txt-light", sensors.light ?? sensors.lightLevel, " Lux");
        setMetric("txt-humidity", sensors.humidity ?? sensors.humid, " %");
        setMetric("txt-air", sensors.air ?? sensors.airQuality ?? sensors.ppm, " PPM");
    });

    onValue(ref(db, "relay"), snapshot => {
        const relayState = snapshot.val() || {};
        RELAYS.forEach(({ ch, relayKey }) => {
            setRelayButtonState(ch, Boolean(relayState[relayKey]));
        });
    });

    RELAYS.forEach(({ ch, commandKey, label }) => bindRelayControl(ch, commandKey, label));
}
