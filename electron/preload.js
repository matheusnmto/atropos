'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// preload.js — Bridge segura entre Main Process e Renderer
//
// ipcRenderer NUNCA é exposto diretamente ao renderer.
// Apenas canais nomeados são permitidos.
// ─────────────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('zelador', {

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
});
