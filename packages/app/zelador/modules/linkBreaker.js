'use strict';

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const matter = require('gray-matter');
const { IGNORED_DIRS, SAFETY_BUFFER_MS } = require('../config/defaults');

// ─────────────────────────────────────────────────────────────────────────────
// Logger interno do módulo
// ─────────────────────────────────────────────────────────────────────────────
function log(msg, context = '') {
  const t = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const ctx = context ? ` [${context}]` : '';
  console.log(`[${t}] [linkBreaker]${ctx} ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// escapeRegex
// Escapa todos os caracteres especiais de regex antes de interpolar
// o nome da nota no pattern. CRÍTICO: sem esta função, nomes como
// "Nota (v2) - Draft" quebram a regex.
// ─────────────────────────────────────────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSearchPattern
// Regex para ENCONTRAR referências (usada em findAllReferences).
// Cobre as 6 variantes de wikilink do Obsidian:
//   [[Nota]]
//   [[Nota|Alias]]
//   [[Nota#Seção]]
//   [[Nota#Seção|Alias]]
//   [[Nota^block-id]]
//   [[Nota (v2) - Draft]]
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} noteName - Nome da nota sem extensão
* @returns {RegExp}
*/
function buildSearchPattern(noteName) {
  if (!noteName || typeof noteName !== 'string' || noteName.trim() === '') {
    throw new TypeError('buildSearchPattern: noteName deve ser uma string não-vazia');
  }
  const e = escapeRegex(noteName);
  // Grupo 1: fragmento opcional — heading (#Seção) OU block ref (^abc123)
  // Grupo 2: alias opcional (|Alias)
  return new RegExp(`\\[\\[${e}([#^][^\\]|]+)?(\\|[^\\]]+)?\\]\\]`, 'g');
}

// ─────────────────────────────────────────────────────────────────────────────
// buildReplacePattern
// Regex + replacer para SUBSTITUIR wikilinks por texto simples.
// Regra de substituição:
//   [[Nota|Alias]]     → "Alias"    (o alias tem precedência)
//   [[Nota#Seção]]     → "Nota"     (nome da nota sem heading)
//   [[Nota]]           → "Nota"     (caso base)
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} noteName
* @returns {{ pattern: RegExp, replacer: function }}
*/
function buildReplacePattern(noteName) {
  if (!noteName || typeof noteName !== 'string' || noteName.trim() === '') {
    throw new TypeError('buildReplacePattern: noteName deve ser uma string não-vazia');
  }
  const e = escapeRegex(noteName);
  // Fragmento: aceita tanto heading (#Seção) quanto block ref (^abc123)
  // Grupo 1 captura: alias (conteúdo após |)
  const pattern = new RegExp(
    `\\[\\[${e}(?:[#^][^\\]|]+)?(?:\\|([^\\]]+))?\\]\\]`,
    'g'
 );
  const replacer = (_match, alias) => (alias ? alias.trim() : noteName);
  return { pattern, replacer };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de filtragem
// ─────────────────────────────────────────────────────────────────────────────

/**
* Retorna true se o arquivo deve ser ignorado pelo linkBreaker.
* - Pastas protegidas pelo sistema
* - Modificado nas últimas 24h (buffer de segurança)
* - Não é.md
*/
function shouldSkipFile(filePath, decayingFilePath) {
  // Nunca toca a própria nota decaída — frontmatter.js cuida dela
  if (filePath === decayingFilePath) return true;

  // Verifica pastas protegidas na hierarquia do path
  for (const dir of IGNORED_DIRS) {
    if (filePath.includes(`/${dir}/`) || filePath.includes(`${path.sep}${dir}${path.sep}`)) {
      return true;
    }
  }

  // Buffer de segurança: arquivos editados nas últimas 24h
  try {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtime.getTime() < SAFETY_BUFFER_MS) {
      return true;
    }
  } catch (_) {
    return true; // não conseguiu ler o stat → pular com segurança
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// findAllReferences
// Varre o vault e retorna todos os arquivos que contêm [[noteName]]
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} vaultPath
* @param {string} noteName
* @param {string} decayingFilePath - Caminho da nota decaída (excluída da busca)
* @returns {Promise<Array<{filePath: string, occurrences: number}>>}
*/
async function findAllReferences(vaultPath, noteName, decayingFilePath) {
  const ignorePatterns = IGNORED_DIRS.map(dir => `**/${dir}/**`);

  const files = await glob('**/*.md', {
    cwd: vaultPath,
    absolute: true,
    ignore: ignorePatterns,
    dot: false,
  });

  const searchPattern = buildSearchPattern(noteName);
  const results = [];

  for (const filePath of files) {
    if (shouldSkipFile(filePath, decayingFilePath)) continue;

    let content;
    try {
      content = fs.readFileSync(filePath, { encoding: 'utf-8' });
    } catch (err) {
      log(`Sem permissão de leitura em ${path.basename(filePath)}: ${err.message}`, noteName);
      continue;
    }

    // Reseta o índice da regex global antes de cada uso
    searchPattern.lastIndex = 0;
    const matches = content.match(searchPattern);

    if (matches && matches.length > 0) {
      results.push({ filePath, occurrences: matches.length });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// breakLinks
// Principal função pública: substitui todos os wikilinks [[noteName]]
// por texto simples em todos os arquivos do vault.
//
// ATENÇÃO: esta função modifica arquivos FORA da nota decaída.
//              Sempre chamada APÓS git.commitSnapshot().
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} vaultPath
* @param {string} noteName
* @param {string} decayingFilePath - Excluída da varredura
* @returns {Promise<{ filesModified: number, totalLinksRemoved: number }>}
*/
async function breakLinks(vaultPath, noteName, decayingFilePath) {
  log(`Iniciando quebra de links para: "${noteName}" (vault: ${vaultPath})`, noteName);

  const refs = await findAllReferences(vaultPath, noteName, decayingFilePath);

  if (refs.length === 0) {
    log('Nenhuma referência encontrada no vault. Nada a modificar.', noteName);
    return { filesModified: 0, totalLinksRemoved: 0 };
  }

  const { pattern, replacer } = buildReplacePattern(noteName);
  let filesModified = 0;
  let totalLinksRemoved = 0;

  for (const { filePath, occurrences } of refs) {
    let content;
    try {
      content = fs.readFileSync(filePath, { encoding: 'utf-8' });
    } catch (err) {
      log(`Erro ao ler ${path.basename(filePath)}: ${err.message}`, noteName);
      continue;
    }

    // Reseta o índice da regex global
    pattern.lastIndex = 0;
    const newContent = content.replace(pattern, replacer);

    // Só grava se houve mudança — preserva mtime de arquivos sem referências reais
    if (newContent !== content) {
      try {
        fs.writeFileSync(filePath, newContent, { encoding: 'utf-8' });
        filesModified++;
        totalLinksRemoved += occurrences;
        log(`✂${path.basename(filePath)}: ${occurrences} link(s) removido(s)`, noteName);
      } catch (err) {
        log(`Erro ao escrever ${path.basename(filePath)}: ${err.message}`, noteName);
      }
    }
  }

  log(`Concluído: ${filesModified} arquivo(s) modificado(s), ${totalLinksRemoved} link(s) removido(s).`, noteName);
  return { filesModified, totalLinksRemoved };
}

module.exports = {
  buildSearchPattern,
  buildReplacePattern,
  findAllReferences,
  breakLinks,
  escapeRegex, // exportada para facilitar testes unitários futuros
};
