/**
 * notifications.js — Recordatorios y notificaciones locales
 */
import { needsOatmealSoak } from './diet.js';
import { MEAL_SCHEDULE } from './diet.js';

let _permission = 'default';
const INTERVALS = [];

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  _permission = await Notification.requestPermission();
  return _permission === 'granted';
}

export function hasPermission() { return _permission === 'granted'; }

function notify(title, body, icon = './icons/icon-192.png', tag = '') {
  if (_permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, tag, badge: './icons/icon-72.png', vibrate: [200,100,200] });
  } catch {}
}

function vibrate(pattern = [200,100,200]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ─── Programar recordatorios diarios ─────────────────────────────────────────
function scheduleAt(hour, minute, callback) {
  const now  = new Date();
  const then = new Date();
  then.setHours(hour, minute, 0, 0);
  if (then <= now) then.setDate(then.getDate() + 1);
  const delay = then - now;
  const id = setTimeout(() => {
    callback();
    // Re-schedule for next day
    const daily = setInterval(callback, 24 * 60 * 60 * 1000);
    INTERVALS.push(daily);
  }, delay);
  INTERVALS.push(id);
}

export function startReminders() {
  if (_permission !== 'granted') return;

  // 💧 Agua — cada 2 horas entre 6am y 10pm
  for (let h = 6; h <= 22; h += 2) {
    scheduleAt(h, 0, () => {
      notify('💧 Hidratación', 'Recuerda tomar agua. ¡Mínimo 500ml ahora!', undefined, 'agua');
      vibrate([100]);
    });
  }

  // 🍽️ Comidas — según horario
  MEAL_SCHEDULE.forEach(m => {
    scheduleAt(m.hour, m.minute, () => {
      notify(`${m.icon} Hora de ${m.label}`, '¡Es momento de comer!', undefined, 'comida');
      vibrate([200, 100, 200]);
    });
  });

  // 🥣 Remojar avena — a las 9:30 PM si aplica
  scheduleAt(21, 30, () => {
    if (needsOatmealSoak()) {
      notify('🥣 Preparación', 'Recuerda remojar la avena en el yogurt para mañana.', undefined, 'avena');
      vibrate([300, 100, 300]);
    }
  });

  // 😴 Hora de dormir — 8:20 PM (para levantarse 5:40 AM con 9h sueño)
  scheduleAt(20, 20, () => {
    notify('😴 Hora de dormir', 'Para dormir 9h y levantarte a las 5:40am, debes dormir ya.', undefined, 'sueno');
    vibrate([400, 200, 400]);
  });

  // 🏋️ Recordatorio de entrenamiento — Martes, Miércoles, Jueves, Sábado, Domingo a las 5pm
  const TRAIN_WEEKDAYS = [2, 3, 4, 6, 0]; // JS: 0=dom,2=mar,3=mie,4=jue,6=sab
  scheduleAt(17, 0, () => {
    const dayJS = new Date().getDay();
    if (TRAIN_WEEKDAYS.includes(dayJS)) {
      notify('🏋️ ¡A entrenar!', '¡Hoy toca gym! No rompas tu racha.', undefined, 'entreno');
      vibrate([200, 100, 200, 100, 200]);
    }
  });
}

export function clearReminders() {
  INTERVALS.forEach(id => { clearTimeout(id); clearInterval(id); });
  INTERVALS.length = 0;
}

/** Enviar notificación manual de prueba */
export function testNotification() {
  notify('🏋️ Gym Tracker Pro', '¡Las notificaciones funcionan correctamente!');
  vibrate([100, 50, 100]);
}
