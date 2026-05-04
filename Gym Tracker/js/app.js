/**
 * app.js — Orquestador principal
 */
import { Storage } from './db.js';
import { loadStats, getStats, getWeekStats, setManualStats } from './stats.js';
import { loadDiet, getCurrentMeal, getCurrentPhase, setPhase, generateShoppingList, needsOatmealSoak } from './diet.js';
import { ROUTINE, ALL_DAYS, TRAIN_DAYS, MUSCLE_COLORS, initWorkout, setActiveDay, getSession, updateSet, saveSession, saveNow, nextExercise, prevExercise, registerSaveListeners, setDefaultUnit } from './workout.js';
import { loadAchievements, checkAchievements, getUnlocked, getDailyTip } from './achievements.js';
import { requestPermission, startReminders, testNotification } from './notifications.js';

// ─── Timer state ──────────────────────────────────────────────────────────────
let timerInterval = null, timerSecs = 0, timerMax = 0, timerActive = false;

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type === 'err' ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const stats   = getStats();
  const wStats  = getWeekStats();
  const todayJS = new Date().getDay();
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][todayJS];
  const isTrain = TRAIN_DAYS.includes(dayName);
  const tip     = getDailyTip();
  const meal    = getCurrentMeal();
  const phase   = getCurrentPhase();
  const phaseLabel = { detox:'🔴 DETOX', minicut:'🟡 MiniCut', volumen:'🟢 Volumen' }[phase] || phase;

  // Sleep calc: wake 5:40am, 9h sleep → bed 8:40pm
  const now = new Date();
  const bedH = 20, bedM = 40;
  const bedSoon = now.getHours() >= 19;

  // Macro summary from meal plan
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
    <div class="hero-card card-elevated">
      <div class="hero-date">${now.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</div>
      <div class="hero-day-name">${dayName}</div>
      <div class="hero-status ${isTrain?'':'rest'}">${isTrain ? '🏋️ ' + ROUTINE[dayName].label : '😴 Día de descanso'}</div>
      ${isTrain ? `<button class="btn-next mt-12" onclick="window.GT.navigate('workout')" style="width:auto;padding:10px 20px;font-size:13px;">Ir al entrenamiento →</button>` : ''}
    </div>

    <div class="tip-banner">${tip}</div>

    <div class="stats-row">
      <div class="stat-tile streak"><div class="stat-val">${stats.streak}</div><div class="stat-lbl">🔥 Racha</div></div>
      <div class="stat-tile days"><div class="stat-val">${stats.totalDays}</div><div class="stat-lbl">💪 Días</div></div>
      <div class="stat-tile prot"><div class="stat-val">~${totalProt}g</div><div class="stat-lbl">🥩 Proteína</div></div>
    </div>

    <div class="section-hd"><h2>🍽️ Comida Actual</h2><span class="fs-12 text-muted">${phaseLabel}</span></div>
    ${meal?.current ? `
    <div class="meal-card">
      <div class="meal-header">
        <div class="meal-icon">${meal.current.icon}</div>
        <div><div class="meal-name">${meal.current.label}</div><div class="meal-time">${String(meal.current.hour).padStart(2,'0')}:${String(meal.current.minute).padStart(2,'0')} h</div></div>
      </div>
      <ul class="meal-items">${(meal.current.items||['Sin datos para esta comida']).map(i=>`<li>${i}</li>`).join('')}</ul>
      ${meal.next ? `<button class="meal-next-btn" onclick="window.GT.navigate('diet')">Siguiente: ${meal.next.icon} ${meal.next.label} →</button>` : ''}
    </div>` : '<div class="card"><p class="text-muted fs-13">Carga tu dieta en Configuración.</p></div>'}

    <div class="section-hd"><h2>😴 Sueño</h2></div>
    <div class="card sleep-card">
      <div class="sleep-time">${bedH}:${String(bedM).padStart(2,'0')} PM</div>
      <div class="sleep-info">Hora ideal para dormir · 9h de sueño · Despertar 5:40 AM</div>
      ${bedSoon ? '<div class="mt-8 animate-pulse" style="font-size:13px;color:var(--purple);">¡Prepárate para dormir pronto!</div>' : ''}
    </div>

    <div class="section-hd"><h2>🏆 Logros</h2><a href="#" onclick="window.GT.showAchievements()">Ver todos</a></div>
    <div id="ach-preview"></div>
  `;

  renderAchievementPreview();
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

// ─── Workout ──────────────────────────────────────────────────────────────────
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
    html += `<div class="rest-card"><h3>😴 Día de Descanso</h3><p>Come bien, hidrátate y duerme 9h. El músculo crece mientras descansas.</p></div>`;
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
        <div class="muscle-badge" style="background:${mc.bg};color:${mc.c}">${ex.muscle}</div>
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">
          ${ex.tag ? `<span class="ex-tag ${ex.tag==='NUEVO'?'nuevo':''}">${ex.tag}</span>` : ''}
          <span class="fs-12 text-muted">🎯 ${ex.range} reps</span>
          <button class="timer-stop" onclick="window.GT.startTimer(${ex.restS})" style="margin-left:auto">⏱ ${ex.rest}</button>
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
      <div class="ex-nav">
        ${idx > 0 ? `<button class="btn-prev" onclick="window.GT.prevEx()">← Atrás</button>` : ''}
        ${idx < total-1
          ? `<button class="btn-next" onclick="window.GT.nextEx()">Siguiente →</button>`
          : `<button class="btn-save" onclick="window.GT.finishWorkout()">Guardar Día 🎉</button>`}
      </div>`;
  }

  document.getElementById('page-workout').innerHTML = html;
  renderTimer();
}

// ─── Diet ─────────────────────────────────────────────────────────────────────
function renderDiet() {
  const phase = getCurrentPhase();
  const meal  = getCurrentMeal();

  let tabs = `<div class="phase-tabs">`;
  ['detox','minicut','volumen'].forEach(p => {
    const labels = {detox:'🔴 Detox',minicut:'🟡 MiniCut',volumen:'🟢 Volumen'};
    tabs += `<button class="phase-tab ${phase===p?'active '+p:''}" onclick="window.GT.setPhase('${p}')">${labels[p]}</button>`;
  });
  tabs += '</div>';

  let mealsHtml = '';
  if (meal?.allMeals) {
    meal.allMeals.forEach(m => {
      const isNow = m.id === meal.current?.id;
      mealsHtml += `
        <div class="meal-card" style="${isNow?'border-color:var(--green);':''}">
          <div class="meal-header">
            <div class="meal-icon">${m.icon}</div>
            <div>
              <div class="meal-name">${m.label} ${isNow?'<span style="font-size:11px;color:var(--green);font-weight:700;">● AHORA</span>':''}</div>
              <div class="meal-time">${String(m.hour).padStart(2,'0')}:${String(m.minute).padStart(2,'0')} h</div>
            </div>
          </div>
          <ul class="meal-items">${(m.items||['—']).map(i=>`<li>${i}</li>`).join('')}</ul>
        </div>`;
    });
  } else {
    mealsHtml = '<div class="card"><p class="text-muted fs-13">Datos de dieta no disponibles.</p></div>';
  }

  // Shopping list
  const list = generateShoppingList();
  let shopHtml = '';
  list.forEach(([cat, items]) => {
    shopHtml += `<div class="shopping-cat"><h3>${cat}</h3><ul>`;
    items.forEach(({item, times}) => {
      shopHtml += `<li><span>${item}</span><span class="shopping-badge">${times}x/sem</span></li>`;
    });
    shopHtml += '</ul></div>';
  });

  document.getElementById('page-diet').innerHTML = `
    <h2 class="fw-700" style="margin-bottom:14px;">🍽️ Plan Nutricional</h2>
    ${tabs}
    <div class="section-hd" style="margin-top:4px;"><h2>Comidas del Día</h2></div>
    ${mealsHtml}
    <div class="section-hd"><h2>🛒 Lista de Compras Semanal</h2></div>
    <div class="card">${shopHtml || '<p class="text-muted fs-13">Sin datos.</p>'}</div>
  `;
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function renderConfig() {
  const stats   = getStats();
  const unit    = await Storage.getSetting('defaultUnit','kg');
  const notifOn = await Storage.getSetting('notificationsEnabled', false);

  document.getElementById('page-config').innerHTML = `
    <h2 class="fw-700" style="margin-bottom:16px;">⚙️ Configuración</h2>

    <div class="settings-section">
      <h3>📊 Estadísticas manuales</h3>
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
      <h3>🏋️ Unidades de peso</h3>
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
      <h3>🔔 Notificaciones</h3>
      <div class="card">
        <div class="setting-row">
          <div><div class="setting-label">Recordatorios</div><div class="setting-sub">Comidas, agua, entrenamiento, sueño</div></div>
          <label class="toggle"><input type="checkbox" id="cfg-notif" ${notifOn?'checked':''} onchange="window.GT.toggleNotifs(this.checked)"><span class="toggle-slider"></span></label>
        </div>
        <button class="btn-outline" onclick="window.GT.testNotif()" style="margin-top:8px;">Probar notificación</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>📁 Datos</h3>
      <div class="card">
        <button class="btn-outline" onclick="window.GT.exportData()">📤 Exportar datos</button>
        <button class="btn-outline" onclick="window.GT.triggerImport()" style="margin-top:8px;">📥 Importar datos</button>
        <input id="import-file" type="file" accept=".json" style="display:none" onchange="window.GT.importData(this)">
      </div>
    </div>

    <div class="settings-section">
      <h3>🏆 Logros</h3>
      <div class="ach-grid">${getUnlocked().map(a=>`
        <div class="ach-tile ${a.unlocked?'unlocked':'locked'}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-title">${a.title}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>`).join('')}</div>
    </div>
  `;
}

// ─── Timer ────────────────────────────────────────────────────────────────────
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

// ─── Global API (called from inline HTML) ─────────────────────────────────────
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
  showAchievements() { navigate('config'); },
  async saveManualStats() {
    await setManualStats({ streak: +document.getElementById('cfg-streak').value, totalDays: +document.getElementById('cfg-days').value });
    document.getElementById('streak-count').textContent = getStats().streak;
    toast('✅ Estadísticas guardadas');
  },
  saveUnit(u) { setDefaultUnit(u); Storage.saveSetting('defaultUnit', u); toast('✅ Unidad guardada'); },
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

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function boot() {
  await loadStats();
  await loadDiet();
  await loadAchievements();
  await initWorkout();
  registerSaveListeners();

  const stats = getStats();
  document.getElementById('streak-count').textContent = stats.streak;

  // Activar notificaciones si ya estaban habilitadas
  const notifOn = await Storage.getSetting('notificationsEnabled', false);
  if (notifOn && Notification.permission === 'granted') startReminders();

  navigate('dashboard');

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
