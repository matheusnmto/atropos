'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// graph.js — Visualização do Grafo Interativo
// Design: "mapa de estrelas decaindo" — cosmos em entropia
// Ciclo: initGraph() ao entrar na aba, destroyGraph() ao sair
// ─────────────────────────────────────────────────────────────────────────────

let simulation = null;
let animFrame  = null;
let canvas     = null;

const PHASE = {
  alive:  { color: '#1D9E75', glow: '#1D9E75', alpha: 1.0,  size: 1.0,  edgeAlpha: 0.65 },
  f1:     { color: '#888780', glow: '#888780',  alpha: 0.75, size: 0.85, edgeAlpha: 0.35 },
  f2:     { color: '#BA7517', glow: '#BA7517',  alpha: 0.85, size: 0.75, edgeAlpha: 0.20 },
  f3:     { color: '#993C1D', glow: '#993C1D',  alpha: 0.65, size: 0.60, edgeAlpha: 0    },
  fossil: { color: '#5a5855', glow: null,       alpha: 0.40, size: 0.45, edgeAlpha: 0    },
};

const BASE_R = 11;

async function initGraph() {
  const container = document.getElementById('graph-container');
  if (!container || canvas) return;

  // Loading state
  container.innerHTML = `
    <div id="graph-loading" style="
      position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:12px;
      font-family:'SF Mono',monospace;color:#1D9E75;font-size:12px;
      letter-spacing:0.1em;
    ">
      <svg width="32" height="32" viewBox="0 0 52 52" fill="none"
           style="animation:spin 3s linear infinite;">
        <circle cx="26" cy="26" r="7" fill="#1D9E75"/>
        <circle cx="26" cy="26" r="14" fill="none" stroke="#1D9E75"
                stroke-width="1.5" opacity="0.5"/>
        <line x1="26" y1="4" x2="26" y2="12" stroke="#1D9E75"
              stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="44.5" y1="14" x2="37.8" y2="17.9" stroke="#1D9E75"
              stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
        <line x1="44.5" y1="38" x2="37.8" y2="34.1" stroke="#1D9E75"
              stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
      </svg>
      <span>${window.i18n ? window.i18n.t('dash.loadingVault') : 'mapeando vault...'}</span>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;

  let data;
  try {
    data = await window.zelador.getGraphData();
  } catch (e) {
    container.innerHTML = `<div style="color:#993C1D;padding:2rem;font-size:13px;">
      ${window.i18n ? window.i18n.t('graph.error') : 'Erro ao carregar grafo'}: ${e.message}
    </div>`;
    return;
  }

  if (!data || !data.nodes || data.nodes.length === 0) {
    container.innerHTML = `<div style="
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;height:100%;gap:8px;
      color:#5C5A56;font-size:13px;font-style:italic;
    ">${window.i18n ? window.i18n.t('graph.empty') : 'Nenhuma nota encontrada no vault.'}</div>`;
    return;
  }

  // Limpar loading
  container.innerHTML = '';
  container.style.position = 'relative';

  // Canvas principal
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:grab;display:block;';
  container.appendChild(canvas);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'graph-tooltip';
  tooltip.style.cssText = `
    position:absolute;
    pointer-events:none;
    opacity:0;
    transition:opacity 0.15s ease;
    background:rgba(14,20,17,0.95);
    border:0.5px solid rgba(29,158,117,0.3);
    border-radius:6px;
    padding:8px 12px;
    font-family:'SF Mono','Fira Code',monospace;
    font-size:11px;
    color:#E8E6E0;
    white-space:nowrap;
    max-width:240px;
    white-space:normal;
    z-index:10;
    backdrop-filter:blur(8px);
  `;
  container.appendChild(tooltip);

  // Stats overlay
  const stats = document.createElement('div');
  stats.id = 'graph-stats';
  stats.style.cssText = `
    position:absolute;bottom:16px;left:16px;
    font-family:'SF Mono','Fira Code',monospace;
    font-size:10px;color:#444441;letter-spacing:0.05em;
    line-height:1.8;pointer-events:none;
  `;
  container.appendChild(stats);

  // Legend overlay
  const legend = document.createElement('div');
  legend.style.cssText = `
    position:absolute;top:16px;right:16px;
    display:flex;flex-direction:column;gap:6px;
    font-family:'SF Mono','Fira Code',monospace;
    font-size:10px;letter-spacing:0.04em;
    pointer-events:none;
  `;
  const t = window.i18n ? window.i18n.t : k => k;
  const phaseDefs = [
    { key:'alive', label:t('phase.alive') },
    { key:'f1',    label:t('phase.f1') },
    { key:'f2',    label:t('phase.f2') },
    { key:'f3',    label:t('phase.f3') },
    { key:'fossil',label:t('phase.fossil') },
  ];
  for (const p of phaseDefs) {
    const cfg = PHASE[p.key];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;';
    row.innerHTML = `
      <div style="
        width:7px;height:7px;border-radius:50%;
        background:${cfg.color};opacity:${cfg.alpha};flex-shrink:0;
      "></div>
      <span style="color:#5C5A56;">${p.label}</span>
    `;
    legend.appendChild(row);
  }
  container.appendChild(legend);

  // Dimensões e DPR
  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    const r = container.getBoundingClientRect();
    canvas.width  = r.width  * dpr;
    canvas.height = r.height * dpr;
  };
  resize();
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(container);

  const ctx = canvas.getContext('2d');

  // Calcular grau de cada nó
  const degree = {};
  for (const n of data.nodes) degree[n.id] = 0;
  for (const e of data.edges) {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  }
  const maxDeg = Math.max(1, ...Object.values(degree));

  const getW = () => canvas.width  / dpr;
  const getH = () => canvas.height / dpr;

  const nodes = data.nodes.map(n => ({
    ...n,
    x: getW()/2 + (Math.random()-0.5) * getW() * 0.5,
    y: getH()/2 + (Math.random()-0.5) * getH() * 0.5,
    r: BASE_R * PHASE[n.phase].size * (0.6 + 0.8 * (degree[n.id]||0) / maxDeg),
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.015 + Math.random() * 0.015,
  }));

  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;

  const edges = data.edges
    .filter(e => !e.isSemantic)
    .map(e => ({ source: nodeById[e.source], target: nodeById[e.target] }))
    .filter(e => e.source && e.target);

  const semanticEdges = data.edges
    .filter(e => e.isSemantic)
    .map(e => ({ source: nodeById[e.source], target: nodeById[e.target], similarity: 1.0 }))
    .filter(e => e.source && e.target);

  const btnAnalyze = document.getElementById('btn-analyze-semantics');
  if (btnAnalyze) {
    btnAnalyze.addEventListener('click', async () => {
      btnAnalyze.disabled = true;
      const origHtml = btnAnalyze.innerHTML;
      const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
      
      btnAnalyze.innerHTML = `<span style="display:inline-block; width:6px; height:6px; background:#BA7517; border-radius:50%; box-shadow:0 0 8px #BA7517;"></span><span style="margin-left:8px;" data-i18n="graph.analyzing">${t('graph.analyzing') || 'ANALISANDO...'}</span>`;
      
      try {
        const res = await window.zelador.analyzeSemantics();
        if (res.success && res.connections) {
          
          for (const conn of res.connections) {
            const sn = nodeById[conn.source];
            const tn = nodeById[conn.target];
            if (sn && tn && !semanticEdges.find(e => e.source === sn && e.target === tn)) {
              semanticEdges.push({ source: sn, target: tn, similarity: conn.similarity });
            }
          }
          
          btnAnalyze.innerHTML = `
            <span style="display:inline-block; width:6px; height:6px; background:#1D9E75; border-radius:50%; box-shadow:0 0 8px #1D9E75;"></span>
            <span style="margin-left:4px;">${res.connections.length} ${t('graph.connectionsFound') || 'CONEXÕES DESCOBERTAS'}</span>
            <div id="btn-save-semantics" style="margin-left:12px; padding:4px 10px; background:rgba(255,255,255,0.1); border-radius:12px; font-weight:bold; cursor:pointer; font-size:10px; border:1px solid rgba(255,255,255,0.2); transition: 0.2s; pointer-events:auto;" title="Salvar links nas notas base">
              ${t('graph.saveLinks') || 'SALVAR LINKS NATIVOS'}
            </div>
          `;
          
          const saveBtn = document.getElementById('btn-save-semantics');
          if (saveBtn) {
            saveBtn.addEventListener('click', async (evt) => {
              evt.stopPropagation();
              saveBtn.innerText = t('graph.saving') || 'SALVANDO...';
              saveBtn.style.pointerEvents = 'none';
              const sRes = await window.zelador.saveSemantics(res.connections);
              if (sRes && sRes.success) {
                saveBtn.innerText = t('graph.saved') || 'SALVO NO COFRE!';
                saveBtn.style.background = 'rgba(29, 158, 117, 0.4)';
                saveBtn.style.color = '#fff';
                setTimeout(() => {
                  btnAnalyze.innerHTML = origHtml;
                  btnAnalyze.disabled = false;
                  if (typeof initGraph === 'function') initGraph();
                }, 2500);
              } else {
                saveBtn.innerText = 'ERRO';
                saveBtn.style.background = 'var(--color-dissolucao)';
                saveBtn.style.pointerEvents = 'auto';
              }
            });
          }
          
          setTimeout(() => { 
            if (btnAnalyze.contains(document.getElementById('btn-save-semantics'))) {
              btnAnalyze.innerHTML = origHtml; 
              btnAnalyze.disabled = false;
            }
          }, 15000);
          
        } else {
          btnAnalyze.innerHTML = `<span>${t('graph.error') || 'ERRO DO OLLAMA'}</span>`;
          setTimeout(() => { btnAnalyze.innerHTML = origHtml; btnAnalyze.disabled = false; }, 3000);
        }
      } catch (err) {
        btnAnalyze.innerHTML = `<span>FALHA CRÍTICA</span>`;
        setTimeout(() => { btnAnalyze.innerHTML = origHtml; btnAnalyze.disabled = false; }, 3000);
      }
    });
  }

  // D3 force simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges)
      .id(d => d.id)
      .distance(d => {
        const sp = PHASE[d.source.phase], tp = PHASE[d.target.phase];
        return 60 + (1 - sp.alpha) * 40 + (1 - tp.alpha) * 40;
      })
      .strength(0.3))
    .force('charge', d3.forceManyBody()
      .strength(d => {
        if (d.phase === 'fossil') return -180;
        if (d.phase === 'f3')     return -220;
        if (d.phase === 'f2')     return -250;
        if (d.phase === 'f1')     return -280;
        return -350;
      }))
    .force('center', d3.forceCenter(getW()/2, getH()/2).strength(0.08))
    .force('collision', d3.forceCollide(d => d.r + 10))
    .alphaDecay(0.015)
    .velocityDecay(0.4);

  // Empurrar decaídos para fora
  simulation.force('decay-push', () => {
    const W = getW(), H = getH();
    for (const n of nodes) {
      if (n.phase === 'f2' || n.phase === 'f3' || n.phase === 'fossil') {
        const dx = n.x - W/2, dy = n.y - H/2;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        n.vx += (dx/dist) * 0.4;
        n.vy += (dy/dist) * 0.4;
      }
    }
  });

  // Estado de interação
  let transform = { x: 0, y: 0, k: 1 };
  let hoveredNode = null;
  let dragNode = null;
  let dragStart = null;
  let isPanning = false;
  let panStart = null;

  function screenToWorld(sx, sy) {
    return {
      x: (sx - transform.x) / transform.k,
      y: (sy - transform.y) / transform.k,
    };
  }

  function hitTest(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = n.x - w.x, dy = n.y - w.y;
      if (Math.sqrt(dx*dx+dy*dy) < n.r + 6) return n;
    }
    return null;
  }

  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const hit = hitTest(sx, sy);
    dragStart = { x: e.clientX, y: e.clientY };
    if (hit) {
      dragNode = hit;
      hit.fx = hit.x; hit.fy = hit.y;
      canvas.style.cursor = 'grabbing';
      simulation.alphaTarget(0.15).restart();
    } else {
      isPanning = true;
      panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

    if (dragNode) {
      const w = screenToWorld(sx, sy);
      dragNode.fx = w.x; dragNode.fy = w.y;
      return;
    }
    if (isPanning && panStart) {
      transform.x = e.clientX - panStart.x;
      transform.y = e.clientY - panStart.y;
      return;
    }

    const hit = hitTest(sx, sy);
    hoveredNode = hit;
    canvas.style.cursor = hit ? 'pointer' : 'grab';

    if (hit) {
      const phaseName = {
        alive: t('phase.alive.full'), f1: t('phase.f1.full'), f2: t('phase.f2.full'),
        f3: t('phase.f3.full'), fossil: t('phase.fossil.full')
      }[hit.phase] || hit.phase;

      tooltip.innerHTML = `
        <div style="font-weight:500;color:${PHASE[hit.phase].color};
                    margin-bottom:4px;font-size:12px;">
          ${hit.name}
        </div>
        <div style="color:#5C5A56;font-size:10px;">${phaseName}</div>
        ${hit.immune ? `<div style="color:#534AB7;font-size:10px;margin-top:2px;">${t('graph.immune')}</div>` : ''}
        <div style="color:#3a3836;font-size:10px;margin-top:4px;
                    font-family:monospace;word-break:break-all;">
          ${hit.id.length > 40 ? '...' + hit.id.slice(-38) : hit.id}
        </div>
      `;

      const tx = sx + 14, ty = sy - 10;
      const tw = 200, th = 80;
      tooltip.style.left = (tx + tw > rect.width  ? sx - tw - 10 : tx) + 'px';
      tooltip.style.top  = (ty + th > rect.height ? sy - th - 10 : ty) + 'px';
      tooltip.style.opacity = '1';
    } else {
      tooltip.style.opacity = '0';
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (dragNode) {
      const d = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
      if (d < 5) {
        const fp = dragNode.filePath || dragNode.path || dragNode.id;
        if (fp) window.zelador.openInObsidian(fp);
      }
      dragNode.fx = null; dragNode.fy = null;
      dragNode = null;
      simulation.alphaTarget(0);
    }
    isPanning = false;
    panStart = null;
    canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    const newK = Math.max(0.2, Math.min(5, transform.k * delta));
    transform.x = mx - (mx - transform.x) * (newK / transform.k);
    transform.y = my - (my - transform.y) * (newK / transform.k);
    transform.k = newK;
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    transform = { x: 0, y: 0, k: 1 };
  });

  // Render loop
  function render() {
    animFrame = requestAnimationFrame(render);

    const W = getW(), H = getH();

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background com vignette
    ctx.fillStyle = '#0a0f0c';
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Arestas — apenas entre nós com edgeAlpha > 0
    for (const e of edges) {
      const sp = PHASE[e.source.phase];
      const tp = PHASE[e.target.phase];
      const alpha = Math.min(sp.edgeAlpha, tp.edgeAlpha);
      if (alpha <= 0) continue;

      const isHovered = hoveredNode &&
        (e.source === hoveredNode || e.target === hoveredNode);

      // Linha de glow por baixo — mais grossa e suave
      ctx.beginPath();
      ctx.moveTo(e.source.x, e.source.y);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.strokeStyle = isHovered
        ? `rgba(29,158,117,${alpha * 0.5})`
        : `rgba(29,158,117,${alpha * 0.25})`;
      ctx.lineWidth = isHovered
        ? 6 / transform.k
        : 3.5 / transform.k;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Linha principal — fina e brilhante por cima
      ctx.beginPath();
      ctx.moveTo(e.source.x, e.source.y);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.strokeStyle = isHovered
        ? `rgba(93,202,165,${alpha * 1.2})`
        : `rgba(93,202,165,${alpha * 0.85})`;
      ctx.lineWidth = isHovered
        ? 1.8 / transform.k
        : 1.2 / transform.k;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Arestas Semânticas (tracejadas âmbar)
    if (semanticEdges && semanticEdges.length > 0) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      for (const se of semanticEdges) {
        const isHovered = hoveredNode && (se.source === hoveredNode || se.target === hoveredNode);
        const alpha = isHovered ? 0.8 : Math.max(0.15, se.similarity - 0.5);
        ctx.beginPath();
        ctx.moveTo(se.source.x, se.source.y);
        ctx.lineTo(se.target.x, se.target.y);
        ctx.strokeStyle = `rgba(218, 165, 32, ${alpha})`;
        ctx.lineWidth = (isHovered ? 2.0 : 1.0) / transform.k;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Nós
    for (const n of nodes) {
      const cfg = PHASE[n.phase];
      n.pulse += n.pulseSpeed;
      const pulse = n.phase === 'alive'
        ? 1 + Math.sin(n.pulse) * 0.08
        : 1.0;
      const r = n.r * pulse;
      const isHov = hoveredNode === n;

      // Halo externo — camada mais suave e larga
      if (cfg.glow) {
        const haloOuter = r * (3.5 + Math.sin(n.pulse) * 0.6);
        const go = ctx.createRadialGradient(n.x,n.y,r*0.5, n.x,n.y,haloOuter);
        go.addColorStop(0, cfg.glow + (n.phase === 'alive' ? '30' : '20'));
        go.addColorStop(1, cfg.glow + '00');
        ctx.globalAlpha = cfg.alpha * 0.5;
        ctx.fillStyle = go;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloOuter, 0, Math.PI*2);
        ctx.fill();
      }

      // Halo interno — mais concentrado e brilhante
      if (cfg.glow) {
        const haloInner = r * (1.8 + Math.sin(n.pulse) * 0.3);
        const gi = ctx.createRadialGradient(n.x,n.y,r*0.3, n.x,n.y,haloInner);
        gi.addColorStop(0, cfg.glow + (n.phase === 'alive' ? '55' : '40'));
        gi.addColorStop(1, cfg.glow + '00');
        ctx.globalAlpha = cfg.alpha * 0.8;
        ctx.fillStyle = gi;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloInner, 0, Math.PI*2);
        ctx.fill();
      }

      // Anel de borda brilhante
      if (n.phase === 'alive' || n.phase === 'f2') {
        ctx.globalAlpha = cfg.alpha * 0.6;
        ctx.strokeStyle = cfg.color + 'AA';
        ctx.lineWidth = 1.2 / transform.k;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 1.5/transform.k, 0, Math.PI*2);
        ctx.stroke();
      }

      // Anel de hover
      if (isHov) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 1 / transform.k;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5/transform.k, 0, Math.PI*2);
        ctx.stroke();
      }

      // Gradiente interno — centro mais claro, borda mais escura
      const nodeGrad = ctx.createRadialGradient(
        n.x - r*0.25, n.y - r*0.25, r*0.05,
        n.x, n.y, r
      );
      nodeGrad.addColorStop(0, cfg.color + 'FF');
      nodeGrad.addColorStop(0.5, cfg.color + 'EE');
      nodeGrad.addColorStop(1, cfg.color + '88');

      ctx.globalAlpha = cfg.alpha * (isHov ? 1.2 : 1);
      ctx.fillStyle = nodeGrad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI*2);
      ctx.fill();

      // Label no hover
      if (isHov && transform.k > 0.5) {
        ctx.globalAlpha = 1;
        ctx.font = `500 ${11/transform.k}px 'SF Mono','Fira Code',monospace`;
        ctx.fillStyle = '#E8E6E0';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y - r - 8/transform.k);
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Stats (fora do transform)
    const aliveN  = nodes.filter(n => n.phase === 'alive').length;
    const decayN  = nodes.filter(n => ['f1','f2','f3'].includes(n.phase)).length;
    const fossilN = nodes.filter(n => n.phase === 'fossil').length;
    const tStats = (window.i18n ? window.i18n.t('graph.stats') : 'notas &nbsp;&middot;&nbsp; conexões &nbsp;&middot;&nbsp; vivas &nbsp;&middot;&nbsp; decaindo &nbsp;&middot;&nbsp; fósseis').split('&nbsp;&middot;&nbsp;');
    stats.innerHTML = `
      ${nodes.length} ${tStats[0].trim()} &nbsp;&middot;&nbsp;
      ${edges.length} ${tStats[1].trim()} &nbsp;&middot;&nbsp;
      ${aliveN} ${tStats[2].trim()} &nbsp;&middot;&nbsp;
      ${decayN} ${tStats[3].trim()} &nbsp;&middot;&nbsp;
      ${fossilN} ${tStats[4].trim()}
    `;

    ctx.restore();
  }

  render();

  // Guardar cleanup do resizeObs
  canvas._resizeObs = resizeObs;
}

function destroyGraph() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  if (simulation) { simulation.stop(); simulation = null; }
  if (canvas && canvas._resizeObs) { canvas._resizeObs.disconnect(); }
  canvas = null;
  const container = document.getElementById('graph-container');
  if (container) container.innerHTML = '';
}

window.initGraph    = initGraph;
window.destroyGraph = destroyGraph;
