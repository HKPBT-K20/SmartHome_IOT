import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Cấu hình Firebase của dự án (Thay thông số của bạn vào đây)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// THAO TÁC CHUYỂN TRANG (SINGLE PAGE APPLICATION)
// ==========================================
const navButtons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page-content');
const pageTitle = document.getElementById('current-page-title');

const pageTitles = {
    'page-dashboard': 'Tổng quan hệ thống',
    'page-schedule': 'Cấu hình Hẹn giờ tự động',
    'page-security': 'Hệ thống Quản lý An ninh',
    'page-logs': 'Nhật ký truy cập chi tiết'
};

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

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetPageId = btn.dataset.target;
        
        // Chuyển đổi trạng thái hiển thị class active cho Button
        navButtons.forEach(b => b.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-2xl transition");
        btn.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 bg-sky-600 text-white rounded-2xl transition shadow-sm shadow-sky-500/25";

        // Ẩn/Hiện trang tương ứng
        pages.forEach(p => p.classList.add('hidden'));
        document.getElementById(targetPageId).classList.remove('hidden');
        
        // Đổi tiêu đề thanh Navbar
        pageTitle.innerText = pageTitles[targetPageId];
    });
});

// ==========================================
// 1. CHỨC NĂNG REALTIME SENSORS (DASHBOARD)
// ==========================================
onValue(ref(db, 'sensors'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if(data.temp) document.getElementById('txt-temp').innerText = `${data.temp} °C`;
        if(data.light) document.getElementById('txt-light').innerText = `${data.light} Lux`;
        if(data.humidity) document.getElementById('txt-humidity').innerText = `${data.humidity} %`;
        if(data.air_quality) document.getElementById('txt-air').innerText = `${data.air_quality} PPM`;
    }
});

// ==========================================
// 2. ĐIỀU KHIỂN & ĐỒNG BỘ 4 NÚT RELAY
// ==========================================
const relayChannels = ['ch1', 'ch2', 'ch3', 'ch4'];
relayChannels.forEach(ch => {
    const btn = document.getElementById(`btn-${ch}`);
    const statusText = document.getElementById(`status-${ch}`);
    
    // Lắng nghe lệnh từ cả ESP32 lẫn Web gửi lên
    onValue(ref(db, `relay/${ch}`), (snapshot) => {
        const isActive = snapshot.val();
        if (isActive === true) {
            btn.innerText = "ON";
            btn.className = "px-4 py-2 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20";
            statusText.innerText = "Đang bật";
            statusText.className = "text-xs text-emerald-400 font-medium";
            btn.dataset.state = "true";
        } else {
            btn.innerText = "OFF";
            btn.className = "px-4 py-2 bg-slate-800 text-white rounded-2xl font-semibold hover:bg-slate-700 transition shadow-sm shadow-slate-900/25";
            statusText.innerText = "Đang tắt";
            statusText.className = "text-xs text-slate-400";
            btn.dataset.state = "false";
        }
    });

    btn.addEventListener('click', () => {
        const isCurrentActive = btn.dataset.state === "true";
        set(ref(db, `relay/${ch}`), !isCurrentActive);
    });
});

// ==========================================
// 3. ĐỒNG BỘ TIẾN TRÌNH HẸN GIỜ (SCHEDULES)
// ==========================================
relayChannels.forEach(ch => {
    const timeOnInput = document.getElementById(`time-on-${ch}`);
    const timeOffInput = document.getElementById(`time-off-${ch}`);
    const saveBtn = document.getElementById(`btn-save-sch-${ch}`);
    const toggleBtn = document.getElementById(`btn-toggle-sch-${ch}`);
    const schLabel = document.getElementById(`lbl-schedule-status-${ch}`);

    // Đọc trạng thái cấu hình hẹn giờ hiện tại trên Firebase
    onValue(ref(db, `schedules/${ch}`), (snapshot) => {
        const schedule = snapshot.val();
        if (schedule) {
            timeOnInput.value = schedule.on_time || "";
            timeOffInput.value = schedule.off_time || "";
            
            if (schedule.enabled) {
                toggleBtn.innerText = "Tắt hẹn giờ";
                toggleBtn.className = "px-3 py-1.5 bg-sky-600/25 text-sky-300 border border-sky-500/30 rounded-2xl transition text-sm";
                schLabel.innerText = `Tự động: Bật (${schedule.on_time} - ${schedule.off_time})`;
                schLabel.className = "text-xs text-sky-300 font-medium block";
                toggleBtn.dataset.enabled = "true";
            } else {
                toggleBtn.innerText = "Bật hẹn giờ";
                toggleBtn.className = "px-3 py-1.5 bg-slate-800 text-slate-300 rounded-2xl transition text-sm hover:bg-slate-700";
                schLabel.innerText = "Tự động: Đang tắt";
                schLabel.className = "text-xs text-slate-500 block";
                toggleBtn.dataset.enabled = "false";
            }
        } else {
            schLabel.innerText = "Chưa thiết lập hẹn giờ";
            toggleBtn.dataset.enabled = "false";
        }
    });

    // Sự kiện lưu mốc thời gian hẹn giờ
    saveBtn.addEventListener('click', () => {
        const onTime = timeOnInput.value;
        const offTime = timeOffInput.value;
        if (!onTime || !offTime) {
            alert("Vui lòng điền đủ mốc thời gian Bật và Tắt!");
            return;
        }
        set(ref(db, `schedules/${ch}/on_time`), onTime);
        set(ref(db, `schedules/${ch}/off_time`), offTime);
        set(ref(db, `schedules/${ch}/enabled`), true); // Mặc định kích hoạt sau khi lưu
        alert(`Đã cập nhật lịch trình tự động cho thiết bị này!`);
    });

    // Kích hoạt nhanh / Hủy nhanh chế độ hẹn giờ
    toggleBtn.addEventListener('click', () => {
        const isCurrentlyEnabled = toggleBtn.dataset.enabled === "true";
        set(ref(db, `schedules/${ch}/enabled`), !isCurrentlyEnabled);
    });
});

// ==========================================
// 4. QUẢN LÝ AN NINH CHUYÊN SÂU & CÒI BÁO ĐỘNG
// ==========================================
const divMotionBg = document.getElementById('div-motion-bg');
const iconMotion = document.getElementById('icon-motion');
const lblMotionStatus = document.getElementById('lbl-motion-status');
const lblAlarmStatus = document.getElementById('lbl-alarm-status');
const btnClearAlarm = document.getElementById('btn-clear-alarm');
const btnToggleAlarm = document.getElementById('btn-toggle-alarm');

onValue(ref(db, 'security'), (snapshot) => {
    const security = snapshot.val() || {};
    
    // A. Đồng bộ trạng thái quét chuyển động từ PIR
    if (security.motion_detected) {
        divMotionBg.className = "p-4 rounded-3xl bg-rose-500/15 flex items-center gap-4 border border-rose-500/30 animate-pulse";
        iconMotion.className = "text-2xl text-rose-400";
        lblMotionStatus.innerText = "CẢNH BÁO: PHÁT HIỆN CHUYỂN ĐỘNG!";
        lblMotionStatus.className = "font-bold text-rose-300";
    } else {
        divMotionBg.className = "p-4 rounded-3xl bg-slate-900/70 flex items-center gap-4 border border-slate-700/60";
        iconMotion.className = "text-2xl text-slate-400";
        lblMotionStatus.innerText = "Không phát hiện đột nhập";
        lblMotionStatus.className = "text-sm text-slate-400";
    }

    // B. Đồng bộ trạng thái còi báo động vật lý (Alarm Buzzer)
    if (security.alarm_status) {
        btnToggleAlarm.innerText = "CÒI ĐANG HÚ (BẤM ĐỂ TẮT)";
        btnToggleAlarm.className = "w-full py-3 bg-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-rose-600/25 animate-bounce";
        lblAlarmStatus.innerText = "Hệ thống còi hú: ĐANG BẬT";
        lblAlarmStatus.className = "text-xs text-rose-300 font-semibold mt-1";
        btnClearAlarm.classList.remove('hidden');
    } else {
        btnToggleAlarm.innerText = "HỆ THỐNG AN TOÀN";
        btnToggleAlarm.className = "w-full py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl cursor-pointer hover:bg-slate-700 transition";
        lblAlarmStatus.innerText = "Hệ thống còi hú: Bình thường";
        lblAlarmStatus.className = "text-xs text-slate-500 mt-1";
        btnClearAlarm.classList.add('hidden');
    }

    // C. Đồng bộ các Radio Button lựa chọn chế độ bảo vệ
    if (security.mode) {
        const checkedRadio = document.querySelector(`input[name="security-mode"][value="${security.mode}"]`);
        if (checkedRadio) checkedRadio.checked = true;
    }
});

// Nút lưu chế độ An ninh lên Firebase
document.getElementById('btn-save-security-mode').addEventListener('click', () => {
    const selectedMode = document.querySelector('input[name="security-mode"]:checked').value;
    set(ref(db, 'security/mode'), selectedMode);
    alert("Đã cập nhật chế độ kích hoạt an ninh!");
});

// Chức năng dập tắt còi báo động nhanh
const deactivateAlarm = () => {
    set(ref(db, 'security/alarm_status'), false);
    set(ref(db, 'security/motion_detected'), false);
};
btnClearAlarm.addEventListener('click', deactivateAlarm);
btnToggleAlarm.addEventListener('click', () => {
    // Nếu bấm vào nút còi hú lúc đang kêu thì tắt, ngược lại cho phép kích hoạt cưỡng bức (test còi)
    const isAlarmHuming = btnToggleAlarm.innerText.includes("HÚ");
    set(ref(db, 'security/alarm_status'), !isAlarmHuming);
});

// ==========================================
// 5. TRUY XUẤT NHẬT KÝ RA VÀO (ACCESS LOGS)
// ==========================================
const tableDashboard = document.getElementById('table-access-log');
const tableFullLogs = document.getElementById('table-full-logs');

onValue(ref(db, 'access_log'), (snapshot) => {
    const logs = snapshot.val();
    tableDashboard.innerHTML = '';
    tableFullLogs.innerHTML = '';

    if (logs) {
        const logEntries = Object.values(logs).reverse(); // Nhật ký mới xếp đầu tiên

        logEntries.forEach((log, index) => {
            const statusStyle = log.status === 'Success' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10';
            const iconType = log.method === 'RFID' ? 'fa-id-card text-purple-400' : 'fa-fingerprint text-blue-400';
            
            const rowHtml = `
                <tr class="hover:bg-slate-900/80 border-b border-slate-700/60">
                    <td class="px-6 py-4 text-slate-300 font-mono text-xs">${log.timestamp}</td>
                    <td class="px-6 py-4 font-medium"><i class="fa-solid ${iconType} mr-2"></i>${log.method}</td>
                    <td class="px-6 py-4 text-slate-300">${log.user}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded text-xs font-semibold ${statusStyle}">${log.status}</span>
                    </td>
                </tr>
            `;

            // Đổ tối đa 4 dòng log rút gọn vào màn hình chính (Dashboard view)
            if (index < 4) {
                tableDashboard.innerHTML += rowHtml;
            }
            // Đổ tất cả vào trang quản lý nhật ký chi tiết (Logs view)
            tableFullLogs.innerHTML += rowHtml;
        });
    } else {
        const emptyRow = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">Chưa có dữ liệu lịch sử ra vào.</td></tr>`;
        tableDashboard.innerHTML = emptyRow;
        tableFullLogs.innerHTML = emptyRow;
    }
});

// Xóa trắng lịch sử nhật ký truy cập ra vào
document.getElementById('btn-clear-logs').addEventListener('click', () => {
    if(confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử ra vào không?")) {
        remove(ref(db, 'access_log'));
    }
});

// ==========================================
// 6. KHAI THÁC API THỜI TIẾT THỰC TẾ (WEATHER API)
// ==========================================
async function fetchWeather() {
    try {
        // Sử dụng API thời tiết Open-Meteo cập nhật theo tọa độ thực tế của TP.HCM
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=10.75&longitude=106.67&current_weather=true');
        const data = await response.json();
        if (data && data.current_weather) {
            document.getElementById('weather-info').innerText = `TP.HCM: ${data.current_weather.temperature}°C`;
        }
    } catch (error) {
        document.getElementById('weather-info').innerText = `TP.HCM: 31°C`;
    }
}
fetchWeather();
setInterval(fetchWeather, 600000); // 10 phút tải lại thời tiết 1 lần