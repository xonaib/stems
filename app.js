// ─── Config ───────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://myfgfszskdrocgacpsmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15Zmdmc3pza2Ryb2NnYWNwc21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTU4NjQsImV4cCI6MjA5ODU3MTg2NH0.BQ396brLnxymrRmDolSaDOJctDl-QZn7yXoVJNjEsco';
const COLORS = ['#7c6af7','#4caf7d','#f0a500','#f75a5a','#38bdf8','#e879f9','#fb923c','#a3e635','#06b6d4','#f472b6'];

// ─── State ────────────────────────────────────────────────────────
let branches = JSON.parse(localStorage.getItem('gt_branches') || '[]');
let logs     = JSON.parse(localStorage.getItem('gt_logs')     || '[]');
let settings = JSON.parse(localStorage.getItem('gt_settings') || '{"quietFrom":"22:00","quietTo":"08:00","notifsEnabled":false,"activeDays":[1,2,3,4,5]}');

let selectedBranchId  = null;
let selectedBranchNew = null;
let selectedColor     = COLORS[0];
let acFocusIndex      = -1;
let weeklyChart       = null;

// ─── Persist ──────────────────────────────────────────────────────
function save() {
  localStorage.setItem('gt_branches', JSON.stringify(branches));
  localStorage.setItem('gt_logs',     JSON.stringify(logs));
  localStorage.setItem('gt_settings', JSON.stringify(settings));
  if (currentUser && supabaseReady) {
    pushLocalToSupabase([], []).catch(console.error);
  }
}

// ─── Theme ────────────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-btn').textContent = t === 'dark' ? '☀️ Light' : '🌙 Dark';
  document.getElementById('theme-color-meta').setAttribute('content', t === 'dark' ? '#0f0f0f' : '#f5f5f7');
  localStorage.setItem('gt_theme', t);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
  if (weeklyChart) renderWeeklyChart();
}

// ─── Navigation ───────────────────────────────────────────────────
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'dash')     renderDash();
  if (id === 'history')  renderHistory();
  if (id === 'branches') renderBranchesPage();
}

// ─── Toast ────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast'; el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ─── Branches ─────────────────────────────────────────────────────
function renderColorPicker() {
  document.getElementById('color-picker').innerHTML = COLORS.map(c => `
    <div class="color-swatch ${c === selectedColor ? 'selected' : ''}"
         style="background:${c}" onclick="selectColor('${c}')"></div>
  `).join('');
}
function selectColor(c) { selectedColor = c; renderColorPicker(); }

function addBranch(name, color) {
  const fromUI = !name;
  name  = name  || document.getElementById('new-branch-name').value.trim();
  color = color || selectedColor;
  if (!name) return null;
  const existing = branches.find(b => b.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const b = { id: Date.now().toString(), name, color };
  branches.push(b);
  save();
  if (fromUI) {
    document.getElementById('new-branch-name').value = '';
    selectedColor = COLORS[branches.length % COLORS.length];
    renderBranchesPage();
    showToast(`"${b.name}" added`);
  }
  return b;
}

function startEditBranch(id, el) {
  const b = branches.find(b => b.id === id);
  if (!b) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = b.name;
  input.maxLength = 30;
  input.style.cssText = 'font-size:15px;font-weight:600;font-family:inherit;background:transparent;border:none;border-bottom:1.5px solid var(--accent);outline:none;color:var(--text);width:100%;padding:0;';
  el.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const name = input.value.trim();
    if (name && name !== b.name) {
      b.name = name;
      save();
      showToast(`Renamed to "${name}"`);
    }
    renderBranchesPage();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderBranchesPage(); }
  });
}

function deleteBranch(id) {
  if (!confirm('Delete this branch? Logs will remain but unlinked.')) return;
  branches = branches.filter(b => b.id !== id);
  save(); renderBranchesPage();
}

function renderBranchesPage() {
  renderColorPicker();
  const el = document.getElementById('branches-list');
  el.innerHTML = branches.length ? branches.map(b => {
    const total = logs.filter(l => l.branchId === b.id).reduce((s, l) => s + l.minutes, 0);
    const count = logs.filter(l => l.branchId === b.id).length;
    return `
      <div class="branch-item">
        <div class="branch-color-dot" style="background:${b.color}"></div>
        <div class="branch-info">
          <div class="branch-name" onclick="startEditBranch('${b.id}', this)" title="Tap to rename" style="cursor:pointer;">${b.name}</div>
          <div class="branch-stats">${fmtHours(total)} logged · ${count} sessions</div>
        </div>
        <button class="branch-delete" onclick="deleteBranch('${b.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>`;
  }).join('') : '<div class="empty"><span>🌱</span>Add your first branch below</div>';

  document.getElementById('notif-toggle').checked = settings.notifsEnabled;
  document.getElementById('quiet-from').value     = settings.quietFrom;
  document.getElementById('quiet-to').value       = settings.quietTo;
  renderDayPicker();
}

function renderDayPicker() {
  const days = ['S','M','T','W','T','F','S'];
  const vals = [0,1,2,3,4,5,6];
  const active = settings.activeDays || [1,2,3,4,5];
  const el = document.getElementById('day-picker');
  if (!el) return;
  el.innerHTML = vals.map((d, i) => `
    <div class="day-chip ${active.includes(d) ? 'on' : ''}" onclick="toggleDay(${d})">${days[i]}</div>
  `).join('');
}

// ─── Settings ─────────────────────────────────────────────────────
function saveSettings() {
  settings.quietFrom = document.getElementById('quiet-from').value;
  settings.quietTo   = document.getElementById('quiet-to').value;
  save();
}

function toggleDay(d) {
  const active = settings.activeDays || [1,2,3,4,5];
  const idx = active.indexOf(d);
  if (idx === -1) active.push(d);
  else active.splice(idx, 1);
  settings.activeDays = active;
  save();
  renderDayPicker();
}

function toggleNotifs(el) {
  if (el.checked) {
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        settings.notifsEnabled = true; save();
        new Notification('Stems 🌿', { body: 'Hourly reminders are on!' });
      } else {
        el.checked = false;
        settings.notifsEnabled = false; save();
      }
    });
  } else {
    settings.notifsEnabled = false; save();
  }
}

// ─── Autocomplete ─────────────────────────────────────────────────
function onAcFocus() {
  if (!document.getElementById('ac-input').value.trim()) showAcDropdown('');
}
function onAcInput() {
  acFocusIndex = -1;
  showAcDropdown(document.getElementById('ac-input').value.trim());
}
function showAcDropdown(q) {
  const matches    = q ? branches.filter(b => b.name.toLowerCase().includes(q.toLowerCase())) : branches;
  const exactMatch = branches.find(b => b.name.toLowerCase() === q.toLowerCase());
  let html = '';
  if (!matches.length && !q) {
    html = `<div class="ac-item" style="color:var(--muted);cursor:default;">Type to create a new branch</div>`;
  } else {
    html = matches.map(b => `
      <div class="ac-item" onclick="selectBranch('${b.id}')">
        <div class="ac-dot" style="background:${b.color}"></div>${b.name}
      </div>`).join('');
    if (q && !exactMatch) {
      const autoColor = COLORS[branches.length % COLORS.length];
      html += `
        <div class="ac-item" onclick="selectNewBranch('${q}','${autoColor}')">
          <div class="ac-dot" style="background:${autoColor}"></div>${q}
          <span class="ac-new">+ Create</span>
        </div>`;
    }
  }
  document.getElementById('ac-dropdown').innerHTML = html;
  document.getElementById('ac-dropdown').classList.add('open');
}
function onAcKeydown(e) {
  const items = document.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown') { e.preventDefault(); acFocusIndex = Math.min(acFocusIndex + 1, items.length - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); acFocusIndex = Math.max(acFocusIndex - 1, 0); }
  else if (e.key === 'Enter') { e.preventDefault(); (document.querySelector('.ac-item.focused') || items[items.length - 1])?.click(); return; }
  else if (e.key === 'Escape') { closeDropdown(); return; }
  items.forEach((el, i) => el.classList.toggle('focused', i === acFocusIndex));
}
function closeDropdown() { document.getElementById('ac-dropdown').classList.remove('open'); }
function selectBranch(id) {
  const b = branches.find(b => b.id === id);
  if (!b) return;
  selectedBranchId = id; selectedBranchNew = null;
  showChip(b.color, b.name);
}
function selectNewBranch(name, color) {
  selectedBranchId = null; selectedBranchNew = { name, color };
  showChip(color, name);
}
function showChip(color, name) {
  document.getElementById('chip-dot').style.background = color;
  document.getElementById('chip-label').textContent = name;
  document.getElementById('selected-chip').classList.add('show');
  document.getElementById('ac-wrap').style.display = 'none';
  closeDropdown();
}
function clearSelectedBranch() {
  selectedBranchId = null; selectedBranchNew = null;
  document.getElementById('selected-chip').classList.remove('show');
  document.getElementById('ac-wrap').style.display = '';
  document.getElementById('ac-input').value = '';
  document.getElementById('ac-input').focus();
}
document.addEventListener('click', e => { if (!e.target.closest('#ac-wrap')) closeDropdown(); });

// ─── Log Modal ────────────────────────────────────────────────────
function openLog() {
  selectedBranchId = null; selectedBranchNew = null;
  document.getElementById('log-minutes').value = '';
  document.getElementById('log-note').value    = '';
  document.getElementById('ac-input').value    = '';
  document.getElementById('selected-chip').classList.remove('show');
  document.getElementById('ac-wrap').style.display = '';
  closeDropdown();
  document.getElementById('log-modal').classList.add('open');
  setTimeout(() => document.getElementById('ac-input').focus(), 300);
}
function closeLog() { document.getElementById('log-modal').classList.remove('open'); }
function closeLogIfOverlay(e) { if (e.target === e.currentTarget) closeLog(); }
function setMinutes(m) { document.getElementById('log-minutes').value = m; }

function submitLog() {
  let branchId;
  if (selectedBranchId) {
    branchId = selectedBranchId;
  } else if (selectedBranchNew) {
    branchId = addBranch(selectedBranchNew.name, selectedBranchNew.color).id;
  } else {
    const q = document.getElementById('ac-input').value.trim();
    if (!q) { alert('Pick or type a branch name.'); return; }
    branchId = addBranch(q, COLORS[branches.length % COLORS.length]).id;
  }
  const mins = parseInt(document.getElementById('log-minutes').value);
  if (!mins || mins < 1) { alert('Enter time spent.'); return; }
  const note = document.getElementById('log-note').value.trim();
  logs.unshift({ id: Date.now().toString(), branchId, minutes: mins, note, ts: Date.now() });
  save(); closeLog(); renderDash();
  showToast('Session logged ✓');
}

// ─── Dashboard ────────────────────────────────────────────────────
function renderDash() {
  const now = new Date();
  document.getElementById('today-label').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const todayStr  = dateStr(now);
  const todayMins = logs.filter(l => dateStr(new Date(l.ts)) === todayStr).reduce((s, l) => s + l.minutes, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const weekMins  = logs.filter(l => new Date(l.ts) >= weekStart).reduce((s, l) => s + l.minutes, 0);

  document.getElementById('sum-today').textContent = fmtHours(todayMins);
  document.getElementById('sum-week').textContent  = fmtHours(weekMins);
  document.getElementById('sum-logs').textContent  = logs.length;

  const streak = calcStreak();
  document.getElementById('streak-display').innerHTML =
    streak > 1 ? `<div class="streak-badge">🔥 ${streak} day streak</div>` : '';

  renderNotifBanner();
  renderHeatmap();
  renderWeeklyChart();
  renderTodayLogs();
}

function renderNotifBanner() {
  const el = document.getElementById('notif-banner-wrap');
  if (!('Notification' in window) || Notification.permission === 'granted' ||
      settings.notifsEnabled || localStorage.getItem('gt_notif_dismissed')) {
    el.innerHTML = ''; return;
  }
  el.innerHTML = `
    <div class="notif-banner">
      <span>Enable hourly reminders</span>
      <button onclick="enableNotifsBanner()">Enable</button>
    </div>`;
}
function enableNotifsBanner() {
  Notification.requestPermission().then(p => {
    if (p === 'granted') { settings.notifsEnabled = true; save(); new Notification('Stems 🌿', { body: 'Hourly reminders are on!' }); }
    else localStorage.setItem('gt_notif_dismissed', '1');
    renderDash();
  });
}

function renderHeatmap() {
  const el = document.getElementById('heatmap-container');
  if (!branches.length) { el.innerHTML = '<div class="empty" style="padding:20px 0"><span>🌱</span>Add branches to see your heatmap</div>'; return; }
  const days = 90, today = new Date();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i)); return dateStr(d);
  });
  const lookup = {};
  branches.forEach(b => { lookup[b.id] = {}; });
  logs.forEach(l => {
    if (!lookup[l.branchId]) return;
    const d = dateStr(new Date(l.ts));
    lookup[l.branchId][d] = (lookup[l.branchId][d] || 0) + l.minutes;
  });
  el.innerHTML = branches.map(b => {
    const vals  = dates.map(d => lookup[b.id][d] || 0);
    const max   = Math.max(...vals, 1);
    const cells = vals.map((v, i) => {
      const opacity = v === 0 ? 0 : 0.2 + (v / max) * 0.8;
      return `<div class="heatmap-cell" title="${dates[i]}${v > 0 ? ': ' + fmtHours(v) : ''}"
                   style="${v > 0 ? `background:${b.color};opacity:${opacity.toFixed(2)}` : ''}"></div>`;
    }).join('');
    return `<div class="heatmap-goal">
      <div class="heatmap-goal-name">${b.name}</div>
      <div class="heatmap-wrap"><div class="heatmap-grid">${cells}</div></div>
    </div>`;
  }).join('');
}

function renderWeeklyChart() {
  const ctx = document.getElementById('weekly-chart').getContext('2d');
  if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
  if (!branches.length) return;
  const isDark     = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor  = isDark ? '#2e2e2e' : '#e0e0e5';
  const tickColor  = isDark ? '#6b6b6b' : '#999999';
  const now        = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay()); thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: branches.map(b => b.name),
      datasets: [
        {
          label: 'This week',
          data: branches.map(b => parseFloat((logs.filter(l => l.branchId === b.id && new Date(l.ts) >= thisWeekStart).reduce((s, l) => s + l.minutes, 0) / 60).toFixed(1))),
          backgroundColor: branches.map(b => b.color),
          borderRadius: 6, borderSkipped: false,
        },
        {
          label: 'Last week',
          data: branches.map(b => parseFloat((logs.filter(l => { const t = new Date(l.ts); return l.branchId === b.id && t >= lastWeekStart && t < thisWeekStart; }).reduce((s, l) => s + l.minutes, 0) / 60).toFixed(1))),
          backgroundColor: branches.map(b => b.color + '44'),
          borderRadius: 6, borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tickColor, font: { size: 11 }, boxWidth: 10, padding: 12 } },
        tooltip: { callbacks: { label: c => ` ${c.parsed.y}h — ${c.dataset.label}` } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } }, beginAtZero: true }
      }
    }
  });
}

function renderTodayLogs() {
  const el      = document.getElementById('today-logs');
  const entries = logs.filter(l => dateStr(new Date(l.ts)) === dateStr(new Date()));
  if (!entries.length) { el.innerHTML = '<div class="empty" style="padding:20px 0"><span>☀️</span>Nothing logged today yet</div>'; return; }
  el.innerHTML = entries.map(l => logItemHTML(l)).join('');
}

// ─── History ──────────────────────────────────────────────────────
function renderHistory() {
  const el = document.getElementById('history-list');
  if (!logs.length) { el.innerHTML = '<div class="empty"><span>📭</span>No sessions logged yet</div>'; return; }
  const groups = {};
  logs.forEach(l => { const d = dateStr(new Date(l.ts)); if (!groups[d]) groups[d] = []; groups[d].push(l); });
  el.innerHTML = Object.entries(groups).map(([date, entries]) => {
    const totalMins = entries.reduce((s, l) => s + l.minutes, 0);
    return `<div class="card" style="padding:8px 16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:4px;">
        <div style="font-weight:600;font-size:13px;">${fmtDate(new Date(date))}</div>
        <div style="font-size:12px;color:var(--muted)">${fmtHours(totalMins)} total</div>
      </div>${entries.map(l => logItemHTML(l)).join('')}
    </div>`;
  }).join('');
}

function logItemHTML(l) {
  const b = branches.find(b => b.id === l.branchId);
  return `<div class="log-item">
    <div class="log-dot" style="background:${b ? b.color : '#6b6b6b'}"></div>
    <div class="log-meta">
      <div class="log-goal">${b ? b.name : 'Unknown branch'}</div>
      ${l.note ? `<div class="log-note">${l.note}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="log-duration">${fmtHours(l.minutes)}</div>
      <div class="log-time">${fmtTime(new Date(l.ts))}</div>
    </div>
  </div>`;
}

// ─── Export / Import ──────────────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify({ branches, logs, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stems-backup-${dateStr(new Date())}.json`;
  a.click();
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.branches || !data.logs) throw new Error();
      if (!confirm(`Import ${data.branches.length} branches and ${data.logs.length} logs? Merges with existing data.`)) return;
      const bIds = new Set(branches.map(b => b.id));
      data.branches.forEach(b => { if (!bIds.has(b.id)) branches.push(b); });
      const lIds = new Set(logs.map(l => l.id));
      data.logs.forEach(l => { if (!lIds.has(l.id)) logs.push(l); });
      logs.sort((a, b) => b.ts - a.ts);
      save(); renderBranchesPage(); showToast('Import successful!');
    } catch { alert('Invalid backup file.'); }
  };
  reader.readAsText(file);
}

// ─── Helpers ──────────────────────────────────────────────────────
function dateStr(d)  { return d.toISOString().slice(0, 10); }
function fmtTime(d)  { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
function fmtHours(mins) {
  if (!mins) return '0m';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtDate(d) {
  const today = new Date(), yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateStr(d) === dateStr(today))     return 'Today';
  if (dateStr(d) === dateStr(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function calcStreak() {
  if (!logs.length) return 0;
  const today = dateStr(new Date());
  const dates = [...new Set(logs.map(l => dateStr(new Date(l.ts))))].sort().reverse();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (dates[0] !== today && dates[0] !== dateStr(yesterday)) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    if ((new Date(dates[i - 1]) - new Date(dates[i])) / 86400000 === 1) streak++;
    else break;
  }
  return streak;
}

// ─── Hourly Reminder ──────────────────────────────────────────────
function isInQuietHours() {
  const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
  const [fH, fM] = settings.quietFrom.split(':').map(Number);
  const [tH, tM] = settings.quietTo.split(':').map(Number);
  const from = fH * 60 + fM, to = tH * 60 + tM;
  return from > to ? cur >= from || cur < to : cur >= from && cur < to;
}
function isActiveDay() {
  const day = new Date().getDay(); // 0=Sun, 1=Mon … 6=Sat
  return (settings.activeDays || [1,2,3,4,5]).includes(day);
}
function maybeRemind() {
  if (!settings.notifsEnabled || Notification.permission !== 'granted' || isInQuietHours() || !isActiveDay()) return;
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  if (localStorage.getItem('gt_last_notif_hour') !== hourKey) {
    localStorage.setItem('gt_last_notif_hour', hourKey);
    new Notification('Stems 🌿', { body: 'What did you work on this past hour?' });
  }
}
setInterval(maybeRemind, 5 * 60 * 1000);
maybeRemind();

// ─── Supabase Auth & Sync ─────────────────────────────────────────
const supabaseReady = SUPABASE_URL !== 'YOUR_SUPABASE_URL';
const db = supabaseReady ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentUser = null;

async function initAuth() {
  if (!supabaseReady) { startApp(); return; }
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    startApp();                  // show app immediately
    syncFromSupabase();          // sync in background
  } else {
    showAuthScreen();
  }
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      startApp();                // show app immediately
      syncFromSupabase();        // sync in background
    }
    if (event === 'SIGNED_OUT') { currentUser = null; showAuthScreen(); }
  });
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.querySelector('.fab').style.display = 'none';
}
function hideAuthScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = '';
  document.querySelector('.fab').style.display = '';
  const emailEl = document.getElementById('account-email');
  if (emailEl && currentUser) emailEl.textContent = currentUser.email;
}

async function signOut() {
  if (supabaseReady) await db.auth.signOut();
  currentUser = null;
  showAuthScreen();
}
function startApp() { hideAuthScreen(); renderDash(); renderColorPicker(); }
function useOffline() { startApp(); }

function togglePasswordReveal() {
  const input = document.getElementById('auth-password');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  document.getElementById('pw-eye').innerHTML = isHidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}

let authMode = 'signin';
function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  document.getElementById('auth-btn').textContent = authMode === 'signup' ? 'Create account' : 'Sign in';
  document.getElementById('auth-mode-toggle').innerHTML = authMode === 'signup'
    ? 'Already have an account? <span onclick="toggleAuthMode()" style="color:var(--accent);cursor:pointer;font-weight:600;">Sign in</span>'
    : 'First time? <span onclick="toggleAuthMode()" style="color:var(--accent);cursor:pointer;font-weight:600;">Create account</span>';
  document.getElementById('pw-reveal').style.display = authMode === 'signup' ? 'none' : 'flex';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
}

async function authSubmit() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { alert('Enter your email and password.'); return; }
  if (password.length < 6) { alert('Password must be at least 6 characters.'); return; }
  const btn = document.getElementById('auth-btn');
  const label = authMode === 'signup' ? 'Create account' : 'Sign in';
  const reset = () => { btn.textContent = label; btn.disabled = false; };
  btn.textContent = 'Please wait…'; btn.disabled = true;

  // Failsafe: reset button after 10s if nothing happens
  const failsafe = setTimeout(reset, 10000);

  try {
    const { data, error } = await (authMode === 'signup'
      ? db.auth.signUp({ email, password })
      : db.auth.signInWithPassword({ email, password }));

    clearTimeout(failsafe);

    if (error) {
      alert(error.message || 'Something went wrong. Check your email and password.');
      reset(); return;
    }
    if (authMode === 'signup' && data?.user && !data?.session) {
      // Email confirmation still pending — try signing in immediately anyway
      const { data: si, error: siErr } = await db.auth.signInWithPassword({ email, password });
      if (siErr || !si?.session) {
        // Confirm via SQL if this keeps happening, but inform user for now
        alert('Account created! You may need to confirm your email before signing in.');
        reset(); return;
      }
      // si session exists — onAuthStateChange will fire
      return;
    }
    // Success — onAuthStateChange fires startApp(), no need to reset
  } catch (e) {
    clearTimeout(failsafe);
    alert('Connection error. Check your internet and try again.');
    reset();
  }
}

function showSync(msg) { const el = document.getElementById('sync-bar'); el.textContent = msg; el.style.display = 'block'; }
function hideSync()    { document.getElementById('sync-bar').style.display = 'none'; }

async function syncFromSupabase() {
  if (!currentUser || !supabaseReady) return;
  showSync('Syncing…');
  try {
    const [{ data: remoteBranches }, { data: remoteLogs }] = await Promise.all([
      db.from('branches').select('*').eq('user_id', currentUser.id),
      db.from('logs').select('*').eq('user_id', currentUser.id).order('ts', { ascending: false })
    ]);
    const bIds = new Set(branches.map(b => b.id));
    (remoteBranches || []).forEach(b => { if (!bIds.has(b.id)) branches.push({ id: b.id, name: b.name, color: b.color }); });
    const lIds = new Set(logs.map(l => l.id));
    (remoteLogs || []).forEach(l => { if (!lIds.has(l.id)) logs.push({ id: l.id, branchId: l.branch_id, minutes: l.minutes, note: l.note || '', ts: l.ts }); });
    logs.sort((a, b) => b.ts - a.ts);
    await pushLocalToSupabase(remoteBranches || [], remoteLogs || []);
    save();
    renderDash();
  } catch (e) { console.error('Sync error', e); }
  hideSync();
}

async function pushLocalToSupabase(remoteBranches, remoteLogs) {
  if (!currentUser) return;
  const rBIds = new Set(remoteBranches.map(b => b.id));
  const rLIds = new Set(remoteLogs.map(l => l.id));
  const newB  = branches.filter(b => !rBIds.has(b.id)).map(b => ({ id: b.id, user_id: currentUser.id, name: b.name, color: b.color }));
  const newL  = logs.filter(l => !rLIds.has(l.id)).map(l => ({ id: l.id, user_id: currentUser.id, branch_id: l.branchId, minutes: l.minutes, note: l.note, ts: l.ts }));
  if (newB.length) await db.from('branches').upsert(newB);
  if (newL.length) await db.from('logs').upsert(newL);
}

// ─── Service Worker ───────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);

// ─── Init ─────────────────────────────────────────────────────────
applyTheme(localStorage.getItem('gt_theme') || 'dark');
initAuth();
