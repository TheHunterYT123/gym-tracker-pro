/**
 * db.js — Persistencia con IndexedDB + fallback localStorage
 */
const DB_NAME = 'GymTrackerDB';
const DB_VERSION = 1;
const STORES = { WORKOUTS:'workouts', SETTINGS:'settings', STATS:'stats', DIET:'dietLog', ACH:'achievements' };
let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.values(STORES).forEach(s => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'key' });
      });
    };
  });
}

async function idbGet(store, key) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = db.transaction(store,'readonly').objectStore(store).get(key);
      r.onsuccess = () => res(r.result?.value ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch { try { return JSON.parse(localStorage.getItem(`${store}:${key}`)); } catch { return null; } }
}

async function idbSet(store, key, value) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = db.transaction(store,'readwrite').objectStore(store).put({ key, value });
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  } catch { try { localStorage.setItem(`${store}:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
}

async function idbGetAll(store) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = db.transaction(store,'readonly').objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch { return []; }
}

export const Storage = {
  saveWorkout: (day, data) => idbSet(STORES.WORKOUTS, day, { ...data, updatedAt: Date.now() }),
  getWorkout:  (day) => idbGet(STORES.WORKOUTS, day),
  getAllWorkouts: () => idbGetAll(STORES.WORKOUTS),
  saveSetting: (key, val) => idbSet(STORES.SETTINGS, key, val),
  getSetting:  async (key, def=null) => { const v = await idbGet(STORES.SETTINGS, key); return v !== null ? v : def; },
  getAllSettings: async () => {
    const all = await idbGetAll(STORES.SETTINGS);
    return Object.fromEntries(all.map(r => [r.key, r.value]));
  },
  saveStats: (data) => idbSet(STORES.STATS, 'main', data),
  getStats:  () => idbGet(STORES.STATS, 'main'),
  saveDietLog: (date, data) => idbSet(STORES.DIET, date, data),
  getDietLog:  (date) => idbGet(STORES.DIET, date),
  saveAchievements: (data) => idbSet(STORES.ACH, 'main', data),
  getAchievements:  () => idbGet(STORES.ACH, 'main'),
};

window.Storage = Storage;
