/* ════════════════════════════════════════════════════════════════
   Petnix — app.js
   Логика игры: яйцо → питомец → уход → смерть
   Состояние хранится в localStorage, поэтому работает между сессиями.
════════════════════════════════════════════════════════════════ */

// ── Telegram WebApp ──────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // Устанавливаем цвет header-бара под тему
  tg.setHeaderColor('#0f0f1a');
}

// ── Константы ────────────────────────────────────────────────────────────────
const EGG_DURATION_MS  = 24 * 60 * 60 * 1000;   // 24 часа
const TICK_INTERVAL_MS = 10_000;                  // каждые 10 сек — пересчёт

// За сколько % в минуту падают статы (при 10-сек тике делим на 6)
const DECAY = {
  hunger:  0.8,   // % за минуту
  mood:    0.5,
  energy:  0.4,
};

// Питомцы по «возрасту» (в часах)
const PET_STAGES = [
  { minAge: 0,   emoji: '🐣', name: 'Птенец' },
  { minAge: 24,  emoji: '🐥', name: 'Цыплёнок' },
  { minAge: 72,  emoji: '🐓', name: 'Петух' },
  { minAge: 168, emoji: '🦅', name: 'Орёл' },  // 7 дней
];

// ── DOM ───────────────────────────────────────────────────────────────────────
const screens  = {
  egg:   document.getElementById('screen-egg'),
  hatch: document.getElementById('screen-hatch'),
  pet:   document.getElementById('screen-pet'),
  dead:  document.getElementById('screen-dead'),
};

const $countdown   = document.getElementById('countdown');
const $eggTimerLbl = document.getElementById('egg-timer-label');
const $petSprite   = document.getElementById('pet-sprite');
const $petMood     = document.getElementById('pet-mood');
const $hatchAnim   = document.getElementById('hatch-anim');

const $bars = {
  hunger: document.getElementById('bar-hunger'),
  mood:   document.getElementById('bar-mood'),
  energy: document.getElementById('bar-energy'),
};
const $vals = {
  hunger: document.getElementById('val-hunger'),
  mood:   document.getElementById('val-mood'),
  energy: document.getElementById('val-energy'),
};

const $ageLabel   = document.getElementById('age-label');
const $toast      = document.getElementById('toast');
const $btnSkip    = document.getElementById('btn-skip');
const $btnFeed    = document.getElementById('btn-feed');
const $btnPlay    = document.getElementById('btn-play');
const $btnSleep   = document.getElementById('btn-sleep');

// ── Состояние игры ────────────────────────────────────────────────────────────
let state = loadState();
let tickTimer  = null;
let countTimer = null;
let toastTimer = null;

// ── Инициализация ─────────────────────────────────────────────────────────────
init();

function init() {
  if (!state) {
    // Первый запуск — начинаем с яйца
    state = createNewGame();
    saveState();
  }

  // Сразу пересчитываем накопившийся распад (если приложение было закрыто)
  if (state.phase === 'pet') applyOfflineDecay();

  renderCurrentPhase();
}

// ── Создание новой игры ───────────────────────────────────────────────────────
function createNewGame() {
  return {
    phase:      'egg',             // 'egg' | 'pet' | 'dead'
    eggStart:   Date.now(),        // timestamp появления яйца
    hatchTime:  Date.now() + EGG_DURATION_MS,
    hunger:     100,
    mood:       100,
    energy:     100,
    lastTick:   null,              // timestamp последнего тика (для offline decay)
    birthTime:  null,              // когда вылупился
  };
}

// ── Рендер фазы ──────────────────────────────────────────────────────────────
function renderCurrentPhase() {
  // Останавливаем таймеры
  clearInterval(tickTimer);
  clearInterval(countTimer);

  Object.values(screens).forEach(s => s.classList.remove('active'));

  if (state.phase === 'egg') {
    screens.egg.classList.add('active');
    startCountdown();
  } else if (state.phase === 'pet') {
    screens.pet.classList.add('active');
    updatePetUI();
    startTick();
  } else if (state.phase === 'dead') {
    screens.dead.classList.add('active');
  }
}

// ── Экран яйца: обратный отсчёт ──────────────────────────────────────────────
function startCountdown() {
  updateCountdown();
  countTimer = setInterval(() => {
    if (Date.now() >= state.hatchTime) {
      clearInterval(countTimer);
      triggerHatch();
    } else {
      updateCountdown();
    }
  }, 1000);
}

function updateCountdown() {
  const diff = Math.max(0, state.hatchTime - Date.now());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  $countdown.textContent =
    String(h).padStart(2,'0') + ':' +
    String(m).padStart(2,'0') + ':' +
    String(s).padStart(2,'0');
}

// ── Вылупление ────────────────────────────────────────────────────────────────
function triggerHatch() {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens.hatch.classList.add('active');

  // Анимация вылупления
  const frames = ['🥚','🥚💥','🐣'];
  let i = 0;
  const anim = setInterval(() => {
    $hatchAnim.textContent = frames[i++ % frames.length];
    if (i >= frames.length * 3) {
      clearInterval(anim);
      finishHatch();
    }
  }, 400);
}

function finishHatch() {
  state.phase     = 'pet';
  state.birthTime = Date.now();
  state.lastTick  = Date.now();
  state.hunger    = 100;
  state.mood      = 100;
  state.energy    = 100;
  saveState();

  setTimeout(() => {
    renderCurrentPhase();
    showToast('🐣 Питомец вылупился! Позаботься о нём!');
  }, 600);
}

// ── Тик (деградация статов) ───────────────────────────────────────────────────
function startTick() {
  state.lastTick = state.lastTick ?? Date.now();
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
}

function tick() {
  if (state.phase !== 'pet') return;

  const now  = Date.now();
  const mins = (now - state.lastTick) / 60_000;
  state.lastTick = now;

  const sleeping = state.sleeping;

  // Во время сна: энергия восстанавливается, сытость/настроение падают медленнее
  state.hunger = clamp(state.hunger - DECAY.hunger * mins * (sleeping ? 0.3 : 1));
  state.mood   = clamp(state.mood   - DECAY.mood   * mins * (sleeping ? 0.2 : 1));
  state.energy = sleeping
    ? clamp(state.energy + 2 * mins)      // восстанавливается
    : clamp(state.energy - DECAY.energy * mins);

  // Автопробуждение когда энергия полная
  if (sleeping && state.energy >= 100) {
    state.sleeping = false;
    showToast('⚡ Питомец выспался и проснулся!');
    $btnSleep.disabled = false;
  }

  // Смерть если все 3 стата упали ниже 0 или голод достиг 0
  if (state.hunger <= 0) {
    die();
    return;
  }

  saveState();
  updatePetUI();
}

// Применяем распад за время отсутствия
function applyOfflineDecay() {
  if (!state.lastTick) return;
  const now  = Date.now();
  const mins = (now - state.lastTick) / 60_000;
  if (mins < 0.5) return;            // меньше 30 сек — игнорируем

  state.hunger = clamp(state.hunger - DECAY.hunger * mins);
  state.mood   = clamp(state.mood   - DECAY.mood   * mins);
  state.energy = clamp(state.energy - DECAY.energy * mins);
  state.lastTick = now;

  if (state.hunger <= 0) {
    state.phase = 'dead';
  }
  saveState();
}

// ── Обновление UI питомца ─────────────────────────────────────────────────────
function updatePetUI() {
  // Стадия развития
  const ageHours = state.birthTime
    ? (Date.now() - state.birthTime) / 3_600_000
    : 0;

  const stage = [...PET_STAGES].reverse().find(s => ageHours >= s.minAge) || PET_STAGES[0];
  $petSprite.textContent = stage.emoji;

  // Анимация состояния
  $petSprite.className = 'pet-sprite';
  if (state.sleeping) {
    $petSprite.classList.add('sleeping');
    $petMood.textContent = '💤';
  } else if (state.hunger < 30 || state.mood < 30 || state.energy < 30) {
    $petSprite.classList.add('sad');
    $petMood.textContent = '😢';
  } else if (state.mood > 70 && state.hunger > 70) {
    $petSprite.classList.add('happy');
    $petMood.textContent = '😊';
  } else {
    $petSprite.classList.add('idle');
    $petMood.textContent = '😐';
  }

  // Полоски
  renderBar('hunger', state.hunger);
  renderBar('mood',   state.mood);
  renderBar('energy', state.energy);

  // Возраст
  const days = Math.floor(ageHours / 24);
  const hrs  = Math.floor(ageHours % 24);
  $ageLabel.textContent = `${stage.name} · Возраст: ${days} д. ${hrs} ч.`;
}

function renderBar(key, val) {
  const pct = Math.round(val);
  $bars[key].style.width = pct + '%';
  $vals[key].textContent = pct;
  $bars[key].style.background =
    val >= 60 ? 'var(--bar-good)' :
    val >= 30 ? 'var(--bar-mid)'  :
                'var(--bar-low)';
}

// ── Действия игрока ───────────────────────────────────────────────────────────
function action(type) {
  if (state.phase !== 'pet') return;

  if (state.sleeping && type !== 'sleep') {
    showToast('😴 Питомец спит, не мешай!');
    return;
  }

  switch (type) {

    case 'feed':
      if (state.hunger >= 100) { showToast('🍖 Питомец не голоден!'); return; }
      state.hunger = clamp(state.hunger + 30);
      state.mood   = clamp(state.mood   + 5);
      animPet('eating');
      showToast('🍖 Питомец поел! +30 сытости');
      break;

    case 'play':
      if (state.energy < 15) { showToast('⚡ Питомцу нужен отдых!'); return; }
      state.mood   = clamp(state.mood   + 25);
      state.energy = clamp(state.energy - 15);
      state.hunger = clamp(state.hunger - 8);
      animPet('happy');
      showToast('🎾 Питомец поиграл! +25 настроения');
      break;

    case 'sleep':
      if (state.sleeping) {
        // Разбудить
        state.sleeping = false;
        $btnSleep.textContent = '💤\nСпать';
        showToast('🌅 Питомец проснулся!');
      } else {
        if (state.energy >= 90) { showToast('⚡ Питомец не хочет спать!'); return; }
        state.sleeping = true;
        $btnSleep.textContent = '🌅\nРазбудить';
        animPet('sleeping');
        showToast('💤 Питомец уснул. Энергия восстанавливается...');
      }
      break;
  }

  saveState();
  updatePetUI();
}

function animPet(cls) {
  $petSprite.className = 'pet-sprite ' + cls;
  setTimeout(() => { if (state.phase === 'pet') updatePetUI(); }, 1500);
}

// ── Смерть ────────────────────────────────────────────────────────────────────
function die() {
  clearInterval(tickTimer);
  state.phase = 'dead';
  saveState();
  renderCurrentPhase();
}

// ── Перезапуск ────────────────────────────────────────────────────────────────
function restartGame() {
  clearInterval(tickTimer);
  clearInterval(countTimer);
  state = createNewGame();
  saveState();
  renderCurrentPhase();
}
window.restartGame = restartGame;  // доступ из HTML

// ── Debug: пропустить яйцо ────────────────────────────────────────────────────
$btnSkip?.addEventListener('click', () => {
  clearInterval(countTimer);
  triggerHatch();
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.classList.add('show');
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2800);
}

// ── Действия из HTML ──────────────────────────────────────────────────────────
window.action = action;

// ── localStorage ─────────────────────────────────────────────────────────────
function saveState() {
  try { localStorage.setItem('petnix_state', JSON.stringify(state)); } catch {}
}
function loadState() {
  try {
    const raw = localStorage.getItem('petnix_state');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Вспомогательные ──────────────────────────────────────────────────────────
function clamp(v, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}
