'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// O fetch é global no Node 18+
// Usamos 127.0.0.1 explicitamente para evitar que o Node 18 tente usar IPv6 (::1) e dê ECONNREFUSED
const OLLAMA_URL = 'http://127.0.0.1:11434';
const EMBED_MODEL = 'nomic-embed-text';

function log(msg) {
  console.log(`[semantic] ${msg}`);
}

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.models.some(m => m.name.startsWith(EMBED_MODEL));
  } catch (err) {
    return false;
  }
}

async function getEmbedding(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  });
  if (!res.ok) throw new Error(`Ollama API error: ${res.statusText}`);
  const data = await res.json();
  return data.embedding;
}

function getCacheKey(content) {
  const size = Buffer.byteLength(content, 'utf8');
  const excerpt = content.slice(0, 100).replace(/\s+/g, ' ').trim();
  return `${size}_${excerpt}`;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function analyzeConnections(vaultPath, files) {
  const cachePath = path.join(vaultPath, '.zelador', 'embeddings.json');
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch (_) {}
  }

  log(`Gerando embeddings para ${files.length} notas...`);

  let modifiedCache = false;
  const embeddings = [];

  // Concorrência limitada: processa 4 notas em paralelo p/ não sobrecarregar Ollama
  const CONCURRENCY = 4;
  for (let start = 0; start < files.length; start += CONCURRENCY) {
    const batch = files.slice(start, start + CONCURRENCY);
    await Promise.all(batch.map(async (file) => {
      try {
        const content = fs.readFileSync(file.filePath, 'utf8');
        const key = getCacheKey(content);
        const relativePath = path.relative(vaultPath, file.filePath).replace(/\\/g, '/');

        let vector;
        if (cache[relativePath] && cache[relativePath].key === key) {
          vector = cache[relativePath].vector;
        } else {
          vector = await getEmbedding(content);
          cache[relativePath] = { key, vector };
          modifiedCache = true;
        }
        embeddings.push({ id: relativePath, vector });
      } catch (err) {
        log(`Erro no embedding de ${file.filePath}: ${err.message}`);
      }
    }));
  }

  if (modifiedCache) {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  }

  const connections = [];
  const THRESHOLD = 0.75; // Limiar de similaridade para nomic-embed-text

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].vector, embeddings[j].vector);
      if (sim > THRESHOLD) {
        connections.push({
          source: embeddings[i].id,
          target: embeddings[j].id,
          similarity: sim
        });
      }
    }
  }

  log(`${connections.length} conexões semânticas descobertas`);
  return connections;
}

module.exports = {
  checkOllama,
  getEmbedding,
  analyzeConnections
};
