/**
 * achievements.js — Sistema de logros y motivación
 */
import { Storage } from './db.js';

export const ACHIEVEMENT_LIST = [
  { id:'first_workout',  icon:'🎯', title:'Primer Paso',       desc:'Completaste tu primer entrenamiento.',   check: s => s.totalDays >= 1 },
  { id:'streak_3',       icon:'🔥', title:'En Llamas',         desc:'3 días de racha consecutivos.',          check: s => s.streak >= 3 },
  { id:'streak_7',       icon:'⚡', title:'Semana Completa',    desc:'7 días de racha.',                      check: s => s.streak >= 7 },
  { id:'streak_14',      icon:'💪', title:'Quincenal',          desc:'14 días de racha.',                     check: s => s.streak >= 14 },
  { id:'streak_30',      icon:'🏆', title:'Un Mes de Hierro',   desc:'30 días de racha consecutivos.',        check: s => s.streak >= 30 },
  { id:'total_10',       icon:'🌱', title:'Semilla',            desc:'10 sesiones de entrenamiento totales.', check: s => s.totalDays >= 10 },
  { id:'total_50',       icon:'🌳', title:'Árbol Fuerte',       desc:'50 sesiones de entrenamiento.',         check: s => s.totalDays >= 50 },
  { id:'total_100',      icon:'💎', title:'Centurión',          desc:'100 sesiones de entrenamiento.',        check: s => s.totalDays >= 100 },
  { id:'comeback',       icon:'🔄', title:'De Vuelta',          desc:'Volviste después de un descanso.',      check: (s, prev) => prev && prev.streak === 0 && s.streak === 1 },
];

const TIPS = [
  '💡 El músculo crece mientras descansas, no mientras entrenas.',
  '💡 La consistencia supera a la intensidad. Todos los días un poco.',
  '💡 Hidratación: 4L en días de entreno. Tu rendimiento depende de ello.',
  '💡 El sueño es el suplemento más barato y efectivo que existe.',
  '💡 Proteína en cada comida. Tu cuerpo la usa constantemente.',
  '💡 Progresión de carga: si puedes hacer más reps, sube el peso.',
  '💡 La avena remojada se digiere mejor. Prepárala la noche anterior.',
  '💡 20 min de caminata inclinada en MiniCut quema más que 20 min corriendo.',
  '💡 Si llevas 3 semanas sin progresar, algo falla: sueño, comida o técnica.',
  '💡 Los días de descanso son parte del plan. No son días perdidos.',
];

let _achievements = {};

export async function loadAchievements() {
  const saved = await Storage.getAchievements();
  _achievements = saved || {};
  return _achievements;
}

export async function checkAchievements(stats, prevStats) {
  let newOnes = [];
  for (const ach of ACHIEVEMENT_LIST) {
    if (_achievements[ach.id]) continue; // ya desbloqueado
    if (ach.check(stats, prevStats)) {
      _achievements[ach.id] = { unlockedAt: new Date().toISOString() };
      newOnes.push(ach);
    }
  }
  if (newOnes.length) await Storage.saveAchievements(_achievements);
  return newOnes;
}

export function getUnlocked() {
  return ACHIEVEMENT_LIST.map(a => ({
    ...a,
    unlocked: !!_achievements[a.id],
    unlockedAt: _achievements[a.id]?.unlockedAt || null,
  }));
}

export function getDailyTip() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  return TIPS[dayOfYear % TIPS.length];
}
