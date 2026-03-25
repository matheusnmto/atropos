'use strict';

const fs = require('fs');
const path = require('path');
const { readFrontmatter } = require('./frontmatter');

// Dirs the metrics system never counts as notes
const METRICS_IGNORED = new Set([
  '_fossilized', '.zelador', '.obsidian', '.git',
  'node_modules', 'electron', 'renderer', 'packages',
  '__pycache__', '.DS_Store',
]);

/**
 * Walk the vault collecting all .md files, skipping ignored dirs.
 * Does NOT apply the 24h safety buffer — that's for the decay cycle only.
 */
function walkMd(dir) {
  let results = [];
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return results; }
  for (const e of entries) {
    if (METRICS_IGNORED.has(e) || e.startsWith('.')) continue;
    const full = path.join(dir, e);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) results = results.concat(walkMd(full));
      else if (e.endsWith('.md')) results.push(full);
    } catch { /* skip */ }
  }
  return results;
}

/**
 * Calcula métricas de saúde do vault (Total, Alive, F1, F2, F3, Fossil, Immune)
 * Uses direct filesystem walk — no safety buffer, no scanVault.
 */
async function getVaultMetrics(vaultPath) {
  const metrics = {
    total: 0,
    alive: 0,
    f1: 0,
    f2: 0,
    f3: 0,
    fossil: 0,
    immune: 0,
  };

  // 1. Count fossilized originals in _fossilized/
  const fossilDir = path.join(vaultPath, '_fossilized');
  if (fs.existsSync(fossilDir)) {
    const walkFossils = (dir) => {
      let count = 0;
      let entries;
      try { entries = fs.readdirSync(dir); } catch { return 0; }
      for (const e of entries) {
        const full = path.join(dir, e);
        try {
          if (fs.statSync(full).isDirectory()) count += walkFossils(full);
          else if (e.endsWith('.md')) count++;
        } catch { /* skip */ }
      }
      return count;
    };
    metrics.fossil = walkFossils(fossilDir);
  }

  // 2. Walk all non-ignored .md files
  const files = walkMd(vaultPath);

  for (const filePath of files) {
    metrics.total++;
    let fm;
    try {
      fm = readFrontmatter(filePath).data || {};
    } catch {
      metrics.alive++;
      continue;
    }

    // Notes with status: fossilized are light stubs — already counted via _fossilized/ walk
    if (fm.status === 'fossilized') {
      // Don't double-count — they ARE part of total though
      continue;
    }

    if (fm.decay_immune) {
      metrics.immune++;
      continue;
    }

    const level = fm.decay_level || 0;
    if (level === 0) metrics.alive++;
    else if (level === 1) metrics.f1++;
    else if (level === 2) metrics.f2++;
    else if (level >= 3) metrics.f3++;
  }

  // Total includes fossils from the _fossilized/ walk
  metrics.total += metrics.fossil;

  return metrics;
}

/**
 * Returns list of active (alive, non-immune) notes with metadata.
 */
async function getActiveNotes(vaultPath) {
  const files = walkMd(vaultPath);
  const notes = [];

  for (const filePath of files) {
    let fm;
    try { fm = readFrontmatter(filePath).data || {}; } catch { fm = {}; }
    if (fm.status === 'fossilized') continue;
    if (fm.decay_immune) continue;
    const level = fm.decay_level || 0;
    if (level !== 0) continue;

    notes.push({
      fileName: path.basename(filePath, '.md'),
      filePath,
      folder: path.relative(vaultPath, path.dirname(filePath)) || '/',
    });
  }

  return notes.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/**
 * Returns list of immune notes with metadata.
 */
async function getImmuneNotes(vaultPath) {
  const files = walkMd(vaultPath);
  const notes = [];

  for (const filePath of files) {
    let fm;
    try { fm = readFrontmatter(filePath).data || {}; } catch { continue; }
    if (fm.status === 'fossilized') continue;
    if (!fm.decay_immune) continue;

    notes.push({
      fileName: path.basename(filePath, '.md'),
      filePath,
      folder: path.relative(vaultPath, path.dirname(filePath)) || '/',
    });
  }

  return notes.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

module.exports = { getVaultMetrics, getActiveNotes, getImmuneNotes };
