// ===================================
// GLOBAL STATE
// ===================================
let routines = [];
let memories = [];
let family = [];
let currentRoutineView = 'today';
let currentMemoryFilter = 'all';
let themeAnimRAF = null; // requestAnimationFrame handle for theme animations

// ── i18n state ──────────────────────────────────────────────
let currentAppLang = 'en';       // active language code
let selectedSpokenLangs = [];    // array of language name strings

/**
 * Apply UI translations for the given language code.
 * Walks all [data-i18n] elements and replaces text.
 * Sets html[dir] for RTL languages.
 */
function applyTranslation(lang) {
    currentAppLang = lang || 'en';
    const dict = TRANSLATIONS[currentAppLang] || TRANSLATIONS.en;

    // Replace all tagged static elements (text content)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) el.textContent = dict[key];
    });

    // Replace placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key] !== undefined) el.placeholder = dict[key];
    });

    // Replace title attributes (e.g. tooltip on the + quick-note button)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key] !== undefined) el.title = dict[key];
    });

    // RTL for Arabic
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    // Re-render dynamic content so JS-generated strings also update
    if (typeof renderRoutines === 'function') renderRoutines();
    if (typeof renderMemories === 'function') renderMemories();
    if (typeof renderFamily === 'function') renderFamily();
    if (typeof renderNotesTab === 'function') renderNotesTab();
    if (typeof renderAllEmergencyContacts === 'function') renderAllEmergencyContacts();
    if (typeof renderAllDoctors === 'function') renderAllDoctors();
    if (typeof renderHomeTab === 'function') renderHomeTab();

    // Update chat placeholder directly (in case it has no data-i18n-placeholder yet)
    const chatInput = document.getElementById('chat-input');
    if (chatInput && dict.chat_placeholder) chatInput.placeholder = dict.chat_placeholder;

    // Update floating save button label
    const fsbLabel = document.querySelector('#floating-save-profile-btn .fsb-label');
    if (fsbLabel && dict.profile_save_label) fsbLabel.textContent = dict.profile_save_label;
}


/**
 * Render the language chip multi-select grid and restore selections.
 */
function initLangChipGrid(selectedLangs) {
    const grid = document.getElementById('languages-spoken-grid');
    if (!grid) return;
    grid.innerHTML = '';
    ALL_SPOKEN_LANGUAGES.forEach(lang => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'lang-chip' + (selectedLangs.includes(lang) ? ' selected' : '');
        chip.innerHTML = `<span class="chip-check">✓</span>${lang}`;
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });
        grid.appendChild(chip);
    });
}

/**
 * Read which language chips are currently selected.
 */
function getSelectedSpokenLangs() {
    const grid = document.getElementById('languages-spoken-grid');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('.lang-chip.selected'))
        .map(c => c.textContent.replace('✓', '').trim());
}

/**
 * Populate the App Language single-select dropdown.
 */
function initAppLanguageDropdown(selectedCode) {
    const sel = document.getElementById('profile-app-language');
    if (!sel || typeof SUPPORTED_APP_LANGUAGES === 'undefined') return;
    sel.innerHTML = SUPPORTED_APP_LANGUAGES.map(l =>
        `<option value="${l.code}" ${l.code === selectedCode ? 'selected' : ''}>${l.name}</option>`
    ).join('');
}


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
    if (!days || days.length === 0) return t('msg_no_days', currentAppLang);
    const dayMap = {
        'Mon': t('day_mon', currentAppLang), 'Tue': t('day_tue', currentAppLang), 'Wed': t('day_wed', currentAppLang), 'Thu': t('day_thu', currentAppLang),
        'Fri': t('day_fri', currentAppLang), 'Sat': t('day_sat', currentAppLang), 'Sun': t('day_sun', currentAppLang)
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
        container.innerHTML = `<div class="home-empty">${t('home_routines_empty', currentAppLang)}</div>`;
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
        container.innerHTML = `<div class="home-empty">${t('home_memories_empty', currentAppLang)}</div>`;
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
        container.innerHTML = `<div class="home-empty">${t('home_family_empty', currentAppLang)}</div>`;
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
        t('chat_greeting', currentAppLang),
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

    // Pre-load voice config when entering the chat tab
    if (tabName === 'chat') _initInlineVoice();
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
    if (!list) return;   // guard: element not yet in DOM
    list.innerHTML = '';

    let filteredRoutines = routines;

    if (currentRoutineView === 'today') {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        filteredRoutines = routines.filter(r => r.days && r.days.includes(today));
    }

    // Safe sort — treat missing time as '00:00'
    filteredRoutines.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));


    if (filteredRoutines.length === 0) {
        list.innerHTML = `<div class="empty-state">${t(currentRoutineView === 'today' ? 'routines_empty_today' : 'routines_empty_all', currentAppLang)}</div>`;
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
                ${isCompleted ? t('btn_completed', currentAppLang) : t('btn_mark_done', currentAppLang)}
            </button>
            <button class="text-button" onclick="toggleRoutinePause('${routine.id}')">
                ${isPaused ? t('btn_resume', currentAppLang) : t('btn_pause', currentAppLang)}
            </button>
            <button class="text-button" onclick="editRoutine('${routine.id}')">${t('btn_edit', currentAppLang)}</button>
            <button class="text-button delete" onclick="deleteRoutine('${routine.id}')">${t('btn_delete', currentAppLang)}</button>
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
            title.textContent = t('modal_edit_routine', currentAppLang);
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
        title.textContent = t('modal_add_routine', currentAppLang);
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

function deleteRoutine(id) {
    const routine = routines.find(r => r.id === id);
    const label = routine ? `"${routine.title || 'this routine'}"` : 'this routine';
    openDeleteEntryModal(label, async () => {
        routines = routines.filter(r => r.id !== id);
        await syncRoutines();
        renderRoutines();
        showToast(t('msg_deleted', currentAppLang), 'info');
    });
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
        const emptyKey = currentMemoryFilter === 'manual' ? 'memories_empty_manual' : currentMemoryFilter === 'chat' ? 'memories_empty_chat' : 'memories_empty_all';
        list.innerHTML = `<div class="empty-state">${t(emptyKey, currentAppLang)}</div>`;
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

    const sourceLabel = memory.source === 'chat' ? t('mem_label_chat', currentAppLang) : t('mem_label_pure', currentAppLang);
    const sourceBadgeClass = memory.source === 'chat' ? 'memory-badge-chat' : 'memory-badge-manual';
    const dateStr = memory.date ? formatDate(memory.date) : t('msg_no_date', currentAppLang);
    const chatRefHtml = memory.source === 'chat' && memory.chatRef
        ? `<span class="memory-chat-ref" title="Chat message ID: ${escapeHtml(memory.chatRef)}">🔗 ${t('mem_label_from_chat', currentAppLang)}</span>`
        : '';

    box.innerHTML = `
        ${mediaHtml}
        <div class="memory-card-top">
            <h3 class="item-title">${escapeHtml(memory.title)}</h3>
            <span class="memory-source-badge ${sourceBadgeClass}">${sourceLabel}</span>
        </div>
        <div class="item-meta">
            <span>📅 ${dateStr}</span>
            ${chatRefHtml}
        </div>
        ${memory.description ? `<p class="item-description">${escapeHtml(memory.description)}</p>` : ''}
        <div class="item-actions">
            <button class="text-button" onclick="editMemory('${memory.id}')">${t('btn_edit', currentAppLang)}</button>
            <button class="text-button delete" onclick="deleteMemory('${memory.id}')">${t('btn_delete', currentAppLang)}</button>
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
            title.textContent = t('modal_edit_memory', currentAppLang);
            document.getElementById('memory-id').value = memory.id;
            document.getElementById('memory-title').value = memory.title;
            document.getElementById('memory-date').value = memory.date || '';
            document.getElementById('memory-description').value = memory.description || '';
        }
    } else {
        title.textContent = t('modal_add_memory', currentAppLang);
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

function deleteMemory(id) {
    const memory = memories.find(m => m.id === id);
    const label = memory ? `"${memory.title || 'this memory'}"` : 'this memory';
    openDeleteEntryModal(label, async () => {
        memories = memories.filter(m => m.id !== id);
        await syncMemories();
        renderMemories();
        showToast(t('msg_deleted', currentAppLang), 'info');
    });
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
        list.innerHTML = `<div class="empty-state">${t('family_empty_list', currentAppLang)}</div>`;
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
            <button class="text-button" onclick="editFamily('${member.id}')">${t('btn_edit', currentAppLang)}</button>
            <button class="text-button delete" onclick="deleteFamily('${member.id}')">${t('btn_delete', currentAppLang)}</button>
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
            title.textContent = t('modal_edit_family', currentAppLang);
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
        title.textContent = t('modal_add_family', currentAppLang);
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

function deleteFamily(id) {
    const member = family.find(f => f.id === id);
    const label = member ? `"${member.name || 'this family member'}"` : 'this family member';
    openDeleteEntryModal(label, async () => {
        family = family.filter(f => f.id !== id);
        await syncFamily();
        renderFamily();
        showToast(t('msg_deleted', currentAppLang), 'info');
    });
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
    // save-chat-btn was removed from HTML in the voice-first redesign — safe to skip

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    if (clearBtn) clearBtn.addEventListener('click', clearChat);
}


async function clearChat() {
    if (confirm('Are you sure you want to clear the conversation history?')) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            addChatMessage('History cleared.', 'ai');
        }
        // Also clear the inline voice transcript
        _clearInlineTranscript();
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
    if (!messagesContainer) return;   // voice mode — chat-messages may not be visible

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
    if (!messagesContainer) return;   // voice mode — skip silently

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
        list.innerHTML = `<p class="profile-entry-empty">${t('contacts_empty', currentAppLang)}</p>`;
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
    document.getElementById('delete-entry-message').innerHTML =
        t('confirm_delete', currentAppLang).replace('{0}', escapeHtml(entryLabel));
    document.getElementById('delete-entry-modal').classList.add('active');

    const btn = document.getElementById('confirm-delete-entry-btn');
    btn.onclick = () => {
        const cb = deleteEntryPendingCallback; // capture BEFORE cancelDeleteEntry nulls it
        cancelDeleteEntry();
        if (cb) cb();
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
        list.innerHTML = `<p class="profile-entry-empty">${t('doctors_empty', currentAppLang)}</p>`;
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
    // Use data-theme attribute so CSS variable overrides work
    const t = theme || 'default';
    document.documentElement.setAttribute('data-theme', t);
    // Legacy class support (theme-anim-canvas etc.)
    document.body.classList.remove('theme-ocean', 'theme-forest');
    if (t === 'ocean') document.body.classList.add('theme-ocean');
    if (t === 'forest') document.body.classList.add('theme-forest');
}

async function loadProfile() {
    try {
        const response = await fetch('/api/profile');
        if (response.ok) {
            const profile = await response.json();

            // Identity & Context
            document.getElementById('profile-preferred-name').value = profile.preferred_name || '';
            document.getElementById('profile-pronouns').value = profile.pronouns || '';
            document.getElementById('profile-cultural-bg').value = profile.cultural_bg || '';

            // Language fields
            const savedSpoken = Array.isArray(profile.languages_spoken) ? profile.languages_spoken : [];
            const savedAppLang = profile.app_language || 'en';
            initLangChipGrid(savedSpoken);
            initAppLanguageDropdown(savedAppLang);
            // Apply translation immediately so page reflects saved language
            applyTranslation(savedAppLang);

            // Cognitive & Support Context
            document.getElementById('profile-memory-level').value = profile.memory_level || '';
            document.getElementById('profile-comfort-topics').value = profile.comfort_topics || '';
            document.getElementById('profile-avoid-topics').value = profile.avoid_topics || '';
            document.getElementById('profile-triggers').value = profile.triggers || '';

            // Daily Rhythm
            document.getElementById('profile-day-type').value = profile.day_type || '';
            document.getElementById('profile-reminder-style').value = profile.reminder_style || 'gentle';

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

            // Emotional Anchors
            document.getElementById('profile-important-people').value = profile.important_people || '';
            document.getElementById('profile-music-era').value = profile.music_era || '';
            document.getElementById('profile-favourite-place').value = profile.favourite_place || '';

            // Accessibility toggles
            document.getElementById('profile-high-contrast').checked = !!profile.accessibility?.high_contrast;
            document.getElementById('profile-reduced-motion').checked = !!profile.accessibility?.reduced_motion;
            document.getElementById('profile-tts').checked = !!profile.accessibility?.tts;

            // Apply accessibility settings live
            applyAccessibility(profile.accessibility || {});

            // Preferences
            document.getElementById('profile-voice-speed').value = profile.preferences?.voice_speed || 'normal';
            document.getElementById('profile-font-size').value = profile.preferences?.font_size || 'normal';
            document.getElementById('profile-theme').value = profile.preferences?.theme || 'default';
            applyTheme(profile.preferences?.theme || 'default');

            // Dynamic lists
            if (Array.isArray(profile.emergency_contacts)) {
                emergencyContacts = profile.emergency_contacts;
            } else if (profile.emergency_contact) {
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

    // Initialise language widgets with defaults (overwritten by loadProfile)
    initLangChipGrid([]);
    initAppLanguageDropdown('en');

    // Apply theme live AND play the transition animation when dropdown changes
    document.getElementById('profile-theme').addEventListener('change', (e) => {
        applyTheme(e.target.value);
        playThemeAnimation(e.target.value);
    });

    // Accessibility toggles — apply live
    document.getElementById('profile-high-contrast').addEventListener('change', () => applyAccessibilityFromForm());
    document.getElementById('profile-reduced-motion').addEventListener('change', () => applyAccessibilityFromForm());
    document.getElementById('profile-tts').addEventListener('change', () => applyAccessibilityFromForm());

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

function applyAccessibility(acc) {
    document.body.classList.toggle('high-contrast', !!acc.high_contrast);
    document.body.classList.toggle('reduced-motion', !!acc.reduced_motion);
}

function applyAccessibilityFromForm() {
    applyAccessibility({
        high_contrast: document.getElementById('profile-high-contrast').checked,
        reduced_motion: document.getElementById('profile-reduced-motion').checked,
    });
}

async function saveProfile() {
    const profileData = {
        // Identity & Context
        preferred_name: document.getElementById('profile-preferred-name').value.trim(),
        pronouns: document.getElementById('profile-pronouns').value,
        languages_spoken: getSelectedSpokenLangs(),
        app_language: document.getElementById('profile-app-language')?.value || 'en',
        cultural_bg: document.getElementById('profile-cultural-bg').value.trim(),

        // Cognitive & Support Context
        memory_level: document.getElementById('profile-memory-level').value,
        comfort_topics: document.getElementById('profile-comfort-topics').value.trim(),
        avoid_topics: document.getElementById('profile-avoid-topics').value.trim(),
        triggers: document.getElementById('profile-triggers').value.trim(),

        // Daily Rhythm
        day_type: document.getElementById('profile-day-type').value,
        reminder_style: document.getElementById('profile-reminder-style').value,

        // Basic
        name: document.getElementById('profile-name').value.trim(),
        age: document.getElementById('profile-age').value,
        gender: document.getElementById('profile-gender').value,
        address: document.getElementById('profile-address').value.trim(),
        medical_conditions: document.getElementById('profile-medical').value.trim(),
        hobbies: document.getElementById('profile-hobbies').value.trim(),
        notes: document.getElementById('profile-notes').value.trim(),

        // Emotional Anchors
        important_people: document.getElementById('profile-important-people').value.trim(),
        music_era: document.getElementById('profile-music-era').value.trim(),
        favourite_place: document.getElementById('profile-favourite-place').value.trim(),

        // Dynamic lists
        emergency_contacts: readEmergencyContactsFromDOM(),
        doctors: readDoctorsFromDOM(),

        // Accessibility
        accessibility: {
            high_contrast: document.getElementById('profile-high-contrast').checked,
            reduced_motion: document.getElementById('profile-reduced-motion').checked,
            tts: document.getElementById('profile-tts').checked,
        },

        // Display preferences
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
            applyAccessibility(profileData.accessibility);
            applyTranslation(profileData.app_language);  // switch UI language
            const savedMsg = t('profile_saved', profileData.app_language);
            showToast(savedMsg, 'success');
        } else {
            throw new Error('Failed to save');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast(t('profile_error', currentAppLang), 'error');
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
                <p>${t('notes_empty_list', currentAppLang)}</p>
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
                    <button class="text-button" onclick="openNoteEditor('${escapeHtml(note.id)}')">${t('btn_edit', currentAppLang)}</button>
                    <button class="text-button danger" onclick="deleteNote('${escapeHtml(note.id)}')">${t('btn_delete', currentAppLang)}</button>
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
                <button class="qn-prompt-btn" onclick="openNoteEditor()">${t('btn_write_note', currentAppLang)}</button>
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
            showToast(t('note_saved', currentAppLang), 'success');
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

    // The quick-note-modal has its own fields (qn-title, qn-content).
    // Read from them directly and POST to the API.
    const titleEl = document.getElementById('qn-title');
    const contentEl = document.getElementById('qn-content');
    const title = titleEl ? titleEl.value.trim() : '';
    const content = contentEl ? contentEl.value.trim() : '';

    if (!title) {
        showToast('Please add a title before saving.', 'info');
        if (titleEl) titleEl.focus();
        return;
    }

    try {
        const resp = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (!resp.ok) throw new Error('Save failed');
        const data = await resp.json();
        notes.push(data.note);
        // Clear fields and close modal
        if (titleEl) titleEl.value = '';
        if (contentEl) contentEl.value = '';
        closeQuickNoteModal();
        showToast(t('note_saved', currentAppLang), 'success');
        renderNotesTab();
        renderHomeNotes();
    } catch (err) {
        console.error('Error saving quick note:', err);
        showToast('Could not save note. Please try again.', 'error');
    }
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
    initVoiceCall();

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

// ===================================
// GEMINI LIVE API — VOICE MODULE
// ===================================

/**
 * GeminiLiveSession encapsulates the WebSocket connection, microphone
 * capture pipeline, and PCM audio playback for the Gemini Live API.
 *
 * Audio in:  16-bit PCM, 16 kHz mono (browser mic → Gemini)
 * Audio out: 16-bit PCM, 24 kHz mono (Gemini → browser speaker)
 */
class GeminiLiveSession {
    constructor({ apiKey, systemPrompt, onStatus, onTranscript, onStateChange }) {
        this.apiKey = apiKey;
        this.systemPrompt = systemPrompt;
        this.onStatus = onStatus || (() => { });
        this.onTranscript = onTranscript || (() => { });
        this._aiTranscriptBuffer = '';  // accumulates streaming AI text per turn

        this.onStateChange = onStateChange || (() => { });

        this.ws = null;
        this.audioCtx = null;
        this.micStream = null;
        this.micProcessor = null;
        this.isMuted = false;
        this.isConnected = false;
        this.audioQueue = [];      // queued PCM chunks from Gemini
        this.isPlaying = false;    // guards sequential playback
        this.nextPlayTime = 0;     // AudioContext schedule cursor
    }

    // ── Public API ────────────────────────────────────────────────

    async start() {
        this.onStatus('Connecting…');
        try {
            await this._openWebSocket();
            await this._startMicrophone();
        } catch (err) {
            console.error('[Voice] start error', err);
            this.onStatus('Failed to connect: ' + (err.message || err));
            this.stop();
        }
    }

    stop() {
        this._intentionalStop = true; // prevents onclose from showing 'Disconnected'
        this._stopMicrophone();
        if (this.ws) {
            try { this.ws.close(); } catch (_) { }
            this.ws = null;
        }
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch (_) { }
            this.audioCtx = null;
        }
        this.isConnected = false;
        this._intentionalStop = false;
        this.audioQueue = [];
        this.isPlaying = false;
        this.onStateChange('idle');
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.micStream) {
            this.micStream.getAudioTracks().forEach(t => (t.enabled = !muted));
        }
    }

    // ── WebSocket ────────────────────────────────────────────────

    _openWebSocket() {
        return new Promise((resolve, reject) => {
            const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

            const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                // Official Gemini Live API setup message format
                // (matches google-gemini/gemini-live-api-examples exactly)
                const setupMsg = {
                    setup: {
                        model: `models/${MODEL}`,
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: 'Aoede' }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: this.systemPrompt }]
                        },
                        // Enable live transcripts for both sides
                        inputAudioTranscription: {},
                        outputAudioTranscription: {}
                    }
                };
                this.ws.send(JSON.stringify(setupMsg));
                console.log('[Voice] Setup sent, waiting for setupComplete…');
            };

            this.ws.onmessage = async (event) => {
                // Gemini sends messages as Blob — must await .text() before parsing
                let jsonStr;
                try {
                    if (event.data instanceof Blob) {
                        jsonStr = await event.data.text();
                    } else if (event.data instanceof ArrayBuffer) {
                        jsonStr = new TextDecoder().decode(event.data);
                    } else {
                        jsonStr = event.data;
                    }
                } catch (e) {
                    console.error('[Voice] Failed to read message data', e);
                    return;
                }

                let msg;
                try { msg = JSON.parse(jsonStr); } catch { return; }

                console.log('[Voice] Server message:', Object.keys(msg));

                // Server confirms setup is ready
                if (msg.setupComplete !== undefined) {
                    console.log('[Voice] Setup complete — session is live');
                    this.isConnected = true;
                    this.onStatus('Listening…');
                    this.onStateChange('listening');
                    resolve();
                    return;
                }

                this._handleServerMessage(msg);
            };

            this.ws.onerror = (err) => {
                console.error('[Voice] WebSocket error', err);
                if (!this.isConnected) {
                    reject(new Error('Connection refused — check that your API key has Live API access.'));
                }
            };

            this.ws.onclose = (ev) => {
                console.log('[Voice] WebSocket closed', ev.code, ev.reason);
                if (!this.isConnected && !this._intentionalStop) {
                    // Failed before setupComplete
                    reject(new Error(`Connection closed before setup (code ${ev.code}). Check your API key.`));
                } else if (this.isConnected && !this._intentionalStop) {
                    // Unexpected drop mid-session
                    this.onStatus('Disconnected');
                    this.onStateChange('idle');
                }
                this.isConnected = false;
            };
        });
    }

    _handleServerMessage(msg) {
        // ── Server content (audio + transcripts) ──
        if (msg.serverContent) {
            const sc = msg.serverContent;

            // Collect audio chunks from this turn part
            if (sc.modelTurn?.parts) {
                let hasAudio = false;
                for (const part of sc.modelTurn.parts) {
                    if (part.inlineData?.data) {
                        this._enqueueAudio(part.inlineData.data);
                        hasAudio = true;
                    }
                }
                if (hasAudio) {
                    this.onStatus('Aegis is speaking…');
                    this.onStateChange('speaking');
                }
            }

            // Input transcript (what the user said) — arrives complete
            if (sc.inputTranscription?.text) {
                this.onTranscript('user', sc.inputTranscription.text);
            }
            // Output transcript — arrives as streaming chunks; buffer into one bubble
            if (sc.outputTranscription?.text) {
                this._aiTranscriptBuffer += sc.outputTranscription.text;
                // Update the in-progress bubble in real-time
                this.onTranscript('ai-chunk', this._aiTranscriptBuffer);
            }

            // Turn complete — finalise the AI bubble and reset buffer
            if (sc.turnComplete) {
                if (this._aiTranscriptBuffer) {
                    this.onTranscript('ai-done', this._aiTranscriptBuffer);
                    this._aiTranscriptBuffer = '';
                }
                this._playQueued().then(() => {
                    if (this.isConnected) {
                        this.onStatus('Listening…');
                        this.onStateChange('listening');
                    }
                });
            }
        }
    }

    // ── Microphone ────────────────────────────────────────────────

    async _startMicrophone() {
        this.audioCtx = new AudioContext({ sampleRate: 16000 });
        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        const source = this.audioCtx.createMediaStreamSource(this.micStream);
        // ScriptProcessor is deprecated but universally supported in browsers
        const bufferSize = 4096;
        this.micProcessor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

        this.micProcessor.onaudioprocess = (e) => {
            if (!this.isConnected || this.isMuted) return;
            const float32 = e.inputBuffer.getChannelData(0);
            const pcm16 = this._float32ToPcm16(float32);
            const b64 = this._arrayBufferToBase64(pcm16.buffer);
            const msg = {
                realtimeInput: {
                    // Official format: audio is a blob {mimeType, data}
                    audio: { mimeType: 'audio/pcm', data: b64 }
                }
            };
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(msg));
            }
        };

        source.connect(this.micProcessor);
        // Route through a zero-gain node so the ScriptProcessor graph stays
        // alive (onaudioprocess fires) without echoing mic audio to speakers.
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0;
        this.micProcessor.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
    }

    _stopMicrophone() {
        if (this.micProcessor) {
            try { this.micProcessor.disconnect(); } catch (_) { }
            this.micProcessor = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
    }

    // ── Audio playback ────────────────────────────────────────────

    _enqueueAudio(base64Data) {
        this.audioQueue.push(base64Data);
    }

    async _playQueued() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.onStatus('Aegis is speaking…');

        // Build a separate playback AudioContext at 24 kHz
        const playCtx = new AudioContext({ sampleRate: 24000 });
        this.nextPlayTime = playCtx.currentTime;

        for (const b64 of this.audioQueue) {
            const pcmBytes = this._base64ToArrayBuffer(b64);
            const samples = pcmBytes.byteLength / 2;
            const audioBuffer = playCtx.createBuffer(1, samples, 24000);
            const channelData = audioBuffer.getChannelData(0);
            const view = new DataView(pcmBytes);
            for (let i = 0; i < samples; i++) {
                // 16-bit little-endian → float32 [-1, 1]
                channelData[i] = view.getInt16(i * 2, true) / 32768.0;
            }
            const src = playCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(playCtx.destination);
            src.start(this.nextPlayTime);
            this.nextPlayTime += audioBuffer.duration;
        }
        this.audioQueue = [];

        // Wait for all audio to finish
        const waitMs = Math.max(0, (this.nextPlayTime - playCtx.currentTime) * 1000);
        await new Promise(r => setTimeout(r, waitMs + 200));
        try { playCtx.close(); } catch (_) { }
        this.isPlaying = false;
    }

    // ── Utility ───────────────────────────────────────────────────

    _float32ToPcm16(float32Array) {
        const buf = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            buf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return buf;
    }

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    _base64ToArrayBuffer(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }
}

// ── Shared voice session for both inline and modal ────────────────
let _voiceSession = null;
let _inlineVoiceReady = false;  // config fetched at least once
let _inlineLiveConfig = null;   // cached config

// ── Modal voice UI (full-screen overlay) ─────────────────────────
function initVoiceCall() {
    const endBtn = document.getElementById('voice-end-btn');
    const muteBtn = document.getElementById('voice-mute-btn');
    if (endBtn) endBtn.addEventListener('click', endVoiceCall);
    if (muteBtn) muteBtn.addEventListener('click', toggleVoiceMute);
}

// ── Inline voice UI (inside chat tab) ────────────────────────────
let _inlineVoiceInit = false;

function _initInlineVoice() {
    // Only wire listeners once
    if (_inlineVoiceInit) return;
    _inlineVoiceInit = true;

    const micBtn = document.getElementById('inline-mic-btn');
    const toTextBtn = document.getElementById('switch-to-text-btn');
    const toVoiceBtn = document.getElementById('switch-to-voice-btn');

    // Mode toggle: voice → text
    if (toTextBtn) toTextBtn.addEventListener('click', () => {
        _stopInlineVoice();
        document.getElementById('chat-voice-panel').classList.add('hidden');
        document.getElementById('chat-text-panel').classList.remove('hidden');
        const s = document.getElementById('chat-mode-status');
        if (s) s.textContent = 'Text Mode';
    });

    // Mode toggle: text → voice
    if (toVoiceBtn) toVoiceBtn.addEventListener('click', () => {
        document.getElementById('chat-text-panel').classList.add('hidden');
        document.getElementById('chat-voice-panel').classList.remove('hidden');
        const s = document.getElementById('chat-mode-status');
        if (s) s.textContent = 'Voice Mode — ready';
    });

    // Mic button: first tap = start session, subsequent = mute toggle
    if (micBtn) micBtn.addEventListener('click', async () => {
        if (!_voiceSession) {
            await _startInlineVoice();
        } else {
            // Toggle mute
            const nowMuted = micBtn.classList.toggle('muted');
            _voiceSession.setMuted(nowMuted);
            const lbl = document.getElementById('inline-mic-label');
            if (lbl) lbl.textContent = nowMuted ? 'Unmute' : 'Speaking…';
        }
    });
}

async function _startInlineVoice() {
    const micBtn = document.getElementById('inline-mic-btn');
    const lbl = document.getElementById('inline-mic-label');
    const status = document.getElementById('chat-mode-status');

    if (lbl) lbl.textContent = 'Connecting…';
    if (status) status.textContent = 'Connecting…';

    // Fetch config (cached after first call)
    if (!_inlineLiveConfig) {
        try {
            const res = await fetch('/api/live-config');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _inlineLiveConfig = await res.json();
        } catch (err) {
            if (lbl) lbl.textContent = 'Config error';
            if (status) status.textContent = 'Could not connect. Try again.';
            console.error('[InlineVoice] config error', err);
            return;
        }
    }

    if (!_inlineLiveConfig.apiKey) {
        if (lbl) lbl.textContent = 'No API key';
        return;
    }

    // Clear inline transcript
    _clearInlineTranscript();

    _voiceSession = new GeminiLiveSession({
        apiKey: _inlineLiveConfig.apiKey,
        systemPrompt: _inlineLiveConfig.systemPrompt,

        onStatus: (text) => {
            if (status) status.textContent = text;
        },

        onTranscript: (role, text) => {
            // Mirror to inline transcript
            _appendInlineTranscript(role, text);
            // Also mirror to text chat panel
            _appendTranscript(role, text);
        },

        onStateChange: (state) => {
            _setInlineMicState(state);
            // Also drive the modal waveform (keeps consistency)
            _setVoiceWaveform(state);
        }
    });

    try {
        await _voiceSession.start();
        if (lbl) lbl.textContent = 'Tap to mute';
        if (micBtn) micBtn.classList.remove('muted');
    } catch (err) {
        console.error('[InlineVoice] start error', err);
        if (lbl) lbl.textContent = 'Tap to retry';
        if (status) status.textContent = 'Connection failed — tap mic to retry';
        _voiceSession = null;
    }
}

function _stopInlineVoice() {
    if (_voiceSession) {
        _voiceSession.stop();
        _voiceSession = null;
    }
    _setInlineMicState('idle');
    const lbl = document.getElementById('inline-mic-label');
    if (lbl) lbl.textContent = 'Tap to speak';
}

function _setInlineMicState(state) {
    const micBtn = document.getElementById('inline-mic-btn');
    const wf = document.getElementById('inline-waveform');
    const lbl = document.getElementById('inline-mic-label');
    const status = document.getElementById('chat-mode-status');

    if (micBtn) {
        micBtn.classList.remove('listening', 'ai-speaking');
        if (state === 'listening') micBtn.classList.add('listening');
        if (state === 'speaking') micBtn.classList.add('ai-speaking');
    }
    if (wf) {
        wf.classList.remove('listening', 'speaking');
        if (state === 'listening') wf.classList.add('listening');
        if (state === 'speaking') wf.classList.add('speaking');
    }
    if (lbl) {
        if (state === 'listening') lbl.textContent = 'Listening…';
        else if (state === 'speaking') lbl.textContent = 'Aegis speaking…';
        else if (state !== 'idle') lbl.textContent = state;
    }
    if (status) {
        if (state === 'listening') status.textContent = 'Voice Mode — listening';
        else if (state === 'speaking') status.textContent = 'Voice Mode — Aegis speaking';
        else if (state === 'idle') status.textContent = 'Voice Mode — ready';
    }
}

function _clearInlineTranscript() {
    const box = document.getElementById('inline-transcript');
    if (!box) return;
    box.innerHTML = '<p id="inline-transcript-hint">Your conversation will appear here…</p>';
}

function _appendInlineTranscript(role, text) {
    if (!text || !text.trim()) return;
    const box = document.getElementById('inline-transcript');
    if (!box) return;
    const hint = document.getElementById('inline-transcript-hint');
    if (hint) hint.remove();

    const line = document.createElement('div');
    line.className = `vil-line ${role === 'user' ? 'user' : 'ai'}`;
    line.textContent = text;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}


async function openVoiceCall() {
    // Show overlay immediately
    document.getElementById('voice-call-modal').classList.add('active');
    _setVoiceStatus('Fetching config…');
    _setVoiceWaveform('idle');
    _clearTranscript();

    // Reset mute button
    const muteBtn = document.getElementById('voice-mute-btn');
    if (muteBtn) muteBtn.classList.remove('muted');

    // Fetch API key + system prompt from our backend
    let config;
    try {
        const res = await fetch('/api/live-config');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        config = await res.json();
    } catch (err) {
        _setVoiceStatus('Could not load config: ' + err.message);
        console.error('[Voice] config fetch error', err);
        return;
    }

    if (!config.apiKey) {
        _setVoiceStatus('API key not configured.');
        return;
    }

    _voiceSession = new GeminiLiveSession({
        apiKey: config.apiKey,
        systemPrompt: config.systemPrompt,
        onStatus: _setVoiceStatus,
        onTranscript: _appendTranscript,
        onStateChange: (state) => {
            _setVoiceWaveform(state);
            // Drive the central mic button state
            const micBtn = document.getElementById('voice-mute-btn');
            if (micBtn) {
                micBtn.classList.toggle('ai-speaking', state === 'speaking');
            }
            // Avatar ring glow
            const wrap = document.querySelector('.voice-call-avatar-wrap');
            if (wrap) wrap.classList.toggle('ai-speaking', state === 'speaking');
        }
    });

    await _voiceSession.start();
}

function endVoiceCall() {
    if (_voiceSession) {
        _voiceSession.stop();
        _voiceSession = null;
    }
    document.getElementById('voice-call-modal').classList.remove('active');
    _setVoiceWaveform('idle');
    const wrap = document.querySelector('.voice-call-avatar-wrap');
    if (wrap) wrap.classList.remove('ai-speaking');
    // Reset mic button
    const micBtn = document.getElementById('voice-mute-btn');
    if (micBtn) {
        micBtn.classList.remove('muted', 'ai-speaking');
        const label = document.getElementById('voice-mic-label');
        if (label) label.textContent = 'Tap to mute';
    }
}

function toggleVoiceMute() {
    if (!_voiceSession) return;
    const micBtn = document.getElementById('voice-mute-btn');
    const nowMuted = micBtn.classList.toggle('muted');
    _voiceSession.setMuted(nowMuted);
    // Update accessibility + label
    const label = document.getElementById('voice-mic-label');
    if (label) label.textContent = nowMuted ? 'Unmute' : 'Tap to mute';
    micBtn.title = nowMuted ? 'Unmute microphone' : 'Mute microphone';
    micBtn.setAttribute('aria-label', nowMuted ? 'Unmute microphone' : 'Mute microphone — active');
}

function _setVoiceStatus(text) {
    const el = document.getElementById('voice-status');
    if (el) el.textContent = text;
}

function _setVoiceWaveform(state) {
    // Sync both side waveform panels
    ['voice-waveform', 'voice-waveform-left'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('listening', 'speaking');
        if (state === 'listening') el.classList.add('listening');
        if (state === 'speaking') el.classList.add('speaking');
    });
}

function _clearTranscript() {
    const inner = document.getElementById('voice-transcript-inner');
    if (inner) inner.innerHTML = '<p class="voice-transcript-hint">Your conversation will appear here…</p>';
}

// ── Transcript helpers for both modal + inline ──────────────────
// Roles: 'user'     → new complete bubble
//        'ai-chunk' → update last AI bubble in-place (streaming)
//        'ai-done'  → finalise last AI bubble + mirror to chat

function _appendTranscript(role, text) {
    const inner = document.getElementById('voice-transcript-inner');
    if (!inner) return;

    const hint = inner.querySelector('.voice-transcript-hint');
    if (hint) hint.remove();

    if (role === 'user') {
        const line = document.createElement('p');
        line.className = 'voice-transcript-line user';
        line.textContent = text;
        inner.appendChild(line);
    } else if (role === 'ai-chunk') {
        // Update the last AI bubble, or create one
        let last = inner.querySelector('.voice-transcript-line.ai.streaming');
        if (!last) {
            last = document.createElement('p');
            last.className = 'voice-transcript-line ai streaming';
            inner.appendChild(last);
        }
        last.textContent = text;
    } else if (role === 'ai-done') {
        // Finalise the streaming bubble
        const last = inner.querySelector('.voice-transcript-line.ai.streaming');
        if (last) {
            last.classList.remove('streaming');
            last.textContent = text;
        }
        // Mirror complete message to main chat
        if (text && text.trim()) addChatMessage(text, 'ai');
    }

    const container = document.getElementById('voice-transcript');
    if (container) container.scrollTop = container.scrollHeight;
}

function _appendInlineTranscript(role, text) {
    if (role === 'ai-chunk' && (!text || !text.trim())) return;
    const box = document.getElementById('inline-transcript');
    if (!box) return;

    const hint = document.getElementById('inline-transcript-hint');
    if (hint) hint.remove();

    if (role === 'user') {
        const line = document.createElement('div');
        line.className = 'vil-line user';
        line.textContent = text;
        box.appendChild(line);
    } else if (role === 'ai-chunk') {
        let last = box.querySelector('.vil-line.ai.streaming');
        if (!last) {
            last = document.createElement('div');
            last.className = 'vil-line ai streaming';
            box.appendChild(last);
        }
        last.textContent = text;
    } else if (role === 'ai-done') {
        const last = box.querySelector('.vil-line.ai.streaming');
        if (last) {
            last.classList.remove('streaming');
            last.textContent = text;
        }
    }

    box.scrollTop = box.scrollHeight;
}
