/* ═══ Habit Wheel v3 ══════════════════════════════════════════════════════ */

const DAILY_Q_GOAL   = 10;
const TOTAL_Q_GOAL   = 400;
const CHALLENGE_DAYS = 40;
const WO_WEEK_GOAL   = 8;
const STORAGE_KEY    = 'habit_wheel_v2';
const MIGRATION_BACKUP_KEY = 'habit_wheel_v2_pre_v3_migration_backup';
const SCHEMA_VERSION = 3;
const EXPORT_DETAILS_DAYS = 2;
const NORMAL_CLIPS = ['red', 'blue', 'green', 'purple', 'orange'];
const GOLD_CLIP = 'gold';
const CLIP_COLORS = [...NORMAL_CLIPS, GOLD_CLIP];
const DEFAULT_CLIP_TEMPLATE = {
  red: 4,
  blue: 4,
  green: 4,
  purple: 4,
  orange: 4,
  gold: 2,
};
const WHEEL = [
  { tier: 'tier1',   p: 0.40 },
  { tier: 'tier2',   p: 0.30 },
  { tier: 'tier3',   p: 0.20 },
  { tier: 'bonus',   p: 0.08 },
  { tier: 'jackpot', p: 0.02 },
];
const BONUS_WHEEL = [
  { outcome: '75',    p: 0.35 },
  { outcome: '50',    p: 0.25 },
  { outcome: '25',    p: 0.20 },
  { outcome: 'free',  p: 0.10 },
  { outcome: 'extra', p: 0.10 },
];
const MAX_BONUS_CHAIN_DEPTH = 5;

/* ═══ NEW PRIZE WHEEL SYSTEM ═══════════════════════════════════════════════ */

const OUTCOME_PROBABILITIES = [
  { type: 'T1',    weight: 0.40 },
  { type: 'T2',    weight: 0.30 },
  { type: 'T3',    weight: 0.20 },
  { type: 'BONUS', weight: 0.08 },
  { type: 'MISS',  weight: 0.02 },
];

const WHEEL_SLICE_COUNT = 50;

const SEGMENT_COLORS = {
  T1:    { fill: '#93A4B7', text: '#111827', stroke: '#0B1624' },
  T2:    { fill: '#5E748C', text: '#F8FAFC', stroke: '#0B1624' },
  T3:    { fill: '#24384F', text: '#F8FAFC', stroke: '#0B1624' },
  BONUS: { fill: '#F3EFE6', text: '#111827', stroke: '#0B1624' },
  MISS:  { fill: '#B89B63', text: '#111827', stroke: '#0B1624' },
};

const SPINNER_CONFIG = {
  tileWidth: 52,
  tileGap: 6,
  repeat: 4,
};

/** Must match timing used in startSpin for reward lead / hold. */
const SPIN_DURATION_REDUCED_MS = 6000;
const SPIN_DURATION_FULL_MS = 6000;
const SPIN_REWARD_LEAD_MS = 800;
const SPIN_HOLD_AFTER_MS = 1000;

/** Bottom of spinner card sits this many px above the top of #today-paperclips-card (visual gap). */
const SPIN_OVERLAY_GAP_ABOVE_PAPERCLIPS_PX = 18;

const SPINNER_TILE_LABELS = {
  T1: 'Tier 1',
  T2: 'Tier 2',
  T3: 'Tier 3',
  BONUS: 'Bonus',
  MISS: 'Empty',
};

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

function fmtMinutes(totalMinutes) {
  if (!totalMinutes) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtHoursFloor(totalMinutes) {
  return `${Math.floor((totalMinutes || 0) / 60)}h`;
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

function maxDateStr(a, b) {
  return a > b ? a : b;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══ WHEEL SYSTEM ═══════════════════════════════════════════════════════ */

function buildWheelSegments(probabilities, totalSlices) {
  const counts = {};
  const fractional = {};
  let totalAssigned = 0;

  for (const { type, weight } of probabilities) {
    const raw = weight * totalSlices;
    counts[type] = Math.floor(raw);
    fractional[type] = raw - counts[type];
    totalAssigned += counts[type];
  }

  const remaining = totalSlices - totalAssigned;
  const sorted = Object.entries(fractional)
    .sort(([, a], [, b]) => b - a)
    .slice(0, remaining);

  for (const [type] of sorted) {
    counts[type]++;
  }

  const segments = [];
  let currentIndex = 0;
  const segmentAngle = 360 / totalSlices;

  for (const { type, weight } of probabilities) {
    const count = counts[type];
    for (let i = 0; i < count; i++) {
      const startAngle = currentIndex * segmentAngle;
      const endAngle = (currentIndex + 1) * segmentAngle;
      const centerAngle = (startAngle + endAngle) / 2;
      const colors = SEGMENT_COLORS[type];
      segments.push({
        id: `seg-${currentIndex}`,
        type,
        label: type,
        index: currentIndex,
        startAngle,
        endAngle,
        centerAngle,
        color: colors.fill,
        textColor: colors.text,
        strokeColor: colors.stroke,
      });
      currentIndex++;
    }
  }

  return segments;
}

function arrangeSegmentsBalanced(segments) {
  const typeCounts = {};
  const typeIndices = {};

  for (const { type } of OUTCOME_PROBABILITIES) {
    typeCounts[type] = segments.filter(s => s.type === type).length;
    typeIndices[type] = 0;
  }

  const arranged = new Array(segments.length);
  let lastType = null;
  let lastTypeCount = 0;

  for (let i = 0; i < segments.length; i++) {
    let chosenType = null;
    let maxGap = -1;

    for (const { type } of OUTCOME_PROBABILITIES) {
      if (typeIndices[type] >= typeCounts[type]) continue;

      const targetFraction = typeCounts[type] / segments.length;
      const currentFraction = typeIndices[type] / (i + 1);
      const gap = targetFraction - currentFraction;

      if (type === lastType && lastTypeCount >= 2) continue;

      if (gap > maxGap) {
        maxGap = gap;
        chosenType = type;
      }
    }

    if (chosenType === null) {
      for (const { type } of OUTCOME_PROBABILITIES) {
        if (typeIndices[type] < typeCounts[type]) {
          chosenType = type;
          break;
        }
      }
    }

    const matchingSegments = segments.filter(
      (s, idx) => s.type === chosenType && !arranged.includes(s)
    );
    if (matchingSegments.length > 0) {
      arranged[i] = matchingSegments[0];
      typeIndices[chosenType]++;
      lastType = chosenType;
      lastTypeCount = lastType === chosenType ? lastTypeCount + 1 : 1;
    }
  }

  let angle = 0;
  for (let i = 0; i < arranged.length; i++) {
    const seg = arranged[i];
    const segAngle = 360 / arranged.length;
    arranged[i] = {
      ...seg,
      index: i,
      startAngle: angle,
      endAngle: angle + segAngle,
      centerAngle: angle + segAngle / 2,
    };
    angle += segAngle;
  }

  return arranged;
}

function chooseOutcome(probabilities) {
  let r = Math.random();
  let cumulative = 0;
  for (const { type, weight } of probabilities) {
    cumulative += weight;
    if (r < cumulative) return type;
  }
  return probabilities[probabilities.length - 1].type;
}

function chooseSegmentForOutcome(outcome, segments) {
  const matching = segments.filter(s => s.type === outcome);
  if (!matching.length) throw new Error(`No segment found for outcome ${outcome}`);
  return randomChoice(matching);
}

function getSpinnerSegments() {
  const base = buildWheelSegments(OUTCOME_PROBABILITIES, WHEEL_SLICE_COUNT);
  return arrangeSegmentsBalanced(base);
}

function setSpinnerTransform(track, x) {
  track.style.transform = `translate3d(${x}px, 0, 0)`;
}

function mountSpinner(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const segments = getSpinnerSegments();
  const tiles = [];
  for (let r = 0; r < SPINNER_CONFIG.repeat; r++) {
    for (const seg of segments) tiles.push(seg);
  }
  const tileHtml = tiles.map(seg => {
    const label = SPINNER_TILE_LABELS[seg.type] || seg.type;
    const styles = `background:${seg.color};color:${seg.textColor};border-color:${seg.strokeColor}`;
    return `<div class="spin-tile spin-tile-${seg.type.toLowerCase()}" style="${styles}"><span>${label}</span></div>`;
  }).join('');
  container.innerHTML =
    '<div class="spinner-frame">' +
      `<div class="spinner-track" id="spinner-track">${tileHtml}</div>` +
      '<div class="spinner-pointer" aria-hidden="true"></div>' +
    '</div>';
  const track = document.getElementById('spinner-track');
  if (track) setSpinnerTransform(track, 0);
  return { segments };
}

function animateSpinner(selectedSegment, segments, durationMs, callback) {
  const track = document.getElementById('spinner-track');
  const frame = track && track.parentElement;
  if (!track || !frame) {
    if (callback) callback();
    return;
  }

  const { tileGap, repeat } = SPINNER_CONFIG;
  const frameWidth =
    frame.clientWidth || frame.getBoundingClientRect().width || 320;
  const firstTile = track.querySelector('.spin-tile');
  const measuredW = firstTile ? firstTile.getBoundingClientRect().width : 0;
  const tileWidth =
    measuredW > 0 ? measuredW : SPINNER_CONFIG.tileWidth;
  const step = tileWidth + tileGap;
  const targetCopy = Math.max(1, repeat - 2);
  const targetIndex = targetCopy * segments.length + selectedSegment.index;
  const jitter = (Math.random() - 0.5) * tileWidth * 0.4;
  const startX = frameWidth / 2 - tileWidth / 2;
  const finalX =
    frameWidth / 2 - (targetIndex * step + tileWidth / 2) - jitter;
  const distance = finalX - startX;

  setSpinnerTransform(track, startX);

  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const t0 = performance.now();

  const SLOW_END_POWER = prefersReduced ? 5 : 5;

  const easeProgress = (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return 1 - Math.pow(1 - u, SLOW_END_POWER);
  };

  function tick() {
    const elapsed = performance.now() - t0;
    const u = Math.min(1, elapsed / durationMs);
    const x = startX + distance * easeProgress(u);
    setSpinnerTransform(track, x);

    if (u < 1) {
      requestAnimationFrame(tick);
    } else {
      setSpinnerTransform(track, finalX);
      if (callback) callback();
    }
  }

  requestAnimationFrame(tick);
}

/* ═══ Default state ══════════════════════════════════════════════════════ */

function defaultState() {
  return {
    startDate: todayStr(),
    lastDate:  todayStr(),
    weekStart: weekStartStr(),

    clipInventory: emptyClipInventory(),
    clipBag: {
      mode: 'bag',
      remaining: [],
      template: { ...DEFAULT_CLIP_TEMPLATE },
    },
    lastClipDrawn: null,
    pendingSpins: 0,
    blocksTowardNextSpin: 0,
    clipDrawsByDate: {},
    wheelRotation: 0,

    practiceByDate:  {},   // { 'YYYY-MM-DD': blockCount }
    workoutByDate:   {},   // { 'YYYY-MM-DD': blockCount }
    questionsByDate: {},   // { 'YYYY-MM-DD': count }

    totalPracticeBlocks: 0,
    totalWorkoutBlocks:  0,
    totalQuestions:      0,

    rewardBlocks:     [],  // [{ id, minutes, earnedAt, sourceTier, wheelOutcome, activeTier }]
    spentHistory:     [],  // [{ id, blocksSpent, minutesSpent, spentAt }]
    discardedHistory: [],  // [{ id, tier, rewardText, discardedAt }]
    bonusHistory:     [],  // [{ id, outcome, status, completedAt }]

    nextId: 1,
    schemaVersion: SCHEMA_VERSION,

    settings: {
      blocksPerSpin:          3,
      drawMode:               'bag',
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

function emptyClipInventory() {
  return CLIP_COLORS.reduce((acc, color) => {
    acc[color] = 0;
    return acc;
  }, {});
}

/* ═══ State persistence ══════════════════════════════════════════════════ */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const migrated = normalizeState(parsed, raw);
    if (migrated.schemaVersion !== parsed.schemaVersion) {
      saveStateObject(migrated);
    }
    return migrated;
  } catch {
    return defaultState();
  }
}

function saveState() {
  saveStateObject(state);
}

function saveStateObject(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function normalizeState(input, rawBackup) {
  if (!input || typeof input !== 'object') return defaultState();

  if (input.schemaVersion === SCHEMA_VERSION) {
    return normalizeV3State(input);
  }

  return migrateV2ToV3(input, rawBackup);
}

function normalizeV3State(input) {
  const def = defaultState();
  const s = { ...def, ...input };
  s.settings = normalizeSettings(input.settings);
  s.clipInventory = normalizeClipInventory(input.clipInventory);
  s.clipBag = normalizeClipBag(input.clipBag, s.settings);
  s.pendingSpins = Math.max(0, parseInt(input.pendingSpins || 0, 10) || 0);
  s.blocksTowardNextSpin = Math.max(0, parseInt(input.blocksTowardNextSpin || 0, 10) || 0);
  s.rewardBlocks = Array.isArray(input.rewardBlocks) ? input.rewardBlocks : [];
  s.spentHistory = Array.isArray(input.spentHistory) ? input.spentHistory : [];
  s.discardedHistory = Array.isArray(input.discardedHistory) ? input.discardedHistory : [];
  s.bonusHistory = Array.isArray(input.bonusHistory) ? input.bonusHistory : [];
  s.clipDrawsByDate = normalizeClipDraws(input.clipDrawsByDate);
  s.lastClipDrawn = CLIP_COLORS.includes(input.lastClipDrawn) ? input.lastClipDrawn : null;
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}

function migrateV2ToV3(input, rawBackup) {
  if (rawBackup && !localStorage.getItem(MIGRATION_BACKUP_KEY)) {
    localStorage.setItem(MIGRATION_BACKUP_KEY, rawBackup);
  }

  const def = defaultState();
  const s = {
    ...def,
    startDate: input.startDate || def.startDate,
    lastDate: input.lastDate || def.lastDate,
    weekStart: input.weekStart || def.weekStart,
    practiceByDate: input.practiceByDate || {},
    workoutByDate: input.workoutByDate || {},
    questionsByDate: input.questionsByDate || {},
    totalPracticeBlocks: input.totalPracticeBlocks || 0,
    totalWorkoutBlocks: input.totalWorkoutBlocks || 0,
    totalQuestions: input.totalQuestions || 0,
    rewardBlocks: normalizeRewardBlocks(input.rewardBlocks || []),
    spentHistory: Array.isArray(input.spentHistory) ? input.spentHistory : [],
    discardedHistory: Array.isArray(input.discardedHistory) ? input.discardedHistory : [],
    nextId: input.nextId || def.nextId,
    settings: normalizeSettings(input.settings),
    schemaVersion: SCHEMA_VERSION,
  };

  const oldTokens = Math.max(0, parseInt(input.sharedTokens || 0, 10) || 0);
  for (let i = 0; i < oldTokens; i++) {
    const clip = drawClipFromState(s);
    s.clipInventory[clip]++;
  }
  s.pendingSpins += Math.floor(oldTokens / s.settings.blocksPerSpin);
  s.blocksTowardNextSpin = oldTokens % s.settings.blocksPerSpin;

  return normalizeV3State(s);
}

function normalizeSettings(settings = {}) {
  const def = defaultState().settings;
  const blocksPerSpin = parseInt(settings.blocksPerSpin ?? settings.spinCost ?? def.blocksPerSpin, 10);
  const normalized = {
    ...def,
    ...settings,
    blocksPerSpin: !isNaN(blocksPerSpin) && blocksPerSpin > 0 ? blocksPerSpin : def.blocksPerSpin,
    drawMode: settings.drawMode || def.drawMode,
    rewards: { ...def.rewards, ...(settings.rewards || {}) },
  };
  delete normalized.spinCost;
  for (const t of ['tier1','tier2','tier3','jackpot','bonus']) {
    normalized.rewards[t] = { ...def.rewards[t], ...(normalized.rewards[t] || {}) };
  }
  return normalized;
}

function normalizeClipInventory(inv = {}) {
  const next = emptyClipInventory();
  for (const color of CLIP_COLORS) {
    const migrated = color === GOLD_CLIP ? (inv.gold || 0) + (inv.yellow || 0) : inv[color];
    next[color] = Math.max(0, parseInt(migrated || 0, 10) || 0);
  }
  return next;
}

function normalizeClipBag(bag = {}, settings = {}) {
  const template = normalizeClipTemplate(bag.template || DEFAULT_CLIP_TEMPLATE);
  const remaining = Array.isArray(bag.remaining)
    ? bag.remaining.filter(color => CLIP_COLORS.includes(color))
    : [];
  return {
    mode: settings.drawMode || bag.mode || 'bag',
    remaining,
    template,
  };
}

function normalizeClipTemplate(template = {}) {
  const next = {};
  for (const color of CLIP_COLORS) {
    const fallback = DEFAULT_CLIP_TEMPLATE[color];
    const raw = color === GOLD_CLIP ? (template.gold ?? template.yellow ?? fallback) : (template[color] ?? fallback);
    const value = parseInt(raw, 10);
    next[color] = !isNaN(value) && value >= 0 ? value : fallback;
  }
  return next;
}

function normalizeRewardBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(block => ({
    ...block,
    minutes: block.minutes || 30,
    sourceTier: block.sourceTier || block.tier || 'tier1',
    wheelOutcome: block.wheelOutcome || block.tier || 'tier1',
    activeTier: block.activeTier || 1,
  }));
}

function normalizeClipDraws(draws = {}) {
  const today = todayStr();
  if (!draws || typeof draws !== 'object' || Array.isArray(draws)) {
    return { [today]: [] };
  }

  const normalized = {};
  for (const [date, items] of Object.entries(draws)) {
    if (!Array.isArray(items)) continue;
    const validItems = items
      .map(draw => draw && draw.clip === 'yellow' ? { ...draw, clip: GOLD_CLIP } : draw)
      .filter(draw =>
        draw && ['practice', 'workout', 'bonus'].includes(draw.kind) && CLIP_COLORS.includes(draw.clip)
      );
    if (validItems.length) normalized[date] = validItems;
  }

  if (!normalized[today]) normalized[today] = [];
  return normalized;
}

function getRecentDateKeys(days) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return new Set(dates);
}

function filterDateMapByRecentDays(map, recentDays) {
  return Object.fromEntries(
    Object.entries(map || {}).filter(([date]) => recentDays.has(date))
  );
}

function filterArrayByDateKey(items, dateKey, recentDays) {
  return (items || []).filter(item => {
    if (!item || !item[dateKey]) return false;
    const date = String(item[dateKey]).slice(0, 10);
    return recentDays.has(date);
  });
}

function exportStateForBackup(sourceState, days = EXPORT_DETAILS_DAYS) {
  const recentDays = getRecentDateKeys(days);
  return {
    ...sourceState,
    practiceByDate: filterDateMapByRecentDays(sourceState.practiceByDate, recentDays),
    workoutByDate: filterDateMapByRecentDays(sourceState.workoutByDate, recentDays),
    questionsByDate: filterDateMapByRecentDays(sourceState.questionsByDate, recentDays),
    clipDrawsByDate: filterDateMapByRecentDays(sourceState.clipDrawsByDate, recentDays),
    rewardBlocks: filterArrayByDateKey(sourceState.rewardBlocks, 'earnedAt', recentDays),
    spentHistory: filterArrayByDateKey(sourceState.spentHistory, 'spentAt', recentDays),
    discardedHistory: filterArrayByDateKey(sourceState.discardedHistory, 'discardedAt', recentDays),
    bonusHistory: filterArrayByDateKey(sourceState.bonusHistory, 'completedAt', recentDays),
  };
}

function isValidState(input) {
  return !!input && typeof input === 'object' &&
    (input.schemaVersion === SCHEMA_VERSION || input.startDate || input.practiceByDate || input.rewardBlocks);
}

let state = loadState();

/* ═══ Computed values ════════════════════════════════════════════════════ */

const getQToday        = ()  => state.questionsByDate[todayStr()] || 0;
const getPracToday     = ()  => state.practiceByDate[todayStr()]  || 0;
const getWorkToday     = ()  => state.workoutByDate[todayStr()]   || 0;
const getSpinsAvail    = ()  => state.pendingSpins || 0;

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

function buildBagFromTemplate(template) {
  const clips = [];
  for (const color of CLIP_COLORS) {
    for (let i = 0; i < (template[color] || 0); i++) clips.push(color);
  }
  return shuffle(clips);
}

function drawClipFromState(targetState) {
  targetState.clipInventory = normalizeClipInventory(targetState.clipInventory);
  targetState.settings = normalizeSettings(targetState.settings);
  targetState.clipBag = normalizeClipBag(targetState.clipBag, targetState.settings);

  if (targetState.settings.drawMode === 'probability') {
    const bag = buildBagFromTemplate(targetState.clipBag.template);
    return bag[Math.floor(Math.random() * bag.length)] || 'red';
  }

  if (!targetState.clipBag.remaining.length) {
    targetState.clipBag.remaining = buildBagFromTemplate(targetState.clipBag.template);
  }
  return targetState.clipBag.remaining.pop() || 'red';
}

function drawClip() {
  const clip = drawClipFromState(state);
  state.clipInventory[clip] = (state.clipInventory[clip] || 0) + 1;
  return clip;
}

function addProgressTowardSpin() {
  const blocksPerSpin = Math.max(1, state.settings.blocksPerSpin || 3);
  state.blocksTowardNextSpin++;
  while (state.blocksTowardNextSpin >= blocksPerSpin) {
    state.pendingSpins++;
    state.blocksTowardNextSpin -= blocksPerSpin;
  }
}

function removeProgressTowardSpin() {
  const blocksPerSpin = Math.max(1, state.settings.blocksPerSpin || 3);
  if ((state.blocksTowardNextSpin || 0) > 0) {
    state.blocksTowardNextSpin--;
  } else if ((state.pendingSpins || 0) > 0) {
    state.pendingSpins--;
    state.blocksTowardNextSpin = blocksPerSpin - 1;
  }
}

function clipLabel(color) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function tierNumber(tier) {
  return { tier1: 1, tier2: 2, tier3: 3, jackpot: 4 }[tier] || 1;
}

function tierKey(activeTier) {
  return activeTier === 3 ? 'tier3' : activeTier === 2 ? 'tier2' : 'tier1';
}

function highestActiveTier(activeTier) {
  return tierKey(activeTier);
}

function getTier2Options() {
  return NORMAL_CLIPS
    .filter(color => (state.clipInventory[color] || 0) >= 2)
    .map(color => ({ tier: 2, color, count: 2, label: `2 ${clipLabel(color)}` }));
}

function getTier3Options() {
  const options = NORMAL_CLIPS
    .filter(color => (state.clipInventory[color] || 0) >= 3)
    .map(color => ({ tier: 3, color, count: 3, label: `3 ${clipLabel(color)}` }));
  if ((state.clipInventory.gold || 0) >= 1) {
    options.push({ tier: 3, color: 'gold', count: 1, label: '1 Gold' });
  }
  return options;
}

function chooseActivationOption(tier) {
  if (tier === 1) return { tier: 1 };
  const options = tier === 2 ? getTier2Options() : getTier3Options();
  return options.length ? randomChoice(options) : null;
}

function spendActivationCost(option) {
  if (!option || !option.color) return true;
  if ((state.clipInventory[option.color] || 0) < option.count) return false;
  state.clipInventory[option.color] -= option.count;
  return true;
}

function clipSummaryHtml() {
  return CLIP_COLORS.map(color => `
    <span class="clip-pill clip-${color}">
      <span class="clip-dot-mini"></span>${clipLabel(color)} ${state.clipInventory[color] || 0}
    </span>
  `).join('');
}

function clipBarsHtml() {
  const displayClips = [...NORMAL_CLIPS, GOLD_CLIP];
  const maxVal = Math.max(1, ...displayClips.map(color => state.clipInventory[color] || 0));
  return displayClips.map((color, index) => {
    const count = state.clipInventory[color] || 0;
    const width = Math.max(4, (count / maxVal) * 100);
    const lastClass = state.lastClipDrawn === color ? ' last-drawn' : '';
    return `
      <div class="clip-bar-row${lastClass}">
        <span class="clip-bar-label">${clipLabel(color)}</span>
        <div class="clip-bar-track"><div class="clip-bar-fill clip-tone-${index}" style="width:${width}%"></div></div>
        <strong class="clip-bar-count">${count}</strong>
      </div>
    `;
  }).join('');
}

function cashInSummary(options) {
  return options.length ? options.map(o => o.label).join(', ') : 'None available';
}

/* ═══ Date reset ═════════════════════════════════════════════════════════ */

function checkDateReset() {
  const today = todayStr();
  const ws    = weekStartStr();
  if (state.lastDate !== today) state.lastDate = today;
  if (state.weekStart !== ws)   state.weekStart = ws;
  state.clipDrawsByDate = normalizeClipDraws(state.clipDrawsByDate);
  saveState();
}

/* ═══ Screen navigation ══════════════════════════════════════════════════ */

let currentScreen = 'today';
let progressRange = 'week';
let pendingSpinResult = null;
let isSpinning = false;
let spinOverlayDismissTimer = null;
let spinOverlayEarlyRewardTimer = null;
let selectedRewardBlockIds = new Set();

function clearSpinOverlayDismissTimer() {
  if (spinOverlayDismissTimer) {
    clearTimeout(spinOverlayDismissTimer);
    spinOverlayDismissTimer = null;
  }
}

function clearSpinOverlayEarlyRewardTimer() {
  if (spinOverlayEarlyRewardTimer) {
    clearTimeout(spinOverlayEarlyRewardTimer);
    spinOverlayEarlyRewardTimer = null;
  }
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  const scr = document.getElementById(`screen-${name}`);
  if (scr) { scr.classList.add('active'); scr.style.display = ''; }

  currentScreen = name;
  renderScreen(name);
}

function renderScreen(name) {
  if (name === 'today')     renderToday();
  if (name === 'progress')  renderProgress();
  if (name === 'rewards')   renderRewards();
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

  document.getElementById('today-clip-summary').innerHTML = clipBarsHtml();
  renderTierButtons();
}

function renderTierButtons() {
  const t1 = document.getElementById('tier1-spin-btn');
  const t2 = document.getElementById('tier2-spin-btn');
  const t3 = document.getElementById('tier3-spin-btn');
  if (!t1 || !t2 || !t3) return;
  const hasPending = getSpinsAvail() > 0;
  const hasT2 = !!getTier2Options().length;
  const hasT3 = !!getTier3Options().length;
  t1.disabled = isSpinning || !hasPending;
  t2.disabled = isSpinning || !hasT2;
  t3.disabled = isSpinning || !hasT3;
}

/* ═══ PROGRESS ═══════════════════════════════════════════════════════════ */

function renderProgress() {
  const dn    = dayNumber();
  const total = state.totalQuestions;
  const exp   = expectedQuestions();
  const cd    = total - exp;

  document.getElementById('prog-q').textContent   = `${total} / ${TOTAL_Q_GOAL}`;
  document.getElementById('prog-day').textContent = `${dn} / ${CHALLENGE_DAYS}`;

  const netEl = document.getElementById('prog-net');
  netEl.textContent = cd > 0 ? `+${cd}` : `${cd}`;
  netEl.className   = `metric-v${cd < 0 ? ' neg' : cd > 0 ? ' pos' : ''}`;

  const { dates } = getProgressRangeData();
  const practiceBlocks = sumByDate(state.practiceByDate, dates);
  const workoutBlocks = sumByDate(state.workoutByDate, dates);
  const practiceMinutes = practiceBlocks * 30;
  const workoutMinutes = workoutBlocks * 30;

  document.querySelectorAll('[data-progress-range]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.progressRange === progressRange);
  });
  document.getElementById('range-practice-time').textContent = fmtHoursFloor(practiceMinutes);
  document.getElementById('range-workout-time').textContent = fmtHoursFloor(workoutMinutes);

  buildTimeChart('practice-time-chart', 'practice-chart-start', 'practice-y-axis', dates, state.practiceByDate, 'practice');
  buildTimeChart('workout-time-chart', 'workout-chart-start', 'workout-y-axis', dates, state.workoutByDate, 'workout');
}

function getProgressRangeData() {
  const today = todayStr();
  const now = new Date();
  let start = state.startDate;

  if (progressRange === 'week') {
    start = maxDateStr(state.startDate, weekStartStr());
  } else if (progressRange === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    start = maxDateStr(state.startDate, monthStart);
  } else if (progressRange === 'ytd') {
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    start = maxDateStr(state.startDate, yearStart);
  }

  return { dates: getDatesRange(start, today) };
}

function sumByDate(source, dates) {
  return dates.reduce((sum, date) => sum + (source[date] || 0), 0);
}

function getSpentBlocksByDate(history) {
  return (history || []).reduce((acc, entry) => {
    if (!entry || !entry.spentAt) return acc;
    const date = String(entry.spentAt).slice(0, 10);
    const blocks = Math.max(0, parseInt(entry.blocksSpent || 0, 10) || 0);
    if (!blocks) return acc;
    acc[date] = (acc[date] || 0) + blocks;
    return acc;
  }, {});
}


function buildTimeChart(chartId, labelId, axisId, dates, source, className) {
  const el = document.getElementById(chartId);
  const axisEl = document.getElementById(axisId);
  el.innerHTML = '';
  axisEl.innerHTML = '';

  if (!dates.length) {
    el.innerHTML = '<span style="font-size:13px;color:var(--muted)">No data yet.</span>';
    return;
  }

  const values = dates.map(d => (source[d] || 0) * 30);
  const maxVal = Math.max(30, ...values);
  const topTick = Math.max(30, Math.ceil(maxVal / 30) * 30);
  axisEl.innerHTML = `<span>${topTick / 30}</span><span></span>`;
  for (const value of values) {
    const col = document.createElement('div');
    col.className = 'bar-col';
    if (value > 0) {
      const fill = document.createElement('div');
      fill.className = `bar-fill ${className}`;
      fill.style.height = `${Math.max(4, (value / topTick) * 100)}%`;
      col.appendChild(fill);
    }
    el.appendChild(col);
  }

  document.getElementById(labelId).textContent = dates.length > 1 ? fmtDate(dates[0]) : 'Today';
}

/* ═══ REWARDS ════════════════════════════════════════════════════════════ */

function renderRewards() {
  renderBlockGrid();

  const { dates } = getProgressRangeData();
  buildTimeChart(
    'reward-spent-time-chart',
    'reward-spent-chart-start',
    'reward-spent-y-axis',
    dates,
    getSpentBlocksByDate(state.spentHistory),
    'reward-spent'
  );

  renderSpentHistory();
  renderDiscardedHistory();
}

function renderBlockGrid() {
  const el = document.getElementById('reward-block-grid');
  selectedRewardBlockIds = new Set(
    [...selectedRewardBlockIds].filter(id => state.rewardBlocks.some(block => block.id === id))
  );
  updateSpendSelectedButton();

  el.innerHTML = '';
  state.rewardBlocks.forEach(block => {
    const sq = document.createElement('div');
    sq.className  = `reward-block${selectedRewardBlockIds.has(block.id) ? ' selected' : ''}`;
    sq.dataset.id = block.id;
    sq.addEventListener('click', () => toggleRewardBlockSelection(block.id));
    el.appendChild(sq);
  });

  const emptyCount = Math.max(0, 8 - state.rewardBlocks.length);
  for (let i = 0; i < emptyCount; i++) {
    const sq = document.createElement('div');
    sq.className = 'reward-block empty';
    el.appendChild(sq);
  }
}

function toggleRewardBlockSelection(blockId) {
  if (selectedRewardBlockIds.has(blockId)) {
    selectedRewardBlockIds.delete(blockId);
  } else {
    selectedRewardBlockIds.add(blockId);
  }
  renderBlockGrid();
}

function updateSpendSelectedButton() {
  const btn = document.getElementById('spend-selected-btn');
  if (!btn) return;
  const n = selectedRewardBlockIds.size;
  btn.disabled = n === 0;
  btn.textContent = n ? `Spend selected (${n})` : 'Spend selected';
}

function spendSelectedBlocks() {
  const selectedIds = [...selectedRewardBlockIds];
  if (!selectedIds.length) return;
  const selectedSet = new Set(selectedIds);
  const selectedBlocks = state.rewardBlocks.filter(block => selectedSet.has(block.id));
  if (!selectedBlocks.length) return;

  state.rewardBlocks = state.rewardBlocks.filter(block => !selectedSet.has(block.id));
  state.spentHistory.push({
    id: state.nextId++,
    blocksSpent: selectedBlocks.length,
    minutesSpent: selectedBlocks.length * 30,
    spentAt: new Date().toISOString(),
  });
  selectedRewardBlockIds.clear();
  saveState();
  renderRewards();
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
  const recentGroups = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 2);
  for (const [ds, entries] of recentGroups) {
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

/* ═══ SETTINGS ═══════════════════════════════════════════════════════════ */

function renderSettings() {
  document.getElementById('set-blocks-per-spin-val').textContent = `${state.settings.blocksPerSpin} blocks`;
  document.getElementById('set-clip-bag-val').textContent =
    `${state.clipBag.template.red || 0} normal, ${state.clipBag.template.gold || 0} gold`;
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

function spinWheel() {
  // Uses new probability model internally but returns legacy format for backward compat
  const outcome = chooseOutcome(OUTCOME_PROBABILITIES);
  const map = { T1: 'tier1', T2: 'tier2', T3: 'tier3', BONUS: 'bonus', MISS: 'jackpot' };
  return map[outcome] || 'tier1';
}

function tierLabel(tier) {
  const tierMap = {
    tier1: 'Tier 1',
    tier2: 'Tier 2',
    tier3: 'Tier 3',
    bonus: 'Bonus',
    T1: 'Tier 1',
    T2: 'Tier 2',
    T3: 'Tier 3',
    BONUS: 'Bonus',
    MISS: 'Empty',
  };
  return tierMap[tier] || tier;
}

function resetSpinOverlayAnchorStyles() {
  const inner = document.querySelector('#spin-overlay .spin-overlay-inner');
  if (!inner) return;
  inner.style.position = '';
  inner.style.left = '';
  inner.style.transform = '';
  inner.style.bottom = '';
}

function positionSpinOverlayAnchor() {
  const overlay = document.getElementById('spin-overlay');
  const anchorEl = document.getElementById('today-paperclips-card');
  const inner = document.querySelector('#spin-overlay .spin-overlay-inner');
  if (!overlay || !anchorEl || !inner || overlay.classList.contains('hidden')) return;

  const pr = anchorEl.getBoundingClientRect();
  const ih = window.innerHeight;
  let bottomPx = ih - pr.top + SPIN_OVERLAY_GAP_ABOVE_PAPERCLIPS_PX;
  bottomPx = Math.max(10, Math.min(bottomPx, ih - 48));

  inner.style.position = 'fixed';
  inner.style.left = '50%';
  inner.style.transform = 'translateX(-50%)';
  inner.style.bottom = `${bottomPx}px`;
}

function openSpinOverlay() {
  clearSpinOverlayDismissTimer();
  clearSpinOverlayEarlyRewardTimer();
  const el = document.getElementById('spin-overlay');
  if (!el) return;
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  const reward = document.getElementById('spin-overlay-reward');
  if (reward) {
    reward.innerHTML = '';
    reward.className = 'spin-overlay-reward';
  }
  requestAnimationFrame(() => {
    positionSpinOverlayAnchor();
    requestAnimationFrame(positionSpinOverlayAnchor);
  });
}

function hideSpinOverlay() {
  clearSpinOverlayDismissTimer();
  clearSpinOverlayEarlyRewardTimer();
  resetSpinOverlayAnchorStyles();
  const el = document.getElementById('spin-overlay');
  if (el) {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }
  const strip = document.getElementById('spin-overlay-strip');
  if (strip) strip.innerHTML = '';
  const reward = document.getElementById('spin-overlay-reward');
  if (reward) {
    reward.innerHTML = '';
    reward.className = 'spin-overlay-reward';
  }
}

function rewardDisplayTierClass(sourceTier) {
  if (!sourceTier) return 'reward-tier-0';
  if (sourceTier === 'tier3') return 'reward-tier-3';
  if (sourceTier === 'tier2') return 'reward-tier-2';
  return 'reward-tier-1';
}

function fillSpinOverlayReward(wheelOutcome, activeTier, resolved, granted) {
  const rewardEl = document.getElementById('spin-overlay-reward');
  if (!rewardEl) return;

  const tierCls = rewardDisplayTierClass(granted.sourceTier);
  let main;
  if (!granted.blocks || wheelOutcome === 'MISS') {
    main = 'Empty';
  } else {
    const tierPay = tierLabel(granted.sourceTier);
    main = `${tierPay} · ${granted.blocks} block${granted.blocks !== 1 ? 's' : ''} · ${granted.minutes} min`;
  }

  const subParts = [];
  if (resolved.nearMiss && wheelOutcome !== 'MISS') subParts.push(resolved.nearMiss);

  rewardEl.className = `spin-overlay-reward ${tierCls}`;
  rewardEl.innerHTML =
    `<p class="spin-reward-main">${esc(main)}</p>` +
    (subParts.length
      ? `<div class="spin-reward-sub">${subParts.map(s => esc(s)).join(' ')}</div>`
      : '');
  requestAnimationFrame(() => {
    positionSpinOverlayAnchor();
  });
}

function dismissSpinOverlay() {
  if (!pendingSpinResult) return;
  clearSpinOverlayDismissTimer();
  const { wheelOutcome, activeTier, granted } = pendingSpinResult;
  addRewardBlocks(granted, wheelOutcome, activeTier);
  saveState();
  hideSpinOverlay();
  pendingSpinResult = null;
  if (wheelOutcome === 'BONUS') {
    openBonusFlow(activeTier, wheelOutcome, granted);
  } else {
    renderScreen(currentScreen);
  }
}

function startSpin(tier) {
  if (isSpinning) return;

  if (tier === 1) {
    if (getSpinsAvail() <= 0) {
      alert('No pending spins available yet.');
      renderToday();
      return;
    }
  }

  const option = chooseActivationOption(tier);
  if (!option) {
    alert(`Tier ${tier} is not unlocked yet.`);
    renderToday();
    return;
  }
  if (option.tier > 1 && !spendActivationCost(option)) {
    alert('Not enough clips for that cash-in.');
    renderScreen(currentScreen);
    return;
  }

  isSpinning = true;
  if (tier === 1) {
    state.pendingSpins = Math.max(0, (state.pendingSpins || 0) - 1);
  }
  saveState();

  showScreen('today');
  openSpinOverlay();

  const mounted = mountSpinner('spin-overlay-strip');
  if (!mounted) {
    isSpinning = false;
    hideSpinOverlay();
    return;
  }
  const { segments } = mounted;

  const wheelOutcome = chooseOutcome(OUTCOME_PROBABILITIES);
  const selectedSegment = chooseSegmentForOutcome(wheelOutcome, segments);
  const activeTier = option.tier || 1;

  const resolved = resolveWheelOutcome(activeTier, wheelOutcome);
  const granted = buildRewardGrant(resolved.payoutTier, wheelOutcome, activeTier);
  pendingSpinResult = { wheelOutcome, activeTier, resolved, granted };

  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const durationMs = prefersReduced ? SPIN_DURATION_REDUCED_MS : SPIN_DURATION_FULL_MS;

  let rewardFilled = false;
  const rewardAtMs = Math.max(0, durationMs - SPIN_REWARD_LEAD_MS);
  spinOverlayEarlyRewardTimer = setTimeout(() => {
    spinOverlayEarlyRewardTimer = null;
    fillSpinOverlayReward(wheelOutcome, activeTier, resolved, granted);
    rewardFilled = true;
  }, rewardAtMs);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      positionSpinOverlayAnchor();
      animateSpinner(selectedSegment, segments, durationMs, () => {
        clearSpinOverlayEarlyRewardTimer();
        if (!rewardFilled) {
          fillSpinOverlayReward(wheelOutcome, activeTier, resolved, granted);
        }
        isSpinning = false;
        saveState();
        renderTierButtons();
        clearSpinOverlayDismissTimer();
        spinOverlayDismissTimer = setTimeout(() => {
          spinOverlayDismissTimer = null;
          dismissSpinOverlay();
        }, SPIN_HOLD_AFTER_MS);
      });
    });
  });
}

function resolveWheelOutcome(activeTier, wheelOutcome) {
  if (wheelOutcome === 'T1') return { payoutTier: 'tier1', nearMiss: '' };
  if (wheelOutcome === 'T2') {
    return activeTier >= 2
      ? { payoutTier: 'tier2', nearMiss: '' }
      : { payoutTier: 'tier1', nearMiss: 'Near miss: Tier 2 not active.' };
  }
  if (wheelOutcome === 'T3') {
    return activeTier >= 3
      ? { payoutTier: 'tier3', nearMiss: '' }
      : { payoutTier: highestActiveTier(activeTier), nearMiss: 'Near miss: Tier 3 not active.' };
  }
  if (wheelOutcome === 'BONUS') {
    return { payoutTier: highestActiveTier(activeTier), nearMiss: '' };
  }
  if (wheelOutcome === 'MISS') {
    return { payoutTier: null, nearMiss: 'Empty: no reward blocks earned.' };
  }
  return { payoutTier: 'tier1', nearMiss: '' };
}

function buildRewardGrant(sourceTier, wheelOutcome, activeTier) {
  if (!sourceTier || wheelOutcome === 'MISS') {
    return { sourceTier: null, blocks: 0, minutes: 0, text: 'No reward blocks earned.' };
  }
  const cfg = state.settings.rewards[sourceTier];
  const blocks = cfg && cfg.blocks ? cfg.blocks : 0;
  const text = cfg && cfg.text ? cfg.text : '';
  return { sourceTier, blocks, minutes: blocks * 30, text };
}

function addRewardBlocks(grant, wheelOutcome, activeTier) {
  if (!grant || !grant.blocks) return;
  const earnedAt = new Date().toISOString();
  for (let i = 0; i < grant.blocks; i++) {
    state.rewardBlocks.push({
      id: state.nextId++,
      minutes: 30,
      earnedAt,
      sourceTier: grant.sourceTier,
      wheelOutcome,
      activeTier,
    });
  }
}

function spinBonusWheel() {
  let r = Math.random(), cum = 0;
  for (const { outcome, p } of BONUS_WHEEL) {
    cum += p;
    if (r < cum) return outcome;
  }
  return '75';
}

let pendingBonusTasks = [];
let pendingBonusMessages = [];

function openBonusFlow(activeTier, wheelOutcome, granted) {
  pendingBonusTasks = [];
  pendingBonusMessages = [
    `Wheel landed Bonus. ${tierLabel(granted.sourceTier)} paid ${granted.blocks} reward block${granted.blocks !== 1 ? 's' : ''}.`,
  ];
  processBonusDraws(1, 0);
  saveState();
  showNextBonusTask();
}

function processBonusDraws(drawCount, depth) {
  if (depth >= MAX_BONUS_CHAIN_DEPTH) return;
  for (let i = 0; i < drawCount; i++) {
    const outcome = spinBonusWheel();
    state.bonusHistory.push({ id: state.nextId++, outcome, status: 'drawn', completedAt: new Date().toISOString() });
    if (outcome === 'free') {
      const clip = drawClip();
      state.lastClipDrawn = clip;
      state.pendingSpins++;
      pendingBonusMessages.push(`FREE: drew ${clip} clip and added 1 pending spin.`);
      state.bonusHistory.push({ id: state.nextId++, outcome, status: `free ${clip}`, completedAt: new Date().toISOString() });
    } else if (outcome === 'extra') {
      pendingBonusMessages.push('EXTRA: bonus wheel draws twice.');
      processBonusDraws(2, depth + 1);
    } else {
      pendingBonusTasks.push(outcome);
    }
  }
}

function showNextBonusTask() {
  const body = document.getElementById('bonus-body');
  const messages = pendingBonusMessages.map(msg => `<div class="bonus-note">${esc(msg)}</div>`).join('');
  const next = pendingBonusTasks[0];

  if (!next) {
    body.innerHTML = `
      <div class="spin-tier">Bonus complete</div>
      ${messages}
      <button class="btn btn-solid btn-full mt16" id="bonus-close-btn">Done</button>
    `;
    document.getElementById('bonus-close-btn').addEventListener('click', () => {
      hideSheet('bonus-sheet');
      renderScreen(currentScreen);
    });
    showSheet('bonus-sheet');
    return;
  }

  const minutes = { '75': '20-25', '50': '15', '25': '8' }[next];
  body.innerHTML = `
    <div class="spin-tier">Bonus ${next}%</div>
    ${messages}
    <div class="spin-text" style="margin:12px 0 20px;font-size:16px">
      Complete roughly ${minutes} extra minutes to earn one extra clip and one extra pending spin.
    </div>
    <button class="btn btn-solid btn-full" id="bonus-done-btn">Done</button>
    <button class="btn btn-outline btn-full mt8" id="bonus-skip-btn">Skip</button>
  `;
  document.getElementById('bonus-done-btn').addEventListener('click', completeBonusTask);
  document.getElementById('bonus-skip-btn').addEventListener('click', skipBonusTask);
  showSheet('bonus-sheet');
}

function completeBonusTask() {
  const outcome = pendingBonusTasks.shift();
  const clip = drawClip();
  state.lastClipDrawn = clip;
  state.pendingSpins++;
  state.bonusHistory.push({ id: state.nextId++, outcome, status: `completed ${clip}`, completedAt: new Date().toISOString() });
  pendingBonusMessages.push(`${outcome}% done: drew ${clip} clip and added 1 pending spin.`);
  saveState();
  showNextBonusTask();
}

function skipBonusTask() {
  const outcome = pendingBonusTasks.shift();
  state.bonusHistory.push({ id: state.nextId++, outcome, status: 'skipped', completedAt: new Date().toISOString() });
  pendingBonusMessages.push(`${outcome}% skipped.`);
  saveState();
  showNextBonusTask();
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

function openBlocksPerSpinSheet() {
  document.getElementById('blocks-per-spin-input').value = state.settings.blocksPerSpin;
  showSheet('blocks-per-spin-sheet');
}

function saveBlocksPerSpin() {
  const v = parseInt(document.getElementById('blocks-per-spin-input').value, 10);
  if (isNaN(v) || v < 1) return;
  state.settings.blocksPerSpin = v;
  saveState();
  hideSheet('blocks-per-spin-sheet');
  renderSettings();
  renderToday();
}

function openClipBagSheet() {
  for (const color of NORMAL_CLIPS) {
    document.getElementById(`clip-bag-${color}`).value = state.clipBag.template[color] || 0;
  }
  document.getElementById('clip-bag-gold').value = state.clipBag.template.gold || 0;
  document.getElementById('draw-mode-input').value = state.settings.drawMode || 'bag';
  showSheet('clip-bag-sheet');
}

function saveClipBag() {
  const template = {};
  for (const color of CLIP_COLORS) {
    const v = parseInt(document.getElementById(`clip-bag-${color}`).value, 10);
    template[color] = !isNaN(v) && v >= 0 ? v : DEFAULT_CLIP_TEMPLATE[color];
  }
  state.settings.drawMode = document.getElementById('draw-mode-input').value || 'bag';
  state.clipBag.template = normalizeClipTemplate(template);
  state.clipBag.mode = state.settings.drawMode;
  state.clipBag.remaining = [];
  saveState();
  hideSheet('clip-bag-sheet');
  renderSettings();
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
  const exportedState = exportStateForBackup(state);
  const blob = new Blob([JSON.stringify(exportedState, null, 2)], { type: 'application/json' });
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
      if (!isValidState(imported)) throw new Error('invalid');
      showConfirm('Replace all current data with this backup?', () => {
        state = normalizeState(imported);
        state.schemaVersion = SCHEMA_VERSION;
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
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  );
}

function addProductiveBlock(kind) {
  const t = todayStr();
  const byDate = kind === 'practice' ? state.practiceByDate : state.workoutByDate;
  const totalKey = kind === 'practice' ? 'totalPracticeBlocks' : 'totalWorkoutBlocks';

  byDate[t] = (byDate[t] || 0) + 1;
  state[totalKey]++;
  const clip = drawClip();
  state.lastClipDrawn = clip;
  addProgressTowardSpin();
  state.clipDrawsByDate = normalizeClipDraws(state.clipDrawsByDate);
  state.clipDrawsByDate[t].push({
    id: state.nextId++,
    kind,
    date: t,
    clip,
    createdAt: new Date().toISOString(),
  });

  saveState();
  renderScreen(currentScreen);
}

function removeProductiveBlock(kind) {
  const t = todayStr();
  const byDate = kind === 'practice' ? state.practiceByDate : state.workoutByDate;
  const totalKey = kind === 'practice' ? 'totalPracticeBlocks' : 'totalWorkoutBlocks';
  const current = byDate[t] || 0;
  if (current <= 0) return;

  byDate[t] = current - 1;
  state[totalKey] = Math.max(0, state[totalKey] - 1);
  state.clipDrawsByDate = normalizeClipDraws(state.clipDrawsByDate);
  const draws = state.clipDrawsByDate[t] || [];
  const drawIndex = draws.map(draw => draw.kind).lastIndexOf(kind);

  if (drawIndex >= 0) {
    const [draw] = draws.splice(drawIndex, 1);
    if ((state.clipInventory[draw.clip] || 0) > 0) {
      state.clipInventory[draw.clip]--;
    }
    state.lastClipDrawn = draw.clip;
    removeProgressTowardSpin();
    saveState();
    renderScreen(currentScreen);
  } else {
    saveState();
    renderScreen(currentScreen);
    alert('Removed the block. No same-day clip record was available to reverse.');
  }
}

/* ═══ EVENT BINDING ══════════════════════════════════════════════════════ */

function initEvents() {
  document.getElementById('today-date').addEventListener('click', () => showScreen('today'));
  document.getElementById('top-progress-btn').addEventListener('click', () => showScreen('progress'));
  document.getElementById('top-rewards-btn').addEventListener('click', () => showScreen('rewards'));
  document.getElementById('top-settings-btn').addEventListener('click', () => showScreen('settings'));

  document.querySelectorAll('[data-progress-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      progressRange = btn.dataset.progressRange;
      renderProgress();
    });
  });

  // Practice +/−
  document.getElementById('practice-plus').addEventListener('click', () => {
    addProductiveBlock('practice');
  });

  document.getElementById('practice-minus').addEventListener('click', () => {
    removeProductiveBlock('practice');
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
    addProductiveBlock('workout');
  });

  document.getElementById('workout-minus').addEventListener('click', () => {
    removeProductiveBlock('workout');
  });

  // Status pill → deficit sheet
  document.getElementById('practice-status-pill').addEventListener('click', showDeficitSheet);

  // Spin choices
  document.getElementById('tier1-spin-btn').addEventListener('click', () => startSpin(1));
  document.getElementById('tier2-spin-btn').addEventListener('click', () => startSpin(2));
  document.getElementById('tier3-spin-btn').addEventListener('click', () => startSpin(3));

  document.getElementById('spend-selected-btn').addEventListener('click', spendSelectedBlocks);

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
  document.getElementById('set-blocks-per-spin').addEventListener('click', openBlocksPerSpinSheet);
  document.getElementById('set-clip-bag').addEventListener('click', openClipBagSheet);
  document.getElementById('set-rewards').addEventListener('click', openRewardsSheet);
  document.getElementById('set-cap').addEventListener('click', openCapSheet);
  document.getElementById('blocks-per-spin-save').addEventListener('click', saveBlocksPerSpin);
  document.getElementById('clip-bag-save').addEventListener('click', saveClipBag);
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

  function syncSpinOverlayAnchorIfOpen() {
    const ov = document.getElementById('spin-overlay');
    if (ov && !ov.classList.contains('hidden')) positionSpinOverlayAnchor();
  }
  window.addEventListener('resize', syncSpinOverlayAnchorIfOpen);
  window.addEventListener('scroll', syncSpinOverlayAnchorIfOpen, true);

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
