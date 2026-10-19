import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const appData = {
  settings: { label: 'Settings', icon: '⚙️', accent: '#74d9ff' },
  notes: { label: 'Notes', icon: '📝', accent: '#b38cff' },
  calculator: { label: 'Calculator', icon: '🧮', accent: '#7ef0d5' },
  gallery: { label: 'Gallery', icon: '🖼️', accent: '#ff9bd1' },
  wallpaper: { label: 'Wallpaper Studio', icon: '🎨', accent: '#ffd97a' },
  control: { label: 'Control Center', icon: '🕹️', accent: '#7ac6ff' },
  search: { label: 'Search', icon: '🔎', accent: '#a7edff' },
  notifications: { label: 'Notifications', icon: '🔔', accent: '#d9b3ff' }
};

const wallpaperPresets = [
  { id: 'aurora', label: 'Aurora', colors: ['#75f2ff', '#9a6dff', '#ff8dd8', '#020817'], mood: 'cold glow' },
  { id: 'ember', label: 'Ember', colors: ['#ff8c5d', '#ffdc8b', '#ff5ebd', '#160b0c'], mood: 'warm pulse' },
  { id: 'ocean', label: 'Ocean', colors: ['#63d6ff', '#6ff3d3', '#96b7ff', '#071821'], mood: 'deep current' },
  { id: 'dream', label: 'Dream', colors: ['#ffb4ef', '#d7b4ff', '#97e6ff', '#150d26'], mood: 'soft haze' },
  { id: 'nova', label: 'Nova', colors: ['#86f7ff', '#72a8ff', '#e1a8ff', '#070d19'], mood: 'high signal' },
  { id: 'sunset', label: 'Sunset', colors: ['#ff9b73', '#ff72a5', '#c5a3ff', '#1a0e18'], mood: 'violet fade' }
];

const paletteSwatches = ['#74d9ff', '#b38cff', '#ff9bd1', '#7ef0d5', '#ffd97a', '#8cc9ff'];

const storageKeys = {
  settings: 'wonderos.settings.v1',
  notes: 'wonderos.notes.v1',
  notifications: 'wonderos.notifications.v1',
  wallpaper: 'wonderos.wallpaper.v1'
};

const defaults = {
  accent: '#74d9ff',
  accentAlt: '#b38cff',
  wallpaper: 'aurora',
  glass: 78,
  darkMode: true,
  reducedMotion: false,
  performanceMode: false,
  brightness: 72,
  volume: 52,
  theme: 'dark'
};

const appOrder = Object.keys(appData);

const state = {
  settings: { ...defaults, ...safeStorageRead(storageKeys.settings, {}) },
  notes: safeStorageRead(storageKeys.notes, [
    {
      id: crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
      title: 'Welcome',
      content: 'WonderOS is ready. Capture ideas, tune the system, and shape your workspace.'
    }
  ]),
  notifications: safeStorageRead(storageKeys.notifications, [
    { id: `${Date.now()}-1`, message: 'System ready. Ambient motion is online.', tone: 'info', when: new Date().toISOString() }
  ]),
  windows: [],
  activeWindowId: null,
  selectedNoteId: null,
  launcherOpen: false,
  notificationOpen: false,
  calculatorValue: '0',
  wallpaperSelection: safeStorageRead(storageKeys.wallpaper, 'aurora'),
  searchQuery: ''
};

if (!state.selectedNoteId && state.notes.length) {
  state.selectedNoteId = state.notes[0].id;
}

const clockText = document.getElementById('clockText');
const dateText = document.getElementById('dateText');
const drawer = document.getElementById('dock');
const launcherPanel = document.getElementById('launcherPanel');
const desktop = document.getElementById('desktop');
const windowLayer = document.getElementById('windowLayer');
const notificationCenter = document.getElementById('notificationCenter');
const toastLayer = document.getElementById('toastLayer');
const widgetStack = document.getElementById('widgetStack');
const homeScreen = document.getElementById('homeScreen');

const canvas = document.getElementById('threeCanvas');
const fallbackNotice = document.getElementById('fallbackNotice');

let renderer;
let scene;
let camera;
let glassCore;
let innerCore;
let ringGroup;
let pointer = { x: 0, y: 0 };
let isWebGLReady = false;

function safeStorageRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Storage unavailable:', error);
    return fallback;
  }
}

function safeStorageWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Storage write failed:', error);
    return false;
  }
}

function persistSettings() {
  safeStorageWrite(storageKeys.settings, state.settings);
}

function persistNotes() {
  safeStorageWrite(storageKeys.notes, state.notes);
}

function persistNotifications() {
  safeStorageWrite(storageKeys.notifications, state.notifications.slice(0, 8));
}

function persistWallpaper() {
  safeStorageWrite(storageKeys.wallpaper, state.wallpaperSelection);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastLayer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 1600);
}

function pushNotification(message, tone = 'info') {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    tone,
    when: new Date().toISOString()
  };
  state.notifications.unshift(entry);
  state.notifications = state.notifications.slice(0, 8);
  persistNotifications();
  renderNotifications();
}

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--accent', state.settings.accent);
  root.style.setProperty('--accent-2', state.settings.accentAlt);
  root.style.setProperty('--glass-alpha', (Number(state.settings.glass) / 100).toFixed(2));
  root.style.setProperty('--device-blur', `blur(${Math.max(10, Number(state.settings.glass) / 4)}px) saturate(1.15)`);

  const isDark = state.settings.darkMode;
  document.body.style.background = isDark
    ? 'radial-gradient(circle at 20% 20%, rgba(108, 167, 255, 0.16), transparent 22%), radial-gradient(circle at 72% 18%, rgba(181, 120, 255, 0.12), transparent 28%), linear-gradient(180deg, var(--bg-0), var(--bg-1) 48%, #070b15)'
    : 'radial-gradient(circle at 20% 20%, rgba(164, 196, 255, 0.1), transparent 22%), linear-gradient(180deg, #eef4ff, #dfe9ff 40%, #d3dced 100%)';

  document.body.style.color = isDark ? '#ebf7ff' : '#132236';
  document.documentElement.style.setProperty('--text', isDark ? '#ebf7ff' : '#132236');
  document.documentElement.style.setProperty('--muted', isDark ? 'rgba(235, 247, 255, 0.75)' : 'rgba(19, 34, 54, 0.76)');
  document.documentElement.style.setProperty('--panel', isDark ? 'rgba(13, 20, 31, 0.7)' : 'rgba(245, 249, 255, 0.78)');
  document.documentElement.style.setProperty('--panel-strong', isDark ? 'rgba(16, 23, 35, 0.88)' : 'rgba(255,255,255,0.9)');
  document.documentElement.style.setProperty('--border', isDark ? 'rgba(160, 214, 255, 0.2)' : 'rgba(80, 108, 147, 0.18)');

  if (isWebGLReady && glassCore) {
    glassCore.material.color.set(state.settings.accent);
    if (innerCore) {
      innerCore.material.emissive.set(state.settings.accentAlt);
    }
  }
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  clockText.textContent = time;
  dateText.textContent = date;
}

function renderWidgets() {
  const widgets = [
    { title: 'Aura', value: `${state.settings.brightness}%`, detail: 'Ambient clarity' },
    { title: 'Flow', value: `${state.settings.volume}%`, detail: 'Interaction curve' },
    { title: 'Notes', value: `${state.notes.length}`, detail: 'Saved drafts' }
  ];

  widgetStack.innerHTML = widgets
    .map(
      (widget) => `
        <article class="widget glass-panel">
          <small>${widget.title}</small>
          <strong>${widget.value}</strong>
          <p>${widget.detail}</p>
        </article>
      `
    )
    .join('');
}

function renderDock() {
  drawer.innerHTML = appOrder
    .map((appId) => {
      const app = appData[appId];
      const isOpen = state.windows.some((entry) => entry.id === appId);
      return `
        <button
          class="dock-button ${isOpen ? 'active' : ''}"
          type="button"
          data-app-id="${appId}"
          data-label="${app.label}"
          aria-label="Open ${app.label}"
        >${app.icon}</button>
      `;
    })
    .join('');

  drawer.querySelectorAll('.dock-button').forEach((button) => {
    button.addEventListener('click', () => openApp(button.dataset.appId));
  });
}

function renderLauncher() {
  const searchValue = state.searchQuery.trim();
  const matches = appOrder.filter((appId) => {
    const app = appData[appId];
    return !searchValue || app.label.toLowerCase().includes(searchValue.toLowerCase());
  });

  launcherPanel.innerHTML = `
    <div class="launcher-header">
      <input
        id="launcherSearch"
        class="launcher-search"
        type="search"
        placeholder="Search apps"
        value="${state.searchQuery}"
        aria-label="Search applications"
      />
      <button class="secondary-button" type="button" data-close-launcher>Close</button>
    </div>
    <div class="launcher-grid">
      ${matches
        .map(
          (appId) => `
            <button class="launcher-item" type="button" data-launch-app="${appId}">
              <span class="launcher-icon">${appData[appId].icon}</span>
              <span>
                <strong>${appData[appId].label}</strong>
                <span>System app</span>
              </span>
            </button>
          `
        )
        .join('') || '<div class="empty-state" style="grid-column: 1 / -1; min-height: 80px;">No matching app found.</div>'}
    </div>
  `;

  launcherPanel.querySelector('#launcherSearch').addEventListener('input', (event) => {
    state.searchQuery = event.target.value;
    renderLauncher();
  });

  launcherPanel.querySelector('[data-close-launcher]').addEventListener('click', () => toggleLauncher());
  launcherPanel.querySelectorAll('[data-launch-app]').forEach((button) => {
    button.addEventListener('click', () => {
      openApp(button.dataset.launchApp);
      state.searchQuery = '';
      toggleLauncher();
    });
  });
}

function toggleLauncher() {
  state.launcherOpen = !state.launcherOpen;
  launcherPanel.classList.toggle('hidden', !state.launcherOpen);
  if (state.launcherOpen) {
    renderLauncher();
  }
}

function renderNotifications() {
  notificationCenter.innerHTML = `
    <div class="notification-header">
      <strong>Notifications</strong>
      <button class="ghost-button" type="button" data-close-notifications>Close</button>
    </div>
    <div class="notification-list">
      ${state.notifications.length
        ? state.notifications
            .map(
              (item) => `
                <div class="notification-item ${item.tone}">
                  <div>${item.message}</div>
                  <small>${new Date(item.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
                </div>
              `
            )
            .join('')
        : '<div class="empty-state">No notifications yet.</div>'}
    </div>
  `;

  notificationCenter.querySelector('[data-close-notifications]').addEventListener('click', () => {
    state.notificationOpen = false;
    notificationCenter.classList.add('hidden');
  });
}

function toggleNotifications() {
  state.notificationOpen = !state.notificationOpen;
  notificationCenter.classList.toggle('hidden', !state.notificationOpen);
}

function getWindowPosition(appId) {
  const appCount = state.windows.filter((windowEntry) => windowEntry.id !== appId).length;
  const x = 80 + (appCount % 3) * 52;
  const y = 120 + (appCount % 4) * 38;
  return { x, y };
}

function focusWindow(appId) {
  state.activeWindowId = appId;
  state.windows.forEach((entry) => {
    entry.element.style.zIndex = entry.id === appId ? '30' : '5';
  });
  renderDock();
}

function closeWindow(appId) {
  const entry = state.windows.find((item) => item.id === appId);
  if (!entry) return;
  entry.element.remove();
  state.windows = state.windows.filter((item) => item.id !== appId);
  state.activeWindowId = state.windows.at(-1)?.id ?? null;
  renderDock();
}

function minimizeWindow(appId) {
  const entry = state.windows.find((item) => item.id === appId);
  if (!entry) return;
  entry.element.classList.add('minimized');
  state.activeWindowId = null;
}

function maximizeWindow(appId) {
  const entry = state.windows.find((item) => item.id === appId);
  if (!entry) return;
  const isMax = entry.maximized;
  entry.maximized = !isMax;
  entry.element.style.width = isMax ? 'min(760px, 82vw)' : 'calc(100vw - 34px)';
  entry.element.style.height = isMax ? 'min(540px, 68vh)' : 'calc(100vh - 120px)';
  entry.element.style.left = isMax ? `${entry.x}px` : '17px';
  entry.element.style.top = isMax ? `${entry.y}px` : '84px';
}

function openApp(appId) {
  const existing = state.windows.find((entry) => entry.id === appId);
  if (existing) {
    existing.element.classList.remove('minimized');
    focusWindow(appId);
    return;
  }

  const appMeta = appData[appId];
  const { x, y } = getWindowPosition(appId);
  const windowEl = document.createElement('section');
  windowEl.className = 'app-window';
  windowEl.style.left = `${x}px`;
  windowEl.style.top = `${y}px`;
  windowEl.style.zIndex = '30';

  windowEl.innerHTML = `
    <div class="window-header" data-drag-handle>
      <div class="window-title"><span class="window-icon">${appMeta.icon}</span>${appMeta.label}</div>
      <div class="window-controls">
        <button class="window-control minimize" type="button" data-window-action="minimize" data-app-id="${appId}" aria-label="Minimize ${appMeta.label}"></button>
        <button class="window-control maximize" type="button" data-window-action="maximize" data-app-id="${appId}" aria-label="Maximize ${appMeta.label}"></button>
        <button class="window-control close" type="button" data-window-action="close" data-app-id="${appId}" aria-label="Close ${appMeta.label}"></button>
      </div>
    </div>
    <div class="window-content"></div>
  `;

  state.windows.push({ id: appId, element: windowEl, maximized: false, x, y });
  windowLayer.appendChild(windowEl);
  focusWindow(appId);
  renderAppContent(appId, windowEl.querySelector('.window-content'));

  windowEl.querySelectorAll('[data-window-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.windowAction;
      if (action === 'close') closeWindow(appId);
      if (action === 'minimize') minimizeWindow(appId);
      if (action === 'maximize') maximizeWindow(appId);
    });
  });

  const dragHandle = windowEl.querySelector('[data-drag-handle]');
  let drag = null;
  dragHandle.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX - windowEl.offsetLeft, y: event.clientY - windowEl.offsetTop };
  });
  window.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const win = state.windows.find((entry) => entry.id === appId);
    if (!win) return;
    win.x = clamp(event.clientX - drag.x, 14, window.innerWidth - windowEl.offsetWidth - 14);
    win.y = clamp(event.clientY - drag.y, 90, window.innerHeight - windowEl.offsetHeight - 14);
    windowEl.style.left = `${win.x}px`;
    windowEl.style.top = `${win.y}px`;
  });
  window.addEventListener('pointerup', () => { drag = null; });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderAppContent(appId, target) {
  if (appId === 'settings') {
    target.innerHTML = `
      <div class="window-section">
        <h3>Appearance</h3>
        <div class="accent-grid">
          ${paletteSwatches
            .map(
              (color) => `
                <button
                  type="button"
                  class="accent-swatch ${state.settings.accent === color ? 'active' : ''}"
                  data-accent="${color}"
                  style="background: linear-gradient(135deg, ${color}, ${color}cc);"
                  aria-label="Use ${color} accent"
                ></button>
              `
            )
            .join('')}
        </div>
      </div>

      <div class="window-section">
        <div class="form-field">
          <label>Wallpaper</label>
          <select id="wallpaperSelect">
            ${wallpaperPresets.map((preset) => `<option value="${preset.id}" ${state.wallpaperSelection === preset.id ? 'selected' : ''}>${preset.label}</option>`).join('')}
          </select>
        </div>

        <div class="form-field">
          <label>Glass intensity</label>
          <input id="glassRange" type="range" min="40" max="100" value="${state.settings.glass}" />
        </div>

        <div class="form-field">
          <label>Brightness</label>
          <input id="brightnessRange" type="range" min="20" max="100" value="${state.settings.brightness}" />
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
        </div>
      </div>

      <div class="window-section">
        <div class="segmented">
          <button type="button" class="segment-item ${state.settings.reducedMotion ? 'active' : ''}" data-motion="reduced">Reduced motion</button>
          <button type="button" class="segment-item ${state.settings.performanceMode ? 'active' : ''}" data-performance="toggle">Performance mode</button>
        </div>
      </div>

      <div class="button-row">
        <button class="primary-button" type="button" data-save-settings>Save preferences</button>
        <button class="secondary-button" type="button" data-reset-settings>Reset defaults</button>
      </div>
    `;

    const accentButtons = target.querySelectorAll('[data-accent]');
    accentButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.settings.accent = button.dataset.accent;
        state.settings.accentAlt = paletteSwatches[(paletteSwatches.indexOf(button.dataset.accent) + 2) % paletteSwatches.length];
        applyTheme();
        renderSettingsWindow();
      });
    });

    target.querySelector('#wallpaperSelect').addEventListener('change', (event) => {
      state.wallpaperSelection = event.target.value;
      persistWallpaper();
      applyWallpaperById(state.wallpaperSelection);
      pushNotification(`Wallpaper changed to ${event.target.value}`, 'success');
    });

    target.querySelector('#glassRange').addEventListener('input', (event) => {
      state.settings.glass = Number(event.target.value);
      applyTheme();
    });

    target.querySelector('#brightnessRange').addEventListener('input', (event) => {
      state.settings.brightness = Number(event.target.value);
      renderWidgets();
    });

    target.querySelector('#volumeRange').addEventListener('input', (event) => {
      state.settings.volume = Number(event.target.value);
      renderWidgets();
    });

    target.querySelector('[data-theme="dark"]').addEventListener('click', () => {
      state.settings.darkMode = true;
      applyTheme();
      renderAppContent(appId, target);
    });

    target.querySelector('[data-theme="light"]').addEventListener('click', () => {
      state.settings.darkMode = false;
      applyTheme();
      renderAppContent(appId, target);
    });

    target.querySelector('[data-motion="reduced"]').addEventListener('click', () => {
      state.settings.reducedMotion = !state.settings.reducedMotion;
      applyTheme();
      renderAppContent(appId, target);
    });

    target.querySelector('[data-performance="toggle"]').addEventListener('click', () => {
      state.settings.performanceMode = !state.settings.performanceMode;
      if (state.settings.performanceMode) {
        if (isWebGLReady && renderer) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
        }
      }
      renderAppContent(appId, target);
    });

    target.querySelector('[data-save-settings]').addEventListener('click', () => {
      persistSettings();
      pushNotification('Preferences saved locally', 'success');
      showToast('Settings saved');
    });

    target.querySelector('[data-reset-settings]').addEventListener('click', () => {
      Object.assign(state.settings, defaults);
      applyTheme();
      renderWidgets();
      persistSettings();
      renderSettingsWindow();
      showToast('Defaults restored');
      pushNotification('System defaults restored.', 'warning');
    });

    return;
  }

  if (appId === 'notes') {
    const selectedNote = state.notes.find((note) => note.id === state.selectedNoteId) || state.notes[0];
    target.innerHTML = `
      <div class="window-grid" style="grid-template-columns: 1fr 1.6fr;">
        <div class="window-section">
          <div class="form-field">
            <label>Search notes</label>
            <input id="noteSearch" type="search" placeholder="Search..." />
          </div>
          <div class="list-panel" id="noteList"></div>
        </div>

        <div class="window-section">
          <div class="form-field">
            <label>Title</label>
            <input id="noteTitle" type="text" value="${selectedNote ? escapeHtml(selectedNote.title) : ''}" />
          </div>
          <div class="form-field">
            <label>Body</label>
            <textarea id="noteBody">${selectedNote ? escapeHtml(selectedNote.content) : ''}</textarea>
          </div>
          <div class="button-row">
            <button class="primary-button" type="button" data-save-note>Save</button>
            <button class="secondary-button" type="button" data-new-note>New</button>
            <button class="ghost-button" type="button" data-delete-note>Delete</button>
          </div>
        </div>
      </div>
    `;

    renderNoteList(target.querySelector('#noteList'));

    const noteSearch = target.querySelector('#noteSearch');
    noteSearch.addEventListener('input', () => renderNoteList(target.querySelector('#noteList'), noteSearch.value));

    target.querySelector('[data-save-note]').addEventListener('click', () => {
      const title = target.querySelector('#noteTitle').value.trim() || 'Untitled';
      const content = target.querySelector('#noteBody').value.trim();
      if (!selectedNote) {
        const nextNote = { id: crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`, title, content };
        state.notes.unshift(nextNote);
        state.selectedNoteId = nextNote.id;
      } else {
        selectedNote.title = title;
        selectedNote.content = content;
      }
      persistNotes();
      renderNotesWindow();
      showToast('Note saved');
      pushNotification('Note saved locally', 'success');
    });

    target.querySelector('[data-new-note]').addEventListener('click', () => {
      state.selectedNoteId = null;
      renderNotesWindow();
    });

    target.querySelector('[data-delete-note]').addEventListener('click', () => {
      if (!selectedNote) return;
      state.notes = state.notes.filter((note) => note.id !== selectedNote.id);
      state.selectedNoteId = state.notes[0]?.id ?? null;
      persistNotes();
      renderNotesWindow();
      showToast('Note removed');
      pushNotification('Note deleted', 'warning');
    });

    return;
  }

  if (appId === 'calculator') {
    target.innerHTML = `
      <div class="calculator-shell">
        <div class="calc-display" id="calcDisplay">0</div>
        <div class="calc-grid">
          <button class="calc-btn operator" type="button" data-value="AC">AC</button>
          <button class="calc-btn operator" type="button" data-value="DEL">DEL</button>
          <button class="calc-btn operator" type="button" data-value="%">%</button>
          <button class="calc-btn operator" type="button" data-value="/">÷</button>

          <button class="calc-btn" type="button" data-value="7">7</button>
          <button class="calc-btn" type="button" data-value="8">8</button>
          <button class="calc-btn" type="button" data-value="9">9</button>
          <button class="calc-btn operator" type="button" data-value="*">×</button>

          <button class="calc-btn" type="button" data-value="4">4</button>
          <button class="calc-btn" type="button" data-value="5">5</button>
          <button class="calc-btn" type="button" data-value="6">6</button>
          <button class="calc-btn operator" type="button" data-value="-">−</button>

          <button class="calc-btn" type="button" data-value="1">1</button>
          <button class="calc-btn" type="button" data-value="2">2</button>
          <button class="calc-btn" type="button" data-value="3">3</button>
          <button class="calc-btn operator" type="button" data-value="+">+</button>

          <button class="calc-btn" type="button" data-value="0" style="grid-column: span 2;">0</button>
          <button class="calc-btn" type="button" data-value=".">.</button>
          <button class="calc-btn equal" type="button" data-value="=">=</button>
        </div>
      </div>
    `;

    const display = target.querySelector('#calcDisplay');
    display.textContent = state.calculatorValue;

    target.querySelectorAll('.calc-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.value;
        if (value === 'AC') {
          state.calculatorValue = '0';
        } else if (value === 'DEL') {
          state.calculatorValue = state.calculatorValue.length <= 1 ? '0' : state.calculatorValue.slice(0, -1);
        } else if (value === '=') {
          try {
            const sanitized = state.calculatorValue.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
            const allowed = /^[0-9+\-*/%.\s()]+$/;
            if (!allowed.test(sanitized)) throw new Error('Invalid expression');
            state.calculatorValue = String(Function(`'use strict'; return (${sanitized})`)());
          } catch (error) {
            state.calculatorValue = 'Error';
            pushNotification('Calculator error: invalid expression', 'error');
          }
        } else {
          const next = state.calculatorValue === '0' || state.calculatorValue === 'Error' ? value : `${state.calculatorValue}${value}`;
          state.calculatorValue = next;
        }
        display.textContent = state.calculatorValue;
      });
    });

    document.addEventListener('keydown', handleCalculatorKeyboard);
    return;
  }

  if (appId === 'gallery') {
    target.innerHTML = `
      <div class="window-section">
        <div class="preview-panel">
          <div class="preview-pane" id="galleryPreview"></div>
        </div>
      </div>
      <div class="window-section">
        <div class="card-grid" id="galleryGrid"></div>
      </div>
    `;

    const preview = target.querySelector('#galleryPreview');
    const grid = target.querySelector('#galleryGrid');

    grid.innerHTML = wallpaperPresets.map((preset) => `
      <button type="button" class="gallery-card ${state.wallpaperSelection === preset.id ? 'active' : ''}" data-wallpaper="${preset.id}">
        <div class="wallpaper-thumb" style="background: linear-gradient(135deg, ${preset.colors[0]} 0%, ${preset.colors[1]} 40%, ${preset.colors[2]} 80%, ${preset.colors[3]} 100%);"></div>
        <strong>${preset.label}</strong>
        <small>${preset.mood}</small>
      </button>
    `).join('');

    const activePreview = wallpaperPresets.find((item) => item.id === state.wallpaperSelection) || wallpaperPresets[0];
    preview.style.background = `linear-gradient(135deg, ${activePreview.colors[0]} 0%, ${activePreview.colors[1]} 35%, ${activePreview.colors[2]} 70%, ${activePreview.colors[3]} 100%)`;

    grid.querySelectorAll('[data-wallpaper]').forEach((button) => {
      button.addEventListener('click', () => {
        state.wallpaperSelection = button.dataset.wallpaper;
        persistWallpaper();
        applyWallpaperById(state.wallpaperSelection);
        renderGalleryWindow();
        pushNotification(`${state.wallpaperSelection} wallpaper selected`, 'success');
      });
    });

    return;
  }

  if (appId === 'wallpaper') {
    target.innerHTML = `
      <div class="window-section">
        <canvas id="studioCanvas" class="studio-canvas" width="640" height="260"></canvas>
      </div>
      <div class="window-section">
        <div class="form-field">
          <label>Palette</label>
          <div class="segmented" id="studioPalettePicker"></div>
        </div>
        <div class="form-field">
          <label>Style</label>
          <select id="studioStyle">
            <option value="nebula">Nebula</option>
            <option value="ribbons">Ribbons</option>
            <option value="grid">Grid</option>
            <option value="waves">Waves</option>
          </select>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" data-random-wallpaper>Randomize</button>
          <button class="secondary-button" type="button" data-export-wallpaper>Export PNG</button>
        </div>
      </div>
    `;

    renderStudioPalettePicker(target.querySelector('#studioPalettePicker'));
    let currentStyle = 'nebula';
    const canvasEl = target.querySelector('#studioCanvas');
    drawWallpaper(canvasEl, currentStyle, ['#74d9ff', '#b38cff', '#ff9bd1', '#091520']);

    target.querySelector('#studioStyle').addEventListener('change', (event) => {
      currentStyle = event.target.value;
      drawWallpaper(canvasEl, currentStyle, getActivePalette());
    });

    target.querySelector('[data-random-wallpaper]').addEventListener('click', () => {
      const randomPalette = [
        ['#74d9ff', '#b38cff', '#ff9bd1', '#061119'],
        ['#70f0d4', '#8db6ff', '#ff9fc5', '#0a1320'],
        ['#ffae72', '#ffd969', '#ff9ad6', '#170d0d'],
        ['#c0d0ff', '#7ae7d7', '#68d1ff', '#10182b']
      ][Math.floor(Math.random() * 4)];
      drawWallpaper(canvasEl, currentStyle, randomPalette);
      pushNotification('Wallpaper composition regenerated', 'success');
    });

    target.querySelector('[data-export-wallpaper]').addEventListener('click', () => {
      try {
        const link = document.createElement('a');
        link.download = 'wonderos-wallpaper.png';
        link.href = canvasEl.toDataURL('image/png');
        link.click();
        pushNotification('Wallpaper exported as PNG', 'success');
        showToast('PNG exported');
      } catch (error) {
        console.error('Export failed:', error);
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
          <input id="controlBrightness" type="range" min="20" max="100" value="${state.settings.brightness}" />
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
          <button type="button" class="segment-item ${state.settings.performanceMode ? 'active' : ''}" data-control-performance="toggle">Performance</button>
        </div>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" data-control-save>Apply</button>
      </div>
    `;

    target.querySelector('#controlBrightness').addEventListener('input', (event) => {
      state.settings.brightness = Number(event.target.value);
      renderWidgets();
    });

    target.querySelector('#controlVolume').addEventListener('input', (event) => {
      state.settings.volume = Number(event.target.value);
      renderWidgets();
    });

    target.querySelector('[data-control-theme="dark"]').addEventListener('click', () => {
      state.settings.darkMode = true;
      applyTheme();
      renderAppContent(appId, target);
    });
    target.querySelector('[data-control-theme="light"]').addEventListener('click', () => {
      state.settings.darkMode = false;
      applyTheme();
      renderAppContent(appId, target);
    });
    target.querySelector('[data-control-performance="toggle"]').addEventListener('click', () => {
      state.settings.performanceMode = !state.settings.performanceMode;
      renderAppContent(appId, target);
    });
    target.querySelector('[data-control-save]').addEventListener('click', () => {
      persistSettings();
      pushNotification('Control settings applied', 'success');
    });

    return;
  }

  if (appId === 'search') {
    target.innerHTML = `
      <div class="window-section">
        <div class="form-field">
          <label>Search system</label>
          <input id="systemSearch" type="search" placeholder="Find apps, notes, settings" />
        </div>
      </div>
      <div class="window-section">
        <div id="searchResults" class="search-results"></div>
      </div>
    `;

    const input = target.querySelector('#systemSearch');
    input.addEventListener('input', () => {
      const value = input.value.trim();
      if (!value) {
        target.querySelector('#searchResults').innerHTML = '<div class="empty-state">Search apps or notes.</div>';
        return;
      }
      const appMatches = appOrder.filter((appId) => appData[appId].label.toLowerCase().includes(value.toLowerCase()));
      const noteMatches = state.notes.filter((note) => note.title.toLowerCase().includes(value.toLowerCase()) || note.content.toLowerCase().includes(value.toLowerCase()));
      const results = [...appMatches.map((id) => ({ id, label: appData[id].label, type: 'App', detail: 'System application' })), ...noteMatches.map((note) => ({ id: `note-${note.id}`, label: note.title, type: 'Note', detail: note.content.slice(0, 32) }))];

      target.querySelector('#searchResults').innerHTML = results.length
        ? results.map((item) => `
            <button class="result-item" type="button" data-search-result="${item.id}">
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <small>${item.type}</small>
              </div>
              <span class="glyph-badge">${item.type === 'App' ? '⚙️' : '📝'}</span>
            </button>
          `).join('')
        : '<div class="empty-state">No results found.</div>';

      target.querySelectorAll('[data-search-result]').forEach((button) => {
        button.addEventListener('click', () => {
          const resultId = button.dataset.searchResult;
          if (resultId.startsWith('note-')) {
            const noteId = resultId.replace('note-', '');
            state.selectedNoteId = noteId;
            openApp('notes');
          } else {
            openApp(resultId);
          }
        });
      });
    });

    return;
  }

  if (appId === 'notifications') {
    target.innerHTML = `
      <div class="window-section">
        <div class="notification-list">
          ${state.notifications.length
            ? state.notifications
                .map(
                  (item) => `
                    <div class="notification-item ${item.tone}">
                      <div>${item.message}</div>
                      <small>${new Date(item.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty-state">You are all caught up.</div>'}
        </div>
      </div>
    `;
    return;
  }

  target.innerHTML = '<div class="empty-state">Application content unavailable.</div>';
}

function renderNotesWindow() {
  const openWindow = state.windows.find((entry) => entry.id === 'notes');
  if (!openWindow) return;
  const content = openWindow.element.querySelector('.window-content');
  renderAppContent('notes', content);
}

function renderSettingsWindow() {
  const openWindow = state.windows.find((entry) => entry.id === 'settings');
  if (!openWindow) return;
  const content = openWindow.element.querySelector('.window-content');
  renderAppContent('settings', content);
}

function renderGalleryWindow() {
  const openWindow = state.windows.find((entry) => entry.id === 'gallery');
  if (!openWindow) return;
  const content = openWindow.element.querySelector('.window-content');
  renderAppContent('gallery', content);
}

function renderNoteList(target, filter = '') {
  const filteredNotes = state.notes.filter((note) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return note.title.toLowerCase().includes(term) || note.content.toLowerCase().includes(term);
  });

  if (!filteredNotes.length) {
    target.innerHTML = '<div class="empty-state">No notes match your search.</div>';
    return;
  }

  target.innerHTML = filteredNotes
    .map(
      (note) => `
        <button type="button" class="note-item ${state.selectedNoteId === note.id ? 'active' : ''}" data-note-id="${note.id}">
          <span class="glyph-badge">📝</span>
          <span class="note-meta">
            <strong>${escapeHtml(note.title)}</strong>
            <small>${escapeHtml(note.content.slice(0, 52) || 'Untitled note')}</small>
          </span>
        </button>
      `
    )
    .join('');

  target.querySelectorAll('[data-note-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedNoteId = button.dataset.noteId;
      renderNoteList(target, filter);
      const selectedNote = state.notes.find((note) => note.id === state.selectedNoteId);
      const sameWindow = state.windows.find((entry) => entry.id === 'notes');
      if (!sameWindow) return;
      const content = sameWindow.element.querySelector('.window-content');
      const titleInput = content.querySelector('#noteTitle');
      const bodyInput = content.querySelector('#noteBody');
      if (titleInput && bodyInput) {
        titleInput.value = selectedNote ? selectedNote.title : '';
        bodyInput.value = selectedNote ? selectedNote.content : '';
      }
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getActivePalette() {
  return ['#74d9ff', '#b38cff', '#ff9bd1', '#091520'];
}

function renderStudioPalettePicker(target) {
  const paletteOptions = [
    ['#74d9ff', '#b38cff', '#ff9bd1', '#091520'],
    ['#70f0d4', '#8db6ff', '#ff9fc5', '#0f1728'],
    ['#ffae72', '#ffd969', '#ff9ad6', '#170d0d'],
    ['#c0d0ff', '#8fe1db', '#68d1ff', '#101a2b']
  ];

  target.innerHTML = paletteOptions
    .map(
      (palette, index) => `
        <button type="button" class="segment-item ${index === 0 ? 'active' : ''}" data-palette-index="${index}">
          <span style="display:inline-block; width:20px; height:12px; border-radius:999px; background:linear-gradient(135deg, ${palette[0]}, ${palette[1]}, ${palette[2]});"></span>
        </button>
      `
    )
    .join('');

  target.querySelectorAll('[data-palette-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.paletteIndex);
      const palette = paletteOptions[index];
      const canvasEl = document.querySelector('#studioCanvas');
      drawWallpaper(canvasEl, document.querySelector('#studioStyle').value, palette);
      target.querySelectorAll('.segment-item').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });
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
    const y = height * (0.25 + Math.sin(i * 1.4) * 0.2);
    const radius = 38 + i * 10;
    const glow = ctx.createRadialGradient(x, y, 10, x, y, radius);
    glow.addColorStop(0, `${palette[i % palette.length]}88`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  if (style === 'ribbons') {
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 30 + i * 26);
      for (let x = 0; x <= width; x += 32) {
        const y = 30 + i * 26 + Math.sin(x * 0.03 + i) * 30;
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2 + (i % 3);
      ctx.strokeStyle = `${palette[i % palette.length]}aa`;
      ctx.stroke();
    }
  }

  if (style === 'grid') {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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
      const y = height * 0.5 + Math.sin(x * 0.05) * 54;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `${palette[0]}cc`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function applyWallpaperById(wallpaperId) {
  const wallpaper = wallpaperPresets.find((item) => item.id === wallpaperId) || wallpaperPresets[0];
  if (isWebGLReady && scene) {
    const gradientColor = new THREE.Color(wallpaper.colors[0]);
    scene.background = new THREE.Color(wallpaper.colors[3]);
    if (glassCore) {
      glassCore.material.color.set(wallpaper.colors[0]);
    }
  }

  if (document.body) {
    document.body.style.background = `radial-gradient(circle at 20% 20%, ${wallpaper.colors[1]}33, transparent 25%), linear-gradient(180deg, ${wallpaper.colors[3]}, #090f1d 58%)`;
  }
}

function setupScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
  } catch (error) {
    console.warn('WebGL init failed:', error);
    fallbackNotice.classList.remove('hidden');
    return;
  }

  isWebGLReady = true;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050b12, 9, 24);

  camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.4, 8);

  const ambient = new THREE.AmbientLight(0xbfe8ff, 1.2);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0x8adfff, 1.8);
  keyLight.position.set(4, 5, 7);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xca98ff, 14, 25, 2);
  rimLight.position.set(-4, -2, 4);
  scene.add(rimLight);

  const telemetryGroup = new THREE.Group();
  scene.add(telemetryGroup);

  glassCore = new THREE.Mesh(
    new RoundedBoxGeometry(2.6, 2.2, 1.8, 6, 0.34),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(state.settings.accent),
      metalness: 0.18,
      roughness: 0.12,
      transmission: 1,
      thickness: 1.2,
      ior: 1.32,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.5,
      reflectivity: 0.9
    })
  );
  telemetryGroup.add(glassCore);

  innerCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    new THREE.MeshStandardMaterial({
      color: 0xeaf9ff,
      emissive: new THREE.Color(state.settings.accentAlt),
      emissiveIntensity: 0.94,
      transparent: true,
      opacity: 0.7,
      metalness: 0.2,
      roughness: 0.18
    })
  );
  telemetryGroup.add(innerCore);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.05, 16, 100),
    new THREE.MeshStandardMaterial({ color: 0x9cc5ff, emissive: 0x6dc5ff, emissiveIntensity: 0.4 })
  );
  ring.rotation.x = Math.PI / 2.5;
  ring.rotation.y = Math.PI / 6;
  telemetryGroup.add(ring);

  ringGroup = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const ringPart = new THREE.Mesh(
      new THREE.TorusGeometry(3.1 + i * 0.6, 0.02, 8, 120),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x7fe6ff : 0xc99ff9, transparent: true, opacity: 0.45 })
    );
    ringPart.rotation.x = (i / 4) * Math.PI * 1.2;
    ringPart.rotation.y = (i / 4) * Math.PI;
    ringGroup.add(ringPart);
  }
  scene.add(ringGroup);

  const particlesGeo = new THREE.BufferGeometry();
  const particleCount = 480;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starMaterial = new THREE.PointsMaterial({
    color: 0xaedaff,
    size: 0.06,
    transparent: true,
    opacity: 0.8
  });
  const particles = new THREE.Points(particlesGeo, starMaterial);
  scene.add(particles);

  applyWallpaperById(state.wallpaperSelection);
}

function animateScene() {
  if (!isWebGLReady || !renderer || !scene || !camera) return;

  const reduced = state.settings.reducedMotion || document.hidden;
  const group = glassCore.parent;
  group.rotation.y += reduced ? 0.002 : 0.006;
  group.rotation.x = pointer.y * 0.6;
  group.rotation.z = pointer.x * 0.25;

  if (ringGroup) {
    ringGroup.rotation.x += reduced ? 0.001 : 0.004;
    ringGroup.rotation.y += reduced ? 0.0015 : 0.005;
  }

  if (innerCore) {
    innerCore.rotation.x += reduced ? 0.005 : 0.015;
    innerCore.rotation.y += reduced ? 0.007 : 0.02;
  }

  const targetX = pointer.x * 0.8;
  const targetY = pointer.y * 0.5;
  camera.position.x += (targetX - camera.position.x) * 0.04;
  camera.position.y += (targetY - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

function attachGlobalEvents() {
  document.getElementById('homeBtn').addEventListener('click', () => {
    homeScreen.classList.add('active');
    state.windows.forEach((entry) => entry.element.classList.remove('minimized'));
  });

  document.getElementById('launcherBtn').addEventListener('click', toggleLauncher);
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
    if (renderer && isWebGLReady) {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.settings.performanceMode ? 1.2 : 1.6));
    }
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pushNotification('Animation eased to save power', 'info');
    }
  });

  window.addEventListener('beforeunload', () => {
    if (renderer) {
      renderer.dispose();
    }
  });
}

function initApp() {
  renderWidgets();
  renderDock();
  renderLauncher();
  renderNotifications();
  updateClock();
  setInterval(updateClock, 1000 * 30);
  applyTheme();
  attachGlobalEvents();
  setupScene();
}

function init() {
  initApp();
  openApp('settings');
  if (isWebGLReady) {
    function loop() {
      animateScene();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
}

init();

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.launcherOpen) {
    toggleLauncher();
  }
  if (event.key === 'Escape' && state.notificationOpen) {
    toggleNotifications();
  }
});

window.handleCalculatorKeyboard = function (event) {
  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/', '%', '.', 'Backspace', 'Enter', 'Escape'];
  if (!allowedKeys.includes(event.key)) return;
  const display = document.querySelector('#calcDisplay');
  if (!display) return;

  if (event.key === 'Backspace') {
    state.calculatorValue = state.calculatorValue.length <= 1 ? '0' : state.calculatorValue.slice(0, -1);
  } else if (event.key === 'Escape') {
    state.calculatorValue = '0';
  } else if (event.key === 'Enter') {
    try {
      const sanitized = state.calculatorValue.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      const allowed = /^[0-9+\-*/%.\s()]+$/;
      if (!allowed.test(sanitized)) throw new Error('Invalid expression');
      state.calculatorValue = String(Function(`'use strict'; return (${sanitized})`)());
    } catch (error) {
      state.calculatorValue = 'Error';
      pushNotification('Calculator error: invalid expression', 'error');
    }
  } else {
    const nextValue = state.calculatorValue === '0' || state.calculatorValue === 'Error' ? event.key : `${state.calculatorValue}${event.key}`;
    state.calculatorValue = nextValue;
  }
  display.textContent = state.calculatorValue;
};

document.addEventListener('keydown', window.handleCalculatorKeyboard);

window.renderSettingsWindow = renderSettingsWindow;
window.renderGalleryWindow = renderGalleryWindow;
window.renderNotesWindow = renderNotesWindow;
window.renderLauncher = renderLauncher;
window.renderWidgets = renderWidgets;
window.renderNotifications = renderNotifications;
window.showToast = showToast;
window.pushNotification = pushNotification;

window.addEventListener('load', () => setTimeout(() => showToast('WonderOS ready'), 250));

export {};
