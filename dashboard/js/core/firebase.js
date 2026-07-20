import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { FIREBASE_CONFIG, MOCK_ACCOUNT as ENV_MOCK_ACCOUNT, MOCK_PASSWORD_ALIASES as ENV_MOCK_PASSWORD_ALIASES } from "../../env.js";

export const firebaseConfig = FIREBASE_CONFIG;

function hasPlaceholderConfig(config) {
    return Object.values(config || {}).some(value => typeof value === "string" && value.includes("YOUR_"));
}

let app = null;
let db = null;
let initError = null;

export let USE_MOCK_DEMO = hasPlaceholderConfig(firebaseConfig);

try {
    if (!USE_MOCK_DEMO) {
        app = initializeApp(firebaseConfig);
        db = getDatabase(app);
    }
} catch (error) {
    initError = error;
    USE_MOCK_DEMO = true;
    console.warn("Firebase init failed, falling back to mock mode.", error);
}

export { app, db };

export { ref, onValue, set, update, remove };

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

export function getFirebaseInitError() {
    return initError;
}
