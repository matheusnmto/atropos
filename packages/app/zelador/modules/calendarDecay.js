'use strict';

const fs = require('fs');
const path = require('path');

const QUARTER_MONTHS = { '1': 3, '2': 6, '3': 9, '4': 12 };

/**
 * Extrai datas do conteúdo de uma nota.
 * @param {string} content
 * @returns {Date[]}
 */
function extractDates(content) {
  const dates = [];
  
  // Remove frontmatter para não confundir decay_since com data expulsa no texto
  const body = content.replace(/^---[\s\S]*?---/, '');
  const target = body || content;

  // ISO dates: 2025-03-15
  const isoMatches = target.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g);
  for (const match of isoMatches) {
    const d = new Date(`${match[1]}-${match[2]}-${match[3]}`);
    if (!isNaN(d)) dates.push(d);
  }

  // Quarters: Q1 2025 → end of March 2025
  const qMatches = content.matchAll(/\bQ([1-4])\s+(\d{4})\b/gi);
  for (const match of qMatches) {
    const month = QUARTER_MONTHS[match[1]];
    const year = parseInt(match[2]);
    dates.push(new Date(year, month - 1, 30));
  }

  // Frontmatter deadline: deadline: 2025-03-15
  const deadlineMatch = content.match(/^(?:deadline|due|prazo|delivery):\s*(.+)$/mi);
  if (deadlineMatch) {
    const d = new Date(deadlineMatch[1].trim());
    if (!isNaN(d)) dates.push(d);
  }

  return dates;
}

/**
 * Verifica se uma nota tem datas passadas e calcula o multiplicador de decay.
 *
 * @param {string} filePath
 * @returns {{ hasExpiredDates: boolean, multiplier: number, dates: string[] }}
 */
function analyzeCalendarDecay(filePath) {
  let content = '';
  try { content = fs.readFileSync(filePath, 'utf-8'); }
  catch { return { hasExpiredDates: false, multiplier: 1, dates: [] }; }

  const dates = extractDates(content);
  const now = new Date();
  const expiredDates = dates.filter(d => d < now);

  if (expiredDates.length === 0) {
    return { hasExpiredDates: false, multiplier: 1, dates: [] };
  }

  // Quanto mais antiga a data expirada, mais rápido o decay
  const mostExpiredMs = Math.max(...expiredDates.map(d => now - d));
  const mostExpiredDays = mostExpiredMs / (1000 * 60 * 60 * 24);

  let multiplier = 1;
  if (mostExpiredDays > 365) multiplier = 3;      // +1 ano atrasado: 3x mais rápido
  else if (mostExpiredDays > 180) multiplier = 2.5;
  else if (mostExpiredDays > 90) multiplier = 2;
  else if (mostExpiredDays > 30) multiplier = 1.5;
  else multiplier = 1.2;

  return {
    hasExpiredDates: true,
    multiplier,
    dates: expiredDates.map(d => d.toISOString().split('T')[0]),
  };
}

/**
 * Aplica o multiplicador de calendar decay à config efetiva de uma nota.
 *
 * @param {object} config — config resolvida para a nota
 * @param {string} filePath
 * @returns {object} — config modificada com thresholds menores
 */
function applyCalendarDecay(config, filePath) {
  const { hasExpiredDates, multiplier } = analyzeCalendarDecay(filePath);

  if (!hasExpiredDates) return config;

  return {
    ...config,
    phase1_days: Math.round(config.phase1_days / multiplier),
    phase2_days: Math.round(config.phase2_days / multiplier),
    phase3_days: Math.round(config.phase3_days / multiplier),
    _calendarAccelerated: true,
    _calendarMultiplier: multiplier,
  };
}

module.exports = { analyzeCalendarDecay, applyCalendarDecay };
