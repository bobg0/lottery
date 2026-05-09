/* ─── Habit Wheel ─────────────────────────────────────────────────────────── */

const CLIP_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const GOLD = 'gold';
const ALL_COLORS = [...CLIP_COLORS, GOLD];

const DEFAULT_REWARDS = {
  practice: {
    tier1:   '5–8 min video game or 10 min movie',
    tier2:   '15–20 min video game or 20–25 min movie',
    tier3:   '35–45 min video game or movie segment',
    jackpot: '90 min game/movie block',
    bonus:   'Bonus challenge — see result',
  },
  workout: {
    tier1:   '10 min video game or 15 min movie',
    tier2:   '30 min video game or half movie',
    tier3:   '60 min video game or full movie if evening',
    jackpot: '2 hour game/movie block',
    bonus:   'Bonus challenge — see result',
  },
};

const PRACTICE_BONUS_OPTIONS = [
  'Do 2 more practice questions.',
  'Do 1 more question + review a previous one.',
  'Review one missed question and write the key idea.',
  'Gain 1 free clip (random color).',
  'Spin the bonus wheel twice!',
];

const WORKOUT_BONUS_OPTIONS = [
  '12 extra minutes of accessory work.',
  '8 extra minutes of accessory work.',
  '5 extra minutes of accessory work.',
  'Gain 1 free clip (random color).',
  'Spin the bonus wheel twice!',
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function randomColor() {
  return CLIP_COLORS[Math.floor(Math.random() * CLIP_COLORS.length)];
}

function fmt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function totalClips(clips) {
  return Object.values(clips).reduce((a, b) => a + b, 0);
}

/* ─── State ───────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'habit_wheel_state';

function defaultState() {
  return {
    lastDate:  todayStr(),
    weekStart: weekStartStr(),

    // Today
    practiceBlocks: 0,
    questionsToday: 0,
    workoutDone: false,

    // Clip inventory
    practiceClips: Object.fromEntries(ALL_COLORS.map(c => [c, 0])),
    workoutClips:  Object.fromEntries(ALL_COLORS.map(c => [c, 0])),

    // Spin tracking
    practiceClipTotal: 0,   // lifetime practice clips earned (for spin calc)
    practiceSpinsUsed: 0,
    workoutClipTotal:  0,   // lifetime workout clips earned
    workoutSpinsUsed:  0,

    // Progress
    totalQuestions:  0,
    weekQuestions:   0,
    practiceDays:    0,
    weekWorkouts:    0,

    // History
    history: [],

    // Rewards
    rewards: JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    // Ensure all keys exist
    const def = defaultState();
    for (const k of Object.keys(def)) {
      if (s[k] === undefined) s[k] = def[k];
    }
    // Ensure all clip colors exist
    for (const c of ALL_COLORS) {
      if (s.practiceClips[c] === undefined) s.practiceClips[c] = 0;
      if (s.workoutClips[c] === undefined) s.workoutClips[c] = 0;
    }
    // Ensure rewards keys exist
    for (const type of ['practice', 'workout']) {
      for (const tier of ['tier1', 'tier2', 'tier3', 'jackpot', 'bonus']) {
        if (!s.rewards[type][tier]) s.rewards[type][tier] = def.rewards[type][tier];
      }
    }
    return s;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ─── Daily / Weekly Reset ────────────────────────────────────────────────── */

function checkDateReset() {
  const today = todayStr();
  const ws = weekStartStr();

  if (state.lastDate !== today) {
    // If yesterday had practice blocks, count as a practice day
    if (state.practiceBlocks > 0) {
      state.practiceDays++;
    }
    // Reset daily
    state.practiceBlocks = 0;
    state.questionsToday = 0;
    state.workoutDone = false;
    state.lastDate = today;
  }

  if (state.weekStart !== ws) {
    state.weekQuestions = 0;
    state.weekWorkouts = 0;
    state.weekStart = ws;
  }

  saveState();
}

/* ─── Computed Values ─────────────────────────────────────────────────────── */

function practiceSpinsAvail() {
  return Math.max(0, Math.floor(state.practiceClipTotal / 2) - state.practiceSpinsUsed);
}

function workoutSpinsAvail() {
  return Math.max(0, state.workoutClipTotal - state.workoutSpinsUsed);
}

function totalSpinsAvail() {
  return practiceSpinsAvail() + workoutSpinsAvail();
}

/* ─── Spin Logic ──────────────────────────────────────────────────────────── */

function spinWheel() {
  const r = Math.random();
  if (r < 0.40) return 'tier1';
  if (r < 0.70) return 'tier2';
  if (r < 0.90) return 'tier3';
  if (r < 0.98) return 'bonus';
  return 'jackpot';
}

function spinBonus(type) {
  const opts = type === 'practice' ? PRACTICE_BONUS_OPTIONS : WORKOUT_BONUS_OPTIONS;
  return opts[Math.floor(Math.random() * opts.length)];
}

function tierLabel(tier) {
  const map = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', jackpot: 'Jackpot', bonus: 'Bonus' };
  return map[tier] || tier;
}

/* ─── Screens ─────────────────────────────────────────────────────────────── */

let currentScreen = 'today';

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-screen="${name}"]`);
  if (btn) btn.classList.add('active');

  currentScreen = name;
  renderScreen(name);
}

function renderScreen(name) {
  if (name === 'today')     renderToday();
  if (name === 'inventory') renderInventory();
  if (name === 'progress')  renderProgress();
  if (name === 'settings')  renderSettings();
}

/* ─── TODAY SCREEN ────────────────────────────────────────────────────────── */

let bonusSpinType = 'practice';
let bonusSpinsRemaining = 0;

function renderToday() {
  document.getElementById('today-date').textContent = fmt(todayStr());

  document.getElementById('stat-blocks').textContent = state.practiceBlocks;
  document.getElementById('stat-questions').textContent = state.questionsToday;
  document.getElementById('stat-practice-spins').textContent = practiceSpinsAvail();
  document.getElementById('stat-workout-spins').textContent = workoutSpinsAvail();
  document.getElementById('stat-total-spins').textContent = totalSpinsAvail();

  // Daily checkpoint badge
  const badge = document.getElementById('daily-checkpoint-badge');
  if (state.questionsToday >= 10) {
    badge.textContent = 'Done';
    badge.classList.add('done');
  } else {
    badge.textContent = `${state.questionsToday}/10`;
    badge.classList.remove('done');
  }

  // Workout button
  const wBtn = document.getElementById('workout-btn');
  if (state.workoutDone) {
    wBtn.textContent = 'Workout Done ✓';
    wBtn.disabled = true;
  } else {
    wBtn.textContent = 'Mark Workout Done';
    wBtn.disabled = false;
  }

  // Questions input
  const qi = document.getElementById('questions-input');
  qi.value = state.questionsToday > 0 ? state.questionsToday : '';
  qi.placeholder = state.questionsToday > 0 ? String(state.questionsToday) : '0';

  // Spin select: only show available types
  const selType = document.getElementById('spin-type-select');
  const pAvail = practiceSpinsAvail();
  const wAvail = workoutSpinsAvail();

  // Update spin button state
  const spinBtn = document.getElementById('spin-btn');
  const selectedType = selType.value;
  const selectedAvail = selectedType === 'practice' ? pAvail : wAvail;

  if (selectedType === 'practice' && pAvail > 0 && state.practiceBlocks < 3) {
    spinBtn.disabled = true;
    spinBtn.textContent = 'Need 3 practice blocks first';
  } else if (selectedAvail === 0) {
    spinBtn.disabled = true;
    spinBtn.textContent = 'No spins available';
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = 'Spin the Wheel';
  }

  updateBonusCard();
}

function updateBonusCard() {
  const card = document.getElementById('bonus-card');
  if (bonusSpinsRemaining > 0) {
    card.classList.remove('hidden');
    const btn = document.getElementById('spin-bonus-btn');
    btn.textContent = bonusSpinsRemaining === 1 ? 'Spin Bonus Wheel' : `Spin Bonus Wheel (×${bonusSpinsRemaining})`;
  } else {
    card.classList.add('hidden');
  }
}

function doSpin(type) {
  const result = spinWheel();
  const reward = state.rewards[type][result] || '';

  // Deduct spin
  if (type === 'practice') {
    state.practiceSpinsUsed++;
  } else {
    state.workoutSpinsUsed++;
  }

  // Add to history
  state.history.unshift({
    date: todayStr(),
    type,
    tier: result,
    reward,
  });
  if (state.history.length > 60) state.history = state.history.slice(0, 60);

  saveState();

  const area = document.getElementById('spin-result-area');
  area.classList.remove('hidden');

  if (result === 'bonus') {
    area.innerHTML = `<div class="result-tier">Bonus!</div><div class="result-text">Spin the bonus wheel to find out your extra challenge.</div>`;
    bonusSpinType = type;
    bonusSpinsRemaining = 1;
    updateBonusCard();
  } else {
    area.innerHTML = `<div class="result-tier">${tierLabel(result)}</div><div class="result-text">${reward}</div>`;
    bonusSpinsRemaining = 0;
    updateBonusCard();
  }

  renderToday();
}

function doBonus() {
  if (bonusSpinsRemaining <= 0) return;

  const result = spinBonus(bonusSpinType);
  const area = document.getElementById('bonus-result-area');
  area.innerHTML = `<div class="result-tier">Bonus Result</div><div class="result-text">${result}</div>`;

  // Check if it's a double spin
  const isDouble = result.toLowerCase().includes('twice');

  bonusSpinsRemaining--;
  if (isDouble) bonusSpinsRemaining += 2;

  updateBonusCard();

  // Add free clip if applicable
  if (result.toLowerCase().includes('free clip')) {
    const c = randomColor();
    state.practiceClips[c]++;
    state.practiceClipTotal++;
    saveState();
  }

  renderToday();
}

/* ─── INVENTORY SCREEN ────────────────────────────────────────────────────── */

function renderClipsGrid(containerId, clips) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  for (const color of ALL_COLORS) {
    const count = clips[color] || 0;
    const item = document.createElement('div');
    item.className = 'clip-item';
    item.innerHTML = `
      <div class="clip-dot clip-${color}"></div>
      <span class="clip-count">${count}</span>
      <span class="clip-name">${color}</span>
    `;
    el.appendChild(item);
  }
}

function buildCashinButtons(clips, type) {
  const section = document.getElementById(`${type}-cashin-section`);
  section.innerHTML = '';

  const options = getCashinOptions(clips);
  if (options.length === 0) {
    section.innerHTML = '<p class="empty-msg" style="padding:0 0 4px">No matching clips to cash in yet.</p>';
    return;
  }

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'cashin-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      if (!window.confirm(`Cash in ${opt.label.split(':')[0]}?`)) return;
      // Remove clips
      for (const [color, count] of Object.entries(opt.spend)) {
        state[`${type}Clips`][color] -= count;
      }
      const reward = state.rewards[type][opt.tier] || tierLabel(opt.tier);
      state.history.unshift({
        date: todayStr(),
        type: `${type} cash-in`,
        tier: opt.tier,
        reward,
      });
      if (state.history.length > 60) state.history = state.history.slice(0, 60);
      saveState();
      alert(`${tierLabel(opt.tier)} unlocked!\n\n${reward}`);
      renderInventory();
    });
    section.appendChild(btn);
  }
}

function getCashinOptions(clips) {
  const options = [];

  // Check for 1 gold clip → Tier 3
  if (clips[GOLD] >= 1) {
    options.push({
      label: '1 gold clip: Tier 3',
      tier: 'tier3',
      spend: { gold: 1 },
    });
  }

  // Check matching normal colors
  for (const color of CLIP_COLORS) {
    const count = clips[color] || 0;
    if (count >= 3) {
      options.push({
        label: `3 ${color} clips: Tier 3`,
        tier: 'tier3',
        spend: { [color]: 3 },
      });
    }
    if (count >= 2) {
      options.push({
        label: `2 ${color} clips: Tier 2`,
        tier: 'tier2',
        spend: { [color]: 2 },
      });
    }
  }

  return options;
}

function renderInventory() {
  renderClipsGrid('practice-clips-grid', state.practiceClips);
  renderClipsGrid('workout-clips-grid', state.workoutClips);

  // Tier display
  const pTotal = totalClips(state.practiceClips);
  const wTotal = totalClips(state.workoutClips);

  const ptd = document.getElementById('practice-tier-display');
  ptd.textContent = pTotal === 1 ? '1 clip — 1 more for a spin' :
    pTotal > 1 ? `${pTotal} clips · ${Math.floor(pTotal / 2)} potential spin${Math.floor(pTotal / 2) !== 1 ? 's' : ''}` :
    'No practice clips yet.';

  const wtd = document.getElementById('workout-tier-display');
  wtd.textContent = wTotal > 0 ? `${wTotal} clip${wTotal !== 1 ? 's' : ''}` : 'No workout clips yet.';

  buildCashinButtons(state.practiceClips, 'practice');
  buildCashinButtons(state.workoutClips, 'workout');
}

/* ─── PROGRESS SCREEN ─────────────────────────────────────────────────────── */

function renderProgress() {
  const q = state.totalQuestions;
  const d = state.practiceDays;
  const w = state.weekWorkouts;
  const wq = state.weekQuestions;

  document.getElementById('prog-questions-label').textContent = `${q} / 400`;
  document.getElementById('prog-days-label').textContent = `${d} / 40`;
  document.getElementById('prog-workouts-label').textContent = `${w} / 4`;
  document.getElementById('prog-week-questions').textContent = `${wq} / 70`;

  setWidth('prog-questions-bar', Math.min(100, (q / 400) * 100));
  setWidth('prog-days-bar', Math.min(100, (d / 40) * 100));
  setWidth('prog-workouts-bar', Math.min(100, (w / 4) * 100));

  // Weekly checkpoint
  const wb = document.getElementById('weekly-checkpoint-badge');
  if (wq >= 70) {
    wb.textContent = 'Done';
    wb.classList.add('done');
  } else {
    wb.textContent = `${wq}/70`;
    wb.classList.remove('done');
  }

  // History
  const listEl = document.getElementById('history-list');
  if (state.history.length === 0) {
    listEl.innerHTML = '<p class="empty-msg">No history yet.</p>';
    return;
  }
  listEl.innerHTML = '';
  for (const entry of state.history) {
    const row = document.createElement('div');
    row.className = 'history-entry';
    row.innerHTML = `
      <span class="history-date">${fmt(entry.date)}<br>${entry.type}</span>
      <span class="history-detail">${tierLabel(entry.tier)}<br><span style="color:var(--text-muted);font-size:12px">${entry.reward || ''}</span></span>
    `;
    listEl.appendChild(row);
  }
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

/* ─── SETTINGS SCREEN ─────────────────────────────────────────────────────── */

function renderSettings() {
  renderRewardFields('practice-reward-fields', 'practice');
  renderRewardFields('workout-reward-fields', 'workout');
}

function renderRewardFields(containerId, type) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const tiers = ['tier1', 'tier2', 'tier3', 'jackpot', 'bonus'];
  const labels = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', jackpot: 'Jackpot', bonus: 'Bonus' };
  for (const tier of tiers) {
    const row = document.createElement('div');
    row.className = 'reward-field-row';
    row.innerHTML = `
      <label class="reward-field-label">${labels[tier]}</label>
      <input class="reward-input" type="text" data-type="${type}" data-tier="${tier}" value="${escapeHtml(state.rewards[type][tier] || '')}" />
    `;
    el.appendChild(row);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function saveRewards() {
  document.querySelectorAll('.reward-input').forEach(input => {
    const type = input.dataset.type;
    const tier = input.dataset.tier;
    state.rewards[type][tier] = input.value.trim();
  });
  saveState();
  const btn = document.getElementById('save-rewards-btn');
  btn.textContent = 'Saved!';
  setTimeout(() => { btn.textContent = 'Save Reward Text'; }, 1500);
}

/* ─── EXPORT / IMPORT / RESET ────────────────────────────────────────────── */

function exportData() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habit-wheel-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object') throw new Error('invalid');
      state = { ...defaultState(), ...imported };
      saveState();
      renderScreen(currentScreen);
      alert('Backup imported successfully.');
    } catch (err) {
      alert('Could not read backup file. Please check the JSON is valid.');
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  state = defaultState();
  saveState();
  bonusSpinsRemaining = 0;
  const area = document.getElementById('spin-result-area');
  area.innerHTML = '';
  area.classList.add('hidden');
  const bonus = document.getElementById('bonus-result-area');
  bonus.innerHTML = '';
  renderScreen(currentScreen);
}

/* ─── CONFIRM MODAL ───────────────────────────────────────────────────────── */

let confirmCallback = null;

function showConfirm(message, onConfirm) {
  document.getElementById('confirm-msg').textContent = message;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  confirmCallback = onConfirm;
}

function hideConfirm() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  confirmCallback = null;
}

/* ─── EVENT LISTENERS ─────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  checkDateReset();

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Log practice block
  document.getElementById('log-block-btn').addEventListener('click', () => {
    state.practiceBlocks++;

    const color = randomColor();
    state.practiceClips[color]++;
    state.practiceClipTotal++;

    saveState();
    renderToday();

    const btn = document.getElementById('log-block-btn');
    btn.textContent = `+ Block ${state.practiceBlocks} logged`;
    setTimeout(() => { btn.textContent = '+ Log 25-min Practice Block'; }, 1200);
  });

  // Save questions
  document.getElementById('save-questions-btn').addEventListener('click', () => {
    const val = parseInt(document.getElementById('questions-input').value, 10);
    if (isNaN(val) || val < 0) return;

    const prev = state.questionsToday;
    state.questionsToday = val;
    const diff = val - prev;
    if (diff > 0) {
      state.totalQuestions += diff;
      state.weekQuestions += diff;
    }

    saveState();
    renderToday();

    const btn = document.getElementById('save-questions-btn');
    btn.textContent = 'Saved';
    setTimeout(() => { btn.textContent = 'Save'; }, 1200);
  });

  // Workout
  document.getElementById('workout-btn').addEventListener('click', () => {
    if (state.workoutDone) return;
    state.workoutDone = true;
    const wColor = randomColor();
    state.workoutClips[wColor]++;
    state.workoutClipTotal++;
    state.weekWorkouts++;

    saveState();
    renderToday();
  });

  // Spin type change
  document.getElementById('spin-type-select').addEventListener('change', renderToday);

  // Spin wheel
  document.getElementById('spin-btn').addEventListener('click', () => {
    const type = document.getElementById('spin-type-select').value;
    const avail = type === 'practice' ? practiceSpinsAvail() : workoutSpinsAvail();
    if (avail <= 0) return;

    const btn = document.getElementById('spin-btn');
    btn.disabled = true;
    btn.textContent = 'spinning…';

    setTimeout(() => {
      doSpin(type);
    }, 600);
  });

  // Spin bonus
  document.getElementById('spin-bonus-btn').addEventListener('click', () => {
    if (bonusSpinsRemaining <= 0) return;
    doBonus();
  });

  // Save rewards
  document.getElementById('save-rewards-btn').addEventListener('click', saveRewards);

  // Export
  document.getElementById('export-btn').addEventListener('click', exportData);

  // Import
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });

  // Reset
  document.getElementById('reset-btn').addEventListener('click', () => {
    showConfirm('This will permanently delete all your data. Are you sure?', resetAll);
  });

  // Confirm modal
  document.getElementById('confirm-yes').addEventListener('click', () => {
    hideConfirm();
    if (confirmCallback) confirmCallback();
  });
  document.getElementById('confirm-no').addEventListener('click', hideConfirm);
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-overlay')) hideConfirm();
  });

  // Initial render
  showScreen('today');
});
