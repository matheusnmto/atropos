'use strict';

const { ipcMain, dialog, shell } = require('electron');
const keytar = require('keytar');

const KEYTAR_SERVICE = 'grafo-liquido';
const KEYTAR_ACCOUNTS = {
  anthropic: 'anthropic-key',
  google: 'google-key',
};

// ─────────────────────────────────────────────────────────────────────────────
// config.ipc.js — Handlers IPC para configurações persistentes e API keys
//
// API keys são armazenadas no keychain do sistema via keytar.
// Configurações gerais vão para electron-store (vaultPath, schedule, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
* Registra todos os handlers IPC de configuração.
* @param {import('electron-store')} store - Instância do electron-store
*/
module.exports = function registerConfigHandlers(store) {

  // ── Leitura de config ─────────────────────────────────────────────────────
  ipcMain.handle('config:get', () => {
    return store.store; // Retorna toda a config de uma vez
  });

  // ── Escrita de config ─────────────────────────────────────────────────────
  ipcMain.handle('config:set', (_event, updates) => {
    if (typeof updates !== 'object' || updates === null) return;
    let scheduleChanged = false;
    for (const [key, value] of Object.entries(updates)) {
      store.set(key, value);
      if (key === 'schedule') scheduleChanged = true;
    }
    if (scheduleChanged) {
      const { app } = require('electron');
      app.emit('zelador-schedule-changed');
    }
  });

  // ── Seleção de pasta do vault via diálogo nativo ──────────────────────────
  ipcMain.handle('config:pick-vault-path', async (event) => {
    const browserWindow = require('electron').BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(browserWindow, {
      title: 'Selecione a pasta do seu vault Obsidian',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const vaultPath = result.filePaths[0];
    store.set('vaultPath', vaultPath);
    return vaultPath;
  });

  // ── API Keys via keytar (keychain do sistema) ─────────────────────────────

  ipcMain.handle('config:get-api-key', async (_event, provider) => {
    const account = KEYTAR_ACCOUNTS[provider];
    if (!account) return null;
    try {
      return await keytar.getPassword(KEYTAR_SERVICE, account);
    } catch (err) {
      console.error(`[config.ipc] Erro ao ler keychain (${provider}):`, err.message);
      return null;
    }
  });

  ipcMain.handle('config:validate-api-key', async (_event, provider, apiKey) => {
    try {
      const { validateKey } = require('../../zelador/modules/aiProvider');
      return await validateKey(provider, apiKey);
    } catch (err) {
      console.error(`[config.ipc] Erro ao validar chave (${provider}):`, err.message);
      return { valid: false, error: err.message };
    }
  });

  ipcMain.handle('config:set-api-key', async (_event, provider, apiKey) => {
    const account = KEYTAR_ACCOUNTS[provider];
    if (!account) throw new Error(`Provider desconhecido: ${provider}`);
    try {
      await keytar.setPassword(KEYTAR_SERVICE, account, apiKey);
    } catch (err) {
      console.error(`[config.ipc] Erro ao salvar keychain (${provider}):`, err.message);
      throw err;
    }
  });

  ipcMain.handle('config:delete-api-key', async (_event, provider) => {
    const account = KEYTAR_ACCOUNTS[provider];
    if (!account) throw new Error(`Provider desconhecido: ${provider}`);
    try {
      await keytar.deletePassword(KEYTAR_SERVICE, account);
    } catch (err) {
      console.error(`[config.ipc] Erro ao deletar keychain (${provider}):`, err.message);
    }
  });

  // ── Abre links externos no browser padrão ─────────────────────────────────
  ipcMain.handle('config:open-external', (_event, url) => {
    shell.openExternal(url);
  });
};
