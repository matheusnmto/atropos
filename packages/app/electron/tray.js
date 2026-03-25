'use strict';

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// tray.js — System Tray icon e menu contextual do Grafo Líquido
// ─────────────────────────────────────────────────────────────────────────────

let trayInstance = null;

/**
* Cria e configura o ícone na system tray.
*
* @param {object} opts
* @param {Electron.BrowserWindow} opts.mainWindow - Janela principal
* @param {function(): string} opts.getStatus  - Retorna status atual ('idle'|'running'|'error')
* @param {function(): string} opts.nextRunAt  - Retorna next run como "HH:MM"
* @param {function(): Promise<void>} opts.onRunNow - Callback para execução manual
* @param {function(): void} opts.onQuit      - Callback para encerrar o app
* @returns {Electron.Tray}
*/
function setupTray({ mainWindow, getStatus, nextRunAt, onRunNow, onQuit }) {
  // Ícone — usa PNG da pasta assets, fallback para ícone vazio
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('ícone vazio');
  } catch (_) {
    // Cria um ícone 16x16 genérico se o arquivo não existir ainda
    icon = nativeImage.createEmpty();
  }

  trayInstance = new Tray(icon);

  /**
  * Reconstrói o menu contextual com dados atualizados.
  * Chamado na criação e sempre que o status mudar.
  */
  function buildMenu() {
    const status = getStatus();
    const nextRun = nextRunAt();
    const isRunning = status === 'running';

    const statusLabel = isRunning
      ? 'Zelador em execução...'
      : status === 'error'
      ? 'Último erro — ver logs'
      : `Aguardando — próxima: ${nextRun}`;

    return Menu.buildFromTemplate([
      {
        label: 'liquid-graph',
        enabled: false,
        icon: icon.resize({ width: 16, height: 16 }),
      },
      { type: 'separator' },
      {
        label: statusLabel,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Abrir',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: '▶ Executar agora',
        enabled: !isRunning,
        click: async () => {
          await onRunNow();
          trayInstance.setContextMenu(buildMenu());
        },
      },
      {
        label: isRunning ? '⏹ Parar' : '⏸ Parado',
        enabled: isRunning,
        click: () => {
          // Envia sinal de parada via IPC (zelador.ipc.js expõe zelador:kill)
          const { ipcMain } = require('electron');
          ipcMain.emit('zelador:kill-internal');
          trayInstance.setContextMenu(buildMenu());
        },
      },
      { type: 'separator' },
      {
        label: '� Sair',
        click: onQuit,
      },
    ]);
  }

  trayInstance.setToolTip(`Zelador — próxima execução: ${nextRunAt()}`);
  trayInstance.setContextMenu(buildMenu());

  // Duplo clique na tray abre a janela principal
  trayInstance.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return trayInstance;
}

/**
* Atualiza o tooltip e menu da tray.
* Chamado pelo main.js quando o status do Zelador muda.
*
* @param {{ status: string, nextRunAt: string }} data
*/
function updateTray(data) {
  if (!trayInstance) return;
  trayInstance.setToolTip(`Zelador — próxima execução: ${data.nextRunAt}`);
}

module.exports = { setupTray, updateTray };
