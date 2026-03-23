'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// i18n.js — Internacionalização da interface do Grafo Líquido
// Suporta: pt-BR (padrão), en-US
// ─────────────────────────────────────────────────────────────────────────────

const translations = {
  'pt-BR': {
    // Nav
    'nav.dashboard':   'Dashboard',
    'nav.purgatory':   'Purgatório',
    'nav.fossilized':  'Fossilizadas',
    'nav.grafo':       'Grafo',
    'nav.insights':    'Sinais',
    'nav.settings':    'Configurações',

    // Dashboard
    'dash.runNow':       'Executar agora',
    'dash.running':      'Executando...',
    'dash.totalNotes':   'Total de notas',
    'dash.active':       'Ativas',
    'dash.decaying':     'Em decaimento',
    'dash.fossilized':   'Fossilizadas',
    'dash.vaultHealth':  'saúde do vault',
    'dash.alive':        'vivas',
    'dash.f1':           'F1',
    'dash.f2':           'F2',
    'dash.f3':           'F3',
    'dash.fossils':      'fósseis',
    'dash.activity':     'atividade recente',
    'dash.noActivity':   'Nenhuma atividade ainda.',

    // Purgatório
    'purg.title':        'Purgatório',
    'purg.desc':         'Notas condenadas à dissolução. Abra uma no Obsidian para resetar o decaimento.',
    'purg.colNote':      'Nota',
    'purg.colFolder':    'Pasta',
    'purg.colDissol':    'Dissolução',
    'purg.colRemain':    'Restam',
    'purg.immunize':     'Imunizar',
    'purg.immunizing':   'Imunizando...',
    'purg.immunized':    'Imunizada',
    'purg.empty':        'Nenhuma nota no purgatório.',
    'purg.urgentDays':   ' será dissolvida em menos de 7 dias',
    'purg.urgentDaysN':  ' serão dissolvidas em menos de 7 dias',
    'purg.day':          'dia',
    'purg.days':         'dias',

    // Action
    'action.openOb':     'Abrir no Obsidian',
    'action.open':       'Abrir',

    // Logs Backend
    'log.success':       'Zelador finalizado com sucesso',
    'log.done':          'Zelador finalizado',
    'log.errors':        'Erros:',
    'log.threshold':     'Abaixo do threshold:',
    'log.processed':     'Já processadas:',
    'log.immune':        'Imunes (puladas):',
    'log.f3':            'Fase 3 (Dissolução):',
    'log.f2':            'Fase 2 (Desconexão):',
    'log.f1':            'Fase 1 (Estiagem):',

    // Fossilizadas
    'fossil.title':      'Fossilizadas',
    'fossil.desc':       'Notas comprimidas por IA e arquivadas em ',
    'fossil.empty':      'Nenhuma nota fossilizada ainda.',
    'fossil.noSummary':  '(sem resumo registrado)',

    // Grafo
    'graph.title':       'Grafo Interativo',
    'graph.error':       'Erro ao carregar grafo',
    'graph.empty':       'Nenhuma nota encontrada no vault.',
    'graph.immune':      'imune',
    'graph.analyze':     'ANALISAR CONEXÕES',
    'graph.stats':       'notas &nbsp;&middot;&nbsp; conexões &nbsp;&middot;&nbsp; vivas &nbsp;&middot;&nbsp; decaindo &nbsp;&middot;&nbsp; fósseis',
    'phase.alive':       'VIVA',
    'phase.f1':          'F1 ESTIAGEM',
    'phase.f2':          'F2 DESCONEXÃO',
    'phase.f3':          'F3 DISSOLUÇÃO',
    'phase.fossil':      'FÓSSIL',
    'phase.alive.full':  'Ativa',
    'phase.f1.full':     'F1 — Estiagem',
    'phase.f2.full':     'F2 — Desconexão',
    'phase.f3.full':     'F3 — Dissolução',
    'phase.fossil.full': 'Fossilizada',

    // Configurações
    'cfg.title':         'Configurações',
    'cfg.vault':         'Vault',
    'cfg.vaultPath':     'Pasta do vault',
    'cfg.vaultPathDesc': 'Caminho para o diretório raiz do seu Obsidian.',
    'cfg.vaultPaste':    'Ou cole o caminho',
    'cfg.vaultPasteDesc':'Você pode colar o caminho diretamente aqui.',
    'cfg.change':        'Alterar',
    'cfg.schedule':      'Agendamento',
    'cfg.scheduleTime':  'Horário de execução',
    'cfg.scheduleDesc':  'O Zelador roda automaticamente neste horário todos os dias.',
    'cfg.api':           'API de inteligência artificial',
    'cfg.provider':      'Provider ativo',
    'cfg.providerDesc':  'Usado na Fase 3 para comprimir notas fossilizadas.',
    'cfg.apiKey':        'Chave de API',
    'cfg.apiKeyDesc':    'Armazenada no keychain do sistema. Nunca enviada a servidores externos.',
    'cfg.keySet':        'Chave configurada',
    'cfg.keyNotSet':     'Não configurada',
    'cfg.revoke':        'Revogar',
    'cfg.monthlyCost':   'Custo estimado este mês',
    'cfg.monthlyCostDesc':'Baseado nas dissoluções executadas até hoje.',
    'cfg.notifications': 'Notificações',
    'cfg.notifyRun':     'Notificar ao executar',
    'cfg.notifyDesc':    'Exibe uma notificação nativa quando o Zelador finalizar.',
    'cfg.language':      'Idioma',
    'cfg.languageLabel': 'Idioma da interface',
    'cfg.languageDesc':  'Sem reiniciar o app.',
    'cfg.dangerZone':    'Zona de risco',
    'cfg.exportLogs':    'Exportar todos os logs',
    'cfg.exportDesc':    'Baixar o histórico completo de execuções em JSON.',
    'cfg.export':        'Exportar',
    'cfg.resetAll':      'Resetar todas as configurações',
    'cfg.resetDesc':     'Apaga vault path, chaves e agenda. Não afeta os arquivos do vault.',
    'cfg.reset':         'Resetar',
    'cfg.save':          'Salvar configurações',
    'cfg.saved':         'Salvo',
    'cfg.saveError':     'Erro ao salvar',
    'cfg.newKey':        'Nova chave Anthropic',
    'cfg.saveKey':       'Salvar chave',
    'cfg.cancelKey':     'Cancelar',

    // Sync
    'cfg.syncTitle':     'Sincronização (Dispositivos)',
    'cfg.syncDesc':      'Para ativar o sync entre dispositivos:',
    'cfg.syncStep1':     'Criar um repositório <strong>PRIVADO</strong> no GitHub para o vault',
    'cfg.syncStep2':     'No terminal, dentro do vault:',
    'cfg.syncStep3':     'No segundo dispositivo, clonar o repositório como vault',
    'cfg.syncStep4':     'O Grafo Líquido detecta o remote automaticamente',
    'cfg.syncWarning':   '<strong>Repositório PRIVADO é fortemente recomendado</strong> — o vault contém notas pessoais e o conteúdo será enviado para o GitHub.',
    'cfg.syncNow':       'Sincronizar Agora (Pull & Push)',

    // Graph
    'graph.analyze':     'ANALISAR CONEXÕES',
    'graph.analyzing':   'ANALISANDO...',
    'graph.connectionsFound': 'CONEXÕES DESCOBERTAS',
    'graph.saveLinks':   'SALVAR LINKS NATIVOS',
    'graph.saving':      'SALVANDO...',
    'graph.saved':       'SALVO NO COFRE!',
    'graph.error':       'ERRO DO OLLAMA',

    // Status
    'status.idle':       'Zelador inativo',
    'status.loading':    'Carregando...',
    'status.running':    'Zelador rodando...',
    'status.error':      'Erro na execução',
    'status.next':       'Próxima: ',
    'statusbar.waiting': 'aguardando primeira execução',

    // Onboarding
    'ob.welcome':      'Bem-vindo ao Atropos',
    'ob.vaultDesc':    'Selecione a pasta do seu vault do Obsidian para começar.',
    'ob.noneSelected': 'Nenhuma pasta selecionada',
    'ob.selectBtn':    'Selecionar pasta',
    'ob.orPaste':      'ou cole o caminho manualmente',
    'ob.continue':     'Continuar →',
    'ob.back':         '← Voltar',
    'ob.providerH':    'Escolha o provider de IA',
    'ob.providerDesc': 'Usado na Fase 3 para comprimir notas. Você usará sua própria chave (BYOK).',
    'ob.recommended':  'Recomendado',
    'ob.freeUntilQuota':'Gratuito até cota',
    'ob.next':         'Próximo →',
    'ob.apiKeyH':      'Insira sua API key',
    'ob.apiKeyLabel':  'Sua API key',
    'ob.keyHint':      'A chave é armazenada no keychain do sistema. O Atropos nunca a envia a servidores próprios.',
    'ob.show':         'mostrar',
    'ob.hide':         'ocultar',
    'ob.validate':     'Validar e entrar',
    'ob.validating':   'Validando chave via API...',
    'ob.saving':       'Salvando no keychain...',
    'ob.success':      'Configuração concluída!',
    'purg.urgentNotes':'notas urgentes',
    'dash.loadingVault':'carregando vault...',
    'fossil.desc2':    '. Somente leitura.',
    'ob.noneName':     'Sem IA',
    'ob.noneModel':    'Arquivar sem resumo',
    'ob.skip':         'Pular por agora',
    'cfg.noAi':        'Sem IA — apenas arquivar',
    'cfg.providerDesc': 'Opcional. Usado na Fase 3 para resumir notas. Sem chave, as notas são arquivadas sem resumo.',
    'insig.desc':      'Sinais inteligentes descobertos no seu vault.',
    'insig.refresh':   'Atualizar',
    'insig.dejavuTitle': 'Déjà Vu — Ideias Recorrentes',
    'insig.calendarTitle': 'Calendário — Contexto Expirado',
    'insig.noPatterns': 'Nenhum padrão recorrente detectado.',
    'insig.noExpired': 'Nenhuma nota com datas expiradas detectada.'
  },

  'en-US': {
    // Nav
    'nav.dashboard':   'Dashboard',
    'nav.purgatory':   'Purgatory',
    'nav.fossilized':  'Fossilized',
    'nav.grafo':       'Graph',
    'nav.insights':    'Signals',
    'nav.settings':    'Settings',

    // Dashboard
    'dash.runNow':       'Run now',
    'dash.running':      'Running...',
    'dash.totalNotes':   'Total notes',
    'dash.active':       'Active',
    'dash.decaying':     'Decaying',
    'dash.fossilized':   'Fossilized',
    'dash.vaultHealth':  'vault health',
    'dash.alive':        'alive',
    'dash.f1':           'F1',
    'dash.f2':           'F2',
    'dash.f3':           'F3',
    'dash.fossils':      'fossils',
    'dash.activity':     'recent activity',
    'dash.noActivity':   'No activity yet.',

    // Purgatory
    'purg.title':        'Purgatory',
    'purg.desc':         'Notes condemned to dissolution. Open one in Obsidian to reset decay.',
    'purg.colNote':      'Note',
    'purg.colFolder':    'Folder',
    'purg.colDissol':    'Dissolution',
    'purg.colRemain':    'Remaining',
    'purg.immunize':     'Immunize',
    'purg.immunizing':   'Immunizing...',
    'purg.immunized':    'Immunized',
    'purg.empty':        'No notes in purgatory.',
    'purg.urgentDays':   ' will dissolve in less than 7 days',
    'purg.urgentDaysN':  ' will dissolve in less than 7 days',
    'purg.day':          'day',
    'purg.days':         'days',

    // Action
    'action.openOb':     'Open in Obsidian',
    'action.open':       'Open',

    // Logs Backend
    'log.success':       'Zelador finished successfully',
    'log.done':          'Zelador finished',
    'log.errors':        'Errors:',
    'log.threshold':     'Below threshold:',
    'log.processed':     'Already processed:',
    'log.immune':        'Immune (skipped):',
    'log.f3':            'Phase 3 (Dissolution):',
    'log.f2':            'Phase 2 (Disconnect):',
    'log.f1':            'Phase 1 (Drought):',

    // Fossilized
    'fossil.title':      'Fossilized',
    'fossil.desc':       'Notes compressed by AI and archived in ',
    'fossil.empty':      'No fossilized notes yet.',
    'fossil.noSummary':  '(no summary recorded)',

    // Grafo
    'graph.title':       'Interactive Graph',
    'graph.error':       'Error loading graph',
    'graph.empty':       'No notes found in the vault.',
    'graph.immune':      'immune',
    'graph.analyze':     'ANALYZE CONNECTIONS',
    'graph.stats':       'notes &nbsp;&middot;&nbsp; connections &nbsp;&middot;&nbsp; alive &nbsp;&middot;&nbsp; decaying &nbsp;&middot;&nbsp; fossils',
    'phase.alive':       'ALIVE',
    'phase.f1':          'F1 DROUGHT',
    'phase.f2':          'F2 DISCONNECT',
    'phase.f3':          'F3 DISSOLUTION',
    'phase.fossil':      'FOSSIL',
    'phase.alive.full':  'Active',
    'phase.f1.full':     'F1 — Drought',
    'phase.f2.full':     'F2 — Disconnect',
    'phase.f3.full':     'F3 — Dissolution',
    'phase.fossil.full': 'Fossilized',

    // Settings
    'cfg.title':         'Settings',
    'cfg.vault':         'Vault',
    'cfg.vaultPath':     'Vault folder',
    'cfg.vaultPathDesc': 'Path to the root directory of your Obsidian vault.',
    'cfg.vaultPaste':    'Or paste the path',
    'cfg.vaultPasteDesc':'You can paste the path directly here.',
    'cfg.change':        'Change',
    'cfg.schedule':      'Schedule',
    'cfg.scheduleTime':  'Run time',
    'cfg.scheduleDesc':  'The Zelador runs automatically at this time every day.',
    'cfg.api':           'AI provider',
    'cfg.provider':      'Active provider',
    'cfg.providerDesc':  'Used in Phase 3 to compress fossilized notes.',
    'cfg.apiKey':        'API key',
    'cfg.apiKeyDesc':    'Stored in the system keychain. Never sent to external servers.',
    'cfg.keySet':        'Key configured',
    'cfg.keyNotSet':     'Not configured',
    'cfg.revoke':        'Revoke',
    'cfg.monthlyCost':   'Estimated cost this month',
    'cfg.monthlyCostDesc':'Based on dissolutions executed up to today.',
    'cfg.notifications': 'Notifications',
    'cfg.notifyRun':     'Notify on run',
    'cfg.notifyDesc':    'Shows a native notification when the Zelador finishes.',
    'cfg.language':      'Language',
    'cfg.languageLabel': 'Interface language',
    'cfg.languageDesc':  'Without restarting.',
    'cfg.dangerZone':    'Danger zone',
    'cfg.exportLogs':    'Export all logs',
    'cfg.exportDesc':    'Download the full execution history as JSON.',
    'cfg.export':        'Export',
    'cfg.resetAll':      'Reset all settings',
    'cfg.resetDesc':     'Clears vault path, keys, and schedule. Does not affect vault files.',
    'cfg.reset':         'Reset',
    'cfg.save':          'Save settings',
    'cfg.saved':         'Saved',
    'cfg.saveError':     'Error saving',
    'cfg.newKey':        'New Anthropic key',
    'cfg.saveKey':       'Save key',
    'cfg.cancelKey':     'Cancel',

    // Sync
    'cfg.syncTitle':     'Sync (Devices)',
    'cfg.syncDesc':      'To enable sync across devices:',
    'cfg.syncStep1':     'Create a <strong>PRIVATE</strong> repository on GitHub for the vault',
    'cfg.syncStep2':     'In the terminal, inside the vault:',
    'cfg.syncStep3':     'On the second device, clone the repository as the vault',
    'cfg.syncStep4':     'Liquid Graph automatically detects the remote',
    'cfg.syncWarning':   '<strong>A PRIVATE repository is strongly recommended</strong> — the vault contains personal notes and content will be pushed to GitHub.',
    'cfg.syncNow':       'Sync Now (Pull & Push)',

    // Graph
    'graph.analyze':     'ANALYZE CONNECTIONS',
    'graph.analyzing':   'ANALYZING...',
    'graph.connectionsFound': 'CONNECTIONS FOUND',
    'graph.saveLinks':   'SAVE NATIVE LINKS',
    'graph.saving':      'SAVING...',
    'graph.saved':       'SAVED TO VAULT!',
    'graph.error':       'OLLAMA ERROR',

    // Status
    'status.idle':       'Zelador idle',
    'status.loading':    'Loading...',
    'status.running':    'Zelador running...',
    'status.error':      'Execution error',
    'status.next':       'Next: ',
    'statusbar.waiting': 'awaiting first run',

    // Onboarding
    'ob.welcome':      'Welcome to Atropos',
    'ob.vaultDesc':    'Select your Obsidian vault folder to get started.',
    'ob.noneSelected': 'No folder selected',
    'ob.selectBtn':    'Select folder',
    'ob.orPaste':      'or paste the path manually',
    'ob.continue':     'Continue →',
    'ob.back':         '← Back',
    'ob.providerH':    'Choose your AI provider',
    'ob.providerDesc': 'Used in Phase 3 to compress notes. You use your own key (BYOK).',
    'ob.recommended':  'Recommended',
    'ob.freeUntilQuota':'Free until quota',
    'ob.next':         'Next →',
    'ob.apiKeyH':      'Enter your API key',
    'ob.apiKeyLabel':  'Your API key',
    'ob.keyHint':      'The key is stored in the system keychain and never sent to our servers.',
    'ob.show':         'show',
    'ob.hide':         'hide',
    'ob.validate':     'Validate and enter',
    'ob.validating':   'Validating key via API...',
    'ob.saving':       'Saving to keychain...',
    'ob.success':      'Setup complete!',
    'purg.urgentNotes':'urgent notes',
    'dash.loadingVault':'loading vault...',
    'fossil.desc2':    '. Read-only.',
    'ob.noneName':     'No AI',
    'ob.noneModel':    'Archive without summary',
    'ob.skip':         'Skip for now',
    'cfg.noAi':        'No AI — archive only',
    'cfg.providerDesc': 'Optional. Used in Phase 3 to summarize notes. Without a key, notes are archived without a summary.',
    'insig.desc':      'Smart signals discovered in your vault.',
    'insig.refresh':   'Refresh',
    'insig.dejavuTitle': 'Déjà Vu — Recurring Ideas',
    'insig.calendarTitle': 'Calendar — Expired Context',
    'insig.noPatterns': 'No recurring patterns detected.',
    'insig.noExpired': 'No notes with expired dates detected.'
  },
};

let _locale = 'en-US';

function setLocale(locale) {
  if (translations[locale]) _locale = locale;
}

function getLocale() { return _locale; }

function t(key) {
  return translations[_locale]?.[key] ?? translations['en-US']?.[key] ?? key;
}

function getAvailableLocales() {
  return [
    { id: 'pt-BR', label: 'Português (BR)' },
    { id: 'en-US', label: 'English (US)' },
  ];
}

// Disponível globalmente no browser
if (typeof window !== 'undefined') {
  window.i18n = { t, setLocale, getLocale, getAvailableLocales };
}
