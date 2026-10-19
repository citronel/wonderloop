import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const appMeta = {
  settings: { label: 'Settings', icon: '⚙️' },
  notes: { label: 'Notes', icon: '📝' },
  calculator: { label: 'Calculator', icon: '🧮' },
  gallery: { label: 'Gallery', icon: '🖼️' },
  wallpaper: { label: 'Wallpaper Studio', icon: '🎨' },
  control: { label: 'Control Center', icon: '🕹️' },
  search: { label: 'Search', icon: '🔎' },
  notifications: { label: 'Notifications', icon: '🔔' }
};

const appOrder = Object.keys(appMeta);
const paletteSwatches = ['#74d9ff', '#b38cff', '#ff9bd1', '#7ef0d5', '#ffd97a'];
const wallpaperPresets = [
  { id: 'aurora', label: 'Aurora', colors: ['#74d9ff', '#b38cff', '#ff9bd1', '#070d18'] },
  { id: 'ocean', label: 'Ocean', colors: ['#6fe8ff', '#7ef0d5', '#8db6ff', '#051821'] },
  { id: 'ember', label: 'Ember', colors: ['#ff9b73', '#ffd86a', '#ff67b5', '#170d12'] },
  { id: 'dream', label: 'Dream', colors: ['#ffd2f8', '#b5a3ff', '#9fe4ff', '#130d20'] },
  { id: 'nova', label: 'Nova', colors: ['#7fe7ff', '#9fbbff', '#e5b6ff', '#07131d'] }
];

const defaults = {
  accent: '#74d9ff',
  accentAlt: '#b38cff',
  wallpaper: 'aurora',
  glass: 72,
  bright: 72,
  volume: 52,
  darkMode: true,
  reducedMotion: false,
  performance: false
};

const storage = {
  settings: 'wonderos.settings.v1',
  notes: 'wonderos.notes.v1',
  wall: 'wonderos.wallpaper.v1',
  notifications: 'wonderos.notifications.v1'
};

const state = {
  settings: { ...defaults, ...readJSON(storage.settings, {}) },
  notes: readJSON(storage.notes, [{ id: crypto.randomUUID ? crypto.randomUUID() : 'note-1', title: 'Welcome', content: 'WonderOS is ready. Keep your ideas and customizations close.' }]),
  notifications: readJSON(storage.notifications, [{ id: 'n1', message: 'System ready. Ambient motion is online.', tone: 'info', when: Date.now() }]),
  wallpaper: readJSON(storage.wall, 'aurora'),
  selectedNoteId: null,
  windows: [],
  activeWindowId: null,
  launcherOpen: false,
  notificationsOpen: false,
  calcValue: '0',
  searchQuery: ''
};

if (!state.selectedNoteId && state.notes.length) state.selectedNoteId = state.notes[0].id;
if (!state.settings.accent) state.settings.accent = defaults.accent;
if (!state.settings.accentAlt) state.settings.accentAlt = defaults.accentAlt;

const canvas = document.getElementById('threeCanvas');
const dockEl = document.getElementById('dock');
const launcherPanel = document.getElementById('launcherPanel');
const launcherGrid = document.getElementById('launcherGrid');
const notificationCenter = document.getElementById('notificationCenter');
const toastLayer = document.getElementById('toastLayer');
const widgetStack = document.getElementById('widgetStack');
const homeScreen = document.getElementById('homeScreen');
const windowLayer = document.getElementById('windowLayer');
const fallback = document.getElementById('fallback');
const clockText = document.getElementById('clockText');
const dateText = document.getElementById('dateText');

let renderer;
let scene;
let camera;
let glassCore;
let innerCore;
let ringGroup;
let pointer = { x: 0, y: 0 };
let webglReady = false;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Storage unavailable', error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Storage write failed', error);
    return false;
  }
}

function persistSettings() {
  writeJSON(storage.settings, state.settings);
}

function persistNotes() {
  writeJSON(storage.notes, state.notes);
}

function persistWallpaper() {
  writeJSON(storage.wall, state.wallpaper);
}

function persistNotifications() {
  writeJSON(storage.notifications, state.notifications.slice(0, 8));
}

function updateTheme() {
  const root = document.documentElement;
  root.style.setProperty('--accent', state.settings.accent);
  root.style.setProperty('--accent-2', state.settings.accentAlt);
  root.style.setProperty('--glass', (state.settings.glass / 100).toFixed(2));

  if (document.body) {
    document.body.style.background = state.settings.darkMode
      ? 'radial-gradient(circle at 20% 20%, rgba(132, 192, 255, 0.16), transparent 24%), radial-gradient(circle at 72% 18%, rgba(179, 140, 255, 0.12), transparent 24%), linear-gradient(180deg, var(--bg-0), var(--bg-1) 48%, #070b15)'
      : 'radial-gradient(circle at 20% 20%, rgba(172, 198, 255, 0.18), transparent 20%), linear-gradient(180deg, #edf5ff, #dfe9ff 42%, #d0dbef 100%)';
    document.body.style.color = state.settings.darkMode ? '#ebf7ff' : '#0f1d2d';
  }

  if (glassCore) {
    glassCore.material.color.set(state.settings.accent);
  }
  if (innerCore) {
    innerCore.material.emissive.set(state.settings.accentAlt);
  }
}

function updateClock() {
  const now = new Date();
  clockText.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  dateText.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderWidgets() {
  const widgets = [
    { label: 'Aura', value: `${state.settings.bright}%`, detail: 'Ambient clarity' },
    { label: 'Flow', value: `${state.settings.volume}%`, detail: 'System pulse' },
    { label: 'Notes', value: `${state.notes.length}`, detail: 'Saved drafts' }
  ];

  widgetStack.innerHTML = widgets.map(widget => `
    <article class="widget glass-panel">
      <small>${widget.label}</small>
      <strong>${widget.value}</strong>
      <p>${widget.detail}</p>
    </article>
  `).join('');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastLayer.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}

function pushNotification(message, tone = 'info') {
  state.notifications.unshift({ id: `${Date.now()}-${Math.random()}`, message, tone, when: Date.now() });
  state.notifications = state.notifications.slice(0, 8);
  persistNotifications();
  renderNotifications();
}

function renderNotifications() {
  notificationCenter.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
      <strong>Notifications</strong>
      <button class="ghost-btn" type="button" id="closeNotifications">Close</button>
    </div>
    <div class="notification-list">
      ${state.notifications.length ? state.notifications.map(item => `
        <div class="notification-item ${item.tone}">
          <div>${item.message}</div>
          <small style="color: var(--muted); font-size: 0.68rem;">${new Date(item.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
        </div>
      `).join('') : '<div class="empty-state">No notifications yet.</div>'}
    </div>
  `;

  const closeBtn = document.getElementById('closeNotifications');
  if (closeBtn) closeBtn.addEventListener('click', () => toggleNotifications());
}

function toggleNotifications() {
  state.notificationsOpen = !state.notificationsOpen;
  notificationCenter.classList.toggle('hidden', !state.notificationsOpen);
}

function renderDock() {
  dockEl.innerHTML = appOrder.map(appId => `
    <button class="dock-item" type="button" data-app="${appId}" aria-label="${appMeta[appId].label}">${appMeta[appId].icon}</button>
  `).join('');

  dockEl.querySelectorAll('[data-app]').forEach(button => {
    button.addEventListener('click', () => openApp(button.dataset.app));
  });
}

function renderLauncher() {
  const query = state.searchQuery.trim().toLowerCase();
  const apps = appOrder.filter(appId => {
    const label = appMeta[appId].label.toLowerCase();
    return !query || label.includes(query);
  });

  launcherGrid.innerHTML = apps.length ? apps.map(appId => `
    <button class="launcher-item" type="button" data-app="${appId}">
      <span class="launcher-icon">${appMeta[appId].icon}</span>
      <span>
        <strong>${appMeta[appId].label}</strong>
        <span>System app</span>
      </span>
    </button>
  `).join('') : '<div class="empty-state" style="grid-column:1 / -1; min-height:80px;">No matches found.</div>';

  launcherGrid.querySelectorAll('[data-app]').forEach(button => {
    button.addEventListener('click', () => {
      openApp(button.dataset.app);
      state.searchQuery = '';
      launcherPanel.classList.add('hidden');
      state.launcherOpen = false;
      document.getElementById('launcherSearch').value = '';
    });
  });
}

function toggleLauncher() {
  state.launcherOpen = !state.launcherOpen;
  launcherPanel.classList.toggle('hidden', !state.launcherOpen);
  if (state.launcherOpen) {
    renderLauncher();
    const input = document.getElementById('launcherSearch');
    if (input) {
      input.focus();
      input.value = state.searchQuery;
    }
  }
}

function openApp(appId) {
  const existing = state.windows.find(win => win.id === appId);
  if (existing) {
    existing.element.classList.remove('minimized');
    focusWindow(appId);
    return;
  }

  const win = document.createElement('section');
  win.className = 'app-window';
  win.style.left = `${20 + state.windows.length * 28}px`;
  win.style.top = `${110 + state.windows.length * 24}px`;
  win.style.zIndex = String(30 + state.windows.length);
  win.innerHTML = `
    <div class="window-header" data-handle>
      <div class="window-title"><span class="window-icon">${appMeta[appId].icon}</span>${appMeta[appId].label}</div>
      <div class="window-controls">
        <button class="window-control minimize" type="button" data-action="minimize" data-id="${appId}" aria-label="Minimize"></button>
        <button class="window-control maximize" type="button" data-action="maximize" data-id="${appId}" aria-label="Maximize"></button>
        <button class="window-control close" type="button" data-action="close" data-id="${appId}" aria-label="Close"></button>
      </div>
    </div>
    <div class="window-content"></div>
  `;

  const winData = { id: appId, element: win, open: true, x: 20 + state.windows.length * 28, y: 110 + state.windows.length * 24, maximized: false };
  state.windows.push(winData);
  state.activeWindowId = appId;
  windowLayer.appendChild(win);

  const list = win.querySelectorAll('[data-action]');
  list.forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === 'close') closeWindow(id);
      if (action === 'minimize') minimizeWindow(id);
      if (action === 'maximize') maximizeWindow(id);
    });
  });

  const dragHandle = win.querySelector('[data-handle]');
  let dragging = null;
  dragHandle.addEventListener('pointerdown', (event) => {
    dragging = { x: event.clientX - win.offsetLeft, y: event.clientY - win.offsetTop };
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    win.style.left = `${Math.max(12, Math.min(window.innerWidth - win.offsetWidth - 12, dx))}px`;
    win.style.top = `${Math.max(90, Math.min(window.innerHeight - win.offsetHeight - 18, dy))}px`;
  });
  window.addEventListener('pointerup', () => { dragging = null; });

  renderApp(appId, win.querySelector('.window-content'));
  focusWindow(appId);
}

function focusWindow(appId) {
  state.activeWindowId = appId;
  state.windows.forEach(entry => {
    entry.element.style.zIndex = entry.id === appId ? '40' : String(30 + state.windows.indexOf(entry));
  });
}

function closeWindow(appId) {
  const win = state.windows.find(entry => entry.id === appId);
  if (!win) return;
  win.element.remove();
  state.windows = state.windows.filter(entry => entry.id !== appId);
  state.activeWindowId = state.windows[state.windows.length - 1]?.id ?? null;
}

function minimizeWindow(appId) {
  const win = state.windows.find(entry => entry.id === appId);
  if (!win) return;
  win.element.classList.add('minimized');
  state.activeWindowId = null;
}

function maximizeWindow(appId) {
  const win = state.windows.find(entry => entry.id === appId);
  if (!win) return;
  win.maximized = !win.maximized;
  if (win.maximized) {
    win.element.style.width = 'calc(100vw - 28px)';
    win.element.style.height = 'calc(100vh - 120px)';
    win.element.style.left = '14px';
    win.element.style.top = '82px';
  } else {
    win.element.style.width = 'min(760px, 82vw)';
    win.element.style.height = 'min(540px, 68vh)';
    win.element.style.left = `${win.x}px`;
    win.element.style.top = `${win.y}px`;
  }
}

function renderApp(appId, target) {
  if (appId === 'settings') {
    target.innerHTML = `
      <div class="window-section">
        <h3>Appearance</h3>
        <div class="accent-grid">
          ${paletteSwatches.map(color => `
            <button type="button" class="accent-swatch ${state.settings.accent === color ? 'active' : ''}" data-accent="${color}" style="background: linear-gradient(135deg, ${color}, ${color}cc);"></button>
          `).join('')}
        </div>
      </div>
      <div class="window-section">
        <div class="form-field">
          <label>Wallpaper</label>
          <select id="wallpaperSelect">
            ${wallpaperPresets.map(p => `<option value="${p.id}" ${state.wallpaper === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Glass intensity</label>
          <input id="glassRange" type="range" min="35" max="100" value="${state.settings.glass}" />
        </div>
        <div class="form-field">
          <label>Brightness</label>
          <input id="brightRange" type="range" min="20" max="100" value="${state.settings.bright}" />
        </div>
        <div class="form-field">
          <label>Volume</label>
          <input id="volumeRange" type="range" min="0" max="100" value="${state.settings.volume}" />
        </div>
      </div>
      <div class="window-section">
        <div class="segmented">
          <button type="button" class="segment-item ${state.settings.darkMode ? 'active' : ''}" data-theme="dark">Dark</button>
          <button type="button" class="segment-item ${!state.settings.darkMode ? 'active' : ''}" data-theme="light">Light</button>
          <button type="button" class="segment-item ${state.settings.reducedMotion ? 'active' : ''}" data-motion="toggle">Reduced motion</button>
          <button type="button" class="segment-item ${state.settings.performance ? 'active' : ''}" data-performance="toggle">Performance</button>
        </div>
      </div>
      <div class="button-row">
        <button type="button" class="primary-btn" id="saveSettings">Save preferences</button>
        <button type="button" class="secondary-btn" id="resetSettings">Reset defaults</button>
      </div>
    `;

    target.querySelectorAll('[data-accent]').forEach(button => {
      button.addEventListener('click', () => {
        state.settings.accent = button.dataset.accent;
        state.settings.accentAlt = paletteSwatches[(paletteSwatches.indexOf(button.dataset.accent) + 2) % paletteSwatches.length];
        updateTheme();
        renderApp('settings', target);
      });
    });

    target.querySelector('#wallpaperSelect').addEventListener('change', (event) => {
      state.wallpaper = event.target.value;
      persistWallpaper();
      applyWallpaperPreset();
      pushNotification(`Wallpaper set to ${event.target.value}`, 'success');
    });

    target.querySelector('#glassRange').addEventListener('input', (event) => {
      state.settings.glass = Number(event.target.value);
      updateTheme();
    });
    target.querySelector('#brightRange').addEventListener('input', (event) => {
      state.settings.bright = Number(event.target.value);
      renderWidgets();
    });
    target.querySelector('#volumeRange').addEventListener('input', (event) => {
      state.settings.volume = Number(event.target.value);
      renderWidgets();
    });

    target.querySelectorAll('[data-theme]').forEach(button => {
      button.addEventListener('click', () => {
        state.settings.darkMode = button.dataset.theme === 'dark';
        updateTheme();
        renderApp('settings', target);
      });
    });

    target.querySelectorAll('[data-motion]').forEach(button => {
      button.addEventListener('click', () => {
        state.settings.reducedMotion = !state.settings.reducedMotion;
        renderApp('settings', target);
      });
    });

    target.querySelectorAll('[data-performance]').forEach(button => {
      button.addEventListener('click', () => {
        state.settings.performance = !state.settings.performance;
        renderApp('settings', target);
      });
    });

    target.querySelector('#saveSettings').addEventListener('click', () => {
      persistSettings();
      showToast('Settings saved');
      pushNotification('Preferences saved locally', 'success');
    });

    target.querySelector('#resetSettings').addEventListener('click', () => {
      Object.assign(state.settings, defaults);
      persistSettings();
      updateTheme();
      renderWidgets();
      renderApp('settings', target);
      pushNotification('Defaults restored', 'warning');
    });
    return;
  }

  if (appId === 'notes') {
    const selected = state.notes.find(note => note.id === state.selectedNoteId) || state.notes[0];
    target.innerHTML = `
      <div class="window-grid">
        <div class="window-section">
          <div class="form-field">
            <label>Search notes</label>
            <input id="noteSearch" type="search" placeholder="Search..." />
          </div>
          <div id="noteList" class="list-panel"></div>
        </div>
        <div class="window-section">
          <div class="form-field">
            <label>Title</label>
            <input id="noteTitle" type="text" value="${selected ? escapeHtml(selected.title) : ''}" />
          </div>
          <div class="form-field">
            <label>Body</label>
            <textarea id="noteBody">${selected ? escapeHtml(selected.content) : ''}</textarea>
          </div>
          <div class="button-row">
            <button class="primary-btn" type="button" id="saveNote">Save</button>
            <button class="secondary-btn" type="button" id="newNote">New</button>
            <button class="ghost-btn" type="button" id="deleteNote">Delete</button>
          </div>
        </div>
      </div>
    `;

    function renderNoteList(filter = '') {
      const filtered = state.notes.filter(note => {
        const term = filter.trim().toLowerCase();
        if (!term) return true;
        return note.title.toLowerCase().includes(term) || note.content.toLowerCase().includes(term);
      });

      const list = document.getElementById('noteList');
      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">No notes yet.</div>';
        return;
      }
      list.innerHTML = filtered.map(note => `
        <button type="button" class="note-item ${state.selectedNoteId === note.id ? 'active' : ''}" data-id="${note.id}">
          <span class="glyph-badge">📝</span>
          <span class="note-meta">
            <strong>${escapeHtml(note.title)}</strong>
            <small>${escapeHtml(note.content.slice(0, 52) || 'Empty note')}</small>
          </span>
        </button>
      `).join('');

      list.querySelectorAll('[data-id]').forEach(button => {
        button.addEventListener('click', () => {
          state.selectedNoteId = button.dataset.id;
          renderApp('notes', target);
        });
      });
    }

    renderNoteList();

    document.getElementById('noteSearch').addEventListener('input', (event) => renderNoteList(event.target.value));
    document.getElementById('saveNote').addEventListener('click', () => {
      const title = document.getElementById('noteTitle').value.trim() || 'Untitled';
      const content = document.getElementById('noteBody').value.trim();
      if (!state.selectedNoteId) {
        const note = { id: crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`, title, content };
        state.notes.unshift(note);
        state.selectedNoteId = note.id;
      } else {
        const note = state.notes.find(entry => entry.id === state.selectedNoteId);
        if (note) {
          note.title = title;
          note.content = content;
        }
      }
      persistNotes();
      renderApp('notes', target);
      showToast('Note saved');
      pushNotification('Note saved locally', 'success');
    });

    document.getElementById('newNote').addEventListener('click', () => {
      state.selectedNoteId = null;
      renderApp('notes', target);
    });

    document.getElementById('deleteNote').addEventListener('click', () => {
      if (!state.selectedNoteId) return;
      state.notes = state.notes.filter(note => note.id !== state.selectedNoteId);
      state.selectedNoteId = state.notes[0]?.id ?? null;
      persistNotes();
      renderApp('notes', target);
      pushNotification('Note deleted', 'warning');
    });
    return;
  }

  if (appId === 'calculator') {
    target.innerHTML = `
      <div class="calc-shell">
        <div class="calc-display" id="calcDisplay">${state.calcValue}</div>
        <div class="calc-grid">
          <button class="calc-btn operator" type="button" data-calc="AC">AC</button>
          <button class="calc-btn operator" type="button" data-calc="DEL">DEL</button>
          <button class="calc-btn operator" type="button" data-calc="%">%</button>
          <button class="calc-btn operator" type="button" data-calc="/">÷</button>

          <button class="calc-btn" type="button" data-calc="7">7</button>
          <button class="calc-btn" type="button" data-calc="8">8</button>
          <button class="calc-btn" type="button" data-calc="9">9</button>
          <button class="calc-btn operator" type="button" data-calc="*">×</button>

          <button class="calc-btn" type="button" data-calc="4">4</button>
          <button class="calc-btn" type="button" data-calc="5">5</button>
          <button class="calc-btn" type="button" data-calc="6">6</button>
          <button class="calc-btn operator" type="button" data-calc="-">−</button>

          <button class="calc-btn" type="button" data-calc="1">1</button>
          <button class="calc-btn" type="button" data-calc="2">2</button>
          <button class="calc-btn" type="button" data-calc="3">3</button>
          <button class="calc-btn operator" type="button" data-calc="+">+</button>

          <button class="calc-btn" type="button" data-calc="0" style="grid-column: span 2;">0</button>
          <button class="calc-btn" type="button" data-calc=".">.</button>
          <button class="calc-btn equal" type="button" data-calc="=">=</button>
        </div>
      </div>
    `;

    const display = document.getElementById('calcDisplay');
    target.querySelectorAll('[data-calc]').forEach(button => {
      button.addEventListener('click', () => {
        const value = button.dataset.calc;
        if (value === 'AC') state.calcValue = '0';
        else if (value === 'DEL') state.calcValue = state.calcValue.length <= 1 ? '0' : state.calcValue.slice(0, -1);
        else if (value === '=') {
          try {
            const sanitized = state.calcValue.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
            if (!/^[0-9+\-*/%.\s()]+$/.test(sanitized)) throw new Error('Invalid expression');
            state.calcValue = String(Function(`'use strict'; return (${sanitized})`)());
          } catch (error) {
            state.calcValue = 'Error';
            pushNotification('Calculator error: invalid expression', 'error');
          }
        } else {
          state.calcValue = state.calcValue === '0' || state.calcValue === 'Error' ? value : state.calcValue + value;
        }
        display.textContent = state.calcValue;
      });
    });
    return;
  }

  if (appId === 'gallery') {
    const active = wallpaperPresets.find(p => p.id === state.wallpaper) || wallpaperPresets[0];
    target.innerHTML = `
      <div class="window-section">
        <div class="preview-box" style="background: linear-gradient(135deg, ${active.colors[0]}, ${active.colors[1]} 35%, ${active.colors[2]} 70%, ${active.colors[3]});"></div>
      </div>
      <div class="window-section">
        <div class="gallery-grid">
          ${wallpaperPresets.map(p => `
            <button type="button" class="gallery-card ${state.wallpaper === p.id ? 'active' : ''}" data-wall="${p.id}">
              <div class="wallpaper-thumb" style="background: linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]} 35%, ${p.colors[2]} 70%, ${p.colors[3]});"></div>
              <strong>${p.label}</strong>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    target.querySelectorAll('[data-wall]').forEach(button => {
      button.addEventListener('click', () => {
        state.wallpaper = button.dataset.wall;
        persistWallpaper();
        applyWallpaperPreset();
        renderApp('gallery', target);
        pushNotification(`${state.wallpaper} wallpaper selected`, 'success');
      });
    });
    return;
  }

  if (appId === 'wallpaper') {
    target.innerHTML = `
      <div class="window-section">
        <canvas id="studioCanvas" class="studio-canvas" width="640" height="240"></canvas>
      </div>
      <div class="window-section">
        <div class="form-field">
          <label>Palette</label>
          <div class="segmented" id="studioPalette"></div>
        </div>
        <div class="form-field">
          <label>Style</label>
          <select id="studioStyle">
            <option value="nebula">Nebula</option>
            <option value="waves">Waves</option>
            <option value="grid">Grid</option>
            <option value="ribbons">Ribbons</option>
          </select>
        </div>
        <div class="button-row">
          <button type="button" class="primary-btn" id="randWallpaper">Randomize</button>
          <button type="button" class="secondary-btn" id="exportWallpaper">Export PNG</button>
        </div>
      </div>
    `;

    const paletteOptions = [
      ['#74d9ff', '#b38cff', '#ff9bd1', '#091520'],
      ['#70f0d4', '#8db6ff', '#ff9fc5', '#0d1525'],
      ['#ffae72', '#ffd969', '#ff87b9', '#170d0d'],
      ['#d3d0ff', '#8fe9d6', '#7ecdfd', '#10182a']
    ];

    const paletteEl = document.getElementById('studioPalette');
    paletteEl.innerHTML = paletteOptions.map((palette, index) => `
      <button type="button" class="segment-item ${index === 0 ? 'active' : ''}" data-palette-index="${index}">P${index + 1}</button>
    `).join('');

    const canvasEl = document.getElementById('studioCanvas');
    let currentStyle = 'nebula';
    let currentPalette = paletteOptions[0];
    drawWallpaper(canvasEl, currentStyle, currentPalette);

    paletteEl.querySelectorAll('[data-palette-index]').forEach(button => {
      button.addEventListener('click', () => {
        currentPalette = paletteOptions[Number(button.dataset.paletteIndex)];
        drawWallpaper(canvasEl, currentStyle, currentPalette);
      });
    });

    document.getElementById('studioStyle').addEventListener('change', (event) => {
      currentStyle = event.target.value;
      drawWallpaper(canvasEl, currentStyle, currentPalette);
    });

    document.getElementById('randWallpaper').addEventListener('click', () => {
      currentPalette = paletteOptions[Math.floor(Math.random() * paletteOptions.length)];
      currentStyle = ['nebula', 'waves', 'grid', 'ribbons'][Math.floor(Math.random() * 4)];
      document.getElementById('studioStyle').value = currentStyle;
      drawWallpaper(canvasEl, currentStyle, currentPalette);
      pushNotification('Wallpaper regeneration complete', 'success');
    });

    document.getElementById('exportWallpaper').addEventListener('click', () => {
      try {
        const link = document.createElement('a');
        link.download = 'wonderos-wallpaper.png';
        link.href = canvasEl.toDataURL('image/png');
        link.click();
        pushNotification('Wallpaper exported as PNG', 'success');
        showToast('PNG exported');
      } catch (error) {
        console.error(error);
        pushNotification('Export failed', 'error');
      }
    });
    return;
  }

  if (appId === 'control') {
    target.innerHTML = `
      <div class="window-section">
        <div class="form-field">
          <label>Brightness</label>
          <input id="controlBright" type="range" min="20" max="100" value="${state.settings.bright}" />
        </div>
        <div class="form-field">
          <label>Volume</label>
          <input id="controlVolume" type="range" min="0" max="100" value="${state.settings.volume}" />
        </div>
      </div>
      <div class="window-section">
        <div class="segmented">
          <button type="button" class="segment-item ${state.settings.darkMode ? 'active' : ''}" data-control-theme="dark">Dark UI</button>
          <button type="button" class="segment-item ${!state.settings.darkMode ? 'active' : ''}" data-control-theme="light">Light UI</button>
          <button type="button" class="segment-item ${state.settings.performance ? 'active' : ''}" data-control-performance="toggle">Performance</button>
        </div>
      </div>
      <div class="button-row">
        <button type="button" class="primary-btn" id="applyControl">Apply</button>
      </div>
    `;

    document.getElementById('controlBright').addEventListener('input', (event) => {
      state.settings.bright = Number(event.target.value);
      renderWidgets();
    });
    document.getElementById('controlVolume').addEventListener('input', (event) => {
      state.settings.volume = Number(event.target.value);
      renderWidgets();
    });
    document.querySelectorAll('[data-control-theme]').forEach(button => {
      button.addEventListener('click', () => {
        state.settings.darkMode = button.dataset.controlTheme === 'dark';
        updateTheme();
        renderApp('control', target);
      });
    });
    document.querySelectorAll('[data-control-performance]').forEach(button => {
      button.addEventListener('click', () => {
        state.settings.performance = !state.settings.performance;
        renderApp('control', target);
      });
    });
    document.getElementById('applyControl').addEventListener('click', () => {
      persistSettings();
      pushNotification('Control center output applied', 'success');
    });
    return;
  }

  if (appId === 'search') {
    target.innerHTML = `
      <div class="window-section">
        <div class="form-field">
          <label>Search system</label>
          <input id="systemSearch" type="search" placeholder="Find apps and notes" />
        </div>
      </div>
      <div class="window-section">
        <div id="searchResults" class="list-panel"></div>
      </div>
    `;

    function applySearch(value) {
      const term = value.trim().toLowerCase();
      const appMatches = appOrder.filter(appId => appMeta[appId].label.toLowerCase().includes(term));
      const noteMatches = state.notes.filter(note => note.title.toLowerCase().includes(term) || note.content.toLowerCase().includes(term));
      const results = [
        ...appMatches.map(appId => ({ id: appId, label: appMeta[appId].label, type: 'App' })),
        ...noteMatches.map(note => ({ id: `note-${note.id}`, label: note.title, type: 'Note' }))
      ];

      const resultEl = document.getElementById('searchResults');
      if (!term || !results.length) {
        resultEl.innerHTML = '<div class="empty-state">No results found.</div>';
        return;
      }

      resultEl.innerHTML = results.map(result => `
        <button type="button" class="result-item" data-search-id="${result.id}">
          <div>
            <strong>${escapeHtml(result.label)}</strong>
            <small>${result.type}</small>
          </div>
          <span class="glyph-badge">${result.type === 'App' ? '⚙️' : '📝'}</span>
        </button>
      `).join('');

      resultEl.querySelectorAll('[data-search-id]').forEach(button => {
        button.addEventListener('click', () => {
          const id = button.dataset.searchId;
          if (id.startsWith('note-')) {
            state.selectedNoteId = id.replace('note-', '');
            openApp('notes');
          } else {
            openApp(id);
          }
        });
      });
    }

    document.getElementById('systemSearch').addEventListener('input', (event) => applySearch(event.target.value));
    applySearch('');
    return;
  }

  if (appId === 'notifications') {
    target.innerHTML = `
      <div class="notification-list">
        ${state.notifications.length ? state.notifications.map(item => `
          <div class="notification-item ${item.tone}">
            <div>${item.message}</div>
            <small style="color: var(--muted); font-size: 0.68rem;">${new Date(item.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
          </div>
        `).join('') : '<div class="empty-state">No notifications to show.</div>'}
      </div>
    `;
    return;
  }

  target.innerHTML = '<div class="empty-state">Application content unavailable.</div>';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function drawWallpaper(canvasEl, style, palette) {
  const ctx = canvasEl.getContext('2d');
  const { width, height } = canvasEl;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette[3]);
  gradient.addColorStop(0.35, palette[0]);
  gradient.addColorStop(0.7, palette[1]);
  gradient.addColorStop(1, palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 18; i += 1) {
    const x = (i / 18) * width;
    const y = height * (0.25 + Math.sin(i * 1.2) * 0.2);
    const r = 52 + i * 10;
    const glow = ctx.createRadialGradient(x, y, 10, x, y, r);
    glow.addColorStop(0, `${palette[i % palette.length]}AA`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  if (style === 'ribbons') {
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 20 + i * 18);
      for (let x = 0; x <= width; x += 24) {
        ctx.lineTo(x, 20 + i * 18 + Math.sin(x * 0.03 + i) * 26);
      }
      ctx.strokeStyle = `${palette[i % palette.length]}AA`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (style === 'grid') {
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  if (style === 'waves') {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const y = height / 2 + Math.sin(x * 0.05) * 48;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `${palette[0]}CC`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function applyWallpaperPreset() {
  const preset = wallpaperPresets.find(item => item.id === state.wallpaper) || wallpaperPresets[0];
  if (webglReady && scene) {
    scene.background = new THREE.Color(preset.colors[3]);
    if (glassCore) glassCore.material.color.set(preset.colors[0]);
  }
}

function setupScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.settings.performance ? 1.2 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    webglReady = true;
  } catch (error) {
    console.warn('WebGL init failed', error);
    fallback.classList.remove('hidden');
    return;
  }

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050b12, 8, 22);

  camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.4, 8);

  const ambient = new THREE.AmbientLight(0xcfe8ff, 1.2);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0x8adfff, 1.8);
  keyLight.position.set(5, 6, 7);
  scene.add(keyLight);

  const rim = new THREE.PointLight(0xc99cff, 14, 28, 2);
  rim.position.set(-4, -2, 5);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  glassCore = new THREE.Mesh(
    new RoundedBoxGeometry(2.7, 2.3, 1.8, 8, 0.35),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(state.settings.accent),
      metalness: 0.12,
      roughness: 0.14,
      transmission: 1,
      thickness: 1.2,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.2,
      ior: 1.3
    })
  );
  group.add(glassCore);

  innerCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    new THREE.MeshStandardMaterial({
      color: 0xf2f9ff,
      emissive: new THREE.Color(state.settings.accentAlt),
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.2,
      transparent: true,
      opacity: 0.78
    })
  );
  group.add(innerCore);

  ringGroup = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(3.2 + i * 0.5, 0.025, 12, 160),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x7fe7ff : 0xc99cff, transparent: true, opacity: 0.45 })
    );
    torus.rotation.x = (i + 1) * 0.65;
    torus.rotation.y = i * 0.8;
    ringGroup.add(torus);
  }
  scene.add(ringGroup);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(450 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (Math.random() - 0.5) * 18;
    positions[i + 1] = (Math.random() - 0.5) * 14;
    positions[i + 2] = (Math.random() - 0.5) * 16;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particles = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xcbefff, size: 0.06, transparent: true, opacity: 0.8 })
  );
  scene.add(particles);

  applyWallpaperPreset();
}

function animateScene() {
  if (!webglReady || !scene || !camera || !renderer) return;
  const reduced = state.settings.reducedMotion || document.hidden;

  if (glassCore) {
    glassCore.rotation.y += reduced ? 0.003 : 0.01;
    glassCore.rotation.x = pointer.y * 0.8;
    glassCore.rotation.z = pointer.x * 0.3;
  }

  if (innerCore) {
    innerCore.rotation.x += reduced ? 0.005 : 0.018;
    innerCore.rotation.y += reduced ? 0.006 : 0.02;
  }

  if (ringGroup) {
    ringGroup.rotation.y += reduced ? 0.002 : 0.006;
    ringGroup.rotation.x += 0.004;
  }

  camera.position.x += ((pointer.x * 0.8) - camera.position.x) * 0.04;
  camera.position.y += ((pointer.y * 0.6) - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

function bindEvents() {
  document.getElementById('homeBtn').addEventListener('click', () => {
    homeScreen.classList.add('active');
    state.windows.forEach(win => win.element.classList.remove('minimized'));
  });

  document.getElementById('launcherBtn').addEventListener('click', toggleLauncher);
  document.getElementById('closeLauncher').addEventListener('click', toggleLauncher);
  document.getElementById('launcherSearch').addEventListener('input', (event) => {
    state.searchQuery = event.target.value;
    renderLauncher();
  });
  document.getElementById('notificationsBtn').addEventListener('click', toggleNotifications);

  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener('touchmove', (event) => {
    if (!event.touches[0]) return;
    pointer.x = (event.touches[0].clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (event.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (renderer && webglReady) {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.settings.performance ? 1.2 : 1.6));
    }
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pushNotification('Animation eased to save power', 'info');
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.launcherOpen) toggleLauncher();
      if (state.notificationsOpen) toggleNotifications();
    }
  });
}

function init() {
  updateTheme();
  renderWidgets();
  renderDock();
  renderNotifications();
  renderLauncher();
  updateClock();
  setInterval(updateClock, 30000);
  bindEvents();
  setupScene();
  openApp('settings');

  if (webglReady) {
    const loop = () => {
      animateScene();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setTimeout(() => showToast('WonderOS ready'), 250);
}

init();
export {};

































































































































































































































































































































































