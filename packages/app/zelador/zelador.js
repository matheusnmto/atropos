'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const fs = require('fs');
const {
  acquireLock,
  registerExitHandlers,
  scanVault,
  getRelativePath,
  getNoteTitle,
  readFrontmatter,
  isDecayImmune,
  getDecayLevel,
  determinePhase,
  applyPhase1,
  applyPhase2,
  applyPhase3,
  updateState,
  generatePurgatory,
  defaults: { DEFAULTS, DECAY_CONFIG_FILE, ZELADOR_DIR },
} = require('@atropos/core');
const { loadConfig, resolveConfig } = require('./modules/configLoader');
const syncManager = require('./modules/syncManager');

// ─────────────────────────────────────────────────────────────────────────────
// Configuração de paths
// zelador/ fica dentro do vault — o vault é um nível acima
// ─────────────────────────────────────────────────────────────────────────────
const VAULT_PATH = process.env.ZELADOR_VAULT_OVERRIDE || path.resolve(__dirname, '..');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}


// ─────────────────────────────────────────────────────────────────────────────
// ensureZeladorDir — Cria /.zelador/ se não existe
// ─────────────────────────────────────────────────────────────────────────────
function ensureZeladorDir() {
  const dir = path.join(VAULT_PATH, ZELADOR_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  log('Zelador iniciando...');
  log(`Vault: ${VAULT_PATH}`);

  registerExitHandlers();
  acquireLock();
  ensureZeladorDir();

  // ── Carrega configuração ──
  const config = loadConfig(VAULT_PATH);
  log(`Configuração: ${Object.keys(config.folders || {}).length} pasta(s) configurada(s).`);

  // ── Varre o vault ──
  log('Varrendo vault...');
  const files = await scanVault(VAULT_PATH);
  log(`${files.length} arquivo(s) avaliado(s).`);

  // Contadores para o relatório final
  const stats = {
    phase1: 0,
    phase2: 0,
    phase3: 0,
    skipped_immune: 0,
    skipped_already: 0,
    skipped_below_threshold: 0,
    errors: 0,
  };

  // ── Processa cada arquivo ──
  for (const { filePath, inactivityMs } of files) {
    const relativePath = getRelativePath(VAULT_PATH, filePath);
    const noteTitle = getNoteTitle(filePath);

    let frontmatterData;
    try {
      frontmatterData = readFrontmatter(filePath).data;
    } catch (err) {
      log(`Erro ao ler frontmatter de ${relativePath}: ${err.message}`);
      stats.errors++;
      continue;
    }

    // ── Imunidade por frontmatter (ANTES do mtime) ──
    if (isDecayImmune(frontmatterData)) {
      stats.skipped_immune++;
      continue;
    }

    // ── Resolve config da pasta ──
    let effectiveConfig = resolveConfig(relativePath, config);

    // ── Aplicar calendar decay se habilitado nas configurações ──
    if (config.global.calendar_decay !== false) {
      const { applyCalendarDecay } = require('./modules/calendarDecay');
      effectiveConfig = applyCalendarDecay(effectiveConfig, filePath);
      if (effectiveConfig._calendarAccelerated) {
        log(`[calendar] ${noteTitle}: decay ${effectiveConfig._calendarMultiplier}x mais rápido (data expirada detectada)`);
      }
    }

    // ── Imunidade por pasta ──
    if (effectiveConfig.decay_immune === true) {
      stats.skipped_immune++;
      continue;
    }

    const phase = determinePhase(inactivityMs, effectiveConfig);

    if (phase === null) {
      stats.skipped_below_threshold++;
      continue;
    }

    const currentLevel = getDecayLevel(frontmatterData);

    try {
      // ── FASE 1 ──
      if (phase === 1) {
        const applied = applyPhase1(filePath, frontmatterData, inactivityMs);
        if (applied) stats.phase1++;
        else stats.skipped_already++;

      // ── FASE 2 ──
      } else if (phase === 2) {
        if (currentLevel >= 2) {
          stats.skipped_already++;
          continue;
        }
        const result = await applyPhase2(filePath, VAULT_PATH, frontmatterData, inactivityMs);
        if (result.success) {
          stats.phase2++;
          log(`[F2] ${noteTitle}: ${result.filesModified} arquivo(s), ${result.linksRemoved} link(s) removido(s)`);
        } else if (result.error !== 'already_processed') {
          stats.errors++;
          log(`[F2] ERRO ${noteTitle}: ${result.error}`);
        } else {
          stats.skipped_already++;
        }

      // -- FASE 3 --
      } else if (phase === 3) {
        if (currentLevel >= 3) {
          stats.skipped_already++;
          continue;
        }
        const f3result = await applyPhase3(filePath, VAULT_PATH, frontmatterData);
        if (f3result.success) {
          stats.phase3++;
          log(`[F3] ${noteTitle}: fossilizado -> ${f3result.fossilizedPath}`);
          log(`     Resumo: "${f3result.summary}"`);
        } else if (f3result.error !== 'already_processed') {
          stats.errors++;
          log(`[F3] ERRO ${noteTitle}: ${f3result.error}`);
        } else {
          stats.skipped_already++;
        }
      }

    } catch (err) {
      log(`Erro ao processar ${relativePath}: ${err.message}`);
      stats.errors++;
    }
  }

  // -- Gera PURGATORIO.md --
  log('Atualizando PURGATORIO.md...');
  try {
    const { items } = await generatePurgatory(VAULT_PATH, config, resolveConfig);
    log(`Purgatorio: ${items} nota(s) listada(s).`);
  } catch (err) {
    log(`AVISO: Erro ao gerar PURGATORIO.md: ${err.message}`);
  }

  // -- Atualiza state.json --
  updateState(VAULT_PATH, { lastRun: new Date().toISOString() });

  // -- Relatorio final --
  log('');
  log('─────────────────────────────────────');
  log('RELATORIO DE EXECUCAO');
  log(`  Fase 1 (Estiagem):          ${stats.phase1}`);
  log(`  Fase 2 (Desconexao):        ${stats.phase2}`);
  log(`  Fase 3 (Dissolucao):        ${stats.phase3}`);
  log(`  Imunes (puladas):           ${stats.skipped_immune}`);
  log(`  Ja processadas:             ${stats.skipped_already}`);
  log(`  Abaixo do threshold:        ${stats.skipped_below_threshold}`);
  log(`  Erros:                      ${stats.errors}`);
  log('─────────────────────────────────────');
  log('Zelador finalizado.');
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
