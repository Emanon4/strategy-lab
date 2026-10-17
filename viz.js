/* 战略推演 v2 — 图形层
   命运河、结局分布、可拖动的底线与概率、粒子掷骰、龙卷风图与信息价值、势力图、地基图、复盘校准。
   依赖 app.js 里的工具函数与状态；在 app.js 之后加载，最后启动路由。 */
"use strict";

/* ========== engine ========== */
const FLOOR_DEFAULT = -2.5;
const floorOf = r => (r && r.floor !== null && r.floor !== undefined && r.floor !== '' && Number.isFinite(Number(r.floor)) ? Number(r.floor) : FLOOR_DEFAULT);
const short = (s, n) => { s = str(s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
const NS = 'http://www.w3.org/2000/svg';
UI.samples = UI.samples || {};
UI.torOpt = null;

/* every future, as a lattice: column i holds cumulative score → probability */
function lattice(o) {
  const ns = o.nodes.slice(0, 6); const cols = [new Map([[0, 1]])]; const edges = [];
  ns.forEach((n, i) => {
    const p = clampInt(n.p, 0, 100, 50) / 100, up = clampInt(n.up, 0, 3, 0), dn = clampInt(n.down, -3, 0, 0); const next = new Map();
    for (const [s, m] of cols[i]) {
      if (p > 0) { next.set(s + up, (next.get(s + up) || 0) + m * p); edges.push({i, from: s, to: s + up, m: m * p, up: true}); }
      if (p < 1) { next.set(s + dn, (next.get(s + dn) || 0) + m * (1 - p)); edges.push({i, from: s, to: s + dn, m: m * (1 - p), up: false}); }
    }
    cols.push(next);
  });
  return {cols, edges, n: ns.length};
}
function distOf(o) { const L = lattice(o); return L.n ? L.cols[L.n] : null; }
function stats(o, F = FLOOR_DEFAULT) {
  const d = distOf(o); if (!d) return null;
  let ev = 0, good = 0, bad = 0, br = 0, worst = Infinity, best = -Infinity;
  for (const [s, p] of d) { ev += s * p; if (s > 0) good += p; if (s < 0) bad += p; if (s < F) br += p; worst = Math.min(worst, s); best = Math.max(best, s); }
  return {d, ev, good, bad, br, worst, best};
}
function evWith(o, k, pk) { return stats(Object.assign({}, o, {nodes: o.nodes.map((n, i) => (i === k ? Object.assign({}, n, {p: pk}) : n))})).ev; }
function domain(r) {
  let lo = 0, hi = 0;
  for (const o of r.options) { const d = distOf(o); if (d) for (const s of d.keys()) { lo = Math.min(lo, s); hi = Math.max(hi, s); } }
  const F = floorOf(r); return [Math.min(lo, Math.floor(F) - 1, -3), Math.max(hi, 3)];
}
const cls = (s, F) => (s < F ? 'br' : s > 0 ? 'gd' : s < 0 ? 'bd' : 'nt');
function vizW() {
  const w = innerWidth > 900 ? Math.min(760, innerWidth - 276) : innerWidth - 40;
  return Math.max(300, Math.min(724, Math.round(w - 38)));
}
function statsHTML(r, o) {
  const st = stats(o, floorOf(r)); if (!st) return '';
  return `<div class="stats"><span>期望 <b>${signed(st.ev)}</b></span><span>好结局 <b>${pct(st.good)}</b></span><span>坏结局 <b>${pct(st.bad)}</b></span><span class="${st.br > 0.0005 ? 'r' : ''}">触底 <b>${pct(st.br)}</b></span><span>区间 <b>${signed(st.worst)} ~ ${signed(st.best)}</b></span></div>`;
}

/* ========== 命运河 ========== */
function riverSVG(r, o, opt = {}) {
  const L = lattice(o); if (!L.n) return '';
  const [lo, hi] = domain(r); const F = floorOf(r);
  const W = opt.w || vizW(), narrow = W < 480;
  const ml = narrow ? 22 : 40, mr = narrow ? 82 : 104, mt = 60, mb = 22, H = narrow ? 270 : 310, ph = H - mt - mb;
  const colW = (W - ml - mr) / L.n;
  const X = i => ml + i * colW, Y = s => mt + (hi - s) / (hi - lo) * ph;
  let g = '';
  const fy = Y(F);
  g += `<rect class="floorband" x="${ml - 10}" y="${fy.toFixed(1)}" width="${W - ml - mr + 20}" height="${Math.max(0, H - mb - fy).toFixed(1)}"/>`;
  g += `<line class="gz" x1="${ml - 10}" x2="${W - mr + 10}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  for (let i = 1; i <= L.n; i++) g += `<line class="gcol" x1="${X(i)}" x2="${X(i)}" y1="${mt - 4}" y2="${H - mb}"/>`;
  g += [...L.edges].sort((a, b) => b.m - a.m).map(e => `<line class="edge ${e.up ? 'up' : 'dn'}" x1="${X(e.i).toFixed(1)}" y1="${Y(e.from).toFixed(1)}" x2="${X(e.i + 1).toFixed(1)}" y2="${Y(e.to).toFixed(1)}" stroke-width="${(1.5 + e.m * 22).toFixed(1)}"><title>${e.up ? '顺' : '逆'} · ${pct(e.m)}</title></line>`).join('');
  if (opt.actual) {
    let s = 0; const pts = [[X(0), Y(0)]];
    for (let i = 0; i < L.n; i++) { const n = o.nodes[i]; const a = opt.actual[n.id]; if (a !== 'up' && a !== 'down') break; s += a === 'up' ? clampInt(n.up, 0, 3, 0) : clampInt(n.down, -3, 0, 0); pts.push([X(i + 1), Y(s)]); }
    if (pts.length > 1) g += `<polyline class="actual" points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"/><circle class="particle" cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="5"/>`;
  }
  const ro = UI.rolls[o.id];
  const showRoll = ro && ro.states && ro.states.length === L.n + 1 && UI.justRolled !== o.id && !opt.actual;
  g += `<polyline class="rollpath" id="rp-${o.id}" points="${showRoll ? ro.states.map((s, i) => X(i).toFixed(1) + ',' + Y(s).toFixed(1)).join(' ') : ''}"/>`;
  if (showRoll) g += `<circle class="particle" cx="${X(L.n).toFixed(1)}" cy="${Y(ro.states[L.n]).toFixed(1)}" r="5"/>`;
  for (let i = 0; i < L.n; i++) for (const s of L.cols[i].keys()) g += `<circle class="jn${i === 0 ? ' root' : ''}" cx="${X(i).toFixed(1)}" cy="${Y(s).toFixed(1)}" r="${i === 0 ? 5 : 2.6}"/>`;
  const fin = [...L.cols[L.n].entries()].sort((a, b) => b[0] - a[0]);
  let last = -99;
  g += fin.map(([s, p]) => {
    const y = Y(s); const ly = Math.min(H - 4, Math.max(y + 4, last + 14)); last = ly;
    return `<circle class="leaf ${cls(s, F)}" cx="${X(L.n).toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + Math.sqrt(p) * 9).toFixed(1)}"/><text class="lt" x="${(X(L.n) + 15).toFixed(1)}" y="${ly.toFixed(1)}">${signed(s)} · ${pct(p)}</text>`;
  }).join('');
  g += `<text class="tk" x="${X(0)}" y="${(Y(0) + 20).toFixed(1)}" text-anchor="middle">现在</text>`;
  const br = stats(o, F).br;
  g += `<line class="floor" x1="${ml - 10}" x2="${W - mr + 10}" y1="${fy.toFixed(1)}" y2="${fy.toFixed(1)}"/>`;
  g += opt.interactive
    ? `<g class="fhandle" data-drag="floor" data-svg="rv-${o.id}"><rect x="${ml - 8}" y="${(fy - 11).toFixed(1)}" width="88" height="22" rx="11"/><text x="${ml + 36}" y="${(fy + 4).toFixed(1)}" text-anchor="middle">底线 ${pct(br)} ↕</text></g>`
    : `<text class="fl" x="${ml - 6}" y="${(fy - 6).toFixed(1)}">底线 · 触底 ${pct(br)}</text>`;
  const maxc = Math.max(2, Math.floor((colW - 4) / 12.5)); const gw = Math.max(26, Math.min(88, colW - 12));
  o.nodes.slice(0, 6).forEach((n, i) => {
    const cx = X(i + 1) - colW / 2; const p = clampInt(n.p, 0, 100, 50); const gx = cx - gw / 2;
    g += `<text class="nh" x="${cx.toFixed(1)}" y="14" text-anchor="middle"><title>${esc(n.text)}</title>${esc(short(n.text, maxc))}</text>`;
    g += `<g${opt.interactive ? ` class="gauge" data-drag="p" data-o="${o.id}" data-n="${n.id}" data-x="${gx.toFixed(1)}" data-w="${gw.toFixed(1)}" data-svg="rv-${o.id}"` : ''}><rect class="g-dn" x="${gx.toFixed(1)}" y="23" width="${gw.toFixed(1)}" height="10" rx="3"/><rect class="g-up" x="${gx.toFixed(1)}" y="23" width="${Math.max(0, gw * p / 100).toFixed(1)}" height="10" rx="3"/>${opt.interactive ? `<rect class="g-hit" x="${(gx - 8).toFixed(1)}" y="14" width="${(gw + 16).toFixed(1)}" height="30"/>` : ''}</g>`;
    g += `<text class="np" x="${cx.toFixed(1)}" y="47" text-anchor="middle">顺 ${p}%</text>`;
  });
  return `<svg id="rv-${o.id}" class="viz river" viewBox="0 0 ${W} ${H}" data-xs="${Array.from({length: L.n + 1}, (_, i) => X(i).toFixed(1)).join(',')}" data-lo="${lo}" data-hi="${hi}" data-mt="${mt}" data-ph="${ph}" role="img" aria-label="${esc(o.label)} 的命运河：横轴是时间，纵轴是累计得分，线宽是概率">${g}</svg>`;
}

/* ========== 结局分布 ========== */
function distSVG(r, opt = {}) {
  const os = r.options.filter(o => o.label && o.nodes.length); if (!os.length) return '';
  const [lo, hi] = domain(r); const F = floorOf(r);
  const W = opt.w || vizW(), narrow = W < 480;
  const ml = 14, mr = 14, rowH = narrow ? 96 : 82, barH = narrow ? 40 : 46, top = opt.interactive ? 44 : 20, H = top + os.length * rowH + 22;
  const pw = W - ml - mr; const X = s => ml + (s - lo) / (hi - lo) * pw; const step = pw / (hi - lo); const bw = Math.max(4, Math.min(18, step * 0.72));
  let maxp = 0.05; os.forEach(o => { for (const p of distOf(o).values()) maxp = Math.max(maxp, p); }); const hs = barH / maxp;
  const fx = X(F);
  let g = `<rect class="floorband" x="${ml - 6}" y="${top - 6}" width="${Math.max(0, fx - ml + 6).toFixed(1)}" height="${os.length * rowH}"/>`;
  os.forEach((o, k) => {
    const st = stats(o, F); const base = top + k * rowH + rowH - 18; const me = r.choice.optionId === o.id;
    g += `<text class="rl${me ? ' me' : ''}" x="${ml}" y="${base - (narrow ? 70 : 54)}">${optLetter(r, o)}  ${esc(short(o.label, narrow ? 16 : 16))}</text>`;
    g += narrow ? `<text class="rs" x="${ml}" y="${base - 54}">期望 ${signed(st.ev)} · 好 ${pct(st.good)} · 触底 ${pct(st.br)}</text>` : `<text class="rs" x="${W - mr}" y="${base - 54}" text-anchor="end">期望 ${signed(st.ev)} · 好结局 ${pct(st.good)} · 触底 ${pct(st.br)}</text>`;
    g += `<line class="base" x1="${ml - 6}" x2="${W - mr}" y1="${base}" y2="${base}"/>`;
    for (const [s, p] of st.d) { const h = p * hs; g += `<rect class="bar ${cls(s, F)}" x="${(X(s) - bw / 2).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>得分 ${signed(s)}：${pct(p)}${s < F ? '（触底）' : ''}</title></rect>`; }
    const sm = UI.samples[o.id];
    if (sm && sm.n) for (const [s, c] of Object.entries(sm.c)) {
      if (sm.n < 10) { const top0 = base - (st.d.get(+s) || 0) * hs - 6; for (let k = 0; k < c; k++) g += `<circle class="smpd" cx="${X(+s).toFixed(1)}" cy="${(top0 - k * 8).toFixed(1)}" r="3.2"/>`; }
      else { const h = Math.min(barH + 6, c / sm.n * hs); g += `<rect class="smp" x="${(X(+s) - bw / 2 - 2.5).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw + 5).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`; }
    }
    g += `<path class="evt" d="M${X(st.ev).toFixed(1)} ${base + 3} l-5 8 h10 z"><title>期望 ${signed(st.ev)}</title></path>`;
  });
  const ax = top + os.length * rowH + 12;
  const every = (hi - lo) > 14 ? 3 : (hi - lo) > 8 ? 2 : 1;
  for (let s = lo; s <= hi; s++) if (s % every === 0) g += `<text class="tk" x="${X(s).toFixed(1)}" y="${ax}" text-anchor="middle">${s > 0 ? '+' + s : s}</text>`;
  g += `<line class="floor" x1="${fx.toFixed(1)}" x2="${fx.toFixed(1)}" y1="${top - 6}" y2="${ax - 12}"/>`;
  if (opt.interactive) g += `<g class="fhandle" data-drag="floorx" data-svg="dist-svg"><rect x="${(fx - 34).toFixed(1)}" y="${top - 40}" width="68" height="20" rx="10"/><text x="${fx.toFixed(1)}" y="${top - 26}" text-anchor="middle">底线 ↔</text></g>`;
  return `<svg id="dist-svg" class="viz dist" viewBox="0 0 ${W} ${H}" data-lo="${lo}" data-hi="${hi}" data-x0="${ml}" data-pw="${pw}" role="img" aria-label="各选项的结局分布：柱高是概率，三角是期望，红线是底线">${g}</svg>`;
}
function miniDist(r, o, W = 280) {
  if (!o || !o.nodes.length) return '';
  const [lo, hi] = domain(r); const F = floorOf(r); const st = stats(o, F); const H = 40, ml = 4, pw = W - 8;
  const X = s => ml + (s - lo) / (hi - lo) * pw; const bw = Math.max(3, Math.min(12, pw / (hi - lo) * 0.7));
  let maxp = 0.05; for (const p of st.d.values()) maxp = Math.max(maxp, p);
  let g = `<line class="base" x1="0" x2="${W}" y1="${H - 4}" y2="${H - 4}"/><line class="floor" x1="${X(F).toFixed(1)}" x2="${X(F).toFixed(1)}" y1="2" y2="${H - 2}"/>`;
  for (const [s, p] of st.d) { const h = p / maxp * (H - 10); g += `<rect class="bar ${cls(s, F)}" x="${(X(s) - bw / 2).toFixed(1)}" y="${(H - 4 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`; }
  g += `<path class="evt" d="M${X(st.ev).toFixed(1)} ${H - 3} l-4 6 h8 z"/>`;
  return `<svg class="viz mini" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="结局分布：期望 ${signed(st.ev)}，触底 ${pct(st.br)}">${g}</svg>`;
}

/* ========== 关键性：龙卷风 + 信息价值 ========== */
function sens(o) { return o.nodes.map((n, k) => ({n, k, lo: evWith(o, k, 0), hi: evWith(o, k, 100)})).sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo)); }
function tornadoSVG(r, o) {
  const st = stats(o); const rows = sens(o); if (!rows.length) return '';
  const vals = rows.flatMap(x => [x.lo, x.hi]).concat(st.ev); let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  const W = vizW(), narrow = W < 480, ml = narrow ? 92 : 168, mr = 16, rh = 36, top = 30, H = top + rows.length * rh + 6;
  const X = v => ml + (v - lo) / (hi - lo) * (W - ml - mr);
  let g = `<line class="evline" x1="${X(st.ev).toFixed(1)}" x2="${X(st.ev).toFixed(1)}" y1="${top - 8}" y2="${top + rows.length * rh - 4}"/><text class="tk" x="${X(st.ev).toFixed(1)}" y="${top - 13}" text-anchor="middle">当前期望 ${signed(st.ev)}</text>`;
  rows.forEach((x, i) => {
    const y = top + i * rh;
    g += `<text class="rl2" x="${ml - 10}" y="${y + 18}" text-anchor="end"><title>${esc(x.n.text)}</title>${esc(short(x.n.text, narrow ? 6 : 12))}</text>`;
    g += `<rect class="bar bd" x="${X(x.lo).toFixed(1)}" y="${y + 6}" width="${Math.max(1, X(st.ev) - X(x.lo)).toFixed(1)}" height="18" rx="2"/><rect class="bar gd" x="${X(st.ev).toFixed(1)}" y="${y + 6}" width="${Math.max(1, X(x.hi) - X(st.ev)).toFixed(1)}" height="18" rx="2"/>`;
    g += `<text class="tk" x="${(X(x.lo) - 4).toFixed(1)}" y="${y + 19}" text-anchor="end">${signed(x.lo)}</text><text class="tk" x="${(X(x.hi) + 4).toFixed(1)}" y="${y + 19}">${signed(x.hi)}</text>`;
  });
  return `<svg class="viz tornado" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)} 各节点的敏感度">${g}</svg>`;
}
function voi(r) {
  const os = r.options.filter(o => o.label && o.nodes.length); if (os.length < 2) return null;
  const evs = os.map(o => stats(o).ev); const best = Math.max(...evs); let top = null;
  os.forEach((o, i) => {
    let oth = -Infinity, othO = null; os.forEach((x, j) => { if (j !== i && evs[j] > oth) { oth = evs[j]; othO = x; } });
    o.nodes.forEach((n, k) => {
      const p = clampInt(n.p, 0, 100, 50) / 100; const g = evWith(o, k, 100), b = evWith(o, k, 0);
      const v = p * Math.max(g, oth) + (1 - p) * Math.max(b, oth) - best;
      if (!top || v > top.v) top = {v, o, n, g, b, oth, othO};
    });
  });
  return top;
}
function insightHTML(r) {
  const os = r.options.filter(o => o.label && o.nodes.length); if (!os.length) return '';
  const best = os.reduce((a, o) => (stats(o).ev > stats(a).ev ? o : a), os[0]);
  const v = voi(r); let call = '';
  if (v && v.v > 0.1) {
    const goodO = v.g >= v.oth ? v.o : v.othO, badO = v.b >= v.oth ? v.o : v.othO;
    call = `<div class="insight hot"><span class="ik">信息价值最高</span><div class="it">先去打听：${esc(v.n.text)}</div><p>这是 ${optLetter(r, v.o)} 路上的一个节点。结果有利时，最好的路是 <b>${optLetter(r, goodO)}</b>；不利时，最好改走 <b>${optLetter(r, badO)}</b>。落子之前先弄清它，平均能让结局好 <b class="mono">${signed(v.v)}</b>。</p></div>`;
  } else if (os.length > 1) {
    call = `<div class="insight"><span class="ik">信息价值</span><div class="it">没有哪条单独的信息会改变你的选择</div><p>目前期望最高的是 <b>${optLetter(r, best)}</b>。就算提前知道任何一个节点的结果，最好的路也还是它，可以放心落子。</p></div>`;
  }
  const focus = os.find(o => o.id === UI.torOpt) || os.find(o => o.id === r.choice.optionId) || best;
  const pills = os.length > 1 ? `<div class="pills">${os.map(o => `<button class="pill" data-act="torOpt" data-id="${o.id}" aria-pressed="${o === focus}">${optLetter(r, o)}</button>`).join('')}</div>` : '';
  return `${call}<section class="vizbox"><div class="vh"><h3>什么最关键</h3>${pills}</div><p class="hint">把每个节点从「一定不利」拉到「一定有利」，期望会摆动多少。条越长，越值得花力气去影响或打听。</p>${tornadoSVG(r, focus)}</section>`;
}

/* ========== 推演步骤 ========== */
function stepPlay(r) {
  const os = r.options.filter(o => o.label);
  if (os.length < 1) return '<section class="block"><p class="muted">先回到「定题」写下至少一条路。</p></section>';
  const busy = UI.busy && UI.busy.kind === 'sim'; const any = os.some(o => o.nodes.length); const confirming = UI.confirm === 'sim';
  const simBtn = busy ? busyLine('各方在出牌，裁判在估概率…通常需要半分钟到一分钟')
    : confirming ? `<div class="card-f"><span class="small">重新推演会替换现有的全部节点。</span><button class="btn sm ai" data-act="aiSim">确认重新推演</button><button class="btn sm ghost" data-act="cancel">取消</button></div>`
    : `<div class="card-f"><button class="btn ai" data-act="${any ? 'askSim' : 'aiSim'}">${SPARK}${any ? '重新推演全部' : '让 AI 推演全部选项'}</button><span class="hint">也可以在每条路下面手动加节点。</span></div>`;
  const nSamples = os.reduce((s, o) => s + ((UI.samples[o.id] || {}).n || 0), 0);
  const dist = any ? `<section class="vizbox"><div class="vh"><h3>结局分布</h3><span class="hint">柱高 = 概率　▲ = 期望　红线 = 底线（可拖动）</span></div><div id="dist-wrap">${distSVG(r, {interactive: true})}</div>
      <div class="key"><span><i class="k-gd"></i>好结局</span><span><i class="k-nt"></i>持平</span><span><i class="k-bd"></i>坏结局</span><span><i class="k-br"></i>触底</span>${nSamples ? `<span><i class="k-smp"></i>你掷出的结果（${nSamples} 次）</span>` : ''}</div></section>
      <div id="insight-wrap" class="stack">${insightHTML(r)}</div>` : '';
  return `<section class="block">${simBtn}${errLine('sim')}</section>${dist}${os.map(o => optCard(r, o)).join('')}`;
}
function optCard(r, o) {
  const editing = !!UI.editing[o.id]; const roll = UI.rolls[o.id]; const sm = UI.samples[o.id];
  const nodeRows = o.nodes.map((n, i) => {
    if (editing) {
      const b = 'run:options.' + o.id + '.nodes.' + n.id + '.';
      return `<div class="nedit">
        <div class="r3">${inp(b + 'text', n.text, {ph: '会发生什么不确定的事', label: '节点'})}${inp(b + 'actor', n.actor, {ph: '谁', label: '谁的反应', extra: ' list="actors-dl"'})}</div>
        <div class="r4">${inp(b + 'good', n.good, {ph: '有利时', label: '有利时'})}<select class="field" id="${fid(b + 'up')}" data-bind="${b}up" data-type="num" data-rerender="1" aria-label="有利时的影响">${[0, 1, 2, 3].map(v => `<option value="${v}"${clampInt(n.up, 0, 3, 0) === v ? ' selected' : ''}>+${v}</option>`).join('')}</select></div>
        <div class="r4">${inp(b + 'bad', n.bad, {ph: '不利时', label: '不利时'})}<select class="field" id="${fid(b + 'down')}" data-bind="${b}down" data-type="num" data-rerender="1" aria-label="不利时的影响">${[0, -1, -2, -3].map(v => `<option value="${v}"${clampInt(n.down, -3, 0, 0) === v ? ' selected' : ''}>${v === 0 ? '±0' : '−' + Math.abs(v)}</option>`).join('')}</select></div>
        <div class="card-f"><label class="small muted" for="${fid(b + 'p')}">有利概率</label><span class="conf">${inp(b + 'p', n.p, {type: 'number', num: true, re: true, extra: ' min="0" max="100"', label: '有利概率'})}%</span><span class="sp" style="flex:1"></span><button class="btn sm ghost danger" data-act="delNode" data-o="${o.id}" data-id="${n.id}">删除节点</button></div>
      </div>`;
    }
    return `<div class="node">${sym(sideOfActor(r, n.actor), 18)}<div><div class="t"><span class="mono faint">${i + 1}</span> ${esc(n.text)}</div>${n.actor ? `<div class="who">${esc(n.actor)}</div>` : ''}
      <div class="oc"><span class="s g">顺 ${signed(n.up)}</span><span>${esc(n.good)}</span><span></span><span class="s b">逆 ${signed(n.down)}</span><span>${esc(n.bad)}</span>${n.breach ? '<span class="tag br">触底</span>' : '<span></span>'}</div></div>
      <div class="p">${clampInt(n.p, 0, 100, 50)}%<small>有利</small></div></div>`;
  }).join('');
  let fut = '';
  if (roll && o.nodes.length && roll.res.length === o.nodes.length) {
    const anim = UI.justRolled === o.id && !reduceMotion;
    fut = `<div class="future" aria-live="polite"><div class="future-h"><b>掷出的一种未来</b><span class="mono">${signed(roll.score)}</span>${roll.breach ? '<span class="tag br">碰到了底线</span>' : ''}</div>
      ${roll.res.map((x, i) => `<div class="fr${anim ? ' pre' : ''}" data-i="${i}"><span class="d">${x.d}/${x.p}</span><span class="v ${x.ok ? 'g' : 'b'}">${x.ok ? '顺' : '逆'}</span><span>${esc(x.txt)}</span></div>`).join('')}</div>`;
  }
  const has = o.nodes.length > 0;
  return `<article class="card" id="opt-${o.id}">
    <div class="card-h"><span class="let">${optLetter(r, o)}</span><h3>${esc(o.label)}</h3>${has ? `<button class="btn sm ghost" data-act="edit" data-id="${o.id}">${editing ? '完成' : '改文字'}</button>` : '<span></span>'}</div>
    ${has ? `<div id="stw-${o.id}">${statsHTML(r, o)}</div><div class="rvw" id="rvw-${o.id}">${riverSVG(r, o, {interactive: true})}</div><p class="hint">左右拖动节点上方的蓝红条来调概率；上下拖动红色虚线来设底线。线越粗，那条路越可能走到。</p>` : ''}
    ${editing ? `<div class="nodes">${nodeRows}</div>` : has ? `<details class="ndet"><summary>节点详情（${o.nodes.length}）</summary><div class="nodes">${nodeRows}</div></details>` : '<p class="hint">还没有关键节点。</p>'}
    ${fut}
    <div class="card-f">${has ? `<button class="btn" data-act="roll" data-id="${o.id}">掷一次</button><button class="btn ghost" data-act="rollMany" data-id="${o.id}">连掷 50 次</button>${sm && sm.n ? `<span class="faint small">已掷 ${sm.n} 次</span>` : ''}` : ''}${o.nodes.length < 6 ? `<button class="btn sm ghost" data-act="addNode" data-id="${o.id}">+ 节点</button>` : ''}</div>
  </article>`;
}
function refreshPlay() {
  const r = cur(); if (!r) return;
  r.options.forEach(o => {
    const w = document.getElementById('rvw-' + o.id); if (w) w.innerHTML = riverSVG(r, o, {interactive: true});
    const s = document.getElementById('stw-' + o.id); if (s) s.innerHTML = statsHTML(r, o);
  });
  const d = document.getElementById('dist-wrap'); if (d) d.innerHTML = distSVG(r, {interactive: true});
  const i = document.getElementById('insight-wrap'); if (i) i.innerHTML = insightHTML(r);
}

/* ========== 势力图 ========== */
function symShape(side, size) {
  const s = SIDES[side] || SIDES.unknown; const fill = side === 'self' ? `var(--${s.c})` : `var(--${s.c}-soft)`;
  let shape;
  if (side === 'self' || side === 'friend') shape = '<rect x="2" y="6" width="20" height="12"/>';
  else if (side === 'hostile') shape = '<path d="M12 2 22 12 12 22 2 12Z"/>';
  else if (side === 'neutral') shape = '<rect x="4" y="4" width="16" height="16"/>';
  else shape = '<path d="M7.5 7.5A4.5 4.5 0 0 1 16.5 7.5A4.5 4.5 0 0 1 16.5 16.5A4.5 4.5 0 0 1 7.5 16.5A4.5 4.5 0 0 1 7.5 7.5Z"/>';
  return `<g transform="translate(${-size / 2},${-size / 2}) scale(${size / 24})" style="fill:${fill};stroke:var(--${s.c});stroke-width:${(1.7 * 24 / size).toFixed(2)}">${shape}</g>`;
}
function forceGeom() {
  const W = vizW(); const H = Math.max(300, Math.min(400, Math.round(W * 0.62)));
  const R3 = Math.min(H / 2 - 30, W / 2 - 64); return {W, H, cx: W / 2, cy: H / 2 + 6, R: [0, R3 * 0.38, R3 * 0.7, R3]};
}
function actorPlace(a, i, n) {
  const ring = clampInt(a.ring, 1, 3, 2);
  const ang = a.angle !== undefined && a.angle !== null && Number.isFinite(Number(a.angle)) ? Number(a.angle) : -90 + 25 + i * 360 / Math.max(1, n);
  return {ring, ang};
}
function forceSVG(r) {
  const {W, H, cx, cy, R} = forceGeom(); const others = r.actors.filter(a => a.side !== 'self'); const me = r.actors.find(a => a.side === 'self');
  let g = [1, 2, 3].map(k => `<circle class="ring" cx="${cx}" cy="${cy}" r="${R[k].toFixed(1)}"/>`).join('');
  g += ['影响大', '中', '影响小'].map((t, k) => `<text class="tk" x="${cx}" y="${(cy - R[k + 1] - 5).toFixed(1)}" text-anchor="middle">${t}</text>`).join('');
  const pos = others.map((a, i) => { const {ring, ang} = actorPlace(a, i, others.length); const rad = ang * Math.PI / 180; return {a, ring, x: cx + R[ring] * Math.cos(rad), y: cy + R[ring] * Math.sin(rad)}; });
  g += pos.map(p => `<line class="tie" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke-width="${4 - p.ring}"/>`).join('');
  g += pos.map(p => { const sz = 16 + clampInt(p.a.power, 1, 3, 2) * 6; return `<g class="actor-g" data-drag="actor" data-id="${p.a.id}" data-svg="force-svg" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><circle class="hit" r="${sz / 2 + 8}"/>${symShape(p.a.side, sz)}<text class="al" y="${sz / 2 + 15}" text-anchor="middle">${esc(short(p.a.name || '未命名', 8))}</text><title>${esc(p.a.name)}：${esc(p.a.want)}</title></g>`; }).join('');
  g += `<g transform="translate(${cx},${cy})">${symShape('self', 34)}<text class="al me" y="30" text-anchor="middle">${esc(short((me && me.name) || '我', 6))}</text></g>`;
  if (!others.length) g += `<text class="tk" x="${cx}" y="${H - 8}" text-anchor="middle">在下面的列表里加入其他行动者</text>`;
  return `<svg id="force-svg" class="viz force" viewBox="0 0 ${W} ${H}" data-cx="${cx}" data-cy="${cy}" data-r="${R.map(v => v.toFixed(1)).join(',')}" role="img" aria-label="势力图：越靠近中心的一方对结果影响越大">${g}</svg>`;
}

/* ========== 地基图 ========== */
function groundGeom() { const W = vizW(); const H = W < 480 ? 280 : 320; const ml = 46, mr = 18, mt = 18, mb = 40; return {W, H, ml, mr, mt, mb, pw: W - ml - mr, ph: H - mt - mb}; }
function groundSVG(r) {
  const {W, H, ml, mt, pw, ph} = groundGeom(); const X = c => ml + c / 100 * pw, Y = v => mt + (100 - v) / 100 * ph;
  let g = `<rect class="zone" x="${X(0)}" y="${Y(100)}" width="${(X(50) - X(0)).toFixed(1)}" height="${(Y(50) - Y(100)).toFixed(1)}"/><text class="zl" x="${X(0) + 10}" y="${Y(100) + 18}">先验证</text>`;
  g += `<line class="ax" x1="${ml}" x2="${ml + pw}" y1="${mt + ph}" y2="${mt + ph}"/><line class="ax" x1="${ml}" x2="${ml}" y1="${mt}" y2="${mt + ph}"/>`;
  g += `<line class="gcol" x1="${X(50)}" x2="${X(50)}" y1="${mt}" y2="${mt + ph}"/><line class="gcol" x1="${ml}" x2="${ml + pw}" y1="${Y(50)}" y2="${Y(50)}"/>`;
  g += [0, 50, 100].map(v => `<text class="tk" x="${X(v)}" y="${mt + ph + 16}" text-anchor="middle">${v}%</text>`).join('');
  g += `<text class="tk" x="${ml + pw}" y="${H - 4}" text-anchor="end">把握 →</text><text class="tk" x="${ml - 8}" y="${mt + 10}" text-anchor="end">重要</text><text class="tk" x="${ml - 8}" y="${mt + ph}" text-anchor="end">次要</text>`;
  const ns = r.notes.filter(n => n.text);
  g += ns.map(n => {
    const fact = n.kind === 'fact'; const c = fact ? 100 : clampInt(n.conf, 0, 100, 50); const imp = clampInt(n.imp, 0, 100, 50);
    const x = X(c), y = Y(imp); const right = x < ml + pw - 120;
    const shape = fact ? `<rect class="pt-f" x="-7" y="-7" width="14" height="14"/>` : `<circle class="pt-a" r="8"/>`;
    return `<g class="note-g" data-drag="note" data-id="${n.id}" data-svg="ground-svg" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><circle class="hit" r="16"/>${shape}<text class="al${fact ? '' : ' as'}" x="${right ? 13 : -13}" y="4" text-anchor="${right ? 'start' : 'end'}">${esc(short(n.text, 10))}</text><title>${esc(n.text)}（${fact ? '事实' : '把握 ' + c + '%'}，重要性 ${imp}）</title></g>`;
  }).join('');
  if (!ns.length) g += `<text class="tk" x="${X(50)}" y="${Y(50) + 4}" text-anchor="middle">在下面写下事实和假设，它们会出现在这里</text>`;
  return `<svg id="ground-svg" class="viz ground" viewBox="0 0 ${W} ${H}" role="img" aria-label="地基图：横轴是把握，纵轴是重要性，左上角是需要先验证的假设">${g}</svg>`;
}

/* ========== 布局步骤 ========== */
function stepBoard(r) {
  const sug = UI.sug.board && UI.sug.board.rid === r.id ? UI.sug.board : null;
  const busy = UI.busy && UI.busy.kind === 'board';
  const actors = r.actors.map(a => {
    const pw = clampInt(a.power, 1, 3, 2);
    return `<div class="actor">
    <button class="symbtn" data-act="side" data-id="${a.id}" title="点一下切换阵营" aria-label="切换阵营，当前：${SIDES[a.side].label}">${sym(a.side)}</button>
    ${inp('run:actors.' + a.id + '.name', a.name, {ph: '谁', label: '名称'})}
    <div class="want">${inp('run:actors.' + a.id + '.want', a.want, {ph: a.side === 'self' ? '我真正想要的是什么' : '他想要什么', label: '想要什么'})}</div>
    ${a.side === 'self' ? '<span></span>' : `<span class="pw" title="实力">${[1, 2, 3].map(k => `<button class="pwb${pw >= k ? ' on' : ''}" data-act="power" data-id="${a.id}" data-v="${k}" aria-label="实力 ${['小', '中', '大'][k - 1]}"></button>`).join('')}</span>`}
    ${a.side === 'self' && r.actors.filter(x => x.side === 'self').length === 1 ? '<span></span>' : `<button class="x" data-act="delActor" data-id="${a.id}" aria-label="删除">×</button>`}
  </div>`;
  }).join('');
  const notes = r.notes.map(n => `<div class="note ${n.kind}">
    <button class="kind" data-act="kind" data-id="${n.id}" title="切换事实 / 假设">${n.kind === 'fact' ? '事实' : '假设'}</button>
    ${inp('run:notes.' + n.id + '.text', n.text, {ph: n.kind === 'fact' ? '一件你能查证的事' : '一个你相信、但没验证过的判断', label: '内容'})}
    ${n.kind === 'fact' ? '<span></span>' : `<label class="conf" title="你有几成把握">${inp('run:notes.' + n.id + '.conf', n.conf, {type: 'number', num: true, re: true, extra: ' min="0" max="100"', label: '把握'})}%</label>`}
    <button class="x" data-act="delNote" data-id="${n.id}" aria-label="删除">×</button>
  </div>`).join('');
  let sugHTML = '';
  if (sug) {
    sugHTML = `<div class="sug"><h3>${SPARK}你可能漏掉的</h3>
      ${sug.actors.length ? `<div><p class="lab">行动者</p><div class="adds">${sug.actors.map((a, i) => `<button class="add${a.used ? ' used' : ''}" data-act="addSugActor" data-i="${i}"${a.used ? ' disabled' : ''}>${sym(a.side, 16)}${esc(a.name)}<span class="faint">· ${esc(a.want)}</span></button>`).join('')}</div></div>` : ''}
      ${sug.assumptions.length ? `<div><p class="lab">隐含的假设</p><div class="adds">${sug.assumptions.map((t, i) => `<button class="add${sug.usedA[i] ? ' used' : ''}" data-act="addSugNote" data-i="${i}"${sug.usedA[i] ? ' disabled' : ''}>${sug.usedA[i] ? '已加入' : '+'} ${esc(t)}</button>`).join('')}</div></div>` : ''}
    </div>`;
  }
  return `
  <section class="vizbox"><div class="vh"><h3>势力图</h3><span class="hint">拖动摆放：越靠近中心，对结果影响越大</span></div><div id="force-wrap">${forceSVG(r)}</div>
    <div class="legend"><span>${sym('self', 14)}我</span><span>${sym('friend', 14)}友方</span><span>${sym('hostile', 14)}对手</span><span>${sym('neutral', 14)}中立</span><span>${sym('unknown', 14)}环境 / 未知</span><span>图形大小 = 实力 · 沿用北约 APP-6 军标框形</span></div></section>
  <section class="block"><h2>行动者</h2><div class="rows">${actors}</div>
    <div class="card-f"><button class="btn sm" data-act="addActor">+ 加一方</button><span class="hint">点图形切换阵营，点圆点调实力。</span></div></section>
  <section class="vizbox"><div class="vh"><h3>地基图</h3><span class="hint">拖动摆放：横轴是把握，纵轴是这个决定有多依赖它</span></div><div id="ground-wrap">${groundSVG(r)}</div>
    <div class="legend"><span><i class="k-as"></i>假设</span><span><i class="k-fact"></i>事实</span><span>落在左上角的，是落子之前最该先验证的。</span></div></section>
  <section class="block"><h2>事实与假设</h2><div class="rows">${notes || ''}</div>
    <div class="card-f"><button class="btn sm" data-act="addNote" data-k="fact">+ 事实</button><button class="btn sm" data-act="addNote" data-k="assume">+ 假设</button></div></section>
  <section class="block">${busy ? busyLine('正在找你漏掉的东西…') : `<div class="card-f"><button class="btn ai" data-act="aiBoard">${SPARK}我漏了什么？</button><span class="hint">AI 会补上你没想到的行动者和隐含假设，由你决定要不要加。</span></div>`}${errLine('board')}${sugHTML}</section>`;
}
function refreshBoard() {
  const r = cur(); if (!r) return;
  const f = document.getElementById('force-wrap'); if (f) f.innerHTML = forceSVG(r);
  const g = document.getElementById('ground-wrap'); if (g) g.innerHTML = groundSVG(r);
}

/* ========== 复盘：实际路线与校准 ========== */
function reviewActualHTML(r, o) {
  const act = (r.review && r.review.actual) || {};
  const rows = o.nodes.map((n, i) => `<div class="actrow"><span class="mono faint">${i + 1}</span><span>${esc(n.text)} <span class="mono faint">预估 ${clampInt(n.p, 0, 100, 50)}%</span></span><div class="seg2"><button data-act="actual" data-id="${n.id}" data-v="up" aria-pressed="${act[n.id] === 'up'}">顺</button><button data-act="actual" data-id="${n.id}" data-v="down" aria-pressed="${act[n.id] === 'down'}">逆</button></div></div>`).join('');
  const known = o.nodes.filter(n => act[n.id]);
  let sum = '';
  if (known.length) {
    const brier = known.reduce((s, n) => s + Math.pow(clampInt(n.p, 0, 100, 50) / 100 - (act[n.id] === 'up' ? 1 : 0), 2), 0) / known.length;
    const score = known.length === o.nodes.length ? o.nodes.reduce((s, n) => s + (act[n.id] === 'up' ? clampInt(n.up, 0, 3, 0) : clampInt(n.down, -3, 0, 0)), 0) : null;
    sum = `<p class="small muted">${score !== null ? `实际走到 <b class="mono">${signed(score)}</b>。` : ''}这局 ${known.length} 个节点的概率预估，Brier 分数 <b class="mono">${brier.toFixed(2)}</b>（0 最准，0.25 相当于全报 50%）。</p>`;
  }
  return `<div class="block"><p class="lab">实际发生了什么？标出来，它会画在命运河上。</p><div class="rows">${rows}</div>${sum}</div>`;
}
function calibHTML(runs) {
  const pairs = [];
  for (const r of runs) {
    const act = r.review && r.review.actual; if (!act) continue;
    const o = r.options.find(x => x.id === r.choice.optionId); if (!o) continue;
    for (const n of o.nodes) if (act[n.id] === 'up' || act[n.id] === 'down') pairs.push([clampInt(n.p, 0, 100, 50) / 100, act[n.id] === 'up' ? 1 : 0]);
  }
  if (!pairs.length) return '';
  const brier = pairs.reduce((s, [p, y]) => s + (p - y) * (p - y), 0) / pairs.length;
  const bins = [0, 1, 2, 3, 4].map(b => { const xs = pairs.filter(([p]) => Math.min(4, Math.floor(p * 5)) === b); return xs.length ? {n: xs.length, p: xs.reduce((s, x) => s + x[0], 0) / xs.length, f: xs.reduce((s, x) => s + x[1], 0) / xs.length} : null; }).filter(Boolean);
  const S = 180, m = 28, X = v => m + v * (S - m - 8), Y = v => S - m - v * (S - m - 8);
  let g = `<line class="ax" x1="${m}" y1="${S - m}" x2="${S - 8}" y2="${S - m}"/><line class="ax" x1="${m}" y1="8" x2="${m}" y2="${S - m}"/><line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}"/>`;
  g += bins.map(b => `<circle class="cal" cx="${X(b.p).toFixed(1)}" cy="${Y(b.f).toFixed(1)}" r="${(3 + Math.min(b.n, 10) * 0.6).toFixed(1)}"><title>预估 ${pct(b.p)}，实际 ${pct(b.f)}（${b.n} 个节点）</title></circle>`).join('');
  g += `<text class="tk" x="${X(0)}" y="${S - m + 14}" text-anchor="middle">0</text><text class="tk" x="${X(1)}" y="${S - m + 14}" text-anchor="middle">100%</text><text class="tk" x="${X(0.5)}" y="${S - 4}" text-anchor="middle">你的预估</text><text class="tk" x="${m - 6}" y="${Y(1) + 4}" text-anchor="end">实际</text>`;
  return `<div class="calibv"><svg class="viz cal-svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="校准图：横轴是预估概率，纵轴是实际发生比例">${g}</svg><div><b>节点校准</b><p class="muted small">你复盘过 ${pairs.length} 个节点的概率预估。Brier 分数 <b class="mono">${brier.toFixed(2)}</b>，越低越准，全报 50% 是 0.25。点落在虚线下方，说明那一档你偏乐观；落在上方，说明偏保守。</p></div></div>`;
}

/* ========== 拖动 ========== */
let DRAG = null;
function svgPt(id, e) {
  const svg = document.getElementById(id); if (!svg || !svg.getScreenCTM) return null;
  const m = svg.getScreenCTM(); if (!m) return null; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return {p: pt.matrixTransform(m.inverse()), svg};
}
function dragMove(e) {
  const d = DRAG; const r = cur(); if (!d || !r) return;
  if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 4) d.moved = true;
  if (!d.moved && (d.kind === 'actor' || d.kind === 'note')) return;
  const q = svgPt(d.svg, e); if (!q) return; const P = q.p, ds = q.svg.dataset;
  if (d.kind === 'p') {
    const o = r.options.find(x => x.id === d.o); const n = o && o.nodes.find(x => x.id === d.n); if (!n) return;
    const v = clampInt((P.x - d.gx) / d.gw * 100, 1, 99, 50); if (v !== n.p) { n.p = v; delete UI.samples[o.id]; refreshPlay(); }
  } else if (d.kind === 'floor' || d.kind === 'floorx') {
    const lo = +ds.lo, hi = +ds.hi; let s;
    if (d.kind === 'floor') s = hi - (P.y - +ds.mt) / +ds.ph * (hi - lo); else s = lo + (P.x - +ds.x0) / +ds.pw * (hi - lo);
    const F = Math.max(lo + 0.5, Math.min(hi - 0.5, Math.round(s - 0.5) + 0.5));
    if (F !== floorOf(r)) { r.floor = F; refreshPlay(); }
  } else if (d.kind === 'actor') {
    const a = r.actors.find(x => x.id === d.id); if (!a) return;
    const cx = +ds.cx, cy = +ds.cy, R = ds.r.split(',').map(Number); const dx = P.x - cx, dy = P.y - cy; const dist = Math.hypot(dx, dy);
    a.ring = dist < (R[1] + R[2]) / 2 ? 1 : dist < (R[2] + R[3]) / 2 ? 2 : 3; a.angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
    refreshBoard();
  } else if (d.kind === 'note') {
    const n = r.notes.find(x => x.id === d.id); if (!n) return; const G = groundGeom();
    if (n.kind !== 'fact') n.conf = clampInt((P.x - G.ml) / G.pw * 100, 1, 99, 50);
    n.imp = clampInt((G.mt + G.ph - P.y) / G.ph * 100, 0, 100, 50);
    refreshBoard();
  }
}
document.addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('[data-drag]'); if (!t || !cur()) return;
  e.preventDefault();
  DRAG = {kind: t.dataset.drag, id: t.dataset.id, o: t.dataset.o, n: t.dataset.n, gx: +t.dataset.x, gw: +t.dataset.w, svg: t.dataset.svg, x0: e.clientX, y0: e.clientY, moved: false};
  if (DRAG.kind === 'p' || DRAG.kind === 'floor' || DRAG.kind === 'floorx') { DRAG.moved = true; dragMove(e); }
});
window.addEventListener('pointermove', e => { if (DRAG) { e.preventDefault(); dragMove(e); } }, {passive: false});
window.addEventListener('pointerup', () => {
  if (!DRAG) return; const d = DRAG; DRAG = null; const r = cur();
  if (!d.moved && d.kind === 'actor') { focusId(fid('run:actors.' + d.id + '.name')); return; }
  if (!d.moved && d.kind === 'note') { focusId(fid('run:notes.' + d.id + '.text')); return; }
  if (r) touched(r); doRender();
});
window.addEventListener('pointercancel', () => { if (DRAG) { DRAG = null; doRender(); } });

/* ========== 掷骰粒子 ========== */
function rollOnce(o) {
  const res = o.nodes.map(n => { const d = d100(); const p = clampInt(n.p, 0, 100, 50); const ok = d <= p; return {d, p, ok, txt: (ok ? n.good : n.bad) || n.text, s: ok ? clampInt(n.up, 0, 3, 0) : clampInt(n.down, -3, 0, 0)}; });
  const states = [0]; res.forEach(x => states.push(states[states.length - 1] + x.s));
  return {res, states, score: states[states.length - 1]};
}
function addSample(oid, score) { const sm = UI.samples[oid] || (UI.samples[oid] = {n: 0, c: {}}); sm.n++; sm.c[score] = (sm.c[score] || 0) + 1; }
function animateParticle(oid) {
  const svg = document.getElementById('rv-' + oid); const ro = UI.rolls[oid]; if (!svg || !ro) return;
  const xs = svg.dataset.xs.split(',').map(Number); const lo = +svg.dataset.lo, hi = +svg.dataset.hi, mt = +svg.dataset.mt, ph = +svg.dataset.ph;
  const Y = s => mt + (hi - s) / (hi - lo) * ph; const pts = ro.states.map((s, i) => [xs[i], Y(s)]);
  const pl = svg.querySelector('#rp-' + oid); const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '6'); c.setAttribute('class', 'particle'); svg.appendChild(c);
  const draw = (k) => { const i = Math.min(pts.length - 1, Math.floor(k)), f = k - i; const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)]; const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f; c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); if (pl) pl.setAttribute('points', pts.slice(0, i + 1).concat([[x, y]]).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')); };
  if (reduceMotion) { draw(pts.length - 1); return; }
  const t0 = performance.now(), seg = 280;
  const f = t => { const k = Math.min((t - t0) / seg, pts.length - 1); draw(k); if (k < pts.length - 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function revealRoll(oid) {
  animateParticle(oid);
  document.querySelectorAll(`#opt-${oid} .fr.pre`).forEach((el, i) => setTimeout(() => el.classList.remove('pre'), 160 + i * 280));
}

Object.assign(ACT, {
  roll(t) {
    const r = cur(); const o = r.options.find(x => x.id === t.dataset.id); if (!o || !o.nodes.length) return;
    const x = rollOnce(o); const F = floorOf(r);
    UI.rolls[o.id] = {res: x.res, states: x.states, score: x.score, breach: x.score < F, hist: []};
    addSample(o.id, x.score); UI.justRolled = o.id; doRender();
  },
  rollMany(t) {
    const r = cur(); const o = r.options.find(x => x.id === t.dataset.id); if (!o || !o.nodes.length) return;
    let x; for (let i = 0; i < 50; i++) { x = rollOnce(o); addSample(o.id, x.score); }
    UI.rolls[o.id] = {res: x.res, states: x.states, score: x.score, breach: x.score < floorOf(r), hist: []};
    doRender(); toast('又掷了 50 次。看结局分布里的虚线框：掷得越多，它越贴近柱子。');
  },
  torOpt(t) { UI.torOpt = t.dataset.id; doRender(); },
  power(t) { const r = cur(); const a = r.actors.find(x => x.id === t.dataset.id); if (!a) return; a.power = Number(t.dataset.v); touched(r); doRender(); },
  actual(t) { const r = cur(); r.review = Object.assign({}, r.review || {}); r.review.actual = Object.assign({}, r.review.actual || {}); const k = t.dataset.id; r.review.actual[k] = r.review.actual[k] === t.dataset.v ? undefined : t.dataset.v; if (!r.review.actual[k]) delete r.review.actual[k]; r.review.ts = Date.now(); touched(r); doRender(); }
});

let vzT; addEventListener('resize', () => { clearTimeout(vzT); vzT = setTimeout(() => { if (!composing && !document.activeElement.matches('input,textarea,select')) doRender(); }, 200); });

route();
