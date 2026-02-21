// ===================================
// GLOBAL STATE
// ===================================
let routines = [];
let memories = [];
let family = [];
let currentRoutineView = 'today';
let currentMemoryFilter = 'all';
let themeAnimRAF = null; // requestAnimationFrame handle for theme animations

// ===================================
// THEME TRANSITION ANIMATIONS
// ===================================

/**
 * Dispatcher: call the correct animation for the selected theme.
 * Safe to call even during a running animation (cancels previous).
 */
function playThemeAnimation(theme) {
    const canvas = document.getElementById('theme-anim-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Resize canvas to current viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Cancel any in-progress animation
    if (themeAnimRAF) {
        cancelAnimationFrame(themeAnimRAF);
        themeAnimRAF = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (theme === 'forest') animateLeaves(canvas, ctx);
    else if (theme === 'ocean') animateOcean(canvas, ctx);
    else animateGlitter(canvas, ctx);
}

/* ------ FOREST CALM: Falling leaves ------ */
/* ------ FOREST CALM: Diagonal leaves (top-right → bottom-left) ------ */
function animateLeaves(canvas, ctx) {
    const COLORS = ['#22C55E', '#16A34A', '#4ADE80', '#86EFAC', '#15803D', '#BBF7D0'];
    const COUNT = 38;
    const DURATION = 4500;

    const leaves = Array.from({ length: COUNT }, () => {
        // Spawn from right edge (60%) or top-right area (40%)
        const fromRight = Math.random() < 0.6;
        const spawnX = fromRight ? canvas.width + 20 : canvas.width * (0.4 + Math.random() * 0.62);
        const spawnY = fromRight ? Math.random() * canvas.height * 0.85 : -20;
        const speed = 1.9 + Math.random() * 2.4;
        // Primary motion: diagonal top-right → bottom-left
        return {
            x: spawnX,
            y: spawnY,
            vx: -speed * (0.62 + Math.random() * 0.24), // leftward
            vy: speed * (0.62 + Math.random() * 0.24), // downward
            size: 9 + Math.random() * 15,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.06,
            swayFreq: 0.016 + Math.random() * 0.02,
            swayOff: Math.random() * Math.PI * 2,
            opacity: 0.72 + Math.random() * 0.28,
            delayMs: Math.random() * 950
        };
    });

    let startTime = null;
    function draw(ts) {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ---- Subtle forest background gradient ----
        // Mirrors the diagonal direction: rich green at top-right fading to soft mint at bottom-left.
        // Fades in over first 600ms, fades out in synch with leaves at the end.
        const toEndGlobal = DURATION - elapsed;
        const fadeIn = elapsed < 600 ? elapsed / 600 : 1;
        const fadeOut = toEndGlobal < 700 ? Math.max(0, toEndGlobal / 700) : 1;
        const bgFade = fadeIn * fadeOut;

        const bgGrad = ctx.createLinearGradient(canvas.width, 0, 0, canvas.height);
        bgGrad.addColorStop(0.00, `rgba( 20,  83,  45, ${(0.14 * bgFade).toFixed(3)})`); // deep forest
        bgGrad.addColorStop(0.25, `rgba( 21, 128,  61, ${(0.11 * bgFade).toFixed(3)})`); // mid forest
        bgGrad.addColorStop(0.52, `rgba( 34, 197,  94, ${(0.08 * bgFade).toFixed(3)})`); // bright fern
        bgGrad.addColorStop(0.78, `rgba(134, 239, 172, ${(0.05 * bgFade).toFixed(3)})`); // light canopy
        bgGrad.addColorStop(1.00, `rgba(187, 247, 208, ${(0.03 * bgFade).toFixed(3)})`); // soft mint edge
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // -------------------------------------------

        let anyAlive = false;


        for (const L of leaves) {
            if (elapsed < L.delayMs) { anyAlive = true; continue; }
            const t = (elapsed - L.delayMs) / 1000;
            // Perpendicular sway (to (−1,1) direction, perp is (1,1)/√2)
            const sway = Math.sin(t * L.swayFreq * 60 + L.swayOff) * 0.5;
            L.x += L.vx + sway * 0.7;
            L.y += L.vy + sway * 0.7;
            L.angle += L.rotSpeed;

            // Alive while still on or approaching screen
            if (L.x > -80 && L.y < canvas.height + 80) anyAlive = true;
            else continue;

            // Fade out near the end or near bottom-left corner
            const cornerDist = Math.hypot(L.x, canvas.height - L.y);
            const cornerFade = cornerDist < 180 ? cornerDist / 180 : 1;
            const toEnd = DURATION - elapsed;
            const endFade = toEnd < 700 ? Math.max(0, toEnd / 700) : 1;
            const alpha = L.opacity * Math.min(cornerFade, endFade);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(L.x, L.y);
            ctx.rotate(L.angle);
            ctx.fillStyle = L.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, L.size * 0.38, L.size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, -L.size * 0.8);
            ctx.lineTo(0, L.size * 0.8);
            ctx.stroke();
            ctx.restore();
        }

        if (elapsed < DURATION && anyAlive) {
            themeAnimRAF = requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            themeAnimRAF = null;
        }
    }
    themeAnimRAF = requestAnimationFrame(draw);
}

/* ------ OCEAN BREEZE: Diagonal wave (top-right → bottom-left), forward-recede-forward ------ */
function animateOcean(canvas, ctx) {
    const DURATION = 5000;
    const diag = Math.hypot(canvas.width, canvas.height);

    // Easing: maps 0..1 time → wave-front position in rotated X space
    // Positive = not yet arrived (wave behind top-right), negative = wave surged past centre
    function getWaveFront(t) {
        if (t < 0.38) {
            // Surge forward: diag*0.55 → 0  (ease-out cubic)
            const e = 1 - Math.pow(1 - t / 0.38, 3);
            return diag * 0.55 * (1 - e);
        } else if (t < 0.58) {
            // Recede: 0 → diag*0.18  (ease-in-out)
            const e = (t - 0.38) / 0.20;
            const s = e < 0.5 ? 2 * e * e : -1 + (4 - 2 * e) * e;
            return diag * 0.18 * s;
        } else {
            // Final surge: diag*0.18 → -diag*0.7 (ease-in)
            const e = (t - 0.58) / 0.42;
            const s = e * e; // ease-in quad
            return diag * 0.18 * (1 - s) + (-diag * 0.7) * s;
        }
    }

    let startTime = null;
    function draw(ts) {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;
        const t = Math.min(elapsed / DURATION, 1);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fade out over last 22%
        const fade = t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;

        const waveFront = getWaveFront(t);
        const rippleAmp = 28 + 14 * Math.sin(elapsed * 0.0008); // breathing ripple amplitude

        // Draw in a rotated context (diagonal = 45° rotation)
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 4); // top-right to bottom-left = -45°

        // Half-diagonal covers the full rotated span
        const halfSpan = diag * 0.75;
        const rippleFreq = (2 * Math.PI) / (diag * 0.32);

        // --- Wave body fill ---
        const bodyAlpha = 0.32 * fade;
        ctx.globalAlpha = bodyAlpha;
        ctx.beginPath();
        ctx.moveTo(waveFront, -halfSpan);
        for (let y = -halfSpan; y <= halfSpan; y += 5) {
            const ripple = Math.sin(y * rippleFreq + elapsed * 0.0025) * rippleAmp;
            ctx.lineTo(waveFront + ripple, y);
        }
        ctx.lineTo(waveFront + halfSpan * 2, halfSpan);
        ctx.lineTo(waveFront + halfSpan * 2, -halfSpan);
        ctx.closePath();

        // Gradient from leading edge backward
        const grad = ctx.createLinearGradient(waveFront, 0, waveFront + diag * 0.55, 0);
        grad.addColorStop(0, 'rgba(14,165,233,0.0)');
        grad.addColorStop(0.07, 'rgba(14,165,233,0.55)');
        grad.addColorStop(0.35, 'rgba(56,189,248,0.30)');
        grad.addColorStop(0.70, 'rgba(125,211,252,0.18)');
        grad.addColorStop(1.0, 'rgba(186,230,253,0.06)');
        ctx.fillStyle = grad;
        ctx.fill();

        // --- Foam edge highlight ---
        ctx.globalAlpha = 0.6 * fade;
        ctx.beginPath();
        ctx.moveTo(waveFront + Math.sin(-halfSpan * rippleFreq + elapsed * 0.0025) * rippleAmp, -halfSpan);
        for (let y = -halfSpan; y <= halfSpan; y += 4) {
            const ripple = Math.sin(y * rippleFreq + elapsed * 0.0025) * rippleAmp;
            ctx.lineTo(waveFront + ripple, y);
        }
        ctx.strokeStyle = 'rgba(186,230,253,0.85)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // --- Soft secondary wave behind ---
        const trailX = waveFront + diag * 0.14;
        ctx.globalAlpha = 0.14 * fade;
        ctx.beginPath();
        ctx.moveTo(trailX, -halfSpan);
        for (let y = -halfSpan; y <= halfSpan; y += 5) {
            const ripple = Math.sin(y * rippleFreq * 0.7 + elapsed * 0.0018 + 1.2) * rippleAmp * 0.65;
            ctx.lineTo(trailX + ripple, y);
        }
        ctx.lineTo(trailX + halfSpan * 2, halfSpan);
        ctx.lineTo(trailX + halfSpan * 2, -halfSpan);
        ctx.closePath();
        ctx.fillStyle = 'rgba(56,189,248,0.22)';
        ctx.fill();

        ctx.restore();

        if (t < 1) {
            themeAnimRAF = requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            themeAnimRAF = null;
        }
    }
    themeAnimRAF = requestAnimationFrame(draw);
}

/* ------ DEFAULT: Teal-blue glitter burst from centre ------ */
function animateGlitter(canvas, ctx) {
    const COLORS = ['#14B8A6', '#0EA5E9', '#5EEAD4', '#BAE6FD', '#FFFFFF', '#38BDF8', '#2DD4BF', '#67E8F9'];
    const COUNT = 130;
    const DURATION = 3000;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const particles = Array.from({ length: COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.2 + Math.random() * 5.5;
        return {
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 5.5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            delayMs: Math.random() * 350
        };
    });

    let startTime = null;
    function draw(ts) {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Radial glow from centre, fades over first 1.2s
        const glowAlpha = Math.max(0, 1 - elapsed / 1200);
        if (glowAlpha > 0) {
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.45);
            grd.addColorStop(0, `rgba(20,184,166,${(glowAlpha * 0.22).toFixed(3)})`);
            grd.addColorStop(0.5, `rgba(14,165,233,${(glowAlpha * 0.09).toFixed(3)})`);
            grd.addColorStop(1, 'rgba(14,165,233,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        for (const P of particles) {
            if (elapsed < P.delayMs) continue;
            const life = (elapsed - P.delayMs) / (DURATION - P.delayMs);
            P.x += P.vx;
            P.y += P.vy;
            P.vy += 0.045; // soft gravity
            const alpha = Math.max(0, 1 - life);
            const r = P.size * (1 - life * 0.5);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = P.color;
            ctx.beginPath();
            ctx.moveTo(P.x, P.y - r);
            ctx.lineTo(P.x + r * 0.5, P.y);
            ctx.lineTo(P.x, P.y + r);
            ctx.lineTo(P.x - r * 0.5, P.y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (elapsed < DURATION) {
            themeAnimRAF = requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            themeAnimRAF = null;
        }
    }
    themeAnimRAF = requestAnimationFrame(draw);
}

// ===================================
// TOAST NOTIFICATIONS
// ===================================
/**
 * Show a lightweight toast notification.
 * @param {string} message  - Text to display
 * @param {'success'|'error'|'info'} type
 * @param {number} durationMs - How long before auto-dismiss (default 3000)
 */
function showToast(message, type = 'success', durationMs = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    // Trigger enter animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    // Auto-dismiss
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 350);
    }, durationMs);
}

// ===================================
// UTILITY FUNCTIONS
// ===================================
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function formatDate(dateStr) {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDays(days) {
    if (!days || days.length === 0) return 'No days';
    const dayMap = {
        'Mon': 'M', 'Tue': 'T', 'Wed': 'W', 'Thu': 'Th',
        'Fri': 'F', 'Sat': 'Sa', 'Sun': 'Su'
    };
    return days.map(d => dayMap[d] || d).join(' ');
}

function getCurrentTime() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

// ===================================
// HOME TAB MODULE
// ===================================
function renderHomeTab() {
    renderHomeTodayRoutines();
    renderHomeRecentMemories();
    renderHomeFamilyUpdates();
    rotateChatPrompt();
    renderHomeNotes();
}

function renderHomeTodayRoutines() {
    const container = document.getElementById('home-routines');
    if (!container) return;

    // Get today's routines
    const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    const todayRoutines = routines
        .filter(r => r.days && r.days.includes(today) && !r.paused)
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 3); // Show up to 3

    if (todayRoutines.length === 0) {
        container.innerHTML = '<div class="home-empty">No routines scheduled for today</div>';
        return;
    }

    container.innerHTML = todayRoutines.map(routine => `
        <div class="home-routine-item">
            <div class="home-routine-time">${escapeHtml(formatTime(routine.time))}</div>
            <div class="home-routine-title">${escapeHtml(routine.title)}</div>
        </div>
    `).join('');
}

function renderHomeRecentMemories() {
    const container = document.getElementById('home-memories');
    if (!container) return;

    // Get 2 most recent memories
    const recentMemories = memories
        .sort((a, b) => {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateB - dateA;
        })
        .slice(0, 2);

    if (recentMemories.length === 0) {
        container.innerHTML = '<div class="home-empty">No memories yet</div>';
        return;
    }

    container.innerHTML = recentMemories.map(memory => `
        <div class="home-memory-item">
            ${memory.mediaPath ?
            `<img src="${escapeHtml(memory.mediaPath)}" alt="${escapeHtml(memory.title)}" class="home-memory-thumbnail">` :
            '<div class="home-memory-thumbnail"></div>'
        }
            <div class="home-memory-info">
                <div class="home-memory-title">${escapeHtml(memory.title)}</div>
                <div class="home-memory-date">${formatDate(memory.date)}</div>
            </div>
        </div>
    `).join('');
}

function renderHomeFamilyUpdates() {
    const container = document.getElementById('home-family');
    if (!container) return;

    // Get 1-2 family members
    const familyMembers = family.slice(0, 2);

    if (familyMembers.length === 0) {
        container.innerHTML = '<div class="home-empty">No family members added yet</div>';
        return;
    }

    container.innerHTML = familyMembers.map(member => `
        <div class="home-family-item">
            ${member.photoUrl ?
            `<img src="${escapeHtml(member.photoUrl)}" alt="${escapeHtml(member.name)}" class="home-family-photo">` :
            '<div class="home-family-photo">👤</div>'
        }
            <div class="home-family-info">
                <div class="home-family-name">${escapeHtml(member.name)}</div>
                <div class="home-family-relation">${escapeHtml(member.relation)}</div>
            </div>
        </div>
    `).join('');
}

function rotateChatPrompt() {
    const prompts = [
        "Hello! How can I help you today?",
        "Let's chat and organize your day together!",
        "Hi there! Ready to explore your memories and routines?"
    ];
    const promptElement = document.getElementById('chat-prompt');
    if (promptElement) {
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        promptElement.textContent = randomPrompt;
    }
}

// ===================================
// TAB SWITCHING
// ===================================
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content panels
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Floating Save Profile button: only visible on the profile tab
    const floatSave = document.getElementById('floating-save-profile-btn');
    if (floatSave) {
        floatSave.style.display = tabName === 'profile' ? 'flex' : 'none';
    }

    // Render Notes tab when switching to it
    if (tabName === 'notes') renderNotesTab();
}

// ===================================
// ROUTINES MODULE
// ===================================
async function loadRoutines() {
    try {
        const response = await fetch('/api/routines');
        if (response.ok) {
            routines = await response.json();
            if (!Array.isArray(routines)) routines = [];
            renderRoutines();
        }
    } catch (error) {
        console.error('Error loading routines:', error);
    }
}

function renderRoutines() {
    const list = document.getElementById('routines-list');
    list.innerHTML = '';

    let filteredRoutines = routines;

    if (currentRoutineView === 'today') {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        filteredRoutines = routines.filter(r => r.days && r.days.includes(today));
    }

    filteredRoutines.sort((a, b) => a.time.localeCompare(b.time));

    if (filteredRoutines.length === 0) {
        list.innerHTML = `<div class="empty-state">No routines found for ${currentRoutineView === 'today' ? 'today' : 'this view'}.</div>`;
        return;
    }

    filteredRoutines.forEach(routine => {
        const box = createRoutineBox(routine);
        list.appendChild(box);
    });
}

function createRoutineBox(routine) {
    const box = document.createElement('div');
    box.className = 'item-box';

    const isCompleted = routine.lastCompleted === new Date().toISOString().split('T')[0];
    const isPaused = routine.paused === true;

    if (isPaused) box.classList.add('paused');

    let mediaHtml = '';
    if (routine.mediaPath) {
        const ext = routine.mediaPath.split('.').pop().toLowerCase();
        if (['mp4', 'mov', 'webm'].includes(ext)) {
            mediaHtml = `<div class="item-media"><video src="${routine.mediaPath}" controls></video></div>`;
        } else {
            mediaHtml = `<div class="item-media"><img src="${routine.mediaPath}" alt="Routine Media"></div>`;
        }
    }

    box.innerHTML = `
        <div class="item-header">
            <div>
                <h3 class="item-title">${escapeHtml(routine.title)}</h3>
                <div class="item-meta">
                    <span>🕐 ${formatTime(routine.time)}</span>
                    <span>📅 ${formatDays(routine.days)}</span>
                </div>
            </div>
        </div>
        ${routine.description ? `<p class="item-description">${escapeHtml(routine.description)}</p>` : ''}
        ${mediaHtml}
        <div class="item-actions">
            <button class="text-button done ${isCompleted ? 'completed' : ''}" onclick="toggleRoutineComplete('${routine.id}')">
                ${isCompleted ? 'Completed' : 'Mark Done'}
            </button>
            <button class="text-button" onclick="toggleRoutinePause('${routine.id}')">
                ${isPaused ? 'Resume' : 'Pause'}
            </button>
            <button class="text-button" onclick="editRoutine('${routine.id}')">Edit</button>
            <button class="text-button delete" onclick="deleteRoutine('${routine.id}')">Delete</button>
        </div>
    `;

    return box;
}

function initRoutineModal() {
    const addBtn = document.getElementById('add-routine-btn');
    const modal = document.getElementById('routine-modal');
    const closeBtn = document.getElementById('close-routine-modal');
    const cancelBtn = document.getElementById('cancel-routine');
    const form = document.getElementById('routine-form');

    addBtn.addEventListener('click', () => openRoutineModal());
    closeBtn.addEventListener('click', closeRoutineModal);
    cancelBtn.addEventListener('click', closeRoutineModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRoutine();
    });

    // Day selector
    document.querySelectorAll('.day-button').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('selected');
        });
    });

    // View toggle
    document.querySelectorAll('.toggle-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            currentRoutineView = view;
            document.querySelectorAll('.toggle-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRoutines();
        });
    });
}

function openRoutineModal(id = null) {
    const modal = document.getElementById('routine-modal');
    const title = document.getElementById('routine-modal-title');
    const form = document.getElementById('routine-form');

    form.reset();
    document.querySelectorAll('.day-button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('routine-id').value = '';

    if (id) {
        const routine = routines.find(r => r.id === id);
        if (routine) {
            title.textContent = 'Edit Routine';
            document.getElementById('routine-id').value = routine.id;
            document.getElementById('routine-name').value = routine.title;
            document.getElementById('routine-time').value = routine.time;
            document.getElementById('routine-description').value = routine.description || '';
            document.getElementById('routine-reminder').value = routine.reminder || '0';

            routine.days.forEach(day => {
                const btn = document.querySelector(`.day-button[data-day="${day}"]`);
                if (btn) btn.classList.add('selected');
            });
        }
    } else {
        title.textContent = 'Add Routine';
    }

    modal.classList.add('active');
}

function closeRoutineModal() {
    document.getElementById('routine-modal').classList.remove('active');
}

async function saveRoutine() {
    const id = document.getElementById('routine-id').value;
    const title = document.getElementById('routine-name').value.trim();
    const time = document.getElementById('routine-time').value;
    const description = document.getElementById('routine-description').value;
    const reminder = document.getElementById('routine-reminder').value;
    const mediaInput = document.getElementById('routine-media');

    const selectedDays = Array.from(document.querySelectorAll('.day-button.selected'))
        .map(btn => btn.dataset.day);

    // Validation
    if (!title) {
        alert('Please enter a Routine Name.');
        return;
    }
    if (!time) {
        alert('Please select a Time.');
        return;
    }
    if (selectedDays.length === 0) {
        alert('Please select at least one Day of Week.');
        return;
    }

    // Handle file upload
    let mediaPath = null;
    if (id) {
        const existing = routines.find(r => r.id === id);
        if (existing) mediaPath = existing.mediaPath;
    }

    if (mediaInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', mediaInput.files[0]);

        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                mediaPath = data.url;
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload media.');
            return;
        }
    }

    const newRoutine = {
        id: id || generateUUID(),
        title,
        description,
        time,
        reminder,
        days: selectedDays,
        mediaPath,
        paused: id ? (routines.find(r => r.id === id)?.paused || false) : false,
        lastCompleted: id ? (routines.find(r => r.id === id)?.lastCompleted || null) : null
    };

    if (id) {
        const index = routines.findIndex(r => r.id === id);
        if (index !== -1) routines[index] = newRoutine;
    } else {
        routines.push(newRoutine);
    }

    await syncRoutines();
    closeRoutineModal();
    renderRoutines();
}

async function deleteRoutine(id) {
    if (!confirm('Are you sure you want to delete this routine?')) return;
    routines = routines.filter(r => r.id !== id);
    await syncRoutines();
    renderRoutines();
}

function editRoutine(id) {
    openRoutineModal(id);
}

async function toggleRoutineComplete(id) {
    const routine = routines.find(r => r.id === id);
    if (!routine) return;

    const today = new Date().toISOString().split('T')[0];
    routine.lastCompleted = routine.lastCompleted === today ? null : today;

    await syncRoutines();
    renderRoutines();
}

async function toggleRoutinePause(id) {
    const routine = routines.find(r => r.id === id);
    if (!routine) return;

    routine.paused = !routine.paused;
    await syncRoutines();
    renderRoutines();
}

async function syncRoutines() {
    try {
        await fetch('/api/routines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routines)
        });
    } catch (error) {
        console.error('Error syncing routines:', error);
    }
}

// ===================================
// MEMORIES MODULE
// ===================================
async function loadMemories() {
    try {
        const response = await fetch('/api/memories');
        if (response.ok) {
            const data = await response.json();
            // Backend returns full object, extract memories array
            memories = Array.isArray(data) ? data : (data.memories || []);
            renderMemories();
        }
    } catch (error) {
        console.error('Error loading memories:', error);
    }
}

function renderMemories() {
    const list = document.getElementById('memories-list');
    if (!list) return;
    list.innerHTML = '';

    let filteredMemories = memories;

    if (currentMemoryFilter === 'manual') {
        filteredMemories = memories.filter(m => m.source === 'manual');
    } else if (currentMemoryFilter === 'chat') {
        filteredMemories = memories.filter(m => m.source === 'chat');
    }

    if (filteredMemories.length === 0) {
        const filterLabel = {
            'all': '',
            'manual': 'Pure ',
            'chat': 'Chat-Derived '
        }[currentMemoryFilter] || '';
        list.innerHTML = `<div class="empty-state">No ${filterLabel}Memories found.<br><span style="font-size:0.85rem;color:var(--color-gray-400)">${currentMemoryFilter === 'manual' ? 'Add a memory using the "Add Memory" button.' : currentMemoryFilter === 'chat' ? 'Chat-derived memories are saved when you confirm a memory during conversation.' : 'Add a memory or start a chat to create memories.'}</span></div>`;
        return;
    }

    filteredMemories.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
    });

    filteredMemories.forEach(memory => {
        const box = createMemoryBox(memory);
        list.appendChild(box);
    });
}

function createMemoryBox(memory) {
    const box = document.createElement('div');
    box.className = `item-box memory-item-box${memory.source === 'chat' ? ' memory-chat-derived' : ''}`;

    let mediaHtml = '';
    if (memory.mediaPath) {
        const ext = memory.mediaPath.split('.').pop().toLowerCase();
        if (['mp4', 'mov', 'webm'].includes(ext)) {
            mediaHtml = `<div class="item-media"><video src="${memory.mediaPath}" controls></video></div>`;
        } else {
            mediaHtml = `<div class="item-media"><img src="${memory.mediaPath}" alt="Memory"></div>`;
        }
    }

    const sourceLabel = memory.source === 'chat' ? 'Chat-Derived' : 'Pure Memory';
    const sourceBadgeClass = memory.source === 'chat' ? 'memory-badge-chat' : 'memory-badge-manual';
    const chatRefHtml = memory.source === 'chat' && memory.chatRef
        ? `<span class="memory-chat-ref" title="Chat message ID: ${escapeHtml(memory.chatRef)}">🔗 From chat</span>`
        : '';

    box.innerHTML = `
        ${mediaHtml}
        <div class="memory-card-top">
            <h3 class="item-title">${escapeHtml(memory.title)}</h3>
            <span class="memory-source-badge ${sourceBadgeClass}">${sourceLabel}</span>
        </div>
        <div class="item-meta">
            <span>📅 ${formatDate(memory.date)}</span>
            ${chatRefHtml}
        </div>
        ${memory.description ? `<p class="item-description">${escapeHtml(memory.description)}</p>` : ''}
        <div class="item-actions">
            <button class="text-button" onclick="editMemory('${memory.id}')">Edit</button>
            <button class="text-button delete" onclick="deleteMemory('${memory.id}')">Delete</button>
        </div>
    `;

    return box;
}

function initMemoryModal() {
    const addBtn = document.getElementById('add-memory-btn');
    const modal = document.getElementById('memory-modal');
    const closeBtn = document.getElementById('close-memory-modal');
    const cancelBtn = document.getElementById('cancel-memory');
    const form = document.getElementById('memory-form');

    addBtn.addEventListener('click', () => openMemoryModal());
    closeBtn.addEventListener('click', closeMemoryModal);
    cancelBtn.addEventListener('click', closeMemoryModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMemory();
    });

    // Memory filter toggle
    document.getElementById('memory-filter-toggle').querySelectorAll('.toggle-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            currentMemoryFilter = filter;
            document.getElementById('memory-filter-toggle').querySelectorAll('.toggle-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMemories();
        });
    });
}

function openMemoryModal(id = null) {
    const modal = document.getElementById('memory-modal');
    const title = document.getElementById('memory-modal-title');
    const form = document.getElementById('memory-form');

    form.reset();
    document.getElementById('memory-id').value = '';

    if (id) {
        const memory = memories.find(m => m.id === id);
        if (memory) {
            title.textContent = 'Edit Memory';
            document.getElementById('memory-id').value = memory.id;
            document.getElementById('memory-title').value = memory.title;
            document.getElementById('memory-date').value = memory.date || '';
            document.getElementById('memory-description').value = memory.description || '';
        }
    } else {
        title.textContent = 'Add Memory';
    }

    modal.classList.add('active');
}

function closeMemoryModal() {
    document.getElementById('memory-modal').classList.remove('active');
}

async function saveMemory() {
    const id = document.getElementById('memory-id').value;
    const title = document.getElementById('memory-title').value.trim();
    const date = document.getElementById('memory-date').value;
    const description = document.getElementById('memory-description').value;
    const mediaInput = document.getElementById('memory-media');

    // Validation
    if (!title) {
        alert('Please enter a Title.');
        return;
    }

    // Handle file upload
    let mediaPath = null;
    if (id) {
        const existing = memories.find(m => m.id === id);
        if (existing) mediaPath = existing.mediaPath;
    }

    if (mediaInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', mediaInput.files[0]);

        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                mediaPath = data.url;
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload media.');
            return;
        }
    }

    const newMemory = {
        id: id || generateUUID(),
        title,
        date,
        description,
        mediaPath,
        source: id ? (memories.find(m => m.id === id)?.source || 'manual') : 'manual'
    };

    if (id) {
        const index = memories.findIndex(m => m.id === id);
        if (index !== -1) memories[index] = newMemory;
    } else {
        memories.push(newMemory);
    }

    await syncMemories();
    closeMemoryModal();
    renderMemories();
}

async function deleteMemory(id) {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    memories = memories.filter(m => m.id !== id);
    await syncMemories();
    renderMemories();
}

function editMemory(id) {
    openMemoryModal(id);
}

async function syncMemories() {
    try {
        await fetch('/api/memories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memories)
        });
    } catch (error) {
        console.error('Error syncing memories:', error);
    }
}

// ===================================
// FAMILY MODULE
// ===================================
async function loadFamily() {
    try {
        const response = await fetch('/api/family');
        if (response.ok) {
            family = await response.json();
            if (!Array.isArray(family)) family = [];
            renderFamily();
        }
    } catch (error) {
        console.error('Error loading family:', error);
    }
}

function renderFamily() {
    const list = document.getElementById('family-list');
    list.innerHTML = '';

    if (family.length === 0) {
        list.innerHTML = '<div class="empty-state">No family members added yet.</div>';
        return;
    }

    family.forEach(member => {
        const box = createFamilyBox(member);
        list.appendChild(box);
    });
}

function createFamilyBox(member) {
    const box = document.createElement('div');
    box.className = 'item-box';

    const photoUrl = member.photo || '';
    const photoHtml = photoUrl
        ? `<img src="${photoUrl}" alt="${escapeHtml(member.name)}" class="family-photo">`
        : `<div class="family-photo placeholder">👤</div>`;

    box.innerHTML = `
        ${photoHtml}
        <h3 class="family-name">${escapeHtml(member.name)}</h3>
        <p class="family-relation">${escapeHtml(member.relation)}</p>
        ${member.phone ? `<p class="item-description">📞 ${escapeHtml(member.phone)}</p>` : ''}
        ${member.birthday ? `<p class="item-description">🎂 ${formatDate(member.birthday)}</p>` : ''}
        ${member.notes ? `<p class="item-description">${escapeHtml(member.notes)}</p>` : ''}
        <div class="item-actions">
            <button class="text-button" onclick="editFamily('${member.id}')">Edit</button>
            <button class="text-button delete" onclick="deleteFamily('${member.id}')">Delete</button>
        </div>
    `;

    return box;
}

function initFamilyModal() {
    const addBtn = document.getElementById('add-family-btn');
    const modal = document.getElementById('family-modal');
    const closeBtn = document.getElementById('close-family-modal');
    const cancelBtn = document.getElementById('cancel-family');
    const form = document.getElementById('family-form');

    addBtn.addEventListener('click', () => openFamilyModal());
    closeBtn.addEventListener('click', closeFamilyModal);
    cancelBtn.addEventListener('click', closeFamilyModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveFamily();
    });

    // Dynamic list buttons
    document.getElementById('add-activity').addEventListener('click', () => {
        addDynamicItem('family-activities-list', 'activity');
    });

    document.getElementById('add-date').addEventListener('click', () => {
        addDynamicItem('family-dates-list', 'date');
    });
}

function openFamilyModal(id = null) {
    const modal = document.getElementById('family-modal');
    const title = document.getElementById('family-modal-title');
    const form = document.getElementById('family-form');

    form.reset();
    document.getElementById('family-id').value = '';
    document.getElementById('family-activities-list').innerHTML = '';
    document.getElementById('family-dates-list').innerHTML = '';

    if (id) {
        const member = family.find(f => f.id === id);
        if (member) {
            title.textContent = 'Edit Family Member';
            document.getElementById('family-id').value = member.id;
            document.getElementById('family-name').value = member.name;
            document.getElementById('family-relation').value = member.relation;
            document.getElementById('family-photo').value = member.photo || '';
            document.getElementById('family-birthday').value = member.birthday || '';
            document.getElementById('family-phone').value = member.phone || '';
            document.getElementById('family-address').value = member.address || '';
            document.getElementById('family-notes').value = member.notes || '';

            // Populate activities
            if (member.activities && member.activities.length > 0) {
                member.activities.forEach(activity => {
                    addDynamicItem('family-activities-list', 'activity', activity);
                });
            }

            // Populate dates
            if (member.importantDates && member.importantDates.length > 0) {
                member.importantDates.forEach(date => {
                    addDynamicItem('family-dates-list', 'date', date);
                });
            }
        }
    } else {
        title.textContent = 'Add Family Member';
    }

    modal.classList.add('active');
}

function closeFamilyModal() {
    document.getElementById('family-modal').classList.remove('active');
}

function addDynamicItem(listId, type, value = '') {
    const list = document.getElementById(listId);
    const item = document.createElement('div');
    item.className = 'dynamic-item';

    const inputType = type === 'date' ? 'date' : 'text';
    const placeholder = type === 'activity' ? 'e.g. Gardening' : '';

    item.innerHTML = `
        <input type="${inputType}" value="${value}" placeholder="${placeholder}">
        <button type="button" class="remove-item-button" onclick="this.parentElement.remove()">Remove</button>
    `;

    list.appendChild(item);
}

async function saveFamily() {
    const id = document.getElementById('family-id').value;
    const name = document.getElementById('family-name').value.trim();
    const relation = document.getElementById('family-relation').value.trim();
    const photo = document.getElementById('family-photo').value.trim();
    const birthday = document.getElementById('family-birthday').value;
    const phone = document.getElementById('family-phone').value.trim();
    const address = document.getElementById('family-address').value.trim();
    const notes = document.getElementById('family-notes').value.trim();

    // Validation
    if (!name) {
        alert('Please enter a Name.');
        return;
    }
    if (!relation) {
        alert('Please enter a Relation.');
        return;
    }

    // Collect activities
    const activities = Array.from(document.querySelectorAll('#family-activities-list input'))
        .map(input => input.value.trim())
        .filter(v => v);

    // Collect important dates
    const importantDates = Array.from(document.querySelectorAll('#family-dates-list input'))
        .map(input => input.value)
        .filter(v => v);

    const newMember = {
        id: id || generateUUID(),
        name,
        relation,
        photo,
        birthday,
        phone,
        address,
        notes,
        activities,
        importantDates
    };

    if (id) {
        const index = family.findIndex(f => f.id === id);
        if (index !== -1) family[index] = newMember;
    } else {
        family.push(newMember);
    }

    await syncFamily();
    closeFamilyModal();
    renderFamily();
}

async function deleteFamily(id) {
    if (!confirm('Are you sure you want to delete this family member?')) return;
    family = family.filter(f => f.id !== id);
    await syncFamily();
    renderFamily();
}

function editFamily(id) {
    openFamilyModal(id);
}

async function syncFamily() {
    try {
        await fetch('/api/family', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(family)
        });
    } catch (error) {
        console.error('Error syncing family:', error);
    }
}

// ===================================
// CHAT MODULE
// ===================================
function initChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-button');
    const clearBtn = document.getElementById('clear-chat-btn');
    const saveBtn = document.getElementById('save-chat-btn');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearChat);
    }
}

async function clearChat() {
    if (confirm('Are you sure you want to clear the conversation history?')) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            addChatMessage('History cleared.', 'ai');
        }
    }
}

async function saveChat() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageElements = messagesContainer.querySelectorAll('.message');
    const messages = Array.from(messageElements).map(el => {
        const isUser = el.classList.contains('user-message');
        const text = el.querySelector('p').textContent;
        const time = el.querySelector('.message-time').textContent;
        return {
            timestamp: time,
            sender: isUser ? 'User' : 'Aegis AI',
            content: text
        };
    });

    if (messages.length === 0) {
        alert('No messages to save!');
        return;
    }

    try {
        const response = await fetch('/api/save-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages)
        });

        if (response.ok) {
            alert('Chat saved successfully!');
        } else {
            throw new Error('Failed to save chat');
        }
    } catch (error) {
        console.error('Error saving chat:', error);
        alert('Error saving chat. Please try again.');
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    input.disabled = true;
    document.getElementById('send-button').disabled = true;

    addChatMessage(message, 'user');
    input.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error('Failed to get response');
        }

        const data = await response.json();

        // Store the user chat message ID so it can be used as chatRef if the user
        // confirms saving a memory derived from this conversation exchange.
        if (data.chat_message_id) {
            lastChatMessageId = data.chat_message_id;
        }

        setTimeout(() => {
            addChatMessage(data.message, 'ai');

            // Show a subtle indicator in chat when the AI resurfaces a stored memory
            if (data.memory_actions && data.memory_actions.surfaced_memory) {
                addMemorySurfacedIndicator(data.memory_actions.surfaced_memory, data.memory_actions.surfacing_mode);
            }

            // Double Mention Rule: AI detected a repeated topic and suggests saving it
            if (data.memory_to_confirm && data.memory_to_confirm.title) {
                // Small delay so the AI message is visible first before the modal appears
                setTimeout(() => openMemoryConfirmModal(data.memory_to_confirm), 800);
            } else if (data.extracted_data && data.extracted_data.memories && data.extracted_data.memories.length > 0) {
                // Fallback: extracted memories from AI (legacy path)
                const memory = data.extracted_data.memories[0];
                if (typeof memory === 'object' && memory.title) {
                    setTimeout(() => openMemoryConfirmModal(memory), 800);
                }
            }
        }, 500);

    } catch (error) {
        console.error('Error:', error);
        setTimeout(() => {
            addChatMessage('Sorry, I encountered an error. Please make sure the server is running!', 'ai');
        }, 500);
    } finally {
        input.disabled = false;
        document.getElementById('send-button').disabled = false;
        input.focus();
    }
}

function addChatMessage(text, sender) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    const messageText = document.createElement('p');
    messageText.textContent = text;

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = getCurrentTime();

    content.appendChild(messageText);
    content.appendChild(time);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Shows a subtle inline indicator in the chat when the AI resurfaces a stored memory.
 * This is a non-intrusive UI hint — it does not require user action.
 */
function addMemorySurfacedIndicator(memoryTitle, surfacingMode) {
    const messagesContainer = document.getElementById('chat-messages');
    const modeIcon = { echo: '💭', soft_reminder: '🔔', invitation: '✨' }[surfacingMode] || '📌';
    const modeLabel = {
        echo: 'echoing a theme',
        soft_reminder: 'gentle reminder',
        invitation: 'invitation'
    }[surfacingMode] || 'resurfaced';

    const indicator = document.createElement('div');
    indicator.className = 'memory-surfaced-indicator';
    indicator.innerHTML = `
        <span class="msi-icon">${modeIcon}</span>
        <span class="msi-text">Memory resurfaced: <strong>${escapeHtml(memoryTitle)}</strong></span>
        <span class="msi-mode">${escapeHtml(modeLabel)}</span>
    `;
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Auto-fade after 8 seconds
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 600);
    }, 8000);
}

// Memory Confirmation Logic
let pendingMemory = null;
let lastChatMessageId = null; // Tracks the ID of the most recent user chat message

function openMemoryConfirmModal(memory) {
    pendingMemory = memory;
    const content = document.getElementById('memory-confirm-content');
    content.innerHTML = `
        <strong>Title:</strong> ${escapeHtml(memory.title)}<br>
        <strong>Description:</strong> ${escapeHtml(memory.description || 'No description provided')}
    `;
    document.getElementById('memory-confirm-modal').classList.add('active');

    // Set up confirm button
    const confirmBtn = document.getElementById('confirm-save-memory-btn');
    confirmBtn.onclick = () => confirmSaveMemory(memory);
}

function closeMemoryConfirmModal() {
    document.getElementById('memory-confirm-modal').classList.remove('active');
    pendingMemory = null;
}

async function confirmSaveMemory(memory) {
    // Use the dedicated chat-memory endpoint to keep chat.json and memories.json cleanly separated.
    // Only a structured entry (with source='chat' and chatRef to the message) goes into memories.json.
    // The raw chat message remains untouched in chat.json.
    try {
        const payload = {
            title: memory.title,
            date: memory.date || new Date().toISOString().split('T')[0],
            description: memory.description || '',
            chatRef: lastChatMessageId // Reference to the originating chat message ID
        };

        const response = await fetch('/api/save-memory-from-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            // Add saved memory to local state
            memories.push(data.memory);
        } else {
            // Fallback: add locally and sync via generic endpoint
            memories.push({
                id: generateUUID(),
                title: memory.title,
                date: memory.date || new Date().toISOString().split('T')[0],
                description: memory.description || '',
                source: 'chat',
                chatRef: lastChatMessageId
            });
            await syncMemories();
        }
    } catch (err) {
        console.error('Error saving chat-derived memory:', err);
    }

    closeMemoryConfirmModal();
    renderMemories();
    renderHomeTab();

    // Add feedback in chat
    addChatMessage('I\'ve saved that memory for you! You can view it in the Memories tab.', 'ai');
}

// ===================================
// PROFILE MODULE
// ===================================

// In-memory state for dynamic lists
let emergencyContacts = [];
let doctors = [];

/**
 * Render one emergency contact card into the list container.
 * index = position in emergencyContacts array.
 */
function renderEmergencyContactCard(contact, index) {
    const card = document.createElement('div');
    card.className = 'profile-entry-card';
    card.dataset.index = index;
    card.innerHTML = `
        <div class="profile-entry-header">
            <span class="profile-entry-label">Contact ${index + 1}</span>
            <button type="button" class="text-button delete" onclick="removeEmergencyContact(${index})">Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" class="ec-name" value="${escapeHtml(contact.name || '')}" placeholder="E.g. Jane Doe" required>
            </div>
            <div class="form-group">
                <label>Relation *</label>
                <input type="text" class="ec-relation" value="${escapeHtml(contact.relation || '')}" placeholder="E.g. Daughter" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Phone</label>
                <input type="tel" class="ec-phone" value="${escapeHtml(contact.phone || '')}" placeholder="E.g. 555-0199">
            </div>
            <div class="form-group">
                <label>Address</label>
                <input type="text" class="ec-address" value="${escapeHtml(contact.address || '')}" placeholder="E.g. 45 Oak Ave">
            </div>
        </div>
    `;
    return card;
}

function renderAllEmergencyContacts() {
    const list = document.getElementById('emergency-contacts-list');
    list.innerHTML = '';
    if (emergencyContacts.length === 0) {
        list.innerHTML = '<p class="profile-entry-empty">No emergency contacts added yet.</p>';
        return;
    }
    emergencyContacts.forEach((c, i) => list.appendChild(renderEmergencyContactCard(c, i)));
}

function addEmergencyContact() {
    emergencyContacts.push({ name: '', relation: '', phone: '', address: '' });
    renderAllEmergencyContacts();
    // Focus the first input of the new card
    const cards = document.querySelectorAll('#emergency-contacts-list .profile-entry-card');
    const lastCard = cards[cards.length - 1];
    if (lastCard) lastCard.querySelector('.ec-name').focus();
}

// Pending callback for the delete confirmation modal
let deleteEntryPendingCallback = null;

/**
 * Open the custom delete confirmation modal.
 * @param {string} entryLabel  - Description shown in the modal (e.g. "Contact 1")
 * @param {Function} onConfirm - Called when user confirms
 */
function openDeleteEntryModal(entryLabel, onConfirm) {
    deleteEntryPendingCallback = onConfirm;
    document.getElementById('delete-entry-message').textContent =
        `Are you sure you want to remove "${entryLabel}"? This cannot be undone.`;
    document.getElementById('delete-entry-modal').classList.add('active');

    const btn = document.getElementById('confirm-delete-entry-btn');
    btn.onclick = () => {
        cancelDeleteEntry();
        if (deleteEntryPendingCallback) deleteEntryPendingCallback();
        deleteEntryPendingCallback = null;
    };
}

function cancelDeleteEntry() {
    document.getElementById('delete-entry-modal').classList.remove('active');
    deleteEntryPendingCallback = null;
}

function removeEmergencyContact(index) {
    const label = `Contact ${index + 1}`;
    openDeleteEntryModal(label, () => {
        emergencyContacts.splice(index, 1);
        renderAllEmergencyContacts();
        showToast('Entry deleted successfully.', 'info');
    });
}

/**
 * Render one doctor card into the doctors list container.
 */
function renderDoctorCard(doctor, index) {
    const card = document.createElement('div');
    card.className = 'profile-entry-card';
    card.dataset.index = index;
    card.innerHTML = `
        <div class="profile-entry-header">
            <span class="profile-entry-label">Doctor / Provider ${index + 1}</span>
            <button type="button" class="text-button delete" onclick="removeDoctor(${index})">Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" class="doc-name" value="${escapeHtml(doctor.name || '')}" placeholder="E.g. Dr. Sarah Lee" required>
            </div>
            <div class="form-group">
                <label>Specialty / Role</label>
                <input type="text" class="doc-specialty" value="${escapeHtml(doctor.specialty || '')}" placeholder="E.g. Cardiologist">
            </div>
        </div>
        <div class="form-group">
            <label>Contact Number</label>
            <input type="tel" class="doc-phone" value="${escapeHtml(doctor.phone || '')}" placeholder="E.g. 555-0200">
        </div>
    `;
    return card;
}

function renderAllDoctors() {
    const list = document.getElementById('doctors-list');
    list.innerHTML = '';
    if (doctors.length === 0) {
        list.innerHTML = '<p class="profile-entry-empty">No doctors added yet.</p>';
        return;
    }
    doctors.forEach((d, i) => list.appendChild(renderDoctorCard(d, i)));
}

function addDoctor() {
    doctors.push({ name: '', specialty: '', phone: '' });
    renderAllDoctors();
    const cards = document.querySelectorAll('#doctors-list .profile-entry-card');
    const lastCard = cards[cards.length - 1];
    if (lastCard) lastCard.querySelector('.doc-name').focus();
}

function removeDoctor(index) {
    const label = `Doctor / Provider ${index + 1}`;
    openDeleteEntryModal(label, () => {
        doctors.splice(index, 1);
        renderAllDoctors();
        showToast('Entry deleted successfully.', 'info');
    });
}

/**
 * Read the current state of dynamic lists from the DOM inputs.
 */
function readEmergencyContactsFromDOM() {
    const cards = document.querySelectorAll('#emergency-contacts-list .profile-entry-card');
    return Array.from(cards).map(card => ({
        name: card.querySelector('.ec-name').value.trim(),
        relation: card.querySelector('.ec-relation').value.trim(),
        phone: card.querySelector('.ec-phone').value.trim(),
        address: card.querySelector('.ec-address').value.trim()
    })).filter(c => c.name); // drop empty
}

function readDoctorsFromDOM() {
    const cards = document.querySelectorAll('#doctors-list .profile-entry-card');
    return Array.from(cards).map(card => ({
        name: card.querySelector('.doc-name').value.trim(),
        specialty: card.querySelector('.doc-specialty').value.trim(),
        phone: card.querySelector('.doc-phone').value.trim()
    })).filter(d => d.name); // drop empty
}

/**
 * Apply theme CSS class to body based on selection.
 */
function applyTheme(theme) {
    document.body.classList.remove('theme-ocean', 'theme-forest');
    if (theme === 'ocean') document.body.classList.add('theme-ocean');
    if (theme === 'forest') document.body.classList.add('theme-forest');
}

async function loadProfile() {
    try {
        const response = await fetch('/api/profile');
        if (response.ok) {
            const profile = await response.json();

            // Basic fields
            document.getElementById('profile-name').value = profile.name || '';
            document.getElementById('profile-age').value = profile.age || '';
            document.getElementById('profile-gender').value = profile.gender || '';
            document.getElementById('profile-address').value = profile.address || '';

            // Medical
            document.getElementById('profile-medical').value = profile.medical_conditions || '';

            // Personal
            document.getElementById('profile-hobbies').value = profile.hobbies || '';
            document.getElementById('profile-notes').value = profile.notes || '';

            // Preferences
            document.getElementById('profile-voice-speed').value = profile.preferences?.voice_speed || 'normal';
            document.getElementById('profile-font-size').value = profile.preferences?.font_size || 'normal';
            document.getElementById('profile-theme').value = profile.preferences?.theme || 'default';
            applyTheme(profile.preferences?.theme || 'default');

            // Dynamic lists: load from new schema (arrays) or migrate old single string
            if (Array.isArray(profile.emergency_contacts)) {
                emergencyContacts = profile.emergency_contacts;
            } else if (profile.emergency_contact) {
                // Migrate legacy single-string field
                emergencyContacts = [{ name: profile.emergency_contact, relation: '', phone: '', address: '' }];
            } else {
                emergencyContacts = [];
            }
            renderAllEmergencyContacts();

            doctors = Array.isArray(profile.doctors) ? profile.doctors : [];
            renderAllDoctors();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function initProfile() {
    const form = document.getElementById('profile-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
    });

    document.getElementById('add-emergency-contact-btn').addEventListener('click', addEmergencyContact);
    document.getElementById('add-doctor-btn').addEventListener('click', addDoctor);

    // Apply theme live AND play the transition animation when dropdown changes
    document.getElementById('profile-theme').addEventListener('change', (e) => {
        applyTheme(e.target.value);
        playThemeAnimation(e.target.value);
    });

    // Floating save button: become translucent while scrolling
    const floatingBtn = document.getElementById('floating-save-profile-btn');
    if (floatingBtn) {
        let scrollTimer = null;
        document.addEventListener('scroll', () => {
            floatingBtn.classList.add('fsb-scrolling');
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                floatingBtn.classList.remove('fsb-scrolling');
            }, 500);
        }, { passive: true });
    }
}

async function saveProfile() {
    const profileData = {
        name: document.getElementById('profile-name').value.trim(),
        age: document.getElementById('profile-age').value,
        gender: document.getElementById('profile-gender').value,
        address: document.getElementById('profile-address').value.trim(),
        medical_conditions: document.getElementById('profile-medical').value.trim(),
        hobbies: document.getElementById('profile-hobbies').value.trim(),
        notes: document.getElementById('profile-notes').value.trim(),
        emergency_contacts: readEmergencyContactsFromDOM(),
        doctors: readDoctorsFromDOM(),
        preferences: {
            voice_speed: document.getElementById('profile-voice-speed').value,
            font_size: document.getElementById('profile-font-size').value,
            theme: document.getElementById('profile-theme').value
        }
    };

    // Sync in-memory state from DOM
    emergencyContacts = profileData.emergency_contacts;
    doctors = profileData.doctors;

    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            applyTheme(profileData.preferences.theme);
            showToast('Profile saved successfully!', 'success');
        } else {
            throw new Error('Failed to save');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Error saving profile. Please try again.', 'error');
    }
}

// ===================================
// NOTES MODULE  (full CRUD)
// ===================================
let notes = [];

async function loadNotes() {
    try {
        const resp = await fetch('/api/notes');
        if (resp.ok) notes = await resp.json();
        if (!Array.isArray(notes)) notes = [];
    } catch (e) { console.error('Error loading notes:', e); }
}

// ---- Notes Tab Renderer ----
function renderNotesTab() {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="notes-empty">
                <div class="notes-empty-icon">📝</div>
                <p>No notes yet. Click <strong>+ New Note</strong> to get started.</p>
            </div>`;
        return;
    }

    // Most recent first
    const sorted = [...notes].reverse();
    grid.innerHTML = sorted.map(note => {
        const preview = (note.content || '').slice(0, 120).replace(/\n/g, ' ');
        const hasMore = (note.content || '').length > 120;
        const d = note.created_at
            ? new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
        return `
        <div class="note-card" data-id="${escapeHtml(note.id)}">
            <div class="note-card-header">
                <span class="note-card-title">${escapeHtml(note.title || 'Untitled Note')}</span>
                <div class="note-card-actions">
                    <button class="text-button" onclick="openNoteEditor('${escapeHtml(note.id)}')">Edit</button>
                    <button class="text-button danger" onclick="deleteNote('${escapeHtml(note.id)}')">Delete</button>
                </div>
            </div>
            ${preview ? `<div class="note-card-body">${escapeHtml(preview)}${hasMore ? '…' : ''}</div>` : ''}
            ${d ? `<div class="note-card-date">${d}</div>` : ''}
        </div>`;
    }).join('');
}

// ---- Home tab preview ----
function renderHomeNotes() {
    const container = document.getElementById('home-notes-preview');
    if (!container) return;

    if (notes.length === 0) {
        container.innerHTML = `
            <div class="qn-empty">
                <div class="qn-empty-icon">📝</div>
                <p>Want to remember something for later?</p>
                <button class="qn-prompt-btn" onclick="openNoteEditor()">Write a note</button>
            </div>`;
        return;
    }

    const recent = [...notes].reverse().slice(0, 2);
    container.innerHTML = recent.map(note => {
        const firstLine = (note.content || '').split('\n')[0].slice(0, 72);
        const preview = firstLine + ((note.content || '').length > 72 ? '…' : '');
        const d = note.created_at
            ? new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
        return `
            <div class="qn-preview-item" onclick="switchTab('notes')">
                <div class="qn-preview-title">${escapeHtml(note.title || 'Untitled Note')}</div>
                ${preview ? `<div class="qn-preview-text">${escapeHtml(preview)}</div>` : ''}
                ${d ? `<div class="qn-preview-date">${d}</div>` : ''}
            </div>`;
    }).join('');
}

// ---- Note Editor (create + edit) ----
function openNoteEditor(noteId) {
    const isEdit = !!noteId;
    document.getElementById('note-editor-title').textContent = isEdit ? '✏️ Edit Note' : '✏️ New Note';
    document.getElementById('note-editor-id').value = noteId || '';

    if (isEdit) {
        const note = notes.find(n => n.id === noteId);
        document.getElementById('note-editor-name').value = note ? note.title : '';
        document.getElementById('note-editor-body').value = note ? note.content : '';
    } else {
        document.getElementById('note-editor-name').value = '';
        document.getElementById('note-editor-body').value = '';
    }

    document.getElementById('note-editor-modal').classList.add('active');
    setTimeout(() => document.getElementById('note-editor-name').focus(), 80);
}

function closeNoteEditor() {
    document.getElementById('note-editor-modal').classList.remove('active');
}

async function saveNoteFromEditor() {
    const id = document.getElementById('note-editor-id').value.trim();
    const title = document.getElementById('note-editor-name').value.trim();
    const content = document.getElementById('note-editor-body').value.trim();

    if (!title) {
        showToast('Please add a title before saving.', 'info');
        document.getElementById('note-editor-name').focus();
        return;
    }

    try {
        if (id) {
            // EDIT: update locally then bulk-sync
            const idx = notes.findIndex(n => n.id === id);
            if (idx !== -1) {
                notes[idx] = { ...notes[idx], title, content };
            }
            await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notes)   // bulk replace
            });
            showToast('Note updated!', 'success');
        } else {
            // CREATE
            const resp = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            if (!resp.ok) throw new Error('Create failed');
            const data = await resp.json();
            notes.push(data.note);
            showToast('Note saved!', 'success');
        }

        closeNoteEditor();
        renderNotesTab();
        renderHomeNotes();
    } catch (err) {
        console.error('Error saving note:', err);
        showToast('Could not save note. Please try again.', 'error');
    }
}

function deleteNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    const label = note ? `"${note.title || 'Untitled Note'}"` : 'this note';
    openDeleteEntryModal(label, async () => {
        notes = notes.filter(n => n.id !== noteId);
        try {
            await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notes)   // bulk replace
            });
            showToast('Note deleted.', 'info');
        } catch (e) {
            console.error('Error deleting note:', e);
        }
        renderNotesTab();
        renderHomeNotes();
    });
}

// ---- Quick note shortcut (from Home card ＋ button) ----
function openQuickNoteModal(e) {
    if (e) e.stopPropagation();
    openNoteEditor(); // reuse full editor
}

function closeQuickNoteModal() { closeNoteEditor(); }
async function saveQuickNote(e) {
    if (e) e.preventDefault();
    await saveNoteFromEditor();
}

function initNotes() {
    const btn = document.getElementById('new-note-btn');
    if (btn) btn.addEventListener('click', () => openNoteEditor());
}


// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initRoutineModal();
    initMemoryModal();
    initFamilyModal();
    initChat();
    initProfile();
    initNotes();

    await loadRoutines();
    await loadMemories();
    await loadFamily();
    await loadProfile();
    await loadNotes();

    // Hide floating save button initially (not on profile tab at startup)
    const floatSave = document.getElementById('floating-save-profile-btn');
    if (floatSave) floatSave.style.display = 'none';

    // Render Home tab dashboard
    renderHomeTab();
});
