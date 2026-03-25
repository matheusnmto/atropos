'use strict';

const path = require('path');
const fs = require('fs');
const { writeFrontmatter } = require('./frontmatter');
const { MS_PER_DAY, STATE_FILE } = require('../config/defaults');
const git = require('./git');
const linkBreaker = require('./linkBreaker');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toISODate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
* Logger com prefixo de fase e nome da nota.
* @param {string} phase - ex: 'F1', 'F2'
* @param {string} noteName
* @returns {function} logger
*/
function makeLogger(phase, noteName) {
  return (msg) => {
    const t = new Date().toISOString().slice(11, 19);
    console.log(`[${t}] [${phase}] [${noteName}] ${msg}`);
  };
}

/**
* Persiste informações parciais no state.json para auditoria.
* Não lança erro — falha silenciosa (state.json é diagnóstico, não crítico).
*
* @param {string} vaultPath
* @param {object} update - Campos a mesclar no state atual
*/
function updateState(vaultPath, update) {
  const statePath = path.join(vaultPath, STATE_FILE);
  try {
    let current = {};
    if (fs.existsSync(statePath)) {
      current = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
    const merged = {...current,...update, lastRun: new Date().toISOString() };
    fs.writeFileSync(statePath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (_) {
    // state.json é auxiliar — nunca aborta execução por isso
  }
}

/**
 * Garante que decay_since existe no frontmatter.
 * Se não existir, calcula baseado na inatividade real.
 * 
 * @param {object} currentData 
 * @param {number} inactivityMs 
 */
function ensureDecaySince(currentData, inactivityMs) {
  if (currentData.decay_since) return {};
  
  // Se não tem decay_since, calculamos a data retroativa baseada na inatividade
  const lastActivityDate = new Date(Date.now() - inactivityMs);
  return { decay_since: toISODate(lastActivityDate) };
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 — Estiagem (inatividade > phase1_days)
// REGRA CRÍTICA: NUNCA modifica o corpo da nota. Apenas YAML.
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} filePath
* @param {object} currentData - Frontmatter já parseado
* @param {number} inactivityMs
* @returns {boolean} true se a fase foi aplicada
*/
function applyPhase1(filePath, currentData, inactivityMs) {
  if ((currentData.decay_level ?? 0) >= 1) return false;

  const lastActivity = currentData.decay_since || toISODate(new Date(Date.now() - inactivityMs));
  writeFrontmatter(filePath, { 
    decay_level: 1, 
    decay_since: lastActivity 
  });

  const log = makeLogger('F1', path.basename(filePath, '.md'));
  log(`Estiagem iniciada. decay_since (retroativo): ${lastActivity}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Desconexão (inatividade > phase2_days)
//
// ATENÇÃO: esta é a única fase que modifica arquivos ALÉM da nota decaída.
//              O Git backup é obrigatório e não pode ser desativado.
//              Falha no commit = abortar toda a operação para esta nota.
//
// Sequência atômica OBRIGATÓRIA:
//   1. Git commit snapshot (ANTES de qualquer modificação)
//   2. Quebrar wikilinks em todo o vault
//   3. Atualizar frontmatter da nota decaída
//   4. Atualizar state.json
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} filePath    - Caminho absoluto da nota decaída
* @param {string} vaultPath   - Caminho raiz do vault
* @param {object} frontmatter - Frontmatter já parseado
* @param {number} inactivityMs
* @returns {Promise<{ success: boolean, filesModified: number, linksRemoved: number, commitHash: string|null, error: string|null }>}
*/
async function applyPhase2(filePath, vaultPath, frontmatter, inactivityMs) {
  const noteName = path.basename(filePath, '.md');
  const log = makeLogger('F2', noteName);

  // ── Pré-condição: nota não pode já estar em F2 ou F3 ──
  const currentLevel = frontmatter.decay_level ?? 0;
  if (currentLevel >= 2) {
    log(`Já está em nível ${currentLevel}. Pulando.`);
    return { success: false, filesModified: 0, linksRemoved: 0, commitHash: null, error: 'already_processed' };
  }

  // ── Pré-condição: Git deve estar disponível ──
  if (!git.isGitRepo(vaultPath)) {
    const error = `Git não inicializado em ${vaultPath}. Execute: git init`;
    log(`${error}`);
    return { success: false, filesModified: 0, linksRemoved: 0, commitHash: null, error };
  }

  // ── PASSO 1: Git commit ANTES de qualquer alteração ──
  log('Criando snapshot Git pré-F2...');
  const { success: gitOk, commitHash, skipped, error: gitError } = git.commitSnapshot(vaultPath, noteName, 'F2');

  if (!gitOk) {
    log(`Git falhou — ${gitError}. Abortando F2 para esta nota.`);
    return { success: false, filesModified: 0, linksRemoved: 0, commitHash: null, error: gitError };
  }

  log(`Snapshot: ${skipped ? '(nada a commitar — vault limpo)' : commitHash}`);

  // ── PASSO 2: Quebrar wikilinks em todo o vault ──
  log('Quebrando wikilinks...');
  let filesModified = 0;
  let linksRemoved = 0;

  try {
    const result = await linkBreaker.breakLinks(vaultPath, noteName, filePath);
    filesModified = result.filesModified;
    linksRemoved = result.totalLinksRemoved;
    log(`${filesModified} arquivo(s) modificado(s), ${linksRemoved} link(s) removido(s).`);
  } catch (err) {
    // Falha no linkBreaker — grave mas não catastrófica. Atualiza frontmatter mesmo assim.
    log(`Erro ao quebrar links: ${err.message}. Prosseguindo com atualização de frontmatter.`);
  }

  // ── PASSO 3: Atualizar frontmatter da nota decaída ──
  const today = toISODate();
  writeFrontmatter(filePath, {
    decay_level: 2,
    links_removed_at: today,
    ...ensureDecaySince(frontmatter, inactivityMs),
  });
  log(`Frontmatter atualizado: decay_level=2, links_removed_at=${today}`);

  // ── PASSO 4: Persistir no state.json ──
  updateState(vaultPath, {
    lastF2: { file: filePath, noteName, at: new Date().toISOString() },
  });

  log(`Fase 2 concluída. ${filesModified} arquivo(s) alterado(s).`);
  return { success: true, filesModified, linksRemoved, commitHash, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — Dissolução (inatividade > phase3_days)
// Implementada na Etapa 4 junto com aiCompressor.js e fossilizer.js
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {string} filePath       - Caminho absoluto da nota
* @param {string} vaultPath      - Raiz do vault
* @param {object} frontmatterData - Frontmatter ja parseado
* @returns {Promise<{ success: boolean, summary?: string, fossilizedPath?: string, error?: string }>}
*/
async function applyPhase3(filePath, vaultPath, frontmatterData) {
  const noteName = path.basename(filePath, '.md');
  const log      = makeLogger('F3', noteName);

  // -- Pre-condicao: nao reprocessar --
  if ((frontmatterData.decay_level ?? 0) >= 3) {
    log('Ja fossilizada (decay_level >= 3). Pulando.');
    return { success: false, error: 'already_processed' };
  }

  // -- PASSO 1: Git snapshot obrigatorio --
  if (git.isGitRepo(vaultPath)) {
    log('Criando snapshot Git pre-F3...');
    const { success: gitOk, commitHash, skipped, error: gitError } = git.commitSnapshot(vaultPath, noteName, 'F3');
    if (!gitOk) {
      log(`Git falhou: ${gitError}. Abortando F3.`);
      return { success: false, error: `Git falhou: ${gitError}` };
    }
    log(`Snapshot: ${skipped ? '(vault limpo)' : commitHash}`);
  }

  // -- PASSO 2: Ler conteudo completo da nota --
  let content;
  try {
    content = fs.readFileSync(filePath, { encoding: 'utf-8' });
  } catch (err) {
    return { success: false, error: `Falha ao ler arquivo: ${err.message}` };
  }

  // -- PASSO 3: Tentar compressão via IA — completamente opcional --
  let summary = null;
  const provider = process.env.AI_PROVIDER || 'google';
  const apiKey = provider === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.GOOGLE_AI_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const aiProvider = require('./aiProvider');
      summary = await aiProvider.compress(content, { provider, apiKey });
      log(`Resumo gerado: "${summary}"`);
    } catch (err) {
      // IA falhou mas não aborta — continua sem resumo
      log(`IA indisponível (${err.message}). Fossilizando sem resumo.`);
      summary = null;
    }
  } else {
    log(`Sem API key configurada para provider "${provider}". Fossilizando sem resumo.`);
  }

  // -- PASSO 5: Fossilizar (copia + nota leve) --
  const fossilizer = require('./fossilizer');
  const { fossilizedPath } = fossilizer.fossilize(filePath, vaultPath, summary);

  // Garante que o original fossilizado também tenha decay_since se faltava
  if (!frontmatterData.decay_since) {
    writeFrontmatter(fossilizedPath, { ...ensureDecaySince(frontmatterData, 30 * MS_PER_DAY) }); 
  }

  // -- PASSO 6: Registrar no state.json --
  updateState(vaultPath, {
    lastF3: { file: filePath, noteName, fossilizedPath, at: new Date().toISOString() },
  });

  log(`Fase 3 concluida. Original preservado em ${path.relative(vaultPath, fossilizedPath)}`);
  return { success: true, summary, fossilizedPath };
}

// ─────────────────────────────────────────────────────────────────────────────
// determinePhase
// Retorna qual fase deve ser aplicada com base na inatividade.
// Respeita skip_phases da configuração por pasta.
// ─────────────────────────────────────────────────────────────────────────────

/**
* @param {number} inactivityMs
* @param {object} config - { phase1_days, phase2_days, phase3_days, skip_phases? }
* @returns {number|null} 1, 2, 3 ou null
*/
function determinePhase(inactivityMs, config) {
  const skipPhases = config.skip_phases || [];
  const p3 = config.phase3_days* MS_PER_DAY;
  const p2 = config.phase2_days* MS_PER_DAY;
  const p1 = config.phase1_days* MS_PER_DAY;

  if (inactivityMs >= p3 && !skipPhases.includes(3)) return 3;
  if (inactivityMs >= p2 && !skipPhases.includes(2)) return 2;
  if (inactivityMs >= p1 && !skipPhases.includes(1)) return 1;
  return null;
}

module.exports = {
  applyPhase1,
  applyPhase2,
  applyPhase3,
  determinePhase,
  toISODate,
  updateState,
};
