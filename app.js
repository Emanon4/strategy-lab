/* 战略推演 — 一个人做决定之前，先把未来推演一遍。
   纯静态页面：推演引擎在浏览器里运行；AI 用你自己的 API Key 直接调用服务商；数据只存在本地。 */
"use strict";

/* ========== helpers ========== */
const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const str = v => (v == null ? '' : String(v).trim());
const arr = v => (Array.isArray(v) ? v : []);
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => iso(new Date());
const plusDays = (n, from) => { const d = from ? new Date(from) : new Date(); d.setDate(d.getDate() + n); return iso(d); };
const fmtDate = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()); };
const fid = b => 'f-' + b.replace(/[^a-zA-Z0-9_-]/g, '-');
const d100 = () => { try { return (crypto.getRandomValues(new Uint32Array(1))[0] % 100) + 1; } catch (e) { return Math.floor(Math.random() * 100) + 1; } };
const LET = 'ABCD';
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n * 10) / 10);
const pct = x => Math.round(x * 100) + '%';
const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

/* ========== vocabulary ========== */
const SIDES = {
  self: {label: '我', c: 'blue'}, friend: {label: '友方', c: 'blue'}, hostile: {label: '对手', c: 'red'},
  neutral: {label: '中立', c: 'green'}, unknown: {label: '环境 / 未知', c: 'amber'}
};
const SIDE_ORDER = ['self', 'friend', 'hostile', 'neutral', 'unknown'];
function sym(side, size = 20) {
  const s = SIDES[side] || SIDES.unknown;
  const fill = side === 'self' ? `var(--${s.c})` : `var(--${s.c}-soft)`;
  let shape;
  if (side === 'self' || side === 'friend') shape = '<rect x="2" y="6" width="20" height="12"/>';
  else if (side === 'hostile') shape = '<path d="M12 2 22 12 12 22 2 12Z"/>';
  else if (side === 'neutral') shape = '<rect x="4" y="4" width="16" height="16"/>';
  else shape = '<path d="M7.5 7.5A4.5 4.5 0 0 1 16.5 7.5A4.5 4.5 0 0 1 16.5 16.5A4.5 4.5 0 0 1 7.5 16.5A4.5 4.5 0 0 1 7.5 7.5Z"/>';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="fill:${fill};stroke:var(--${s.c});stroke-width:1.7;flex:none">${shape}</svg>`;
}
const MARK = '<svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true"><rect x="1" y="4" width="15" height="10" fill="var(--blue)"/><path d="M23 2 29 9 23 16 17 9Z" fill="var(--red-soft)" stroke="var(--red)" stroke-width="1.6"/></svg>';
const SPARK = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0c.4 3.9 2.1 5.6 6 6-3.9.4-5.6 2.1-6 6-.4-3.9-2.1-5.6-6-6 3.9-.4 5.6-2.1 6-6Z"/><path d="M13 10.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" opacity=".6"/></svg>';
const GEAR = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>';
const STEPS = [
  {k: '一', name: '定题', brief: '写下问题，列出两到四条路，定好底线。', title: '定题', sub: '把要做的决定写成一个问题，列出你能走的几条路。'},
  {k: '二', name: '布局', brief: '摆出各方力量，分清事实和假设。', title: '布局', sub: '谁会影响结果？哪些是你确定的事实，哪些只是你的假设？'},
  {k: '三', name: '推演', brief: '每条路掷出它所有可能的未来。', title: '推演', sub: '每条路都会遇到几个关键节点。给每个节点定一个概率，引擎会算出这条路所有可能的未来。'},
  {k: '四', name: '落子', brief: '选一条路，先验尸，再设绊线。', title: '落子', sub: '选一条路。落子之前，先想好它会怎样失败，以及看到什么信号时该调头。'},
  {k: '五', name: '决策书', brief: '一页纸记下决定，到期回来复盘。', title: '决策书', sub: '把这次决定写成一页纸。到了复盘日回来看看：是推理对了，还是运气好。'}
];
const HORIZONS = ['3 个月', '半年', '1 年', '3 年'];

/* ========== storage ========== */
const LS = 'zhanlue-v1', LS_AI = 'zhanlue-ai', LS_SEEN = 'zhanlue-seen';
function loadDB() { try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o && Array.isArray(o.runs)) return o; } catch (e) {} return {runs: []}; }
let DB = loadDB();
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); }
function saveNow() { clearTimeout(saveT); try { localStorage.setItem(LS, JSON.stringify(DB)); } catch (e) { toast('浏览器存储写入失败。记得在设置里导出备份。'); } }
function loadAI() {
  const d = {provider: 'anthropic', key: '', model: 'claude-sonnet-5-5', base: '', oaModel: ''};
  try { return Object.assign(d, JSON.parse(localStorage.getItem(LS_AI) || '{}')); } catch (e) { return d; }
}
let AIS = loadAI();
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
function saveAI() { try { localStorage.setItem(LS_AI, JSON.stringify(AIS)); } catch (e) {} }
const aiReady = () => !!AIS.key && (AIS.provider === 'anthropic' || !!(AIS.base && AIS.oaModel));

/* ========== model ========== */
const newOpt = (label = '') => ({id: uid('o'), label, nodes: []});
function newRun() {
  const now = Date.now();
  return {
    id: uid('r'), ts: now, updated: now, step: 0,
    question: '', options: [newOpt(), newOpt()], horizon: '1 年', bottom: '', values: '',
    actors: [{id: uid('a'), name: '我', side: 'self', want: ''}], notes: [],
    choice: {optionId: null, why: '', premortem: '', tripwires: [], first: '', conf: 60, reviewDate: ''},
    decidedAt: null, review: null
  };
}
function norm(r) {
  r.options = arr(r.options); r.options.forEach(o => { o.nodes = arr(o.nodes); });
  r.actors = arr(r.actors); r.notes = arr(r.notes);
  r.choice = Object.assign({optionId: null, why: '', premortem: '', tripwires: [], first: '', conf: 60, reviewDate: ''}, r.choice || {});
  r.choice.tripwires = arr(r.choice.tripwires);
  if (r.choice.optionId && !r.options.some(o => o.id === r.choice.optionId)) r.choice.optionId = null;
  return r;
}
const getRun = id => { const r = DB.runs.find(x => x.id === id); return r ? norm(r) : null; };
const optLetter = (r, o) => LET[r.options.indexOf(o)] || '?';
function touched(r) { r.updated = Date.now(); save(); }
function runStatus(r) {
  if (r.review && r.review.outcome) return ['reviewed', '已复盘'];
  if (r.choice.optionId) return r.choice.reviewDate && r.choice.reviewDate <= todayISO() ? ['due', '待复盘'] : ['decided', '已落子'];
  if (r.options.some(o => o.nodes.length)) return ['', '推演中'];
  return ['', '定题中'];
}
function stepDone(r, i) {
  if (i === 0) return !!r.question && r.options.filter(o => o.label).length >= 2;
  if (i === 1) return r.actors.filter(a => a.name).length >= 2 || r.notes.some(n => n.text);
  if (i === 2) { const os = r.options.filter(o => o.label); return os.length > 0 && os.every(o => o.nodes.length); }
  if (i === 3) return !!r.choice.optionId;
  return !!(r.review && r.review.outcome);
}

/* ========== AI ========== */
const UI = {view: 'home', runId: null, busy: null, err: {}, sug: {}, editing: {}, rolls: {}, justRolled: null, drawer: false, drawerMsg: '', confirm: null, aiTest: ''};
function parseJSON(t) {
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) { try { return JSON.parse(m[1]); } catch (e) {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
async function callAI(prompt, signal, maxTokens = 4096) {
  if (!aiReady()) throw {code: 'nokey'};
  let res;
  if (AIS.provider === 'anthropic') {
    const base = (AIS.base || 'https://api.anthropic.com').replace(/\/+$/, '');
    res = await fetch(base + '/v1/messages', {
      method: 'POST', signal,
      headers: {'content-type': 'application/json', 'x-api-key': AIS.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'},
      body: JSON.stringify({model: AIS.model || 'claude-sonnet-5-5', max_tokens: maxTokens, messages: [{role: 'user', content: prompt}]})
    });
    if (!res.ok) throw {code: 'http', status: res.status, body: await res.text().catch(() => '')};
    const data = await res.json();
    return arr(data.content).filter(c => c.type === 'text').map(c => c.text).join('');
  }
  const base = AIS.base.replace(/\/+$/, '');
  res = await fetch(base + '/chat/completions', {
    method: 'POST', signal,
    headers: {'content-type': 'application/json', 'authorization': 'Bearer ' + AIS.key},
    body: JSON.stringify({model: AIS.oaModel, temperature: 0.7, max_tokens: maxTokens, messages: [{role: 'system', content: '你是严谨的决策顾问。只输出用户要求的 JSON，不要任何额外文字。'}, {role: 'user', content: prompt}]})
  });
  if (!res.ok) throw {code: 'http', status: res.status, body: await res.text().catch(() => '')};
  const data = await res.json();
  return str(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
}
function aiErrText(e) {
  if (!e) return '出了点问题，再试一次。';
  if (e.code === 'nokey') return '还没有连接 AI。';
  if (e.code === 'json') return 'AI 的回复格式不对，再试一次。';
  if (e.code === 'http') {
    if (e.status === 401 || e.status === 403) return 'API Key 无效，或没有权限使用这个模型。去设置里检查一下。';
    if (e.status === 404) return '接口地址或模型名不对。去设置里检查一下。';
    if (e.status === 429) return '请求太频繁或额度用完了，稍后再试。';
    if (e.status === 529 || e.status === 503) return 'AI 服务正忙，稍后再试。';
    return `AI 服务返回了错误（${e.status}）。`;
  }
  return '连不上 AI 服务。检查网络能否访问它，或在设置里换一个接口地址。';
}
async function askJSON(kind, prompt, maxTokens) {
  if (UI.busy) { toast('上一个请求还没结束。'); return null; }
  if (!aiReady()) { openDrawer('先连接一个 AI 服务。Key 只保存在这个浏览器里。'); return null; }
  const ctl = new AbortController(); UI.busy = {kind, ctl}; UI.err[kind] = ''; doRender();
  try {
    const t = await callAI(prompt, ctl.signal, maxTokens);
    const v = parseJSON(t); if (!v || typeof v !== 'object') throw {code: 'json'};
    return v;
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    UI.err[kind] = aiErrText(e); return null;
  } finally { UI.busy = null; doRender(); }
}
function brief(r, withNodes = false) {
  const L = [];
  L.push('【问题】' + (r.question || '（未写）'));
  L.push('【推演期限】' + (r.horizon || '1 年') + '；今天是 ' + todayISO());
  if (r.bottom) L.push('【底线，绝不能发生】' + r.bottom);
  if (r.values) L.push('【他最在乎的】' + r.values);
  L.push('【选项】');
  r.options.forEach((o, i) => { if (o.label) L.push(`${LET[i]}. ${o.label}（id: ${o.id}）`); });
  const as = r.actors.filter(a => a.name);
  if (as.length) { L.push('【行动者】'); as.forEach(a => L.push(`- ${a.name}（${SIDES[a.side].label}）：${a.want || '想要什么未写'}`)); }
  const ns = r.notes.filter(n => n.text);
  if (ns.length) { L.push('【事实与假设】'); ns.forEach(n => L.push(`- ${n.kind === 'fact' ? '事实' : '假设（他的把握 ' + clampInt(n.conf, 0, 100, 50) + '%）'}：${n.text}`)); }
  if (withNodes) r.options.forEach((o, i) => { if (!o.nodes.length) return; L.push(`【${LET[i]} 的关键节点】`); o.nodes.forEach(n => L.push(`- ${n.actor ? n.actor + '：' : ''}${n.text}｜有利概率 ${n.p}%｜有利：${n.good}（${signed(n.up)}）｜不利：${n.bad}（${signed(n.down)}）${n.breach ? '｜不利时触底线' : ''}`)); });
  return L.join('\n');
}
const PROMPT = {
  frame: r => `你是一位冷静的决策顾问。一个人正在面对下面这个决定，请帮他把问题问对，并拓宽选项。

${brief(r)}

请做三件事：
1. 如果问题问得太窄、太含糊，或者没问到真正要决定的事，给出一个更好的问法；如果已经很好，原样返回。
2. 补充 1 到 3 个他没想到、但真实可行的选项。常见的盲点：维持现状、先小规模试一段、把两个选项组合起来、找人一起做、先花一点代价买到关键信息再决定。不要和已有选项重复。
3. 判断这个决定是「单向门」（很难撤回）还是「双向门」（可以撤回重来），用一句话说明。

只回复一个 JSON 对象：
{"question":"<问题>","why":"<为什么这样问更好；没改动就写空字符串>","options":["<补充的选项>"],"door":"<单向门 或 双向门>","doorWhy":"<一句话>"}`,
  board: r => `你是一位冷静的决策顾问。看看下面这个决定的局面，帮他找出漏掉的东西。

${brief(r)}

请补充：
1. 他还没写、但会实质影响结果的行动者：人、组织，也可以是平台、市场、时间、身体状况这样的力量。最多 4 个。
2. 他可能默认了、但从没验证过的隐含假设。最多 4 条，每条写成一句可以被证伪的判断。
不要重复他已经写的内容。side 只能是 friend（友方）、hostile（对手或竞争者）、neutral（中立）、unknown（环境力量或未知）。

只回复一个 JSON 对象：
{"actors":[{"name":"<名称>","side":"<friend|hostile|neutral|unknown>","want":"<他想要什么，一句>"}],"assumptions":["<隐含假设>"]}`,
  sim: r => `你在主持一场「战略推演」：为一个人的每个选项推演未来。你同时扮演他以外的各方和裁判，不迎合他。

${brief(r)}

规则：
1. 为每个选项写 3 到 4 个「关键节点」：在推演期限内、按时间顺序，最能左右结果的不确定事件。节点要具体、可观察，最好写清是谁的反应（从行动者里挑，也可以是环境力量）。
2. p：这个节点朝对他有利方向发展的概率，0 到 100 的整数。先想同类事情的基础比率，再按局面调整，警惕乐观偏差。
3. good、bad：有利和不利时分别会发生什么，各一句，具体。
4. up：有利时对他最在乎的东西的影响，0 到 3 的整数。down：不利时的影响，-3 到 0 的整数。所有选项用同一把尺子。
5. breach：只有当「不利」结果会让他碰到底线时才写 true，否则写 false。
6. 「维持现状」或保守的选项也有风险和代价，同样认真推演。

只回复一个 JSON 对象，options 里每项的 id 照抄上面的选项 id：
{"options":[{"id":"<选项 id>","nodes":[{"actor":"<谁>","text":"<节点：会发生什么不确定的事>","p":<整数>,"good":"<有利时>","bad":"<不利时>","up":<0-3>,"down":<-3-0>,"breach":<true|false>}]}]}`,
  red: (r, o) => `他准备选择「${o.label}」。你是红队：在他落子之前，找出这个选择最可能失败的方式，并帮他提前设好绊线。

${brief(r, true)}

他选择的理由：${r.choice.why || '（未写）'}

只回复一个 JSON 对象：
{"premortem":["<假设一年后回头看它失败了，最可能的原因，具体到事>"],"tripwires":[{"see":"<可以观察到的信号>","do":"<看到信号时预先想好的动作>"}],"first":"<48 小时内可以做的、能撤回的第一步>"}
premortem 2 到 3 条，tripwires 2 到 3 条。`
};

/* ========== sample run (generic, safe to ship publicly) ========== */
function sampleRun() {
  const now = Date.now();
  const A = newOpt('辞职，全职做一年'), B = newOpt('保留工作，每周拿出两个整天来做'), C = newOpt('申请半年停薪留职，先试一段');
  const N = (actor, text, p, good, bad, up, down, breach = false) => ({id: uid('n'), actor, text, p, good, bad, up, down, breach});
  A.nodes = [
    N('用户', '前 3 个月做出能用的版本，拿到第一批真实用户', 55, '有了 200 个真实用户，方向被验证', '做出来没人用，开始怀疑方向', 2, -2),
    N('我', '全职之后能保持每天 6 小时的有效产出', 50, '节奏稳定，进度是上班时的三倍', '失去外部节奏，拖延和焦虑交替', 1, -2),
    N('现金', '第 9 个月前，收入能覆盖一半开支', 25, '收入覆盖一半开支，可以继续', '存款逼近底线，只能回去上班', 3, -3, true)
  ];
  B.nodes = [
    N('我', '下班和周末能守住每周两个整天', 45, '稳定推进', '加班挤占时间，项目断断续续', 1, -1),
    N('用户', '半年内做出能用的版本，拿到第一批用户', 35, '有了第一批用户', '进度太慢，机会被别人先占了', 2, -2),
    N('现雇主', '主业不受影响，没人觉得我心不在焉', 75, '两边都稳', '考评下滑，主业也受影响', 0, -1)
  ];
  C.nodes = [
    N('现雇主', '公司批准半年停薪留职', 40, '拿到半年整块时间，退路还在', '不批，只能在 A 和 B 之间重新选', 2, -1),
    N('用户', '半年内拿到第一批真实用户', 50, '有了第一批付费用户', '半年过去，只有零星反馈', 2, -1),
    N('我', '半年到期时，手上有足够的证据决定去留', 60, '用数据而不是情绪做下一个决定', '证据模糊，又一次只能靠感觉', 1, -1)
  ];
  return {
    id: 'sample', sample: true, ts: now, updated: now - 1000, step: 4,
    question: '要不要辞掉稳定的工作，用一年时间全职做自己的项目？',
    options: [A, B, C], floor: -2.5, horizon: '1 年', bottom: '存款不能低于 6 个月生活费', values: '长期能做自己想做的事；收入不能断',
    actors: [
      {id: uid('a'), name: '我', side: 'self', want: '把项目做成，证明这条路走得通'},
      {id: uid('a'), name: '家人', side: 'friend', want: '希望我生活稳定，不冒太大风险', ring: 2, angle: 180, power: 2},
      {id: uid('a'), name: '现雇主', side: 'neutral', want: '不想失去一个熟手', ring: 1, angle: -40, power: 3},
      {id: uid('a'), name: '同类项目', side: 'hostile', want: '抢同一批用户', ring: 3, angle: 20, power: 2},
      {id: uid('a'), name: '用户', side: 'unknown', want: '只为真正解决问题的东西付钱', ring: 1, angle: 120, power: 3}
    ],
    notes: [
      {id: uid('s'), kind: 'fact', text: '现有存款够 10 个月生活费', conf: 100, imp: 70},
      {id: uid('s'), kind: 'assume', text: '项目半年内能有第一批付费用户', conf: 40, imp: 88},
      {id: uid('s'), kind: 'assume', text: '辞职之后效率会翻倍', conf: 35, imp: 62},
      {id: uid('s'), kind: 'assume', text: '想回去上班时，还能找到同等的工作', conf: 70, imp: 80}
    ],
    choice: {
      optionId: C.id,
      why: '它保留了退路，又能换来半年整块时间。期望不是最高，但触底线的概率是零，而且半年后能用证据而不是情绪做下一个决定。',
      premortem: '公司不批，我在情绪上已经回不去了，于是仓促辞职。\n半年里把时间花在打磨产品上，没去找用户，到期时证据还是一片模糊。',
      tripwires: [
        {id: uid('t'), see: '公司明确拒绝停薪留职', do: '不当场辞职，先按 B 的方式做三个月再重新推演'},
        {id: uid('t'), see: '第 3 个月还没有 20 个真实用户', do: '停止加功能，把一半时间用在找用户上'}
      ],
      first: '这周约直属上级聊一次，只探口风，不提交申请。', conf: 65, reviewDate: plusDays(182, now)
    },
    decidedAt: now, review: null
  };
}
try {
  if (!localStorage.getItem(LS_SEEN)) { DB.runs.push(sampleRun()); localStorage.setItem(LS_SEEN, '1'); saveNow(); }
} catch (e) { if (!DB.runs.length) DB.runs.push(sampleRun()); }

/* ========== routing ========== */
function parseRoute() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  if (p[0] === 'run' && p[1] && getRun(p[1])) return {view: 'run', id: p[1], step: p[2] != null && p[2] !== '' ? clampInt(p[2], 0, 4, 0) : null};
  return {view: 'home'};
}
function route() {
  const rt = parseRoute(); UI.view = rt.view; UI.confirm = null;
  if (rt.view === 'run') { UI.runId = rt.id; const r = getRun(rt.id); if (rt.step != null && r.step !== rt.step) { r.step = rt.step; save(); } }
  doRender(); window.scrollTo(0, 0);
  if (UI.focusAfter) { const id = UI.focusAfter; UI.focusAfter = null; focusId(id); }
}
function go(h) { if (location.hash === h) route(); else location.hash = h; }
window.addEventListener('hashchange', route);

/* ========== views ========== */
const ta = (bind, val, o = {}) => `<textarea id="${fid(bind)}" data-bind="${bind}" rows="${o.rows || 1}" class="${o.cls || 'field'} auto"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}>${esc(val)}</textarea>`;
const inp = (bind, val, o = {}) => `<input id="${fid(bind)}" data-bind="${bind}" class="${o.cls || 'field'}" value="${esc(val)}"${o.type ? ` type="${o.type}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.num ? ' data-type="num"' : ''}${o.re ? ' data-rerender="1"' : ''}${o.extra || ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}>`;
const busyLine = msg => `<div class="busy" role="status"><span class="pulse" aria-hidden="true"></span><span>${esc(msg)}</span><button class="btn sm ghost" data-act="stop">停止</button></div>`;
const errLine = k => (UI.err[k] ? `<p class="err" role="alert">${esc(UI.err[k])} <button class="link" data-act="drawer">打开设置</button></p>` : '');

function topBar() {
  const ai = aiReady() ? `<span class="dot on"></span>AI · ${AIS.provider === 'anthropic' ? 'Claude' : esc(AIS.oaModel || '已连接')}` : '<span class="dot off"></span>连接 AI';
  return `<header class="wrap top"><a class="brand" href="#/">${MARK}<span>战略推演</span></a><span class="sp"></span><button class="chip" data-act="drawer">${ai}</button><button class="iconbtn" data-act="drawer" aria-label="设置">${GEAR}</button></header>`;
}
function homeView() {
  const runs = DB.runs.map(norm).sort((a, b) => b.updated - a.updated);
  const items = runs.map(r => {
    const [cls, label] = runStatus(r); const o = r.options.find(x => x.id === r.choice.optionId);
    const confirm = UI.confirm === 'del:' + r.id;
    return `<div class="item" data-act="open" data-id="${r.id}" role="link" tabindex="0">
      <div><h3>${esc(r.question || '未命名的推演')}</h3>
        <div class="meta"><span class="badge ${cls}">${label}</span>${r.sample ? '<span class="badge sample">示例</span>' : ''}<span class="mono">${fmtDate(r.updated)}</span>${o ? `<span>选了 ${optLetter(r, o)}：${esc(o.label)}</span>` : `<span>${r.options.filter(x => x.label).length} 个选项</span>`}</div></div>
      <div class="mini">${miniDist(r, o || r.options.find(x => x.nodes.length), 200)}</div>
      ${confirm ? `<span class="pills"><button class="btn sm danger" data-act="del" data-id="${r.id}">确认删除</button><button class="btn sm ghost" data-act="cancel">取消</button></span>` : `<button class="x" data-act="askDel" data-id="${r.id}" aria-label="删除这局推演">×</button>`}
    </div>`;
  }).join('');
  const rev = runs.filter(r => r.review && r.review.outcome);
  let calib = '';
  if (rev.length) {
    const goodDec = rev.filter(r => r.review.process === 'solid').length;
    const conf = rev.reduce((s, r) => s + clampInt(r.choice.conf, 0, 100, 60), 0) / rev.length;
    const goodOut = rev.filter(r => r.review.outcome === 'good').length / rev.length;
    calib = `<div class="calib"><b>你复盘过 ${rev.length} 个决定</b><span class="muted">其中 ${goodDec} 个推理扎实。落子时你平均有 <span class="mono">${Math.round(conf)}%</span> 的把握，实际结果令你满意的比例是 <span class="mono">${pct(goodOut)}</span>${Math.abs(conf / 100 - goodOut) > 0.15 && rev.length >= 3 ? (conf / 100 > goodOut ? '：你倾向于过度自信。' : '：你比自己以为的更准。') : '。'}</span></div>`;
  }
  return `${topBar()}<main class="wrap">
    <div class="hero-wrap"><section class="hero">
      <h1>做决定之前，<br>先把未来推演一遍。</h1>
      <p>列出你能走的几条路，摆好棋盘，让每条路掷出它所有可能的未来。你会看清哪条路最好，也会看清哪条路会碰到你的底线。</p>
      <div class="row"><button class="btn primary lg" data-act="newRun">开始一局推演</button>${runs.some(r => r.sample) ? '<button class="btn ghost" data-act="open" data-id="sample">看看示例</button>' : ''}</div>
    </section>${heroHTML()}</div>
    ${flowHTML()}
    <div class="sec-h"><h2>推演档案</h2><span class="faint small">${runs.length} 局</span></div>
    <div class="list">${items || '<div class="empty">还没有推演。下次要做决定的时候，来这里跑一遍。</div>'}</div>
    ${calib}${calibHTML(runs)}
    <a class="altcard" href="sandbox/">
      <div><span class="faint small">另一种用法</span><h3>长期沙盘</h3><p>不为某一个决定，而是长期推演你的整体局面：一回合代表一个季度，AI 扮演各方出牌，D100 骰子定结果；还有案例训练场和预测校准簿。</p></div>
      <span class="go">打开 →</span>
    </a>
    <footer class="foot"><span>数据只保存在这个浏览器里，不会上传到任何服务器。</span><button class="link" data-act="drawer">导出备份 / AI 设置</button></footer>
  </main>`;
}

function runView(r) {
  const s = clampInt(r.step, 0, 4, 0);
  const rail = `<nav class="rail" aria-label="步骤"><a class="back link" href="#/">← 推演档案</a>${STEPS.map((st, i) => `<button class="${stepDone(r, i) ? 'done' : ''}" data-act="step" data-n="${i}"${i === s ? ' aria-current="step"' : ''}><span class="n">${stepDone(r, i) && i !== s ? '✓' : st.k}</span><span>${st.name}</span></button>`).join('')}</nav>`;
  const body = [stepFrame, stepBoard, stepPlay, stepChoose, stepDoc][s](r);
  return `${topBar()}<div class="wrap run">${rail}<main class="stage">
    ${r.sample ? '<p class="callout no-print">这是一局示例推演。可以随意修改、掷骰，或者直接开始你自己的。</p>' : ''}
    <header class="st-h"><span class="k">第${STEPS[s].k}步</span><h1>${STEPS[s].title}</h1><p>${STEPS[s].sub}</p></header>
    ${body}
    <div class="nav no-print">${s > 0 ? `<button class="btn ghost" data-act="step" data-n="${s - 1}">← ${STEPS[s - 1].name}</button>` : '<a class="btn ghost" href="#/">← 档案</a>'}${s < 4 ? `<button class="btn primary" data-act="step" data-n="${s + 1}">下一步：${STEPS[s + 1].name} →</button>` : '<a class="btn primary" href="#/">回到档案</a>'}</div>
  </main></div>`;
}

function sideOfActor(r, name) {
  const n = str(name); if (!n) return 'unknown';
  const a = r.actors.find(a => a.name && (a.name === n || n.includes(a.name) || a.name.includes(n)));
  return a ? a.side : 'unknown';
}

function stepChoose(r) {
  const os = r.options.filter(o => o.label);
  const choices = os.map(o => `<button class="choice" role="radio" aria-checked="${r.choice.optionId === o.id}" data-act="choose" data-id="${o.id}">
    <span class="radio" aria-hidden="true"></span><span class="let">${optLetter(r, o)}</span>
    <span><span class="t" style="display:block">${esc(o.label)}</span>${o.nodes.length ? miniDist(r, o, 320) + statsHTML(r, o) : '<span class="hint">还没推演</span>'}</span>
  </button>`).join('');
  const o = r.options.find(x => x.id === r.choice.optionId);
  if (!o) return `<section class="block"><h2>你选哪一条</h2><div class="choices" role="radiogroup">${choices}</div></section>`;
  const sug = UI.sug.red && UI.sug.red.rid === r.id && UI.sug.red.oid === o.id ? UI.sug.red : null;
  const busy = UI.busy && UI.busy.kind === 'red';
  const trips = r.choice.tripwires.map(t => `<div class="trip"><span>如果看到</span>${inp('run:choice.tripwires.' + t.id + '.see', t.see, {ph: '一个可以观察到的信号', label: '信号'})}<span class="do-l">我就</span><div class="do">${inp('run:choice.tripwires.' + t.id + '.do', t.do, {ph: '预先想好的动作', label: '动作'})}</div><button class="x" data-act="delTrip" data-id="${t.id}" aria-label="删除">×</button><select class="field tsel" id="${fid('run:choice.tripwires.' + t.id + '.nodeId')}" data-bind="run:choice.tripwires.${t.id}.nodeId" data-rerender="1" aria-label="挂在哪个节点上"><option value="">挂在哪个节点上…</option>${o.nodes.map((n, i) => `<option value="${n.id}"${t.nodeId === n.id ? ' selected' : ''}>节点 ${i + 1}：${esc(n.text)}</option>`).join('')}</select></div>`).join('');
  let sugHTML = '';
  if (sug) {
    sugHTML = `<div class="sug"><h3>${SPARK}红队的意见</h3>
      ${sug.premortem.length ? `<div><p class="lab">它最可能这样失败</p><div class="adds">${sug.premortem.map((t, i) => `<button class="add${sug.usedP[i] ? ' used' : ''}" data-act="addSugPm" data-i="${i}"${sug.usedP[i] ? ' disabled' : ''}>${sug.usedP[i] ? '已写入' : '+'} ${esc(t)}</button>`).join('')}</div></div>` : ''}
      ${sug.tripwires.length ? `<div><p class="lab">建议的绊线</p><div class="adds">${sug.tripwires.map((t, i) => `<button class="add${sug.usedT[i] ? ' used' : ''}" data-act="addSugTrip" data-i="${i}"${sug.usedT[i] ? ' disabled' : ''}>${sug.usedT[i] ? '已加入' : '+'} 如果看到${esc(t.see)}，我就${esc(t.do)}</button>`).join('')}</div></div>` : ''}
      ${sug.first ? `<div><p class="lab">第一步</p><div class="adds"><button class="add${sug.usedF ? ' used' : ''}" data-act="addSugFirst"${sug.usedF ? ' disabled' : ''}>${sug.usedF ? '已采用' : '+'} ${esc(sug.first)}</button></div></div>` : ''}
    </div>`;
  }
  return `<section class="block"><h2>你选哪一条</h2><div class="choices" role="radiogroup">${choices}</div></section>
  ${o.nodes.length ? `<section class="vizbox"><div class="vh"><h3>你选的路</h3><span class="hint">绊线挂到节点上，会画成河上的闸门</span></div>${riverSVG(r, o, {gates: gatesOf(r, o)})}</section>` : ''}
  <section class="block"><label class="lab" for="${fid('run:choice.why')}">为什么是它</label>${ta('run:choice.why', r.choice.why, {rows: 2, ph: '你最看重它的哪一点？你愿意接受它的哪些代价？'})}</section>
  <section class="block"><h2>事前验尸</h2><p class="hint">假设一年后回头看，这个决定失败了。最可能是因为什么？</p>${ta('run:choice.premortem', r.choice.premortem, {rows: 3, ph: '它失败，是因为……'})}
    ${busy ? busyLine('红队在找漏洞…') : `<div class="card-f"><button class="btn ai" data-act="aiRed">${SPARK}请红队来攻击这个选择</button></div>`}${errLine('red')}${sugHTML}</section>
  <section class="block"><h2>绊线</h2><p class="hint">提前写好：看到什么信号，就调整或调头。到时候不用再跟自己争论。</p><div class="rows">${trips}</div><div class="card-f"><button class="btn sm" data-act="addTrip">+ 加一条绊线</button></div></section>
  <section class="grid2">
    <div><label class="lab" for="${fid('run:choice.first')}">第一步：48 小时内、能撤回的小动作</label>${inp('run:choice.first', r.choice.first, {ph: '例如：约一个关键的人聊一次'})}</div>
    <div><label class="lab" for="${fid('run:choice.reviewDate')}">复盘日</label>${inp('run:choice.reviewDate', r.choice.reviewDate, {type: 'date', label: '复盘日'})}</div>
  </section>
  <section class="block"><label class="lab" for="${fid('run:choice.conf')}">这个选择会让你满意的把握</label><div class="rangebox"><input type="range" min="1" max="99" id="${fid('run:choice.conf')}" data-bind="run:choice.conf" data-type="num" data-out="out-conf" value="${clampInt(r.choice.conf, 1, 99, 60)}"><output id="out-conf">${clampInt(r.choice.conf, 1, 99, 60)}%</output></div></section>`;
}

function docText(r) {
  const o = r.options.find(x => x.id === r.choice.optionId); if (!o) return '';
  const st = stats(o, floorOf(r)); const L = [];
  L.push(`战略推演 · 决策书（${fmtDate(r.decidedAt || r.updated)}）`, '');
  L.push('问题：' + r.question);
  L.push(`我的选择：${optLetter(r, o)}. ${o.label}`);
  if (r.choice.why) L.push('为什么：' + r.choice.why);
  if (st) L.push(`推演：期望 ${signed(st.ev)}，好结局 ${pct(st.good)}，触底 ${pct(st.br)}`);
  r.options.filter(x => x !== o && x.label).forEach(x => { const s = stats(x, floorOf(r)); L.push(`　对比 ${optLetter(r, x)}. ${x.label}${s ? `：期望 ${signed(s.ev)}，好结局 ${pct(s.good)}，触底线 ${pct(s.br)}` : ''}`); });
  const as = r.notes.filter(n => n.kind === 'assume' && n.text);
  if (as.length) { L.push('', '我在赌的假设：'); as.forEach(n => L.push(`- ${n.text}（把握 ${n.conf}%）`)); }
  if (r.choice.premortem) { L.push('', '它可能这样失败：'); r.choice.premortem.split('\n').filter(Boolean).forEach(t => L.push('- ' + t)); }
  const ts = r.choice.tripwires.filter(t => t.see || t.do);
  if (ts.length) { L.push('', '绊线：'); ts.forEach(t => L.push(`- 如果看到${t.see}，我就${t.do}`)); }
  if (r.choice.first) L.push('', '第一步：' + r.choice.first);
  L.push('', `信心 ${r.choice.conf}% · 复盘日 ${r.choice.reviewDate || '未定'}`);
  return L.join('\n');
}
function stepDoc(r) {
  const o = r.options.find(x => x.id === r.choice.optionId);
  if (!o) return `<section class="block"><p class="muted">还没有落子。回到「落子」选一条路，这里就会生成你的决策书。</p><div><button class="btn" data-act="step" data-n="3">去落子</button></div></section>`;
  const F = floorOf(r); const st = stats(o, F);
  const as = r.notes.filter(n => n.kind === 'assume' && n.text);
  const pm = r.choice.premortem.split('\n').map(str).filter(Boolean);
  const ts = r.choice.tripwires.filter(t => t.see || t.do);
  const cmp = r.options.filter(x => x.label).map(x => { const s = stats(x, F); return `<tr class="${x === o ? 'me' : ''}"><td>${optLetter(r, x)}</td><td>${esc(x.label)}</td><td class="n">${s ? signed(s.ev) : '—'}</td><td class="n">${s ? pct(s.good) : '—'}</td><td class="n" style="${s && s.br > 0.0005 ? 'color:var(--red)' : ''}">${s ? pct(s.br) : '—'}</td></tr>`; }).join('');
  const due = r.choice.reviewDate && r.choice.reviewDate <= todayISO();
  const rv = r.review || {};
  const cell = (out, proc, title, desc) => `<div class="c${rv.outcome === out && rv.process === proc ? ' on' : ''}"><b>${title}</b>${desc}</div>`;
  return `<article class="doc">
    <div class="doc-h"><span class="ttl">决策书</span><span class="meta">战略推演<br>${fmtDate(r.decidedAt || r.updated)}</span></div>
    <div class="sec"><span>问题</span><div class="q">${esc(r.question)}</div></div>
    <div class="sec"><span>我的选择</span><div><div class="big">${optLetter(r, o)}. ${esc(o.label)}</div>${r.choice.why ? `<p class="muted" style="margin-top:6px">${esc(r.choice.why)}</p>` : ''}</div></div>
    ${st ? `<div class="sec"><span>推演</span><div style="display:grid;gap:10px;min-width:0">${riverSVG(r, o, {actual: (r.review || {}).actual, gates: gatesOf(r, o), w: Math.min(vizW(), 560)})}<div style="overflow-x:auto"><table class="cmp"><tr class="faint"><td></td><td>选项</td><td class="n">期望</td><td class="n">好结局</td><td class="n">触底</td></tr>${cmp}</table></div></div></div>` : ''}
    ${as.length ? `<div class="sec"><span>我在赌的</span><ul>${as.map(n => `<li>${esc(n.text)} <span class="mono faint">${n.conf}%</span></li>`).join('')}</ul></div>` : ''}
    ${pm.length ? `<div class="sec"><span>可能的败因</span><ul>${pm.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    ${ts.length ? `<div class="sec"><span>绊线</span><ul>${ts.map(t => `<li>如果看到<b>${esc(t.see)}</b>，我就${esc(t.do)}</li>`).join('')}</ul></div>` : ''}
    ${r.choice.first ? `<div class="sec"><span>第一步</span><div>${esc(r.choice.first)}</div></div>` : ''}
    <div class="doc-f"><span>信心 ${r.choice.conf}%</span><span>复盘日 ${esc(r.choice.reviewDate || '未定')}</span></div>
  </article>
  <div class="card-f no-print"><button class="btn" data-act="copyDoc">复制全文</button><button class="btn ghost" data-act="print">打印 / 存为 PDF</button></div>
  <section class="block no-print">
    <h2>复盘</h2>
    ${due && !rv.outcome ? '<div class="callout">复盘日到了。回头看看：结果怎样？当时的推理站得住吗？</div>' : `<p class="hint">到了复盘日回来填。也可以随时提前复盘。</p>`}
    <div class="grid2">
      <div><p class="lab">结果怎样</p><div class="seg2"><button data-act="rv" data-f="outcome" data-v="good" aria-pressed="${rv.outcome === 'good'}">令我满意</button><button data-act="rv" data-f="outcome" data-v="bad" aria-pressed="${rv.outcome === 'bad'}">不满意</button></div></div>
      <div><p class="lab">回头看，当时的推理</p><div class="seg2"><button data-act="rv" data-f="process" data-v="solid" aria-pressed="${rv.process === 'solid'}">站得住</button><button data-act="rv" data-f="process" data-v="sloppy" aria-pressed="${rv.process === 'sloppy'}">有明显漏洞</button></div></div>
    </div>
    ${reviewActualHTML(r, o)}
    <div class="matrix"><span></span><span class="h">结果满意</span><span class="h">结果不满意</span>
      <span class="h">推理站得住</span>${cell('good', 'solid', '应得的成功', '推理和结果一致。')}${cell('bad', 'solid', '运气不好', '决定本身没错，不必自责。')}
      <span class="h">推理有漏洞</span>${cell('good', 'sloppy', '侥幸', '结果好，但别当成本事。')}${cell('bad', 'sloppy', '该学的一课', '找出漏洞，下次补上。')}
    </div>
    <label class="lab" for="${fid('run:review.learned')}">学到了什么</label>${ta('run:review.learned', rv.learned || '', {rows: 2, ph: '哪个假设错了？哪条绊线该早点触发？'})}
  </section>`;
}

function drawerView() {
  if (!UI.drawer) return '';
  const ant = AIS.provider === 'anthropic';
  return `<div class="scrim" data-act="closeDrawer"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="设置">
    <div class="drawer-h"><h2>设置</h2><button class="x" data-act="closeDrawer" aria-label="关闭">×</button></div>
    ${UI.drawerMsg ? `<div class="callout">${esc(UI.drawerMsg)}</div>` : ''}
    <section><h3>AI 服务</h3>
      <div class="seg2" role="group"><button data-act="provider" data-v="anthropic" aria-pressed="${ant}">Claude 官方 API</button><button data-act="provider" data-v="openai" aria-pressed="${!ant}">OpenAI 兼容接口</button></div>
      <div><label class="lab" for="ai-key">API Key</label><div class="keyrow"><input id="ai-key" class="field" type="password" autocomplete="off" data-ai="key" value="${esc(AIS.key)}" placeholder="${ant ? 'sk-ant-…' : 'sk-…'}"><button class="btn" data-act="showKey">显示</button></div></div>
      ${ant ? `<div><label class="lab" for="ai-model">模型</label><input id="ai-model" class="field mono" data-ai="model" value="${esc(AIS.model)}" placeholder="claude-sonnet-5-5"></div>
        <div><label class="lab" for="ai-base">接口地址（可选，用中转服务时填写）</label><input id="ai-base" class="field mono" data-ai="base" value="${esc(AIS.base)}" placeholder="https://api.anthropic.com"></div>`
      : `<div><label class="lab" for="ai-base">接口地址</label><input id="ai-base" class="field mono" data-ai="base" value="${esc(AIS.base)}" placeholder="例如 https://api.deepseek.com/v1"></div>
        <div><label class="lab" for="ai-oam">模型</label><input id="ai-oam" class="field mono" data-ai="oaModel" value="${esc(AIS.oaModel)}" placeholder="例如 deepseek-chat"></div>`}
      <div class="card-f">${UI.busy && UI.busy.kind === 'test' ? busyLine('正在测试…') : '<button class="btn" data-act="testAI">测试连接</button>'}${UI.aiTest ? `<span class="${UI.aiTest.startsWith('✓') ? 'ok' : 'err'}">${esc(UI.aiTest)}</span>` : ''}</div>
      <p class="note-box">Key 只保存在这个浏览器里，由浏览器直接发给你选择的 AI 服务，不经过任何其他服务器。调用费用由你的账号承担。${ant ? '' : '有些服务不允许网页直接调用（跨域限制），测试失败时可以换一个接口。'}没有 AI 也能用：每一步都可以手动完成。</p>
    </section>
    <section><h3>数据</h3>
      <p class="muted small">所有推演只存在这个浏览器里。换设备或清理浏览器前，先导出备份。</p>
      <div class="card-f"><button class="btn" data-act="export">导出全部推演</button><button class="btn" data-act="import">导入备份</button><button class="btn ghost" data-act="restoreSample">恢复示例</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </section>
    <section><h3>方法</h3>
      <p class="muted small">这套流程借鉴了兵棋推演、情景规划、事前验尸和决策日志。推演引擎把每条路拆成几个关键节点，枚举所有节点的顺逆组合，算出每种未来的概率和好坏，画成"命运带"。它不预测未来，只让你在落子之前看清每条路的形状。</p>
    </section>
  </aside>`;
}

/* ========== render loop (keeps focus, respects IME composition) ========== */
let composing = false, pendingRender = false;
function autosize(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
function view() {
  if (UI.view === 'run') { const r = getRun(UI.runId); if (r) return runView(r) + drawerView(); }
  return homeView() + drawerView();
}
function doRender() {
  if (composing) { pendingRender = true; return; }
  const a = document.activeElement; const fidNow = a && a.id && $app.contains(a) ? a.id : null; let sel = null;
  if (fidNow && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search|password)$/.test(a.type)))) { try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) {} }
  $app.innerHTML = view();
  $app.querySelectorAll('textarea.auto').forEach(autosize);
  if (typeof afterRender === 'function') afterRender();
  if (fidNow) { const el = document.getElementById(fidNow); if (el) { try { el.focus({preventScroll: true}); if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  if (UI.justRolled) { const id = UI.justRolled; UI.justRolled = null; revealRoll(id); }
  ensureDatalist();
  document.title = UI.view === 'run' && getRun(UI.runId) ? (getRun(UI.runId).question || '新的推演') + ' · 战略推演' : '战略推演';
}
function focusId(id) { requestAnimationFrame(() => { const el = document.getElementById(id); if (el) el.focus(); }); }
let toastT;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }

/* ========== input binding ========== */
function setPath(obj, path, v) {
  const parts = path.split('.'); let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]; let nx = Array.isArray(o) ? o.find(x => x && x.id === p) : o[p];
    if (nx == null) { if (Array.isArray(o)) return false; nx = {}; o[p] = nx; }
    o = nx;
  }
  if (Array.isArray(o)) return false;
  o[parts[parts.length - 1]] = v; return true;
}
function handleInput(el) {
  if (el.dataset.ai) { AIS[el.dataset.ai] = el.value.trim(); saveAI(); UI.aiTest = ''; return; }
  const bind = el.dataset.bind; if (!bind) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.type === 'num') { v = Number(v); if (!Number.isFinite(v)) v = 0; }
  const i = bind.indexOf(':'); const path = bind.slice(i + 1);
  const r = getRun(UI.runId); if (!r) return;
  if (setPath(r, path, v)) touched(r);
  if (el.dataset.out) { const o = document.getElementById(el.dataset.out); if (o) o.textContent = v + '%'; }
  if (el.tagName === 'TEXTAREA') autosize(el);
  if (typeof afterInput === 'function') afterInput(el);
}
$app.addEventListener('input', e => handleInput(e.target));
$app.addEventListener('change', e => { const el = e.target; if (el.dataset.rerender || el.type === 'date') { handleInput(el); doRender(); } if (el.id === 'import-file') importFile(el); });
$app.addEventListener('compositionstart', () => { composing = true; });
$app.addEventListener('compositionend', e => { composing = false; handleInput(e.target); if (pendingRender) { pendingRender = false; doRender(); } });
$app.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const f = ACT[t.dataset.act]; if (!f) return;
  if (t.tagName === 'A') return;
  e.preventDefault(); f(t, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI.drawer) { ACT.closeDrawer(); return; }
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.classList && t.classList.contains('item') && t === document.activeElement) { e.preventDefault(); ACT.open(t); }
  if (e.key === 'Enter' && t.dataset && t.dataset.bind && /\.label$/.test(t.dataset.bind) && UI.view === 'run') { e.preventDefault(); const r = getRun(UI.runId); if (r && r.options.length < 4) ACT.addOpt(); }
});

/* ========== actions ========== */
const cur = () => getRun(UI.runId);
function openDrawer(msg = '') { UI.drawer = true; UI.drawerMsg = msg; doRender(); focusId(aiReady() ? 'ai-model' : 'ai-key'); }
const ACT = {
  newRun() { const r = newRun(); DB.runs.push(r); saveNow(); UI.focusAfter = fid('run:question'); go('#/run/' + r.id + '/0'); },
  open(t) { go('#/run/' + t.dataset.id); },
  askDel(t, e) { e.stopPropagation(); UI.confirm = 'del:' + t.dataset.id; doRender(); },
  cancel(t, e) { if (e) e.stopPropagation(); UI.confirm = null; doRender(); },
  del(t, e) { e.stopPropagation(); DB.runs = DB.runs.filter(r => r.id !== t.dataset.id); UI.confirm = null; saveNow(); doRender(); toast('已删除。'); },
  step(t) { const r = cur(); go('#/run/' + r.id + '/' + t.dataset.n); },
  addOpt() { const r = cur(); if (r.options.length >= 4) return; const o = newOpt(); r.options.push(o); touched(r); doRender(); focusId(fid('run:options.' + o.id + '.label')); },
  delOpt(t) { const r = cur(); r.options = r.options.filter(o => o.id !== t.dataset.id); if (r.choice.optionId === t.dataset.id) r.choice.optionId = null; touched(r); doRender(); },
  horizon(t) { const r = cur(); r.horizon = t.dataset.v; touched(r); doRender(); },
  async aiFrame() {
    const r = cur(); if (!r.question.trim()) { toast('先写下你要做的决定。'); focusId(fid('run:question')); return; }
    const v = await askJSON('frame', PROMPT.frame(r), 1500); if (!v) return;
    UI.sug.frame = {rid: r.id, question: str(v.question), why: str(v.why), options: arr(v.options).map(str).filter(Boolean).slice(0, 3), used: {}, door: str(v.door), doorWhy: str(v.doorWhy)};
    doRender();
  },
  useQ() { const r = cur(); const s = UI.sug.frame; if (!s) return; r.question = s.question; s.question = ''; touched(r); doRender(); },
  addSugOpt(t) {
    const r = cur(); const s = UI.sug.frame; const i = Number(t.dataset.i); if (!s || s.used[i]) return;
    const empty = r.options.find(o => !o.label);
    if (empty) empty.label = s.options[i]; else if (r.options.length < 4) r.options.push(newOpt(s.options[i])); else { toast('最多四条路。先删掉一条。'); return; }
    s.used[i] = true; touched(r); doRender();
  },
  side(t) { const r = cur(); const a = r.actors.find(x => x.id === t.dataset.id); if (!a) return; a.side = SIDE_ORDER[(SIDE_ORDER.indexOf(a.side) + 1) % SIDE_ORDER.length]; touched(r); doRender(); },
  addActor() { const r = cur(); const a = {id: uid('a'), name: '', side: 'hostile', want: ''}; r.actors.push(a); touched(r); doRender(); focusId(fid('run:actors.' + a.id + '.name')); },
  delActor(t) { const r = cur(); r.actors = r.actors.filter(a => a.id !== t.dataset.id); touched(r); doRender(); },
  addNote(t) { const r = cur(); const n = {id: uid('s'), kind: t.dataset.k, text: '', conf: 50}; r.notes.push(n); touched(r); doRender(); focusId(fid('run:notes.' + n.id + '.text')); },
  delNote(t) { const r = cur(); r.notes = r.notes.filter(n => n.id !== t.dataset.id); touched(r); doRender(); },
  kind(t) { const r = cur(); const n = r.notes.find(x => x.id === t.dataset.id); if (!n) return; n.kind = n.kind === 'fact' ? 'assume' : 'fact'; touched(r); doRender(); },
  async aiBoard() {
    const r = cur(); if (!r.question.trim()) { toast('先在「定题」写下你要做的决定。'); return; }
    const v = await askJSON('board', PROMPT.board(r), 1500); if (!v) return;
    UI.sug.board = {rid: r.id, actors: arr(v.actors).map(a => ({name: str(a && a.name), side: SIDES[a && a.side] && a.side !== 'self' ? a.side : 'unknown', want: str(a && a.want)})).filter(a => a.name).slice(0, 4), assumptions: arr(v.assumptions).map(x => str(typeof x === 'string' ? x : x && x.text)).filter(Boolean).slice(0, 4), usedA: {}};
    doRender();
  },
  addSugActor(t) { const r = cur(); const s = UI.sug.board; const a = s && s.actors[Number(t.dataset.i)]; if (!a || a.used) return; r.actors.push({id: uid('a'), name: a.name, side: a.side, want: a.want}); a.used = true; touched(r); doRender(); },
  addSugNote(t) { const r = cur(); const s = UI.sug.board; const i = Number(t.dataset.i); if (!s || s.usedA[i]) return; r.notes.push({id: uid('s'), kind: 'assume', text: s.assumptions[i], conf: 50}); s.usedA[i] = true; touched(r); doRender(); toast('已加入。把握先记为 50%，改成你自己的判断。'); },
  askSim() { UI.confirm = 'sim'; doRender(); },
  async aiSim() {
    UI.confirm = null;
    const r = cur(); const os = r.options.filter(o => o.label);
    if (!os.length) { toast('先在「定题」写下至少一条路。'); return; }
    const rid = r.id; const v = await askJSON('sim', PROMPT.sim(r), 6000); if (!v) return;
    const r2 = getRun(rid); if (!r2) return;
    const list = arr(v.options); let n = 0;
    r2.options.filter(o => o.label).forEach((o, i) => {
      const src = list.find(x => x && str(x.id) === o.id) || list[i]; if (!src) return;
      const nodes = arr(src.nodes).slice(0, 5).map(x => ({
        id: uid('n'), actor: str(x.actor), text: str(x.text), p: clampInt(x.p, 1, 99, 50), good: str(x.good), bad: str(x.bad),
        up: clampInt(x.up, 0, 3, 1), down: clampInt(x.down, -3, 0, -1), breach: !!(x.breach === true || x.breach === 'true') && !!r2.bottom
      })).filter(x => x.text);
      if (nodes.length) { o.nodes = nodes; n++; delete UI.rolls[o.id]; delete UI.samples[o.id]; }
    });
    touched(r2); doRender();
    if (!n) UI.err.sim = 'AI 没有给出可用的节点，再试一次。'; else toast('推演完成。点「调整」可以改任何一个概率。');
    doRender();
  },
  jump(t) { const el = document.getElementById('opt-' + t.dataset.id); if (el) el.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block: 'start'}); },
  edit(t) { UI.editing[t.dataset.id] = !UI.editing[t.dataset.id]; doRender(); },
  addNode(t) {
    const r = cur(); const o = r.options.find(x => x.id === t.dataset.id); if (!o) return;
    const n = {id: uid('n'), actor: '', text: '', p: 50, good: '', bad: '', up: 1, down: -1, breach: false};
    o.nodes.push(n); UI.editing[o.id] = true; delete UI.rolls[o.id]; delete UI.samples[o.id]; touched(r); doRender();
    focusId(fid('run:options.' + o.id + '.nodes.' + n.id + '.text'));
  },
  delNode(t) { const r = cur(); const o = r.options.find(x => x.id === t.dataset.o); if (!o) return; o.nodes = o.nodes.filter(n => n.id !== t.dataset.id); delete UI.rolls[o.id]; delete UI.samples[o.id]; touched(r); doRender(); },
  roll(t) {
    const r = cur(); const o = r.options.find(x => x.id === t.dataset.id); if (!o || !o.nodes.length) return;
    const res = o.nodes.map(n => { const d = d100(); const p = clampInt(n.p, 0, 100, 50); const ok = d <= p; return {d, p, ok, txt: (ok ? n.good : n.bad) || n.text, s: ok ? clampInt(n.up, 0, 3, 0) : clampInt(n.down, -3, 0, 0), br: !ok && !!n.breach}; });
    const prev = UI.rolls[o.id]; const score = res.reduce((s, x) => s + x.s, 0);
    UI.rolls[o.id] = {res, score, breach: res.some(x => x.br), hist: [...(prev ? prev.hist : []), score].slice(-30)};
    UI.justRolled = o.id; doRender();
  },
  choose(t) { const r = cur(); r.choice.optionId = t.dataset.id; if (!r.decidedAt) r.decidedAt = Date.now(); if (!r.choice.reviewDate) r.choice.reviewDate = plusDays({'3 个月': 91, '半年': 182, '1 年': 365, '3 年': 365}[r.horizon] || 182); touched(r); doRender(); },
  async aiRed() {
    const r = cur(); const o = r.options.find(x => x.id === r.choice.optionId); if (!o) return;
    const rid = r.id, oid = o.id; const v = await askJSON('red', PROMPT.red(r, o), 1800); if (!v) return;
    UI.sug.red = {rid, oid, premortem: arr(v.premortem).map(str).filter(Boolean).slice(0, 3), tripwires: arr(v.tripwires).map(x => ({see: str(x && x.see), do: str(x && x.do)})).filter(x => x.see).slice(0, 3), first: str(v.first), usedP: {}, usedT: {}, usedF: false};
    doRender();
  },
  addSugPm(t) { const r = cur(); const s = UI.sug.red; const i = Number(t.dataset.i); if (!s || s.usedP[i]) return; r.choice.premortem = (r.choice.premortem ? r.choice.premortem.replace(/\s+$/, '') + '\n' : '') + s.premortem[i]; s.usedP[i] = true; touched(r); doRender(); },
  addSugTrip(t) { const r = cur(); const s = UI.sug.red; const i = Number(t.dataset.i); if (!s || s.usedT[i]) return; r.choice.tripwires.push({id: uid('t'), see: s.tripwires[i].see, do: s.tripwires[i].do}); s.usedT[i] = true; touched(r); doRender(); },
  addSugFirst() { const r = cur(); const s = UI.sug.red; if (!s || s.usedF) return; r.choice.first = s.first; s.usedF = true; touched(r); doRender(); },
  addTrip() { const r = cur(); const tw = {id: uid('t'), see: '', do: ''}; r.choice.tripwires.push(tw); touched(r); doRender(); focusId(fid('run:choice.tripwires.' + tw.id + '.see')); },
  delTrip(t) { const r = cur(); r.choice.tripwires = r.choice.tripwires.filter(x => x.id !== t.dataset.id); touched(r); doRender(); },
  async copyDoc() {
    const text = docText(cur());
    try { await navigator.clipboard.writeText(text); toast('已复制。'); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('已复制。'); } catch (e2) { toast('复制失败，请手动选择文字。'); } t.remove(); }
  },
  print() { window.print(); },
  rv(t) { const r = cur(); r.review = Object.assign({}, r.review || {}, {[t.dataset.f]: t.dataset.v, ts: Date.now()}); touched(r); doRender(); },
  stop() { if (UI.busy && UI.busy.ctl) UI.busy.ctl.abort(); },
  drawer() { openDrawer(''); },
  closeDrawer() { UI.drawer = false; UI.drawerMsg = ''; doRender(); },
  provider(t) { AIS.provider = t.dataset.v; AIS.base = ''; saveAI(); UI.aiTest = ''; doRender(); },
  showKey(t) { const el = document.getElementById('ai-key'); if (!el) return; el.type = el.type === 'password' ? 'text' : 'password'; t.textContent = el.type === 'password' ? '显示' : '隐藏'; },
  async testAI() {
    if (!aiReady()) { UI.aiTest = AIS.provider === 'anthropic' ? '先填写 API Key。' : '先填写接口地址、模型和 API Key。'; doRender(); return; }
    const ctl = new AbortController(); UI.busy = {kind: 'test', ctl}; UI.aiTest = ''; doRender();
    try { const t = await callAI('只回复一个 JSON：{"ok":true}', ctl.signal, 50); UI.aiTest = parseJSON(t) ? '✓ 连接成功' : '✓ 已连通（回复格式不标准，但可以用）'; }
    catch (e) { UI.aiTest = e && e.name === 'AbortError' ? '' : aiErrText(e); }
    finally { UI.busy = null; doRender(); }
  },
  export() {
    const blob = new Blob([JSON.stringify({app: 'zhanlue-tuiyan', version: 1, exported: new Date().toISOString(), runs: DB.runs}, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '战略推演备份-' + todayISO() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  import() { const el = document.getElementById('import-file'); if (el) el.click(); },
  restoreSample() { DB.runs = DB.runs.filter(r => r.id !== 'sample'); DB.runs.push(sampleRun()); saveNow(); UI.drawer = false; go('#/'); toast('示例已恢复。'); }
};
function importFile(el) {
  const f = el.files && el.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const o = JSON.parse(rd.result); const runs = arr(o.runs); let n = 0;
      for (const r of runs) { if (!r || !r.id) continue; const i = DB.runs.findIndex(x => x.id === r.id); if (i >= 0) DB.runs[i] = r; else DB.runs.push(r); n++; }
      saveNow(); UI.drawer = false; go('#/'); toast(`已导入 ${n} 局推演。`);
    } catch (e) { toast('这个文件读不出来。请选择从这里导出的备份文件。'); }
  };
  rd.readAsText(f); el.value = '';
}

/* datalist for actor names in node editor */
function ensureDatalist() {
  let dl = document.getElementById('actors-dl'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'actors-dl'; document.body.appendChild(dl); }
  const r = UI.view === 'run' ? getRun(UI.runId) : null;
  dl.innerHTML = r ? r.actors.filter(a => a.name).map(a => `<option value="${esc(a.name)}">`).join('') : '';
}
