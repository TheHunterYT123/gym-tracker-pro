/**
 * diet.js — Sistema de dieta dinámico (3 fases, comidas por hora)
 * Lee datos del archivo data/diet.json
 */
import { Storage } from './db.js';

// Horarios de comidas (hora de inicio en formato 24h)
export const MEAL_SCHEDULE = [
  { id: 'desayuno',    label: 'Desayuno',    icon: '🌅', hour: 6,  minute: 0  },
  { id: 'mediaMañana', label: 'Media Mañana', icon: '🍎', hour: 10, minute: 0  },
  { id: 'comida',      label: 'Comida',       icon: '🍗', hour: 13, minute: 0  },
  { id: 'merienda',   label: 'Merienda',     icon: '🥛', hour: 16, minute: 30 },
  { id: 'cena',        label: 'Cena',         icon: '🌙', hour: 20, minute: 0  },
];

let _dietData = null;
let _currentPhase = 'minicut'; // 'detox' | 'minicut' | 'volumen'

export async function loadDiet() {
  try {
    _currentPhase = await Storage.getSetting('dietPhase', 'minicut');
    const custom = await Storage.getSetting('customDietData', null);
    if (custom) { _dietData = custom; return _dietData; }
    const res = await fetch('./data/diet.json');
    _dietData = await res.json();
    return _dietData;
  } catch (e) {
    console.warn('No se pudo cargar diet.json, usando datos vacíos', e);
    _dietData = { detox: {}, minicut: {}, volumen: {} };
    return _dietData;
  }
}

export function getCurrentPhase() { return _currentPhase; }

export async function setPhase(phase) {
  _currentPhase = phase;
  await Storage.saveSetting('dietPhase', phase);
}

/** Obtiene el plan del día actual según la fase */
export function getTodayPlan() {
  if (!_dietData) return null;
  const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const dayName  = dayNames[new Date().getDay()];
  const phase    = _dietData[_currentPhase];
  if (!phase) return null;
  // Detox es igual todos los días
  return phase[dayName] || phase['todos'] || null;
}

/** Retorna la comida activa según la hora actual */
export function getCurrentMeal() {
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

  // Si es antes del primer horario, mostrar desayuno
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

/** ¿Hay que remojar avena esta noche? (si mañana el desayuno tiene avena) */
export function needsOatmealSoak() {
  if (!_dietData) return false;
  const tomorrow   = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayNames   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const tomorrowName = dayNames[tomorrow.getDay()];
  const phase      = _dietData[_currentPhase];
  if (!phase) return false;
  const plan       = phase[tomorrowName] || phase['todos'] || null;
  const breakfast  = plan?.desayuno;
  if (!breakfast) return false;
  return breakfast.some(item => typeof item === 'string' && item.toLowerCase().includes('avena'));
}

/** Genera lista de compras semanal agrupada por alimento */
export function generateShoppingList() {
  if (!_dietData) return [];
  const phase     = _dietData[_currentPhase];
  if (!phase) return [];
  const dayNames  = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const frequency = {};

  dayNames.forEach(day => {
    const plan = phase[day] || phase['todos'] || {};
    Object.values(plan).forEach(items => {
      (items || []).forEach(item => {
        if (typeof item !== 'string') return;
        const clean = item.replace(/^\d+g?\s*/,'').replace(/\s*\(.*?\)/g,'').trim().toLowerCase();
        frequency[clean] = (frequency[clean] || 0) + 1;
      });
    });
  });

  // Agrupar por categorías
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
