import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDo0ncLdnDplJoessMju0EKoGQGsvDealI",
    authDomain: "smart-home-iot-d1c77.firebaseapp.com",
    databaseURL: "https://smart-home-iot-d1c77-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-home-iot-d1c77",
    storageBucket: "smart-home-iot-d1c77.firebasestorage.app",
    messagingSenderId: "780541959867",
    appId: "1:780541959867:web:6918bb038c57975b65939e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const USE_MOCK_DEMO = Object.values(firebaseConfig).some(value => typeof value === 'string' && value.includes('YOUR_'));
const MOCK_ACCOUNT = {
    email: 'quocbao.nguyen16102006@gmail.com',
    password: 'demo1610',
    displayName: 'Quoc Bao Demo'
};
const MOCK_PASSWORD_ALIASES = ['demo1610', '#barooinnit1610', 'barooinnit1610', '1610'];
const MOCK_SESSION_KEY = 'smarthomeMockSession';
const MOCK_SCHEDULES_KEY = 'smarthomeMockSchedules';
const MOCK_SECURITY_KEY = 'smarthomeMockSecurity';

function getMockSession() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_SESSION_KEY) || 'null');
    } catch (error) {
        return null;
    }
}

function setMockSession(user) {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({
        email: user.email,
        displayName: user.displayName
    }));
}

function clearMockSession() {
    localStorage.removeItem(MOCK_SESSION_KEY);
}

function getMockSchedules() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_SCHEDULES_KEY) || '{}') || {};
    } catch (error) {
        return {};
    }
}

function setMockSchedules(schedules) {
    localStorage.setItem(MOCK_SCHEDULES_KEY, JSON.stringify(schedules));
}

function getMockSecurity() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_SECURITY_KEY) || 'null') || {
            mode: 'always',
            alarm_status: false,
            motion_detected: false
        };
    } catch (error) {
        return {
            mode: 'always',
            alarm_status: false,
            motion_detected: false
        };
    }
}

function setMockSecurity(security) {
    localStorage.setItem(MOCK_SECURITY_KEY, JSON.stringify(security));
}

// ==========================================
// UI HELPERS
// ==========================================
const toastContainer = document.getElementById('toast-container');
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');
const authScreen = document.getElementById('auth-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginStatus = document.getElementById('login-status');
const authUserLabel = document.getElementById('auth-user-label');
const logoutButton = document.getElementById('logout-button');

function ensureToastContainer() {
    if (toastContainer) {
        return toastContainer;
    }

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50 flex w-[92vw] max-w-sm flex-col gap-3 pointer-events-none';
    document.body.appendChild(container);
    return container;
}

function showToast(title, message = '', type = 'info') {
    const container = ensureToastContainer();
    const palette = {
        success: {
            border: 'border-emerald-500/30',
            background: 'bg-emerald-500/15',
            icon: 'fa-circle-check text-emerald-400'
        },
        warning: {
            border: 'border-amber-500/30',
            background: 'bg-amber-500/15',
            icon: 'fa-triangle-exclamation text-amber-400'
        },
        error: {
            border: 'border-rose-500/30',
            background: 'bg-rose-500/15',
            icon: 'fa-circle-xmark text-rose-400'
        },
        info: {
            border: 'border-sky-500/30',
            background: 'bg-sky-500/15',
            icon: 'fa-circle-info text-sky-400'
        }
    };

    const theme = palette[type] || palette.info;
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto rounded-3xl border ${theme.border} ${theme.background} backdrop-blur-xl shadow-2xl shadow-slate-950/40 px-4 py-3 text-slate-100 transform transition duration-300 ease-out translate-y-2 opacity-0`;
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="mt-0.5 text-lg"><i class="fa-solid ${theme.icon}"></i></div>
            <div class="min-w-0 flex-1">
                <p class="font-semibold leading-5">${title}</p>
                ${message ? `<p class="text-sm text-slate-300 mt-1 leading-5">${message}</p>` : ''}
            </div>
            <button type="button" class="text-slate-400 hover:text-white transition" aria-label="Đóng thông báo">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    const closeBtn = toast.querySelector('button');
    const removeToast = () => {
        toast.classList.add('opacity-0', 'translate-y-2');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        setTimeout(() => {
            if (toast.isConnected) {
                toast.remove();
            }
        }, 300);
    };

    closeBtn.addEventListener('click', removeToast);
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });
    setTimeout(removeToast, 3800);
}

function setAppLocked(locked) {
    if (appShell) {
        appShell.classList.toggle('hidden', locked);
    }
    if (authScreen) {
        authScreen.classList.toggle('hidden', !locked);
    }
}

function setLoginStatus(message, type = 'info') {
    if (!loginStatus) {
        return;
    }

    const colors = {
        info: 'text-slate-400',
        success: 'text-emerald-400',
        warning: 'text-amber-400',
        error: 'text-rose-400'
    };

    loginStatus.innerText = message;
    loginStatus.className = `text-sm ${colors[type] || colors.info}`;
}

function confirmAction({ title, message, confirmText = 'Xác nhận', danger = true }) {
    return new Promise(resolve => {
        if (!confirmModal) {
            resolve(window.confirm(message));
            return;
        }

        confirmModalTitle.innerText = title;
        confirmModalMessage.innerText = message;
        confirmModalOk.innerText = confirmText;
        confirmModalOk.className = danger
            ? 'px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition'
            : 'px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition';

        const cleanup = () => {
            confirmModal.classList.add('hidden');
            confirmModalOk.onclick = null;
            confirmModalCancel.onclick = null;
        };

        confirmModal.classList.remove('hidden');
        confirmModalOk.onclick = () => {
            cleanup();
            resolve(true);
        };
        confirmModalCancel.onclick = () => {
            cleanup();
            resolve(false);
        };
    });
}

function isValidTime(value) {
    return /^\d{2}:\d{2}$/.test(value);
}

function toMinutes(value) {
    if (!isValidTime(value)) {
        return null;
    }

    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function formatDuration(minutes) {
    if (minutes === null || Number.isNaN(minutes)) {
        return '--';
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!hours) {
        return `${mins} phút`;
    }
    if (!mins) {
        return `${hours} giờ`;
    }
    return `${hours} giờ ${mins} phút`;
}

function buildScheduleState(schedule) {
    const onTime = schedule?.on_time || '';
    const offTime = schedule?.off_time || '';
    const enabled = Boolean(schedule?.enabled);
    const hasConfig = isValidTime(onTime) && isValidTime(offTime);
    const onMinutes = hasConfig ? toMinutes(onTime) : null;
    const offMinutes = hasConfig ? toMinutes(offTime) : null;
    const overnight = hasConfig ? offMinutes <= onMinutes : false;
    const durationMinutes = hasConfig
        ? (offMinutes - onMinutes + 24 * 60) % (24 * 60)
        : null;

    let summary = 'Chưa có cấu hình hẹn giờ.';
    let statusText = 'Thiết bị đang vận hành thủ công.';
    let tone = 'neutral';

    if (hasConfig) {
        summary = overnight
            ? `Chạy qua đêm từ ${onTime} đến ${offTime}`
            : `Chạy hằng ngày từ ${onTime} đến ${offTime}`;
        statusText = enabled
            ? `Đang bật · Chu kỳ ${formatDuration(durationMinutes)}`
            : `Đã lưu · Chu kỳ ${formatDuration(durationMinutes)}`;
        tone = enabled ? 'active' : 'inactive';
    }

    return {
        hasConfig,
        enabled,
        onTime,
        offTime,
        overnight,
        durationMinutes,
        summary,
        statusText,
        tone
    };
}

function setScheduleUi(ch, schedule) {
    const timeOnInput = document.getElementById(`time-on-${ch}`);
    const timeOffInput = document.getElementById(`time-off-${ch}`);
    const toggleBtn = document.getElementById(`btn-toggle-sch-${ch}`);
    const saveBtn = document.getElementById(`btn-save-sch-${ch}`);
    const statusLabel = document.getElementById(`lbl-schedule-status-${ch}`);
    const summaryLabel = document.getElementById(`schedule-summary-${ch}`);

    if (!timeOnInput || !timeOffInput || !toggleBtn || !saveBtn || !statusLabel || !summaryLabel) {
        return;
    }

    const state = buildScheduleState(schedule);
    timeOnInput.value = state.onTime;
    timeOffInput.value = state.offTime;

    if (!schedule) {
        statusLabel.innerText = 'Chưa có lịch hẹn giờ';
        statusLabel.className = 'text-xs text-slate-400 block';
        summaryLabel.innerText = 'Nhập giờ bật/tắt rồi bấm Lưu để tạo lịch demo.';
        summaryLabel.className = 'text-xs text-slate-500 mt-2';
        toggleBtn.innerText = 'Bật';
        toggleBtn.dataset.enabled = 'false';
        toggleBtn.disabled = true;
        toggleBtn.className = 'px-3 py-1.5 bg-slate-800 text-slate-300 rounded-2xl transition text-sm cursor-not-allowed opacity-60';
        saveBtn.disabled = false;
        return;
    }

    if (state.hasConfig) {
        statusLabel.innerText = `Tự động: ${state.enabled ? 'Bật' : 'Tắt'} · ${state.statusText}`;
        statusLabel.className = state.enabled
            ? 'text-xs text-sky-300 font-medium block'
            : 'text-xs text-slate-500 block';
        summaryLabel.innerText = state.overnight
            ? `Khung giờ qua đêm: ${state.onTime} → ${state.offTime}.`
            : `Khung giờ hằng ngày: ${state.onTime} → ${state.offTime}.`;
        if (state.enabled) {
            summaryLabel.innerText += ` Chu kỳ chạy: ${formatDuration(state.durationMinutes)}.`;
        } else {
            summaryLabel.innerText += ' Bấm Bật để đưa vào demo.';
        }
    } else {
        statusLabel.innerText = 'Lịch đã lưu nhưng chưa hợp lệ';
        statusLabel.className = 'text-xs text-amber-300 block';
        summaryLabel.innerText = 'Cần nhập đủ 2 mốc giờ hợp lệ.';
    }

    toggleBtn.innerText = state.enabled ? 'Tắt hẹn giờ' : 'Bật hẹn giờ';
    toggleBtn.dataset.enabled = state.enabled ? 'true' : 'false';
    toggleBtn.disabled = !state.hasConfig;
    toggleBtn.className = state.enabled
        ? 'px-3 py-1.5 bg-sky-600/25 text-sky-300 border border-sky-500/30 rounded-2xl transition text-sm'
        : state.hasConfig
            ? 'px-3 py-1.5 bg-slate-800 text-slate-300 rounded-2xl transition text-sm hover:bg-slate-700'
            : 'px-3 py-1.5 bg-slate-800 text-slate-500 rounded-2xl transition text-sm cursor-not-allowed opacity-60';
    saveBtn.disabled = false;
}

function getCurrentPageTitle(pageId) {
    const pageTitles = {
        'page-dashboard': 'Tổng quan hệ thống',
        'page-schedule': 'Cấu hình hẹn giờ tự động',
        'page-security': 'Hệ thống quản lý an ninh',
        'page-logs': 'Nhật ký truy cập chi tiết'
    };
    return pageTitles[pageId] || 'SmartHome Dashboard';
}

// ==========================================
// SPA NAVIGATION
// ==========================================
const navButtons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page-content');
const pageTitle = document.getElementById('current-page-title');
const modeToggle = document.getElementById('mode-toggle');
const modeToggleIcon = document.getElementById('mode-toggle-icon');
const modeToggleLabel = document.getElementById('mode-toggle-label');
const sidebarToggle = document.getElementById('sidebar-toggle');

function applySidebarState(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    if (sidebarToggle) {
        sidebarToggle.innerHTML = collapsed
            ? '<i class="fa-solid fa-arrows-right-left"></i><span class="text-sm">Hiện menu</span>'
            : '<i class="fa-solid fa-arrows-left-right"></i><span class="text-sm">Thu menu</span>';
    }
    localStorage.setItem('sidebarCollapsed', collapsed);
}

function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);

    if (isLight) {
        modeToggleIcon.className = 'fa-solid fa-moon';
        modeToggleLabel.innerText = 'Dark mode';
        modeToggle.className = 'flex items-center gap-2 px-4 py-2 bg-slate-200/90 hover:bg-slate-300 text-slate-900 rounded-full transition';
    } else {
        modeToggleIcon.className = 'fa-solid fa-sun';
        modeToggleLabel.innerText = 'Light mode';
        modeToggle.className = 'flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-full transition';
    }

    localStorage.setItem('dashboardTheme', theme);
}

const savedTheme = localStorage.getItem('dashboardTheme') || 'dark';
const savedSidebarState = localStorage.getItem('sidebarCollapsed') === 'true';
applyTheme(savedTheme);
applySidebarState(savedSidebarState);

modeToggle.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
});

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        const collapsed = !document.body.classList.contains('sidebar-collapsed');
        applySidebarState(collapsed);
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async event => {
        event.preventDefault();

        const email = loginEmail?.value.trim();
        const password = loginPassword?.value;

        if (!email || !password) {
            setLoginStatus('Nhập đủ email và mật khẩu.', 'warning');
            return;
        }

        loginButton.disabled = true;
        setLoginStatus('Đang kiểm tra tài khoản demo...', 'info');

        try {
            const isValidUser = email.toLowerCase() === MOCK_ACCOUNT.email.toLowerCase() && MOCK_PASSWORD_ALIASES.includes(password);
            if (!isValidUser) {
                throw new Error('auth/invalid-credential');
            }

            setMockSession({
                email: MOCK_ACCOUNT.email,
                displayName: MOCK_ACCOUNT.displayName
            });
            setAppLocked(false);
            if (authUserLabel) {
                authUserLabel.innerText = MOCK_ACCOUNT.displayName;
            }
            setLoginStatus('Đăng nhập thành công.', 'success');
            showToast('Đăng nhập thành công', `Xin chào ${MOCK_ACCOUNT.displayName}.`, 'success');
        } catch (error) {
            console.error('Đăng nhập thất bại:', error);
            const message = 'Sai email hoặc mật khẩu demo.';
            setLoginStatus(message, 'error');
            showToast('Đăng nhập thất bại', message, 'error');
        } finally {
            loginButton.disabled = false;
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        clearMockSession();
        loginButton.disabled = false;
        if (loginPassword) {
            loginPassword.value = '';
        }
        setAppLocked(true);
        setLoginStatus('Đăng xuất thành công. Dùng tài khoản demo để vào lại.', 'info');
        if (authUserLabel) {
            authUserLabel.innerText = 'Chưa đăng nhập';
        }
        showToast('Đã đăng xuất', 'Phiên demo đã kết thúc.', 'info');
    });
}

const existingMockSession = getMockSession();
if (existingMockSession?.email === MOCK_ACCOUNT.email) {
    setAppLocked(false);
    if (authUserLabel) {
        authUserLabel.innerText = existingMockSession.displayName || existingMockSession.email;
    }
    if (loginEmail) {
        loginEmail.value = existingMockSession.email;
    }
    setLoginStatus('Đang mở dashboard demo...', 'success');
} else {
    setAppLocked(true);
    if (authUserLabel) {
        authUserLabel.innerText = 'Chưa đăng nhập';
    }
    setLoginStatus(`Tài khoản demo: ${MOCK_ACCOUNT.email}`, 'info');
    if (loginEmail && !loginEmail.value) {
        loginEmail.value = MOCK_ACCOUNT.email;
    }
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetPageId = btn.dataset.target;

        navButtons.forEach(b => {
            b.className = 'nav-btn w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-2xl transition';
        });
        btn.className = 'nav-btn w-full flex items-center gap-3 px-4 py-3 bg-sky-600 text-white rounded-2xl transition shadow-sm shadow-sky-500/25';

        pages.forEach(p => p.classList.add('hidden'));
        document.getElementById(targetPageId).classList.remove('hidden');
        pageTitle.innerText = getCurrentPageTitle(targetPageId);
    });
});

// ==========================================
// REALTIME SENSORS
// ==========================================
onValue(ref(db, 'sensors'), snapshot => {
    const data = snapshot.val();
    if (!data) {
        return;
    }

    if (data.temp !== undefined) document.getElementById('txt-temp').innerText = `${data.temp} °C`;
    if (data.light !== undefined) document.getElementById('txt-light').innerText = `${data.light} Lux`;
    if (data.humidity !== undefined) document.getElementById('txt-humidity').innerText = `${data.humidity} %`;
    if (data.air_quality !== undefined) document.getElementById('txt-air').innerText = `${data.air_quality} PPM`;
});

// ==========================================
// RELAY CONTROL
// ==========================================
const relayChannels = ['ch1', 'ch2', 'ch3', 'ch4'];

relayChannels.forEach(ch => {
    const btn = document.getElementById(`btn-${ch}`);
    const statusText = document.getElementById(`status-${ch}`);

    if (!btn || !statusText) {
        return;
    }

    onValue(ref(db, `relay/${ch}`), snapshot => {
        const isActive = snapshot.val();
        if (isActive === true) {
            btn.innerText = 'ON';
            btn.className = 'px-4 py-2 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20';
            statusText.innerText = 'Đang bật';
            statusText.className = 'text-xs text-emerald-400 font-medium';
            btn.dataset.state = 'true';
        } else {
            btn.innerText = 'OFF';
            btn.className = 'px-4 py-2 bg-slate-800 text-white rounded-2xl font-semibold hover:bg-slate-700 transition shadow-sm shadow-slate-900/25';
            statusText.innerText = 'Đang tắt';
            statusText.className = 'text-xs text-slate-400';
            btn.dataset.state = 'false';
        }
    });

    btn.addEventListener('click', () => {
        const isCurrentActive = btn.dataset.state === 'true';
        set(ref(db, `relay/${ch}`), !isCurrentActive);
        showToast('Đã gửi lệnh điều khiển', `Thiết bị ${ch.toUpperCase()} đang được cập nhật trạng thái.`, 'info');
    });
});

// ==========================================
// SCHEDULE CONFIGURATION
// ==========================================
relayChannels.forEach(ch => {
    const timeOnInput = document.getElementById(`time-on-${ch}`);
    const timeOffInput = document.getElementById(`time-off-${ch}`);
    const saveBtn = document.getElementById(`btn-save-sch-${ch}`);
    const toggleBtn = document.getElementById(`btn-toggle-sch-${ch}`);

    if (!timeOnInput || !timeOffInput || !saveBtn || !toggleBtn) {
        return;
    }

    if (USE_MOCK_DEMO) {
        const mockSchedules = getMockSchedules();
        setScheduleUi(ch, mockSchedules[ch] || null);
    } else {
        onValue(ref(db, `schedules/${ch}`), snapshot => {
            setScheduleUi(ch, snapshot.val());
        });
    }

    saveBtn.addEventListener('click', async () => {
        const onTime = timeOnInput.value.trim();
        const offTime = timeOffInput.value.trim();

        if (!isValidTime(onTime) || !isValidTime(offTime)) {
            showToast('Thiếu giờ hẹn', 'Hãy nhập đủ giờ bật và giờ tắt theo định dạng HH:MM.', 'warning');
            return;
        }

        if (onTime === offTime) {
            showToast('Lịch không hợp lệ', 'Giờ bật và giờ tắt không được trùng nhau.', 'error');
            return;
        }

        const onMinutes = toMinutes(onTime);
        const offMinutes = toMinutes(offTime);
        const overnight = offMinutes <= onMinutes;
        const durationMinutes = (offMinutes - onMinutes + 24 * 60) % (24 * 60);
        const payload = {
            on_time: onTime,
            off_time: offTime,
            enabled: true,
            mode: overnight ? 'overnight' : 'daily',
            duration_minutes: durationMinutes,
            updated_at: new Date().toISOString()
        };

        try {
            if (USE_MOCK_DEMO) {
                const schedules = getMockSchedules();
                schedules[ch] = payload;
                setMockSchedules(schedules);
                setScheduleUi(ch, payload);
            } else {
                await update(ref(db, `schedules/${ch}`), payload);
            }

            showToast(
                'Đã lưu lịch hẹn giờ',
                `${ch.toUpperCase()} chạy ${overnight ? 'qua đêm' : 'mỗi ngày'}: ${onTime} → ${offTime}.`,
                'success'
            );
        } catch (error) {
            console.error(`Không thể lưu lịch trình cho ${ch}:`, error);
            showToast('Không lưu được lịch trình', 'Kiểm tra Firebase config hoặc quyền ghi.', 'error');
        }
    });

    toggleBtn.addEventListener('click', async () => {
        const isCurrentlyEnabled = toggleBtn.dataset.enabled === 'true';
        const nextEnabled = !isCurrentlyEnabled;
        const onTime = timeOnInput.value.trim();
        const offTime = timeOffInput.value.trim();

        if (nextEnabled && (!isValidTime(onTime) || !isValidTime(offTime) || onTime === offTime)) {
            showToast('Không thể bật hẹn giờ', 'Cần lưu một khung giờ hợp lệ trước khi bật.', 'warning');
            return;
        }

        toggleBtn.disabled = true;

        try {
            if (USE_MOCK_DEMO) {
                const schedules = getMockSchedules();
                const currentSchedule = schedules[ch] || {
                    on_time: timeOnInput.value.trim(),
                    off_time: timeOffInput.value.trim(),
                    mode: 'daily',
                    duration_minutes: null
                };
                schedules[ch] = {
                    ...currentSchedule,
                    enabled: nextEnabled,
                    updated_at: new Date().toISOString()
                };
                setMockSchedules(schedules);
                setScheduleUi(ch, schedules[ch]);
            } else {
                await update(ref(db, `schedules/${ch}`), {
                    enabled: nextEnabled
                });
            }
            showToast(
                nextEnabled ? 'Đã bật hẹn giờ' : 'Đã tắt hẹn giờ',
                `Thiết bị ${ch.toUpperCase()} đã được ${nextEnabled ? 'kích hoạt' : 'dừng'} chế độ tự động.`,
                nextEnabled ? 'success' : 'info'
            );
        } catch (error) {
            console.error(`Không thể đổi trạng thái hẹn giờ cho ${ch}:`, error);
            showToast('Không đổi được trạng thái hẹn giờ', 'Kiểm tra Firebase config hoặc quyền ghi.', 'error');
        } finally {
            toggleBtn.disabled = false;
        }
    });
});

// ==========================================
// SECURITY
// ==========================================
const divMotionBg = document.getElementById('div-motion-bg');
const iconMotion = document.getElementById('icon-motion');
const lblMotionStatus = document.getElementById('lbl-motion-status');
const lblAlarmStatus = document.getElementById('lbl-alarm-status');
const btnClearAlarm = document.getElementById('btn-clear-alarm');
const btnToggleAlarm = document.getElementById('btn-toggle-alarm');
const btnSaveSecurityMode = document.getElementById('btn-save-security-mode');

if (btnToggleAlarm) {
    btnToggleAlarm.dataset.active = 'false';
}

onValue(ref(db, 'security'), snapshot => {
    const security = snapshot.val() || {};

    if (security.motion_detected) {
        if (divMotionBg) divMotionBg.className = 'p-4 rounded-3xl bg-rose-500/15 flex items-center gap-4 border border-rose-500/30 animate-pulse';
        if (iconMotion) iconMotion.className = 'text-2xl text-rose-400';
        if (lblMotionStatus) {
            lblMotionStatus.innerText = 'CẢNH BÁO: Phát hiện chuyển động';
            lblMotionStatus.className = 'font-bold text-rose-300';
        }
    } else {
        if (divMotionBg) divMotionBg.className = 'p-4 rounded-3xl bg-slate-900/70 flex items-center gap-4 border border-slate-700/60';
        if (iconMotion) iconMotion.className = 'text-2xl text-slate-400';
        if (lblMotionStatus) {
            lblMotionStatus.innerText = 'Không phát hiện đột nhập';
            lblMotionStatus.className = 'text-sm text-slate-400';
        }
    }

    if (security.alarm_status) {
        if (btnToggleAlarm) {
            btnToggleAlarm.innerText = 'CÒI ĐANG HÚ (BẤM ĐỂ TẮT)';
            btnToggleAlarm.className = 'w-full py-3 bg-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-600/25 animate-bounce';
            btnToggleAlarm.dataset.active = 'true';
        }
        if (lblAlarmStatus) {
            lblAlarmStatus.innerText = 'Hệ thống còi hú: ĐANG BẬT';
            lblAlarmStatus.className = 'text-xs text-rose-300 font-semibold mt-1';
        }
        if (btnClearAlarm) btnClearAlarm.classList.remove('hidden');
    } else {
        if (btnToggleAlarm) {
            btnToggleAlarm.innerText = 'HỆ THỐNG AN TOÀN';
            btnToggleAlarm.className = 'w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl cursor-pointer hover:bg-slate-700 transition';
            btnToggleAlarm.dataset.active = 'false';
        }
        if (lblAlarmStatus) {
            lblAlarmStatus.innerText = 'Hệ thống còi hú: Bình thường';
            lblAlarmStatus.className = 'text-xs text-slate-500 mt-1';
        }
        if (btnClearAlarm) btnClearAlarm.classList.add('hidden');
    }

    if (security.mode) {
        const checkedRadio = document.querySelector(`input[name="security-mode"][value="${security.mode}"]`);
        if (checkedRadio) checkedRadio.checked = true;
    }
});

if (btnSaveSecurityMode) {
    btnSaveSecurityMode.addEventListener('click', async () => {
        const selectedRadio = document.querySelector('input[name="security-mode"]:checked');
        if (!selectedRadio) {
            showToast('Chưa chọn chế độ', 'Hãy chọn một chế độ bảo vệ trước khi cập nhật.', 'warning');
            return;
        }

        try {
            await set(ref(db, 'security/mode'), selectedRadio.value);
            showToast('Đã cập nhật chế độ an ninh', 'Cấu hình bảo vệ đã được lưu thành công.', 'success');
        } catch (error) {
            console.error('Không thể lưu chế độ an ninh:', error);
            showToast('Không lưu được chế độ an ninh', 'Kiểm tra Firebase config hoặc quyền ghi.', 'error');
        }
    });
}

const deactivateAlarm = async () => {
    try {
        await set(ref(db, 'security/alarm_status'), false);
        await set(ref(db, 'security/motion_detected'), false);
        showToast('Đã tắt còi báo động', 'Tín hiệu khẩn cấp đã được reset.', 'success');
    } catch (error) {
        console.error('Không thể tắt còi báo động:', error);
        showToast('Không tắt được còi báo động', 'Kiểm tra lại kết nối Firebase.', 'error');
    }
};

if (btnClearAlarm) {
    btnClearAlarm.addEventListener('click', deactivateAlarm);
}

if (btnToggleAlarm) {
    btnToggleAlarm.addEventListener('click', async () => {
        const isAlarmHuming = btnToggleAlarm.dataset.active === 'true';
        try {
            await set(ref(db, 'security/alarm_status'), !isAlarmHuming);
            showToast(
                !isAlarmHuming ? 'Đã kích hoạt còi thử' : 'Đã tắt còi thử',
                !isAlarmHuming ? 'Dùng để demo âm báo động.' : 'Còi báo động đã trở về trạng thái bình thường.',
                !isAlarmHuming ? 'warning' : 'info'
            );
        } catch (error) {
            console.error('Không thể đổi trạng thái còi báo động:', error);
            showToast('Không đổi được trạng thái còi', 'Kiểm tra Firebase config hoặc quyền ghi.', 'error');
        }
    });
}

if (USE_MOCK_DEMO) {
    const replaceButton = (buttonId) => {
        const original = document.getElementById(buttonId);
        if (!original) {
            return null;
        }

        const clone = original.cloneNode(true);
        original.parentNode.replaceChild(clone, original);
        return clone;
    };

    const mockBtnSaveSecurityMode = replaceButton('btn-save-security-mode');
    const mockBtnClearAlarm = replaceButton('btn-clear-alarm');
    const mockBtnToggleAlarm = replaceButton('btn-toggle-alarm');

    const applyMockSecurity = () => {
        const securityBadge = document.getElementById('security-demo-badge');
        if (securityBadge) {
            securityBadge.classList.remove('hidden');
        }
        const state = getMockSecurity();
        const motionBox = document.getElementById('div-motion-bg');
        const motionIcon = document.getElementById('icon-motion');
        const motionLabel = document.getElementById('lbl-motion-status');
        const alarmLabel = document.getElementById('lbl-alarm-status');
        const alarmButton = document.getElementById('btn-toggle-alarm');
        const clearAlarmButton = document.getElementById('btn-clear-alarm');
        const checkedRadio = document.querySelector(`input[name="security-mode"][value="${state.mode || 'always'}"]`);

        const motionDetected = Boolean(state.motion_detected);
        const alarmActive = Boolean(state.alarm_status);

        if (motionBox) {
            motionBox.className = motionDetected
                ? 'p-4 rounded-3xl bg-rose-500/15 flex items-center gap-4 border border-rose-500/30 animate-pulse'
                : 'p-4 rounded-3xl bg-slate-900/70 flex items-center gap-4 border border-slate-700/60';
        }
        if (motionIcon) {
            motionIcon.className = motionDetected ? 'text-2xl text-rose-400' : 'text-2xl text-slate-400';
        }
        if (motionLabel) {
            motionLabel.innerText = motionDetected ? 'CẢNH BÁO: Phát hiện chuyển động' : 'Không phát hiện đột nhập';
            motionLabel.className = motionDetected ? 'font-bold text-rose-300' : 'text-sm text-slate-400';
        }
        if (alarmButton) {
            alarmButton.innerText = alarmActive ? 'CÒI ĐANG HÚ (BẤM ĐỂ TẮT)' : 'HỆ THỐNG AN TOÀN';
            alarmButton.className = alarmActive
                ? 'w-full py-3 bg-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-600/25 animate-bounce'
                : 'w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl cursor-pointer hover:bg-slate-700 transition';
            alarmButton.dataset.active = alarmActive ? 'true' : 'false';
        }
        if (alarmLabel) {
            alarmLabel.innerText = alarmActive ? 'Hệ thống còi hú: ĐANG BẬT' : 'Hệ thống còi hú: Bình thường';
            alarmLabel.className = alarmActive ? 'text-xs text-rose-300 font-semibold mt-1' : 'text-xs text-slate-500 mt-1';
        }
        if (clearAlarmButton) {
            clearAlarmButton.classList.toggle('hidden', !alarmActive);
        }
        if (checkedRadio) {
            checkedRadio.checked = true;
        }
    };

    if (mockBtnSaveSecurityMode) {
        mockBtnSaveSecurityMode.addEventListener('click', () => {
            const selectedRadio = document.querySelector('input[name="security-mode"]:checked');
            if (!selectedRadio) {
                showToast('Chưa chọn chế độ', 'Hãy chọn một chế độ bảo vệ trước khi cập nhật.', 'warning');
                return;
            }

            const nextSecurity = {
                ...getMockSecurity(),
                mode: selectedRadio.value
            };
            setMockSecurity(nextSecurity);
            applyMockSecurity();
            showToast('Đã cập nhật chế độ an ninh', 'Chế độ bảo vệ demo đã được lưu.', 'success');
        });
    }

    if (mockBtnClearAlarm) {
        mockBtnClearAlarm.addEventListener('click', () => {
            const nextSecurity = {
                ...getMockSecurity(),
                alarm_status: false,
                motion_detected: false
            };
            setMockSecurity(nextSecurity);
            applyMockSecurity();
            showToast('Đã tắt còi báo động', 'Tín hiệu khẩn cấp demo đã được reset.', 'success');
        });
    }

    if (mockBtnToggleAlarm) {
        mockBtnToggleAlarm.addEventListener('click', () => {
            const current = getMockSecurity();
            const nextSecurity = {
                ...current,
                alarm_status: !Boolean(current.alarm_status)
            };
            setMockSecurity(nextSecurity);
            applyMockSecurity();
            showToast(
                nextSecurity.alarm_status ? 'Đã kích hoạt còi thử' : 'Đã tắt còi thử',
                nextSecurity.alarm_status ? 'Dùng để demo âm báo động.' : 'Còi báo động đã trở về trạng thái bình thường.',
                nextSecurity.alarm_status ? 'warning' : 'info'
            );
        });
    }

    applyMockSecurity();
}

function renderSecurityUi(security) {
    const state = security || {};
    const motionDetected = Boolean(state.motion_detected);
    const alarmActive = Boolean(state.alarm_status);
    const mode = state.mode || 'always';

    if (divMotionBg) {
        divMotionBg.className = motionDetected
            ? 'p-4 rounded-3xl bg-rose-500/15 flex items-center gap-4 border border-rose-500/30 animate-pulse'
            : 'p-4 rounded-3xl bg-slate-900/70 flex items-center gap-4 border border-slate-700/60';
    }
    if (iconMotion) {
        iconMotion.className = motionDetected ? 'text-2xl text-rose-400' : 'text-2xl text-slate-400';
    }
    if (lblMotionStatus) {
        lblMotionStatus.innerText = motionDetected ? 'CẢNH BÁO: Phát hiện chuyển động' : 'Không phát hiện đột nhập';
        lblMotionStatus.className = motionDetected ? 'font-bold text-rose-300' : 'text-sm text-slate-400';
    }

    if (btnToggleAlarm) {
        btnToggleAlarm.innerText = alarmActive ? 'CÒI ĐANG HÚ (BẤM ĐỂ TẮT)' : 'HỆ THỐNG AN TOÀN';
        btnToggleAlarm.className = alarmActive
            ? 'w-full py-3 bg-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-600/25 animate-bounce'
            : 'w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl cursor-pointer hover:bg-slate-700 transition';
        btnToggleAlarm.dataset.active = alarmActive ? 'true' : 'false';
    }
    if (lblAlarmStatus) {
        lblAlarmStatus.innerText = alarmActive ? 'Hệ thống còi hú: ĐANG BẬT' : 'Hệ thống còi hú: Bình thường';
        lblAlarmStatus.className = alarmActive ? 'text-xs text-rose-300 font-semibold mt-1' : 'text-xs text-slate-500 mt-1';
    }
    if (btnClearAlarm) {
        btnClearAlarm.classList.toggle('hidden', !alarmActive);
    }

    const checkedRadio = document.querySelector(`input[name="security-mode"][value="${mode}"]`);
    if (checkedRadio) {
        checkedRadio.checked = true;
    }
}

// ==========================================
// ACCESS LOGS
// ==========================================
const tableDashboard = document.getElementById('table-access-log');
const tableFullLogs = document.getElementById('table-full-logs');

function renderLogRows(logs) {
    if (!logs) {
        const emptyRow = '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">Chưa có dữ liệu lịch sử ra vào.</td></tr>';
        if (tableDashboard) tableDashboard.innerHTML = emptyRow;
        if (tableFullLogs) tableFullLogs.innerHTML = emptyRow;
        return;
    }

    const logEntries = Object.values(logs).reverse();
    if (tableDashboard) tableDashboard.innerHTML = '';
    if (tableFullLogs) tableFullLogs.innerHTML = '';

    logEntries.forEach((log, index) => {
        const statusStyle = log.status === 'Success'
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-red-400 bg-red-500/10';
        const iconType = log.method === 'RFID'
            ? 'fa-id-card text-purple-400'
            : 'fa-fingerprint text-blue-400';

        const rowHtml = `
            <tr class="hover:bg-slate-900/80 border-b border-slate-700/60">
                <td class="px-6 py-4 text-slate-300 font-mono text-xs">${log.timestamp ?? '--'}</td>
                <td class="px-6 py-4 font-medium"><i class="fa-solid ${iconType} mr-2"></i>${log.method ?? '--'}</td>
                <td class="px-6 py-4 text-slate-300">${log.user ?? '--'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${statusStyle}">${log.status ?? '--'}</span>
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

onValue(ref(db, 'access_log'), snapshot => {
    renderLogRows(snapshot.val());
});

const btnClearLogs = document.getElementById('btn-clear-logs');
if (btnClearLogs) {
    btnClearLogs.addEventListener('click', async () => {
        const confirmed = await confirmAction({
            title: 'Xóa lịch sử truy cập?',
            message: 'Hành động này sẽ xóa toàn bộ nhật ký ra/vào đang hiển thị trên dashboard.',
            confirmText: 'Xóa ngay',
            danger: true
        });

        if (!confirmed) {
            return;
        }

        try {
            await remove(ref(db, 'access_log'));
            showToast('Đã xóa lịch sử truy cập', 'Toàn bộ log đã được dọn sạch.', 'success');
        } catch (error) {
            console.error('Không thể xóa nhật ký truy cập:', error);
            showToast('Không xóa được nhật ký', 'Kiểm tra Firebase config hoặc quyền ghi.', 'error');
        }
    });
}

// ==========================================
// WEATHER
// ==========================================
async function fetchWeather() {
    const weatherInfo = document.getElementById('weather-info');
    if (!weatherInfo) {
        return;
    }

    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=10.75&longitude=106.67&current_weather=true');
        const data = await response.json();
        if (data?.current_weather) {
            weatherInfo.innerText = `TP.HCM: ${data.current_weather.temperature}°C`;
        }
    } catch (error) {
        weatherInfo.innerText = 'TP.HCM: 31°C';
    }
}

fetchWeather();
setInterval(fetchWeather, 600000);
