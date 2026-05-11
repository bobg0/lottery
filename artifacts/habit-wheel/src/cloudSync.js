import { createClient } from '@supabase/supabase-js';

const TABLE_NAME = 'app_states';
const CURRENT_SCHEMA_VERSION = 3;
const PROGRESS_FIELDS = ['questionsByDate', 'practiceByDate', 'workoutByDate'];
const CONSUMABLE_FIELDS = [
  'clipInventory',
  'clipBag',
  'pendingSpins',
  'blocksTowardNextSpin',
  'lastClipDrawn',
  'clipDrawsByDate',
  'wheelRotation',
];

let supabaseClient = null;

function env(name) {
  return (import.meta.env && import.meta.env[name]) || '';
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeDeviceId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sumDateMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;
  return Object.values(map).reduce((sum, value) => sum + numberValue(value), 0);
}

function stateTime(state) {
  if (!state || typeof state !== 'object') return 0;
  return Date.parse(state.updatedAt || state.lastUpdatedAt || state.lastCloudSyncAt || '') || 0;
}

function isLocalNewerOrEqual(localState, cloudState) {
  return stateTime(localState) >= stateTime(cloudState);
}

function maxMergeDateMap(localMap = {}, cloudMap = {}) {
  const out = {};
  const keys = new Set([
    ...Object.keys(localMap || {}),
    ...Object.keys(cloudMap || {}),
  ]);

  for (const key of keys) {
    const value = Math.max(numberValue(localMap[key]), numberValue(cloudMap[key]));
    if (value > 0) out[key] = value;
  }

  return out;
}

function hasStableIds(items) {
  return Array.isArray(items) && items.every(item => item && item.id != null);
}

function itemTime(item, dateField) {
  return Date.parse(
    (item && (item[dateField] || item.updatedAt || item.createdAt || item.earnedAt || item.spentAt)) || ''
  ) || 0;
}

function mergeArrayById(localItems = [], cloudItems = [], dateField, newerItems = []) {
  const local = Array.isArray(localItems) ? localItems : [];
  const cloud = Array.isArray(cloudItems) ? cloudItems : [];

  if (!hasStableIds(local) || !hasStableIds(cloud)) {
    if (local.length === cloud.length) return clone(newerItems || []);
    return clone(local.length > cloud.length ? local : cloud);
  }

  const byId = new Map();
  for (const item of [...cloud, ...local]) {
    const existing = byId.get(item.id);
    if (!existing || itemTime(item, dateField) >= itemTime(existing, dateField)) {
      byId.set(item.id, clone(item));
    }
  }

  return [...byId.values()].sort((a, b) => itemTime(a, dateField) - itemTime(b, dateField));
}

function collectSpentBlockIds(spentHistory = []) {
  const ids = new Set();
  for (const entry of spentHistory || []) {
    if (!entry) continue;
    const refs = Array.isArray(entry.blockIds)
      ? entry.blockIds
      : entry.rewardBlockId != null
        ? [entry.rewardBlockId]
        : [];
    for (const id of refs) ids.add(id);
  }
  return ids;
}

function hasSpentHistoryWithoutBlockRefs(spentHistory = []) {
  return (spentHistory || []).some(entry => {
    if (!entry) return false;
    if (Array.isArray(entry.blockIds) && entry.blockIds.length) return false;
    if (entry.rewardBlockId != null) return false;
    return true;
  });
}

function validDate(dateStr) {
  return typeof dateStr === 'string' && !Number.isNaN(Date.parse(dateStr));
}

function earliestDate(a, b) {
  if (validDate(a) && validDate(b)) return a <= b ? a : b;
  return validDate(a) ? a : b;
}

function latestDate(a, b) {
  if (validDate(a) && validDate(b)) return a >= b ? a : b;
  return validDate(a) ? a : b;
}

function withCloudFields(state, markSynced = false) {
  const next = clone(state || {});
  const now = nowIso();
  next.schemaVersion = next.schemaVersion || CURRENT_SCHEMA_VERSION;
  next.deviceId = next.deviceId || makeDeviceId();
  next.updatedAt = markSynced ? now : (next.updatedAt || now);
  next.sync = {
    ...(next.sync || {}),
    dirty: markSynced ? false : Boolean(next.sync && next.sync.dirty),
  };
  if (markSynced) {
    next.lastCloudSyncAt = now;
    next.sync.lastSyncedAt = now;
    next.sync.lastCloudUpdatedAt = now;
  }
  return next;
}

export function isCloudConfigured() {
  return Boolean(env('VITE_SUPABASE_URL') && env('VITE_SUPABASE_ANON_KEY'));
}

export function getSupabaseClient() {
  if (!isCloudConfigured()) return null;
  if (!supabaseClient) {
    const auth = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      auth.storage = window.localStorage;
    }
    supabaseClient = createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
      auth,
    });
  }
  return supabaseClient;
}

export async function signUpWithPassword(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session ? session.user : null;
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return { unsubscribe() {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? session.user : null);
  });
  return data.subscription;
}

export async function loadCloudState() {
  const supabase = getSupabaseClient();
  const user = await getCurrentUser();
  if (!supabase) throw new Error('Cloud backup is not configured.');
  if (!user) throw new Error('Sign in before using cloud backup.');

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('state, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data && data.state ? data.state : null;
}

export async function saveCloudState(state) {
  const supabase = getSupabaseClient();
  const user = await getCurrentUser();
  if (!supabase) throw new Error('Cloud backup is not configured.');
  if (!user) throw new Error('Sign in before using cloud backup.');

  const stateToSave = markCloudSync(state);
  stateToSave.userId = user.id;
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({
      user_id: user.id,
      state: stateToSave,
      updated_at: stateToSave.lastCloudSyncAt,
    }, { onConflict: 'user_id' });

  if (error) throw error;
  return stateToSave;
}

export async function syncWithCloud(localState) {
  const cloudState = await loadCloudState();
  const localEmpty = isEffectivelyEmptyState(localState);
  const cloudEmpty = isEffectivelyEmptyState(cloudState);

  if (localEmpty && (!cloudState || cloudEmpty)) {
    return { action: 'empty-noop', state: withCloudFields(localState, false), cloudState };
  }

  if (!cloudState || cloudEmpty) {
    const saved = await saveCloudState(localState);
    return { action: localEmpty ? 'saved-empty' : 'uploaded-local', state: saved, cloudState };
  }

  if (localEmpty && !cloudEmpty) {
    return { action: 'cloud-found', needsChoice: true, state: null, cloudState };
  }

  const merged = mergeLocalAndCloud(localState, cloudState);
  const saved = await saveCloudState(merged);
  return { action: 'merged', state: saved, cloudState };
}

export function mergeLocalAndCloud(localState, cloudState) {
  const local = clone(localState || {});
  const cloud = clone(cloudState || {});
  const localEmpty = isEffectivelyEmptyState(local);
  const cloudEmpty = isEffectivelyEmptyState(cloud);

  if (localEmpty && !cloudEmpty) {
    return {
      ...cloud,
      deviceId: local.deviceId || cloud.deviceId || makeDeviceId(),
      updatedAt: nowIso(),
    };
  }
  if (cloudEmpty && !localEmpty) {
    return {
      ...local,
      updatedAt: nowIso(),
    };
  }

  const newer = isLocalNewerOrEqual(local, cloud) ? local : cloud;
  const merged = {
    ...cloud,
    ...local,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    deviceId: local.deviceId || makeDeviceId(),
    settings: local.settings || cloud.settings || {},
    startDate: earliestDate(local.startDate, cloud.startDate),
    lastDate: latestDate(local.lastDate, cloud.lastDate),
    weekStart: local.weekStart || cloud.weekStart,
    activeDate: localDateKey(),
    userId: local.userId || cloud.userId || null,
  };

  for (const field of PROGRESS_FIELDS) {
    merged[field] = maxMergeDateMap(local[field], cloud[field]);
  }

  merged.totalQuestions = sumDateMap(merged.questionsByDate);
  merged.totalPracticeBlocks = sumDateMap(merged.practiceByDate);
  merged.totalWorkoutBlocks = sumDateMap(merged.workoutByDate);

  // Consumables are last-writer-wins because max-merge can resurrect spent clips/spins/rewards.
  for (const field of CONSUMABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(newer, field)) {
      merged[field] = clone(newer[field]);
    }
  }

  const spentHistory = mergeArrayById(local.spentHistory, cloud.spentHistory, 'spentAt', newer.spentHistory);
  const spentBlockIds = collectSpentBlockIds(spentHistory);
  const spentWithoutRefs = hasSpentHistoryWithoutBlockRefs(spentHistory);
  const canUnionRewards =
    hasStableIds(local.rewardBlocks || []) &&
    hasStableIds(cloud.rewardBlocks || []) &&
    !spentWithoutRefs;

  merged.spentHistory = spentHistory;
  if (canUnionRewards) {
    merged.rewardBlocks = mergeArrayById(local.rewardBlocks, cloud.rewardBlocks, 'earnedAt', newer.rewardBlocks)
      .filter(block => !spentBlockIds.has(block.id));
  } else {
    merged.rewardBlocks = clone(newer.rewardBlocks || []);
  }

  merged.discardedHistory = mergeArrayById(
    local.discardedHistory,
    cloud.discardedHistory,
    'discardedAt',
    (local.discardedHistory || []).length >= (cloud.discardedHistory || []).length
      ? local.discardedHistory
      : cloud.discardedHistory
  );
  merged.bonusHistory = mergeArrayById(
    local.bonusHistory,
    cloud.bonusHistory,
    'completedAt',
    (local.bonusHistory || []).length >= (cloud.bonusHistory || []).length
      ? local.bonusHistory
      : cloud.bonusHistory
  );

  merged.nextId = Math.max(
    numberValue(local.nextId),
    numberValue(cloud.nextId),
    nextIdFromArrays(merged.rewardBlocks, merged.spentHistory, merged.discardedHistory, merged.bonusHistory)
  );
  merged.updatedAt = nowIso();
  merged.sync = {
    ...(cloud.sync || {}),
    ...(local.sync || {}),
    dirty: true,
  };
  return merged;
}

function nextIdFromArrays(...arrays) {
  let maxId = 0;
  for (const arr of arrays) {
    for (const item of arr || []) {
      if (item && Number.isFinite(Number(item.id))) maxId = Math.max(maxId, Number(item.id));
      if (Array.isArray(item && item.blockIds)) {
        for (const id of item.blockIds) {
          if (Number.isFinite(Number(id))) maxId = Math.max(maxId, Number(id));
        }
      }
    }
  }
  return maxId + 1;
}

export function shouldDailySync(state) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const lastSync = state && state.sync && state.sync.lastSyncedAt
    ? state.sync.lastSyncedAt
    : state && state.lastCloudSyncAt;
  const last = lastSync ? localDateKey(new Date(lastSync)) : '';
  return last !== localDateKey();
}

export function markCloudSync(state) {
  return withCloudFields(state, true);
}

export function isEffectivelyEmptyState(state) {
  if (!state || typeof state !== 'object') return true;
  if (sumDateMap(state.questionsByDate) > 0) return false;
  if (sumDateMap(state.practiceByDate) > 0) return false;
  if (sumDateMap(state.workoutByDate) > 0) return false;
  if (state.days && typeof state.days === 'object') {
    for (const record of Object.values(state.days)) {
      if (!record || typeof record !== 'object') continue;
      if (numberValue(record.practiceMinutes) > 0) return false;
      if (numberValue(record.workoutMinutes) > 0) return false;
      if (numberValue(record.questionsDone) > 0) return false;
    }
  }
  if (numberValue(state.totalQuestions) > 0) return false;
  if (numberValue(state.totalPracticeBlocks) > 0) return false;
  if (numberValue(state.totalWorkoutBlocks) > 0) return false;
  if (numberValue(state.pendingSpins) > 0) return false;
  if (numberValue(state.blocksTowardNextSpin) > 0) return false;
  if (sumDateMap(state.clipInventory) > 0) return false;
  if (Array.isArray(state.rewardBlocks) && state.rewardBlocks.length) return false;
  if (Array.isArray(state.spentHistory) && state.spentHistory.length) return false;
  if (Array.isArray(state.discardedHistory) && state.discardedHistory.length) return false;
  if (Array.isArray(state.bonusHistory) && state.bonusHistory.length) return false;
  if (state.clipDrawsByDate && Object.values(state.clipDrawsByDate).some(items => Array.isArray(items) && items.length)) {
    return false;
  }
  return true;
}
