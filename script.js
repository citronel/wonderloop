const root = document.documentElement;

const canvas = document.getElementById('artboard');
const ctx = canvas.getContext('2d');

const paletteSwatches = document.getElementById('paletteSwatches');
const presetGallery = document.getElementById('presetGallery');
const favoritesList = document.getElementById('favoritesList');
const favoritesEmpty = document.getElementById('favoritesEmpty');
const toast = document.getElementById('toast');

const navButtons = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel');
const pauseBtn = document.getElementById('pauseBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const createUniverseBtn = document.getElementById('createUniverseBtn');
const surpriseBtn = document.getElementById('surpriseBtn');
const saveFavoriteBtn = document.getElementById('saveFavoriteBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const shufflePresetBtn = document.getElementById('shufflePresetBtn');

const densityEl = document.getElementById('density');
const speedEl = document.getElementById('speed');
const glowEl = document.getElementById('glow');
const linkDistanceEl = document.getElementById('linkDistance');
const motionEl = document.getElementById('motion');

const densityValue = document.getElementById('densityValue');
const speedValue = document.getElementById('speedValue');
const glowValue = document.getElementById('glowValue');
const linkDistanceValue = document.getElementById('linkDistanceValue');
const motionValue = document.getElementById('motionValue');

const STORAGE_KEY = 'wonderloop.favorites';

const paletteLibrary = {
  ember: {
    name: 'Ember',
    colors: ['#ff9f6e', '#ffd166', '#ff5ea8', '#7a5cff'],
    accent: '#ffb38a',
    accent2: '#ff71c3'
  },
  aurora: {
    name: 'Aurora',
    colors: ['#7ef9d7', '#63c7ff', '#a780ff', '#ff89d5'],
    accent: '#7ef9d7',
    accent2: '#a780ff'
  },
  ocean: {
    name: 'Ocean',
    colors: ['#58d9ff', '#3db0ff', '#7efae4', '#b1f0ff'],
    accent: '#58d9ff',
    accent2: '#7efae4'
  },
  dream: {
    name: 'Dream',
    colors: ['#ffc3ff', '#d9a5ff', '#9ad7ff', '#f7c4a5'],
    accent: '#ffc3ff',
    accent2: '#9ad7ff'
  },
  neon: {
    name: 'Neon',
    colors: ['#77f7ff', '#7a7dff', '#ff5bd8', '#d3ff72'],
    accent: '#77f7ff',
    accent2: '#ff5bd8'
  },
  sunset: {
    name: 'Sunset',
    colors: ['#f8b4a0', '#ff7a59', '#ff9ae2', '#9db0ff'],
    accent: '#f8b4a0',
    accent2: '#ff9ae2'
  }
};

const presetLibrary = {
  Cosmic: {
    label: 'Cosmic',
    note: 'Deep space drift',
    palette: 'ember',
    density: 96,
    speed: 1.2,
    glow: 1.3,
    linkDistance: 116,
    motion: 1.1,
    description: 'Dense/slow orbiting core'
  },
  Aurora: {
    label: 'Aurora',
    note: 'Icy light bloom',
    palette: 'aurora',
    density: 88,
    speed: 1.0,
    glow: 1.5,
    linkDistance: 130,
    motion: 1.3,
    description: 'Luminous polar ribbons'
  },
  Ocean: {
    label: 'Ocean',
    note: 'Glass-depth currents',
    palette: 'ocean',
    density: 110,
    speed: 1.4,
    glow: 1.1,
    linkDistance: 140,
    motion: 1.2,
    description: 'Fluid wave motion'
  },
  Dream: {
    label: 'Dream',
    note: 'Soft rose fog',
    palette: 'dream',
    density: 82,
    speed: 0.9,
    glow: 1.8,
    linkDistance: 98,
    motion: 0.9,
    description: 'Dreamlike haze and bloom'
  },
  Neon: {
    label: 'Neon',
    note: 'Electric pulse',
    palette: 'neon',
    density: 118,
    speed: 1.7,
    glow: 1.6,
    linkDistance: 124,
    motion: 1.7,
    description: 'High-energy signal map'
  }
};

const defaultState = {
  presetName: 'Cosmic',
  paletteName: 'ember',
  density: 96,
  speed: 1.2,
  glow: 1.3,
  linkDistance: 116,
  motion: 1.1,
  paused: false,
  randomSeed: Math.random() * 10000,
  pointer: {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    active: false,
    radius: 180
  }
};

const state = { ...defaultState };
const particles = [];
let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;
let animationFrameId = null;
let lastFrame = 0;
let lastToastTimeout = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeLocalStorageGet() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.warn('Unable to read saved universes:', error);
    return [];
  }
}

function safeLocalStorageSet(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Unable to write saved universes:', error);
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(lastToastTimeout);
  lastToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

function setThemeColors(paletteName) {
  const palette = paletteLibrary[paletteName] || paletteLibrary.ember;
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-2', palette.accent2);
  root.style.setProperty('--shadow-glow', `${palette.accent}66`);
}

function updateControlReadouts() {
  densityValue.textContent = String(Math.round(state.density));
  speedValue.textContent = `${Number(state.speed).toFixed(1)}x`;
  glowValue.textContent = Number(state.glow).toFixed(1);
  linkDistanceValue.textContent = String(Math.round(state.linkDistance));
  motionValue.textContent = Number(state.motion).toFixed(1);
}

function syncControlsToState() {
  densityEl.value = String(state.density);
  speedEl.value = String(state.speed);
  glowEl.value = String(state.glow);
  linkDistanceEl.value = String(state.linkDistance);
  motionEl.value = String(state.motion);
  updateControlReadouts();
}

function applyPreset(presetName, options = {}) {
  const preset = presetLibrary[presetName] || presetLibrary.Cosmic;
  const paletteName = options.paletteName || preset.palette;

  state.presetName = presetName;
  state.paletteName = paletteName;
  state.density = options.density ?? preset.density;
  state.speed = options.speed ?? preset.speed;
  state.glow = options.glow ?? preset.glow;
  state.linkDistance = options.linkDistance ?? preset.linkDistance;
  state.motion = options.motion ?? preset.motion;
  state.randomSeed = Math.random() * 10000;

  setThemeColors(paletteName);
  syncControlsToState();
  rebuildParticles();
  updatePresetSelection();
  renderPaletteSelection();
}

function buildPaletteSwatches() {
  paletteSwatches.innerHTML = '';
  Object.entries(paletteLibrary).forEach(([key, palette]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette-swatch';
    button.setAttribute('aria-label', `${palette.name} palette`);
    button.style.background = `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]} 45%, ${palette.colors[2]} 70%, ${palette.colors[3]})`;
    button.dataset.palette = key;
    if (state.paletteName === key) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      state.paletteName = key;
      setThemeColors(key);
      renderPaletteSelection();
      rebuildParticles();
      showToast(`${palette.name} palette selected`);
    });
    paletteSwatches.appendChild(button);
  });
}

function renderPaletteSelection() {
  [...paletteSwatches.children].forEach((button) => {
    const isActive = button.dataset.palette === state.paletteName;
    button.classList.toggle('active', isActive);
  });
}

function updatePresetSelection() {
  const presetButtons = document.querySelectorAll('.preset-card');
  presetButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === state.presetName);
  });
}

function renderPresetGallery() {
  presetGallery.innerHTML = '';
  Object.entries(presetLibrary).forEach(([name, preset]) => {
    const palette = paletteLibrary[preset.palette];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-card';
    button.dataset.preset = name;
    if (name === state.presetName) {
      button.classList.add('active');
    }
    button.innerHTML = `
      <div class="preset-preview" style="background: linear-gradient(135deg, ${palette.colors[0]}22, ${palette.colors[1]}44 38%, ${palette.colors[2]}22 100%);"></div>
      <div class="preset-meta">
        <span class="preset-name">${preset.label}</span>
        <span class="preset-note">${preset.note}</span>
      </div>
      <span class="preset-pill">${preset.description}</span>
    `;

    button.addEventListener('click', () => {
      applyPreset(name);
      showToast(`${name} preset activated`);
    });

    presetGallery.appendChild(button);
  });
}

function loadFavorites() {
  const favorites = safeLocalStorageGet();
  favoritesList.innerHTML = '';

  if (!favorites.length) {
    favoritesEmpty.classList.add('visible');
    return;
  }

  favoritesEmpty.classList.remove('visible');

  favorites.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'favorite-card';
    card.innerHTML = `
      <div>
        <div class="favorite-title">${entry.name}</div>
        <div class="favorite-sub">${entry.paletteName.toUpperCase()} • ${entry.density} particles</div>
      </div>
      <div class="favorite-actions">
        <button class="favorite-load" type="button" data-id="${entry.id}">Load</button>
        <button class="favorite-delete" type="button" data-id="${entry.id}">Delete</button>
      </div>
    `;

    card.querySelector('.favorite-load').addEventListener('click', () => {
      applyFavorite(entry);
    });

    card.querySelector('.favorite-delete').addEventListener('click', () => {
      deleteFavorite(entry.id);
    });

    favoritesList.appendChild(card);
  });
}

function applyFavorite(entry) {
  state.paletteName = entry.paletteName;
  state.density = entry.density;
  state.speed = entry.speed;
  state.glow = entry.glow;
  state.linkDistance = entry.linkDistance;
  state.motion = entry.motion;
  state.presetName = entry.presetName;
  setThemeColors(entry.paletteName);
  syncControlsToState();
  renderPaletteSelection();
  renderPresetGallery();
  rebuildParticles();
  showToast(`Loaded ${entry.name}`);
}

function getFavorites() {
  return safeLocalStorageGet();
}

function saveCurrentUniverse() {
  try {
    const favorites = getFavorites();
    const newEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `universe-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: `${state.presetName} ${favorites.length + 1}`,
      paletteName: state.paletteName,
      density: state.density,
      speed: state.speed,
      glow: state.glow,
      linkDistance: state.linkDistance,
      motion: state.motion,
      presetName: state.presetName,
      savedAt: Date.now()
    };

    favorites.unshift(newEntry);
    const didSave = safeLocalStorageSet(favorites.slice(0, 12));
    if (!didSave) {
      showToast('Storage unavailable');
      return;
    }
    loadFavorites();
    showToast('Universe saved');
  } catch (error) {
    console.error('Unable to save universe:', error);
    showToast('Save failed');
  }
}

function deleteFavorite(id) {
  try {
    const favorites = getFavorites().filter((entry) => entry.id !== id);
    const didSave = safeLocalStorageSet(favorites);
    if (!didSave) {
      showToast('Storage unavailable');
      return;
    }
    loadFavorites();
    showToast('Universe deleted');
  } catch (error) {
    console.error('Unable to delete favorite:', error);
    showToast('Delete failed');
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createRandomUniverse() {
  const presetNames = Object.keys(presetLibrary);
  const targetPreset = presetNames[Math.floor(Math.random() * presetNames.length)];
  const paletteKeys = Object.keys(paletteLibrary);
  const targetPalette = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];

  const nextState = {
    presetName: targetPreset,
    paletteName: targetPalette,
    density: Math.round(randomBetween(52, 150)),
    speed: Number(randomBetween(0.5, 2.2).toFixed(1)),
    glow: Number(randomBetween(0.7, 2.0).toFixed(1)),
    linkDistance: Math.round(randomBetween(75, 200)),
    motion: Number(randomBetween(0.6, 2.0).toFixed(1))
  };

  Object.assign(state, nextState);
  setThemeColors(state.paletteName);
  syncControlsToState();
  renderPaletteSelection();
  renderPresetGallery();
  rebuildParticles();
  showToast('New universe generated');
}

function surpriseMe() {
  const paletteKeys = Object.keys(paletteLibrary);
  const presetNames = Object.keys(presetLibrary);

  state.presetName = presetNames[Math.floor(Math.random() * presetNames.length)];
  state.paletteName = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
  state.density = Math.round(randomBetween(60, 170));
  state.speed = Number(randomBetween(0.7, 2.3).toFixed(1));
  state.glow = Number(randomBetween(0.8, 2.1).toFixed(1));
  state.linkDistance = Math.round(randomBetween(80, 180));
  state.motion = Number(randomBetween(0.7, 2.0).toFixed(1));
  state.randomSeed = Math.random() * 10000;

  setThemeColors(state.paletteName);
  syncControlsToState();
  renderPresetGallery();
  renderPaletteSelection();
  rebuildParticles();
  showToast('Surprise generated');
}

function resetUniverse() {
  const matchingPreset = presetLibrary[state.presetName] || presetLibrary.Cosmic;
  state.paletteName = matchingPreset.palette;
  state.density = matchingPreset.density;
  state.speed = matchingPreset.speed;
  state.glow = matchingPreset.glow;
  state.linkDistance = matchingPreset.linkDistance;
  state.motion = matchingPreset.motion;
  setThemeColors(state.paletteName);
  syncControlsToState();
  renderPaletteSelection();
  renderPresetGallery();
  rebuildParticles();
  showToast('Universe reset');
}

function setPanel(name) {
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === name);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === name);
  });
}

function setCanvasSize() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rebuildParticles();
}

function rebuildParticles() {
  const palette = paletteLibrary[state.paletteName] || paletteLibrary.ember;
  const count = clamp(Math.round((state.density / 100) * 120), 30, 220);
  particles.length = 0;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const orbit = 6 + Math.random() * 110;
    const velocity = 0.38 + Math.random() * 1.4;
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.9,
      vy: (Math.random() - 0.5) * 0.9,
      size: 1.2 + Math.random() * 3.2,
      alpha: 0.3 + Math.random() * 0.8,
      color: palette.colors[i % palette.colors.length],
      orbitRadius: orbit,
      orbitAngle: angle,
      drift: velocity,
      pulse: Math.random() * Math.PI * 2,
      twinkle: Math.random() * 2
    });
  }
}

function drawBackground() {
  const grad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    10,
    width * 0.5,
    height * 0.38,
    Math.max(width, height) * 0.85
  );

  grad.addColorStop(0, 'rgba(255,255,255,0.03)');
  grad.addColorStop(0.2, 'rgba(111,232,255,0.05)');
  grad.addColorStop(0.55, 'rgba(217,165,255,0.04)');
  grad.addColorStop(1, 'rgba(5,8,16,0.06)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawNebula() {
  const palette = paletteLibrary[state.paletteName] || paletteLibrary.ember;
  const hue1 = palette.colors[0];
  const hue2 = palette.colors[2];
  const nebula = ctx.createRadialGradient(
    width * 0.75,
    height * 0.25,
    20,
    width * 0.75,
    height * 0.25,
    Math.max(width, height) * 0.7
  );

  nebula.addColorStop(0, `${hue1}25`);
  nebula.addColorStop(0.4, `${hue2}18`);
  nebula.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, width, height);
}

function drawConnections() {
  const maxDistance = state.linkDistance;

  for (let i = 0; i < particles.length; i += 1) {
    const p1 = particles[i];
    for (let j = i + 1; j < particles.length; j += 1) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < maxDistance) {
        const alpha = (1 - distance / maxDistance) * 0.32;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(160, 230, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  const palette = paletteLibrary[state.paletteName] || paletteLibrary.ember;
  const pulseScale = state.glow;
  const motionFactor = state.motion;
  const speedFactor = state.speed;
  const hiddenFactor = document.hidden ? 0.18 : 1;

  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];

    p.orbitAngle += 0.0024 * speedFactor * motionFactor;
    p.pulse += 0.03 * speedFactor;

    const orbitX = Math.cos(p.orbitAngle) * p.orbitRadius * 0.18;
    const orbitY = Math.sin(p.orbitAngle * 1.7) * p.orbitRadius * 0.12;

    p.vx += (Math.random() - 0.5) * 0.06 * motionFactor;
    p.vy += (Math.random() - 0.5) * 0.06 * motionFactor;

    if (state.pointer.active) {
      const dx = p.x - state.pointer.x;
      const dy = p.y - state.pointer.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < state.pointer.radius * state.pointer.radius) {
        const dist = Math.sqrt(distSq) || 1;
        const force = (1 - dist / state.pointer.radius) * 0.7;
        p.vx += (dx / dist) * force * 0.4;
        p.vy += (dy / dist) * force * 0.4;
      }
    }

    p.x += (p.vx + orbitX + Math.sin(p.pulse) * 0.5) * speedFactor * motionFactor * hiddenFactor;
    p.y += (p.vy + orbitY + Math.cos(p.pulse * 1.4) * 0.55) * speedFactor * motionFactor * hiddenFactor;

    if (p.x < -40) p.x = width + 40;
    if (p.x > width + 40) p.x = -40;
    if (p.y < -40) p.y = height + 40;
    if (p.y > height + 40) p.y = -40;

    const twinkle = 0.35 + Math.sin((p.pulse + p.twinkle) * 2) * 0.5;
    const color = p.color || palette.colors[0];
    const bloom = clamp(p.alpha + twinkle * 0.4, 0.2, 1);

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.globalAlpha = bloom * pulseScale;
    ctx.shadowBlur = 18 * pulseScale;
    ctx.shadowColor = color;
    ctx.arc(p.x, p.y, p.size * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.globalAlpha = 0.45;
    ctx.arc(p.x + p.size * 0.25, p.y - p.size * 0.24, p.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function renderFrame(timestamp) {
  const delta = timestamp - lastFrame || 16;
  lastFrame = timestamp;

  if (!state.paused) {
    ctx.clearRect(0, 0, width, height);
    drawBackground();
    drawNebula();
    drawConnections();
    animateParticles();
  }

  animationFrameId = requestAnimationFrame(renderFrame);
}

function updateStateFromInputs() {
  state.density = Number(densityEl.value);
  state.speed = Number(speedEl.value);
  state.glow = Number(glowEl.value);
  state.linkDistance = Number(linkDistanceEl.value);
  state.motion = Number(motionEl.value);
  updateControlReadouts();
  rebuildParticles();
}

function attachEvents() {
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setPanel(button.dataset.target);
    });
  });

  densityEl.addEventListener('input', updateStateFromInputs);
  speedEl.addEventListener('input', updateStateFromInputs);
  glowEl.addEventListener('input', updateStateFromInputs);
  linkDistanceEl.addEventListener('input', updateStateFromInputs);
  motionEl.addEventListener('input', updateStateFromInputs);

  pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-label', state.paused ? 'Resume artwork' : 'Pause artwork');
    showToast(state.paused ? 'Artwork paused' : 'Artwork resumed');
  });

  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        showToast('Fullscreen enabled');
      } else {
        await document.exitFullscreen();
        showToast('Fullscreen closed');
      }
    } catch (error) {
      console.warn('Unable to toggle fullscreen:', error);
      showToast('Fullscreen unavailable');
    }
  });

  createUniverseBtn.addEventListener('click', createRandomUniverse);
  surpriseBtn.addEventListener('click', surpriseMe);
  saveFavoriteBtn.addEventListener('click', saveCurrentUniverse);
  resetBtn.addEventListener('click', resetUniverse);
  shufflePresetBtn.addEventListener('click', () => {
    const names = Object.keys(presetLibrary);
    const picked = names[Math.floor(Math.random() * names.length)];
    applyPreset(picked);
    showToast(`${picked} shuffled`);
  });

  downloadBtn.addEventListener('click', () => {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'wonderloop-universe.png';
      link.click();
      showToast('Artwork exported');
    } catch (error) {
      console.error('Image export failed:', error);
      showToast('Export failed');
    }
  });

  window.addEventListener('resize', setCanvasSize);
  window.addEventListener('pointermove', (event) => {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.active = true;
  });
  window.addEventListener('pointerdown', (event) => {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.active = true;
  });
  window.addEventListener('pointerleave', () => {
    state.pointer.active = false;
  });

  window.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    state.pointer.x = touch.clientX;
    state.pointer.y = touch.clientY;
    state.pointer.active = true;
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    state.pointer.x = touch.clientX;
    state.pointer.y = touch.clientY;
    state.pointer.active = true;
  }, { passive: true });

  window.addEventListener('touchend', () => {
    state.pointer.active = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      showToast('Animation eased for battery');
    }
  });
}

function initialize() {
  setThemeColors(state.paletteName);
  applyPreset('Cosmic');
  buildPaletteSwatches();
  renderPresetGallery();
  loadFavorites();
  setCanvasSize();
  syncControlsToState();
  attachEvents();
  renderFrame(0);
}

initialize();
