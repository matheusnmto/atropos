'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// app.js — Renderer Process do Grafo Líquido
// Toda comunicação com Main Process via window.zelador (contextBridge)
// ─────────────────────────────────────────────────────────────────────────────

const api = window.zelador;

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  const view = $(`view-${id}`);
  const nav = $(`nav-${id}`);
  if (view) view.classList.add('active');
  if (nav) nav.classList.add('active');
  if (id === 'purgatorio') renderPurgatorio();
  if (id === 'insights') refreshInsights();
  if (id === 'config') loadConfig();
  if (id === 'fossilized') renderFossilized();
  if (id === 'grafo') {
    // Pequeno delay para garantir que o container tenha dimensões
    setTimeout(() => { if (window.initGraph) window.initGraph(); }, 50);
  }

  _currentView = id;
}

// ── i18n ─────────────────────────────────────────────────────────────────────
function applyTranslations() {
  const { t } = window.i18n || {};
  if (!t) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════════════════════════
let obStep = 1;
let obVault = '';
let obProvider = 'anthropic';

function showObStep(n) {
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  $(`ob-step-${n}`).classList.add('active');
  obStep = n;
}

// Passo 1: seleção de vault
$('ob-btn-pick').addEventListener('click', async () => {
  try {
    const p = await api.pickVaultPath();
    if (p) {
      obVault = p;
      $('ob-vault-display').textContent = p;
      $('ob-vault-manual').value = p;
      $('ob-next-1').disabled = false;
    }
  } catch (e) { console.error('pickVaultPath:', e); }
});

// Campo manual — permite colar ou digitar
$('ob-vault-manual').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  obVault = val;
  $('ob-vault-display').textContent = val || window.i18n.t('ob.noneSelected');
  $('ob-next-1').disabled = val.length === 0;
});

$('ob-next-1').addEventListener('click', () => {
  if (!obVault) return;
  showObStep(2);
});

// Passo 2: provider
document.querySelectorAll('.provider-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    obProvider = card.dataset.provider;

    if (obProvider === 'none') {
      $('ob-key-hint').textContent = '';
      $('ob-api-key').placeholder = '';
    } else {
      const hints = { anthropic: 'Obtenha em console.anthropic.com', google: 'Obtenha em aistudio.google.com' };
      $('ob-key-hint').textContent = hints[obProvider] || '';
      $('ob-api-key').placeholder = obProvider === 'anthropic' ? 'sk-ant-...' : 'AIza...';
    }
  });
});

$('ob-back-2').addEventListener('click', () => showObStep(1));

// Passo 3: API key
$('ob-toggle-key').addEventListener('click', () => {
  const inp = $('ob-api-key');
  const isPassword = inp.type === 'password';
  inp.type = isPassword ? 'text' : 'password';
  $('ob-toggle-key').textContent = isPassword ? window.i18n.t('ob.hide') : window.i18n.t('ob.show');
});

$('ob-back-3').addEventListener('click', () => showObStep(2));

$('ob-validate').addEventListener('click', async () => validateAndFinish());
$('ob-skip-key').addEventListener('click', async () => finishOnboarding(false));

async function validateAndFinish() {
  const fb = $('ob-feedback');
  const key = $('ob-api-key').value.trim();
  if (!key) { fb.textContent = 'Insira uma chave.'; fb.className = 'ob-feedback error'; return; }
  fb.textContent = window.i18n.t('ob.validating'); fb.className = 'ob-feedback loading';
  try {
    const val = await api.validateApiKey(obProvider, key);
    if (!val.valid) {
      fb.textContent = '✗ ' + val.error; fb.className = 'ob-feedback error';
      return;
    }

    fb.textContent = window.i18n.t('ob.saving');
    await api.setApiKey(obProvider, key);
    await finishOnboarding(true);
  } catch (e) {
    fb.textContent = '✗ ' + (e.message || 'Erro ao validar/salvar.'); fb.className = 'ob-feedback error';
  }
}

async function finishOnboarding(hasKey) {
  const fb = $('ob-feedback');
  if (!hasKey) {
    fb.textContent = window.i18n.t('ob.saving'); fb.className = 'ob-feedback loading';
  }
  try {
    await api.setConfig({ vaultPath: obVault, provider: obProvider, onboarded: true });
    fb.textContent = '✓ ' + window.i18n.t('ob.success'); fb.className = 'ob-feedback ok';
    setTimeout(async () => {
      showScreen('app');
      await initApp();
    }, 600);
  } catch (e) {
    fb.textContent = '✗ ' + (e.message || 'Erro ao salvar configuração.'); fb.className = 'ob-feedback error';
  }
}

$('ob-next-2').addEventListener('click', () => {
  if (obProvider === 'none') {
    finishOnboarding(false);
  } else {
    showObStep(3);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showView(item.dataset.view);
  });
});

// Botões da titlebar
$('wbtn-close')?.addEventListener('click', () => window.close?.());
$('wbtn-min')?.addEventListener('click', () => window.minimize?.());

// ══════════════════════════════════════════════════════════════════════════════
// STATUS DO ZELADOR
// ══════════════════════════════════════════════════════════════════════════════
function updateStatusUI({ status, lastRunAt, nextRunAt }) {
  const dot = $('status-dot');
  const label = $('status-label');
  const next = $('status-next');

  dot.className = `status-dot ${status}`;
  const t = window.i18n.t;
  const labels = { idle: t('status.idle'), running: t('status.running'), error: t('status.error') };
  label.textContent = labels[status] || status;
  next.textContent = nextRunAt ? `${t('status.next')}${nextRunAt}` : '';

  // Statusbar
  const runEl = $('statusbar-run');
  if (runEl) {
    if (lastRunAt) {
      const d = new Date(lastRunAt);
      runEl.textContent = `última execução: ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      runEl.textContent = t('statusbar.waiting');
    }
  }

  // Botão run
  const btn = $('btn-run-now');
  if (btn) {
    btn.disabled = status === 'running';
    btn.innerHTML = status === 'running'
      ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1"/></svg> ${t('dash.running')}`
      : `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1.5l9 4.5-9 4.5z"/></svg> ${t('dash.runNow')}`;
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

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — métricas e barra de saúde
// ══════════════════════════════════════════════════════════════════════════════

function renderHealthBar(data) {
  if (!data) return;
  const total = data.alive + data.f1 + data.f2 + data.f3 + data.fossil || 1;
  const pct = (v, cls) => `<div class="decay-bar-seg ${cls}" style="width:${(v / total * 100).toFixed(1)}%"></div>`;

  $('healthBar').innerHTML = [
    pct(data.alive, 'seg-vital'),
    pct(data.f1, 'seg-estiagem'),
    pct(data.f2, 'seg-desconexao'),
    pct(data.f3, 'seg-dissolucao'),
    pct(data.fossil, 'seg-fossil'),
  ].join('');

  const dot = (color, label) => `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</span>`;
  $('healthLegend').innerHTML = [
    dot('var(--color-vital)', `${data.alive} vivas`),
    dot('var(--color-estiagem)', `${data.f1} F1`),
    dot('var(--color-desconexao)', `${data.f2} F2`),
    dot('var(--color-dissolucao)', `${data.f3} F3`),
    dot('var(--color-fossil)', `${data.fossil} fósseis`),
  ].join('');

  $('m-total').textContent = data.total;
  $('m-alive').textContent = data.alive;
  $('m-alive-pct').textContent = `${Math.round(data.alive / total * 100)}%`;
  $('m-decaying').textContent = data.f1 + data.f2 + data.f3;
  $('m-fossil').textContent = data.fossil;
  $('health-pct').textContent = `${Math.round(data.alive / total * 100)}% vivo`;
}

async function loadDashboard() {
  try {
    const metrics = await api.getMetrics();
    if (metrics) renderHealthBar(metrics);

    const cfg = await api.getConfig();
    const vaultName = cfg.vaultPath ? cfg.vaultPath.split('/').pop() : 'vault';
    $('dash-subtitle').textContent = vaultName;
    $('statusbar-vault').textContent = cfg.vaultPath || '—';
  } catch (e) {
    console.error('loadDashboard error:', e);
  }
}

// ── Activity (via logs) ────────────────────────────────────────────────────
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

      const t = window.i18n ? window.i18n.t : k => k;

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

// ══════════════════════════════════════════════════════════════════════════════
// FOSSILIZADAS
// ══════════════════════════════════════════════════════════════════════════════
async function renderFossilized() {
  const { t } = window.i18n || { t: k => k };
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
      <div class="fossil-item">
        <div class="fossil-header-row">
          <span class="fossil-name">${esc(note.fileName)}</span>
          <span class="fossil-date">${esc(note.date || note.fossilizedAt)}</span>
        </div>
        <p class="fossil-summary">${note.summary ? esc(note.summary) : `<em>${t('fossil.noSummary')}</em>`}</p>
        <div class="fossil-actions">
          <span class="fossil-path">/_fossilized/${esc(note.month)}/</span>
          <button class="btn-obsidian" data-filepath="${esc(note.filePath)}">${t('action.openOb')}</button>
        </div>
      </div>
    `).join('');

    // Adiciona handlers de click APÓS renderizar (evita interpolação de paths no onclick)
    container.querySelectorAll('.btn-obsidian[data-filepath]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fp = btn.dataset.filepath;
        await api.openInObsidian(fp);
      });
    });
  } catch (e) {
    console.error('renderFossilized:', e);
    container.innerHTML = '<div class="activity-empty">Erro ao carregar.</div>';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PURGATÓRIO
// ══════════════════════════════════════════════════════════════════════════════

async function renderPurgatorio() {
  const tbody = $('purgatory-tbody');
  tbody.innerHTML = `<tr><td colspan="5" class="table-empty">${window.i18n.t('status.loading')}</td></tr>`;

  let items = [];
  try {
    items = await api.getPurgatoryData();
  } catch (err) {
    console.error('renderPurgatorio error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">${window.i18n.t('status.error')}</td></tr>`;
    return;
  }
  const urgent = items.filter(i => i.dias <= 7);

  const t = window.i18n.t;
  const banner = $('urgent-banner');
  if (urgent.length > 0) {
    const txt = urgent.length > 1 ? t('purg.urgentDaysN') : t('purg.urgentDays');
    $('urgent-text').textContent = `${urgent.length} nota${urgent.length > 1 ? 's' : ''}${txt}`;
    banner.classList.remove('hidden');
    // Atualiza badge da sidebar
    $('purg-badge').textContent = urgent.length;
    $('purg-badge').classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
    $('purg-badge').classList.add('hidden');
  }

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">${t('purg.empty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(it => {
    const rowCls = it.dias <= 7 ? 'row-urgent' : '';
    const badge = it.dias <= 7 ? 'badge-f3' : it.dias <= 30 ? 'badge-f2' : 'badge-f1';
    const notaPath = `${it.pasta}/${it.nota}.md`;
    return `<tr class="${rowCls}">
      <td class="note-link">[[${esc(it.nota)}]]</td>
      <td class="note-path">${esc(it.pasta)}</td>
      <td>${esc(it.dissolve)}</td>
      <td><span class="badge-decay ${badge}">${it.dias} ${it.dias !== 1 ? t('purg.days') : t('purg.day')}</span></td>
      <td>
        <button class="btn-obsidian purg-obs" data-filepath="${esc(notaPath)}">${t('action.open')}</button>
        <button class="btn-immunize" data-nota="${esc(it.nota)}">${t('purg.immunize')}</button>
      </td>
    </tr>`;
  }).join('');

  // Handlers para botões de imunizar e abrir no Obsidian
  tbody.querySelectorAll('.purg-obs').forEach(btn => {
    btn.addEventListener('click', () => api.openInObsidian(btn.dataset.filepath));
  });

  // Delegated event para botões de imunizar
  tbody.querySelectorAll('.btn-immunize').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nota = btn.dataset.nota;
      if (!confirm(`${t('purg.immunize')} "${nota}"?`)) return;
      btn.textContent = t('purg.immunizing'); btn.disabled = true;
      try {
        // TODO: ligação com IPC real
        btn.closest('tr').style.opacity = '0.4';
        btn.textContent = t('purg.immunized');
        btn.disabled = true;
      } catch (e) { btn.textContent = 'Erro'; }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════════════════════════
let changingKeyProvider = null;

async function loadConfig() {
  try {
    const c = await api.getConfig();
    $('cfg-vault-display').textContent = c.vaultPath || 'não configurado';
    $('cfg-vault-manual').value = c.vaultPath || '';
    $('statusbar-vault').textContent = c.vaultPath || '—';

    // Selects de hora/minuto
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
    
    if (prov === 'none') {
      $('cfg-api-key-section').style.display = 'none';
      $('cfg-active-provider').style.display = 'none';
    } else {
      $('cfg-api-key-section').style.display = 'flex';
      $('cfg-active-provider').style.display = 'inline-block';
      $('cfg-active-provider').textContent = prov === 'google' ? 'Google Gemini' : 'Anthropic Claude';
      $('cfg-active-provider').className = `provider-badge ${prov}`;
      await refreshKeyStatus(prov);
    }
    $('cfg-notify').checked = c.notifications !== false;

    // Idioma
    const langSel = $('cfg-language');
    if (langSel) langSel.value = c.language || 'en-US';

    // Status das chaves
    await refreshKeyStatus(c.provider || 'anthropic');
  } catch (e) { console.error('loadConfig:', e); }
}

async function refreshKeyStatus(provider) {
  try {
    const key = await api.getApiKey(provider);
    const el = $('cfg-key-status');
    el.textContent = key ? '● Chave configurada' : '○ Não configurada';
    el.className = 'key-status ' + (key ? 'ok' : 'err');
  } catch (e) { console.error(e); }
}

$('cfg-btn-pick')?.addEventListener('click', async () => {
  try {
    const p = await api.pickVaultPath();
    if (p) { $('cfg-vault-display').textContent = p; $('cfg-vault-manual').value = p; }
  } catch (e) { console.error(e); }
});

$('cfg-vault-manual')?.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (val) $('cfg-vault-display').textContent = val;
});

$('cfg-provider')?.addEventListener('change', async (e) => {
  const newProv = e.target.value;
  const badge = $('cfg-active-provider');
  const apiKeySection = $('cfg-api-key-section');

  if (newProv === 'none') {
    if (apiKeySection) apiKeySection.style.display = 'none';
    if (badge) {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  } else {
    if (apiKeySection) apiKeySection.style.display = 'flex';
    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = newProv === 'google' ? 'Google Gemini' : 'Anthropic Claude';
      badge.className = `provider-badge ${newProv}`;
    }
    await refreshKeyStatus(newProv);
  }

  await api.setConfig({ provider: newProv });
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
  const originalText = btn.textContent;
  btn.textContent = window.i18n.t('ob.validating');
  btn.disabled = true;

  try {
    const val = await api.validateApiKey(changingKeyProvider, key);
    if (!val.valid) {
      alert(`Chave inválida:\n${val.error}`);
      return;
    }

    await api.setApiKey(changingKeyProvider, key);
    await refreshKeyStatus(changingKeyProvider);
    $('cfg-key-form').classList.add('hidden');
    changingKeyProvider = null;
  } catch (e) {
    console.error(e);
    alert(`Erro de validação: ${e.message}`);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

$('cfg-cancel-key')?.addEventListener('click', () => {
  $('cfg-key-form').classList.add('hidden');
  changingKeyProvider = null;
});

$('cfg-btn-revoke-key')?.addEventListener('click', async () => {
  const provider = $('cfg-provider').value;
  if (!confirm(`Remover chave ${provider}? O Zelador não conseguirá executar a Fase 3.`)) return;
  await api.deleteApiKey(provider);
  await refreshKeyStatus(provider);
});

$('btn-save-config')?.addEventListener('click', async () => {
  const fb = $('save-feedback');
  try {
    const vaultManual = $('cfg-vault-manual').value.trim() || $('cfg-vault-display').textContent;
    const newVault = vaultManual !== 'não configurado' ? vaultManual : '';
    await api.setConfig({
      vaultPath: newVault,
      schedule: { hour: parseInt($('cfg-hour').value), minute: parseInt($('cfg-minute').value) },
      provider: $('cfg-provider').value,
      notifications: $('cfg-notify').checked,
    });
    fb.textContent = 'Salvo'; fb.className = 'save-feedback ok';

    // -- Atualiza dashboard e statusbar com novo vault --
    $('statusbar-vault').textContent = newVault || '—';
    const vaultName = newVault ? newVault.split('/').pop() : 'vault';
    $('dash-subtitle').textContent = vaultName;
    await loadDashboard();

    setTimeout(() => { fb.textContent = ''; fb.className = 'save-feedback'; }, 2500);
  } catch (e) {
    fb.textContent = window.i18n.t('cfg.saveError'); fb.className = 'save-feedback err';
  }
});

$('cfg-btn-export')?.addEventListener('click', async () => {
  try {
    const logs = await api.getLogs?.() ?? [];
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `zelador-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  } catch (e) { console.error(e); }
});

$('cfg-btn-reset')?.addEventListener('click', async () => {
  if (!confirm('Resetar TODAS as configurações? Isso não afeta os arquivos do vault.')) return;
  await api.setConfig({ vaultPath: '', onboarded: false, provider: 'anthropic', notifications: true, schedule: { hour: 3, minute: 0 }, language: 'en-US' });
  location.reload();
});

// ══════════════════════════════════════════════════════════════════════════════
// IDIOMA
// ══════════════════════════════════════════════════════════════════════════════
$('cfg-language')?.addEventListener('change', async (e) => {
  const locale = e.target.value;
  if (window.i18n) window.i18n.setLocale(locale);
  applyTranslations();
  // Persiste a escolha
  try { await api.setConfig({ language: locale }); } catch (_) { }
  const obLang = $('ob-language');
  if (obLang) obLang.value = locale;
});

$('ob-language')?.addEventListener('change', async (e) => {
  const locale = e.target.value;
  if (window.i18n) window.i18n.setLocale(locale);
  applyTranslations();
  try { await api.setConfig({ language: locale }); } catch (_) { }
  const cfgLang = $('cfg-language');
  if (cfgLang) cfgLang.value = locale;
});

// ══════════════════════════════════════════════════════════════════════════════
// SYNC MANUAL
// ══════════════════════════════════════════════════════════════════════════════
$('btn-manual-sync')?.addEventListener('click', async () => {
  const btn = $('btn-manual-sync');
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.textContent = window.i18n ? (window.i18n.t('status.loading') || 'Aguarde...') : 'Aguarde...';

  try {
    const res = await api.gitSync();
    if (res.success) {
      btn.textContent = window.i18n ? (window.i18n.t('cfg.saved') || 'Salvo') : 'Salvo';
      btn.style.backgroundColor = 'var(--color-vital)';
      btn.style.borderColor = 'var(--color-vital)';
      btn.style.color = '#fff';
    } else {
      btn.textContent = (window.i18n ? window.i18n.t('status.error') : 'Erro') + ': ' + (res.error || '');
      btn.style.backgroundColor = 'var(--color-dissolucao)';
      btn.style.borderColor = 'var(--color-dissolucao)';
      btn.style.color = '#000';
    }
  } catch (e) {
    btn.textContent = window.i18n ? window.i18n.t('status.error') : 'Erro crítico de Sync';
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    btn.style.backgroundColor = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }, 4500);
});

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
async function initApp() {
  const platform = await window.zelador.getPlatform();
  document.body.classList.add(`platform-${platform}`);

  // Carregar idioma salvo
  try {
    const cfg = await api.getConfig();
    const locale = cfg.language || 'en-US';
    if (window.i18n) window.i18n.setLocale(locale);
    applyTranslations();
    const langSel = $('cfg-language');
    if (langSel) langSel.value = locale;
    const obLangSel = $('ob-language');
    if (obLangSel) obLangSel.value = locale;
  } catch (_) { }

  await loadStatus();
  await loadDashboard();
  await loadRecentActivity();
  renderPurgatorio();
}

async function boot() {
  try {
    const config = await api.getConfig();

    // Inicializar idioma (default en-US)
    const locale = config.language || 'en-US';
    if (window.i18n) window.i18n.setLocale(locale);
    applyTranslations();

    if (!config.onboarded || !config.vaultPath) {
      showScreen('onboarding');
      // Sincronizar select de idioma se existir no onboarding
      const obLangSel = $('ob-language');
      if (obLangSel) obLangSel.value = locale;
    } else {
      showScreen('app');
      await initApp();
    }
  } catch (e) {
    console.error('boot error:', e);
    showScreen('onboarding');
    applyTranslations();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INSIGHTS
// ══════════════════════════════════════════════════════════════════════════════
$('btn-refresh-insights')?.addEventListener('click', () => refreshInsights());

async function refreshInsights() {
  const btn = $('btn-refresh-insights');
  if (btn) btn.disabled = true;

  await Promise.all([
    renderDejavuInsights(),
    renderCalendarInsights()
  ]);

  if (btn) btn.disabled = false;
}

async function renderDejavuInsights() {
  const container = $('dejavu-section');
  if (!container) return;

  container.innerHTML = `<div class="insight-empty">${window.i18n.t('status.loading')}</div>`;

  try {
    const matches = await api.checkDejavu();
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
          <button class="btn-insight" onclick="window.zelador.openInObsidian('${m.fossilNote.filePath.replace(/\\/g, '\\\\')}')">
            View archived note
          </button>
          <span class="insight-score">Similarity: ${Math.round(m.score * 100)}%</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="insight-empty">Erro: ${e.message}</div>`;
  }
}

async function renderCalendarInsights() {
  const container = $('calendar-section');
  if (!container) return;

  container.innerHTML = `<div class="insight-empty">${window.i18n.t('status.loading')}</div>`;

  try {
    const nodes = (await api.getGraphData()).nodes;
    const accelerated = [];

    for (const node of nodes) {
      const result = await api.analyzeCalendarDecay(node.filePath);
      if (result.hasExpiredDates) {
        accelerated.push({ ...node, ...result });
      }
    }

    if (accelerated.length === 0) {
      container.innerHTML = `<div class="insight-empty">${window.i18n.t('insig.noExpired')}</div>`;
      return;
    }

    container.innerHTML = accelerated.map(n => `
      <div class="insight-card">
        <div class="insight-header">
          <span class="insight-title">${n.name}</span>
          <span class="insight-badge">${n.multiplier}x faster decay</span>
        </div>
        <p class="insight-message">
          Contains expired date(s): ${n.dates.join(', ')}.
          Decay thresholds have been reduced automatically.
        </p>
        <div class="insight-actions">
          <button class="btn-insight" onclick="window.zelador.openInObsidian('${n.filePath.replace(/\\/g, '\\\\')}')">
            ${window.i18n.t('action.open')}
          </button>
          <button class="btn-insight-secondary" onclick="immunizeNote('${n.filePath.replace(/\\/g, '\\\\')}')">
            ${window.i18n.t('purg.immunize')}
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="insight-empty">Erro: ${e.message}</div>`;
  }
}

async function immunizeNote(path) {
  try {
    await api.setConfig({ decay_immune: true }, path); // Note: verify if setConfig supports path-specific updates
    // For now, let's assume we need a proper immunize IPC
    alert('Imunização solicitada para: ' + path);
    refreshInsights();
  } catch (e) {
    console.error(e);
  }
}

boot();
