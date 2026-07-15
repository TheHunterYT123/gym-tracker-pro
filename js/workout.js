/**
 * workout.js — Datos de rutina + guardado robusto con debounce autosave
 */
import { Storage } from './db.js';
import { recordWorkout } from './stats.js';

// ─── Colores por músculo ──────────────────────────────────────────────────────
export const MUSCLE_COLORS = {
  'Pecho':                { bg:'rgba(59,130,246,0.15)',  c:'#60a5fa' },
  'Hombros':              { bg:'rgba(139,92,246,0.15)',  c:'#a78bfa' },
  'Tríceps':              { bg:'rgba(239,68,68,0.15)',   c:'#f87171' },
  'Espalda':              { bg:'rgba(34,197,94,0.15)',   c:'#4ade80' },
  'Trapecio inferior':    { bg:'rgba(20,184,166,0.15)',  c:'#2dd4bf' },
  'Delt. Posterior':      { bg:'rgba(236,72,153,0.15)',  c:'#f472b6' },
  'Delt. Post. + Trap.':  { bg:'rgba(20,184,166,0.15)',  c:'#2dd4bf' },
  'Bíceps':               { bg:'rgba(236,72,153,0.15)',  c:'#f472b6' },
  'Antebrazos':           { bg:'rgba(107,114,128,0.15)', c:'#9ca3af' },
  'Cuádriceps':           { bg:'rgba(245,158,11,0.15)',  c:'#fbbf24' },
  'Isquios / Glúteos':    { bg:'rgba(245,158,11,0.15)',  c:'#fbbf24' },
  'Isquios':              { bg:'rgba(245,158,11,0.15)',  c:'#fbbf24' },
  'Aductor':              { bg:'rgba(245,158,11,0.15)',  c:'#fbbf24' },
  'Pantorrillas':         { bg:'rgba(245,158,11,0.15)',  c:'#fbbf24' },
  'Trapecio':             { bg:'rgba(20,184,166,0.15)',  c:'#2dd4bf' },
  'Piernas (2a freq)':    { bg:'rgba(245,158,11,0.15)',  c:'#fbbf24' },
};

// ───── Rutina — Bloque 1: Amplitud y corrección (Meses 1-6) ─────
// Sistema RIR: número = repeticiones en reserva. "X → Y" significa que empiezas
// más lejos del fallo y terminas más cerca en la última serie. Calienta antes
// de cada primer ejercicio por grupo muscular — las series de calentamiento
// no cuentan en el conteo de series de trabajo.
export const ROUTINE = {
  Martes:{ label:'Push A — Pecho · Hombros · Tríceps', exercises:[
    {id:'ma1',muscle:'Pecho',   name:'Press inclinado con mancuernas (30–45°)',            tag:'PRIORIDAD',sets:3,range:'8–12', rest:'2:30 min',   restS:150, rir:'RIR 2 → 0 (últ. serie)'},
    {id:'ma2',muscle:'Pecho',   name:'Press de banca plano con barra',                      tag:'PRIORIDAD',sets:3,range:'6–10', rest:'2:30–3 min', restS:165, rir:'RIR 2 → 1'},
    {id:'ma8',muscle:'Tríceps', name:'Press francés con barra Z o ext. overhead con mancuerna (un brazo)', tag:'PRIORIDAD',sets:3,range:'10–12',rest:'1:30–2 min', restS:105, rir:'RIR 1 → 0'},
    {id:'ma4',muscle:'Hombros', name:'Press militar con mancuernas sentado',                              sets:2,range:'10–12',rest:'2 min',      restS:120, rir:'RIR 2–3 (no busques el fallo aquí)'},
    {id:'ma3',muscle:'Pecho',   name:'Fly en polea (cable crossover)',                                    sets:2,range:'12–15',rest:'1:30 min',   restS:90,  rir:'RIR 1'},
    {id:'ma5',muscle:'Hombros', name:'Elevaciones laterales en polea — dropset',                          sets:3,range:'15–20',rest:'1:30 min',   restS:90,  rir:'RIR 0 en el dropset final'},
    {id:'ma7',muscle:'Tríceps', name:'Pushdown en polea (cuerda o barra)',                                sets:2,range:'12–15',rest:'1:30 min',   restS:90,  rir:'RIR 0–1'},
  ]},
  Miércoles:{ label:'Pull A — Espalda · Trap. Inf. · Delt. Post. · Bíceps', exercises:[
    {id:'mi12',muscle:'Trapecio inferior',   name:'Y-raise en banco inclinado con mancuernas',           tag:'PRIORIDAD',sets:3,range:'12–15',rest:'1:30 min',  restS:90,  rir:'RIR 1'},
    {id:'mi13',muscle:'Romboides / Trap. medio', name:'Remo con mancuerna apoyado en banco, codo alto + squeeze arriba', tag:'PRIORIDAD',sets:3,range:'10–12',rest:'2 min', restS:120, rir:'RIR 1'},
    {id:'mi1', muscle:'Espalda', name:'Remo con barra inclinado (overhand)',                              tag:'PRINCIPAL',sets:3,range:'8–12', rest:'2:30 min',  restS:150, rir:'RIR 2 → 1'},
    {id:'mi3', muscle:'Espalda', name:'Dominadas agarre prono',                                            sets:3,range:'6–10', rest:'2:30 min',  restS:150, rir:'RIR 2 → 1'},
    {id:'mi6', muscle:'Delt. Posterior', name:'Face pulls en polea',                                       sets:3,range:'15–20',rest:'1:30 min',  restS:90,  rir:'RIR 0–1'},
    {id:'mi8', muscle:'Bíceps', name:'Curl con barra Z (EZ)',                                              sets:3,range:'8–12', rest:'1:30–2 min',restS:105, rir:'RIR 1'},
    {id:'mi9', muscle:'Bíceps', name:'Curl inclinado con mancuernas (stretch)',                            sets:2,range:'10–12',rest:'1:30 min',  restS:90,  rir:'RIR 0–1'},
    {id:'mi10',muscle:'Bíceps / Braquial', name:'Curl martillo con mancuerna',                             sets:2,range:'12–15',rest:'1:30 min',  restS:90,  rir:'RIR 0–1'},
    {id:'mi11',muscle:'Antebrazos', name:'Curl de muñeca + invertido',                                     sets:2,range:'15–20',rest:'1 min',     restS:60,  rir:'RIR 0'},
  ]},
  Jueves:{ label:'Piernas — Cuáds · Isquios · Glúteos · Pantorrillas · Abdomen', exercises:[
    {id:'ju4',muscle:'Isquios / Glúteos', name:'Romanian Deadlift (RDL)',        tag:'PRIORIDAD',sets:3,range:'10–12',rest:'2–2:30 min', restS:135, rir:'RIR 1–2'},
    {id:'ju5',muscle:'Isquios', name:'Curl femoral sentado',                     tag:'PRIORIDAD',sets:3,range:'10–12',rest:'1:30–2 min', restS:105, rir:'RIR 0–1'},
    {id:'ju1',muscle:'Cuádriceps', name:'Sentadilla con barra o Hack squat',     tag:'PRINCIPAL',sets:3,range:'8–12', rest:'2:30–3 min', restS:165, rir:'RIR 2 → 1'},
    {id:'ju2',muscle:'Cuádriceps', name:'Prensa 45° (leg press)',                                sets:3,range:'10–15',rest:'2 min',      restS:120, rir:'RIR 1'},
    {id:'ju3',muscle:'Cuádriceps', name:'Extensiones de pierna',                                 sets:2,range:'12–15',rest:'1:30 min',   restS:90,  rir:'RIR 0–1'},
    {id:'ju6',muscle:'Aductor', name:'Aductor interno en máquina',                               sets:3,range:'12–15',rest:'1:30 min',   restS:90,  rir:'RIR 0–1'},
    {id:'ju7',muscle:'Pantorrillas', name:'Pantorrilla de pie (calf raise)',                     sets:3,range:'12–20',rest:'1:30 min',   restS:90,  rir:'RIR 0'},
    {id:'ju8',muscle:'Abdomen', name:'Elevación de piernas colgado o en banco', tag:'NUEVO',      sets:2,range:'12–15',rest:'1 min',      restS:60,  rir:'RIR 0–1'},
  ]},
  Sábado:{ label:'Push B — Pecho · Hombros · Tríceps', exercises:[
    {id:'sa1',muscle:'Pecho',   name:'Press de banca plano con barra',       tag:'PRIORIDAD',sets:3,range:'6–10', rest:'2:30–3 min',restS:165, rir:'RIR 2 → 1'},
    {id:'sa2',muscle:'Pecho',   name:'Press inclinado con mancuernas',       tag:'PRIORIDAD',sets:3,range:'10–12',rest:'2 min',     restS:120, rir:'RIR 1'},
    {id:'sa8',muscle:'Pecho / Tríceps', name:'Press agarre cerrado con barra Z', tag:'PRIORIDAD',sets:3,range:'8–10', rest:'2 min', restS:120, rir:'RIR 1'},
    {id:'sa3',muscle:'Pecho',   name:'Pec deck o fly con mancuernas',                          sets:2,range:'12–15',rest:'1:30 min',   restS:90,  rir:'RIR 0–1'},
    {id:'sa6',muscle:'Hombros', name:'Elevaciones laterales en polea — dropset',               sets:3,range:'15–20',rest:'1:30 min',   restS:90,  rir:'RIR 0 en el dropset final'},
    {id:'sa7',muscle:'Tríceps', name:'Extensión overhead en polea (cuerda)',                    sets:3,range:'10–15',rest:'1:30–2 min', restS:105, rir:'RIR 0–1'},
    {id:'sa9',muscle:'Tríceps', name:'Press francés con mancuerna o patada de tríceps', tag:'NUEVO', sets:2,range:'10–12',rest:'1:30 min', restS:90, rir:'RIR 0–1'},
  ]},
  Domingo:{ label:'Pull B — Espalda · Trap. · Delt. Post. · Bíceps + Piernas 2ª freq. + Abdomen', exercises:[
    {id:'do11',muscle:'Trapecio inferior', name:'Y-raise en banco inclinado con mancuernas',  tag:'PRIORIDAD',sets:3,range:'12–15',rest:'1:30 min', restS:90,  rir:'RIR 1'},
    {id:'do6', muscle:'Trapecio medio / Romboides', name:'Encogimientos con mancuernas + squeeze arriba 1 seg', tag:'NUEVO', sets:3,range:'12–15',rest:'1:30 min', restS:90, rir:'RIR 1'},
    {id:'do1', muscle:'Espalda', name:'Dominadas asistidas (3 seg bajada)',   tag:'PRINCIPAL',sets:3,range:'6–10', rest:'2:30 min', restS:150, rir:'RIR 2 → 1'},
    {id:'do12',muscle:'Espalda / Dorsal bajo', name:'Remo con mancuerna a un brazo, torso inclinado', tag:'NUEVO', sets:3,range:'8–12', rest:'2 min', restS:120, rir:'RIR 1–2'},
    {id:'do3', muscle:'Dorsal bajo', name:'Jalón polea agarre cerrado supino',                 sets:2,range:'10–12',rest:'2 min',     restS:120, rir:'RIR 0–1'},
    {id:'do4', muscle:'Delt. Post. / Trapecio', name:'Face pulls en polea',                    sets:3,range:'15–20',rest:'1:30 min',  restS:90,  rir:'RIR 0–1'},
    {id:'do7', muscle:'Bíceps', name:'Curl predicador o spider curl',                          sets:3,range:'10–12',rest:'1:30 min',  restS:90,  rir:'RIR 0–1'},
    {id:'do8', muscle:'Bíceps / Braquial', name:'Curl martillo alternado',                     sets:2,range:'12–15',rest:'1:30 min',  restS:90,  rir:'RIR 0–1'},
    {id:'do9', muscle:'Cuádriceps (2ª freq)', name:'Hack squat o leg press (60–70% peso)',     sets:2,range:'12–15',rest:'2 min',     restS:120, rir:'RIR 1–2'},
    {id:'do10',muscle:'Isquios (2ª freq)', name:'Curl femoral sentado', tag:'PRIORIDAD',       sets:2,range:'12–15',rest:'1:30–2 min',restS:105, rir:'RIR 0–1'},
    {id:'do13',muscle:'Abdomen', name:'Crunch en polea alta o crunch con peso', tag:'NUEVO',    sets:2,range:'12–15',rest:'1 min',     restS:60,  rir:'RIR 0–1'},
  ]},
};

export const ALL_DAYS   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const TRAIN_DAYS = ['Martes','Miércoles','Jueves','Sábado','Domingo'];

// ─── Estado de sesión activa ──────────────────────────────────────────────────
let _session = {
  activeDay: '',
  exIndex:   0,
  entry:     {},       // { [exId]: [{w,r,u},...] }
  prevData:  {},       // datos guardados anteriores por día
  defaultUnit: 'kg',
};
let _autosaveTimer = null;

export async function initWorkout() {
  const savedUnit = await Storage.getSetting('defaultUnit','kg');
  _session.defaultUnit = savedUnit;

  // Cargar todas las sesiones anteriores
  const allWk = await Storage.getAllWorkouts();
  allWk.forEach(({ key, value }) => {
    if (value) _session.prevData[key] = value;
  });

  const todayIdx  = new Date().getDay() || 7;
  const todayName = ALL_DAYS[todayIdx - 1];
  setActiveDay(todayName);
}

export function setActiveDay(day) {
  _session.activeDay = day;
  _session.exIndex   = 0;
  _session.entry     = _buildEntry(day);
}

function _buildEntry(day) {
  const entry = {};
  const routine = ROUTINE[day];
  if (!routine) return entry;
  // Intentar restaurar datos en curso (si hay algo guardado temporalmente)
  const prev = _session.prevData[day];
  routine.exercises.forEach(ex => {
    entry[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
      const saved = prev?.entry?.[ex.id]?.[i];
      return saved ?? { w:'', r:'', u: _session.defaultUnit };
    });
  });
  return entry;
}

export function getSession()   { return _session; }
export function getActiveDay() { return _session.activeDay; }
export function getEntry()     { return _session.entry; }
export function getPrev(day)   { return _session.prevData[day] || null; }

export function updateSet(exId, idx, field, val) {
  if (!_session.entry[exId]) return;
  _session.entry[exId][idx][field] = val;
  _scheduleAutosave();
}

export function setDefaultUnit(unit) {
  _session.defaultUnit = unit;
  Storage.saveSetting('defaultUnit', unit);
}

// ─── Autosave con debounce (3 segundos) ──────────────────────────────────────
function _scheduleAutosave() {
  if (_autosaveTimer) clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(_flushSave, 3000);
}

async function _flushSave() {
  const day = _session.activeDay;
  if (!TRAIN_DAYS.includes(day)) return;
  await Storage.saveWorkout(day, { entry: _session.entry, savedAt: Date.now() });
}

// Guardar inmediatamente (cambio de pantalla, minimizar, cerrar)
export async function saveNow() {
  if (_autosaveTimer) { clearTimeout(_autosaveTimer); _autosaveTimer = null; }
  await _flushSave();
}

// ─── Guardar sesión completa como completada ──────────────────────────────────
export async function saveSession() {
  const day = _session.activeDay;
  if (!TRAIN_DAYS.includes(day)) return null;
  if (_autosaveTimer) { clearTimeout(_autosaveTimer); _autosaveTimer = null; }

  const today    = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
  const payload  = { entry: _session.entry, date: today, completed: true, savedAt: Date.now() };
  await Storage.saveWorkout(day, payload);
  _session.prevData[day] = payload;

  const stats = await recordWorkout();
  return stats;
}

// ─── Navegación de ejercicios ─────────────────────────────────────────────────
export function nextExercise() {
  const ex = ROUTINE[_session.activeDay]?.exercises;
  if (ex && _session.exIndex < ex.length - 1) { _session.exIndex++; return true; }
  return false;
}
export function prevExercise() {
  if (_session.exIndex > 0) { _session.exIndex--; return true; }
  return false;
}

// ─── Registro de visibilidad y beforeunload ───────────────────────────────────
export function registerSaveListeners() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
  });
  window.addEventListener('beforeunload', () => saveNow());
  window.addEventListener('pagehide',     () => saveNow());
}
