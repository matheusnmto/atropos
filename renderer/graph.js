'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// graph.js — Renderização interativa do vault com D3.js (Canvas)
// ─────────────────────────────────────────────────────────────────────────────

let _graphSim = null;
let _graphCanvas = null;
let _graphData = null;

async function renderGraph() {
  if (_graphSim) return; // Inicializa apenas uma vez por sessão
  
  const container = document.getElementById('graph-container');
  if (!container) return;
  const tooltip = document.getElementById('graph-tooltip');

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  // Carrega dados via IPC
  _graphData = await window.zelador.getGraphData();
  const { nodes, edges } = _graphData;

  const isDead = (p) => ['f2', 'f3', 'fossil'].includes(p);
  
  // Limpa links de/para nós inativos
  const cleanEdges = edges.filter(e => {
    const sNode = nodes.find(n => n.id === e.source);
    const tNode = nodes.find(n => n.id === e.target);
    return sNode && tNode && !isDead(sNode.phase) && !isDead(tNode.phase);
  });

  // Calcula graus para nodes vivos
  nodes.forEach(n => n.degree = 0);
  cleanEdges.forEach(e => {
    const s = nodes.find(n => n.id === e.source);
    const t = nodes.find(n => n.id === e.target);
    if (s) s.degree++;
    if (t) t.degree++;
  });

  const canvas = d3.select(container).append('canvas')
    .attr('width', width)
    .attr('height', height)
    .node();
  _graphCanvas = canvas;
  const ctx = canvas.getContext('2d');

  // Cores do design system
  const colors = {
    alive:  { fill: '#1D9E75', alpha: 1.0 },
    f1:     { fill: '#888780', alpha: 0.6 },
    f2:     { fill: '#BA7517', alpha: 0.7 },
    f3:     { fill: '#993C1D', alpha: 0.45 },
    fossil: { fill: '#444441', alpha: 0.3 }
  };

  const transform = d3.zoomIdentity;

  function getRadius(node) {
    if (node.phase === 'alive') return 3 + (node.degree || 0) * 0.5;
    return 3;
  }

  // Configura a física (forças)
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(cleanEdges).id(d => d.id).distance(45))
    .force('charge', d3.forceManyBody().strength(-20))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(d => getRadius(d) + 3))
    // Empurra F2/F3/Fósseis para as bordas para separá-los do core vivo
    .force('radial', d3.forceRadial(d => isDead(d.phase) ? Math.min(width, height) / 2 : 0, width / 2, height / 2).strength(0.08));

  _graphSim = simulation;

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    ctx.strokeStyle = 'rgba(29, 158, 117, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    cleanEdges.forEach(d => {
      ctx.moveTo(d.source.x, d.source.y);
      ctx.lineTo(d.target.x, d.target.y);
    });
    ctx.stroke();

    nodes.forEach(d => {
      ctx.beginPath();
      ctx.moveTo(d.x + getRadius(d), d.y);
      ctx.arc(d.x, d.y, getRadius(d), 0, 2 * Math.PI);
      const c = colors[d.phase] || colors.alive;
      ctx.fillStyle = c.fill;
      ctx.globalAlpha = c.alpha;
      ctx.fill();
    });

    ctx.restore();
  }

  simulation.on('tick', draw);

  // Zoom / Pan
  d3.select(canvas).call(d3.zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', e => {
      transform.k = e.transform.k;
      transform.x = e.transform.x;
      transform.y = e.transform.y;
      draw();
    }));

  // Interações
  d3.select(canvas).on('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.k;
    const y = (e.clientY - rect.top - transform.y) / transform.k;
    
    let closest = null;
    let minDist = 15 / transform.k;
    for (const n of nodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < getRadius(n) + 2 && dist < minDist) {
        minDist = dist;
        closest = n;
      }
    }

    if (closest) {
      canvas.style.cursor = 'pointer';
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
      tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
      
      const phaseNames = { alive: 'Viva', f1: 'F1 (Estiagem)', f2: 'F2 (Desconexão)', f3: 'F3 (Dissolução)', fossil: 'Fóssil' };
      const { t } = window.i18n || { t: k => k };
      const phaseStr = phaseNames[closest.phase] || closest.phase;
      
      tooltip.innerHTML = `<strong>${closest.name}</strong><br>Phase: ${phaseStr}`;
    } else {
      canvas.style.cursor = 'default';
      tooltip.style.display = 'none';
    }
  });

  // Abrir no Obsidian ao clicar no nó
  d3.select(canvas).on('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.k;
    const y = (e.clientY - rect.top - transform.y) / transform.k;
    let closest = null;
    let minDist = 15 / transform.k;
    for (const n of nodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < getRadius(n) + 2 && dist < minDist) {
        minDist = dist;
        closest = n;
      }
    }
    if (closest) {
      window.zelador.openInObsidian(closest.id);
    }
  });
}

window.renderGraph = renderGraph;
