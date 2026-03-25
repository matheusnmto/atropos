'use strict';

window.onerror = function(msg, url, line, col, error) {
  const errStr = `Error: ${msg}\nLine: ${line}\nCol: ${col}\nURL: ${url}`;
  console.error(errStr, error);
  alert(errStr);
  return false;
};

// -----------------------------------------------------------------------------
// app.js - Renderer Process do Grafo Liquido
// Toda comunicacao com Main Process via window.zelador (contextBridge)
// -----------------------------------------------------------------------------

const api = window.zelador;
if (!api) {
  alert('Critical: window.zelador (API) not found!');
}

// ==============================================================================
// HELPERS
// ==============================================================================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
const showElement = (id) => $(id) && $(id).classList.remove('hidden');
const hideElement = (id) => $(id) && $(id).classList.add('hidden');


function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`screen-${id}`).classList.remove('hidden');
}

let _currentView = null;

function showView(id) {
  // Destruir grafo ao sair da aba
  if (_currentView === 'grafo' && id !== 'grafo') {
    if (window.destroyGraph) window.destroyGraph();
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = $(`view-${viewMap(id)}` || `view-${id}`);
  const nav = $(`nav-${id}`);
  
  // Map some IDs if they differ between nav and view
  function viewMap(v) {
    if (v === 'dashboard') return 'dashboard';
    return v;
  }

  const targetView = $(`view-${id}`);
  if (targetView) targetView.classList.add('active');
  if (nav) nav.classList.add('active');
  
  if (id === 'dashboard') loadDashboard();
  if (id === 'purgatorio') renderPurgatorio();
  if (id === 'insights') refreshInsights();
  if (id === 'config') loadConfig();
  if (id === 'fossilized') renderFossilized();
  if (id === 'active') renderActiveNotes();
  if (id === 'immune') renderImmuneNotes();
  if (id === 'grafo') {
    setTimeout(() => { if (window.initGraph) window.initGraph(); }, 50);
  }

  _currentView = id;
}

// -- i18n ---------------------------------------------------------------------
function applyTranslations() {
  try {
    const { t } = window.i18n || {};
    if (!t) {
      console.error('[i18n] window.i18n.t NOT FOUND');
      return;
    }
    
    const locale = window.i18n.getLocale();
    console.log('[i18n] Applying translations for:', locale);

    const elements = document.querySelectorAll('[data-i18n]');
    console.log(`[i18n] Found ${elements.length} elements to translate`);

    elements.forEach(el => {
      try {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (!val || val === key) return;

        if (el.getAttribute('data-i18n-target') === 'placeholder') {
          el.setAttribute('placeholder', val);
        } else if (el.children.length === 0) {
          el.textContent = val;
        }
      } catch (e) { console.error(`[i18n] Error translating element:`, el, e); }
    });
  } catch (e) {
    console.error('[i18n] applyTranslations crash:', e);
    alert(`Translation error: ${e.message}`);
  }
}

// ==============================================================================
// ONBOARDING
// ==============================================================================
let obStep = 1;
let obVault = '';
let obProvider = 'anthropic';

function showObStep(n) {
  console.log('[onboarding] Going to step:', n);
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  const stepEl = $(`ob-step-${n}`);
  if (stepEl) stepEl.classList.add('active');
  obStep = n;

  // Se voltamos para o passo 1 e já temos um vault, habilitamos o botão continuar
  if (n === 1 && obVault) {
    const nextBtn = $('ob-next-1');
    if (nextBtn) nextBtn.disabled = false;
  }
}

// Language Switcher
document.addEventListener('DOMContentLoaded', () => {
  const langSel = $('ob-language');
  if (langSel) {
    langSel.addEventListener('change', (e) => {
      window.setLanguage(e.target.value);
    });
  }
});

// Funções globais para serem chamadas por listeners ou fallback onclick
window.pickVault = async function() {
  console.log('[onboarding] Requesting folder picker (window.pickVault)...');
  try {
    if (!api) throw new Error('window.zelador API NOT FOUND');
    const p = await api.pickVaultPath();
    console.log('[onboarding] Folder picked:', p);
    if (p) updateVault(p);
  } catch (err) {
    console.error('[onboarding] pickVault error:', err);
    alert('Erro ao abrir seletor de pastas: ' + err.message);
  }
};

window.setLanguage = function(lang) {
  try {
    console.log('[onboarding] Setting language to:', lang);
    if (window.i18n) {
      window.i18n.setLocale(lang);
      applyTranslations();
    } else {
      console.error('window.i18n not found');
    }
  } catch (err) {
    console.error('setLanguage error:', err);
  }
};

// Step 1: Vault Selection
// O listener agora é via onclick no HTML para evitar duplicidade e garantir execução

const updateVault = (val) => {
  obVault = val.trim();
  console.log('[onboarding] Vault path set to:', obVault);
  const display = $('ob-vault-display');
  const nextBtn = $('ob-next-1');
  if (display) display.textContent = obVault || (window.i18n ? window.i18n.t('ob.noneSelected') : 'No folder selected');
  if (nextBtn) nextBtn.disabled = obVault.length === 0;
};

$('ob-vault-manual')?.addEventListener('input', (e) => updateVault(e.target.value));
$('ob-vault-manual')?.addEventListener('change', (e) => updateVault(e.target.value));
$('ob-vault-manual')?.addEventListener('blur', (e) => updateVault(e.target.value));

$('ob-next-1')?.addEventListener('click', () => {
  if (!obVault) {
    console.warn('[onboarding] Cannot proceed without vault');
    return;
  }
  showObStep(2);
});

// Step 2: Provider Selection
document.querySelectorAll('.provider-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    obProvider = card.dataset.provider;
    console.log('[onboarding] Selected provider:', obProvider);

    const hint = $('ob-key-hint');
    const input = $('ob-api-key');
    if (obProvider === 'none') {
      if (hint) hint.textContent = '';
      if (input) input.placeholder = '';
    } else {
      const hints = { 
        anthropic: 'Get it at console.anthropic.com', 
        google: 'Get it at aistudio.google.com' 
      };
      if (hint) hint.textContent = hints[obProvider] || '';
      if (input) input.placeholder = obProvider === 'anthropic' ? 'sk-ant-...' : 'AIza...';
    }
  });
});

$('ob-back-2')?.addEventListener('click', () => showObStep(1));

$('ob-next-2')?.addEventListener('click', () => {
  if (obProvider === 'none') {
    finishOnboarding(false);
  } else {
    showObStep(3);
  }
});

// Step 3: API Key
$('ob-back-3')?.addEventListener('click', () => showObStep(2));

$('ob-toggle-key')?.addEventListener('click', () => {
  const inp = $('ob-api-key');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  $('ob-toggle-key').textContent = inp.type === 'password' 
    ? (window.i18n ? window.i18n.t('ob.show') : 'show') 
    : (window.i18n ? window.i18n.t('ob.hide') : 'hide');
});

$('ob-validate')?.addEventListener('click', async () => validateAndFinish());

$('ob-skip-key')?.addEventListener('click', async () => finishOnboarding(false));

async function validateAndFinish() {
  const fb = $('ob-feedback');
  const key = $('ob-api-key')?.value.trim();
  if (!key) {
    if (fb) {
      fb.textContent = window.i18n ? window.i18n.t('ob.noKey') || 'Enter a key' : 'Enter a key';
      fb.className = 'ob-feedback error';
    }
    return;
  }
  
  if (fb) {
    fb.textContent = window.i18n ? window.i18n.t('ob.validating') : 'Validating...';
    fb.className = 'ob-feedback info';
  }

  try {
    console.log('[onboarding] Validating key for:', obProvider);
    const val = await api.validateApiKey(obProvider, key);
    if (!val.valid) {
      if (fb) {
        fb.textContent = '✗ ' + val.error;
        fb.className = 'ob-feedback error';
      }
      return;
    }
    
    if (fb) fb.textContent = window.i18n ? window.i18n.t('ob.saving') : 'Saving...';
    await api.setApiKey(obProvider, key);
    await finishOnboarding(true);
  } catch (e) {
    console.error('[onboarding] Validation/Save error:', e);
    if (fb) {
      fb.textContent = '✗ ' + (e.message || 'Error occurred.');
      fb.className = 'ob-feedback error';
    }
  }
}

async function finishOnboarding(hasKey) {
  console.log('[onboarding] Finalizing...', { vault: obVault, provider: obProvider, hasKey });
  const fb = $('ob-feedback') || { set textContent(v) {} }; // fallback nulo se não houver display
  
  try {
    const lang = window.i18n ? window.i18n.getLocale() : 'en-US';
    await api.setConfig({ 
      vaultPath: obVault, 
      provider: obProvider, 
      onboarded: true,
      language: lang
    });
    
    fb.textContent = '✓ ' + (window.i18n ? window.i18n.t('ob.success') : 'Success!');
    fb.className = 'ob-feedback ok';
    
    setTimeout(() => {
      console.log('[onboarding] Reloading app...');
      window.location.reload();
    }, 600);
  } catch (e) {
    console.error('[onboarding] Finish error:', e);
    fb.textContent = '✗ ' + (e.message || 'Error saving config.');
    fb.className = 'ob-feedback error';
  }
}

// ==============================================================================
// STATUS & RUN NOW
// ==============================================================================
function updateStatusUI({ status, lastRunAt, nextRunAt }) {
  const el = $('statusbar-status');
  if (!el) return;
  const t = window.i18n.t;
  el.textContent = status === 'running' ? t('status.working') : t('status.waiting');
  el.className = `status-dot ${status}`;

  if (nextRunAt) {
    const h = new Date(nextRunAt).getHours().toString().padStart(2, '0');
    const m = new Date(nextRunAt).getMinutes().toString().padStart(2, '0');
    $('next-run-time').textContent = `${h}:${m}`;
  }
}

async function loadStatus() {
  try { updateStatusUI(await api.getStatus()); }
  catch (e) { console.error('getStatus:', e); }
}

$('btn-run-now')?.addEventListener('click', async () => {
  try { await api.runNow(); }
  catch (e) { console.error('runNow:', e); }
});

api.onStatusChange((data) => {
  updateStatusUI(data);
  loadRecentActivity();
});

// ==============================================================================
// DASHBOARD - metricas e barra de saude
// ==============================================================================
function renderHealthBar(data) {
  if (!data) return;
  const total = data.total || 1;
  const pct = (v, cls) => `<div class="decay-bar-seg ${cls}" style="width:${(v / total * 100).toFixed(1)}%"></div>`;

  $('healthBar').innerHTML = [
    pct(data.alive, 'seg-vital'),
    pct(data.f1, 'seg-estiagem'),
    pct(data.f2, 'seg-desconexao'),
    pct(data.f3, 'seg-dissolucao'),
    pct(data.fossil, 'seg-fossil'),
  ].join('');

  const t = window.i18n.t;
  const dot = (color, label) => `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</span>`;
  $('healthLegend').innerHTML = [
    dot('var(--color-vital)', `${data.alive} ${t('dash.active')}`),
    dot('var(--color-estiagem)', `${data.f1} F1`),
    dot('var(--color-desconexao)', `${data.f2} F2`),
    dot('var(--color-dissolucao)', `${data.f3} F3`),
    dot('var(--color-fossil)', `${data.fossil} ${t('dash.fossilized')}`),
    dot('#7F77DD', `${data.immune || 0} ${t('dash.immune')}`),
  ].join('');

  $('m-total').textContent = data.total;
  $('m-alive').textContent = data.alive;
  $('m-alive-pct').textContent = `${Math.round(data.alive / total * 100)}%`;
  $('m-decaying').textContent = data.f1 + data.f2 + data.f3;
  $('m-fossil').textContent = data.fossil;
  $('m-immune').textContent = data.immune || 0;
  $('health-pct').textContent = `${Math.round(data.alive / total * 100)}% ${t('dash.alive')}`;
}

async function loadDashboard() {
  try {
    const metrics = await api.getMetrics();
    if (metrics) renderHealthBar(metrics);

    const cfg = await api.getConfig();
    const vaultName = cfg.vaultPath ? cfg.vaultPath.split('/').pop() : 'vault';
    $('dash-subtitle').textContent = vaultName;
    $('statusbar-vault').textContent = cfg.vaultPath || '—';

    document.querySelectorAll('.metric-card.clickable').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const view = card.dataset.nav;
        if (view) showView(view);
      });
    });
  } catch (e) { console.error('loadDashboard error:', e); }
}

async function loadRecentActivity() {
  try {
    const logs = await api.getLogs?.() ?? [];
    const el = $('activityList');
    if (!logs?.length) {
      el.innerHTML = `<div class="activity-empty">${window.i18n.t('dash.noActivity')}</div>`;
      return;
    }
    const colors = { ok: 'var(--color-vital)', warn: 'var(--color-desconexao)', error: 'var(--color-dissolucao)' };
    el.innerHTML = logs.slice(-10).reverse().map(line => {
      const lower = line.toLowerCase();
      const cls = (lower.includes('erro') || lower.includes('fatal') || lower.includes('[f') && lower.includes('erro')) ? 'error'
        : (lower.includes('aviso') || lower.includes('warn')) ? 'warn' : 'ok';

      let notePath = '';
      const match = line.match(/\]\s([a-zA-Z0-9_\-\s/\\]+\.md)/);
      if (match) notePath = match[1];
      const t = window.i18n.t;

      let translatedLine = line
        .replace('Zelador finalizado com sucesso.', t('log.success'))
        .replace('Zelador finalizado.', t('log.done'))
        .replace('Erros:', t('log.errors'))
        .replace('Abaixo do threshold:', t('log.threshold'))
        .replace('Ja processadas:', t('log.processed'))
        .replace('Imunes (puladas):', t('log.immune'))
        .replace('Fase 3 (Dissolucao):', t('log.f3'))
        .replace('Fase 2 (Desconexao):', t('log.f2'))
        .replace('Fase 1 (Estiagem):', t('log.f1'));

      return `<div class="activity-item" style="justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 8px; align-items: flex-start; flex: 1;">
          <span class="activity-dot" style="background:${colors[cls]}; margin-top: 4px;"></span>
          <div class="activity-body">
            <span class="activity-text">${esc(translatedLine.replace(/^.*?\]\s*/, ''))}</span>
          </div>
        </div>
        ${notePath ? `<button class="btn-obsidian" style="padding: 2px 6px; font-size: 10px;" onclick="window.zelador.openInObsidian('${notePath.replace(/\\/g, '/')}')">${t('action.open')}</button>` : ''}
      </div>`;
    }).join('');
  } catch (e) { console.error('getLogs:', e); }
}

// ==============================================================================
// FOSSILIZADAS
// ==============================================================================
async function renderFossilized() {
  const { t } = window.i18n;
  const container = $('fossilized-list');
  if (!container) return;
  container.innerHTML = '<div class="activity-empty">Carregando...</div>';
  try {
    const notes = await api.getFossilized();
    if (!notes || notes.length === 0) {
      container.innerHTML = `<div class="activity-empty">${t('fossil.empty')}</div>`;
      return;
    }
    container.innerHTML = notes.map(note => `
      <div class="note-card status-fossil">
        <div class="card-header">
          <span class="card-title">${esc(note.fileName)}</span>
          <span class="card-meta">${esc(note.date || note.fossilizedAt)}</span>
        </div>
        <p class="card-body">${note.summary ? esc(note.summary) : `<em>${t('fossil.noSummary')}</em>`}</p>
        <div class="card-actions">
          <span class="card-subtext">/_fossilized/${esc(note.month)}/</span>
          <button class="btn-obsidian" data-filepath="${esc(note.filePath)}">${t('action.openOb')}</button>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('.btn-obsidian[data-filepath]').forEach(btn => {
      btn.addEventListener('click', async () => { await api.openInObsidian(btn.dataset.filepath); });
    });
  } catch (e) {
    console.error('renderFossilized:', e);
    container.innerHTML = '<div class="activity-empty">Erro ao carregar.</div>';
  }
}

// ==============================================================================
async function renderPurgatorio() {
  const list = $('purgatory-list');
  if (!list) return;
  const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
  list.innerHTML = `<div class="loading-spinner">${_t('status.loading')}</div>`;
  try {
    const items = await api.getPurgatoryData();
    list.innerHTML = '';
    if (!items || items.length === 0) {
      showElement('purgatory-empty');
      return;
    }
    hideElement('purgatory-empty');

    items.forEach(item => {
      const statusClass = item.decayLevel === 2 ? 'status-desconexao' : (item.decayLevel >= 3 ? 'status-dissolucao' : 'status-estiagem');
      const card = document.createElement('div');
      card.className = `note-card ${statusClass}`;
      card.innerHTML = `
        <div class="card-header">
          <span class="card-title">${esc(item.nota)}</span>
          <span class="card-meta">${item.dias}d</span>
        </div>
        <p class="card-body">${esc(item.pasta)}</p>
        <div class="card-actions">
          <span class="card-subtext">${esc(item.dissolve)}</span>
          <button class="btn-obsidian">${window.i18n.t('action.open')}</button>
        </div>
      `;
      card.querySelector('.btn-obsidian').addEventListener('click', () => zelador.openInObsidian(item.filePath));
      list.appendChild(card);
    });
  } catch (e) {
    console.error('renderPurgatorio:', e);
    list.innerHTML = `<div class="error-msg">Error loading Purgatory</div>`;
  }
}

// ==============================================================================
// CONFIGURACOES
// ==============================================================================
let changingKeyProvider = null;

async function loadConfig() {
  try {
    const c = await api.getConfig();
    $('cfg-vault-display').textContent = c.vaultPath || 'não configurado';
    $('cfg-vault-manual').value = c.vaultPath || '';
    $('statusbar-vault').textContent = c.vaultPath || '—';

    const hourSel = $('cfg-hour');
    const minSel = $('cfg-minute');
    if (hourSel && !hourSel.options.length) {
      for (let h = 0; h < 24; h++) hourSel.add(new Option(String(h).padStart(2, '0'), h));
      for (let m = 0; m < 60; m += 15) minSel.add(new Option(String(m).padStart(2, '0'), m));
    }
    hourSel.value = c.schedule?.hour ?? 3;
    minSel.value = c.schedule?.minute ?? 0;

    const prov = c.provider || 'anthropic';
    $('cfg-provider').value = prov;
    
    const apiKeySection = $('cfg-api-key-section');
    const badge = $('cfg-active-provider');
    if (prov === 'none') {
      if (apiKeySection) apiKeySection.style.display = 'none';
      if (badge) badge.style.display = 'none';
    } else {
      if (apiKeySection) apiKeySection.style.display = 'flex';
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = prov === 'google' ? 'Google Gemini' : 'Anthropic Claude';
        badge.className = `provider-badge ${prov}`;
      }
      await refreshKeyStatus(prov);
    }
    $('cfg-notify').checked = c.notifications !== false;
    const langSel = $('cfg-language');
    if (langSel) langSel.value = c.language || 'en-US';
  } catch (e) { console.error('loadConfig:', e); }
}

async function refreshKeyStatus(provider) {
  const el = $('cfg-key-status');
  if (!el) return;
  if (provider === 'none') {
    el.textContent = window.i18n ? window.i18n.t('cfg.aiDisabled') : '○ AI disabled';
    el.className = 'key-status';
    return;
  }
  try {
    const key = await api.getApiKey(provider);
    el.textContent = key 
      ? (window.i18n ? window.i18n.t('cfg.keyConfigured') : '● Key configured')
      : (window.i18n ? window.i18n.t('cfg.keyNotConfigured') : '○ Not configured (Optional)');
  } catch (_) { }
}

$('cfg-btn-pick')?.addEventListener('click', async () => {
  try {
    const p = await api.pickVaultPath();
    if (p) {
      $('cfg-vault-display').textContent = p;
      $('cfg-vault-manual').value = p;
    }
  } catch (e) {
    console.error('cfg-btn-pick:', e);
  }
});

$('cfg-vault-manual')?.addEventListener('input', (e) => {
  $('cfg-vault-display').textContent = e.target.value.trim() || (window.i18n ? window.i18n.t('cfg.notConfigured') : 'not configured');
});

$('cfg-provider')?.addEventListener('change', async (e) => {
  const newProv = e.target.value;
  await api.setConfig({ provider: newProv });
  loadConfig();
});

$('cfg-btn-change-key')?.addEventListener('click', () => {
  changingKeyProvider = $('cfg-provider').value;
  $('cfg-key-form-label').textContent = window.i18n.t('cfg.newKey');
  $('cfg-new-key').value = '';
  $('cfg-new-key').placeholder = changingKeyProvider === 'anthropic' ? 'sk-ant-...' : 'AIza...';
  $('cfg-key-form').classList.remove('hidden');
});

$('cfg-toggle-key')?.addEventListener('click', () => {
  const inp = $('cfg-new-key');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  $('cfg-toggle-key').textContent = inp.type === 'password' ? window.i18n.t('ob.show') : window.i18n.t('ob.hide');
});

$('cfg-save-key')?.addEventListener('click', async () => {
  if (!changingKeyProvider) return;
  const key = $('cfg-new-key').value.trim();
  if (!key) return;
  const btn = $('cfg-save-key');
  const oldText = btn.textContent;
  btn.textContent = (window.i18n && window.i18n.t) ? window.i18n.t('ob.validating') : 'Validating';
  btn.disabled = true;
  try {
    const val = await api.validateApiKey(changingKeyProvider, key);
    if (!val.valid) {
      const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
      alert(`${_t('cfg.invalidKey')}: ${val.error}`);
      return;
    }
    await api.setApiKey(changingKeyProvider, key);
    await refreshKeyStatus(changingKeyProvider);
    $('cfg-key-form').classList.add('hidden');
    changingKeyProvider = null;
  } catch (e) {
    alert(`${t('status.error')}: ${e.message}`);
  }
  finally {
    btn.textContent = oldText;
    btn.disabled = false;
  }
});

$('cfg-cancel-key')?.addEventListener('click', () => {
  $('cfg-key-form').classList.add('hidden');
  changingKeyProvider = null;
});

$('cfg-btn-revoke-key')?.addEventListener('click', async () => {
  const prov = $('cfg-provider').value;
  if (!confirm(`Remover chave ${prov}?`)) return;
  await api.deleteApiKey(prov);
  await refreshKeyStatus(prov);
});

$('btn-save-config')?.addEventListener('click', async () => {
  const fb = $('save-feedback');
  try {
    const notConfigured = window.i18n ? window.i18n.t('cfg.notConfigured') : 'not configured';
    const newVault = $('cfg-vault-manual').value.trim() || $('cfg-vault-display').textContent;
    await api.setConfig({
      vaultPath: newVault === notConfigured ? '' : newVault,
      schedule: { hour: parseInt($('cfg-hour').value), minute: parseInt($('cfg-minute').value) },
      provider: $('cfg-provider').value,
      notifications: $('cfg-notify').checked,
    });
    const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
    fb.textContent = _t('cfg.saved');
    fb.className = 'save-feedback ok';
    loadDashboard();
    setTimeout(() => { fb.textContent = ''; fb.className = 'save-feedback'; }, 2000);
  } catch (e) {
    const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
    fb.textContent = _t('status.error');
    fb.className = 'save-feedback err';
  }
});

$('cfg-btn-reset')?.addEventListener('click', async () => {
  if (!confirm('Resetar todas as configurações?')) return;
  await api.setConfig({ onboarded: false, vaultPath: '', provider: 'anthropic', notifications: true, schedule: { hour: 3, minute: 0 }, language: 'en-US' });
  location.reload();
});

// ==============================================================================
// IDIOMA & SYNC
// ==============================================================================
$('cfg-language')?.addEventListener('change', async (e) => {
  const loc = e.target.value;
  if (window.i18n) window.i18n.setLocale(loc);
  applyTranslations();
  await api.setConfig({ language: loc });
});

$('btn-manual-sync')?.addEventListener('click', async () => {
  const btn = $('btn-manual-sync');
  btn.disabled = true;
  const oldText = btn.innerHTML;
  btn.textContent = window.i18n.t('status.loading');
  try {
    const res = await api.gitSync();
    btn.textContent = res.success ? 'OK' : 'Erro';
    btn.style.backgroundColor = res.success ? 'var(--color-vital)' : 'var(--color-dissolucao)';
  } catch (e) { btn.textContent = 'Erro'; }
  setTimeout(() => { btn.disabled = false; btn.innerHTML = oldText; btn.style.backgroundColor = ''; }, 3000);
});

// ==============================================================================
// INSIGHTS
// ==============================================================================
$('btn-refresh-insights')?.addEventListener('click', () => refreshInsights());

async function refreshInsights() {
  const btn = $('btn-refresh-insights');
  if (btn) btn.disabled = true;
  await Promise.all([renderDejavuInsights(), renderCalendarInsights()]);
  if (btn) btn.disabled = false;
}

async function renderDejavuInsights() {
  const container = $('dejavu-section');
  if (!container) return;
  const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
  container.innerHTML = `<div class="insight-empty">${window.i18n.t('status.loading')}</div>`;
  try {
    const matches = await zelador.checkDejavu();
    if (!matches || matches.length === 0) {
      container.innerHTML = `<div class="insight-empty">${window.i18n.t('insig.noPatterns')}</div>`;
      return;
    }
    container.innerHTML = matches.map(m => `
      <div class="insight-card">
        <div class="insight-header">
          <span class="insight-icon">↩</span>
          <span class="insight-title">Déjà Vu — ${m.newNote.name}</span>
        </div>
        <p class="insight-message">${m.message}</p>
        <div class="insight-actions">
          <button class="btn-insight" onclick="window.zelador.openInObsidian('${m.fossilNote.filePath.replace(/\\/g, '/')}')">${_t('action.viewArchived') || 'View archived'}</button>
          <span class="insight-score">${Math.round(m.score * 100)}%</span>
        </div>
      </div>
    `).join('');
  } catch (e) { container.innerHTML = _t('status.error'); }
}

async function renderCalendarInsights() {
  const container = $('calendar-section');
  if (!container) return;
  const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
  container.innerHTML = `<div class="insight-empty">${window.i18n.t('status.loading')}</div>`;
  try {
    const nodes = (await zelador.getGraphData()).nodes;
    const accel = [];
    for (const node of nodes) {
      const res = await zelador.analyzeCalendarDecay(node.filePath);
      if (res.hasExpiredDates) accel.push({ ...node, ...res });
    }
    if (accel.length === 0) {
      container.innerHTML = `<div class="insight-empty">${window.i18n.t('insig.noExpired')}</div>`;
      return;
    }
    container.innerHTML = accel.map(n => `
      <div class="insight-card">
        <div class="insight-header"><span class="insight-title">${n.name}</span><span class="insight-badge">${n.multiplier}x ${_t('insig.faster')}</span></div>
        <p class="insight-message">${_t('insig.expiredDates')}: ${n.dates.join(', ')}</p>
        <div class="insight-actions">
          <button class="btn-insight" onclick="window.zelador.openInObsidian('${n.filePath.replace(/\\/g, '/')}')">${_t('action.open')}</button>
          <button class="btn-insight-secondary" onclick="immunizeNote('${n.filePath.replace(/\\/g, '/')}')">${_t('action.protect')}</button>
        </div>
      </div>
    `).join('');
  } catch (e) { container.innerHTML = _t('status.error'); }
}

async function immunizeNote(path) {
  try {
    await zelador.immunizeNote(path);
    refreshInsights();
    zelador.getMetrics().then(renderHealthBar);
  } catch (e) { console.error(e); }
}

// ==============================================================================
// GESTAO DE NOTAS (ACTIVE / IMMUNE)
// ==============================================================================
async function renderActiveNotes() {
  const list = $('active-list');
  if (!list) return;
  list.innerHTML = `<div class="loading-spinner">${t('status.loading')}</div>`;
  try {
    const notes = await zelador.getActiveNotes();
    list.innerHTML = '';
    if (!notes || notes.length === 0) {
      showElement('active-empty');
      return;
    }
    hideElement('active-empty');

    const shieldSvg = `<svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right:4px; vertical-align:text-bottom;"><path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.225 2.129c.42.35.923.546 1.403.546s.983-.196 1.403-.546a10.726 10.726 0 0 0 2.225-2.129c1.527-1.998 2.807-5.03 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453C9.33 15.5 8.665 15.75 8 15.75s-1.33-.25-1.877-.727a11.775 11.775 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/></svg>`;
    
    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card status-vital';
      const _t = (window.i18n && window.i18n.t) ? window.i18n.t : (s) => s;
      card.innerHTML = `
        <div class="card-header">
          <span class="card-title">${esc(note.fileName)}</span>
          <span class="card-meta">f1</span>
        </div>
        <p class="card-body">${esc(note.folder)}</p>
        <div class="card-actions">
          <span class="card-subtext">${esc(note.filePath)}</span>
          <div class="card-buttons">
            <button class="btn-obsidian">${_t('action.open')}</button>
            <button class="btn-action-alt btn-immune">${shieldSvg} ${_t('active.immunize')}</button>
          </div>
        </div>
      `;
      card.querySelector('.btn-obsidian').addEventListener('click', () => zelador.openInObsidian(note.filePath));
      card.querySelector('.btn-immune').addEventListener('click', async (e) => {
        const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '...';
        const res = await zelador.immunizeNote(note.filePath);
        if (res.success) { renderActiveNotes(); renderImmuneNotes(); }
        else { btn.disabled = false; btn.innerHTML = _t('active.immunize'); alert(res.error); }
      });
      list.appendChild(card);
    });
  } catch (e) {
    console.error('renderActiveNotes:', e);
    list.innerHTML = `<div class="error-msg">Error loading active notes</div>`;
  }
}

async function renderImmuneNotes() {
  const list = $('immune-list');
  if (!list) return;
  list.innerHTML = `<div class="loading-spinner">${t('status.loading')}</div>`;
  try {
    const notes = await zelador.getImmuneNotes();
    list.innerHTML = '';
    if (!notes || notes.length === 0) {
      showElement('immune-empty');
      return;
    }
    hideElement('immune-empty');

    const shieldSlashSvg = `<svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right:4px; vertical-align:text-bottom;"><path d="M1.033 7.252A37.144 37.144 0 0 1 2.335 3.39c.82-2.15 2.502-3.15 4.595-3.324a10.054 10.054 0 0 1 2.14 0c2.093.174 3.775 1.174 4.595 3.324.402 1.056.73 2.154.981 3.272.25 1.12.38 2.261.38 3.407a11.166 11.166 0 0 1-2.454 7.158c-.412.504-.925.792-1.503.792-.578 0-1.09-.288-1.503-.792a11.166 11.166 0 0 1-2.454-7.158c0-1.146.13-2.288.38-3.407q.126-.559.296-1.11m-1.745 1.637a.5.5 0 0 0 .61.353l.353-.102a.5.5 0 1 0-.258-.966l-.353.102a.5.5 0 0 0-.353.613z"/></svg>`;

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card status-vital';
      card.innerHTML = `
        <div class="card-header">
          <span class="card-title">${esc(note.fileName)}</span>
          <span class="card-meta">${window.i18n.t('status.immune')}</span>
        </div>
        <p class="card-body">${esc(note.folder)}</p>
        <div class="card-actions">
          <span class="card-subtext">${esc(note.filePath)}</span>
          <div class="card-buttons">
            <button class="btn-obsidian">${t('action.open')}</button>
            <button class="btn-action-alt btn-remove-immune">${shieldSlashSvg} ${t('immune.remove')}</button>
          </div>
        </div>
      `;
      card.querySelector('.btn-obsidian').addEventListener('click', () => zelador.openInObsidian(note.filePath));
      card.querySelector('.btn-remove-immune').addEventListener('click', async (e) => {
        const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '...';
        const res = await zelador.removeImmunity(note.filePath);
        if (res.success) { renderActiveNotes(); renderImmuneNotes(); }
        else { btn.disabled = false; btn.innerHTML = t('immune.remove'); alert(res.error); }
      });
      list.appendChild(card);
    });
  } catch (e) {
    console.error('renderImmuneNotes:', e);
    list.innerHTML = `<div class="error-msg">Error loading immune notes</div>`;
  }
}

// ==============================================================================
async function initApp() {
  const platform = await window.zelador.getPlatform();
  document.body.classList.add(`platform-${platform}`);
  const config = await api.getConfig();
  if (window.i18n) window.i18n.setLocale(config.language || 'en-US');
  applyTranslations();
  await loadStatus();
  await loadDashboard();

  // Navigation Click Listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) showView(view);
    });
  });

  showView('dashboard');
}

async function boot() {
  console.log('[boot] Starting boot sequence...');
  try {
    // Garantir que começamos com i18n carregado
    if (!window.i18n) {
      console.error('[boot] i18n.js not loaded!');
    }

    console.log('[boot] Calling api.getConfig()...');
    const config = await api.getConfig() || {};
    console.log('[boot] Config received:', JSON.stringify(config));
    const lang = config.language || 'en-US';
    
    if (window.i18n) {
      window.i18n.setLocale(lang);
    }
    
    applyTranslations();

    if (!config.onboarded || !config.vaultPath) {
      console.log('[boot] Status: ONBOARDING');
      showScreen('onboarding');
      // Sincroniza o selector de idioma do onboarding
      if ($('ob-language')) $('ob-language').value = lang;
    } else {
      showScreen('app');
      await initApp();
    }
  } catch (e) {
    console.error('boot error:', e);
    showScreen('onboarding');
    if (window.i18n) window.i18n.setLocale('en-US');
    applyTranslations();
  }
}

boot();
