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

    const fs     = require('fs');
    const path   = require('path');
    let matter;
    try {
      matter = require('gray-matter');
    } catch {
      matter = require(path.join(__dirname, '../../zelador/node_modules/gray-matter'));
    }

    const IGNORED = new Set(['_fossilized', '.zelador', 'node_modules',
                              'electron', 'renderer', '.obsidian', '.git',
                              '__pycache__', '.DS_Store']);

    function walk(dir, base) {
      let result = [];
      let entries;
      try { entries = fs.readdirSync(dir); } catch { return result; }
      for (const e of entries) {
        if (IGNORED.has(e) || e.startsWith('.')) continue;
        const full = path.join(dir, e);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) result = result.concat(walk(full, base));
          else if (e.endsWith('.md')) result.push({ full, rel: path.relative(base, full) });
        } catch { /* ignora */ }
      }
      return result;
    }

    try {
      const files  = walk(vaultPath, vaultPath);
      const nodes  = [];
      const nameMap = {};
      const edgeList = [];

      for (const { full, rel } of files) {
        let data = {}, content = '';
        try {
          const raw = fs.readFileSync(full, 'utf-8');
          const parsed = matter(raw);
          data = parsed.data || {};
          content = parsed.content || '';
        } catch { continue; }

        const name = path.basename(rel, '.md');

        const phase =
          data.status === 'fossilized' ? 'fossil' :
          data.decay_level >= 3        ? 'f3'     :
          data.decay_level === 2       ? 'f2'     :
          data.decay_level === 1       ? 'f1'     : 'alive';

        nodes.push({ id: rel, name, phase, immune: !!data.decay_immune, filePath: full });
        nameMap[name.toLowerCase()] = rel;

        const links = [...content.matchAll(/\[\[([^\]|#^]+)/g)].map(m => m[1].trim().toLowerCase());
        for (const link of links) edgeList.push({ source: rel, targetName: link });
      }

      const edges = edgeList
        .filter(e => nameMap[e.targetName] && nameMap[e.targetName] !== e.source)
        .map(e => ({ source: e.source, target: nameMap[e.targetName] }));

      console.log(`[graph] ${nodes.length} nós, ${edges.length} arestas`);
      return { nodes, edges };
    } catch (e) {
      console.error('[ipc] Erro ao ler dados do grafo:', e);
      return { nodes: [], edges: [] };
    }
  });

  // ── Git Sync Manual ──────────────────────────────────────────────────────
  ipcMain.handle('git:sync', async () => {
    if (!store) return { success: false, error: 'No store' };
    const vaultPath = store.get('vaultPath');
    if (!vaultPath) return { success: false, error: 'Vault não configurado' };

    try {
      const syncManager = require(path.join(__dirname, '../../zelador/modules/syncManager'));
      
      const pullRes = syncManager.pull(vaultPath);
      if (!pullRes.success && !pullRes.skipped) {
        return { success: false, error: pullRes.error || 'Erro no pull' };
      }

      const pushRes = syncManager.push(vaultPath);
      if (!pushRes.success && !pushRes.skipped) {
        return { success: false, error: pushRes.error || 'Erro no push' };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Semantic Links (Ollama) ────────────────────────────────────────────────
  ipcMain.handle('graph:check-ollama', async () => {
    try {
      const semanticLinks = require(path.join(__dirname, '../../zelador/modules/semanticLinks'));
      return await semanticLinks.checkOllama();
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('graph:analyze-semantics', async () => {
    if (!store) return { success: false, error: 'No store' };
    const vaultPath = store.get('vaultPath');
    if (!vaultPath) return { success: false, error: 'Vault não configurado' };

    try {
      const semanticLinks = require(path.join(__dirname, '../../zelador/modules/semanticLinks'));
      const isOllamaUp = await semanticLinks.checkOllama();
      if (!isOllamaUp) return { success: false, error: 'Ollama is not running or missing nomic-embed-text.' };

      const { scanVault } = require(path.join(__dirname, '../../zelador/modules/scanner'));
      const files = await scanVault(vaultPath);

      const connections = await semanticLinks.analyzeConnections(vaultPath, files);
      return { success: true, connections };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { register, runZeladorProcess };
