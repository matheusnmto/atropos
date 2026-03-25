'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// preload.js — Bridge segura entre Main Process e Renderer
//
// ipcRenderer NUNCA é exposto diretamente ao renderer.
// Apenas canais nomeados são permitidos.
// ─────────────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('zelador', {

  // ─── Platform & Window Controls ───────────────────────────────────────────
  getPlatform:    () => process.platform,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow:    () => ipcRenderer.invoke('window:close'),

  // ─── Config ───────────────────────────────────────────────────────────────
  getConfig:     ()          => ipcRenderer.invoke('config:get'),
  setConfig:     (updates)   => ipcRenderer.invoke('config:set', updates),
  pickVaultPath: ()          => ipcRenderer.invoke('config:pick-vault-path'),

  // ─── API Keys (keychain) ──────────────────────────────────────────────────
  getApiKey:    (provider)          => ipcRenderer.invoke('config:get-api-key', provider),
  validateApiKey: (provider, apiKey) => ipcRenderer.invoke('config:validate-api-key', provider, apiKey),
  setApiKey:    (provider, apiKey)  => ipcRenderer.invoke('config:set-api-key', provider, apiKey),
  deleteApiKey: (provider)          => ipcRenderer.invoke('config:delete-api-key', provider),

  // ─── Zelador ──────────────────────────────────────────────────────────────
  runNow:    () => ipcRenderer.invoke('zelador:run-now'),
  getStatus: () => ipcRenderer.invoke('zelador:get-status'),
  getLogs:   () => ipcRenderer.invoke('zelador:get-logs'),

  // ─── Eventos em tempo real ────────────────────────────────────────────────
  onStatusChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('zelador:status-change', handler);
    return () => ipcRenderer.removeListener('zelador:status-change', handler);
  },

  // ─── Integração externa ───────────────────────────────────────────────────
  getFossilized: () => ipcRenderer.invoke('fossilized:list'),
  openInObsidian: (filePath) => ipcRenderer.invoke('obsidian:open', filePath),
  getGraphData: () => ipcRenderer.invoke('graph:data'),
  getPurgatoryData: () => ipcRenderer.invoke('purgatory:get-data'),
  getMetrics: () => ipcRenderer.invoke('metrics:get-data'),

  // ─── Semantic & Sync ───────────────────────────────────────────────────────
  gitSync: () => ipcRenderer.invoke('git:sync'),
  checkOllama: () => ipcRenderer.invoke('graph:check-ollama'),
  analyzeSemantics: () => ipcRenderer.invoke('graph:analyze-semantics'),
  saveSemantics: (conns) => ipcRenderer.invoke('graph:save-semantics', conns),

  // ── Déjà Vu & Calendar ─────────────────────────────────────────────────────
  checkDejavu: () => ipcRenderer.invoke('dejavu:check'),
  analyzeCalendarDecay: (filePath) => ipcRenderer.invoke('calendar:analyze', filePath),

  // ── Note Management ────────────────────────────────────────────────────────
  getActiveNotes: () => ipcRenderer.invoke('notes:active'),
  getImmuneNotes: () => ipcRenderer.invoke('notes:immune'),
  immunizeNote: (filePath) => ipcRenderer.invoke('notes:immunize', filePath),
  removeImmunity: (filePath) => ipcRenderer.invoke('notes:remove-immunity', filePath)
});
