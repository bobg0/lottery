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
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(new Date().setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function randomColor() {
  return CLIP_COLORS[Math.floor(Math.random() * CLIP_COLORS.length)];
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function totalClips(clips) {
  return Object.values(clips).reduce((a, b) => a + b, 0);
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.floor((db - da) / 86400000);
}

function extractMinutes(text) {
  const range = text.match(/(\d+)\s*[–\-]\s*(\d+)\s*min/i);
  if (range) return `${range[1]}–${range[2]} min`;
  const single = text.match(/(\d+)\s*min/i);
  if (single) return `${single[1]} min`;
  const hours = text.match(/(\d+)\s*hour/i);
  if (hours) return `${parseInt(hours[1]) * 60} min`;
  return '';
}

/* ─── State ───────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'habit_wheel_state';

function defaultState() {
  return {
    startDate:  todayStr(),
    lastDate:   todayStr(),
    weekStart:  weekStartStr(),

    practiceBlocks: 0,
    questionsToday: 0,
    workoutDone:    false,

    practiceClips:     Object.fromEntries(ALL_COLORS.map(c => [c, 0])),
    workoutClips:      Object.fromEntries(ALL_COLORS.map(c => [c, 0])),
    practiceClipTotal: 0,
    practiceSpinsUsed: 0,
    workoutClipTotal:  0,
    workoutSpinsUsed:  0,

    totalQuestions: 0,
    weekQuestions:  0,
    practiceDays:   0,
    weekWorkouts:   0,

    dailyHistory: [],   // [{date, questions}] finalized per-day
    history:      [],   // spin / cash-in / claimed log
    bankedRewards: [],  // [{id, reward, type, tier, date}]
    bankedNextId:   1,

    rewards: JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const def = defaultState();
    for (const k of Object.keys(def)) {
      if (s[k] === undefined) s[k] = def[k];
    }
    for (const c of ALL_COLORS) {
      if (s.practiceClips[c] === undefined) s.practiceClips[c] = 0;
      if (s.workoutClips[c]  === undefined) s.workoutClips[c]  = 0;
    }
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

/* ─── Undo Stack ──────────────────────────────────────────────────────────── */

let undoStack = []; // [{label, state}]
const MAX_UNDO = 10;

function pushUndo(label) {
  undoStack.push({ label, state: JSON.parse(JSON.stringify(state)) });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  renderUndoBtn();
}

function undoLast() {
  if (!undoStack.length) return;
  const entry = undoStack.pop();
  state = entry.state;
  saveState();

  // Reset transient spin state
  currentSpinResult = null;
  bonusSpinsRemaining = 0;

  const ra = document.getElementById('spin-result-area');
  if (ra) { ra.innerHTML = ''; ra.classList.add('hidden'); }
  const sa = document.getElementById('spin-actions');
  if (sa) sa.classList.add('hidden');
  const bs = document.getElementById('bonus-section');
  if (bs) { bs.classList.add('hidden'); bs.style.display = 'none'; }
  const bra = document.getElementById('bonus-result-area');
  if (bra) { bra.innerHTML = ''; bra.classList.add('hidden'); }

  renderScreen(currentScreen);
  renderUndoBtn();
}

function renderUndoBtn() {
  const btn = document.getElementById('undo-btn');
  if (!btn) return;
  if (undoStack.length) {
    btn.textContent = `Undo: ${undoStack[undoStack.length - 1].label}`;
    btn.disabled = false;
  } else {
    btn.textContent = 'Nothing to undo';
    btn.disabled = true;
  }
}

/* ─── Daily / Weekly Reset ────────────────────────────────────────────────── */

function checkDateReset() {
  const today = todayStr();
  const ws    = weekStartStr();

  if (state.lastDate !== today) {
    // Archive yesterday's question count
    state.dailyHistory.push({ date: state.lastDate, questions: state.questionsToday });
    if (state.dailyHistory.length > 60) state.dailyHistory.shift();

    if (state.practiceBlocks > 0) state.practiceDays++;
    state.practiceBlocks = 0;
    state.questionsToday = 0;
    state.workoutDone    = false;
    state.lastDate       = today;
  }

  if (state.weekStart !== ws) {
    state.weekQuestions = 0;
    state.weekWorkouts  = 0;
    state.weekStart     = ws;
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

// How many days (including today) since the start date
function dayNumber() {
  return daysBetween(state.startDate, todayStr()) + 1;
}

function expectedQuestions() {
  return Math.min(dayNumber() * 10, 400);
}

function cumulativeDelta() {
  return state.totalQuestions - expectedQuestions();
}

function dailyDelta() {
  return state.questionsToday - 10;
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
  return { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', jackpot: 'Jackpot', bonus: 'Bonus' }[tier] || tier;
}

/* ─── Screens ─────────────────────────────────────────────────────────────── */

let currentScreen = 'today';
let spinType = 'practice';
let bonusSpinType = 'practice';
let bonusSpinsRemaining = 0;
let currentSpinResult = null; // {tier, reward, type} — pending bank/claim

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const screen = document.getElementById(`screen-${name}`);
  if (screen) { screen.classList.add('active'); screen.style.display = ''; }

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

/* ─── TODAY ───────────────────────────────────────────────────────────────── */

function renderToday() {
  // Header date
  const d = new Date();
  document.getElementById('today-date').textContent =
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Practice block stat
  const b = state.practiceBlocks;
  document.getElementById('block-stat-line').textContent =
    `${b} block${b !== 1 ? 's' : ''} today · ${b} clip${b !== 1 ? 's' : ''} earned`;

  // Questions count
  document.getElementById('q-count').textContent = state.questionsToday;
  const badge = document.getElementById('q-goal-badge');
  if (state.questionsToday >= 10) {
    badge.textContent = 'Done';
    badge.classList.add('done');
  } else {
    badge.textContent = `${state.questionsToday}/10`;
    badge.classList.remove('done');
  }

  // Deficit / surplus
  const dd = dailyDelta();
  const cd = cumulativeDelta();
  const dailyBtn = document.getElementById('daily-delta-btn');
  dailyBtn.className = 'deficit-btn';
  if (dd < 0) {
    dailyBtn.textContent = `Deficit: ${dd} today`;
    dailyBtn.classList.add('neg');
  } else if (dd > 0) {
    dailyBtn.textContent = `Surplus: +${dd} today`;
    dailyBtn.classList.add('pos');
  } else {
    dailyBtn.textContent = 'On pace today';
  }

  const overallEl = document.getElementById('overall-delta-label');
  overallEl.className = 'overall-label';
  if (cd < 0) {
    overallEl.textContent = `Overall: ${cd} behind`;
    overallEl.classList.add('neg');
  } else if (cd > 0) {
    overallEl.textContent = `Overall: +${cd} ahead`;
    overallEl.classList.add('pos');
  } else {
    overallEl.textContent = 'Overall: on pace';
  }

  // Workout button
  const wBtn = document.getElementById('workout-btn');
  const wLine = document.getElementById('workout-stat-line');
  if (state.workoutDone) {
    wBtn.textContent = 'Workout Done';
    wBtn.disabled = true;
    wLine.classList.remove('hidden');
  } else {
    wBtn.textContent = 'Mark Workout Done';
    wBtn.disabled = false;
    wLine.classList.add('hidden');
  }

  // Spins
  const pAvail = practiceSpinsAvail();
  const wAvail = workoutSpinsAvail();
  const total = pAvail + wAvail;
  document.getElementById('spins-avail-label').textContent =
    total === 1 ? '1 available' : `${total} available`;

  // Spin toggle
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.spintype === spinType);
  });

  // Spin button
  const spinBtn = document.getElementById('spin-btn');
  const currentAvail = spinType === 'practice' ? pAvail : wAvail;
  if (spinType === 'practice' && pAvail > 0 && state.practiceBlocks < 3) {
    spinBtn.disabled = true;
    spinBtn.textContent = 'Need 3 blocks first';
  } else if (currentAvail === 0) {
    spinBtn.disabled = true;
    spinBtn.textContent = 'No spins available';
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = 'Spin';
  }

  // Bonus section
  updateBonusSection();

  // Undo btn
  renderUndoBtn();
}

function updateBonusSection() {
  const section = document.getElementById('bonus-section');
  if (bonusSpinsRemaining > 0) {
    section.classList.remove('hidden');
    section.style.display = '';
    const btn = document.getElementById('spin-bonus-btn');
    btn.textContent = bonusSpinsRemaining > 1
      ? `Spin Bonus Wheel (${bonusSpinsRemaining} left)`
      : 'Spin Bonus Wheel';
  } else {
    section.classList.add('hidden');
    section.style.display = 'none';
  }
}

function doSpin(type) {
  pushUndo('spin');

  const tier = spinWheel();
  const reward = state.rewards[type][tier] || '';

  if (type === 'practice') state.practiceSpinsUsed++;
  else state.workoutSpinsUsed++;

  saveState();

  currentSpinResult = { tier, reward, type };

  const area = document.getElementById('spin-result-area');
  area.classList.remove('hidden');

  if (tier === 'bonus') {
    area.innerHTML = `<div class="result-tier">Bonus</div><div class="result-text">Spin the bonus wheel to reveal your challenge.</div>`;
    bonusSpinType = type;
    bonusSpinsRemaining = 1;

    const bonusArea = document.getElementById('bonus-result-area');
    bonusArea.innerHTML = '';
    bonusArea.classList.add('hidden');
  } else {
    area.innerHTML = `<div class="result-tier">${tierLabel(tier)}</div><div class="result-text">${reward}</div>`;
    bonusSpinsRemaining = 0;
  }

  // Show bank/claim buttons
  const spinActions = document.getElementById('spin-actions');
  spinActions.classList.remove('hidden');

  renderToday();
}

function doBonus() {
  if (bonusSpinsRemaining <= 0) return;

  const result = spinBonus(bonusSpinType);
  const bonusArea = document.getElementById('bonus-result-area');
  bonusArea.classList.remove('hidden');
  bonusArea.innerHTML = `<div class="result-tier">Bonus Result</div><div class="result-text">${result}</div>`;

  const isDouble = result.toLowerCase().includes('twice');
  bonusSpinsRemaining--;
  if (isDouble) bonusSpinsRemaining += 2;

  if (result.toLowerCase().includes('free clip')) {
    const c = randomColor();
    state.practiceClips[c]++;
    state.practiceClipTotal++;
    saveState();
  }

  renderToday();
}

function bankReward() {
  if (!currentSpinResult) return;
  pushUndo('bank reward');

  const { tier, reward, type } = currentSpinResult;
  state.bankedRewards.push({
    id:     state.bankedNextId++,
    reward,
    type,
    tier,
    date:   todayStr(),
  });
  saveState();

  currentSpinResult = null;
  clearSpinResult();
  renderToday();
}

function claimSpinNow() {
  if (!currentSpinResult) return;
  pushUndo('claim reward');

  const { tier, reward, type } = currentSpinResult;
  state.history.unshift({ date: todayStr(), type, tier, reward, claimed: true });
  if (state.history.length > 80) state.history = state.history.slice(0, 80);
  saveState();

  currentSpinResult = null;
  clearSpinResult();
  renderToday();
}

function clearSpinResult() {
  const area = document.getElementById('spin-result-area');
  if (area) { area.innerHTML = ''; area.classList.add('hidden'); }
  const actions = document.getElementById('spin-actions');
  if (actions) actions.classList.add('hidden');
  bonusSpinsRemaining = 0;
  updateBonusSection();
}

function claimBankedReward(id) {
  pushUndo('claim banked reward');

  const idx = state.bankedRewards.findIndex(r => r.id === id);
  if (idx === -1) return;
  const r = state.bankedRewards.splice(idx, 1)[0];

  state.history.unshift({ date: todayStr(), type: `${r.type} (banked)`, tier: r.tier, reward: r.reward, claimed: true });
  if (state.history.length > 80) state.history = state.history.slice(0, 80);
  saveState();
  renderInventory();
}

function deleteBankedReward(id) {
  pushUndo('delete banked reward');
  state.bankedRewards = state.bankedRewards.filter(r => r.id !== id);
  saveState();
  renderInventory();
}

/* ─── DEFICIT DETAIL ──────────────────────────────────────────────────────── */

function showDeficitDetail() {
  const body = document.getElementById('deficit-body');
  const expected = expectedQuestions();
  const total = state.totalQuestions;
  const cd = total - expected;
  const remaining = Math.max(0, 400 - total);
  const dn = dayNumber();
  const daysLeft = Math.max(0, 40 - dn);
  const needed = daysLeft > 0 ? (remaining / daysLeft).toFixed(1) : '—';

  // Stats grid
  const cdClass = cd < 0 ? 'neg' : cd > 0 ? 'pos' : '';
  body.innerHTML = `
    <div class="deficit-stats-grid">
      <div class="dstat-box">
        <div class="dstat-val">${total}</div>
        <div class="dstat-label">Completed</div>
      </div>
      <div class="dstat-box">
        <div class="dstat-val">${expected}</div>
        <div class="dstat-label">Expected by today</div>
      </div>
      <div class="dstat-box">
        <div class="dstat-val ${cdClass}">${cd >= 0 ? '+' : ''}${cd}</div>
        <div class="dstat-label">Cumulative delta</div>
      </div>
      <div class="dstat-box">
        <div class="dstat-val">${remaining}</div>
        <div class="dstat-label">Remaining</div>
      </div>
      <div class="dstat-box">
        <div class="dstat-val">${daysLeft}</div>
        <div class="dstat-label">Days left</div>
      </div>
      <div class="dstat-box">
        <div class="dstat-val">${needed}</div>
        <div class="dstat-label">Needed / day</div>
      </div>
    </div>
  `;

  // Build chart from dailyHistory + today
  const allDays = [
    ...state.dailyHistory,
    { date: todayStr(), questions: state.questionsToday },
  ].slice(-20); // last 20 days

  if (allDays.length === 0) {
    body.innerHTML += `<p class="chart-empty">No history yet. Come back after a few days.</p>`;
  } else {
    const deltas = allDays.map(d => ({ date: d.date, delta: d.questions - 10 }));
    const maxAbs = Math.max(1, ...deltas.map(d => Math.abs(d.delta)));

    let chartHtml = `<div class="chart-section-label">Daily question delta (goal: 10/day)</div>`;
    for (const { date, delta } of deltas) {
      const pct = Math.min(48, (Math.abs(delta) / maxAbs) * 48);
      const valClass = delta < 0 ? 'neg' : delta > 0 ? 'pos' : 'zero';
      const valStr = delta === 0 ? '0' : delta > 0 ? `+${delta}` : `${delta}`;

      let barHtml = '';
      if (delta > 0) {
        barHtml = `<div class="chart-bar chart-bar-pos" style="width:${pct}%"></div>`;
      } else if (delta < 0) {
        barHtml = `<div class="chart-bar chart-bar-neg" style="width:${pct}%"></div>`;
      }

      chartHtml += `
        <div class="chart-row">
          <span class="chart-date">${fmtDate(date)}</span>
          <div class="chart-axis-wrap">
            <div class="chart-center"></div>
            ${barHtml}
          </div>
          <span class="chart-val ${valClass}">${valStr}</span>
        </div>
      `;
    }
    body.innerHTML += chartHtml;
  }

  document.getElementById('deficit-overlay').classList.remove('hidden');
}

/* ─── INVENTORY ───────────────────────────────────────────────────────────── */

function renderClipsTable(containerId, clips) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  let hasAny = false;
  for (const color of ALL_COLORS) {
    const count = clips[color] || 0;
    if (count === 0) continue;
    hasAny = true;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="clip-swatch swatch-${color}"></span>${color.charAt(0).toUpperCase() + color.slice(1)}</td>
      <td>${count}</td>
    `;
    el.appendChild(tr);
  }
  if (!hasAny) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="2" class="empty-msg">No clips yet.</td>`;
    el.appendChild(tr);
  }
}

function buildCashinButtons(clips, type) {
  const section = document.getElementById(`${type}-cashin-section`);
  section.innerHTML = '';
  const options = getCashinOptions(clips);
  if (!options.length) return;

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'cashin-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      showConfirm(`Cash in: ${opt.label}?`, () => {
        pushUndo('cash-in');
        for (const [color, count] of Object.entries(opt.spend)) {
          state[`${type}Clips`][color] -= count;
        }
        const reward = state.rewards[type][opt.tier] || tierLabel(opt.tier);
        state.history.unshift({ date: todayStr(), type: `${type} cash-in`, tier: opt.tier, reward });
        if (state.history.length > 80) state.history = state.history.slice(0, 80);
        saveState();
        alert(`${tierLabel(opt.tier)} unlocked!\n\n${reward}`);
        renderInventory();
      });
    });
    section.appendChild(btn);
  }
}

function getCashinOptions(clips) {
  const options = [];
  if (clips[GOLD] >= 1) {
    options.push({ label: '1 gold clip — Tier 3', tier: 'tier3', spend: { gold: 1 } });
  }
  for (const color of CLIP_COLORS) {
    const count = clips[color] || 0;
    if (count >= 3) options.push({ label: `3 ${color} clips — Tier 3`, tier: 'tier3', spend: { [color]: 3 } });
    if (count >= 2) options.push({ label: `2 ${color} clips — Tier 2`, tier: 'tier2', spend: { [color]: 2 } });
  }
  return options;
}

function renderBankedRewards() {
  const el = document.getElementById('banked-rewards-list');
  if (!state.bankedRewards.length) {
    el.innerHTML = '<p class="empty-msg">No banked rewards yet.</p>';
    return;
  }
  el.innerHTML = '';
  for (const r of state.bankedRewards) {
    const mins = extractMinutes(r.reward);
    const item = document.createElement('div');
    item.className = 'banked-item';
    item.innerHTML = `
      <div class="banked-name">${r.reward}</div>
      <div class="banked-meta">${r.type.charAt(0).toUpperCase() + r.type.slice(1)} · ${tierLabel(r.tier)}${mins ? ' · ' + mins : ''} · ${fmtDateLong(r.date)}</div>
      <div class="banked-actions">
        <button class="banked-btn claim" data-id="${r.id}">Claim</button>
        <button class="banked-btn del" data-id="${r.id}">Delete</button>
      </div>
    `;
    item.querySelector('.banked-btn.claim').addEventListener('click', () => {
      claimBankedReward(r.id);
    });
    item.querySelector('.banked-btn.del').addEventListener('click', () => {
      showConfirm('Delete this banked reward?', () => deleteBankedReward(r.id));
    });
    el.appendChild(item);
  }
}

function renderInventory() {
  renderBankedRewards();
  renderClipsTable('practice-clips-grid', state.practiceClips);
  renderClipsTable('workout-clips-grid', state.workoutClips);

  const pTotal = totalClips(state.practiceClips);
  const wTotal = totalClips(state.workoutClips);

  const ptd = document.getElementById('practice-tier-display');
  if (pTotal === 0) ptd.textContent = 'No clips yet. Log practice blocks to earn clips.';
  else if (pTotal === 1) ptd.textContent = '1 clip — 1 more to unlock a spin';
  else {
    const spins = Math.floor(pTotal / 2);
    ptd.textContent = `${pTotal} clips — ${spins} spin${spins !== 1 ? 's' : ''} available`;
  }

  const wtd = document.getElementById('workout-tier-display');
  if (wTotal === 0) wtd.textContent = 'No clips yet. Complete workouts to earn clips.';
  else wtd.textContent = `${wTotal} clip${wTotal !== 1 ? 's' : ''} — ${wTotal} spin${wTotal !== 1 ? 's' : ''} available`;

  buildCashinButtons(state.practiceClips, 'practice');
  buildCashinButtons(state.workoutClips, 'workout');
}

/* ─── PROGRESS ────────────────────────────────────────────────────────────── */

function renderProgress() {
  const q  = state.totalQuestions;
  const d  = state.practiceDays;
  const w  = state.weekWorkouts;
  const wq = state.weekQuestions;

  document.getElementById('prog-questions-label').textContent = `${q} / 400`;
  document.getElementById('prog-days-label').textContent      = `${d} / 40`;
  document.getElementById('prog-workouts-label').textContent  = `${w} / 4`;
  document.getElementById('prog-week-questions').textContent  = wq;

  setWidth('prog-questions-bar', Math.min(100, (q / 400) * 100));
  setWidth('prog-days-bar',      Math.min(100, (d /  40) * 100));
  setWidth('prog-workouts-bar',  Math.min(100, (w /   4) * 100));

  const wb = document.getElementById('weekly-checkpoint-badge');
  if (wq >= 70) {
    wb.textContent = 'Done';
    wb.classList.add('done');
  } else {
    wb.textContent = `${wq}/70`;
    wb.classList.remove('done');
  }

  const listEl = document.getElementById('history-list');
  if (!state.history.length) {
    listEl.innerHTML = '<p class="empty-msg">No history yet.</p>';
    return;
  }
  listEl.innerHTML = '';
  for (const entry of state.history) {
    const row = document.createElement('div');
    row.className = 'history-entry';
    row.innerHTML = `
      <div class="history-left">${fmtDateLong(entry.date)}<br>${entry.type}</div>
      <div class="history-right">${tierLabel(entry.tier)}<br><span class="history-reward">${entry.reward || ''}</span></div>
    `;
    listEl.appendChild(row);
  }
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

/* ─── SETTINGS ────────────────────────────────────────────────────────────── */

function renderSettings() {
  renderRewardFields('practice-reward-fields', 'practice');
  renderRewardFields('workout-reward-fields', 'workout');
}

function renderRewardFields(containerId, type) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const tiers  = ['tier1', 'tier2', 'tier3', 'jackpot', 'bonus'];
  const labels = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', jackpot: 'Jackpot', bonus: 'Bonus' };
  for (const tier of tiers) {
    const row = document.createElement('div');
    row.className = 'reward-field';
    row.innerHTML = `
      <label>${labels[tier]}</label>
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
    state.rewards[input.dataset.type][input.dataset.tier] = input.value.trim();
  });
  saveState();
  const btn = document.getElementById('save-rewards-btn');
  btn.textContent = 'Saved';
  setTimeout(() => { btn.textContent = 'Save Reward Text'; }, 1500);
}

/* ─── DATA ────────────────────────────────────────────────────────────────── */

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `habit-wheel-${todayStr()}.json`;
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
      undoStack = [];
      renderScreen(currentScreen);
      alert('Backup imported.');
    } catch {
      alert('Could not read backup file.');
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  state = defaultState();
  saveState();
  undoStack = [];
  currentSpinResult = null;
  bonusSpinsRemaining = 0;
  spinType = 'practice';

  const ra = document.getElementById('spin-result-area');
  if (ra) { ra.innerHTML = ''; ra.classList.add('hidden'); }
  const sa = document.getElementById('spin-actions');
  if (sa) sa.classList.add('hidden');
  const bs = document.getElementById('bonus-section');
  if (bs) { bs.classList.add('hidden'); bs.style.display = 'none'; }

  renderScreen(currentScreen);
  renderUndoBtn();
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

/* ─── INIT ────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  checkDateReset();

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Spin type toggle
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => { spinType = btn.dataset.spintype; renderToday(); });
  });

  // Log practice block
  document.getElementById('log-block-btn').addEventListener('click', () => {
    pushUndo('log practice block');
    state.practiceBlocks++;
    const color = randomColor();
    state.practiceClips[color]++;
    state.practiceClipTotal++;
    saveState();

    const btn = document.getElementById('log-block-btn');
    btn.textContent = `Block ${state.practiceBlocks} logged`;
    setTimeout(() => { btn.textContent = 'Log Practice Block'; }, 1200);
    renderToday();
  });

  // +2 questions
  document.getElementById('q-plus2').addEventListener('click', () => {
    pushUndo('+2 questions');
    state.questionsToday += 2;
    state.totalQuestions += 2;
    state.weekQuestions  += 2;
    saveState();
    renderToday();
  });

  // -2 questions
  document.getElementById('q-minus2').addEventListener('click', () => {
    if (state.questionsToday === 0) return;
    pushUndo('-2 questions');
    const actual = Math.min(2, state.questionsToday);
    state.questionsToday  = Math.max(0, state.questionsToday - 2);
    state.totalQuestions  = Math.max(0, state.totalQuestions - actual);
    state.weekQuestions   = Math.max(0, state.weekQuestions  - actual);
    saveState();
    renderToday();
  });

  // Set exact
  document.getElementById('save-questions-btn').addEventListener('click', () => {
    const val = parseInt(document.getElementById('questions-input').value, 10);
    if (isNaN(val) || val < 0) return;
    pushUndo('set questions');
    const prev = state.questionsToday;
    state.questionsToday = val;
    const diff = val - prev;
    if (diff > 0) { state.totalQuestions += diff; state.weekQuestions += diff; }
    else if (diff < 0) {
      state.totalQuestions = Math.max(0, state.totalQuestions + diff);
      state.weekQuestions  = Math.max(0, state.weekQuestions  + diff);
    }
    saveState();
    renderToday();
    document.getElementById('questions-input').value = '';
    const btn = document.getElementById('save-questions-btn');
    btn.textContent = 'Set';
  });

  // Workout
  document.getElementById('workout-btn').addEventListener('click', () => {
    if (state.workoutDone) return;
    pushUndo('workout done');
    state.workoutDone = true;
    const color = randomColor();
    state.workoutClips[color]++;
    state.workoutClipTotal++;
    state.weekWorkouts++;
    saveState();
    renderToday();
  });

  // Spin
  document.getElementById('spin-btn').addEventListener('click', () => {
    const avail = spinType === 'practice' ? practiceSpinsAvail() : workoutSpinsAvail();
    if (avail <= 0) return;
    const btn = document.getElementById('spin-btn');
    btn.disabled = true;
    btn.textContent = 'Spinning...';
    setTimeout(() => doSpin(spinType), 500);
  });

  // Bank / Claim
  document.getElementById('bank-reward-btn').addEventListener('click', bankReward);
  document.getElementById('claim-now-btn').addEventListener('click', claimSpinNow);

  // Bonus spin
  document.getElementById('spin-bonus-btn').addEventListener('click', () => {
    if (bonusSpinsRemaining <= 0) return;
    doBonus();
  });

  // Deficit detail
  document.getElementById('daily-delta-btn').addEventListener('click', showDeficitDetail);
  document.getElementById('deficit-close').addEventListener('click', () => {
    document.getElementById('deficit-overlay').classList.add('hidden');
  });
  document.getElementById('deficit-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('deficit-overlay')) {
      document.getElementById('deficit-overlay').classList.add('hidden');
    }
  });

  // Undo
  document.getElementById('undo-btn').addEventListener('click', undoLast);

  // Settings
  document.getElementById('save-rewards-btn').addEventListener('click', saveRewards);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    showConfirm('This will permanently delete all your data. Are you sure?', resetAll);
  });

  // Confirm modal
  document.getElementById('confirm-yes').addEventListener('click', () => {
    hideConfirm();
    if (confirmCallback) confirmCallback();
  });
  ['confirm-no', 'confirm-no2'].forEach(id => {
    document.getElementById(id).addEventListener('click', hideConfirm);
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-overlay')) hideConfirm();
  });

  showScreen('today');
});
