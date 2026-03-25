'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// fossilizer.js — Gerencia a movimentação de arquivos na Fase 3 (Dissolução)
//
// Responsabilidade: operações de filesystem APENAS.
// A lógica de IA fica em aiProvider.js.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

function log(msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] [fossilizer] ${msg}`);
}

function toISODate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function toPTDate(date = new Date()) {
  return date.toLocaleDateString('pt-BR'); // DD/MM/YYYY
}

/**
* Fossiliza uma nota:
*   1. Copia o original para _fossilized/YYYY-MM/nome.md
*   2. Sobrescreve o original com uma nota leve contendo o resumo da IA
*
* @param {string} filePath   - Caminho absoluto da nota decaída
* @param {string} vaultPath  - Raiz do vault
* @param {string} summary    - Resumo gerado pela IA (uma frase)
* @returns {{ fossilizedPath: string, lightNotePath: string }}
*/
function fossilize(filePath, vaultPath, summary) {
  const now      = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const noteName  = path.basename(filePath);

  // ── Destino do arquivo original ──
  const fossilDir  = path.join(vaultPath, '_fossilized', yearMonth);
  const fossilPath = path.join(fossilDir, noteName);

  // ── Cria a pasta se não existir ──
  fs.mkdirSync(fossilDir, { recursive: true });

  // ── Copia o original (não remove antes — segurança) ──
  fs.copyFileSync(filePath, fossilPath);
  log(`Original copiado para: _fossilized/${yearMonth}/${noteName}`);

  // ── Caminho relativo para links internos no Obsidian ──
  const relFossilPath = `_fossilized/${yearMonth}/${noteName}`;
  const isoDate = toISODate(now);
  const ptDate  = toPTDate(now);

  // ── Linha de resumo — com ou sem IA ──
  const summaryLine = summary
    ? `>**Resumo:** ${summary}`
    : `>Resumo não disponível — provedor de IA não configurado.`;

  // ── Nota leve que substitui o original ──
  const lightContent = `---
decay_level: 3
status: fossilized
fossilized_at: ${isoDate}
original_path: ${relFossilPath}
decay_immune: true
---

> [!fossil] Nota dissolvida em ${ptDate}
${summaryLine}
> [Recuperar nota original](${relFossilPath})
`;

  fs.writeFileSync(filePath, lightContent, { encoding: 'utf-8' });
  log(`Nota leve criada em: ${path.relative(vaultPath, filePath)}`);

  return {
    fossilizedPath: fossilPath,
    lightNotePath:  filePath,
  };
}

module.exports = { fossilize };
