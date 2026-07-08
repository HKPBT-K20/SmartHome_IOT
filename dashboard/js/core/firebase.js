import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDo0ncLdnDplJoessMju0EKoGQGsvDealI",
    authDomain: "smart-home-iot-d1c77.firebaseapp.com",
    databaseURL: "https://smart-home-iot-d1c77-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-home-iot-d1c77",
    storageBucket: "smart-home-iot-d1c77.firebasestorage.app",
    messagingSenderId: "780541959867",
    appId: "1:780541959867:web:6918bb038c57975b65939e"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const USE_MOCK_DEMO = Object.values(firebaseConfig).some(value => typeof value === "string" && value.includes("YOUR_"));

export { ref, onValue, set, update, remove };

export const MOCK_ACCOUNT = {
    email: "hkpbSmartHome@gmail.com",
    password: "admin123",
    displayName: "HKPB Demo"
};

export const MOCK_PASSWORD_ALIASES = [
    MOCK_ACCOUNT.password,
    "demo1610",
    "#barooinnit1610",
    "barooinnit1610",
    "1610"
];

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
