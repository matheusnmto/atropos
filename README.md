# liquid-graph

**A semantic garbage collector for Obsidian vaults.**

Grafo Líquido is a local desktop daemon that applies programmed entropy to Markdown files based on inactivity. Notes that are not revisited or connected progressively lose visibility in the graph, get disconnected from the knowledge network, and are eventually compressed by AI into a single archival sentence — while the original is always preserved.

The system runs silently in the background, executing once per day during off-hours. No cloud sync. No subscriptions. No data ever leaves your machine except for the AI compression call you explicitly configure.

---

## The Problem

Knowledge management tools are optimized for capture, not for forgetting. Over time, a vault accumulates hundreds of notes that are never revisited — half-formed ideas, outdated meeting notes, obsolete drafts. They consume cognitive space in the graph without contributing meaning. There is no native mechanism in Obsidian to let knowledge decay naturally.

Grafo Líquido is that mechanism.

---

## How It Works

The system evaluates each note's vitality based on the time elapsed since its last modification (`mtime`). Decay happens in three sequential phases:

### Phase 1 — Drought (inactivity > 30 days)

The note is flagged as inactive. No content is modified. The system injects `decay_level: 1` into the YAML frontmatter. In Obsidian, the graph node loses its primary color and turns gray through pre-configured graph filters.

### Phase 2 — Disconnection (inactivity > 60 days)

Before any modification, the system creates a mandatory Git snapshot of the entire vault. Then it scans every `.md` file in the vault, finds all references to the decaying note, and replaces `[[Note Name]]` wikilink syntax with plain text. The note loses all its edges in the graph, becoming an isolated node — an island disconnected from the main knowledge network.

### Phase 3 — Dissolution (inactivity > 90 days)

The note's content is sent to an AI provider (Google Gemini or Anthropic Claude) for lossy compression. The original file is moved to `/_fossilized/YYYY-MM/` and a lightweight note is created in its place containing a one-sentence summary and a recovery link. The original is never deleted.

**Resurrection:** linking to a decaying note from any other note resets its `decay_level` to zero on the next execution cycle.

---

## Architecture

Grafo Líquido is a single local component — a Node.js daemon packaged as an Electron desktop application. There is no external server, no n8n orchestrator, no cloud dependency. The AI API call in Phase 3 goes directly from your machine to Google or Anthropic.

```
liquid-graph/
├── electron/
│   ├── main.js            — BrowserWindow, system tray, scheduler
│   ├── preload.js         — Secure contextBridge for IPC
│   ├── tray.js            — System tray icon and context menu
│   └── ipc/
│       ├── config.ipc.js  — Settings management and keytar
│       └── zelador.ipc.js — Zelador process execution
├── renderer/
│   ├── index.html
│   ├── app.js             — Dashboard, Purgatory, Fossilized, Graph tabs
│   ├── graph.js           — D3.js force simulation
│   └── styles.css
├── zelador/
│   ├── zelador.js         — Main entry point and orchestration loop
│   ├── config/
│   │   └── defaults.js    — Default thresholds and constants
│   └── modules/
│       ├── scanner.js     — Vault traversal and mtime reading
│       ├── frontmatter.js — YAML read/write via gray-matter
│       ├── phases.js      — Phase 1, 2, and 3 logic
│       ├── git.js         — Automated Git snapshots
│       ├── linkBreaker.js — Wikilink removal (6 syntax variants)
│       ├── aiProvider.js  — Multi-provider AI abstraction (BYOK)
│       ├── fossilizer.js  — File archival and fossil note creation
│       ├── purgatory.js   — PURGATORIO.md generation
│       └── lockFile.js    — Prevents concurrent executions
├── assets/
├── electron-builder.yml
└── .github/workflows/
    └── release.yml        — Cross-platform build and release CI
```

---

## Installation

### Semantic connections (optional)

Grafo Líquido can discover thematic connections between notes
using local AI embeddings via [Ollama](https://ollama.com).
No data leaves your machine.

Requirements:
1. Install Ollama: https://ollama.com/download
2. Pull the embedding model:
   ollama pull nomic-embed-text
3. In the app: Settings → Semantic connections → Ollama (local)

The app detects Ollama automatically. If it is not running,
clicking "Analyse connections" shows setup instructions inline.

### Desktop Application

Download the installer for your operating system from [Releases](https://github.com/matheusnmto/liquid-graph/releases):

| Platform | File |
|----------|------|
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` |

No runtime dependencies required. Node.js is bundled inside the application.

### From Source

```bash
git clone https://github.com/matheusnmto/liquid-graph.git
cd liquid-graph
npm install
cd zelador && npm install && cd ..
npm start
```

---

## Configuration

### Vault Setup

On first launch, the application will prompt for the absolute path to your Obsidian vault. This is the only required configuration step.

### Decay Thresholds

Place a `decay.config.json` file at the root of your vault to override default thresholds per folder:

```json
{
  "global": {
    "phase1_days": 30,
    "phase2_days": 60,
    "phase3_days": 90
  },
  "folders": {
    "evergreen": {
      "decay_immune": true
    },
    "fleeting": {
      "phase1_days": 7,
      "phase2_days": 14,
      "phase3_days": 21
    },
    "journal": {
      "skip_phases": [1, 2],
      "phase3_days": 14
    }
  }
}
```

The most specific folder rule takes precedence over global defaults. Setting `decay_immune: true` on a folder exempts all notes inside it from all phases.

### Note-Level Immunity

Add `decay_immune: true` to any note's frontmatter to permanently exempt it from the decay cycle:

```yaml
---
decay_immune: true
tags: [person, reference]
---
```

Use this for permanent references, people notes, active project documents, or any note that should never decay.

### Obsidian Graph Colors

To visualize decay state in Obsidian's graph view, add the following `colorGroups` to `.obsidian/graph.json`:

```json
"colorGroups": [
  { "query": "[decay_level:1]", "color": { "a": 1, "rgb": 8947584 } },
  { "query": "[decay_level:2]", "color": { "a": 1, "rgb": 12217111 } },
  { "query": "[decay_level:3]", "color": { "a": 1, "rgb": 10041373 } },
  { "query": "[status:fossilized]", "color": { "a": 0.4, "rgb": 4473921 } }
]
```

---

## AI Integration

Phase 3 compression requires an AI API key. Grafo Líquido supports two providers:

| Provider | Model | Estimated cost per note |
|----------|-------|------------------------|
| Google AI | gemini-2.0-flash | ~$0.0003 |
| Anthropic | claude-haiku-4-5-20251001 | ~$0.001 |

API keys are entered through the application's Settings screen and stored exclusively in the operating system keychain via [keytar](https://github.com/atom/node-keytar). Keys are never written to disk, never logged, and never transmitted to any server other than the provider's official API endpoint.

**Privacy note:** In BYOK mode, note content travels directly from your machine to the AI provider's API. No Grafo Líquido server receives, processes, or stores your notes at any point.

For CLI usage only, keys can also be set via environment variables in `zelador/.env`:

```
AI_PROVIDER=google
GOOGLE_AI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Safety and Reversibility

Data safety is the primary design constraint of the system. Two independent protection layers are in place before any destructive operation:

**Layer 1 — Git snapshot.** Before Phase 2 or Phase 3 executes on any note, the system runs `git add -A && git commit` with a standardized message. This is mandatory and cannot be disabled through configuration. If the commit fails, the operation aborts entirely.

```
zelador: snapshot pre-F2 2026-03-21 "Note Name"
zelador: snapshot pre-F3 2026-03-21 "Note Name"
```

**Layer 2 — Fossilized archive.** In Phase 3, the original note is moved — never deleted — to `/_fossilized/YYYY-MM/`. It is recoverable through Obsidian's file explorer with a single click, without requiring Git or terminal access.

**Concurrency protection.** The daemon creates a lock file at `/tmp/zelador.lock` on startup and cleans it on exit. If a previous process died unexpectedly, the lock is validated against the process table before aborting.

---

## Frontmatter Reference

All keys below are written and managed automatically by the Zelador. The only key intended for manual use is `decay_immune`.

| Key | Type | Description |
|-----|------|-------------|
| `decay_level` | integer | Current phase: 0 (active), 1, 2, or 3 (fossilized) |
| `decay_immune` | boolean | If true, the note is ignored in all phases |
| `decay_since` | date | ISO date when decay began |
| `links_removed_at` | date | ISO date when wikilinks were removed (Phase 2) |
| `fossilized_at` | date | ISO date when Phase 3 executed |
| `original_path` | string | Path to the original in `/_fossilized/` |
| `status` | string | Set to `fossilized` after Phase 3 |

---

## Scheduled Execution

The application runs the Zelador automatically at 03:00 AM daily. The schedule is configurable through the Settings screen. The process runs in the background via system tray — the main window can be closed without stopping execution.

For system-level scheduling outside the Electron app:

```bash
# cron — add via crontab -e
0 3 * * * cd /path/to/liquid-graph && node zelador/zelador.js >> /var/log/zelador.log 2>&1
```

---

## The PURGATORIO.md File

On every execution, the Zelador generates or updates `PURGATORIO.md` at the root of the vault. This file lists all notes scheduled for Phase 3 within the next 30 days, sorted by urgency. It is visible directly in Obsidian — no external notification or email required.

Opening any note listed in the Purgatório resets its decay cycle automatically.

The file itself carries `decay_immune: true` and is never processed by the system.

---

## Contributing

```bash
git clone https://github.com/matheusnmto/liquid-graph.git
cd liquid-graph
npm install
cd zelador && npm install && cd ..
npm start
```

To simulate note inactivity for testing:

```bash
# Set mtime to 35 days ago (triggers Phase 1)
touch -t $(date -v-35d +%Y%m%d%H%M) vault/notes/test-note.md

# Set mtime to 95 days ago (triggers Phase 3)
touch -t 202312010000 vault/notes/test-note.md
```

**Commit conventions:** messages in English, format `type: description`  
Examples: `feat: add resurrection module`, `fix: regex escaping for special chars`

**Security:** API keys must never appear in logs, commits, or error messages — not even partially.

Pull requests are welcome. Open an issue first for any change that affects the decay logic, file operations, or AI integration.

---

## Roadmap

- Resurrection module — automatic decay reset when a new wikilink is created pointing to a decaying note
- i18n — interface language toggle (Portuguese / English)
- SaaS mode — centralized AI key with usage billing via Stripe
- Official Obsidian plugin — native integration as a Community Plugin

---

## License

MIT © 2026 Matheus Farah
