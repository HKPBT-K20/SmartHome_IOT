import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { FIREBASE_CONFIG } from "../../.env";

export const firebaseConfig = FIREBASE_CONFIG;

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const USE_MOCK_DEMO = Object.values(firebaseConfig).some(value => typeof value === "string" && value.includes("YOUR_"));

export { ref, onValue, set, update, remove };

import { MOCK_ACCOUNT as ENV_MOCK_ACCOUNT, MOCK_PASSWORD_ALIASES as ENV_MOCK_PASSWORD_ALIASES } from "../../.env";

export const MOCK_ACCOUNT = ENV_MOCK_ACCOUNT;

export const MOCK_PASSWORD_ALIASES = ENV_MOCK_PASSWORD_ALIASES;

const MOCK_SESSION_KEY = "smarthomeMockSession";
const MOCK_SCHEDULES_KEY = "smarthomeMockSchedules";
const MOCK_SECURITY_KEY = "smarthomeMockSecurity";
const MOCK_ACCESS_LOGS_KEY = "smarthomeMockAccessLogs";

export function getMockSession() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_SESSION_KEY) || "null");
    } catch {
        return null;
    }
}

export function setMockSession(user) {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({
        email: user.email,
        displayName: user.displayName
    }));
}

export function clearMockSession() {
    localStorage.removeItem(MOCK_SESSION_KEY);
}

export function getMockSchedules() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_SCHEDULES_KEY) || "{}") || {};
    } catch {
        return {};
    }
}

export function setMockSchedules(schedules) {
    localStorage.setItem(MOCK_SCHEDULES_KEY, JSON.stringify(schedules));
}

export function getMockSecurity() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_SECURITY_KEY) || "null") || {
            mode: "always",
            alarm_status: false,
            motion_detected: false
        };
    } catch {
        return {
            mode: "always",
            alarm_status: false,
            motion_detected: false
        };
    }
}

export function setMockSecurity(security) {
    localStorage.setItem(MOCK_SECURITY_KEY, JSON.stringify(security));
}

export function getMockAccessLogs() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_ACCESS_LOGS_KEY) || "null") || {};
    } catch {
        return {};
    }
}

export function setMockAccessLogs(logs) {
    localStorage.setItem(MOCK_ACCESS_LOGS_KEY, JSON.stringify(logs));
}

export function clearMockAccessLogs() {
    localStorage.removeItem(MOCK_ACCESS_LOGS_KEY);
}
