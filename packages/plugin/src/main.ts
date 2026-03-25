import {
  Plugin,
  TFile,
  Notice,
  PluginSettingTab,
  App,
  Setting,
  ItemView,
  WorkspaceLeaf,
  Modal,
} from 'obsidian';

const VIEW_TYPE_ATROPOS = 'atropos-view';

// ── Settings ──────────────────────────────────────────────────────────────────
interface AtroposSettings {
  phase1Days: number;
  phase2Days: number;
  phase3Days: number;
  aiProvider: 'none' | 'google' | 'anthropic';
  apiKey: string;
  enableSemanticLinks: boolean;
  immuneFolders: string[];
}

const DEFAULT_SETTINGS: AtroposSettings = {
  phase1Days: 30, phase2Days: 60, phase3Days: 90,
  aiProvider: 'none', apiKey: '', enableSemanticLinks: false, immuneFolders: [],
};

// ── Decay stats ───────────────────────────────────────────────────────────────
interface DecayStats {
  total: number;
  vital: number;
  phase1: number;
  phase2: number;
  phase3: number;
  fossil: number;
  immune: number;
  files: {
    vital: TFile[];
    phase1: TFile[];
    phase2: TFile[];
    phase3: TFile[];
    fossil: TFile[];
    immune: TFile[];
  };
}

// ── Sidebar view ──────────────────────────────────────────────────────────────
class AtroposView extends ItemView {
  plugin: AtroposPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: AtroposPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType()    { return VIEW_TYPE_ATROPOS; }
  getDisplayText() { return 'Atropos'; }
  getIcon()        { return 'skull'; }

  async onOpen()  { this.draw(); }
  async onClose() {}

  draw() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('atropos-plugin');

    const view = root.createDiv({ cls: 'atropos-view' });

    // Title
    view.createDiv({ cls: 'atropos-view-header' })
      .createEl('span', { cls: 'atropos-view-title', text: 'Atropos — Decay Engine' });

    // Health bar section
    const barSection = view.createDiv();
    const barLabel = barSection.createDiv({ cls: 'atropos-health-label' });
    barLabel.createEl('span', { text: 'VAULT HEALTH' });
    barLabel.createEl('span', { text: '—', attr: { id: 'atropos-health-pct' } });
    barSection.createDiv({ cls: 'atropos-decay-bar', attr: { id: 'atropos-bar' } })
      .createDiv({ cls: 'atropos-bar-seg atropos-bar-vital', attr: { style: 'width:100%' } });

    // Legend
    view.createDiv({ cls: 'atropos-legend', attr: { id: 'atropos-legend' } });

    // Run button
    const btn = view.createEl('button', { cls: 'atropos-btn-run', attr: { id: 'atropos-run-btn' } });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('viewBox', '0 0 12 12');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M2 1.5l9 4.5-9 4.5z'); path.setAttribute('fill', 'currentColor');
    svg.appendChild(path); btn.appendChild(svg);
    btn.createEl('span', { text: 'Run decay cycle' });
    btn.onclick = async () => {
      btn.addClass('running');
      btn.querySelector('span')!.textContent = 'Running…';
      await this.plugin.runDecayCycle();
      btn.removeClass('running');
      btn.querySelector('span')!.textContent = 'Run decay cycle';
      this.refreshStats();
    };

    // Footer
    view.createDiv({ cls: 'atropos-footer', attr: { id: 'atropos-footer' } }).textContent = 'Never run';

    this.refreshStats();
  }

  // ── Render clickable legend with expandable note lists ──────────────────────
  renderLegend(container: HTMLElement, stats: DecayStats) {
    container.empty();

    const rows: {
      cls: string; dot: string; label: string; count: number;
      files?: TFile[]; clickable: boolean;
    }[] = [
      { cls: 'vital',      dot: '#1D9E75', label: 'Active',              count: stats.vital,  files: stats.files.vital,  clickable: true  },
      { cls: 'estiagem',   dot: '#888780', label: 'F1 — Drought',        count: stats.phase1, files: stats.files.phase1, clickable: true  },
      { cls: 'desconexao', dot: '#BA7517', label: 'F2 — Disconnection',  count: stats.phase2, files: stats.files.phase2, clickable: true  },
      { cls: 'dissolucao', dot: '#993C1D', label: 'F3 — Dissolution',    count: stats.phase3, files: stats.files.phase3, clickable: true  },
      { cls: 'fossil',     dot: '#444441', label: 'Fossilized',           count: stats.fossil, files: stats.files.fossil, clickable: true  },
      { cls: 'immune',     dot: '#7F77DD', label: 'Immune',               count: stats.immune, files: stats.files.immune, clickable: true  },
    ];

    for (const row of rows) {
      // Wrapper groups the header row + note list together
      const wrapper = container.createDiv();

      const r = wrapper.createDiv({ cls: `atropos-legend-row ${row.cls}` });
      const dot = r.createDiv({ cls: 'atropos-legend-dot' });
      dot.style.background = row.dot;
      r.createEl('span', { cls: 'atropos-legend-label', text: row.label });
      r.createEl('span', { cls: 'atropos-legend-count', text: String(row.count) });

      if (row.clickable && row.files) {
        r.addClass('clickable');
        const chevron = r.createEl('span', { cls: 'atropos-chevron', text: '›' });

        // Build note list (hidden by default)
        const list = wrapper.createDiv({ cls: 'atropos-note-list' });

        if (row.files.length === 0) {
          list.createDiv({ cls: 'atropos-note-empty', text: 'No notes in this phase.' });
        } else {
          for (const file of row.files) {
            const item = list.createDiv({ cls: 'atropos-note-item' });
            const parts = file.path.split('/');
            const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
            item.createEl('span', { cls: 'atropos-note-name', text: file.basename });
            if (folder) item.createEl('span', { cls: 'atropos-note-folder', text: folder });

            item.onclick = () => {
              this.plugin.app.workspace.openLinkText(file.path, '', false);
            };
          }
        }

        // Toggle expand on click
        r.onclick = () => {
          const isOpen = r.hasClass('open');
          r.toggleClass('open', !isOpen);
          list.toggleClass('open', !isOpen);
        };
      }
    }
  }

  async refreshStats() {
    const stats = await this.plugin.computeDecayStats();
    const root = this.containerEl.children[1] as HTMLElement;

    // Health %
    const pct = stats.total > 0 ? Math.round((stats.vital / stats.total) * 100) : 100;
    const pctEl = root.querySelector('#atropos-health-pct') as HTMLElement;
    if (pctEl) pctEl.textContent = `${pct}%`;

    // Decay bar
    const bar = root.querySelector('#atropos-bar') as HTMLElement;
    if (bar && stats.total > 0) {
      bar.empty();
      const segs = [
        { cls: 'atropos-bar-vital',      count: stats.vital  },
        { cls: 'atropos-bar-estiagem',   count: stats.phase1 },
        { cls: 'atropos-bar-desconexao', count: stats.phase2 },
        { cls: 'atropos-bar-dissolucao', count: stats.phase3 },
        { cls: 'atropos-bar-fossil',     count: stats.fossil },
      ];
      for (const seg of segs) {
        if (seg.count === 0) continue;
        const el = bar.createDiv({ cls: `atropos-bar-seg ${seg.cls}` });
        el.style.width = `${(seg.count / stats.total * 100).toFixed(1)}%`;
      }
    }

    // Legend
    const legend = root.querySelector('#atropos-legend') as HTMLElement;
    if (legend) this.renderLegend(legend, stats);

    // Footer
    const footer = root.querySelector('#atropos-footer') as HTMLElement;
    if (footer) {
      const now = new Date();
      footer.textContent = `Last refreshed: ${now.toLocaleTimeString()} · ${stats.total} notes`;
    }
  }
}

// ── Cycle report modal ────────────────────────────────────────────────────────
class AtroposReportModal extends Modal {
  stats: { phase1: number; phase2: number; phase3: number; errors: number };

  constructor(app: App, stats: { phase1: number; phase2: number; phase3: number; errors: number }) {
    super(app);
    this.stats = stats;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('atropos-plugin');
    contentEl.createEl('h2', { text: 'Decay Cycle Complete' });

    const grid = contentEl.createDiv({ cls: 'atropos-report-grid' });
    const cards = [
      { cls: 'phase1', label: 'Phase 1 — Drought',       value: this.stats.phase1 },
      { cls: 'phase2', label: 'Phase 2 — Disconnection',  value: this.stats.phase2 },
      { cls: 'phase3', label: 'Phase 3 — Dissolution',    value: this.stats.phase3 },
      { cls: 'errors', label: 'Errors',                    value: this.stats.errors },
    ];
    for (const card of cards) {
      const c = grid.createDiv({ cls: `atropos-report-card ${card.cls}` });
      c.createEl('span', { cls: 'atropos-report-label', text: card.label });
      c.createEl('span', { cls: 'atropos-report-value',  text: String(card.value) });
    }

    contentEl.createEl('p', {
      text: 'Fossilized notes were archived to _fossilized/.',
      attr: { style: 'font-size:12px; color: var(--text-muted); margin-top:8px;' },
    });
  }

  onClose() { this.contentEl.empty(); }
}

// Paths the plugin skips — source code, system folders, archived files
const IGNORED_PATHS = [
  '_fossilized/', '.zelador/', 'node_modules/',
  'electron/', 'renderer/', '.obsidian/', 'packages/',
];

export default class AtroposPlugin extends Plugin {
  settings: AtroposSettings;
  statusBarItem: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_ATROPOS, (leaf) => new AtroposView(leaf, this));

    this.addRibbonIcon('skull', 'Atropos', () => this.activateView());

    // Status bar
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass('atropos-plugin');
    this.renderStatusBar(null);
    this.statusBarItem.addEventListener('click', () => this.activateView());

    // Commands
    this.addCommand({ id: 'run-decay-cycle',   name: 'Run decay cycle',         callback: () => this.runDecayCycle() });
    this.addCommand({ id: 'open-panel',         name: 'Open Atropos panel',      callback: () => this.activateView() });
    this.addCommand({ id: 'open-purgatory',     name: 'Open Purgatory',          callback: () => this.openPurgatory() });
    this.addCommand({
      id: 'immunize-note', name: 'Immunize current note',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file) { if (!checking) this.immunizeNote(file); return true; }
        return false;
      },
    });

    this.registerEvent(this.app.workspace.on('file-open', (file) => { if (file) this.onFileOpen(file); }));
    this.registerEvent(this.app.vault.on('modify', (file) => { if (file instanceof TFile) this.onFileModify(file); }));

    this.addSettingTab(new AtroposSettingTab(this.app, this));
    this.computeDecayStats().then((s) => this.renderStatusBar(s));
    console.log('[Atropos] Plugin loaded.');
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_ATROPOS);
    console.log('[Atropos] Plugin unloaded.');
  }

  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings()  { await this.saveData(this.settings); }

  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_ATROPOS);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE_ATROPOS, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  renderStatusBar(stats: DecayStats | null) {
    this.statusBarItem.empty();
    const wrap = this.statusBarItem.createDiv({ cls: 'atropos-status-bar' });
    if (!stats) {
      wrap.createDiv({ cls: 'atropos-status-dot' });
      wrap.createEl('span', { text: 'atropos' });
      return;
    }
    const dotCls = stats.phase3 > 0 ? 'dissolucao' : stats.phase2 > 0 ? 'desconexao' : stats.phase1 > 0 ? 'estiagem' : 'vital';
    wrap.createDiv({ cls: `atropos-status-dot ${dotCls}` });
    wrap.createEl('span', { text: `atropos · ${stats.phase1}F1 ${stats.phase2}F2 ${stats.phase3}F3` });
  }

  // ── Compute stats WITH file lists ─────────────────────────────────────────
  async computeDecayStats(): Promise<DecayStats> {
    const allFiles = this.app.vault.getMarkdownFiles();

    // Filtro mais agressivo para pastas ignoradas
    const files = allFiles.filter(f => !IGNORED_PATHS.some(ig => f.path.includes(ig)));
    const immuneFolders = this.settings.immuneFolders;

    const stats: DecayStats = {
      total: 0, vital: 0, phase1: 0, phase2: 0, phase3: 0, fossil: 0, immune: 0,
      files: { vital: [], phase1: [], phase2: [], phase3: [], fossil: [], immune: [] },
    };

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter || {};

      // Uma nota é fóssil se tem o status ou se o nível é 3
      const isFossil = fm.status === 'fossilized' || String(fm.decay_level) === '3';
      const isImmune = fm.decay_immune === true || immuneFolders.some(i => file.path.startsWith(i));

      if (isFossil) {
        stats.fossil++;
        stats.files.fossil.push(file);
      } else if (isImmune) {
        stats.immune++;
        stats.files.immune.push(file);
      } else {
        const level = parseInt(String(fm.decay_level)) || 0;
        if      (level === 0) { stats.vital++; stats.files.vital.push(file); }
        else if (level === 1) { stats.phase1++; stats.files.phase1.push(file); }
        else if (level === 2) { stats.phase2++; stats.files.phase2.push(file); }
        else if (level >= 3)  { stats.fossil++; stats.files.fossil.push(file); } // fallback
      }
      stats.total++;
    }

    // Fossilized originals in _fossilized/ (always count, but prevent duplicates)
    for (const file of allFiles.filter(f => f.path.includes('_fossilized/'))) {
      // Se por algum motivo já foi adicionado pelo loop anterior, ignore
      if (stats.files.fossil.includes(file)) continue;
      
      stats.fossil++;
      stats.files.fossil.push(file);
      stats.total++;
    }

    return stats;
  }

  private refreshViews() {
    this.computeDecayStats().then((stats) => {
      this.renderStatusBar(stats);
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ATROPOS)) {
        (leaf.view as AtroposView).refreshStats();
      }
    });
  }

  // ── File open / modify ──────────────────────────────────────────────────────
  async onFileOpen(file: TFile) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm || fm.decay_immune || !fm.decay_level || fm.decay_level === 0) return;
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.decay_level = 0;
      delete data.decay_since;
      delete data.links_removed_at;
    });
    console.log(`[Atropos] Decay reset for: ${file.name}`);
    this.refreshViews();
  }

  async onFileModify(_file: TFile) { /* intentionally no-op — only onFileOpen resets decay */ }

  // ── Run decay cycle ─────────────────────────────────────────────────────────
  async runDecayCycle() {
    new Notice('Atropos: running decay cycle…');

    const files = this.app.vault.getMarkdownFiles().filter(f =>
      !IGNORED_PATHS.some(ig => f.path.startsWith(ig))
    );
    let phase1 = 0, phase2 = 0, phase3 = 0, errors = 0;
    let scanned = 0;

    for (const file of files) {
      try {
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        if (fm.decay_immune) continue;
        if (this.settings.immuneFolders.some(f => file.path.startsWith(f))) continue;
        if (fm.status === 'fossilized') continue;

        const stat = await this.app.vault.adapter.stat(file.path);
        let inactivityMs = Date.now() - (stat?.mtime || 0);
        if (fm.decay_since) {
          const t = new Date(fm.decay_since).getTime();
          if (!isNaN(t)) inactivityMs = Date.now() - t;
        }
        const days = inactivityMs / 86400000;
        scanned++;

        if      (days >= this.settings.phase3Days) { await this.applyPhase3(file, fm); phase3++; }
        else if (days >= this.settings.phase2Days) { await this.applyPhase2(file, fm); phase2++; }
        else if (days >= this.settings.phase1Days) { await this.applyPhase1(file, fm); phase1++; }
      } catch (err) {
        console.error(`[Atropos] Error processing ${file.path}:`, err);
        errors++;
      }
    }

    // Wait for metadata cache to settle before refreshing UI counts
    setTimeout(() => this.refreshViews(), 800);

    const total = phase1 + phase2 + phase3;
    let summary: string;
    if (total === 0 && errors === 0) {
      summary = `✅ Atropos: ${scanned} notes scanned — vault is healthy, nothing to decay`;
    } else {
      summary = `✅ Atropos done — F1:${phase1} F2:${phase2} F3:${phase3}${errors > 0 ? ` ⚠ ${errors} errors` : ''}`;
    }
    new Notice(summary, 6000);
    new AtroposReportModal(this.app, { phase1, phase2, phase3, errors }).open();
  }

  // ── Phases ──────────────────────────────────────────────────────────────────
  async applyPhase1(file: TFile, fm: any) {
    if (fm.decay_level >= 1) return;
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.decay_level = 1;
      if (!data.decay_since) data.decay_since = new Date().toISOString().split('T')[0];
    });
  }

  async applyPhase2(file: TFile, fm: any) {
    if (fm.decay_level >= 2) return;
    const noteName = file.basename;

    // Use resolvedLinks to find only files that actually link to this note —
    // avoids reading every file in the vault (O(n) → O(backlinks))
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const filesToCheck: TFile[] = [];
    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (sourcePath === file.path) continue;
      if (file.path in links) {
        const f = this.app.vault.getAbstractFileByPath(sourcePath);
        if (f instanceof TFile) filesToCheck.push(f);
      }
    }

    for (const other of filesToCheck) {
      const content = await this.app.vault.read(other);
      if (!content.includes(`[[${noteName}`)) continue;
      const newContent = content.replace(
        new RegExp(`\\[\\[${noteName}(?:#[^\\]|]+)?(?:\\|([^\\]]+))?\\]\\]`, 'g'),
        (_m, alias) => alias ? alias.trim() : noteName
      );
      if (newContent !== content) await this.app.vault.modify(other, newContent);
    }

    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.decay_level = 2;
      data.links_removed_at = new Date().toISOString().split('T')[0];
    });
  }

  async applyPhase3(file: TFile, fm: any) {
    if (fm.decay_level >= 3) return;
    const content = await this.app.vault.read(file);
    let summary = 'No summary available — AI provider not configured.';
    if (this.settings.aiProvider !== 'none' && this.settings.apiKey) {
      try { summary = await this.compressWithAI(content); } catch { /* ignore */ }
    }
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fossilDir = `_fossilized/${month}`;
    const fossilPath = `${fossilDir}/${file.name}`;
    await this.app.vault.adapter.mkdir(fossilDir);
    await this.app.vault.copy(file, fossilPath);
    const dateStr = now.toISOString().split('T')[0];
    await this.app.vault.modify(file, [
      '---', 'decay_level: 3', 'status: fossilized',
      `fossilized_at: ${dateStr}`, `original_path: ${fossilPath}`,
      'decay_immune: true', '---', '',
      `> [!fossil] Note archived on ${dateStr}`,
      `> **Summary:** ${summary}`,
      `> [Recover original note](${fossilPath})`,
    ].join('\n'));
  }

  async compressWithAI(content: string): Promise<string> {
    const prompt = 'Summarize this note in exactly one objective sentence in English. Return ONLY the sentence.';
    if (this.settings.aiProvider === 'google') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.settings.apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt + '\n\n' + content.slice(0, 4000) }] }] }) }
      );
      return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'No summary generated.';
    }
    if (this.settings.aiProvider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.settings.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, system: prompt,
          messages: [{ role: 'user', content: content.slice(0, 4000) }] })
      });
      return (await res.json()).content?.[0]?.text?.trim() ?? 'No summary generated.';
    }
    return 'No summary available.';
  }

  async openPurgatory() {
    const file = this.app.vault.getAbstractFileByPath('PURGATORIO.md');
    if (file instanceof TFile) await this.app.workspace.openLinkText('PURGATORIO.md', '', true);
    else new Notice('Atropos: PURGATORIO.md not found. Run a decay cycle first.');
  }

  async immunizeNote(file: TFile) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.decay_immune = true; fm.decay_level = 0; delete fm.decay_since;
    });
    new Notice(`Atropos: "${file.basename}" is now immune to decay.`);
    this.refreshViews();
  }
}

// ── Settings tab ──────────────────────────────────────────────────────────────
class AtroposSettingTab extends PluginSettingTab {
  plugin: AtroposPlugin;
  constructor(app: App, plugin: AtroposPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Decay thresholds').setHeading();
    new Setting(containerEl).setName('Phase 1 — Drought').setDesc('Days of inactivity before a note is flagged.')
      .addText(t => t.setPlaceholder('30').setValue(String(this.plugin.settings.phase1Days))
        .onChange(async (v) => { this.plugin.settings.phase1Days = parseInt(v) || 30; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('Phase 2 — Disconnection').setDesc('Days before wikilinks are removed.')
      .addText(t => t.setPlaceholder('60').setValue(String(this.plugin.settings.phase2Days))
        .onChange(async (v) => { this.plugin.settings.phase2Days = parseInt(v) || 60; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('Phase 3 — Dissolution').setDesc('Days before the note is archived.')
      .addText(t => t.setPlaceholder('90').setValue(String(this.plugin.settings.phase3Days))
        .onChange(async (v) => { this.plugin.settings.phase3Days = parseInt(v) || 90; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName('AI provider').setHeading();
    new Setting(containerEl).setName('Provider').setDesc('Used for Phase 3 note summarization.')
      .addDropdown(d => d.addOption('none', 'No AI — archive without summary')
        .addOption('google', 'Google Gemini').addOption('anthropic', 'Anthropic Claude')
        .setValue(this.plugin.settings.aiProvider)
        .onChange(async (v: any) => { this.plugin.settings.aiProvider = v; await this.plugin.saveSettings(); this.display(); }));
    if (this.plugin.settings.aiProvider !== 'none') {
      new Setting(containerEl).setName('API Key').setDesc('Stored locally. Never sent to Atropos servers.')
        .addText(t => t.setPlaceholder('Enter your API key…').setValue(this.plugin.settings.apiKey)
          .onChange(async (v) => { this.plugin.settings.apiKey = v; await this.plugin.saveSettings(); }));
    }

    new Setting(containerEl).setName('Immune folders').setHeading();
    new Setting(containerEl).setName('Exempt folders').setDesc('Comma-separated folders that never decay.')
      .addText(t => t.setPlaceholder('evergreen, journal').setValue(this.plugin.settings.immuneFolders.join(', '))
        .onChange(async (v) => {
          this.plugin.settings.immuneFolders = v.split(',').map(s => s.trim()).filter(Boolean);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl).setName('Panel').setHeading();
    new Setting(containerEl).setName('Open Atropos panel').setDesc('Open the decay stats sidebar.')
      .addButton(btn => btn.setButtonText('Open').onClick(() => this.plugin.activateView()));
  }
}
