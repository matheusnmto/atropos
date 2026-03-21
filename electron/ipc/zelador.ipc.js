'use strict';

const { ipcMain } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─────────────────────────────────────────────────────────────────────────────
// zelador.ipc.js — Handlers IPC para operações do Zelador
//
// O Zelador é executado em processo filho separado (fork) para não bloquear
// a UI do Electron. Os logs são coletados e disponibilizados para o renderer.
// ─────────────────────────────────────────────────────────────────────────────

const ZELADOR_SCRIPT = path.join(__dirname, '..', '..', 'zelador', 'zelador.js');
const MAX_LOG_LINES = 500;

// Buffer de logs compartilhado
const logBuffer = [];
let activeProcess = null;

/**
* Adiciona uma linha ao buffer de logs, limitando ao tamanho máximo.
* @param {string} line
*/
function addLog(line) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
}

/**
* Executa o zelador.js em processo filho separado.
* Coleta stdout/stderr no buffer de logs.
*
* @param {string} vaultPath - Caminho do vault (sobrescreve o padrão do zelador.js)
* @returns {Promise<void>} Resolve quando o processo termina com sucesso
*/
async function runZeladorProcess(vaultPath, store) {
  return new Promise(async (resolve, reject) => {
    if (activeProcess) {
      const msg = '[zelador.ipc] Zelador já está em execução. Aguarde.';
      addLog(msg);
      return reject(new Error(msg));
    }

    addLog(`[${new Date().toISOString()}] Iniciando Zelador...`);

    // -- Buscar API key do keychain antes de spawnar --
    let apiKey = '';
    const provider = (store && store.get('provider')) || 'google';
    try {
      const keytar = require('keytar');
      const accountName = provider === 'anthropic' ? 'anthropic-key' : 'google-key';
      apiKey = (await keytar.getPassword('grafo-liquido', accountName)) || '';
    } catch (err) {
      addLog(`[zelador.ipc] Aviso: não foi possível ler keychain: ${err.message}`);
    }

    const env = {
      ...process.env,
      ZELADOR_VAULT_OVERRIDE: vaultPath || '',
      AI_PROVIDER:        provider,
      GOOGLE_AI_API_KEY:  provider === 'google'    ? apiKey : '',
      ANTHROPIC_API_KEY:  provider === 'anthropic' ? apiKey : '',
    };

    activeProcess = fork(ZELADOR_SCRIPT, [], {
      env,
      silent: true, // captura stdout/stderr via eventos
    });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(addLog);
    });

    activeProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(l => addLog(`[ERR] ${l}`));
    });

    activeProcess.on('close', (code) => {
      activeProcess = null;
      if (code === 0) {
        addLog(`[${new Date().toISOString()}] Zelador finalizado com sucesso.`);
        resolve();
      } else {
        const msg = `[${new Date().toISOString()}] Zelador encerrou com código ${code}.`;
        addLog(msg);
        reject(new Error(msg));
      }
    });

    activeProcess.on('error', (err) => {
      activeProcess = null;
      const msg = `[zelador.ipc] Erro ao iniciar processo: ${err.message}`;
      addLog(msg);
      reject(new Error(msg));
    });
  });
}

/**
* Registra os handlers IPC do Zelador no ipcMain.
*
* @param {Electron.IpcMain} ipcMain
* @param {function} getStatusFn - Retorna { status, lastRunAt, nextRunAt }
* @param {function} runNowFn    - Dispara execução manual
*/
function register(ipcMain, getStatusFn, runNowFn, store) {
  ipcMain.handle('zelador:run-now', async () => {
    await runNowFn();
  });

  ipcMain.handle('zelador:get-status', () => {
    return getStatusFn();
  });

  ipcMain.handle('zelador:get-logs', () => {
    return [...logBuffer]; // cópia defensiva
  });

  ipcMain.handle('zelador:kill', () => {
    if (activeProcess) {
      activeProcess.kill('SIGTERM');
      activeProcess = null;
      addLog(`[${new Date().toISOString()}] Zelador interrompido manualmente.`);
    }
  });

  // ── Integração Obsidian ──────────────────────────────────────────────────
  ipcMain.handle('obsidian:open', async (_, filePath) => {
    if (!store) return { success: false, error: 'No store' };
    const vaultPath = store.get('vaultPath');
    if (!vaultPath) return { success: false, error: 'Vault não configurado' };

    const { shell } = require('electron');
    const vaultName = path.basename(vaultPath);
    // Removemos a extensão .md e montamos relative path
    const relative = path.relative(vaultPath, filePath)
      .replace(/\\/g, '/')
      .replace(/\.md$/, '');
    
    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relative)}`;
    await shell.openExternal(uri);
    return { success: true };
  });

  // ── Fix 2: lista notas fossilizadas reais de _fossilized/ ────────────────
  ipcMain.handle('fossilized:list', () => {
    if (!store) return [];
    const vaultPath = store.get('vaultPath');
    if (!vaultPath) return [];

    const fossilizedDir = path.join(vaultPath, '_fossilized');
    if (!fs.existsSync(fossilizedDir)) return [];

    const results = [];

    let months = [];
    try {
      months = fs.readdirSync(fossilizedDir).filter(d => {
        try { return fs.statSync(path.join(fossilizedDir, d)).isDirectory(); }
        catch { return false; }
      });
    } catch { return []; }

    for (const month of months) {
      const monthDir = path.join(fossilizedDir, month);
      let files = [];
      try { files = fs.readdirSync(monthDir).filter(f => f.endsWith('.md')); }
      catch { continue; }

      for (const file of files) {
        const filePath = path.join(monthDir, file);
        try {
          const stat    = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf-8');

          const summaryMatch    = content.match(/\*\*Resumo:\*\*\s*(.+)/);
          const dateMatch       = content.match(/fossilized_at:\s*(.+)/);

          results.push({
            fileName:    file.replace('.md', ''),
            filePath,
            month,
            fossilizedAt: dateMatch ? dateMatch[1].trim() : month,
            summary:     summaryMatch ? summaryMatch[1].trim() : null,
            size:        stat.size,
          });
        } catch { /* ignora arquivos ilegíveis */ }
      }
    }

    return results.sort((a, b) => b.fossilizedAt.localeCompare(a.fossilizedAt));
  });

  // ── Grafo Visual STUB (D3) ────────────────────────────────────────────────
  ipcMain.handle('graph:data', async () => {
    if (!store) return { nodes: [], edges: [] };
    const vaultPath = store.get('vaultPath');
    if (!vaultPath) return { nodes: [], edges: [] };

    const fs = require('fs');
    const path = require('path');
    const matter = require('gray-matter');
    const { globSync } = require('glob');

    try {
      const files = globSync('**/*.md', {
        cwd: vaultPath,
        ignore: ['_fossilized/**', '.zelador/**', 'node_modules/**', '**/.*/**'],
      });

      const nodes = [];
      const edges = [];
      const nameMap = {};

      for (const f of files) {
        const fp = path.join(vaultPath, f);
        const content = fs.readFileSync(fp, 'utf-8');
        const { data } = matter(content);
        const name = path.basename(f, '.md');
        nameMap[name] = f;
        
        let phase = 'alive';
        if (data.status === 'fossilized') phase = 'fossil';
        else if (data.decay_level === 3) phase = 'f3';
        else if (data.decay_level === 2) phase = 'f2';
        else if (data.decay_level === 1) phase = 'f1';

        nodes.push({
          id: f,
          name,
          phase,
          immune: !!data.decay_immune,
        });

        // extrair wikilinks [[Nome]]
        const links = [...content.matchAll(/\[\[([^\]|#^]+)/g)].map(m => m[1].trim());
        for (const link of links) {
          edges.push({ source: f, target: link });
        }
      }

      // resolver edges pelo nome (wikilinks comumente não incluem caminho)
      const resolved = edges
        .filter(e => nameMap[e.target])
        .map(e => ({ source: e.source, target: nameMap[e.target] }));

      return { nodes, edges: resolved };
    } catch (e) {
      console.error('[ipc] Erro ao ler dados do grafo:', e);
      return { nodes: [], edges: [] };
    }
  });
}

module.exports = { register, runZeladorProcess };
