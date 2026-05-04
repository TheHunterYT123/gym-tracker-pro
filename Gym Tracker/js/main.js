/**
 * main.js — Versión consolidada sin ES Modules y usando solo localStorage
 */

// ============================================================================
// 1. STORAGE (LOCALSTORAGE ONLY)
// ============================================================================
const Storage = {
  saveWorkout: async (day, data) => { localStorage.setItem(`workouts:${day}`, JSON.stringify({ ...data, updatedAt: Date.now() })); return true; },
  getWorkout:  async (day) => { try { return JSON.parse(localStorage.getItem(`workouts:${day}`)); } catch { return null; } },
  getAllWorkouts: async () => {
    return Object.keys(localStorage)
      .filter(k => k.startsWith('workouts:'))
      .map(k => ({ key: k.split('workouts:')[1], value: JSON.parse(localStorage.getItem(k)) }));
  },
  saveSetting: async (key, val) => { localStorage.setItem(`settings:${key}`, JSON.stringify(val)); return true; },
  getSetting:  async (key, def=null) => { try { const v = JSON.parse(localStorage.getItem(`settings:${key}`)); return v !== null ? v : def; } catch { return def; } },
  getAllSettings: async () => {
    const all = Object.keys(localStorage)
      .filter(k => k.startsWith('settings:'))
      .map(k => [k.split('settings:')[1], JSON.parse(localStorage.getItem(k))]);
    return Object.fromEntries(all);
  },
  saveStats: async (data) => { localStorage.setItem(`stats:main`, JSON.stringify(data)); return true; },
  getStats:  async () => { try { return JSON.parse(localStorage.getItem(`stats:main`)); } catch { return null; } },
  saveDietLog: async (date, data) => { localStorage.setItem(`dietLog:${date}`, JSON.stringify(data)); return true; },
  getDietLog:  async (date) => { try { return JSON.parse(localStorage.getItem(`dietLog:${date}`)); } catch { return null; } },
  saveAchievements: async (data) => { localStorage.setItem(`achievements:main`, JSON.stringify(data)); return true; },
  getAchievements:  async () => { try { return JSON.parse(localStorage.getItem(`achievements:main`)); } catch { return null; } },
};
window.Storage = Storage;

// ============================================================================
// 2. STATS
// ============================================================================
const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

let _s = { streak:0, longestStreak:0, totalDays:0, lastWorkoutDate:null, workoutDates:[], startDate:null };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00')) / 86400000);
}

function trainDaysBetween(fromISO, toISO) {
  let count = 0;
  const from = new Date(fromISO+'T12:00:00');
  const to   = new Date(toISO+'T12:00:00');
  const cur  = new Date(from);
  cur.setDate(cur.getDate() + 1);
  while (cur < to) {
    if (['Martes','Miércoles','Jueves','Sábado','Domingo'].includes(DAY_NAMES[cur.getDay()])) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function recalcStreak() {
  if (!_s.lastWorkoutDate) { _s.streak = 0; return; }
  const today = todayISO();
  if (_s.lastWorkoutDate === today) return;
  const missed = trainDaysBetween(_s.lastWorkoutDate, today);
  if (missed > 1) _s.streak = 0;
}

async function loadStats() {
  const saved = await Storage.getStats();
  if (saved) _s = { ..._s, ...saved };
  recalcStreak();
  return { ..._s };
}

function getStats() { return { ..._s }; }

async function recordWorkout() {
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

async function setManualStats({ streak, totalDays, lastWorkoutDate }) {
  if (streak !== undefined) _s.streak = Math.max(0, +streak || 0);
  if (totalDays !== undefined) _s.totalDays = Math.max(0, +totalDays || 0);
  if (lastWorkoutDate !== undefined) _s.lastWorkoutDate = lastWorkoutDate;
  if (_s.streak > _s.longestStreak) _s.longestStreak = _s.streak;
  await Storage.saveStats(_s);
  return { ..._s };
}

function getWeekStats() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const thisWeek = (_s.workoutDates||[]).filter(d => new Date(d+'T12:00:00') >= weekStart);
  return { workoutsThisWeek: thisWeek.length, streak: _s.streak, longestStreak: _s.longestStreak, totalDays: _s.totalDays };
}

// ============================================================================
// 3. DIET
// ============================================================================
const MEAL_SCHEDULE = [
  { id: 'desayuno',    label: 'Desayuno',    icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>', hour: 6,  minute: 0  },
  { id: 'mediaMañana', label: 'Media Mañana', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/></svg>', hour: 10, minute: 0  },
  { id: 'comida',      label: 'Comida',      icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 2 2 16l6 6 14-14-6-6ZM16 2l6 6"/></svg>', hour: 13, minute: 0 },
  { id: 'merienda',    label: 'Merienda',    icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2h8M10 2v4M14 2v4M6 8h12l-1 14H7L6 8Z"/></svg>', hour: 16, minute: 30  },
  { id: 'cena',        label: 'Cena',        icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>', hour: 20, minute: 0  },
];

const DEFAULT_DIET_DATA = {
  "detox": {
    "todos": {
      "desayuno": ["5 huevos revueltos (con jitomate, cebolla y sal — sin aceite en exceso)", "1/2 aguacate (75g)", "1 taza de café negro sin azúcar", "⚡ ~490 kcal | 31g proteína"],
      "mediaMañana": ["50g almendras naturales sin sal", "⚡ ~294 kcal | 11g proteína"],
      "comida": ["200g pechuga de pollo a la plancha (limón, ajo en polvo, sal)", "Ensalada: lechuga + jitomate + pepino + limón + sal", "1/2 aguacate (75g)", "1 taza de caldo de verduras", "⚡ ~550 kcal | 64g proteína"],
      "merienda": ["200g yogurt griego natural SIN azúcar", "25g nueces", "⚡ ~267 kcal | 19g proteína"],
      "cena": ["250g pechuga de pollo O carne molida a la plancha", "150g verduras salteadas (brócoli + calabaza + zanahoria)", "5g creatina", "1 pastilla de magnesio", "SIN arroz, SIN tortilla, SIN pan, SIN pasta", "⚡ ~500 kcal | 80g proteína"],
      "nota": "Días 1-2: cansancio y posible dolor de cabeza leve. ¡Normal! Bebe 5L de agua."
    }
  },
  "minicut": {
    "lunes": {
      "desayuno": ["250g yogurt griego natural", "40g avena remojada desde la noche anterior en el yogurt", "100g plátano en rodajas", "25g nueces picadas", "Café negro sin azúcar", "⚡ ~590 kcal | 42g proteína"],
      "mediaMañana": ["1 manzana mediana", "40g almendras naturales", "⚡ ~300 kcal | 9g proteína"],
      "comida": ["180g pechuga de pollo a la plancha", "120g arroz blanco cocido (1/2 plato)", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~580 kcal | 52g proteína"],
      "merienda": ["1 plátano mediano", "⚡ ~100 kcal | 1g proteína"],
      "cena": ["200g pechuga de pollo a la plancha", "100g arroz blanco cocido", "100g brócoli salteado con aceite de oliva y ajo", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~720 kcal | 91g proteína"],
      "nota": "Cardio: 20 min caminata inclinada (10-12%) post-entreno."
    },
    "martes": {
      "desayuno": ["4 huevos revueltos con jitomate, cebolla y chile", "2 rebanadas de pan integral tostado", "Café negro sin azúcar", "⚡ ~480 kcal | 28g proteína"],
      "mediaMañana": ["1 pera mediana", "40g nueces y almendras mixtas", "⚡ ~280 kcal | 8g proteína"],
      "comida": ["2 tacos de picadillo: 120g carne molida + 2 tortillas de maíz", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~540 kcal | 35g proteína"],
      "merienda": ["250g yogurt griego natural", "⚡ ~175 kcal | 17g proteína"],
      "cena": ["200g atún en agua (bien escurrido)", "100g arroz blanco cocido", "Ensalada: lechuga + jitomate + pepino + limón", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~880 kcal | 100g proteína"]
    },
    "miércoles": {
      "desayuno": ["Batido (licuadora): 60g avena + 150g plátano + 2 cdas crema de cacahuate + 300ml leche deslactosada", "⚡ ~650 kcal | 22g proteína"],
      "mediaMañana": ["1 manzana mediana", "40g almendras", "⚡ ~280 kcal | 8g proteína"],
      "comida": ["180g pechuga de pollo a la plancha", "150g lentejas cocidas (con ajo, sal y laurel)", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~600 kcal | 58g proteína"],
      "merienda": ["1 plátano mediano", "⚡ ~100 kcal | 1g proteína"],
      "cena": ["1 burrito: 150g pollo desmenuzado + 1 tortilla de harina + 1/2 aguacate", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~840 kcal | 86g proteína"]
    },
    "jueves": {
      "desayuno": ["250g yogurt griego natural", "40g avena remojada desde la noche", "100g mango en cubos", "25g almendras", "Café negro sin azúcar", "⚡ ~580 kcal | 40g proteína"],
      "mediaMañana": ["1 pera mediana", "40g nueces", "⚡ ~290 kcal | 6g proteína"],
      "comida": ["3 tacos de pollo: 150g pollo desmenuzado + 3 tortillas de maíz", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~560 kcal | 44g proteína"],
      "merienda": ["1 manzana mediana", "150g yogurt griego natural", "⚡ ~200 kcal | 12g proteína"],
      "cena": ["200g carne molida a la plancha (ajo, sal, pimienta)", "100g arroz blanco cocido", "100g verduras salteadas (calabaza + zanahoria)", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~750 kcal | 90g proteína"]
    },
    "viernes": {
      "desayuno": ["Omelette: 4 huevos + 50g queso panela rallado", "2 rebanadas de pan integral", "Café negro sin azúcar", "⚡ ~510 kcal | 37g proteína"],
      "mediaMañana": ["1 manzana mediana", "40g almendras", "⚡ ~280 kcal | 8g proteína"],
      "comida": ["180g pechuga de pollo a la plancha", "120g arroz blanco cocido (1/2 plato)", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~580 kcal | 52g proteína"],
      "merienda": ["250g yogurt griego + 1 plátano mediano", "⚡ ~260 kcal | 18g proteína"],
      "cena": ["200g atún en agua escurrido", "100g arroz cocido", "Ensalada: jitomate + pepino + lechuga + limón", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~725 kcal | 85g proteína"]
    },
    "sábado": {
      "desayuno": ["Batido (licuadora): 60g avena + 150g plátano + 1 cda crema de cacahuate + 300ml leche", "2 huevos duros", "⚡ ~720 kcal | 36g proteína"],
      "mediaMañana": ["1 pera mediana", "40g almendras", "⚡ ~275 kcal | 8g proteína"],
      "comida": ["2 tacos vampiro: 100g pollo + 30g queso Oaxaca + 2 tortillas de maíz", "1 taza caldo de verduras", "⚡ ~460 kcal | 38g proteína"],
      "merienda": ["200g yogurt griego + 1 plátano mediano", "⚡ ~240 kcal | 15g proteína"],
      "cena": ["200g carne molida a la plancha", "100g arroz cocido", "100g verduras salteadas (brócoli + calabaza)", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~655 kcal | 70g proteína"]
    },
    "domingo": {
      "desayuno": ["250g yogurt griego natural", "40g avena remojada desde la noche", "100g plátano", "25g nueces", "Café negro sin azúcar", "⚡ ~580 kcal | 40g proteína"],
      "mediaMañana": ["1 manzana mediana", "40g almendras", "⚡ ~280 kcal | 8g proteína"],
      "comida": ["200g pollo a la plancha", "150g arroz blanco cocido (3/4 plato)", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~640 kcal | 58g proteína"],
      "merienda": ["200g yogurt griego natural", "⚡ ~140 kcal | 14g proteína"],
      "cena": ["1 burrito: 150g pollo desmenuzado + 1 tortilla de harina + 1/2 aguacate", "Batido: 1 scoop proteína whey + 300ml leche deslactosada", "5g creatina + 1 pastilla magnesio", "⚡ ~710 kcal | 75g proteína"]
    }
  },
  "volumen": {
    "lunes": {
      "desayuno": ["4 huevos revueltos con jitomate, cebolla y sal", "60g avena cocida con agua o leche", "150g plátano", "25g nueces", "Café negro sin azúcar", "⚡ ~820 kcal | 52g proteína"],
      "mediaMañana": ["1 manzana mediana", "50g nueces y almendras mixtas", "⚡ ~350 kcal | 10g proteína"],
      "comida": ["200g pechuga de pollo a la plancha", "150g arroz blanco cocido (3/4 plato)", "3 tortillas de maíz", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~760 kcal | 60g proteína"],
      "merienda": ["250g yogurt griego natural", "1 plátano mediano", "⚡ ~280 kcal | 18g proteína"],
      "cena": ["300g espagueti con 150g pollo desmenuzado (salsa de jitomate natural)", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~940 kcal | 65g proteína"],
      "nota": "NO hay cardio. Enfoque total en progresión de carga."
    },
    "martes": {
      "desayuno": ["250g yogurt griego natural", "60g avena remojada desde la noche en el yogurt", "150g mango en cubos", "25g almendras", "Café negro sin azúcar", "⚡ ~750 kcal | 46g proteína"],
      "mediaMañana": ["1 pera mediana", "50g nueces", "⚡ ~360 kcal | 8g proteína"],
      "comida": ["2 burritos de pollo: 180g pollo desmenuzado + 2 tortillas de harina", "1 burrito de frijoles: 100g frijoles negros + 30g queso + 1 tortilla de harina", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~880 kcal | 62g proteína"],
      "merienda": ["1 plátano mediano", "50g almendras", "⚡ ~380 kcal | 12g proteína"],
      "cena": ["300g espagueti con 150g carne molida guisada (salsa de jitomate)", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~830 kcal | 60g proteína"]
    },
    "miércoles": {
      "desayuno": ["Batido grande (licuadora): 60g avena + 2 cdas crema cacahuate + 150g plátano + 300ml leche", "4 huevos revueltos con chile y sal (aparte)", "⚡ ~980 kcal | 60g proteína"],
      "mediaMañana": ["1 manzana mediana", "50g almendras", "⚡ ~330 kcal | 10g proteína"],
      "comida": ["200g pollo a la plancha", "150g lentejas cocidas (ajo, sal, laurel)", "150g arroz blanco cocido (3/4 plato)", "1/2 aguacate", "1 taza caldo", "⚡ ~840 kcal | 72g proteína"],
      "merienda": ["250g yogurt griego natural", "1 plátano mediano", "⚡ ~280 kcal | 18g proteína"],
      "cena": ["300g espagueti con 150g pollo", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~820 kcal | 65g proteína"]
    },
    "jueves": {
      "desayuno": ["Omelette: 4 huevos + 50g queso panela", "60g avena cocida con 150g mango", "25g nueces", "Café negro sin azúcar", "⚡ ~840 kcal | 55g proteína"],
      "mediaMañana": ["1 manzana mediana", "50g nueces y almendras mixtas", "⚡ ~360 kcal | 10g proteína"],
      "comida": ["4 tacos de picadillo: 180g carne molida + 4 tortillas de maíz", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~720 kcal | 48g proteína"],
      "merienda": ["250g yogurt griego natural", "1 manzana mediana", "⚡ ~240 kcal | 18g proteína"],
      "cena": ["2 burritos: 180g pollo desmenuzado + 2 tortillas de harina + 1/2 aguacate", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~940 kcal | 80g proteína"]
    },
    "viernes": {
      "desayuno": ["250g yogurt griego natural", "60g avena remojada desde la noche", "150g plátano", "25g nueces", "Café negro sin azúcar", "⚡ ~740 kcal | 44g proteína"],
      "mediaMañana": ["1 pera mediana", "50g almendras", "⚡ ~330 kcal | 10g proteína"],
      "comida": ["200g pechuga de pollo a la plancha", "150g arroz blanco cocido (3/4 plato)", "3 tortillas de maíz", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~760 kcal | 60g proteína"],
      "merienda": ["250g yogurt griego natural", "1 plátano mediano", "⚡ ~280 kcal | 18g proteína"],
      "cena": ["300g espagueti con 150g pollo desmenuzado", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~840 kcal | 65g proteína"]
    },
    "sábado": {
      "desayuno": ["Batido (licuadora): 60g avena + 2 cdas crema cacahuate + 150g plátano + 300ml leche", "3 huevos duros", "⚡ ~940 kcal | 52g proteína"],
      "mediaMañana": ["1 manzana mediana", "50g nueces", "⚡ ~350 kcal | 8g proteína"],
      "comida": ["4 tacos de pollo: 200g pollo desmenuzado + 4 tortillas de maíz", "1/2 aguacate", "150g arroz blanco cocido", "1 taza caldo de verduras", "⚡ ~860 kcal | 64g proteína"],
      "merienda": ["250g yogurt griego natural", "1 plátano mediano", "⚡ ~280 kcal | 18g proteína"],
      "cena": ["2 burritos: 150g carne molida + 2 tortillas de harina + 1/2 aguacate", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~870 kcal | 66g proteína"]
    },
    "domingo": {
      "desayuno": ["4 huevos a la mexicana: jitomate + cebolla + chile serrano + sal", "2 rebanadas de pan integral tostado", "150g plátano", "Café negro sin azúcar", "⚡ ~650 kcal | 38g proteína"],
      "mediaMañana": ["1 pera mediana", "50g almendras y nueces mixtas", "⚡ ~350 kcal | 10g proteína"],
      "comida": ["200g carne molida guisada con ajo y especias", "150g arroz blanco cocido", "3 tortillas de maíz", "1/2 aguacate", "1 taza caldo de verduras", "⚡ ~760 kcal | 52g proteína"],
      "merienda": ["250g yogurt griego natural", "25g nueces", "⚡ ~270 kcal | 18g proteína"],
      "cena": ["300g espagueti con 150g pollo desmenuzado", "Batido: 1 scoop whey + 2 cdas avena + 1 plátano + 300ml leche", "5g creatina + 1 pastilla magnesio", "⚡ ~820 kcal | 65g proteína"]
    }
  }
};

let _dietData = null;
let _currentPhase = 'detox';
let _unlockedPhases = ['detox'];
let _completedDays = { detox: [], minicut: [], volumen: [] };

async function loadDiet() {
  try {
    _unlockedPhases = await Storage.getSetting('unlockedPhases', ['detox']);
    _currentPhase = await Storage.getSetting('dietPhase', 'detox');
    const savedCD = await Storage.getSetting('completedDays', null);
    if (savedCD) _completedDays = savedCD;

    const custom = await Storage.getSetting('customDietData', null);
    if (custom) { _dietData = custom; return _dietData; }
    _dietData = DEFAULT_DIET_DATA;
    return _dietData;
  } catch (e) {
    _dietData = DEFAULT_DIET_DATA;
    return _dietData;
  }
}

function getCurrentPhase() { return _currentPhase; }

async function setPhase(phase) {
  _currentPhase = phase;
  await Storage.saveSetting('dietPhase', phase);
}

function getTodayPlan() {
  if (!_dietData) return null;
  const dayName  = DAY_NAMES[new Date().getDay()].toLowerCase();
  const phase    = _dietData[_currentPhase];
  if (!phase) return null;
  return phase[dayName] || phase['todos'] || null;
}

function getCurrentMeal() {
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();

  let active = null;
  let nextMeal = null;

  for (let i = 0; i < MEAL_SCHEDULE.length; i++) {
    const m    = MEAL_SCHEDULE[i];
    const mMin = m.hour * 60 + m.minute;
    const next = MEAL_SCHEDULE[i + 1];
    const nMin = next ? next.hour * 60 + next.minute : 24 * 60;

    if (totalMins >= mMin && totalMins < nMin) {
      active   = m;
      nextMeal = next || null;
      break;
    }
  }

  if (!active) {
    active   = MEAL_SCHEDULE[0];
    nextMeal = MEAL_SCHEDULE[1];
  }

  const plan = getTodayPlan();
  const mealData = plan?.[active.id] || null;

  return {
    current:  { ...active,   items: mealData },
    next:     nextMeal ? { ...nextMeal, items: plan?.[nextMeal.id] || null } : null,
    allMeals: MEAL_SCHEDULE.map(m => ({ ...m, items: plan?.[m.id] || null })),
    phase:    _currentPhase,
  };
}

function needsOatmealSoak() {
  if (!_dietData) return false;
  const tomorrow   = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowName = DAY_NAMES[tomorrow.getDay()].toLowerCase();
  const phase      = _dietData[_currentPhase];
  if (!phase) return false;
  const plan       = phase[tomorrowName] || phase['todos'] || null;
  const breakfast  = plan?.desayuno;
  if (!breakfast) return false;
  return breakfast.some(item => typeof item === 'string' && item.toLowerCase().includes('avena'));
}

function generateShoppingList() {
  if (!_dietData) return [];
  const phase     = _dietData[_currentPhase];
  if (!phase) return [];
  const frequency = {};

  ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].forEach(day => {
    const plan = phase[day] || phase['todos'] || {};
    Object.values(plan).forEach(items => {
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        if (typeof item !== 'string') return;
        const clean = item.replace(/^\d+g?\s*/,'').replace(/\s*\(.*?\)/g,'').trim().toLowerCase();
        frequency[clean] = (frequency[clean] || 0) + 1;
      });
    });
  });

  const CATS = {
    '🥩 Proteínas':   ['pollo','atún','carne','huevo','whey','proteína'],
    '🥛 Lácteos':     ['yogurt','leche','queso'],
    '🍚 Carbohidratos':['arroz','avena','pan','tortilla','pasta','espagueti','frijol','lenteja'],
    '🥑 Grasas':      ['aguacate','nueces','almendras','cacahuate','aceite'],
    '🍌 Frutas':      ['plátano','manzana','pera','mango','fruta'],
    '🥦 Verduras':    ['brócoli','calabaza','zanahoria','lechuga','jitomate','pepino','cebolla','chile','espinaca'],
    '💊 Suplementos': ['creatina','magnesio','caldo'],
    '🛒 Otros':       [],
  };

  const result = {};
  Object.entries(frequency).forEach(([item, times]) => {
    let assigned = false;
    for (const [cat, keywords] of Object.entries(CATS)) {
      if (keywords.some(k => item.includes(k))) {
        if (!result[cat]) result[cat] = [];
        result[cat].push({ item, times });
        assigned = true; break;
      }
    }
    if (!assigned) {
      if (!result['🛒 Otros']) result['🛒 Otros'] = [];
      result['🛒 Otros'].push({ item, times });
    }
  });

  return Object.entries(result).filter(([,items]) => items.length > 0);
}

// ============================================================================
// 4. WORKOUT
// ============================================================================
const MUSCLE_COLORS = {
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

const ROUTINE = {
  Martes:{ label:'Push A — Pecho · Hombros · Tríceps', exercises:[
    {id:'ma1',muscle:'Pecho',      name:'Press inclinado con mancuernas (30–45°)',   tag:'PRINCIPAL',sets:4,range:'8–12', rest:'2:30–3 min',restS:165},
    {id:'ma2',muscle:'Pecho',      name:'Press de banca plano con barra',                          sets:3,range:'6–10', rest:'2:30 min',  restS:150},
    {id:'ma3',muscle:'Pecho',      name:'Fly en polea (cable crossover)',                           sets:3,range:'12–15',rest:'1:30–2 min',restS:105},
    {id:'ma4',muscle:'Hombros',    name:'Press militar con mancuernas sentado',      tag:'NUEVO',  sets:3,range:'10–12',rest:'2 min',     restS:120},
    {id:'ma5',muscle:'Hombros',    name:'Elevaciones laterales en polea — dropset',               sets:4,range:'15–20',rest:'1:30 min',  restS:90},
    {id:'ma6',muscle:'Tríceps',    name:'Extensión overhead en polea (cuerda)',      tag:'NUEVO',  sets:3,range:'10–15',rest:'1:30–2 min',restS:105},
    {id:'ma7',muscle:'Tríceps',    name:'Pushdown en polea (cuerda o barra)',                      sets:3,range:'12–15',rest:'1:30 min',  restS:90},
  ]},
  Miércoles:{ label:'Pull A — Espalda · Trap. Inf. · Delt. Post. · Bíceps', exercises:[
    {id:'mi1',muscle:'Espalda',           name:'Remo con barra inclinado (overhand)',         tag:'PRINCIPAL',sets:4,range:'8–12', rest:'2:30 min',  restS:150},
    {id:'mi2',muscle:'Espalda',           name:'Remo en polea baja (barra estrecha)',                         sets:3,range:'10–12',rest:'2 min',     restS:120},
    {id:'mi3',muscle:'Espalda',           name:'Dominadas agarre prono',                                      sets:4,range:'6–10', rest:'2:30 min',  restS:150},
    {id:'mi4',muscle:'Trapecio inferior', name:'Cable Y-raise en polea baja',                 tag:'NUEVO',   sets:3,range:'12–15',rest:'1:30 min',  restS:90},
    {id:'mi5',muscle:'Trapecio inferior', name:'Retracción + depresión escapular en remo en T',              sets:3,range:'12–15',rest:'1:30 min',  restS:90},
    {id:'mi6',muscle:'Delt. Posterior',   name:'Face pulls en polea',                         tag:'NUEVO',   sets:3,range:'15–20',rest:'1:30 min',  restS:90},
    {id:'mi7',muscle:'Delt. Posterior',   name:'Reverse fly con mancuernas (bent-over)',      tag:'NUEVO',   sets:3,range:'15–20',rest:'1:30 min',  restS:90},
    {id:'mi8',muscle:'Bíceps',            name:'Curl con barra Z (EZ)',                                       sets:3,range:'8–12', rest:'1:30–2 min',restS:105},
    {id:'mi9',muscle:'Bíceps',            name:'Curl inclinado con mancuernas (stretch)',                     sets:3,range:'10–12',rest:'1:30 min',  restS:90},
    {id:'mi10',muscle:'Bíceps',           name:'Curl martillo con mancuerna',                                 sets:2,range:'12–15',rest:'1:30 min',  restS:90},
    {id:'mi11',muscle:'Antebrazos',       name:'Curl muñeca + invertido (opcional)',                          sets:2,range:'15',   rest:'1 min',     restS:60},
  ]},
  Jueves:{ label:'Piernas — Cuáds · Isquios · Glúteos · Pantorrillas', exercises:[
    {id:'ju1',muscle:'Cuádriceps',    name:'Sentadilla con barra o Hack squat',     tag:'PRINCIPAL',sets:4,range:'8–12', rest:'2:30–3 min',restS:165},
    {id:'ju2',muscle:'Cuádriceps',    name:'Prensa 45° (leg press)',                               sets:3,range:'10–15',rest:'2–2:30 min', restS:135},
    {id:'ju3',muscle:'Cuádriceps',    name:'Extensiones de pierna',                               sets:3,range:'12–15',rest:'1:30 min',   restS:90},
    {id:'ju4',muscle:'Isquios / Glúteos',name:'Romanian Deadlift (RDL)',            tag:'NUEVO',  sets:4,range:'10–12',rest:'2–2:30 min', restS:135},
    {id:'ju5',muscle:'Isquios',       name:'Curl femoral sentado',                               sets:3,range:'10–12',rest:'1:30–2 min', restS:105},
    {id:'ju6',muscle:'Aductor',       name:'Aductor interno en máquina',                         sets:3,range:'12–15',rest:'1:30 min',   restS:90},
    {id:'ju7',muscle:'Pantorrillas',  name:'Pantorrilla de pie (calf raise)',                    sets:4,range:'12–20',rest:'1:30 min',   restS:90},
  ]},
  Sábado:{ label:'Push B — Pecho · Hombros · Tríceps', exercises:[
    {id:'sa1',muscle:'Pecho',      name:'Press de banca plano con barra',           tag:'PRINCIPAL',sets:4,range:'6–10', rest:'2:30–3 min',restS:165},
    {id:'sa2',muscle:'Pecho',      name:'Press inclinado con mancuernas',                          sets:3,range:'10–12',rest:'2 min',     restS:120},
    {id:'sa3',muscle:'Pecho',      name:'Pec deck o fly con mancuernas',                           sets:3,range:'12–15',rest:'1:30 min',  restS:90},
    {id:'sa4',muscle:'Pecho',      name:'Fondos en paralelas (dips)',               tag:'NUEVO',   sets:3,range:'8–12', rest:'2 min',     restS:120},
    {id:'sa5',muscle:'Hombros',    name:'Press con mancuernas o máquina',                          sets:3,range:'10–12',rest:'2 min',     restS:120},
    {id:'sa6',muscle:'Hombros',    name:'Elevaciones laterales en polea — dropset',               sets:4,range:'15–20',rest:'1:30 min',  restS:90},
    {id:'sa7',muscle:'Tríceps',    name:'Extensión overhead en polea (cuerda)',                    sets:3,range:'10–15',rest:'1:30–2 min',restS:105},
    {id:'sa8',muscle:'Tríceps',    name:'Press agarre cerrado con barra Z',                        sets:3,range:'10–13',rest:'2 min',     restS:120},
  ]},
  Domingo:{ label:'Pull B — Espalda · Trap. · Delt. Post. · Bíceps + Piernas', exercises:[
    {id:'do1',muscle:'Espalda',           name:'Dominadas asistidas (3 seg bajada)', tag:'PRINCIPAL',sets:4,range:'6–10', rest:'2:30 min',restS:150},
    {id:'do2',muscle:'Espalda',           name:'Remo en T (agarre supino / underhand)',             sets:3,range:'8–12', rest:'2 min',   restS:120},
    {id:'do3',muscle:'Espalda',           name:'Jalón polea agarre cerrado supino',                 sets:3,range:'10–12',rest:'2 min',   restS:120},
    {id:'do4',muscle:'Delt. Post. + Trap.',name:'Face pulls en polea',                             sets:3,range:'15–20',rest:'1:30 min',restS:90},
    {id:'do5',muscle:'Delt. Post. + Trap.',name:'Cable Y-raise en polea baja',                    sets:3,range:'12–15',rest:'1:30 min',restS:90},
    {id:'do6',muscle:'Trapecio',          name:'Encogimientos con mancuernas (shrugs)',tag:'NUEVO', sets:3,range:'12–15',rest:'1:30 min',restS:90},
    {id:'do7',muscle:'Bíceps',            name:'Curl predicador o spider curl',                    sets:3,range:'10–12',rest:'1:30 min',restS:90},
    {id:'do8',muscle:'Bíceps',            name:'Curl martillo alternado',                          sets:3,range:'12–15',rest:'1:30 min',restS:90},
    {id:'do9',muscle:'Piernas (2a freq)', name:'Hack squat o leg press (60–70% peso)',             sets:3,range:'12–15',rest:'2 min',   restS:120},
    {id:'do10',muscle:'Piernas (2a freq)',name:'Curl femoral sentado',                             sets:3,range:'12–15',rest:'1:30 min',restS:90},
  ]},
};

const ALL_DAYS   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const TRAIN_DAYS = ['Martes','Miércoles','Jueves','Sábado','Domingo'];

const ICONS = {
  fire: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  dumbbell: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6.5 6.5 11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7"/></svg>',
  meat: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 2 2 16l6 6 14-14-6-6ZM16 2l6 6"/></svg>',
  sleep: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>',
  trophy: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-1 1.05V22M14 14.66V17c0 .55.47.98 1 1.05V22M12 14.66V22"/><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/></svg>',
  plate: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  info: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  check: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  star: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  target: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  zap: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  tree: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-6M12 8v8M8 10h8M6 14h12M12 2l4 4-2 2 4 4-10 0 4-4-2-2 4-4Z"/></svg>',
  gem: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 18 3 22 9 12 22 2 9 6 3"/></svg>',
  refresh: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
  cart: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
};

let _session = {
  activeDay: '',
  exIndex:   0,
  entry:     {},
  prevData:  {},
  defaultUnit: 'kg',
};
let _autosaveTimer = null;

async function initWorkout() {
  const savedUnit = await Storage.getSetting('defaultUnit','kg');
  _session.defaultUnit = savedUnit;

  const allWk = await Storage.getAllWorkouts();
  allWk.forEach(({ key, value }) => {
    if (value) _session.prevData[key] = value;
  });

  const todayIdx  = new Date().getDay() || 7;
  const todayName = ALL_DAYS[todayIdx - 1];
  setActiveDay(todayName);
}

function setActiveDay(day) {
  _session.activeDay = day;
  _session.exIndex   = 0;
  _session.entry     = _buildEntry(day);
}

function _buildEntry(day) {
  const entry = {};
  const routine = ROUTINE[day];
  if (!routine) return entry;
  const prev = _session.prevData[day];
  routine.exercises.forEach(ex => {
    entry[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
      const saved = prev?.entry?.[ex.id]?.[i];
      return saved ?? { w:'', r:'', u: _session.defaultUnit };
    });
  });
  return entry;
}

function getSession()   { return _session; }
function getActiveDay() { return _session.activeDay; }
function getEntry()     { return _session.entry; }
function getPrev(day)   { return _session.prevData[day] || null; }

function updateSet(exId, idx, field, val) {
  if (!_session.entry[exId]) return;
  _session.entry[exId][idx][field] = val;
  _scheduleAutosave();
}

function setDefaultUnit(unit) {
  _session.defaultUnit = unit;
  Storage.saveSetting('defaultUnit', unit);
}

function _scheduleAutosave() {
  if (_autosaveTimer) clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(_flushSave, 3000);
}

async function _flushSave() {
  const day = _session.activeDay;
  if (!TRAIN_DAYS.includes(day)) return;
  await Storage.saveWorkout(day, { entry: _session.entry, savedAt: Date.now() });
}

async function saveNow() {
  if (_autosaveTimer) { clearTimeout(_autosaveTimer); _autosaveTimer = null; }
  await _flushSave();
}

async function saveSession() {
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

function nextExercise() {
  const ex = ROUTINE[_session.activeDay]?.exercises;
  if (ex && _session.exIndex < ex.length - 1) { _session.exIndex++; return true; }
  return false;
}
function prevExercise() {
  if (_session.exIndex > 0) { _session.exIndex--; return true; }
  return false;
}

function registerSaveListeners() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
  });
  window.addEventListener('beforeunload', () => saveNow());
  window.addEventListener('pagehide',     () => saveNow());
}


// ============================================================================
// 5. ACHIEVEMENTS
// ============================================================================
const ACHIEVEMENT_LIST = [
  { id:'first_workout',  icon: ICONS.target, title:'Primer Paso',       desc:'Completaste tu primer entrenamiento.',   check: s => s.totalDays >= 1 },
  { id:'streak_3',       icon: ICONS.fire, title:'En Llamas',         desc:'3 días de racha consecutivos.',          check: s => s.streak >= 3 },
  { id:'streak_7',       icon: ICONS.zap, title:'Semana Completa',    desc:'7 días de racha.',                      check: s => s.streak >= 7 },
  { id:'streak_14',      icon: ICONS.dumbbell, title:'Quincenal',          desc:'14 días de racha.',                     check: s => s.streak >= 14 },
  { id:'streak_30',      icon: ICONS.trophy, title:'Un Mes de Hierro',   desc:'30 días de racha consecutivos.',        check: s => s.streak >= 30 },
  { id:'total_10',       icon: ICONS.check, title:'Semilla',            desc:'10 sesiones de entrenamiento totales.', check: s => s.totalDays >= 10 },
  { id:'total_50',       icon: ICONS.tree, title:'Árbol Fuerte',       desc:'50 sesiones de entrenamiento.',         check: s => s.totalDays >= 50 },
  { id:'total_100',      icon: ICONS.gem, title:'Centurión',          desc:'100 sesiones de entrenamiento.',        check: s => s.totalDays >= 100 },
  { id:'comeback',       icon: ICONS.refresh, title:'De Vuelta',          desc:'Volviste después de un descanso.',      check: (s, prev) => prev && prev.streak === 0 && s.streak === 1 },
];

const TIPS = [
  'El músculo crece mientras descansas, no mientras entrenas.',
  'La consistencia supera a la intensidad. Todos los días un poco.',
  'Hidratación: 4L en días de entreno. Tu rendimiento depende de ello.',
  'El sueño es el suplemento más barato y efectivo que existe.',
  'Proteína en cada comida. Tu cuerpo la usa constantemente.',
  'Progresión de carga: si puedes hacer más reps, sube el peso.',
  'La avena remojada se digiere mejor. Prepárala la noche anterior.',
  '20 min de caminata inclinada en MiniCut quema más que 20 min corriendo.',
  'Si llevas 3 semanas sin progresar, algo falla: sueño, comida o técnica.',
  'Los días de descanso son parte del plan. No son días perdidos.',
];

let _achievements = {};

async function loadAchievements() {
  const saved = await Storage.getAchievements();
  _achievements = saved || {};
  return _achievements;
}

async function checkAchievements(stats, prevStats) {
  let newOnes = [];
  for (const ach of ACHIEVEMENT_LIST) {
    if (_achievements[ach.id]) continue;
    if (ach.check(stats, prevStats)) {
      _achievements[ach.id] = { unlockedAt: new Date().toISOString() };
      newOnes.push(ach);
    }
  }
  if (newOnes.length) await Storage.saveAchievements(_achievements);
  return newOnes;
}

function getUnlocked() {
  return ACHIEVEMENT_LIST.map(a => ({
    ...a,
    unlocked: !!_achievements[a.id],
    unlockedAt: _achievements[a.id]?.unlockedAt || null,
  }));
}

function getDailyTip() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  return TIPS[dayOfYear % TIPS.length];
}

// ============================================================================
// 6. NOTIFICATIONS
// ============================================================================
let _permission = 'default';
const INTERVALS = [];

async function requestPermission() {
  if (!('Notification' in window)) return false;
  _permission = await Notification.requestPermission();
  return _permission === 'granted';
}

function hasPermission() { return _permission === 'granted'; }

function notify(title, body, icon = './icons/icon-192.png', tag = '') {
  if (_permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, tag, badge: './icons/icon-72.png', vibrate: [200,100,200] });
  } catch {}
}

function vibrate(pattern = [200,100,200]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function scheduleAt(hour, minute, callback) {
  const now  = new Date();
  const then = new Date();
  then.setHours(hour, minute, 0, 0);
  if (then <= now) then.setDate(then.getDate() + 1);
  const delay = then - now;
  const id = setTimeout(() => {
    callback();
    const daily = setInterval(callback, 24 * 60 * 60 * 1000);
    INTERVALS.push(daily);
  }, delay);
  INTERVALS.push(id);
}

function startReminders() {
  if (_permission !== 'granted') return;

  for (let h = 6; h <= 22; h += 2) {
    scheduleAt(h, 0, () => {
      notify('💧 Hidratación', 'Recuerda tomar agua. ¡Mínimo 500ml ahora!', undefined, 'agua');
      vibrate([100]);
    });
  }

  MEAL_SCHEDULE.forEach(m => {
    scheduleAt(m.hour, m.minute, () => {
      notify(`${m.icon} Hora de ${m.label}`, '¡Es momento de comer!', undefined, 'comida');
      vibrate([200, 100, 200]);
    });
  });

  scheduleAt(21, 30, () => {
    if (needsOatmealSoak()) {
      notify('🥣 Preparación', 'Recuerda remojar la avena en el yogurt para mañana.', undefined, 'avena');
      vibrate([300, 100, 300]);
    }
  });

  scheduleAt(20, 20, () => {
    notify('😴 Hora de dormir', 'Para dormir 9h y levantarte a las 5:40am, debes dormir ya.', undefined, 'sueno');
    vibrate([400, 200, 400]);
  });

  const TRAIN_WEEKDAYS = [2, 3, 4, 6, 0];
  scheduleAt(17, 0, () => {
    const dayJS = new Date().getDay();
    if (TRAIN_WEEKDAYS.includes(dayJS)) {
      notify('🏋️ ¡A entrenar!', '¡Hoy toca gym! No rompas tu racha.', undefined, 'entreno');
      vibrate([200, 100, 200, 100, 200]);
    }
  });
}

function clearReminders() {
  INTERVALS.forEach(id => { clearTimeout(id); clearInterval(id); });
  INTERVALS.length = 0;
}

function testNotification() {
  notify('🏋️ Gym Tracker Pro', '¡Las notificaciones funcionan correctamente!');
  vibrate([100, 50, 100]);
}

// ============================================================================
// 7. APP ORCHESTRATOR
// ============================================================================
let timerInterval = null, timerSecs = 0, timerMax = 0, timerActive = false;

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type === 'err' ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

const PAGES = ['dashboard', 'workout', 'diet', 'config'];
let _currentPage = 'dashboard';

function navigate(page) {
  if (_currentPage !== page) saveNow();
  _currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (page === 'dashboard')  renderDashboard();
  if (page === 'workout')    renderWorkout();
  if (page === 'diet')       renderDiet();
  if (page === 'config')     renderConfig();
}

function renderDashboard() {
  const stats   = getStats();
  const wStats  = getWeekStats();
  const todayJS = new Date().getDay();
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][todayJS];
  const isTrain = TRAIN_DAYS.includes(dayName);
  const tip     = getDailyTip();
  const meal    = getCurrentMeal();
  const phase   = getCurrentPhase();
  const phaseLabel = { detox:'Detox', minicut:'MiniCut', volumen:'Volumen' }[phase] || phase;

  const now = new Date();
  const bedH = 20, bedM = 40;
  const bedSoon = now.getHours() >= 19;

  let totalProt = 0;
  if (meal?.allMeals) {
    meal.allMeals.forEach(m => {
      (m.items || []).forEach(it => {
        const match = (it||'').match(/(\d+)g proteína/i);
        if (match) totalProt += parseInt(match[1]);
      });
    });
  }

  document.getElementById('page-dashboard').innerHTML = `
    <div class="hero-card card-elevated" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div class="hero-date">${now.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div class="hero-day-name">${dayName}</div>
        <div class="hero-status ${isTrain?'':'rest'}">${isTrain ? ICONS.dumbbell + ' ' + ROUTINE[dayName].label : ICONS.sleep + ' Día de descanso'}</div>
      </div>
      <div id="hero-clock" style="font-size:28px; font-weight:800; color:var(--text-1); letter-spacing:-1px; text-shadow:0 0 10px rgba(255,255,255,0.1); text-align:right;">
        ${now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true})}
      </div>
    </div>
    ${isTrain ? `<button class="btn-next mt-12" onclick="window.GT.navigate('workout')" style="width:100%;padding:14px;font-size:14px;font-weight:700;margin-bottom:14px;">Ir al entrenamiento →</button>` : ''}

    <div class="tip-banner"><div style="margin-bottom:6px;color:var(--blue);">${ICONS.info}</div>${tip}</div>

    <div class="stats-row">
      <div class="stat-tile streak"><div class="stat-val">${stats.streak}</div><div class="stat-lbl"><span style="margin-right:4px;">${ICONS.fire}</span> Racha</div></div>
      <div class="stat-tile days"><div class="stat-val">${stats.totalDays}</div><div class="stat-lbl"><span style="margin-right:4px;">${ICONS.check}</span> Días</div></div>
      <div class="stat-tile prot"><div class="stat-val">~${totalProt}g</div><div class="stat-lbl"><span style="margin-right:4px;">${ICONS.meat}</span> Proteína</div></div>
    </div>

    <div class="section-hd"><h2>${ICONS.plate} Comida Actual</h2><span class="fs-12 text-muted">${phaseLabel}</span></div>
    ${meal?.current ? `
    <div class="meal-card">
      <div class="meal-header">
        <div class="meal-icon">${meal.current.icon}</div>
        <div><div class="meal-name">${meal.current.label}</div><div class="meal-time">${String(meal.current.hour).padStart(2,'0')}:${String(meal.current.minute).padStart(2,'0')} h</div></div>
      </div>
      <ul class="meal-items">${(meal.current.items||['Sin datos para esta comida']).map(i=>`<li>${i}</li>`).join('')}</ul>
      ${meal.next ? `<button class="meal-next-btn" onclick="window.GT.navigate('diet')">Siguiente: ${meal.next.icon} ${meal.next.label} →</button>` : ''}
    </div>` : '<div class="card"><p class="text-muted fs-13">Carga tu dieta en Configuración.</p></div>'}

    <div class="section-hd"><h2>${ICONS.sleep} Sueño</h2></div>
    <div class="card sleep-card">
      <div class="sleep-time">${bedH}:${String(bedM).padStart(2,'0')} PM</div>
      <div class="sleep-info">Hora ideal para dormir · 9h de sueño · Despertar 5:40 AM</div>
      ${bedSoon ? '<div class="mt-8 animate-pulse" style="font-size:13px;color:var(--purple);">¡Prepárate para dormir pronto!</div>' : ''}
    </div>

    <div class="section-hd"><h2>${ICONS.trophy} Logros</h2><a href="#" onclick="window.GT.showAchievements()">Ver todos</a></div>
    <div id="ach-preview"></div>
  `;

  renderAchievementPreview();

  if (window._clockInterval) clearInterval(window._clockInterval);
  window._clockInterval = setInterval(() => {
    const el = document.getElementById('hero-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true});
  }, 1000);
}

function renderAchievementPreview() {
  const unlocked = getUnlocked().filter(a => a.unlocked).slice(-2);
  const el = document.getElementById('ach-preview');
  if (!el) return;
  if (!unlocked.length) { el.innerHTML = '<div class="card"><p class="text-muted fs-13">Completa entrenamientos para desbloquear logros.</p></div>'; return; }
  el.innerHTML = `<div class="ach-grid">${unlocked.map(a=>`
    <div class="ach-tile unlocked">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-title">${a.title}</div>
      <div class="ach-desc">${a.desc}</div>
    </div>`).join('')}</div>`;
}

function renderWorkout() {
  const sess   = getSession();
  const day    = sess.activeDay;
  const isTrain = TRAIN_DAYS.includes(day);
  const routine = ROUTINE[day];

  let html = `<div class="day-tabs">`;
  ALL_DAYS.forEach(d => {
    const rest = !TRAIN_DAYS.includes(d);
    html += `<button class="day-tab ${d===day?'active':''} ${rest?'rest':''}" onclick="window.GT.setDay('${d}')">${d.slice(0,3)}</button>`;
  });
  html += `</div><div id="timer-area"></div>`;

  if (!isTrain) {
    html += `<div class="rest-card"><h3><span style="margin-right:8px;vertical-align:middle">${ICONS.sleep}</span> Día de Descanso</h3><p>Come bien, hidrátate y duerme 9h. El músculo crece mientras descansas.</p></div>`;
  } else {
    const total = routine.exercises.length;
    const idx   = sess.exIndex;
    const ex    = routine.exercises[idx];
    const prev  = sess.prevData[day];
    const mc    = MUSCLE_COLORS[ex.muscle] || { bg:'rgba(255,255,255,0.1)', c:'#fff' };
    const pct   = (idx / total) * 100;

    html += `
      <div class="ex-progress-text">Ejercicio ${idx+1} de ${total}</div>
      <div class="ex-progress-bar"><div class="ex-progress-fill" style="width:${pct}%"></div></div>
      <div class="ex-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
          <div style="flex:1; padding-right:12px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <div class="muscle-badge" style="background:${mc.bg};color:${mc.c}; margin:0;">${ex.muscle}</div>
              ${ex.tag ? `<span class="ex-tag ${ex.tag==='NUEVO'?'nuevo':''}">${ex.tag}</span>` : ''}
            </div>
            <div class="ex-name" style="margin-bottom:6px; font-size:18px;">${ex.name}</div>
            <div class="fs-12 text-muted" style="display:flex; align-items:center; gap:4px;">
              ${ICONS.target} Objetivo: <strong style="color:var(--text-1);">${ex.range} reps</strong>
            </div>
          </div>
          
          <button class="timer-stop" onclick="window.GT.startTimer(${ex.restS})" style="display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--bg-2); border:1px solid rgba(59,130,246,0.3); border-radius:var(--radius-md); padding:10px; min-width:76px; transition:all var(--transition);">
            <span style="font-size:20px; color:var(--blue); margin-bottom:2px;">⏱</span>
            <span style="font-size:11px; font-weight:700; color:var(--text-1);">${ex.rest}</span>
            <span style="font-size:9px; color:var(--text-3); text-transform:uppercase;">Descanso</span>
          </button>
        </div>
        <div class="set-grid">
          <div class="set-hdr"></div><div class="set-hdr">Peso</div><div class="set-hdr">Reps</div><div class="set-hdr">Anterior</div>
        </div>`;

    for (let i = 0; i < ex.sets; i++) {
      const s  = sess.entry[ex.id]?.[i] || { w:'', r:'', u:'kg' };
      const p  = prev?.entry?.[ex.id]?.[i];
      const pt = p ? `${p.w||'—'}${p.u||'kg'}×${p.r||'—'}` : '—';
      const up = p && ((+s.w > +p.w) || (+s.w === +p.w && +s.r > +p.r && +s.w > 0));
      html += `
        <div class="set-grid">
          <div class="set-num">S${i+1}</div>
          <div id="wgrp_${ex.id}_${i}" class="weight-grp ${up?'improved':''}">
            <input class="inp-w" type="number" inputmode="decimal" placeholder="—" value="${s.w}"
              oninput="window.GT.updateSet('${ex.id}',${i},'w',this.value)">
            <select class="unit-sel" onchange="window.GT.updateSet('${ex.id}',${i},'u',this.value)">
              <option value="kg" ${s.u==='kg'?'selected':''}>kg</option>
              <option value="lbs" ${s.u==='lbs'?'selected':''}>lbs</option>
              <option value="p" ${s.u==='p'?'selected':''}>p</option>
            </select>
          </div>
          <input id="rinp_${ex.id}_${i}" class="inp-r ${up?'improved':''}" type="number" inputmode="numeric" placeholder="—" value="${s.r}"
            oninput="window.GT.updateSet('${ex.id}',${i},'r',this.value)">
          <div class="prev-val ${up?'up':''}">${pt}</div>
        </div>`;
    }

    html += `</div>
      <div style="height: 90px;"></div>
      <div class="ex-nav" style="position:fixed; bottom:70px; left:0; right:0; padding:12px 16px; background:linear-gradient(to top, var(--bg) 70%, transparent); display:flex; gap:12px; z-index:100; max-width:600px; margin:0 auto;">
        ${idx > 0 ? `<button class="btn-prev" onclick="window.GT.prevEx()" style="background:var(--bg-1); border-color:var(--border-hi);">← Atrás</button>` : ''}
        ${idx < total-1
          ? `<button class="btn-next" onclick="window.GT.nextEx()" style="box-shadow:0 4px 16px rgba(59,130,246,0.2);">Siguiente →</button>`
          : `<button class="btn-save" onclick="window.GT.finishWorkout()" style="box-shadow:0 4px 16px rgba(255,255,255,0.1);">Guardar Día 🎉</button>`}
      </div>`;
  }

  document.getElementById('page-workout').innerHTML = html;
  renderTimer();
}

function renderDiet() {
  const phase = getCurrentPhase();
  const meal  = getCurrentMeal();

  let tabs = `
    <div class="diet-progress-wrapper" style="margin-bottom: 20px; padding: 0 10px;">
      <div class="diet-progress-bar" style="display:flex; justify-content:space-between; align-items:center; position:relative;">
        <div style="position:absolute; top:50%; left:0; right:0; height:2px; background:var(--border); z-index:0; transform:translateY(-50%);"></div>
        <div style="position:absolute; top:50%; left:0; width:${phase==='detox'?'0%':phase==='minicut'?'50%':'100%'}; height:2px; background:var(--green); z-index:1; transform:translateY(-50%); transition:width 0.4s ease;"></div>
        
        <div style="position:relative; z-index:2; background:var(--bg); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid ${phase==='detox'?'var(--blue)':(phase==='minicut'||phase==='volumen'?'var(--green)':'var(--border)')}; color:${phase==='detox'?'var(--blue)':(phase==='minicut'||phase==='volumen'?'var(--green)':'var(--text-3)')};">1</div>
        <div style="position:relative; z-index:2; background:var(--bg); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid ${phase==='minicut'?'var(--amber)':(phase==='volumen'?'var(--green)':'var(--border)')}; color:${phase==='minicut'?'var(--amber)':(phase==='volumen'?'var(--green)':'var(--text-3)')};">2</div>
        <div style="position:relative; z-index:2; background:var(--bg); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid ${phase==='volumen'?'var(--green)':'var(--border)'}; color:${phase==='volumen'?'var(--green)':'var(--text-3)'};">3</div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-3); font-weight:600; margin-top:8px;">
        <span style="color:${phase==='detox'?'var(--blue)':(phase==='minicut'||phase==='volumen'?'var(--green)':'var(--text-3)')};">Detox</span>
        <span style="color:${phase==='minicut'?'var(--amber)':(phase==='volumen'?'var(--green)':'var(--text-3)')};">MiniCut</span>
        <span style="color:${phase==='volumen'?'var(--green)':'var(--text-3)'};">Volumen</span>
      </div>
    </div>
    <div class="phase-tabs">`;
  ['detox','minicut','volumen'].forEach(p => {
    const labels = {detox:'Detox',minicut:'MiniCut',volumen:'Volumen'};
    const isLocked = !_unlockedPhases.includes(p);
    tabs += `<button class="phase-tab ${phase===p?'active '+p:''} ${isLocked?'locked':''}" onclick="${isLocked ? `window.GT.toast('Completa la etapa anterior.','err')` : `window.GT.setPhase('${p}')`}" style="${isLocked?'opacity:0.5;cursor:not-allowed':''}">${labels[p]} ${isLocked?'🔒':''}</button>`;
  });
  tabs += '</div>';

  let mealsHtml = '';
  if (meal?.allMeals) {
    meal.allMeals.forEach(m => {
      const isNow = m.id === meal.current?.id;
      const dKey = new Date().toLocaleDateString('en-CA');
      const isChecked = localStorage.getItem(`meal:${dKey}:${m.id}`) === '1';
      mealsHtml += `
        <div class="meal-card" style="${isNow?'border-color:var(--green);':''}">
          <div class="meal-header" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="meal-icon">${m.icon}</div>
              <div>
                <div class="meal-name">${m.label} ${isNow?'<span style="font-size:11px;color:var(--green);font-weight:700;">● AHORA</span>':''}</div>
                <div class="meal-time">${String(m.hour).padStart(2,'0')}:${String(m.minute).padStart(2,'0')} h</div>
              </div>
            </div>
            <button onclick="window.GT.toggleMeal('${m.id}')" style="display:flex; align-items:center; justify-content:center; gap:6px; padding:6px 14px; border-radius:20px; border:1px solid ${isChecked?'var(--green)':'var(--border)'}; background:${isChecked?'rgba(34,197,94,0.1)':'var(--bg-1)'}; color:${isChecked?'var(--green)':'var(--text-3)'}; font-size:11px; font-weight:700; transition:all 0.3s;">
              ${isChecked ? ICONS.check : '<div style="width:12px;height:12px;border:1.5px solid var(--text-3);border-radius:50%;"></div>'}
              ${isChecked ? 'COMPLETADO' : 'MARCAR'}
            </button>
          </div>
          <ul class="meal-items">${(m.items||['—']).map(i=>`<li>${i}</li>`).join('')}</ul>
        </div>`;
    });
  } else {
    mealsHtml = '<div class="card"><p class="text-muted fs-13">Datos de dieta no disponibles.</p></div>';
  }

  const list = generateShoppingList();
  let shopHtml = '';
  list.forEach(([cat, items]) => {
    shopHtml += `<div class="shopping-cat"><h3>${cat}</h3><ul>`;
    items.forEach(({item, times}) => {
      shopHtml += `<li><span>${item}</span><span class="shopping-badge">${times}x/sem</span></li>`;
    });
    shopHtml += '</ul></div>';
  });

  const phaseDays = _completedDays[phase]?.length || 0;
  const reqDays = phase === 'detox' ? 4 : (phase === 'minicut' ? 21 : 255);
  const progPct = Math.min(100, (phaseDays / reqDays) * 100);
  
  const progBarHtml = `
    <div style="background:var(--bg-1); border-radius:var(--radius-lg); padding:16px; margin:20px 0; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px; font-weight:700;">
        <span style="color:var(--text-2);">Progreso (${phase})</span>
        <span style="color:var(--blue);">${phaseDays} / ${reqDays} días</span>
      </div>
      <div style="height:8px; background:var(--bg-2); border-radius:4px; overflow:hidden;">
        <div style="height:100%; width:${progPct}%; background:var(--blue); transition:width 0.4s;"></div>
      </div>
    </div>
  `;

  let unlockHtml = '';
  if (phase === 'detox' && !_unlockedPhases.includes('minicut')) {
    if (phaseDays < 4) {
      unlockHtml = `<button class="btn-primary mt-12" style="background:var(--bg-2);color:var(--text-3);cursor:not-allowed;" disabled>🔒 Faltan ${4 - phaseDays} días para MiniCut</button>`;
    } else {
      unlockHtml = `<button class="btn-primary mt-12" style="background:var(--amber);color:#000;" onclick="window.GT.unlockPhase('minicut')">Terminar Detox y Desbloquear MiniCut 🔓</button>`;
    }
  } else if (phase === 'minicut' && !_unlockedPhases.includes('volumen')) {
    if (phaseDays < 21) {
      unlockHtml = `<button class="btn-primary mt-12" style="background:var(--bg-2);color:var(--text-3);cursor:not-allowed;" disabled>🔒 Faltan ${21 - phaseDays} días para Volumen</button>`;
    } else {
      unlockHtml = `<button class="btn-primary mt-12" style="background:var(--green);color:#000;" onclick="window.GT.unlockPhase('volumen')">Terminar MiniCut y Desbloquear Volumen 🔓</button>`;
    }
  }

  document.getElementById('page-diet').innerHTML = `
    <h2 class="fw-700" style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">${ICONS.plate} Plan Nutricional</h2>
    ${tabs}
    ${progBarHtml}
    <div class="section-hd" style="margin-top:4px;"><h2>Comidas del Día</h2></div>
    ${mealsHtml}
    <div class="section-hd"><h2><span style="margin-right:6px;">${ICONS.cart}</span> Lista de Compras Semanal</h2></div>
    <div class="card">${shopHtml || '<p class="text-muted fs-13">Sin datos.</p>'}</div>
    ${unlockHtml}
  `;
}

async function renderConfig() {
  const stats   = getStats();
  const unit    = await Storage.getSetting('defaultUnit','kg');
  const notifOn = await Storage.getSetting('notificationsEnabled', false);

  document.getElementById('page-config').innerHTML = `
    <h2 class="fw-700" style="margin-bottom:16px;display:flex;align-items:center;gap:8px;">${ICONS.info} Configuración</h2>

    <div class="settings-section">
      <h3>Estadísticas manuales</h3>
      <div class="card">
        <div class="setting-row">
          <div><div class="setting-label">Racha actual</div><div class="setting-sub">Días de entrenamiento consecutivos</div></div>
          <input id="cfg-streak" class="inp-setting" type="number" value="${stats.streak}" min="0">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">Días totales</div><div class="setting-sub">Total de sesiones completadas</div></div>
          <input id="cfg-days" class="inp-setting" type="number" value="${stats.totalDays}" min="0">
        </div>
        <button class="btn-primary mt-12" onclick="window.GT.saveManualStats()">Guardar estadísticas</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Unidades de peso</h3>
      <div class="card">
        <div class="setting-row">
          <div class="setting-label">Unidad por defecto</div>
          <select id="cfg-unit" class="select-setting" onchange="window.GT.saveUnit(this.value)">
            <option value="kg"  ${unit==='kg'?'selected':''}>kg</option>
            <option value="lbs" ${unit==='lbs'?'selected':''}>lbs</option>
            <option value="p"   ${unit==='p'?'selected':''}>Placas</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Notificaciones</h3>
      <div class="card">
        <div class="setting-row">
          <div><div class="setting-label">Recordatorios</div><div class="setting-sub">Comidas, agua, entrenamiento, sueño</div></div>
          <label class="toggle"><input type="checkbox" id="cfg-notif" ${notifOn?'checked':''} onchange="window.GT.toggleNotifs(this.checked)"><span class="toggle-slider"></span></label>
        </div>
        <button class="btn-outline" onclick="window.GT.testNotif()" style="margin-top:8px;">Probar notificación</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Datos</h3>
      <div class="card">
        <button class="btn-outline" onclick="window.GT.exportData()">📤 Exportar datos</button>
        <button class="btn-outline" onclick="window.GT.triggerImport()" style="margin-top:8px;">📥 Importar datos</button>
        <input id="import-file" type="file" accept=".json" style="display:none" onchange="window.GT.importData(this)">
      </div>
    </div>

    <div class="settings-section">
      <h3>Logros</h3>
      <div class="ach-grid">${getUnlocked().map(a=>`
        <div class="ach-tile ${a.unlocked?'unlocked':'locked'}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-title">${a.title}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>`).join('')}</div>
    </div>
  `;
}

function startTimer(s) {
  if (timerInterval) clearInterval(timerInterval);
  timerSecs = s; timerMax = s; timerActive = true;
  if (navigator.vibrate) navigator.vibrate(50);
  timerInterval = setInterval(() => {
    timerSecs--;
    if (timerSecs <= 0) { clearInterval(timerInterval); timerActive = false; timerSecs = 0; if (navigator.vibrate) navigator.vibrate([200,100,200]); }
    renderTimer();
  }, 1000);
  renderTimer();
}
function stopTimer() { if (timerInterval) clearInterval(timerInterval); timerActive = false; timerSecs = 0; timerMax = 0; renderTimer(); }
function fmt(s) { return Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60; }

function renderTimer() {
  const el = document.getElementById('timer-area');
  if (!el) return;
  if (!timerActive) { el.innerHTML = ''; return; }
  const pct = timerMax > 0 ? (timerSecs/timerMax)*100 : 0;
  const col = timerSecs > 60 ? 'var(--blue)' : timerSecs > 20 ? 'var(--amber)' : 'var(--red)';
  el.innerHTML = `
    <div class="timer-card">
      <div class="timer-num" style="color:${col}">${fmt(timerSecs)}</div>
      <div class="timer-bar-bg"><div class="timer-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <button class="timer-stop" onclick="window.GT.stopTimer()">✕</button>
    </div>`;
}

window.GT = {
  navigate,
  setDay(d) { setActiveDay(d); renderWorkout(); },
  updateSet(exId, i, f, v) { updateSet(exId, i, f, v); },
  nextEx()  { if (nextExercise()) renderWorkout(); },
  prevEx()  { if (prevExercise()) renderWorkout(); },
  startTimer, stopTimer,
  async finishWorkout() {
    const prevStats = getStats();
    const stats = await saveSession();
    toast('🎉 ¡Entrenamiento guardado!');
    if (navigator.vibrate) navigator.vibrate(100);
    const newAch = await checkAchievements(stats, prevStats);
    newAch.forEach((a, i) => setTimeout(() => toast(`${a.icon} ${a.title} desbloqueado!`), i * 3500));
    document.getElementById('streak-count').textContent = stats.streak;
    renderWorkout();
  },
  setPhase(p) { setPhase(p).then(() => renderDiet()); },
  async unlockPhase(p) {
    if (!_unlockedPhases.includes(p)) {
      _unlockedPhases.push(p);
      await Storage.saveSetting('unlockedPhases', _unlockedPhases);
      toast('¡Etapa desbloqueada! 🎉');
      await setPhase(p); renderDiet();
    }
  },
  async toggleMeal(id) {
    const d = new Date().toLocaleDateString('en-CA');
    const k = `meal:${d}:${id}`;
    const isChecked = localStorage.getItem(k) === '1';
    if (!isChecked) localStorage.setItem(k, '1'); else localStorage.removeItem(k);

    const phase = getCurrentPhase();
    const plan = getTodayPlan();
    if (plan) {
      const allMeals = MEAL_SCHEDULE.map(m => ({ id: m.id, items: plan[m.id] })).filter(m => m.items && m.items.length > 0);
      const allDone = allMeals.every(m => localStorage.getItem(`meal:${d}:${m.id}`) === '1');
      
      const idx = _completedDays[phase].indexOf(d);
      if (allDone && idx === -1) {
        _completedDays[phase].push(d);
        toast('¡Día completado! 🎉');
      } else if (!allDone && idx !== -1) {
        _completedDays[phase].splice(idx, 1);
      }
      await Storage.saveSetting('completedDays', _completedDays);
    }

    renderDiet();
  },
  showAchievements() { navigate('config'); },
  async saveManualStats() {
    await setManualStats({ streak: +document.getElementById('cfg-streak').value, totalDays: +document.getElementById('cfg-days').value });
    document.getElementById('streak-count').textContent = getStats().streak;
    toast('✅ Estadísticas guardadas');
  },
  saveUnit(u) { setDefaultUnit(u); toast('✅ Unidad guardada'); },
  async toggleNotifs(on) {
    if (on) { const ok = await requestPermission(); if (!ok) { document.getElementById('cfg-notif').checked = false; toast('❌ Notificaciones denegadas', 'err'); return; } startReminders(); }
    await Storage.saveSetting('notificationsEnabled', on);
    toast(on ? '🔔 Recordatorios activados' : '🔕 Recordatorios desactivados');
  },
  testNotif() { testNotification(); },
  async exportData() {
    const wk  = await Storage.getAllWorkouts();
    const st  = await Storage.getStats();
    const cfg = await Storage.getAllSettings();
    const blob = new Blob([JSON.stringify({ workouts: wk, stats: st, settings: cfg }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gymtracker_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
    toast('📤 Datos exportados');
  },
  triggerImport() { document.getElementById('import-file').click(); },
  async importData(input) {
    const file = input.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data.stats)    await Storage.saveStats(data.stats);
      if (data.settings) { for (const [k,v] of Object.entries(data.settings)) await Storage.saveSetting(k, v); }
      if (data.workouts) { for (const {key, value} of (data.workouts||[])) await Storage.saveWorkout(key, value); }
      toast('✅ Datos importados'); location.reload();
    } catch { toast('❌ Archivo inválido', 'err'); }
  },
};

async function boot() {
  await loadStats();
  await loadDiet();
  await loadAchievements();
  await initWorkout();
  registerSaveListeners();

  const stats = getStats();
  document.getElementById('streak-count').textContent = stats.streak;

  const notifOn = await Storage.getSetting('notificationsEnabled', false);
  if (notifOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') startReminders();

  navigate('dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
