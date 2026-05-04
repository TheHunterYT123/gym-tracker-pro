/**
 * stats.js — Racha de entrenamiento (streak) corregida
 * Los días de DESCANSO no rompen la racha
 */
import { Storage } from './db.js';

const TRAIN_DAYS = ['Martes','Miércoles','Jueves','Sábado','Domingo'];
const DAY_NAMES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

let _s = { streak:0, longestStreak:0, totalDays:0, lastWorkoutDate:null, workoutDates:[], startDate:null };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00')) / 86400000);
}

/** Cuenta cuántos días de entrenamiento hay entre dos fechas ISO */
function trainDaysBetween(fromISO, toISO) {
  let count = 0;
  const from = new Date(fromISO+'T12:00:00');
  const to   = new Date(toISO+'T12:00:00');
  const cur  = new Date(from);
  cur.setDate(cur.getDate() + 1); // empezar desde el día siguiente
  while (cur < to) {
    if (TRAIN_DAYS.includes(DAY_NAMES[cur.getDay()])) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function recalcStreak() {
  if (!_s.lastWorkoutDate) { _s.streak = 0; return; }
  const today = todayISO();
  if (_s.lastWorkoutDate === today) return; // ya entrenó hoy
  // ¿Cuántos días de entrenamiento se perdieron desde el último?
  const missed = trainDaysBetween(_s.lastWorkoutDate, today);
  if (missed > 1) _s.streak = 0; // perdió más de 1 día de entrenamiento → racha rota
}

export async function loadStats() {
  const saved = await Storage.getStats();
  if (saved) _s = { ..._s, ...saved };
  recalcStreak();
  return { ..._s };
}

export function getStats() { return { ..._s }; }

export async function recordWorkout() {
  const today = todayISO();
  if (_s.lastWorkoutDate === today) {
    await Storage.saveStats(_s);
    return { ..._s };
  }
  if (_s.lastWorkoutDate) {
    const missed = trainDaysBetween(_s.lastWorkoutDate, today);
    _s.streak = missed > 1 ? 1 : _s.streak + 1;
  } else {
    _s.streak = 1;
  }
  _s.lastWorkoutDate = today;
  _s.totalDays = (_s.totalDays || 0) + 1;
  if (_s.streak > _s.longestStreak) _s.longestStreak = _s.streak;
  if (!_s.startDate) _s.startDate = today;
  _s.workoutDates = [...(_s.workoutDates||[]), today].slice(-90);
  await Storage.saveStats(_s);
  return { ..._s };
}

export async function setManualStats({ streak, totalDays, lastWorkoutDate }) {
  if (streak !== undefined) _s.streak = Math.max(0, +streak || 0);
  if (totalDays !== undefined) _s.totalDays = Math.max(0, +totalDays || 0);
  if (lastWorkoutDate !== undefined) _s.lastWorkoutDate = lastWorkoutDate;
  if (_s.streak > _s.longestStreak) _s.longestStreak = _s.streak;
  await Storage.saveStats(_s);
  return { ..._s };
}

export function getWeekStats() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const thisWeek = (_s.workoutDates||[]).filter(d => new Date(d+'T12:00:00') >= weekStart);
  return { workoutsThisWeek: thisWeek.length, streak: _s.streak, longestStreak: _s.longestStreak, totalDays: _s.totalDays };
}
