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

    // Fossilizadas
    'fossil.title':      'Fossilizadas',
    'fossil.desc':       'Notas comprimidas por IA e arquivadas em ',
    'fossil.empty':      'Nenhuma nota fossilizada ainda.',
    'fossil.noSummary':  '(sem resumo registrado)',

    // Grafo
    'graph.title':       'Grafo Interativo',

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
    'cfg.change':        'Trocar',
    'cfg.revoke':        'Revogar',
    'cfg.monthlyCost':   'Custo estimado este mês',
    'cfg.monthlyCostDesc':'Baseado nas dissoluções executadas até hoje.',
    'cfg.notifications': 'Notificações',
    'cfg.notifyRun':     'Notificar ao executar',
    'cfg.notifyDesc':    'Exibe uma notificação nativa quando o Zelador finalizar.',
    'cfg.language':      'Idioma',
    'cfg.languageLabel': 'Idioma da interface',
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

    // Status
    'status.idle':    'Zelador inativo',
    'status.running': 'Zelador rodando...',
    'status.error':   'Erro na execução',
    'status.next':    'Próxima: ',

    // Onboarding
    'ob.welcome':    'Bem-vindo ao liquid-graph',
    'ob.vaultDesc':  'Selecione a pasta do seu vault do Obsidian para começar.',
    'ob.noneSelected': 'Nenhuma pasta selecionada',
    'ob.selectBtn':  'Selecionar pasta',
    'ob.orPaste':    'ou cole o caminho manualmente',
    'ob.continue':   'Continuar →',
    'ob.back':       '← Voltar',
    'ob.providerH':  'Escolha o provider de IA',
    'ob.providerDesc':'Usado na Fase 3 para comprimir notas. Você usará sua própria chave (BYOK).',
    'ob.next':       'Próximo →',
    'ob.apiKeyH':    'Insira sua API key',
    'ob.apiKeyLabel':'Sua API key',
    'ob.keyHint':    'A chave é armazenada no keychain do sistema. O liquid-graph nunca a envia a servidores próprios.',
    'ob.validate':   'Validar e entrar',
    'ob.validating': 'Validando chave via API...',
    'ob.saving':     'Salvando no keychain...',
    'ob.success':    'Configuração concluída!',
  },

  'en-US': {
    // Nav
    'nav.dashboard':   'Dashboard',
    'nav.purgatory':   'Purgatory',
    'nav.fossilized':  'Fossilized',
    'nav.grafo':       'Graph',
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

    // Fossilized
    'fossil.title':      'Fossilized',
    'fossil.desc':       'Notes compressed by AI and archived in ',
    'fossil.empty':      'No fossilized notes yet.',
    'fossil.noSummary':  '(no summary recorded)',

    // Grafo
    'graph.title':       'Interactive Graph',

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

    // Status
    'status.idle':    'Zelador idle',
    'status.running': 'Zelador running...',
    'status.error':   'Execution error',
    'status.next':    'Next: ',

    // Onboarding
    'ob.welcome':    'Welcome to liquid-graph',
    'ob.vaultDesc':  'Select your Obsidian vault folder to get started.',
    'ob.noneSelected': 'No folder selected',
    'ob.selectBtn':  'Select folder',
    'ob.orPaste':    'or paste the path manually',
    'ob.continue':   'Continue →',
    'ob.back':       '← Back',
    'ob.providerH':  'Choose your AI provider',
    'ob.providerDesc':'Used in Phase 3 to compress notes. You use your own key (BYOK).',
    'ob.next':       'Next →',
    'ob.apiKeyH':    'Enter your API key',
    'ob.apiKeyLabel':'Your API key',
    'ob.keyHint':    'The key is stored in the system keychain and never sent to our servers.',
    'ob.validate':   'Validate and enter',
    'ob.validating': 'Validating key via API...',
    'ob.saving':     'Saving to keychain...',
    'ob.success':    'Setup complete!',
  },
};

let _locale = 'pt-BR';

function setLocale(locale) {
  if (translations[locale]) _locale = locale;
}

function getLocale() { return _locale; }

function t(key) {
  return translations[_locale]?.[key] ?? translations['pt-BR']?.[key] ?? key;
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
