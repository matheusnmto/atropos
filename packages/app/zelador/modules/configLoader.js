'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULTS, DECAY_CONFIG_FILE } = require('../config/defaults');

/**
 * Lê decay.config.json, com fallback para defaults globais
 * 
 * @param {string} vaultPath 
 * @returns {Object}
 */
function loadConfig(vaultPath) {
  const configPath = path.join(vaultPath, DECAY_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return { global: DEFAULTS, folders: {} };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    parsed.global = { ...DEFAULTS, ...(parsed.global || {}) };
    return parsed;
  } catch (err) {
    return { global: DEFAULTS, folders: {} };
  }
}

/**
 * Determina a config efetiva percorrendo a hierarquia de pastas
 * 
 * @param {string} relativePath 
 * @param {Object} config 
 * @returns {Object}
 */
function resolveConfig(relativePath, config) {
  const segments = relativePath.split('/').slice(0, -1);
  const prefixes = [];

  for (let i = segments.length; i > 0; i--) {
    prefixes.push(segments.slice(0, i).join('/') || '/');
  }

  const { DEFAULT_CONFIG } = require('../config/defaults');
  const globalDefaults = config.global || DEFAULT_CONFIG;

  for (const prefix of prefixes) {
    // Tenta encontrar a config com e sem a barra inicial para ser resiliente
    const folderConfig = (config.folders && config.folders[prefix]) || 
                         (config.folders && config.folders[prefix.replace(/^\//, '')]);
    
    if (folderConfig) {
      if (folderConfig.decay_immune === true) {
        return { ...globalDefaults, decay_immune: true };
      }
      return { ...globalDefaults, ...folderConfig };
    }
  }

  return { ...globalDefaults };
}

module.exports = { loadConfig, resolveConfig };
