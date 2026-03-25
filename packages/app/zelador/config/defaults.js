'use strict';

/**
* Constantes e thresholds padrão do Zelador.
* Estes valores são usados quando não há decay.config.json
* ou quando a pasta da nota não tem configuração específica.
*/

const DEFAULTS = {
  phase1_days: 30,
  phase2_days: 60,
  phase3_days: 90,
};

// Número de milissegundos em um dia
const MS_PER_DAY = 24* 60* 60* 1000;

// Buffer de segurança: ignora arquivos modificados nas últimas 24h
const SAFETY_BUFFER_MS = 24 * 60 * 60 * 1000; // 24h

// Janela de alerta do Purgatório: listar notas que vão para F3 em até N dias
const PURGATORY_WARN_DAYS = 30;

// Sub-janela de destaque especial no Purgatório ("próximos 7 dias")
const PURGATORY_URGENT_DAYS = 7;

// Caminho relativo (a partir da raiz do vault) para o arquivo de purgatório
const PURGATORY_FILE = 'PURGATORIO.md';

// Caminho relativo para a pasta de arquivos fossilizados
const FOSSILIZED_DIR = '_fossilized';

// Caminho relativo para a pasta de estado interno do Zelador
const ZELADOR_DIR = '.zelador';

// Nome do arquivo de estado persistente
const STATE_FILE = '.zelador/state.json';

// Arquivo de configuração de decaimento por pasta
const DECAY_CONFIG_FILE = 'decay.config.json';

// Pastas que o scanner NUNCA deve tocar
const IGNORED_DIRS = [
  '_fossilized',
  '.zelador',
  '.obsidian',
  '.git',
  'node_modules',
];

module.exports = {
  DEFAULTS,
  MS_PER_DAY,
  SAFETY_BUFFER_MS,
  PURGATORY_WARN_DAYS,
  PURGATORY_URGENT_DAYS,
  PURGATORY_FILE,
  FOSSILIZED_DIR,
  ZELADOR_DIR,
  STATE_FILE,
  DECAY_CONFIG_FILE,
  IGNORED_DIRS,
};
