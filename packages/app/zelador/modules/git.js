'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// Logger interno do módulo de Git
// ─────────────────────────────────────────────────────────────────────────────
function log(msg) {
  const t = new Date().toISOString().slice(11, 19); // HH:MM:SS
  console.log(`[${t}] [git] ${msg}`);
}

/**
 * Executa um comando git no vault com timeout de 30s.
 * Retorna stdout como string. Lança erro em qualquer falha não tratada.
 *
 * @param {string[]} args - Argumentos do comando git (sem o prefixo 'git')
 * @param {string} vaultPath - Diretório de trabalho
 * @returns {string} stdout do comando
 */
function execGit(args, vaultPath) {
  const result = spawnSync('git', args, {
    cwd: vaultPath,
    timeout: 30000,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString().trim() : '';
    const error = new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }

  return result.stdout.toString().trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// isGitRepo
// Verifica se o vaultPath contém um repositório Git inicializado.
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} vaultPath
* @returns {boolean}
*/
function isGitRepo(vaultPath) {
  return fs.existsSync(path.join(vaultPath, '.git'));
}

// ─────────────────────────────────────────────────────────────────────────────
// checkCleanStatus
// Retorna true se há mudanças não commitadas (working tree "sujo").
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} vaultPath
* @returns {boolean} true = há mudanças pendentes
*/
function checkCleanStatus(vaultPath) {
  try {
    const output = execGit(['status', '--porcelain'], vaultPath);
    return output.length > 0; // qualquer linha = mudança pendente
  } catch (err) {
    log(`Não foi possível verificar status: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getLastCommitHash
// Retorna o hash curto do último commit.
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} vaultPath
* @returns {string|null} hash curto (7 chars) ou null se sem commits
*/
function getLastCommitHash(vaultPath) {
  try {
    return execGit(['rev-parse', '--short', 'HEAD'], vaultPath);
  } catch (err) {
    // Repositório sem commits ainda
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// commitSnapshot
// Faz git add -A + git commit com mensagem padronizada.
// Este é o backup obrigatório que DEVE preceder qualquer F2 ou F3.
//
// Retorno:
//   { success: true, commitHash, skipped: false }  — commit realizado
//   { success: true, commitHash: null, skipped: true } — nada a commitar
//   { success: false, commitHash: null, error }         — falha grave
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} vaultPath
* @param {string} noteName  - Nome do arquivo sem extensão (ex: "Minha Nota")
* @param {'F2'|'F3'} phase  - Fase que está sendo executada
* @returns {{ success: boolean, commitHash: string|null, skipped: boolean, error: string|null }}
*/
function commitSnapshot(vaultPath, noteName, phase) {
  // ── Pré-condição: git deve estar instalado ──
  try {
    spawnSync('git', ['--version'], { timeout: 5000, stdio: 'pipe' });
  } catch (_) {
    const error = 'Git não encontrado no PATH. Instale em: https://git-scm.com/downloads';
    log(`${error}`);
    return { success: false, commitHash: null, skipped: false, error };
  }

  // ── Pré-condição: repositório inicializado ──
  if (!isGitRepo(vaultPath)) {
    const error = `Repositório Git não encontrado em ${vaultPath}. Execute: git init`;
    log(`${error}`);
    return { success: false, commitHash: null, skipped: false, error };
  }

  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const message = `zelador: snapshot pre-${phase} ${date} "${noteName}"`;

  try {
    // Stage de todas as mudanças (novas, modificadas, deletadas)
    execGit(['add', '-A'], vaultPath);

    // Tentativa de commit
    execGit(['commit', '-m', message], vaultPath);

    const commitHash = getLastCommitHash(vaultPath);
    log(`Snapshot commitado: ${commitHash} — ${message}`);
    return { success: true, commitHash, skipped: false, error: null };

  } catch (err) {
    const output = err.stdout ? err.stdout.toString() : '';
    const stderr  = err.stderr ? err.stderr.toString() : '';

    // "nothing to commit" = vault já está limpo = situação normal
    if (
      output.includes('nothing to commit') ||
      stderr.includes('nothing to commit') ||
      (err.message || '').includes('nothing to commit')
   ) {
      log('Nada a commitar — vault já está limpo. Prosseguindo.');
      return { success: true, commitHash: null, skipped: true, error: null };
    }

    // Timeout
    if (err.signal === 'SIGTERM' || err.code === 'ETIMEDOUT') {
      const error = `Git timeout após 30s ao commitar "${noteName}"`;
      log(`${error}`);
      return { success: false, commitHash: null, skipped: false, error };
    }

    // Erro genérico — retorna falha, zelador vai abortar esta nota
    const error = `Git commit falhou: ${err.message || stderr}`;
    log(`${error}`);
    return { success: false, commitHash: null, skipped: false, error };
  }
}

/**
* Retorna o timestamp (ms) do último commit de um arquivo.
* Útil para detectar inatividade real quando mtime foi resetado pelo Git.
*
* @param {string} vaultPath
* @param {string} filePath - Caminho absoluto ou relativo ao vault
* @returns {number|null} timestamp em ms ou null se falhar
*/
function getFileLastCommitDate(vaultPath, filePath) {
  try {
    const relPath = path.relative(vaultPath, filePath);
    // %at = author date, unix timestamp
    const output = execGit(['log', '-1', '--format=%at', '--', relPath], vaultPath);
    const timestamp = parseInt(output);
    return isNaN(timestamp) ? null : timestamp * 1000;
  } catch (err) {
    // Pode falhar se o arquivo não estiver no Git ainda
    return null;
  }
}

module.exports = {
  isGitRepo,
  checkCleanStatus,
  getLastCommitHash,
  commitSnapshot,
  getFileLastCommitDate,
};
