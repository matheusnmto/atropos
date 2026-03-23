'use strict';

const fs = require('fs');
const path = require('path');
const { scanVault } = require('./scanner');
const { readFrontmatter, getDecayLevel } = require('./frontmatter');

/**
 * Calcula métricas de saúde do vault (Total, Viva, F1, F2, F3, Fóssil)
 * 
 * @param {string} vaultPath 
 * @returns {Promise<Object>}
 */
async function getVaultMetrics(vaultPath) {
  const files = await scanVault(vaultPath);
  const metrics = {
    total: 0,
    alive: 0,
    f1: 0,
    f2: 0,
    f3: 0,
    fossil: 0
  };

  // Contar fósseis primeiro (estão em pasta separada por padrão)
  const fossilDir = path.join(vaultPath, '_fossilized');
  if (fs.existsSync(fossilDir)) {
    const walkFossils = (dir) => {
      let count = 0;
      const entries = fs.readdirSync(dir);
      for (const e of entries) {
        const full = path.join(dir, e);
        if (fs.statSync(full).isDirectory()) {
          count += walkFossils(full);
        } else if (e.endsWith('.md')) {
          count++;
        }
      }
      return count;
    };
    metrics.fossil = walkFossils(fossilDir);
  }

  for (const file of files) {
    metrics.total++;
    let fm;
    try {
      fm = readFrontmatter(file.filePath).data || {};
    } catch {
      metrics.alive++; // Fallback se der erro
      continue;
    }

    if (fm.status === 'fossilized') {
      // Já contamos fósseis via filesystem, mas se estiver aqui no scan (não deveria estar em _fossilized)
      metrics.fossil++;
      continue;
    }

    const level = getDecayLevel(fm);
    if (level === 1) metrics.f1++;
    else if (level === 2) metrics.f2++;
    else if (level === 3) metrics.f3++;
    else metrics.alive++;
  }

  // O total real inclui os fósseis
  metrics.total += metrics.fossil;

  return metrics;
}

module.exports = { getVaultMetrics };
