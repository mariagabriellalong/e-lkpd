/* === SPACE ADVENTURE FRACTIONS - STATE MANAGEMENT ENGINE === */

// ============ GLOBAL STATE STORE (Zustand-like pattern) ============
const SpaceStore = {
  _state: null,
  _listeners: [],

  getDefaultState() {
    return {
      username: 'Sobat Ceria',
      kelas: '-',
      totalXP: 0,
      currentLevel: 1,
      streakDays: 0,
      comboCount: 0,
      isOnFire: false,
      wrongAttempts: {},
      collectedBadges: [],
      currentRank: 'Kadet Angkasa',
      lessonProgress: { mission1: false, mission2: false, mission3: false, mission4: false, mission5: false },
      quizScores: {},
      reflections: [],
      isMusicPlaying: false,
      totalCorrect: 0,
      totalAnswered: 0,
    };
  },

  init() {
    const saved = localStorage.getItem('spaceAdventureState');
    if (saved) {
      try {
        this._state = { ...this.getDefaultState(), ...JSON.parse(saved) };
      } catch (e) {
        this._state = this.getDefaultState();
      }
    } else {
      this._state = this.getDefaultState();
    }
    // Sync username/kelas from login
    const u = localStorage.getItem('username');
    const k = localStorage.getItem('kelas');
    if (u) this._state.username = u;
    if (k) this._state.kelas = k;
    this._updateRank();
  },

  get(key) { return key ? this._state[key] :  { ...this._state }; },

  set(updates) {
    Object.assign(this._state, updates);
    this._save();
    this._notify();
  },

  _save() { localStorage.setItem('spaceAdventureState', JSON.stringify(this._state)); },
  subscribe(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn => fn(this._state)); },

  // ============ XP & LEVELING LOGIC ============
  _updateRank() {
    const lvl = this._state.currentLevel;
    if (lvl >= 10) this._state.currentRank = 'Admiral Galaksi';
    else if (lvl >= 7) this._state.currentRank = 'Komandan Bintang';
    else if (lvl >= 5) this._state.currentRank = 'Kapten Galaksi';
    else if (lvl >= 3) this._state.currentRank = 'Navigator Antariksa';
    else this._state.currentRank = 'Kadet Angkasa';
  },

  getXPForLevel(lvl) { return 200 + (lvl - 1) * 100; },

  addXP(baseXP, timeBonus = 0) {
    let xp = baseXP + timeBonus;
    // Combo multiplier
    if (this._state.isOnFire) {
      xp = Math.floor(xp * 1.5);
    }
    this._state.totalXP += xp;

    // Check level up
    let needed = this.getXPForLevel(this._state.currentLevel);
    while (this._state.totalXP >= needed) {
      this._state.totalXP -= needed;
      this._state.currentLevel++;
      needed = this.getXPForLevel(this._state.currentLevel);
    }
    this._updateRank();
    this._save();
    this._notify();
    return xp;
  },

  // ============ COMBO SYSTEM ============
  registerCorrectAnswer() {
    this._state.comboCount++;
    this._state.totalCorrect++;
    this._state.totalAnswered++;
    if (this._state.comboCount >= 3 && !this._state.isOnFire) {
      this._state.isOnFire = true;
    }
    this._save();
    this._notify();
  },

  registerWrongAnswer(questionId) {
    this._state.comboCount = 0;
    this._state.isOnFire = false;
    this._state.totalAnswered++;
    if (!this._state.wrongAttempts[questionId]) {
      this._state.wrongAttempts[questionId] = 0;
    }
    this._state.wrongAttempts[questionId]++;
    this._save();
    this._notify();
    return this._state.wrongAttempts[questionId];
  },

  shouldShowHint(questionId) {
    return (this._state.wrongAttempts[questionId] || 0) > 2;
  },

  resetCombo() {
    this._state.comboCount = 0;
    this._state.isOnFire = false;
    this._save();
    this._notify();
  },

  // ============ MISSION PROGRESS ============
  completeMission(missionId) {
    this._state.lessonProgress[missionId] = true;
    this._save();
    this._notify();
  },

  isMissionUnlocked(missionId) {
    const missions = Object.keys(this._state.lessonProgress);
    const idx = missions.indexOf(missionId);
    if (idx <= 0) return true;
    return this._state.lessonProgress[missions[idx - 1]] === true;
  },

  // ============ BADGES ============
  addBadge(badge) {
    if (!this._state.collectedBadges.includes(badge)) {
      this._state.collectedBadges.push(badge);
      this._save();
      this._notify();
    }
  },

  // ============ REFLECTION ============
  addReflection(text, mood) {
    this._state.reflections.push({ text, mood, date: new Date().toISOString() });
    this._save();
  },

  // ============ RESET ============
  resetAll() {
    localStorage.removeItem('spaceAdventureState');
    localStorage.removeItem('username');
    localStorage.removeItem('kelas');
    this._state = this.getDefaultState();
    this._notify();
  }
};

// Initialize on load
SpaceStore.init();

// ============ AUDIO MANAGER ============
const AudioManager = {
  _ctx: null,
  _bgmGain: null,
  _sfxGain: null,
  _bgmSource: null,
  _isMuted: false,

  init() {
    // Lazy init on user interaction
  },

  _ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._bgmGain = this._ctx.createGain();
      this._bgmGain.gain.value = 0.15;
      this._bgmGain.connect(this._ctx.destination);
      this._sfxGain = this._ctx.createGain();
      this._sfxGain.gain.value = 0.4;
      this._sfxGain.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  },

  playTone(freq, duration = 0.15, type = 'sine') {
    this._ensureContext();
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start();
    osc.stop(this._ctx.currentTime + duration);
  },

  playCorrect() { this.playTone(523, 0.1); setTimeout(() => this.playTone(659, 0.1), 100); setTimeout(() => this.playTone(784, 0.2), 200); },
  playWrong() { this.playTone(200, 0.3, 'sawtooth'); },
  playLevelUp() { [523,659,784,1047].forEach((f,i) => setTimeout(() => this.playTone(f, 0.2), i*120)); },
  playClick() { this.playTone(800, 0.05, 'square'); },

  toggleMute() {
    this._isMuted = !this._isMuted;
    if (this._bgmGain) this._bgmGain.gain.value = this._isMuted ? 0 : 0.15;
    if (this._sfxGain) this._sfxGain.gain.value = this._isMuted ? 0 : 0.4;
    return this._isMuted;
  },

  isMuted() { return this._isMuted; }
};

// ============ UI HELPERS ============
function navigasiHalaman(url) {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.4s ease';
  setTimeout(() => { window.location.href = url; }, 400);
}

function createStarsBackground() {
  const l1 = document.createElement('div'); l1.className = 'stars-layer layer1';
  const l2 = document.createElement('div'); l2.className = 'stars-layer layer2';
  document.body.prepend(l2); document.body.prepend(l1);
}

function renderTopNav(title, showBack = true, backUrl = 'dashboard.html') {
  const nav = document.createElement('nav');
  nav.className = 'top-nav';
  nav.id = 'topNav';
  nav.innerHTML = `
    <div class="nav-left">
      ${showBack ? `<a href="${backUrl}" class="nav-back-btn" onclick="event.preventDefault();navigasiHalaman('${backUrl}')">⬅ Kembali</a>` : ''}
      <span class="nav-title">🚀 ${title}</span>
    </div>
    <div class="nav-right">
      <span style="font-size:0.85rem;color:var(--text-secondary)" id="navXP"></span>
      <button class="btn-music" id="btnMusic" title="Toggle Musik" aria-label="Toggle musik latar">🎵</button>
    </div>`;
  document.body.prepend(nav);
  document.getElementById('btnMusic').addEventListener('click', () => {
    const muted = AudioManager.toggleMute();
    document.getElementById('btnMusic').textContent = muted ? '🔇' : '🎵';
    document.getElementById('btnMusic').classList.toggle('muted', muted);
  });
  updateNavXP();
}

function updateNavXP() {
  const el = document.getElementById('navXP');
  if (el) {
    const s = SpaceStore.get();
    el.textContent = `⚡${s.totalXP} XP | Lv.${s.currentLevel}`;
  }
  // Fire effect
  const nav = document.getElementById('topNav');
  if (nav) {
    nav.classList.toggle('nav-fire', SpaceStore.get('isOnFire'));
  }
}

SpaceStore.subscribe(() => updateNavXP());

function renderXPBar(containerId, currentXP, maxXP) {
  const pct = Math.min(100, (currentXP / maxXP) * 100);
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div class="xp-bar-wrap">
        <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-secondary);margin-top:4px">
          <span>⚡ ${currentXP} XP</span><span>${maxXP} XP</span>
        </div>
      </div>`;
  }
}

function animateCounter(el, from, to, duration = 1000) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function showCelebration(score, onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'celebration-overlay active';
  overlay.innerHTML = `
    <div class="trophy">🏆</div>
    <div style="font-family:'Baloo 2',sans-serif;font-size:1.6rem;color:var(--text-primary);margin:10px 0">Misi Selesai!</div>
    <div class="score-counter" id="celebScore">0</div>
    <div style="color:var(--text-secondary);margin-bottom:20px">Total Poin XP</div>
    <div style="animation:slideDown 1s 1.5s both">
      <button class="btn-gold" id="celebClose">Lanjutkan 🚀</button>
    </div>`;
  document.body.appendChild(overlay);
  AudioManager.playLevelUp();
  setTimeout(() => {
    animateCounter(document.getElementById('celebScore'), 0, score, 1500);
  }, 600);
  document.getElementById('celebClose').addEventListener('click', () => {
    overlay.remove();
    if (onClose) onClose();
  });
}

// Page load transition
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.5s ease';
    document.body.style.opacity = '1';
  });
  createStarsBackground();
});