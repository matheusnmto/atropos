'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// aiProvider.js (zelador) — Abstração multi-provider para chamadas de IA (BYOK)
//
// Esta versão é para uso DIRETO pelo zelador.js via env vars.
// O módulo no nível raiz do projeto abstrai para o Electron (via IPC).
//
// Suporta:
//   - Google Gemini Flash  (@google/generative-ai)
//   - Anthropic Claude Haiku (@anthropic-ai/sdk)
//
// SEGURANCA: As chaves NUNCA são logadas, nem parcialmente.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'Você é um sistema de compressão de conhecimento efêmero. ' +
  'Resuma a nota fornecida em exatamente uma frase objetiva em português brasileiro, ' +
  'preservando a ideia central. ' +
  'Retorne APENAS a frase. Sem prefixo como "Resumo:". Sem markdown. Termine com ponto final.';

const TIMEOUT_MS = 30000;

function log(msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] [ai] ${msg}`);
}

function withTimeout(promise, ms, label) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => {
      const err = new Error(`Timeout de ${ms / 1000}s ao chamar ${label}.`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms)
 );
  return Promise.race([promise, timer]);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Google Gemini ────────────────────────────────────────────────────────────
async function callGoogle(content, apiKey, isRetry = false) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const result = await withTimeout(
      model.generateContent(SYSTEM_PROMPT + '\n\nNota:\n' + content),
      TIMEOUT_MS,
      'google'
   );
    return result.response.text().trim();
  } catch (err) {
    if (err.code === 'TIMEOUT') throw err;

    const msg    = err.message || '';
    const status = err.status ?? err.statusCode ?? 0;

    if (status === 400 && msg.includes('API_KEY') || status === 401 || status === 403 || msg.includes('PERMISSION_DENIED')) {
      const e = new Error('Chave Google inválida. Verifique em aistudio.google.com.');
      e.code = 'INVALID_KEY'; throw e;
    }
    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
      if (isRetry) {
        const e = new Error('Rate limit Google atingido após retry.');
        e.code = 'RATE_LIMIT'; throw e;
      }
      log('Rate limit Google. Aguardando 60s...');
      await sleep(60000);
      return callGoogle(content, apiKey, true);
    }
    if (status >= 500 || msg.includes('UNAVAILABLE')) {
      const e = new Error(`Serviço Google indisponível (HTTP ${status}).`);
      e.code = 'PROVIDER_UNAVAILABLE'; throw e;
    }
    const e = new Error(msg || 'Erro desconhecido Google.');
    e.code = 'PROVIDER_UNAVAILABLE'; throw e;
  }
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────
async function callAnthropic(content, apiKey, isRetry = false) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  try {
    const response = await withTimeout(
      client.messages.create({
        model:     'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system:     SYSTEM_PROMPT,
        messages:  [{ role: 'user', content }],
      }),
      TIMEOUT_MS,
      'anthropic'
   );
    return response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (err) {
    if (err.code === 'TIMEOUT') throw err;

    const status = err.status ?? err.statusCode ?? 0;

    if (status === 401) {
      const e = new Error('Chave Anthropic inválida. Verifique em console.anthropic.com.');
      e.code = 'INVALID_KEY'; throw e;
    }
    if (status === 429) {
      if (isRetry) {
        const e = new Error('Rate limit Anthropic atingido após retry.');
        e.code = 'RATE_LIMIT'; throw e;
      }
      log('Rate limit Anthropic. Aguardando 60s...');
      await sleep(60000);
      return callAnthropic(content, apiKey, true);
    }
    if (status >= 500) {
      const e = new Error(`Serviço Anthropic indisponível (HTTP ${status}).`);
      e.code = 'PROVIDER_UNAVAILABLE'; throw e;
    }
    const e = new Error(err.message || 'Erro desconhecido Anthropic.');
    e.code = 'PROVIDER_UNAVAILABLE'; throw e;
  }
}

// ─── Interface pública ────────────────────────────────────────────────────────

/**
* Lista os providers disponíveis.
*/
function listProviders() {
  return [
    { id: 'google',    name: 'Google Gemini',    model: 'gemini-2.5-flash',         costPer1kTokens: 0.000075 },
    { id: 'anthropic', name: 'Anthropic Claude', model: 'claude-haiku-4-5-20251001', costPer1kTokens: 0.00025  },
  ];
}

/**
* Comprime uma nota em uma frase usando o provider configurado.
*
* @param {string} content         - Conteúdo da nota
* @param {{ provider: string, apiKey: string }} providerConfig
* @returns {Promise<string>}
*/
async function compress(content, providerConfig) {
  const { provider, apiKey } = providerConfig;

  if (!provider || !apiKey) {
    throw new TypeError('compress: providerConfig deve conter { provider, apiKey }');
  }

  log(`Comprimindo nota via ${provider}...`);

  let result;
  if (provider === 'google') {
    result = await callGoogle(content, apiKey);
  } else if (provider === 'anthropic') {
    result = await callAnthropic(content, apiKey);
  } else {
    const e = new Error(`Provider desconhecido: "${provider}". Use "google" ou "anthropic".`);
    e.code = 'PROVIDER_UNAVAILABLE'; throw e;
  }

  if (!result || typeof result !== 'string' || result.trim() === '') {
    const e = new Error('Provider retornou resposta vazia.');
    e.code = 'PROVIDER_UNAVAILABLE'; throw e;
  }

  log(`Compressao concluida (${result.length} caracteres).`);
  return result.trim();
}

/**
* Valida uma API key fazendo uma chamada minima.
*
* @param {'google'|'anthropic'} provider
* @param {string} apiKey
* @returns {Promise<{ valid: boolean, error?: string }>}
*/
async function validateKey(provider, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return { valid: false, error: 'Chave nao pode ser vazia.' };
  }

  try {
    await compress('teste de validacao de chave.', { provider, apiKey });
    return { valid: true };
  } catch (err) {
    if (err.code === 'INVALID_KEY') {
      return { valid: false, error: err.message };
    }
    // Rate limit ou indisponibilidade nao significa chave invalida
    return { valid: true, error: `Aviso: ${err.message}` };
  }
}

module.exports = { compress, validateKey, listProviders };
