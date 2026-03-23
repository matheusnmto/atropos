'use strict';

const fs = require('fs');
const path = require('path');

const SIMILARITY_THRESHOLD = 0.88; // alto — só matches reais
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const EMBED_MODEL = 'nomic-embed-text';
const DEJAVU_CACHE = '.zelador/dejavu.json';
const SAFE_BUFFER_HOURS = 168; // 7 dias — mais flexível para testes

function log(msg) {
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`[${ts}] [dejavu] ${msg}`);
}

/**
 * Gera embedding via Ollama.
 */
async function embed(text) {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text.slice(0, 4000),
      }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.statusText}`);
    const data = await res.json();
    return data.embedding;
  } catch (err) {
    throw err;
  }
}

/**
 * Cosine similarity entre dois vetores.
 */
function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Verifica notas novas contra o arquivo fossilizado.
 *
 * @param {string} vaultPath
 * @param {Array} activeNotes   — notas ativas do scanner
 * @param {Array} fossilNotes   — notas em /_fossilized/
 * @returns {Promise<Array>}    — lista de matches { newNote, fossilNote, score, fossilizedAt }
 */
async function checkDejavu(vaultPath, activeNotes, fossilNotes) {
  // Verificar se Ollama está disponível
  try {
    await embed('test');
  } catch (err) {
    log(`Ollama não disponível ou erro no embed: ${err.message}. Pulando Déjà Vu.`);
    return [];
  }

  const now = Date.now();
  const bufferMs = SAFE_BUFFER_HOURS * 60 * 60 * 1000;
  const matter = require('gray-matter');

  // Filtrar apenas notas criadas nas últimas 24h
  const newNotes = activeNotes.filter(n => {
    try {
      const stat = fs.statSync(n.filePath);
      return (now - stat.birthtimeMs) < bufferMs;
    } catch { return false; }
  });

  if (newNotes.length === 0) {
    log('Nenhuma nota nova nas últimas 24h.');
    return [];
  }

  log(`Verificando ${newNotes.length} nota(s) nova(s) contra ${fossilNotes.length} fossilizada(s)...`);

  const matches = [];

  for (const newNote of newNotes) {
    let newContent = '';
    try {
      const raw = fs.readFileSync(newNote.filePath, 'utf-8');
      newContent = matter(raw).content.trim();
    } catch { continue; }

    if (newContent.length < 100) continue; // ignorar notas muito curtas

    let newVector;
    try { newVector = await embed(newContent); }
    catch { continue; }

    for (const fossil of fossilNotes) {
      let fossilContent = '';
      let fossilData = {};
      try {
        const raw = fs.readFileSync(fossil.filePath, 'utf-8');
        const parsed = matter(raw);
        fossilContent = parsed.content.trim();
        fossilData = parsed.data;
      } catch { continue; }

      if (fossilContent.length < 50) continue;

      let fossilVector;
      try { fossilVector = await embed(fossilContent); }
      catch { continue; }

      const score = cosineSimilarity(newVector, fossilVector);

      if (score >= SIMILARITY_THRESHOLD) {
        const fossilName = path.basename(fossil.filePath, '.md');
        const newName = path.basename(newNote.filePath, '.md');
        const fossilDate = fossilData.fossilized_at || fossil.month || 'unknown date';

        log(`Match: "${newName}" ↔ "${fossilName}" (score: ${score.toFixed(2)})`);

        matches.push({
          newNote: {
            name: newName,
            filePath: newNote.filePath,
            relativePath: newNote.relativePath,
          },
          fossilNote: {
            name: fossilName,
            filePath: fossil.filePath,
            fossilizedAt: fossilDate,
          },
          score: Math.round(score * 100) / 100,
          message: `You explored this idea on ${fossilDate}. It was archived without further development.`,
        });
      }
    }
  }

  log(`${matches.length} match(es) encontrado(s).`);
  return matches;
}

module.exports = { checkDejavu };
