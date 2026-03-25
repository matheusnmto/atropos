'use strict';

const fs = require('fs');

// Caminho do lock file no sistema temporário do macOS
const LOCK_PATH = '/tmp/zelador.lock';

/**
* Tenta adquirir o lock. Se outro processo estiver rodando,
* exibe erro e encerra imediatamente.
*/
function acquireLock() {
  if (fs.existsSync(LOCK_PATH)) {
    const pid = fs.readFileSync(LOCK_PATH, 'utf8').trim();
    console.error(`[${timestamp()}] ⛔ Zelador já está rodando (PID: ${pid}). Abortando.`);
    process.exit(1);
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
}

/**
* Remove o lock file. Chamado em todos os cenários de saída.
*/
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  } catch (e) {
    // Ignora erros ao liberar — o arquivo pode já ter sido removido
  }
}

/**
* Registra handlers para garantir que o lock seja sempre liberado,
* independente de como o processo termina.
*/
function registerExitHandlers() {
  process.on('exit', releaseLock);
  process.on('SIGINT', () => { releaseLock(); process.exit(0); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
  process.on('uncaughtException', (err) => {
    console.error(`[${timestamp()}] Erro não capturado: ${err.message}`);
    console.error(err.stack);
    releaseLock();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(`[${timestamp()}] Promise rejeitada: ${reason}`);
    releaseLock();
    process.exit(1);
  });
}

function timestamp() {
  return new Date().toISOString();
}

module.exports = { acquireLock, releaseLock, registerExitHandlers };
