'use strict';

async function getPurgatoryData(vaultPath, config, resolveConfig) {
  const fs = require('fs');
  const path = require('path');
  const { scanVault, getRelativePath } = require('./scanner');
  const { readFrontmatter } = require('./frontmatter');

  const files = await scanVault(vaultPath);
  const atRisk = [];

  for (const file of files) {
    let fm;
    try {
      fm = readFrontmatter(file.filePath).data || {};
    } catch {
      continue;
    }

    // Ignorar imunes e fossilizados
    if (fm.decay_immune) continue;
    if (fm.status === 'fossilized') continue;
    if ((fm.decay_level || 0) >= 3) continue;

    const relativePath = getRelativePath(vaultPath, file.filePath);
    const effectiveConfig = resolveConfig(relativePath, config);
    if (effectiveConfig.decay_immune) continue;

    // Calcular dias restantes até F3
    const daysInactive = file.inactivityMs / (1000 * 60 * 60 * 24);
    const daysUntilF3 = Math.ceil(effectiveConfig.phase3_days - daysInactive);

    // Só incluir se vai fossilizar nos próximos 30 dias
    if (daysUntilF3 > 30) continue;
    // Já fossilizou ou passou do threshold — não incluir
    if (daysUntilF3 < -7) continue;

    const noteName = path.basename(file.filePath, '.md');
    let folder = relativePath.split('/').slice(0, -1).join('/');
    if (!folder.startsWith('/')) folder = '/' + folder;
    if (folder === '') folder = '/';
    
    const dissolutionDate = new Date(
      Date.now() + daysUntilF3 * 24 * 60 * 60 * 1000
    ).toLocaleDateString('pt-BR');

    atRisk.push({
      nota: noteName,
      filePath: file.filePath,
      relativePath,
      pasta: folder || '/',
      dias: daysUntilF3,
      dissolve: dissolutionDate,
      decayLevel: fm.decay_level || 0,
    });
  }

  // Ordenar por urgência (menos dias primeiro)
  atRisk.sort((a, b) => a.dias - b.dias);
  return atRisk;
}

async function generatePurgatory(vaultPath, config, resolveConfig) {
  const fs = require('fs');
  const path = require('path');
  
  const atRisk = await getPurgatoryData(vaultPath, config, resolveConfig);

  const urgent = atRisk.filter(n => n.dias <= 7);
  const thisMonth = atRisk.filter(n => n.dias > 7 && n.dias <= 30);

  // Gerar o markdown
  const now = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const lines = [
    '---',
    'tags: [zelador, sistema]',
    'decay_immune: true',
    '---',
    '',
    '# Purgatório',
    '',
    '> Abrir qualquer nota desta lista reseta o decaimento.',
    `> Última atualização: ${now}`,
    '',
    '---',
    '',
  ];

  if (atRisk.length === 0) {
    lines.push('**Vault saudável — nenhuma nota em risco nos próximos 30 dias.**');
  } else {
    if (urgent.length > 0) {
      lines.push('## Urgente — menos de 7 dias');
      lines.push('');
      lines.push('| Nota | Pasta | Dissolução | Restam |');
      lines.push('|------|-------|------------|--------|');
      for (const n of urgent) {
        const restam = n.dias <= 0
          ? 'hoje'
          : n.dias === 1
            ? '1 dia'
            : `${n.dias} dias`;
        lines.push(`| [[${n.nota}]] | ${n.pasta} | ${n.dissolve} | ${restam} |`);
      }
      lines.push('');
    }

    if (thisMonth.length > 0) {
      lines.push('## Este mês');
      lines.push('');
      lines.push('| Nota | Pasta | Dissolução | Restam |');
      lines.push('|------|-------|------------|--------|');
      for (const n of thisMonth) {
        lines.push(`| [[${n.nota}]] | ${n.pasta} | ${n.dissolve} | ${n.dias} dias |`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*Gerado automaticamente pelo Zelador · Não edite manualmente*');

  const purgPath = path.join(vaultPath, 'PURGATORIO.md');
  fs.writeFileSync(purgPath, lines.join('\n'), 'utf-8');

  console.log(`[${new Date().toTimeString().slice(0,8)}] [purgatory] PURGATORIO.md atualizado: ${atRisk.length} nota(s) listada(s) (${urgent.length} urgente(s)).`);

  return { items: atRisk.length, urgent: urgent.length };
}

module.exports = { generatePurgatory, getPurgatoryData };
