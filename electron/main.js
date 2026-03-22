'use strict';

const { app, BrowserWindow, ipcMain, nativeTheme, Tray } = require('electron');
const path  = require('path');
const Store  = require('electron-store');
const { setupTray } = require('./tray');

// ─── Configuração persistente via electron-store@6 (CJS) ──────────────────
// API keys NÃO ficam aqui — vão para o keychain via keytar.
const store = new Store({
  name: 'grafo-liquido-config',
  defaults: {
    vaultPath:     '',
    schedule:      { hour: 3, minute: 0 },
    provider:      'anthropic',
    theme:         'dark',
    onboarded:     false,
    notifications: true,
  },
});

// ─── Referências globais (evita GC) ───────────────────────────────────────
let mainWindow  = null;
let tray        = null;
let zeladorTimer = null;
let zeladorStatus = 'idle';  // 'idle' | 'running' | 'error'
let lastRunAt    = null;

// ─── Janela principal ─────────────────────────────────────────────────────
function createWindow() {
  nativeTheme.themeSource = store.get('theme') === 'light' ? 'light' : 'dark';

  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width:  900,
    height: 640,
    minWidth: 680,
    minHeight: 500,
    title: 'liquid-graph',
    backgroundColor: '#161616',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    frame: isMac ? true : false,
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: true,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Minimizar para tray ao fechar
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Permitir D3.js do jsdelivr CDN — CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:"
        ],
      },
    });
  });
}

// ─── Agendamento ──────────────────────────────────────────────────────────
function msUntilNextRun() {
  const s = store.get('schedule');
  const now  = new Date();
  const next = new Date();
  next.setHours(s.hour, s.minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function nextRunTimeString() {
  const s = store.get('schedule');
  return `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
}

async function runZelador() {
  const { runZeladorProcess } = require('./ipc/zelador.ipc');
  zeladorStatus = 'running';
  lastRunAt = new Date().toISOString();
  broadcast('zelador:status-change', { status: zeladorStatus, lastRunAt });

  try {
    await runZeladorProcess(store.get('vaultPath'), store);
    zeladorStatus = 'idle';
  } catch (err) {
    console.error('[main] Zelador error:', err.message);
    zeladorStatus = 'error';
  }

  broadcast('zelador:status-change', {
    status: zeladorStatus, lastRunAt, nextRunAt: nextRunTimeString(),
  });
}

function scheduleZelador() {
  if (zeladorTimer) clearTimeout(zeladorTimer);
  const delay = msUntilNextRun();
  console.log(`[main] Próxima execução: ${nextRunTimeString()} (em ${Math.round(delay / 60000)} min)`);
  zeladorTimer = setTimeout(async () => {
    await runZelador();
    scheduleZelador();
  }, delay);
}

function broadcast(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────
function registerIPCHandlers() {
  require('./ipc/config.ipc')(store);
  require('./ipc/zelador.ipc').register(ipcMain, () => ({
    zeladorStatus, lastRunAt, nextRunAt: nextRunTimeString(),
  }), runZelador, store);

  // Controles de janela para a custom titlebar (Windows/Linux)
  ipcMain.handle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });
  ipcMain.handle('window:maximize', () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  ipcMain.handle('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();

  tray = setupTray({
    mainWindow,
    getStatus: () => zeladorStatus,
    nextRunAt: nextRunTimeString,
    onRunNow: runZelador,
    onQuit: () => { mainWindow = null; app.exit(0); },
  });

  scheduleZelador();

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });

  app.on('zelador-schedule-changed', () => {
    console.log('[main] Reagendando Zelador baseado nas novas configurações...');
    scheduleZelador();
  });
});

app.on('window-all-closed', () => {}); // fica na tray
app.on('before-quit', () => { if (zeladorTimer) clearTimeout(zeladorTimer); });

module.exports = { store, nextRunTimeString };
