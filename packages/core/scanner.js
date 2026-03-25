'use strict';

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { readFrontmatter } = require('./frontmatter');
const { IGNORED_DIRS, SAFETY_BUFFER_MS } = require('./defaults');
const git = require('./git');

function getInactivityMs(filePath, stat, vaultPath) {
  try {
    const fm = readFrontmatter(filePath).data;
    if (fm.decay_since) {
      const decaySince = new Date(fm.decay_since).getTime();
      if (!isNaN(decaySince)) {
        return Date.now() - decaySince;
      }
    }
  } catch (_) {}

  // Fallback: Tentar data do último commit se for um repo Git
  if (git.isGitRepo(vaultPath)) {
    const lastCommitMs = git.getFileLastCommitDate(vaultPath, filePath);
    if (lastCommitMs) {
      return Date.now() - lastCommitMs;
    }
  }

  // Fallback final: mtime (que pode ser impreciso após um commit Git)
  return Date.now() - stat.mtimeMs;
}

/**
* Varre o vault em busca de todos os arquivos.md,
* excluindo pastas protegidas e arquivos muito recentes (buffer de segurança).
*
* @param {string} vaultPath - Caminho absoluto para a raiz do vault
* @returns {Promise<Array<{filePath: string, mtime: Date, inactivityMs: number}>>}
*/
async function scanVault(vaultPath) {
  const now = Date.now();

  // Monta o padrão de exclusão para pastas protegidas
  const ignorePatterns = IGNORED_DIRS.map(dir => `**/${dir}/**`);
  // Também ignora o PURGATORIO.md diretamente (mas ele tem decay_immune, então seria filtrado de qualquer forma)

  const files = await glob('**/*.md', {
    cwd: vaultPath,
    absolute: true,
    ignore: ignorePatterns,
    dot: false, // ignora arquivos/pastas que começam com ponto
  });

  const results = [];

  for (const filePath of files) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (err) {
      // Arquivo pode ter sido removido entre o glob e o stat — ignorar silenciosamente
      log(`Não foi possível ler stat de ${filePath}: ${err.message}`);
      continue;
    }

    const inactivityMs = getInactivityMs(filePath, stat, vaultPath);

    // Buffer de segurança: ignora arquivos modificados nas últimas 24h
    // Protege contra notas que estão sendo editadas agora
    if (inactivityMs < SAFETY_BUFFER_MS) {
      continue;
    }

    results.push({
      filePath,
      mtime: stat.mtime,
      inactivityMs,
    });
  }

  return results;
}

/**
* Retorna o caminho relativo de um arquivo em relação ao vault.
* Útil para logs e para resolução de config por pasta.
*
* @param {string} vaultPath
* @param {string} filePath
* @returns {string} ex: "/fleeting/minha-nota.md"
*/
function getRelativePath(vaultPath, filePath) {
  return '/' + path.relative(vaultPath, filePath);
}

/**
* Retorna apenas o nome da nota sem extensão e sem caminho.
* Usado para wikilinks e mensagens de log.
*
* @param {string} filePath
* @returns {string} ex: "Ideia App Restaurante"
*/
function getNoteTitle(filePath) {
  return path.basename(filePath, '.md');
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

module.exports = { scanVault, getRelativePath, getNoteTitle };
