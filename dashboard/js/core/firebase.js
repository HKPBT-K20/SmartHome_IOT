import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
    databaseURL: "YOUR_FIREBASE_DATABASE_URL",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID"
};

function firstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }
    return undefined;
}

function normalizePasswordAliases(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    return ["123456", "admin123"];
}

const runtimeEnv = globalThis.__SMARTHOME_ENV__ || {};

export const firebaseConfig = {
    ...DEFAULT_FIREBASE_CONFIG,
    ...(runtimeEnv.FIREBASE_CONFIG || runtimeEnv.firebaseConfig || {}),
    apiKey: firstDefined(runtimeEnv.FIREBASE_API_KEY, runtimeEnv.FIREBASE_CONFIG?.apiKey, DEFAULT_FIREBASE_CONFIG.apiKey),
    authDomain: firstDefined(runtimeEnv.FIREBASE_AUTH_DOMAIN, runtimeEnv.FIREBASE_CONFIG?.authDomain, DEFAULT_FIREBASE_CONFIG.authDomain),
    databaseURL: firstDefined(runtimeEnv.FIREBASE_DATABASE_URL, runtimeEnv.FIREBASE_CONFIG?.databaseURL, DEFAULT_FIREBASE_CONFIG.databaseURL),
    projectId: firstDefined(runtimeEnv.FIREBASE_PROJECT_ID, runtimeEnv.FIREBASE_CONFIG?.projectId, DEFAULT_FIREBASE_CONFIG.projectId),
    storageBucket: firstDefined(runtimeEnv.FIREBASE_STORAGE_BUCKET, runtimeEnv.FIREBASE_CONFIG?.storageBucket, DEFAULT_FIREBASE_CONFIG.storageBucket),
    messagingSenderId: firstDefined(runtimeEnv.FIREBASE_MESSAGING_SENDER_ID, runtimeEnv.FIREBASE_CONFIG?.messagingSenderId, DEFAULT_FIREBASE_CONFIG.messagingSenderId),
    appId: firstDefined(runtimeEnv.FIREBASE_APP_ID, runtimeEnv.FIREBASE_CONFIG?.appId, DEFAULT_FIREBASE_CONFIG.appId)
};

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

export const MOCK_ACCOUNT = runtimeEnv.MOCK_ACCOUNT || {
    email: firstDefined(runtimeEnv.MOCK_ACCOUNT_EMAIL, runtimeEnv.MOCK_EMAIL, "hkpbSmartHome@gmail.com"),
    displayName: firstDefined(runtimeEnv.MOCK_ACCOUNT_DISPLAY_NAME, runtimeEnv.MOCK_DISPLAY_NAME, "HKPB Demo")
};

export const MOCK_PASSWORD_ALIASES = normalizePasswordAliases(
    firstDefined(
        runtimeEnv.MOCK_PASSWORD_ALIASES,
        runtimeEnv.MOCK_ACCOUNT_PASSWORD,
        runtimeEnv.MOCK_PASSWORD
    )
);

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
