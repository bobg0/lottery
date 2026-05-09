/* ═══ Habit Wheel v2 ══════════════════════════════════════════════════════ */

const DAILY_Q_GOAL   = 10;
const TOTAL_Q_GOAL   = 400;
const CHALLENGE_DAYS = 40;
const WO_WEEK_GOAL   = 8;
const STORAGE_KEY    = 'habit_wheel_v2';

/* ═══ Helpers ════════════════════════════════════════════════════════════ */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr() {
  const d   = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

function daysBetween(aStr, bStr) {
  return Math.floor((new Date(bStr) - new Date(aStr)) / 86400000);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, m, d] = dateStr.split('-');
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
}

function fmtTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  let h = d.getHours(), mn = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(mn).padStart(2, '0')} ${ap}`;
}

function fmtTimestamp() {
  const now = new Date();
  const H = String(now.getHours()).padStart(2, '0');
  const M = String(now.getMinutes()).padStart(2, '0');
  return `${todayStr()}-${H}${M}`;
}

function getDatesInWeek(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getDatesRange(startStr, endStr) {
  const dates = [];
  const end = new Date(endStr);
  const d   = new Date(startStr);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══ Default state ══════════════════════════════════════════════════════ */

function defaultState() {
  return {
    startDate: todayStr(),
    lastDate:  todayStr(),
    weekStart: weekStartStr(),

    sharedTokens: 0,

    practiceByDate:  {},   // { 'YYYY-MM-DD': blockCount }
    workoutByDate:   {},   // { 'YYYY-MM-DD': blockCount }
    questionsByDate: {},   // { 'YYYY-MM-DD': count }

    totalPracticeBlocks: 0,
    totalWorkoutBlocks:  0,
    totalQuestions:      0,

    rewardBlocks:     [],  // [{ id, earnedAt, tier }]  — 30 min each
    spentHistory:     [],  // [{ id, blocksSpent, minutesSpent, spentAt }]
    discardedHistory: [],  // [{ id, tier, rewardText, discardedAt }]

    nextId: 1,

    settings: {
      spinCost:               3,
      weeklyRewardCapMinutes: 600,
      rewards: {
        tier1:   { text: '30-minute reward block',  blocks: 1 },
        tier2:   { text: '60-minute reward block',  blocks: 2 },
        tier3:   { text: '90-minute reward block',  blocks: 3 },
        jackpot: { text: '120-minute reward block', blocks: 4 },
        bonus:   { text: 'Bonus challenge',         blocks: 0 },
      },
    },
  };
}

/* ═══ State persistence ══════════════════════════════════════════════════ */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s   = JSON.parse(raw);
    const def = defaultState();
    for (const k of Object.keys(def)) {
      if (s[k] === undefined) s[k] = def[k];
    }
    if (!s.settings)         s.settings         = def.settings;
    if (!s.settings.rewards) s.settings.rewards = def.settings.rewards;
    for (const t of ['tier1','tier2','tier3','jackpot','bonus']) {
      if (!s.settings.rewards[t]) s.settings.rewards[t] = def.settings.rewards[t];
    }
    return s;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ═══ Computed values ════════════════════════════════════════════════════ */

const getQToday        = ()  => state.questionsByDate[todayStr()] || 0;
const getPracToday     = ()  => state.practiceByDate[todayStr()]  || 0;
const getWorkToday     = ()  => state.workoutByDate[todayStr()]   || 0;
const getSpinsAvail    = ()  => Math.floor(state.sharedTokens / state.settings.spinCost);

function dayNumber() {
  return daysBetween(state.startDate, todayStr()) + 1;
}

function expectedQuestions() {
  return Math.min(dayNumber() * DAILY_Q_GOAL, TOTAL_Q_GOAL);
}

function getWeekWorkBlocks() {
  return getDatesInWeek(state.weekStart)
    .reduce((s, d) => s + (state.workoutByDate[d] || 0), 0);
}

function rollingAvg(n) {
  const yd  = new Date();
  yd.setDate(yd.getDate() - 1);
  const ydStr = yd.toISOString().slice(0, 10);
  if (ydStr < state.startDate) return null;
  const all   = getDatesRange(state.startDate, ydStr);
  const lastN = all.slice(-n);
  if (!lastN.length) return null;
  return lastN.reduce((s, d) => s + (state.questionsByDate[d] || 0), 0) / lastN.length;
}

function spentTodayMin() {
  const t = todayStr();
  return state.spentHistory
    .filter(e => e.spentAt.startsWith(t))
    .reduce((s, e) => s + e.minutesSpent, 0);
}

function spentWeekMin() {
  const dates = getDatesInWeek(state.weekStart);
  return state.spentHistory
    .filter(e => dates.includes(e.spentAt.slice(0, 10)))
    .reduce((s, e) => s + e.minutesSpent, 0);
}

/* ═══ Date reset ═════════════════════════════════════════════════════════ */

function checkDateReset() {
  const today = todayStr();
  const ws    = weekStartStr();
  if (state.lastDate !== today) state.lastDate = today;
  if (state.weekStart !== ws)   state.weekStart = ws;
  saveState();
}

/* ═══ Screen navigation ══════════════════════════════════════════════════ */

let currentScreen = 'today';

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const scr = document.getElementById(`screen-${name}`);
  if (scr) { scr.classList.add('active'); scr.style.display = ''; }

  const btn = document.querySelector(`.nav-btn[data-screen="${name}"]`);
  if (btn) btn.classList.add('active');

  currentScreen = name;
  renderScreen(name);
}

function renderScreen(name) {
  if (name === 'today')     renderToday();
  if (name === 'progress')  renderProgress();
  if (name === 'rewards')   renderRewards();
  if (name === 'inventory') renderInventory();
  if (name === 'settings')  renderSettings();
}

/* ═══ TODAY ══════════════════════════════════════════════════════════════ */

function renderToday() {
  const d = new Date();
  document.getElementById('today-date').textContent =
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  document.getElementById('practice-blocks-today').textContent = getPracToday();
  document.getElementById('q-today').textContent               = getQToday();
  document.getElementById('workout-week').textContent          = getWeekWorkBlocks();

  // Status pill
  const dd   = getQToday() - DAILY_Q_GOAL;
  const pill = document.getElementById('practice-status-pill');
  pill.className = 'status-pill';
  if (dd > 0)      { pill.textContent = `Surplus +${dd}`;  pill.classList.add('pill-surplus'); }
  else if (dd < 0) { pill.textContent = `Deficit ${dd}`;   pill.classList.add('pill-deficit'); }
  else             { pill.textContent = 'On pace';          pill.classList.add('pill-pace');    }

  // Spin card
  const avail = getSpinsAvail();
  document.getElementById('tokens-display').textContent    = state.sharedTokens;
  document.getElementById('spins-display').textContent     = avail;
  document.getElementById('spin-cost-display').textContent = state.settings.spinCost;

  const spinBtn = document.getElementById('spin-btn');
  spinBtn.disabled    = avail === 0;
  spinBtn.textContent = avail === 0 ? 'No spins available' : 'Spin';
}

/* ═══ PROGRESS ═══════════════════════════════════════════════════════════ */

function renderProgress() {
  const dn    = dayNumber();
  const total = state.totalQuestions;
  const exp   = expectedQuestions();
  const cd    = total - exp;
  const rem   = Math.max(0, TOTAL_Q_GOAL - total);
  const dLeft = Math.max(0, CHALLENGE_DAYS - dn);
  const need  = dLeft > 0 ? (rem / dLeft).toFixed(1) : '—';

  document.getElementById('prog-q').textContent   = `${total} / ${TOTAL_Q_GOAL}`;
  document.getElementById('prog-day').textContent = `${dn} / ${CHALLENGE_DAYS}`;
  document.getElementById('prog-need').textContent = need;

  const netEl = document.getElementById('prog-net');
  netEl.textContent = cd > 0 ? `+${cd}` : `${cd}`;
  netEl.className   = `metric-v${cd < 0 ? ' neg' : cd > 0 ? ' pos' : ''}`;

  const avg3 = rollingAvg(3);
  const avg7 = rollingAvg(7);
  document.getElementById('avg3').textContent = avg3 != null ? `${avg3.toFixed(1)} / day` : '—';
  document.getElementById('avg7').textContent = avg7 != null ? `${avg7.toFixed(1)} / day` : '—';

  document.getElementById('prog-workout-week').textContent = getWeekWorkBlocks();

  buildProgressChart();
}

function buildProgressChart() {
  const el = document.getElementById('progress-chart');
  el.innerHTML = '';

  const today = todayStr();
  const all   = getDatesRange(state.startDate, today);
  const last20 = all.slice(-20);

  if (!last20.length) {
    el.innerHTML = '<span style="font-size:13px;color:var(--muted)">No data yet.</span>';
    return;
  }

  // Center axis
  const axis = document.createElement('div');
  axis.className = 'vchart-axis';
  el.appendChild(axis);

  const deltas = last20.map(d => (state.questionsByDate[d] || 0) - DAILY_Q_GOAL);
  const maxAbs = Math.max(1, ...deltas.map(d => Math.abs(d)));

  for (const delta of deltas) {
    const col = document.createElement('div');
    col.className = 'vchart-col';
    if (delta !== 0) {
      const pct = Math.min(44, (Math.abs(delta) / maxAbs) * 44);
      const bar = document.createElement('div');
      bar.className = `vchart-bar ${delta > 0 ? 'vchart-pos' : 'vchart-neg'}`;
      bar.style.height = `${pct}%`;
      col.appendChild(bar);
    }
    el.appendChild(col);
  }

  const lbl = document.getElementById('vchart-start');
  const n   = last20.length - 1;
  lbl.textContent = n > 0 ? `${n} day${n > 1 ? 's' : ''} ago` : 'Today';
}

/* ═══ REWARDS ════════════════════════════════════════════════════════════ */

function renderRewards() {
  const avail     = state.rewardBlocks.length;
  const spentToday = spentTodayMin();
  const spentWeek  = spentWeekMin();
  const cap = state.settings.weeklyRewardCapMinutes;

  document.getElementById('rew-blocks').textContent     = avail;
  document.getElementById('rew-mins').textContent       = avail * 30;
  document.getElementById('rew-spent-today').textContent = spentToday;
  document.getElementById('rew-spent-week').textContent  = spentWeek;
  document.getElementById('rew-cap').textContent         = cap;

  renderBlockGrid();
  renderSpentHistory();
  renderDiscardedHistory();
}

function renderBlockGrid() {
  const el = document.getElementById('reward-block-grid');
  if (!state.rewardBlocks.length) {
    el.innerHTML = '<p class="empty-state" style="width:100%">No reward blocks yet. Spin to earn some.</p>';
    return;
  }
  el.innerHTML = '';
  for (const block of state.rewardBlocks) {
    const sq = document.createElement('div');
    sq.className  = 'reward-block';
    sq.dataset.id = block.id;
    sq.addEventListener('click', () => showSpendConfirm(block.id));
    el.appendChild(sq);
  }
}

let pendingSpendId = null;

function showSpendConfirm(blockId) {
  pendingSpendId = blockId;
  const warn = document.getElementById('spend-cap-warn');
  if (spentWeekMin() + 30 > state.settings.weeklyRewardCapMinutes) {
    warn.classList.remove('hidden');
  } else {
    warn.classList.add('hidden');
  }
  showSheet('spend-confirm-sheet');
}

function confirmSpendBlock() {
  if (pendingSpendId === null) return;
  const idx = state.rewardBlocks.findIndex(b => b.id === pendingSpendId);
  if (idx === -1) { pendingSpendId = null; return; }
  state.rewardBlocks.splice(idx, 1);
  state.spentHistory.push({
    id: state.nextId++,
    blocksSpent: 1,
    minutesSpent: 30,
    spentAt: new Date().toISOString(),
  });
  pendingSpendId = null;
  saveState();
  hideSheet('spend-confirm-sheet');
  renderRewards();
}

function spendNBlocks(n) {
  if (n <= 0 || n > state.rewardBlocks.length) return false;
  state.rewardBlocks.splice(0, n);
  state.spentHistory.push({
    id: state.nextId++,
    blocksSpent: n,
    minutesSpent: n * 30,
    spentAt: new Date().toISOString(),
  });
  saveState();
  renderRewards();
  return true;
}

function renderSpentHistory() {
  const el = document.getElementById('spent-history-list');
  if (!state.spentHistory.length) {
    el.innerHTML = '<p class="empty-state">No history yet.</p>';
    return;
  }

  // Group by date (newest first)
  const grouped = {};
  for (const e of [...state.spentHistory].reverse()) {
    const ds = e.spentAt.slice(0, 10);
    if (!grouped[ds]) grouped[ds] = [];
    grouped[ds].push(e);
  }

  el.innerHTML = '';
  for (const [ds, entries] of Object.entries(grouped)) {
    const dailyMins = entries.reduce((s, e) => s + e.minutesSpent, 0);
    const g = document.createElement('div');
    g.className = 'hist-group';
    g.innerHTML = `<div class="hist-date">${fmtDateLong(ds)}</div>`;
    for (const e of entries) {
      const row = document.createElement('div');
      row.className = 'hist-entry';
      row.innerHTML = `
        <span class="hist-time">${fmtTime(e.spentAt)}</span>
        <span class="hist-val">${e.blocksSpent} block${e.blocksSpent !== 1 ? 's' : ''} · ${e.minutesSpent} min</span>
      `;
      g.appendChild(row);
    }
    const tot = document.createElement('div');
    tot.className   = 'hist-daily-total';
    tot.textContent = `Daily total: ${dailyMins} min`;
    g.appendChild(tot);
    el.appendChild(g);
  }
}

function renderDiscardedHistory() {
  const el = document.getElementById('discarded-history-list');
  if (!state.discardedHistory.length) {
    el.innerHTML = '<p class="empty-state">None discarded.</p>';
    return;
  }
  el.innerHTML = '';
  for (const e of [...state.discardedHistory].reverse()) {
    const row = document.createElement('div');
    row.className = 'hist-entry';
    row.innerHTML = `
      <span class="hist-time">${fmtDateLong(e.discardedAt.slice(0,10))} · ${fmtTime(e.discardedAt)}</span>
      <span class="hist-val">${e.tier} — ${esc(e.rewardText)}</span>
    `;
    el.appendChild(row);
  }
}

/* ═══ INVENTORY ══════════════════════════════════════════════════════════ */

function renderInventory() {
  document.getElementById('inv-tokens').textContent     = state.sharedTokens;
  document.getElementById('inv-spin-cost').textContent  = `${state.settings.spinCost} blocks`;
  document.getElementById('inv-spins').textContent      = getSpinsAvail();
  document.getElementById('inv-prac-today').textContent = getPracToday();
  document.getElementById('inv-work-today').textContent = getWorkToday();
  document.getElementById('inv-prac-total').textContent = state.totalPracticeBlocks;
  document.getElementById('inv-work-total').textContent = state.totalWorkoutBlocks;
}

/* ═══ SETTINGS ═══════════════════════════════════════════════════════════ */

function renderSettings() {
  document.getElementById('set-spin-cost-val').textContent = `${state.settings.spinCost} blocks`;
  document.getElementById('set-cap-val').textContent       = `${state.settings.weeklyRewardCapMinutes} min`;
}

/* ═══ DEFICIT DETAIL SHEET ═══════════════════════════════════════════════ */

function showDeficitSheet() {
  const dn        = dayNumber();
  const total     = state.totalQuestions;
  const exp       = expectedQuestions();
  const cd        = total - exp;
  const rem       = Math.max(0, TOTAL_Q_GOAL - total);
  const dLeft     = Math.max(0, CHALLENGE_DAYS - dn);
  const dInclTdy  = Math.max(1, CHALLENGE_DAYS - dn + 1);
  const req       = dLeft > 0 ? rem / dLeft : null;
  const cdStr     = cd > 0 ? `+${cd}` : `${cd}`;
  const cdCls     = cd < 0 ? 'neg' : cd > 0 ? 'pos' : '';
  const needStr   = req ? req.toFixed(1) : '—';
  const avg3      = rollingAvg(3);
  const avg7      = rollingAvg(7);

  function paceTag(avg) {
    if (avg === null) return '';
    if (avg >= 10)   return ' — On pace';
    if (avg >= 8)    return ' — Slightly behind';
    return ' — Behind';
  }

  // Recommendation
  let recCls = '', recTxt = '';
  if (rem === 0) {
    recCls = 'good'; recTxt = 'All 400 questions completed!';
  } else if (dLeft === 0) {
    recTxt = `Last day — ${rem} question${rem !== 1 ? 's' : ''} remaining.`;
  } else if (cd >= 0) {
    const min = (rem / dInclTdy).toFixed(1);
    recCls = 'good';
    recTxt = `You're <strong>${cd} question${cd !== 1 ? 's' : ''} ahead</strong>. You could average as few as <strong>${min}/day</strong> (including today) and still finish on time.`;
  } else if (req && req > 16) {
    recCls = 'warn';
    recTxt = `To finish on time you'd need <strong>${needStr}/day</strong> from tomorrow. That pace is high — consider a catch-up day or extending your timeline.`;
  } else {
    recTxt = `To finish on time, average <strong>${needStr} questions/day</strong> from tomorrow onward.`;
  }

  // Daily chart
  const last20 = getDatesRange(state.startDate, todayStr()).slice(-20);
  let chartHtml = '';
  if (last20.length) {
    const deltas = last20.map(d => ({ date: d, delta: (state.questionsByDate[d] || 0) - DAILY_Q_GOAL }));
    const maxAbs = Math.max(1, ...deltas.map(x => Math.abs(x.delta)));
    chartHtml = deltas.map(({ date, delta }) => {
      const pct  = Math.min(48, (Math.abs(delta) / maxAbs) * 48);
      const vcls = delta > 0 ? 'pos' : delta < 0 ? 'neg' : '';
      const vstr = delta > 0 ? `+${delta}` : `${delta}`;
      const bar  = delta > 0
        ? `<div class="dchart-bar dchart-pos" style="width:${pct}%"></div>`
        : delta < 0
          ? `<div class="dchart-bar dchart-neg" style="width:${pct}%"></div>`
          : '';
      return `
        <div class="dchart-row">
          <span class="dchart-date">${fmtDate(date)}</span>
          <div class="dchart-wrap"><div class="dchart-axis"></div>${bar}</div>
          <span class="dchart-val ${vcls}">${vstr}</span>
        </div>`;
    }).join('');
  }

  document.getElementById('deficit-body').innerHTML = `
    <div class="def-grid-2">
      <div class="def-card"><div class="def-card-v">${total}</div><div class="def-card-k">Completed</div></div>
      <div class="def-card"><div class="def-card-v">${exp}</div><div class="def-card-k">Expected by today</div></div>
      <div class="def-card"><div class="def-card-v ${cdCls}">${cdStr}</div><div class="def-card-k">Net delta</div></div>
      <div class="def-card"><div class="def-card-v">${rem}</div><div class="def-card-k">Remaining</div></div>
      <div class="def-card"><div class="def-card-v">${dLeft}</div><div class="def-card-k">Days left</div></div>
      <div class="def-card"><div class="def-card-v">${needStr}</div><div class="def-card-k">Needed / day</div></div>
    </div>
    <div class="def-sec">Rolling pace</div>
    <div class="def-pace-row">
      <span>Last 3 days${paceTag(avg3)}</span>
      <strong class="def-pace-v">${avg3 != null ? avg3.toFixed(1) + '/day' : '—'}</strong>
    </div>
    <div class="def-pace-row">
      <span>Last 7 days${paceTag(avg7)}</span>
      <strong class="def-pace-v">${avg7 != null ? avg7.toFixed(1) + '/day' : '—'}</strong>
    </div>
    <div class="def-sec">Recommendation</div>
    <div class="def-rec ${recCls}">${recTxt}</div>
    ${chartHtml ? `<div class="def-sec">Daily delta — goal ${DAILY_Q_GOAL}/day</div>${chartHtml}` : ''}
  `;

  showSheet('deficit-sheet');
}

/* ═══ SPIN ═══════════════════════════════════════════════════════════════ */

const WHEEL = [
  { tier: 'tier1',   p: 0.40 },
  { tier: 'tier2',   p: 0.30 },
  { tier: 'tier3',   p: 0.20 },
  { tier: 'bonus',   p: 0.08 },
  { tier: 'jackpot', p: 0.02 },
];

function spinWheel() {
  let r = Math.random(), cum = 0;
  for (const { tier, p } of WHEEL) {
    cum += p;
    if (r < cum) return tier;
  }
  return 'tier1';
}

function tierLabel(tier) {
  return { tier1:'Tier 1', tier2:'Tier 2', tier3:'Tier 3', jackpot:'Jackpot', bonus:'Bonus' }[tier] || tier;
}

let pendingSpinResult = null;

function doSpin() {
  if (getSpinsAvail() <= 0) return;

  state.sharedTokens = Math.max(0, state.sharedTokens - state.settings.spinCost);
  saveState();

  const tier   = spinWheel();
  const cfg    = state.settings.rewards[tier];
  const text   = cfg.text;
  const blocks = cfg.blocks;

  pendingSpinResult = { tier, text, blocks };

  if (tier === 'bonus') {
    showSheet('bonus-sheet');
  } else {
    document.getElementById('result-tier').textContent   = tierLabel(tier);
    document.getElementById('result-blocks').textContent = `${blocks} reward block${blocks !== 1 ? 's' : ''}`;
    document.getElementById('result-mins').textContent   = `${blocks * 30} min`;
    document.getElementById('result-text').textContent   = text;
    showSheet('spin-result-sheet');
  }

  renderToday();
}

function addToRewards() {
  if (!pendingSpinResult) return;
  const { tier, blocks } = pendingSpinResult;
  for (let i = 0; i < blocks; i++) {
    state.rewardBlocks.push({ id: state.nextId++, earnedAt: new Date().toISOString(), tier });
  }
  pendingSpinResult = null;
  saveState();
  hideSheet('spin-result-sheet');
  renderScreen(currentScreen);
}

function discardSpin() {
  if (!pendingSpinResult) return;
  showConfirm('Discard this reward?', () => {
    const { tier, text } = pendingSpinResult;
    state.discardedHistory.push({
      id: state.nextId++,
      tier,
      rewardText: text,
      discardedAt: new Date().toISOString(),
    });
    pendingSpinResult = null;
    saveState();
    hideSheet('spin-result-sheet');
    renderScreen(currentScreen);
  });
}

function handleBonusDone() {
  // Extra 30-min block completed → earn back one token (= one extra spin opportunity)
  state.sharedTokens++;
  saveState();
  hideSheet('bonus-sheet');
  pendingSpinResult = null;
  renderToday();
}

function handleBonusSkip() {
  if (pendingSpinResult) {
    state.discardedHistory.push({
      id: state.nextId++,
      tier: 'bonus',
      rewardText: 'Bonus skipped',
      discardedAt: new Date().toISOString(),
    });
    pendingSpinResult = null;
    saveState();
  }
  hideSheet('bonus-sheet');
}

/* ═══ SHEET MANAGEMENT ═══════════════════════════════════════════════════ */

function showSheet(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideSheet(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

let confirmCallback = null;

function showConfirm(msg, onConfirm) {
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = onConfirm;
  showSheet('confirm-sheet');
}

/* ═══ SETTINGS SHEETS ════════════════════════════════════════════════════ */

function openSpinCostSheet() {
  document.getElementById('spin-cost-input').value = state.settings.spinCost;
  showSheet('spin-cost-sheet');
}

function saveSpinCost() {
  const v = parseInt(document.getElementById('spin-cost-input').value, 10);
  if (isNaN(v) || v < 1) return;
  state.settings.spinCost = v;
  saveState();
  hideSheet('spin-cost-sheet');
  renderSettings();
  renderToday();
  renderInventory();
}

function openCapSheet() {
  document.getElementById('cap-input').value = state.settings.weeklyRewardCapMinutes;
  showSheet('cap-sheet');
}

function saveCap() {
  const v = parseInt(document.getElementById('cap-input').value, 10);
  if (isNaN(v) || v < 30) return;
  state.settings.weeklyRewardCapMinutes = v;
  saveState();
  hideSheet('cap-sheet');
  renderSettings();
}

function openRewardsSheet() {
  const tiers  = ['tier1','tier2','tier3','jackpot','bonus'];
  const labels = { tier1:'Tier 1', tier2:'Tier 2', tier3:'Tier 3', jackpot:'Jackpot', bonus:'Bonus' };
  const body   = document.getElementById('rewards-settings-body');

  body.innerHTML = tiers.map(t => `
    <div class="rew-tier-row">
      <div class="rew-tier-lbl">${labels[t]}</div>
      <div class="rew-tier-inputs">
        <input class="form-input" type="text"   data-tier="${t}" data-field="text"   value="${esc(state.settings.rewards[t].text)}"   placeholder="Description" />
        <input class="form-input" type="number" data-tier="${t}" data-field="blocks" value="${state.settings.rewards[t].blocks}" min="0" max="20" inputmode="numeric" placeholder="#" />
      </div>
    </div>
  `).join('') + `<button class="btn btn-solid btn-full mt16" id="rew-save-btn">Save</button>`;

  document.getElementById('rew-save-btn').addEventListener('click', () => {
    body.querySelectorAll('[data-tier]').forEach(input => {
      const t = input.dataset.tier, f = input.dataset.field;
      if (f === 'text')   state.settings.rewards[t].text   = input.value.trim();
      if (f === 'blocks') {
        const v = parseInt(input.value, 10);
        if (!isNaN(v) && v >= 0) state.settings.rewards[t].blocks = v;
      }
    });
    saveState();
    hideSheet('rewards-settings-sheet');
  });

  showSheet('rewards-settings-sheet');
}

/* ═══ DATA MANAGEMENT ════════════════════════════════════════════════════ */

function exportBackup(filename) {
  const fn   = filename || `habit-wheel-backup-${fmtTimestamp()}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fn; a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object' || !imported.startDate) throw new Error('invalid');
      showConfirm('Replace all current data with this backup?', () => {
        state = { ...defaultState(), ...imported };
        saveState();
        renderScreen(currentScreen);
        renderSettings();
      });
    } catch {
      alert('Could not read backup file — it may be corrupt or from a different version.');
    }
  };
  reader.readAsText(file);
}

function resetApp() {
  showConfirm(
    'This will erase all data. A backup will be downloaded first. Continue?',
    () => {
      exportBackup(`habit-wheel-backup-${fmtTimestamp()}.json`);
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }, 800);
    }
  );
}

/* ═══ BULK SPEND SHEET ═══════════════════════════════════════════════════ */

function openBulkSpend(preset) {
  const inp = document.getElementById('bulk-count');
  inp.value = preset != null ? preset : 1;
  const n   = parseInt(inp.value, 10);
  const capWarn = document.getElementById('bulk-cap-warn');
  if (n > 0 && spentWeekMin() + n * 30 > state.settings.weeklyRewardCapMinutes) {
    capWarn.classList.remove('hidden');
  } else {
    capWarn.classList.add('hidden');
  }
  showSheet('bulk-spend-sheet');
}

/* ═══ EVENT BINDING ══════════════════════════════════════════════════════ */

function initEvents() {
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Practice +/−
  document.getElementById('practice-plus').addEventListener('click', () => {
    const t = todayStr();
    state.practiceByDate[t] = (state.practiceByDate[t] || 0) + 1;
    state.sharedTokens++;
    state.totalPracticeBlocks++;
    saveState(); renderToday();
  });

  document.getElementById('practice-minus').addEventListener('click', () => {
    const t = todayStr();
    const b = state.practiceByDate[t] || 0;
    if (b <= 0) return;
    if (state.sharedTokens <= 0) { alert('Cannot remove — no shared tokens to subtract.'); return; }
    state.practiceByDate[t] = b - 1;
    state.sharedTokens      = Math.max(0, state.sharedTokens - 1);
    state.totalPracticeBlocks = Math.max(0, state.totalPracticeBlocks - 1);
    saveState(); renderToday();
  });

  // Questions +/−
  document.getElementById('q-plus2').addEventListener('click', () => {
    const t = todayStr();
    state.questionsByDate[t] = (state.questionsByDate[t] || 0) + 2;
    state.totalQuestions += 2;
    saveState(); renderToday();
  });

  document.getElementById('q-minus2').addEventListener('click', () => {
    const t   = todayStr();
    const cur = state.questionsByDate[t] || 0;
    if (cur <= 0) return;
    const sub = Math.min(2, cur);
    state.questionsByDate[t]  = cur - sub;
    state.totalQuestions      = Math.max(0, state.totalQuestions - sub);
    saveState(); renderToday();
  });

  // Workout +/−
  document.getElementById('workout-plus').addEventListener('click', () => {
    const t = todayStr();
    state.workoutByDate[t] = (state.workoutByDate[t] || 0) + 1;
    state.sharedTokens++;
    state.totalWorkoutBlocks++;
    saveState(); renderToday();
  });

  document.getElementById('workout-minus').addEventListener('click', () => {
    const t = todayStr();
    const b = state.workoutByDate[t] || 0;
    if (b <= 0) return;
    if (state.sharedTokens <= 0) { alert('Cannot remove — no shared tokens to subtract.'); return; }
    state.workoutByDate[t] = b - 1;
    state.sharedTokens     = Math.max(0, state.sharedTokens - 1);
    state.totalWorkoutBlocks = Math.max(0, state.totalWorkoutBlocks - 1);
    saveState(); renderToday();
  });

  // Status pill → deficit sheet
  document.getElementById('practice-status-pill').addEventListener('click', showDeficitSheet);

  // Spin
  document.getElementById('spin-btn').addEventListener('click', () => {
    const btn = document.getElementById('spin-btn');
    btn.disabled    = true;
    btn.textContent = 'Spinning…';
    setTimeout(doSpin, 500);
  });

  // Spin result sheet
  document.getElementById('add-to-rewards-btn').addEventListener('click', addToRewards);
  document.getElementById('discard-btn').addEventListener('click', discardSpin);

  // Bonus sheet
  document.getElementById('bonus-done-btn').addEventListener('click', handleBonusDone);
  document.getElementById('bonus-skip-btn').addEventListener('click', handleBonusSkip);

  // Spend single block
  document.getElementById('spend-confirm-btn').addEventListener('click', confirmSpendBlock);
  document.getElementById('spend-cancel-btn').addEventListener('click', () => {
    pendingSpendId = null;
    hideSheet('spend-confirm-sheet');
  });

  // Bulk spend
  document.getElementById('spend-1-btn').addEventListener('click', () => {
    if (!state.rewardBlocks.length) return;
    openBulkSpend(1);
  });
  document.getElementById('spend-2-btn').addEventListener('click', () => {
    if (state.rewardBlocks.length < 2) return;
    openBulkSpend(2);
  });
  document.getElementById('spend-custom-btn').addEventListener('click', () => openBulkSpend(null));

  document.getElementById('bulk-confirm').addEventListener('click', () => {
    const n = parseInt(document.getElementById('bulk-count').value, 10);
    if (isNaN(n) || n <= 0) return;
    if (n > state.rewardBlocks.length) {
      alert(`You only have ${state.rewardBlocks.length} block${state.rewardBlocks.length !== 1 ? 's' : ''} available.`);
      return;
    }
    spendNBlocks(n);
    hideSheet('bulk-spend-sheet');
  });
  document.getElementById('bulk-cancel').addEventListener('click', () => hideSheet('bulk-spend-sheet'));

  // Update cap warning as user changes bulk-count input
  document.getElementById('bulk-count').addEventListener('input', () => {
    const n   = parseInt(document.getElementById('bulk-count').value, 10);
    const el  = document.getElementById('bulk-cap-warn');
    if (n > 0 && spentWeekMin() + n * 30 > state.settings.weeklyRewardCapMinutes) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  // Generic confirm sheet
  document.getElementById('confirm-ok').addEventListener('click', () => {
    hideSheet('confirm-sheet');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    hideSheet('confirm-sheet');
    confirmCallback = null;
  });

  // Settings rows
  document.getElementById('set-spin-cost').addEventListener('click', openSpinCostSheet);
  document.getElementById('set-rewards').addEventListener('click', openRewardsSheet);
  document.getElementById('set-cap').addEventListener('click', openCapSheet);
  document.getElementById('spin-cost-save').addEventListener('click', saveSpinCost);
  document.getElementById('cap-save').addEventListener('click', saveCap);

  document.getElementById('set-export').addEventListener('click', () => exportBackup());
  document.getElementById('set-import').addEventListener('click', () =>
    document.getElementById('import-file-input').click()
  );
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importBackup(file);
    e.target.value = '';
  });
  document.getElementById('set-reset').addEventListener('click', resetApp);

  // data-close buttons (generic)
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => hideSheet(btn.dataset.close));
  });

  // Close sheets by tapping the dim overlay
  document.querySelectorAll('.sheet-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) hideSheet(overlay.id);
    });
  });
}

/* ═══ INIT ════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  checkDateReset();
  initEvents();
  showScreen('today');
});
