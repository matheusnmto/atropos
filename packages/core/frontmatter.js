'use strict';

const fs = require('fs');
const matter = require('gray-matter');

/**
* Lê o frontmatter de um arquivo Markdown.
* Usa gray-matter — nunca manipulamos o YAML manualmente.
*
* @param {string} filePath
* @returns {{ data: object, content: string, raw: string }}
*   - data: objeto com os campos do frontmatter
*   - content: corpo da nota (sem o bloco YAML)
*   - raw: conteúdo completo original do arquivo
*/
function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  return {
    data: parsed.data,
    content: parsed.content, // corpo sem o frontmatter
    raw,
  };
}

/**
* Escreve um frontmatter atualizado de volta ao arquivo.
* Preserva o corpo da nota intacto (apenas o bloco YAML é alterado).
*
* @param {string} filePath
* @param {object} newData - Campos a serem mesclados no frontmatter existente
* @param {string|null} bodyOverride - Se fornecido, substitui o corpo inteiro (usado na F3)
*/
function writeFrontmatter(filePath, newData, bodyOverride = null) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);

  // Mescla os dados existentes com os novos (newData sobrescreve campos conflitantes)
  const mergedData = {...parsed.data,...newData };

  // Remove chaves marcadas como null (permite remoção de campos)
  for (const key of Object.keys(mergedData)) {
    if (mergedData[key] === null) {
      delete mergedData[key];
    }
  }

  const bodyToUse = bodyOverride !== null ? bodyOverride : parsed.content;

  // gray-matter.stringify reconstrói o arquivo com o frontmatter atualizado
  const newContent = matter.stringify(bodyToUse, mergedData);
  fs.writeFileSync(filePath, newContent, 'utf8');
}

/**
* Verifica se uma nota está imune ao decaimento.
* Esta verificação DEVE ser feita antes de qualquer cálculo de mtime.
*
* @param {object} frontmatterData - Dados do frontmatter já parseados
* @returns {boolean}
*/
function isDecayImmune(frontmatterData) {
  return frontmatterData.decay_immune === true;
}

/**
* Retorna o decay_level atual da nota (0 se ausente).
*
* @param {object} frontmatterData
* @returns {number} 0, 1, 2 ou 3
*/
function getDecayLevel(frontmatterData) {
  return frontmatterData.decay_level ?? 0;
}

module.exports = {
  readFrontmatter,
  writeFrontmatter,
  isDecayImmune,
  getDecayLevel,
};
