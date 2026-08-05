/**
 * admin.js
 * Frontend Logic for Game Admin Panel — connected to real backend APIs
 */

// ==========================================
// 1. STATE
// ==========================================
let isLoggedIn = false;
let gameStatus = 'waiting'; // 'waiting', 'playing', 'finished'
let pollInterval = null;
let timerInterval = null;
let remainingSeconds = null;
let registeredStudentCount = 0;

// ==========================================
// 2. DOM REFS
// ==========================================
const sections = {
    login: document.getElementById('login-section'),
    dashboard: document.getElementById('dashboard-section')
};

const modal = {
    overlay: document.getElementById('confirm-modal'),
    title: document.getElementById('modal-title'),
    message: document.getElementById('modal-message'),
    confirmBtn: document.getElementById('modal-confirm-btn'),
    cancelBtn: document.getElementById('modal-cancel-btn')
};
let pendingConfirmAction = null;

const timerDisplay = document.getElementById('timer-display');
const statsElements = {
    total: document.getElementById('stat-total'),
    playing: document.getElementById('stat-playing'),
    finished: document.getElementById('stat-finished')
};
const monitorTbody = document.getElementById('monitor-tbody');

const btnStart = document.getElementById('btn-start-game');
const btnStop = document.getElementById('btn-stop-game');
const btnReset = document.getElementById('btn-reset-game');
const btnExcel = document.getElementById('btn-download-excel');
const btnLogout = document.getElementById('logout-btn');

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');

const gameTimeInput = document.getElementById('game-time');
const hintTimeInput = document.getElementById('hint-time');
const btnSaveGameTime = document.getElementById('btn-save-game-time');
const btnSaveHintTime = document.getElementById('btn-save-hint-time');

// ==========================================
// 3. UTILITIES (Toast, Modal, Loading)
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
    }, 3000);
}

function openModal(title, message, onConfirm) {
    modal.title.textContent = title;
    modal.message.textContent = message;
    pendingConfirmAction = onConfirm;
    modal.overlay.classList.remove('hidden');
}

function closeModal() {
    modal.overlay.classList.add('hidden');
    pendingConfirmAction = null;
}
modal.cancelBtn.addEventListener('click', closeModal);
modal.confirmBtn.addEventListener('click', () => {
    if (pendingConfirmAction) pendingConfirmAction();
    closeModal();
});

function setButtonLoading(btn, isLoading, originalText = '') {
    if (isLoading) {
        btn.classList.add('loading');
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'در حال انجام...';
    } else {
        btn.classList.remove('loading');
        btn.textContent = btn.dataset.originalText || originalText;
    }
}

// ==========================================
// 4. AUTHENTICATION (Real Backend)
// ==========================================

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setButtonLoading(loginBtn, true);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'ورود ناموفق');
        }

        isLoggedIn = true;
        sections.login.classList.add('hidden');
        sections.dashboard.classList.remove('hidden');
        showToast('ورود موفقیت‌آمیز بود', 'success');
        initDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(loginBtn, false, 'ورود');
    }
});

btnLogout.addEventListener('click', () => {
    // حذف کوکی سمت کلاینت (فقط مرورگر) - کوکی HttpOnly رو نمی‌تونیم حذف کنیم ولی خروج از پنل رو شبیه‌سازی می‌کنیم
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    isLoggedIn = false;
    sections.dashboard.classList.add('hidden');
    sections.login.classList.remove('hidden');
    stopPolling();
    clearInterval(timerInterval);
    showToast('از حساب خارج شدید', 'info');
});

// ==========================================
// 5. DASHBOARD INIT & POLLING
// ==========================================

async function initDashboard() {
    await loadSettings();
    await fetchWaitingList();
    startPolling();
    syncTimer(); // شروع تایمر با وضعیت فعلی
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchWaitingList, 3000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// ==========================================
// 6. FETCH WAITING LIST (Real API)
// ==========================================

async function fetchWaitingList() {
    try {
        const res = await fetch('/api/admin/waiting-list', {
            credentials: 'same-origin'
        });
        if (!res.ok) {
            if (res.status === 401) {
                // کوکی منقضی شده -> برگشت به لاگین
                handleUnauthorized();
                return;
            }
            throw new Error('خطا در دریافت لیست');
        }
        const data = await res.json();
        renderMonitorTable(data.students);
        updateStats(data.students);
        // همچنین وضعیت بازی رو از lobby/status بگیریم برای هماهنگی تایمر
        await syncGameStatus();
    } catch (err) {
        console.error('Polling error:', err);
    }
}

function renderMonitorTable(students) {
    monitorTbody.innerHTML = '';
    if (!students || students.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted);">هیچ دانش‌آموزی ثبت‌نام نکرده است</td>`;
        monitorTbody.appendChild(tr);
        return;
    }
    students.forEach(student => {
        const tr = document.createElement('tr');
        // برای وضعیت فعلی، از اطلاعات جداگانه استفاده می‌کنیم (فعلاً همه در انتظارند)
        // ولی می‌تونیم وضعیت رو از student.status (اگر بعداً اضافه بشه) بگیریم
        // در حال حاضر فقط name و score رو داریم، پس وضعیت رو به صورت تخمینی نمایش می‌دیم
        // برای نمایش بهتر، از students با پاسخ‌ها استفاده نمی‌کنیم، پس وضعیت رو 'در انتظار' فرض می‌کنیم
        const statusBadge = `<span class="status-badge status-waiting">در انتظار</span>`;
        tr.innerHTML = `
            <td>${student.name}</td>
            <td>${statusBadge}</td>
            <td>${student.score} امتیاز</td>
            <td>-</td>
        `;
        monitorTbody.appendChild(tr);
    });
}

function updateStats(students) {
    const total = students.length;
    registeredStudentCount = total;
    statsElements.total.textContent = total;
    statsElements.playing.textContent = '?';
    statsElements.finished.textContent = '?';
}

// ==========================================
// 7. GAME STATUS & TIMER (Real API)
// ==========================================

async function syncGameStatus() {
    try {
        const res = await fetch('/api/lobby/status');
        if (!res.ok) throw new Error('خطا در دریافت وضعیت');
        const data = await res.json();
        gameStatus = data.status;
        updateButtonsByStatus(gameStatus);
        // بعد از دریافت وضعیت، زمان باقی‌مانده رو هم بگیریم
        await syncTimer();
    } catch (err) {
        console.error('syncGameStatus error:', err);
    }
}

async function syncTimer() {
    try {
        const res = await fetch('/api/game/time-remaining');
        if (!res.ok) throw new Error('خطا در دریافت زمان');
        const data = await res.json();
        if (data.status === 'playing' && typeof data.seconds_remaining === 'number') {
            remainingSeconds = data.seconds_remaining;
            startTimerDisplay(remainingSeconds);
        } else {
            remainingSeconds = null;
            timerDisplay.textContent = '--:--';
            clearInterval(timerInterval);
        }
    } catch (err) {
        console.error('syncTimer error:', err);
    }
}

function startTimerDisplay(seconds) {
    clearInterval(timerInterval);
    let current = seconds;
    updateTimerText(current);
    timerInterval = setInterval(() => {
        current--;
        if (current <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = '00:00';
            // می‌تونیم بعد از اتمام زمان، وضعیت رو مجدداً بررسی کنیم
            syncGameStatus();
        } else {
            updateTimerText(current);
        }
    }, 1000);
}

function updateTimerText(seconds) {
    if (seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateButtonsByStatus(status) {
    btnStart.disabled = (status === 'playing' || status === 'finished');
    btnStop.disabled = (status === 'waiting' || status === 'finished');
    btnExcel.disabled = !(status === 'finished' || registeredStudentCount > 0);
}

// ==========================================
// 8. GAME CONTROLS (Real APIs)
// ==========================================

btnStart.addEventListener('click', async () => {
    setButtonLoading(btnStart, true);
    try {
        const res = await fetch('/api/admin/game/start', {
            method: 'POST',
            credentials: 'same-origin'
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'خطا در شروع بازی');
        }
        showToast('بازی با موفقیت شروع شد', 'success');
        await syncGameStatus(); // به‌روزرسانی وضعیت و تایمر
        await fetchWaitingList();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btnStart, false, 'شروع بازی');
    }
});

btnStop.addEventListener('click', () => {
    openModal(
        'توقف زودهنگام بازی',
        'آیا مطمئن هستید که می‌خواهید بازی را متوقف کنید؟ تمام دانش‌آموزان به لیدربرد منتقل می‌شوند.',
        async () => {
            setButtonLoading(btnStop, true);
            try {
                const res = await fetch('/api/admin/game/stop', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'خطا در توقف بازی');
                }
                showToast('بازی متوقف شد', 'info');
                await syncGameStatus();
                await fetchWaitingList();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                setButtonLoading(btnStop, false, 'توقف / پایان زودهنگام');
            }
        }
    );
});

btnReset.addEventListener('click', () => {
    openModal(
        'ریست کامل بازی',
        'هشدار: تمام دانش‌آموزان و پاسخ‌ها پاک خواهند شد. آیا ادامه می‌دهید؟',
        async () => {
            setButtonLoading(btnReset, true);
            try {
                const res = await fetch('/api/admin/game/reset', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'خطا در ریست');
                }
                showToast('دیتابیس با موفقیت ریست شد', 'success');
                await syncGameStatus();
                await fetchWaitingList();
                // ریست تایمر
                clearInterval(timerInterval);
                timerDisplay.textContent = '--:--';
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                setButtonLoading(btnReset, false, 'ریست مسابقه');
            }
        }
    );
});

btnExcel.addEventListener('click', () => {
    // دانلود مستقیم فایل اکسل
    window.location.href = '/api/admin/results/export';
});

// ==========================================
// 9. SETTINGS (Real API)
// ==========================================

async function loadSettings() {
    try {
        const res = await fetch('/api/admin/settings', {
            credentials: 'same-origin'
        });
        if (!res.ok) {
            if (res.status === 401) { handleUnauthorized(); return; }
            throw new Error('خطا در دریافت تنظیمات');
        }
        const data = await res.json();
        gameTimeInput.placeholder = data.game_time;
        hintTimeInput.placeholder = data.guid_time;
        // همچنین می‌تونیم مقادیر فعلی رو در inputها نمایش بدیم
        gameTimeInput.value = data.game_time;
        hintTimeInput.value = data.guid_time;
    } catch (err) {
        console.error('loadSettings error:', err);
        showToast('خطا در دریافت تنظیمات', 'error');
    }
}

async function saveSetting(field, value) {
    try {
        const payload = {};
        if (field === 'game_time') payload.game_time = parseInt(value);
        else if (field === 'guid_time') payload.guid_time = parseInt(value);

        const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'same-origin'
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'خطا در ذخیره تنظیمات');
        }
        showToast('تنظیمات ذخیره شد', 'success');
        await loadSettings(); // بارگذاری مجدد
    } catch (err) {
        showToast(err.message, 'error');
    }
}

btnSaveGameTime.addEventListener('click', async () => {
    const val = gameTimeInput.value.trim();
    if (!val || isNaN(val) || parseInt(val) <= 0) {
        showToast('لطفاً یک عدد مثبت وارد کنید', 'error');
        return;
    }
    setButtonLoading(btnSaveGameTime, true);
    await saveSetting('game_time', val);
    setButtonLoading(btnSaveGameTime, false, 'ثبت');
});

btnSaveHintTime.addEventListener('click', async () => {
    const val = hintTimeInput.value.trim();
    if (!val || isNaN(val) || parseInt(val) <= 0) {
        showToast('لطفاً یک عدد مثبت وارد کنید', 'error');
        return;
    }
    setButtonLoading(btnSaveHintTime, true);
    await saveSetting('guid_time', val);
    setButtonLoading(btnSaveHintTime, false, 'ثبت');
});

// ==========================================
// 10. UNAUTHORIZED HANDLER
// ==========================================

function handleUnauthorized() {
    showToast('نشست شما منقضی شده، دوباره وارد شوید', 'error');
    // حذف کوکی (فقط سمت کلاینت)
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    isLoggedIn = false;
    sections.dashboard.classList.add('hidden');
    sections.login.classList.remove('hidden');
    stopPolling();
    clearInterval(timerInterval);
}

// ==========================================
// 11. CHECK LOGIN STATUS ON PAGE LOAD
// ==========================================

(async function checkAuth() {
    try {
        // یک درخواست ساده به یک اندپوینت محافظت‌شده برای تست کوکی
        const res = await fetch('/api/admin/waiting-list', {
            credentials: 'same-origin'
        });
        if (res.status === 401) {
            // کوکی نداریم یا معتبر نیست
            sections.login.classList.remove('hidden');
            sections.dashboard.classList.add('hidden');
        } else if (res.ok) {
            // کوکی معتبر است
            isLoggedIn = true;
            sections.login.classList.add('hidden');
            sections.dashboard.classList.remove('hidden');
            initDashboard();
        }
    } catch (err) {
        console.error('checkAuth error:', err);
        sections.login.classList.remove('hidden');
        sections.dashboard.classList.add('hidden');
    }
})();