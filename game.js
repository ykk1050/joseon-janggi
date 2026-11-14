/* 조선 수호 장기 — 화면과 진행 (코드로 직접 만듦) */
const VERSION = 'v1.000';
const $ = (s) => document.querySelector(s);
const BENCH = 5;

// ───────── 저장 ─────────
const SAVE_KEY = 'joseonJanggi';
let save = { cleared: {}, best3: 0, sound: true };
try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); if (v) save = Object.assign(save, v); } catch (e) {}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ───────── 소리 ─────────
const SND = {};
['click','ok','place','hit','boom','coin','page','error','win','lose'].forEach(n => { SND[n] = new Audio('sounds/' + n + '.mp3'); SND[n].preload = 'auto'; });
let lastHit = 0;
function play(n, vol = 0.6) {
  if (!save.sound) return;
  if (n === 'hit' || n === 'boom') { const t = performance.now(); if (t - lastHit < 90) return; lastHit = t; }
  try { const a = SND[n].cloneNode(); a.volume = vol; a.play().catch(() => {}); } catch (e) {}
}

// ───────── 상태 ─────────
let S = null;
let uidSeq = 1;
const newUnit = (type, star = 1) => ({ uid: uidSeq++, type, star });

function chap() { return CHAPTERS[S.ch]; }
function stage() { return chap().stages ? chap().stages[S.stage] : null; }

// ───────── 화면 전환 ─────────
function show(id) {
  ['title','chapters','game'].forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
  if (id === 'game') requestAnimationFrame(sizeBoard);
}
document.querySelectorAll('.ver').forEach(e => e.textContent = VERSION);

function toast(msg, ms = 1400) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

// 여러 단계를 차례로
function seq(steps, done) {
  let i = 0;
  const next = () => { if (i < steps.length) steps[i++](next); else if (done) done(); };
  next();
}

// ───────── 이야기 상자 ─────────
function showStory(lines, done) {
  if (!lines || !lines.length) { done && done(); return; }
  let i = 0;
  const box = $('#story');
  const render = () => {
    const l = lines[i];
    const who = $('#storyWho');
    who.textContent = l.who;
    who.className = 'story-who' + (['세종','인조'].includes(l.who) ? ' king' : l.who === '안내' ? ' guide' : '');
    $('#storyText').textContent = l.text;
    $('#storyPage').textContent = (i + 1) + ' / ' + lines.length;
    $('#btnStoryNext').textContent = i === lines.length - 1 ? '확인 ✔' : '다음 ▶';
  };
  box.classList.remove('hidden');
  render(); play('page', .4);
  $('#btnStoryNext').onclick = () => {
    i++;
    if (i >= lines.length) { box.classList.add('hidden'); done && done(); }
    else { render(); play('page', .4); }
  };
}

// ───────── 범용 창 ─────────
function modal(html, bind) {
  $('#modalBox').innerHTML = html;
  $('#modal').classList.remove('hidden');
  bind && bind($('#modalBox'));
}
function closeModal() { $('#modal').classList.add('hidden'); }

function showQuiz(qz, done) {
  if (!qz) { done(); return; }
  const order = qz.a.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  modal(`<h3>📜 역사 퀴즈</h3><p class="q">${qz.q}</p><div id="qOpts">${order.map(i => `<button class="btn choice" data-i="${i}">${qz.a[i]}</button>`).join('')}</div><div id="qAfter"></div>`, (box) => {
    box.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      const pick = +b.dataset.i;
      box.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (+x.dataset.i === qz.ok) x.classList.add('right'); });
      let msg;
      if (pick === qz.ok) { play('coin'); S.gold += 2; updateTop(); msg = '<b>정답! 군량 +2</b>'; }
      else { b.classList.add('wrong'); play('error'); msg = '<b>아쉬워요! 정답을 확인해 보세요.</b>'; }
      box.querySelector('#qAfter').innerHTML = `<div class="why">${msg}<br>${qz.why}</div><p><button class="btn big" id="qNext">다음</button></p>`;
      box.querySelector('#qNext').onclick = () => { closeModal(); done(); };
    });
  });
}

// ───────── 시작 화면, 장 선택 ─────────
$('#btnStart').onclick = () => { play('click'); renderChapters(); show('chapters'); };
$('#btnBackTitle').onclick = () => { play('click'); show('title'); };
function renderChapters() {
  const list = $('#chapterList');
  list.innerHTML = '';
  CHAPTERS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'ch-card'; b.style.background = c.color;
    const desc = ['쓰시마섬을 공격하고, 압록강과 두만강의 여진을 몰아내요.',
                  '조총을 가진 일본군을 수군·의병·명군의 힘으로 막아요.',
                  '청군에 포위된 남한산성을 최대한 오래 지켜요.'][i];
    let status = save.cleared[c.id] ? '✔ 완료' : '▶ 시작';
    if (c.siege && save.cleared[c.id]) status = `✔ 완료 · 최고 기록 ${save.best3}일 버팀`;
    b.innerHTML = `<h3>${c.title}</h3><p>${desc}</p><div class="ch-status">${status}</div>`;
    b.onclick = () => { play('click'); startChapter(i); };
    list.appendChild(b);
  });
}

// ───────── 장 진행 ─────────
function startChapter(i) {
  const c = CHAPTERS[i];
  S = { ch: i, stage: 0, day: 1, gold: c.startGold, cap: c.startCap,
        bench: Array(BENCH).fill(null), board: [], shop: [], phase: 'prep',
        sel: null, info: null, maps: [], food: 100, wood: 100, held: 0, meetBuff: null, speed: 1 };
  show('game');
  $('#tbSiege').classList.toggle('hidden', !c.siege);
  showStory(c.intro, () => c.siege ? startDay(1) : startStage(0));
}

function startStage(i) {
  S.stage = i;
  const st = stage();
  showStory(st.pre, () => enterPrep(true));
}

function startDay(d) {
  S.day = d;
  const c = chap();
  if (d > 1) S.gold += c.income[d - 1];
  updateTop();
  const lines = [{ who:'안내', text:`${d}일째 아침이에요. 🍚 식량 ${S.food}, 🔥 땔감 ${S.wood} 남았어요.` + (d > 1 ? ` 군량 +${c.income[d - 1]}` : '') }];
  showStory(lines, () => enterPrep(true));
}

function enemiesNow() {
  const c = chap();
  if (c.siege) {
    let w = c.waves[S.day - 1].slice();
    if (S.meetBuff === 'peace') w = w.slice(0, Math.max(3, w.length - 2));
    return w;
  }
  return stage().enemies;
}
function poolNow() { return chap().siege ? chap().pool : stage().pool; }
function siegeMul() {
  return { atk: 0.6 + 0.4 * S.food / 100, hp: 0.6 + 0.4 * S.wood / 100 };
}

// ───────── 준비(상점·배치) ─────────
function enterPrep(newShop) {
  S.phase = 'prep'; S.sel = null;
  if (newShop) rollShop();
  $('#prepControls').classList.remove('hidden');
  $('#battleControls').classList.add('hidden');
  renderAll();
}

function owns(type) { return S.bench.some(u => u && u.type === type) || S.board.some(b => b.u.type === type); }
function rollShop() {
  const pool = poolNow().filter(t => !(UNITS[t].general && owns(t)));
  S.shop = [];
  for (let i = 0; i < 4; i++) S.shop.push(pool[Math.floor(Math.random() * pool.length)]);
  // 첫 장면에서는 그 단계 장수가 꼭 보이도록
  const gen = poolNow().find(t => UNITS[t].general && !owns(t));
  if (gen && !S.shop.includes(gen) && Math.random() < 0.6) S.shop[3] = gen;
}

$('#btnReroll').onclick = () => {
  if (S.phase !== 'prep') return;
  if (S.gold < 1) { play('error'); toast('군량이 부족해요'); return; }
  S.gold -= 1; play('click'); rollShop(); renderAll();
};

function buy(i) {
  const t = S.shop[i];
  if (!t || S.phase !== 'prep') return;
  const d = UNITS[t];
  if (S.gold < d.cost) { play('error'); toast('군량이 부족해요'); return; }
  const slot = S.bench.indexOf(null);
  const sameCount = allOwned().filter(o => o.u.type === t && o.u.star === 1).length;
  if (slot < 0 && sameCount < 2) { play('error'); toast('대기석이 가득 찼어요'); return; }
  S.gold -= d.cost; S.shop[i] = null; play('coin', .5);
  const u = newUnit(t);
  if (slot >= 0) S.bench[slot] = u;
  else S.bench.push(u); // 잠깐 넣었다가 합체로 정리
  tryMerge();
  S.bench = S.bench.slice(0, BENCH).concat(Array(Math.max(0, BENCH - S.bench.length)).fill(null)).slice(0, BENCH);
  S.info = { type: t };
  renderAll();
}

function allOwned() {
  const r = [];
  S.board.forEach((b, i) => r.push({ where: 'board', i, u: b.u }));
  S.bench.forEach((u, i) => { if (u) r.push({ where: 'bench', i, u }); });
  return r;
}
function tryMerge() {
  let again = true;
  while (again) {
    again = false;
    const groups = {};
    allOwned().forEach(o => { if (o.u.star < 3) { const k = o.u.type + '|' + o.u.star; (groups[k] = groups[k] || []).push(o); } });
    for (const k in groups) {
      const g = groups[k];
      if (g.length >= 3) {
        g.sort((a, b) => (a.where === 'board' ? 0 : 1) - (b.where === 'board' ? 0 : 1));
        const keep = g[0];
        keep.u.star++;
        const remove = g.slice(1, 3);
        remove.forEach(o => { if (o.where === 'bench') S.bench[o.i] = null; });
        const rmBoard = new Set(remove.filter(o => o.where === 'board').map(o => o.u.uid));
        S.board = S.board.filter(b => !rmBoard.has(b.u.uid));
        play('ok'); toast(`${UNITS[keep.u.type].name} ${'★'.repeat(keep.u.star)} 합체!`);
        again = true; break;
      }
    }
  }
}

$('#btnSell').onclick = () => {
  if (!S.sel || S.phase !== 'prep') return;
  let u;
  if (S.sel.where === 'bench') { u = S.bench[S.sel.i]; S.bench[S.sel.i] = null; }
  else { u = S.board[S.sel.i].u; S.board.splice(S.sel.i, 1); }
  const refund = UNITS[u.type].cost * Math.pow(3, u.star - 1);
  S.gold += refund; S.sel = null; play('coin', .5); toast(`군량 +${refund}`);
  renderAll();
};

function boardAt(x, y) { return S.board.findIndex(b => b.x === x && b.y === y); }
function castleCell(x, y) { return chap().siege && x === 2 && y === 5; }

function tapCell(x, y) {
  if (S.phase !== 'prep') return;
  // 적 미리보기 눌러 설명 보기
  if (y < 3) {
    const e = enemiesNow().find(en => en[1] === x && en[2] === y);
    if (e) { S.info = { type: e[0] }; S.sel = null; play('click'); renderAll(); }
    return;
  }
  if (castleCell(x, y)) { S.info = { type: 'castle' }; S.sel = null; renderAll(); return; }
  const bi = boardAt(x, y);
  if (!S.sel) {
    if (bi >= 0) { S.sel = { where: 'board', i: bi }; S.info = { type: S.board[bi].u.type, star: S.board[bi].u.star }; play('click'); }
    renderAll(); return;
  }
  // 선택한 것을 옮기기
  if (S.sel.where === 'board') {
    const from = S.board[S.sel.i];
    if (bi === S.sel.i) { S.sel = null; renderAll(); return; }
    if (bi >= 0) { const o = S.board[bi]; [o.x, from.x] = [from.x, o.x]; [o.y, from.y] = [from.y, o.y]; }
    else { from.x = x; from.y = y; }
    play('place'); S.sel = null;
  } else {
    const u = S.bench[S.sel.i];
    if (bi >= 0) { const o = S.board[bi]; S.bench[S.sel.i] = o.u; o.u = u; play('place'); S.sel = null; }
    else {
      if (S.board.length >= S.cap) { play('error'); toast(`지금은 ${S.cap}명까지 놓을 수 있어요`); return; }
      S.board.push({ u, x, y }); S.bench[S.sel.i] = null; play('place'); S.sel = null;
    }
  }
  renderAll();
}

function tapBench(i) {
  if (S.phase !== 'prep') return;
  const u = S.bench[i];
  if (!S.sel) {
    if (u) { S.sel = { where: 'bench', i }; S.info = { type: u.type, star: u.star }; play('click'); }
    renderAll(); return;
  }
  if (S.sel.where === 'bench') {
    if (S.sel.i === i) { S.sel = null; renderAll(); return; }
    [S.bench[i], S.bench[S.sel.i]] = [S.bench[S.sel.i], S.bench[i]];
    if (!u) { S.sel = null; } else { S.sel = { where: 'bench', i }; S.info = { type: u.type, star: u.star }; }
    play('place');
  } else {
    const b = S.board[S.sel.i];
    if (u) { S.bench[i] = b.u; b.u = u; } else { S.bench[i] = b.u; S.board.splice(S.sel.i, 1); }
    S.sel = null; play('place');
  }
  renderAll();
}

// ───────── 그리기 ─────────
function pieceHTML(type, star, opts = {}) {
  const d = UNITS[type];
  const cls = ['piece', d.side, d.general ? 'gen' : '', d.fixed ? 'fixed' : '', opts.sel ? 'sel' : '', opts.cls || ''].join(' ');
  const stars = star > 1 ? `<div class="star">${'★'.repeat(star)}</div>` : '';
  const hp = opts.hp ? `<div class="hp"><i style="width:100%"></i></div>` : '';
  const pos = opts.x !== undefined ? `style="left:${opts.x * 16.6667}%;top:${opts.y * 16.6667}%"` : '';
  return `<div class="${cls}" ${pos} ${opts.id !== undefined ? `data-id="${opts.id}"` : ''}>${stars}<div class="oct"><span class="ch">${d.ch}</span><span class="nm">${d.name}</span></div>${hp}</div>`;
}

function sizeBoard() {
  const b = $('#board');
  const cell = b.clientWidth / 6;
  b.style.setProperty('--cell', cell + 'px');
  $('#bench').style.setProperty('--cell', (b.clientWidth / 6.2) + 'px');
}
window.addEventListener('resize', sizeBoard);

function boardBase() {
  const c = chap();
  const terrain = c.siege ? 'siege' : stage().terrain;
  const b = $('#board');
  b.className = 'board ' + (terrain === 'sea' ? 'sea' : terrain === 'siege' ? 'siege' : '');
  const lc = terrain === 'sea' ? 'rgba(255,255,255,.55)' : '#6b4a22';
  let lines = '';
  for (let i = 0; i < 6; i++) {
    const p = (i + .5) / 6 * 100;
    lines += `<line x1="${p}%" y1="${100 / 12}%" x2="${p}%" y2="${100 - 100 / 12}%" stroke="${lc}" stroke-width="1.5"/>`;
    lines += `<line x1="${100 / 12}%" y1="${p}%" x2="${100 - 100 / 12}%" y2="${p}%" stroke="${lc}" stroke-width="1.5"/>`;
  }
  // 장기판처럼 궁성 대각선
  const a = 100 / 12, q = (2.5) / 6 * 100, r = (3.5) / 6 * 100, bt = (5.5) / 6 * 100, tp = (3.5) / 6 * 100;
  lines += `<line x1="${q}%" y1="${tp + 100/6}%" x2="${r}%" y2="${bt}%" stroke="${lc}" stroke-width="1"/><line x1="${r}%" y1="${tp + 100/6}%" x2="${q}%" y2="${bt}%" stroke="${lc}" stroke-width="1"/>`;
  let cells = '';
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) cells += `<div class="cell" data-x="${x}" data-y="${y}" style="left:${x * 16.6667}%;top:${y * 16.6667}%"></div>`;
  const label = terrain === 'sea' ? '바 다' : '전 선';
  b.innerHTML = `<svg class="lines" aria-hidden="true">${lines}</svg><div class="front-label">${label}</div>${cells}`;
  b.querySelectorAll('.cell').forEach(c => c.onclick = () => tapCell(+c.dataset.x, +c.dataset.y));
}

function renderBoardPrep() {
  boardBase();
  const b = $('#board');
  let html = '';
  for (const [t, x, y] of enemiesNow()) html += pieceHTML(t, 1, { x, y, cls: 'preview' });
  if (chap().siege) html += pieceHTML('castle', 1, { x: 2, y: 5 });
  S.board.forEach((o, i) => { html += pieceHTML(o.u.type, o.u.star, { x: o.x, y: o.y, sel: S.sel && S.sel.where === 'board' && S.sel.i === i }); });
  b.insertAdjacentHTML('beforeend', html);
  // 놓을 수 있는 칸 표시
  b.querySelectorAll('.cell').forEach(c => {
    const y = +c.dataset.y, x = +c.dataset.x;
    if (y >= 3 && !castleCell(x, y)) { c.classList.add('can'); if (S.sel) c.classList.add('hl'); }
  });
  sizeBoard();
}

function renderBench() {
  const el = $('#bench');
  el.innerHTML = '';
  S.bench.forEach((u, i) => {
    const s = document.createElement('div');
    s.className = 'slot';
    if (u) s.innerHTML = pieceHTML(u.type, u.star, { sel: S.sel && S.sel.where === 'bench' && S.sel.i === i });
    s.onclick = () => tapBench(i);
    el.appendChild(s);
  });
}

function renderShop() {
  const el = $('#shop');
  el.innerHTML = '';
  S.shop.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    if (!t) { b.classList.add('sold'); el.appendChild(b); return; }
    const d = UNITS[t];
    if (S.gold < d.cost) b.classList.add('poor');
    b.innerHTML = `<div class="mini">${pieceHTML(t, 1)}</div><div><div class="cname">${d.name}</div><div class="ctrait">${d.traits.map(x => TRAITS[x].icon + x).join(' ')}</div></div><div class="ccost">🌾${d.cost}</div>`;
    b.onclick = () => buy(i);
    el.appendChild(b);
  });
  $('#btnReroll').disabled = S.gold < 1;
  $('#btnSell').disabled = !S.sel;
  if (S.sel) {
    const u = S.sel.where === 'bench' ? S.bench[S.sel.i] : S.board[S.sel.i].u;
    $('#btnSell').textContent = `팔기 (🌾${UNITS[u.type].cost * Math.pow(3, u.star - 1)})`;
  } else $('#btnSell').textContent = '팔기';
}

function renderTraits() {
  const counts = countTraits(S.board.map(b => ({ type: b.u.type })));
  const buffs = activeBuffs(counts);
  const shown = new Set(['관군','장수']);
  if (S.ch === 1) ['수군','의병','명군'].forEach(t => shown.add(t));
  Object.keys(counts).forEach(t => shown.add(t));
  let h = '<b>시너지</b>';
  shown.forEach(t => {
    const tr = TRAITS[t]; if (!tr.steps.length) return;
    const on = buffs[t] > 0;
    h += `<div class="trait ${on ? 'on' : ''}" title="${tr.desc}">${tr.icon} ${t}<span class="cnt">${counts[t] || 0} / ${tr.steps.join('·')}</span></div>`;
  });
  if (S.ch === 1) h += `<div class="crisis ${buffs.crisis ? 'on' : ''}">${buffs.crisis ? '🔥 위기 극복! 모든 군사 강화' : CRISIS_DESC}</div>`;
  if (chap().siege) {
    const m = siegeMul();
    h += `<div class="crisis">배고픔: 공격력 ×${m.atk.toFixed(2)} · 추위: 체력 ×${m.hp.toFixed(2)}${S.meetBuff === 'fight' ? '<br>회의 결과: 공격력 +20%' : ''}</div>`;
  }
  $('#traitPanel').innerHTML = h;
}

function renderInfo() {
  const el = $('#infoPanel');
  if (!S.info) { el.innerHTML = '<p class="muted">군사를 누르면 설명이 나와요.</p>'; return; }
  const d = UNITS[S.info.type], star = S.info.star || 1;
  const m = star === 2 ? 1.8 : star === 3 ? 3.2 : 1;
  const rng = d.range === 0 ? '-' : d.range === 1 ? '1칸(바로 옆)' : d.range + '칸';
  const traits = d.traits.map(t => `${TRAITS[t].icon}${t}`).join(' ');
  el.innerHTML = `<div class="info-head"><div class="mini">${pieceHTML(S.info.type, star)}</div><div><h4>${d.name} ${star > 1 ? '★'.repeat(star) : ''}</h4>
    <div class="stats">체력 ${Math.round(d.hp * m)} · 공격 ${Math.round(d.atk * m)} · 사거리 ${rng}${d.move > 1 ? ' · 빠름' : ''}${d.cost ? ' · 🌾' + d.cost : ''}</div>
    <div class="stats">${traits}${d.splash ? ' 💥주변 피해' : ''}</div></div></div><p class="fact">${d.fact}</p>`;
}

function updateTop() {
  const c = chap();
  $('#tbChapter').textContent = c.title;
  $('#tbStage').textContent = c.siege ? `${S.day}일째 — 남한산성을 지켜라` : `${stage().id}. ${stage().title}`;
  $('#tbGold').textContent = S.gold;
  $('#tbCap').textContent = `${S.board.length}/${S.cap}`;
  if (c.siege) { $('#mFood').style.width = S.food + '%'; $('#mWood').style.width = S.wood + '%'; }
}

function renderAll() {
  updateTop();
  if (S.phase === 'prep') { renderBoardPrep(); renderShop(); }
  renderBench(); renderTraits(); renderInfo();
}

// ───────── 전투 ─────────
$('#btnFight').onclick = () => {
  if (S.phase !== 'prep') return;
  if (!S.board.length) { play('error'); toast('장기판 아래쪽에 군사를 먼저 놓아 주세요'); return; }
  startBattle();
};
$('#btnSpeed').onclick = () => {
  S.speed = S.speed === 1 ? 2 : 1;
  $('#btnSpeed').textContent = S.speed === 1 ? '빠르게 ×2' : '보통 속도';
};

let timer = null;
function startBattle() {
  play('ok');
  S.phase = 'battle'; S.sel = null;
  $('#prepControls').classList.add('hidden');
  $('#battleControls').classList.remove('hidden');
  const c = chap();
  const players = S.board.map(b => ({ type: b.u.type, star: b.u.star, x: b.x, y: b.y }));
  let opts = {};
  if (c.siege) {
    players.push({ type: 'castle', star: 1, x: 2, y: 5 });
    const m = siegeMul();
    opts = { surviveTicks: c.surviveTicks, atkMul: m.atk * (S.meetBuff === 'fight' ? 1.2 : 1), hpMul: m.hp };
    $('#battleMsg').textContent = '성을 지켜라! 버티는 중…';
  } else {
    opts = { mult: stage().mult };
    $('#battleMsg').textContent = '전투 중!';
  }
  const bt = createBattle(players, enemiesNow(), opts);
  S.battle = bt;
  // 전투용 말 그리기
  boardBase();
  const b = $('#board');
  b.insertAdjacentHTML('beforeend', bt.units.map(u => pieceHTML(u.type, u.star, { x: u.x, y: u.y, id: u.id, hp: !u.fixed || true })).join(''));
  sizeBoard();
  renderTraits();
  const tick = () => {
    const ev = stepBattle(bt);
    drawEvents(ev);
    if (c.siege && !bt.over) $('#battleMsg').textContent = `성을 지켜라! 남은 시간 ${Math.max(0, Math.ceil((bt.surviveTicks - bt.tick) * (S.speed === 2 ? 0.19 : 0.38)))}초`;
    if (bt.over) { clearInterval(timer); timer = null; setTimeout(() => endBattle(bt.result), 700); }
  };
  let last = 0;
  clearInterval(timer);
  timer = setInterval(() => {
    last += 1;
    if (S.speed === 2 || last % 2 === 0) tick();
  }, 190);
}

function pieceEl(id) { return $('#board').querySelector(`.piece[data-id="${id}"]`); }
function drawEvents(ev) {
  const bt = S.battle;
  for (const e of ev) {
    if (e.k === 'move') {
      const el = pieceEl(e.id); if (el) { el.style.left = e.x * 16.6667 + '%'; el.style.top = e.y * 16.6667 + '%'; }
    } else if (e.k === 'atk') {
      const a = bt.units[e.from], t = bt.units[e.to];
      const el = pieceEl(e.from);
      if (e.ranged) {
        const s = document.createElement('div');
        s.className = 'shot ' + a.side + (UNITS[a.type].boom || a.type === 'mingGun' || a.type === 'gunner' ? ' boom' : '');
        s.style.left = a.x * 16.6667 + '%'; s.style.top = a.y * 16.6667 + '%';
        $('#board').appendChild(s);
        requestAnimationFrame(() => requestAnimationFrame(() => { s.style.left = t.x * 16.6667 + '%'; s.style.top = t.y * 16.6667 + '%'; }));
        setTimeout(() => s.remove(), 260);
      } else if (el) { el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge'); }
      play(UNITS[a.type].boom || a.type === 'mingGun' || a.type === 'gunner' || a.type === 'rocket' ? 'boom' : 'hit', .35);
    } else if (e.k === 'dmg') {
      const u = bt.units[e.id], el = pieceEl(e.id);
      if (el) {
        const bar = el.querySelector('.hp i'); if (bar) bar.style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      }
      const d = document.createElement('div');
      d.className = 'dmg'; d.textContent = '-' + e.dmg;
      d.style.left = u.x * 16.6667 + '%'; d.style.top = u.y * 16.6667 + '%';
      $('#board').appendChild(d); setTimeout(() => d.remove(), 700);
    } else if (e.k === 'die') {
      const el = pieceEl(e.id); if (el) el.classList.add('dead');
    }
  }
}

function endBattle(result) {
  const c = chap();
  if (c.siege) return endSiegeDay(result);
  const st = stage();
  if (result === 'win' || st.scripted) {
    const won = result === 'win';
    play(won ? 'win' : 'lose');
    const title = won ? '승리!' : '패배…';
    modal(`<div class="big-result ${won ? 'win' : 'lose'}">${title}</div><p>${won ? '조선군이 이겼어요!' : '조총을 가진 일본군이 너무 강했어요.'}</p><button class="btn big" id="rNext">계속</button>`, (box) => {
      box.querySelector('#rNext').onclick = () => { closeModal(); afterStage(won); };
    });
  } else {
    play('lose');
    modal(`<div class="big-result lose">아쉬워요!</div><p>군사를 다른 자리에 놓거나, 군사를 더 사거나, 같은 군사 3명을 모아 ★2를 만들어 다시 도전해 보세요.</p><p><b>위로 군량 +3</b></p><button class="btn big" id="rRetry">다시 도전</button>`, (box) => {
      box.querySelector('#rRetry').onclick = () => { closeModal(); S.gold += 3; enterPrep(true); };
    });
  }
}

function afterStage(won) {
  const c = chap(), st = stage();
  const lines = won || !st.scripted ? st.win : st.lose;
  const steps = [
    (n) => showStory(st.scripted && won ? st.win.concat(st.lose.slice(1)) : lines, n),
  ];
  if (st.map) steps.push((n) => showMap(st.map, n));
  steps.push((n) => showQuiz(st.quiz, n));
  steps.push((n) => { S.gold += st.reward.gold; S.cap += st.reward.cap; n(); });
  seq(steps, () => {
    if (S.stage + 1 < c.stages.length) startStage(S.stage + 1);
    else endChapter();
  });
}

function endChapter() {
  const c = chap();
  const steps = [(n) => showStory(c.outro, n)];
  if (c.id === 1) steps.push((n) => showMap('all', n));
  if (c.damage) steps.push((n) => showDamage('전쟁의 결과', c.damage, n));
  if (c.endQuiz) steps.push((n) => showQuiz(c.endQuiz, n));
  steps.push((n) => showSummary(c, n));
  seq(steps, () => { save.cleared[c.id] = true; writeSave(); renderChapters(); show('chapters'); });
}

function showDamage(title, cards, done) {
  play('page');
  modal(`<h3>${title}</h3><div class="dmg-cards">${cards.map((d, i) => `<div class="dmg-card" style="animation-delay:${i * .6}s"><span class="ic">${d.icon}</span><span>${d.text}</span></div>`).join('')}</div><button class="btn big" id="dNext">다음</button>`, (box) => {
    box.querySelector('#dNext').onclick = () => { closeModal(); done(); };
  });
}

function showSummary(c, done) {
  const html = c.summary.text.replace(/\[([^\]]+)\]/g, (_, w) => `<span class="blank">${w}</span>`);
  modal(`<h3>📖 교과서 정리</h3><p class="muted">빈칸에 들어갈 말을 떠올린 뒤 눌러서 확인해 보세요.</p><p class="summary">${html}</p><button class="btn big" id="sNext">${c.title.split('.')[0]} 완료!</button>`, (box) => {
    box.querySelectorAll('.blank').forEach(b => b.onclick = () => { b.classList.add('open'); play('click'); });
    box.querySelector('#sNext').onclick = () => { play('win'); closeModal(); done(); };
  });
}

// ───────── 병자호란(버티기) ─────────
function endSiegeDay(result) {
  const c = chap();
  if (result === 'win') {
    S.held = S.day;
    play('win');
    S.food = Math.max(0, S.food - 20); S.wood = Math.max(0, S.wood - 20);
    updateTop();
    const last = S.day >= c.days;
    modal(`<div class="big-result win">${S.day}일째를 버텼어요!</div><p>하지만 성안의 🍚식량과 🔥땔감은 또 줄었어요.<br>(식량 ${S.food}, 땔감 ${S.wood})</p><button class="btn big" id="sdNext">계속</button>`, (box) => {
      box.querySelector('#sdNext').onclick = () => {
        closeModal();
        if (S.meetBuff) S.meetBuff = null;
        if (last) return surrender(false);
        if (S.day === c.meeting.after) return showMeeting(() => startDay(S.day + 1));
        startDay(S.day + 1);
      };
    });
  } else {
    play('lose');
    modal(`<div class="big-result lose">성이 위태로워요!</div><p>청군의 공격을 막아 내기 어려워졌어요.</p><button class="btn big" id="sdNext">계속</button>`, (box) => {
      box.querySelector('#sdNext').onclick = () => { closeModal(); surrender(true); };
    });
  }
}

function showMeeting(done) {
  const m = chap().meeting;
  modal(`<h3>🏯 성안의 회의</h3><p>${m.text}</p><div class="meeting">
    <button class="opinion" data-k="fight"><b>⚔ ${m.fight.who}</b>${m.fight.text}<small>${m.fight.effect}</small></button>
    <button class="opinion" data-k="peace"><b>🕊 ${m.peace.who}</b>${m.peace.text}<small>${m.peace.effect}</small></button>
  </div>`, (box) => {
    box.querySelectorAll('.opinion').forEach(b => b.onclick = () => {
      S.meetBuff = b.dataset.k; play('ok');
      box.innerHTML = `<h3>🏯 성안의 회의</h3><p>여러분은 <b>${b.dataset.k === 'fight' ? m.fight.who : m.peace.who}</b>의 의견에 손을 들었어요.</p><div class="why">${m.after_text}</div><p><button class="btn big" id="mNext">다음 날로</button></p>`;
      box.querySelector('#mNext').onclick = () => { closeModal(); done(); };
    });
  });
}

function surrender(early) {
  const c = chap();
  const held = S.held;
  if (held > save.best3) save.best3 = held;
  const stars = held >= 4 ? 3 : held >= 2 ? 2 : 1;
  const lines = (early ? [{ who:'이야기', text:'청군의 포위는 점점 더 단단해지고, 성안은 춥고 배고팠어요.' }] : []).concat(c.surrender);
  seq([
    (n) => showStory(lines, n),
    (n) => showDamage('전쟁의 결과', c.damage, n),
    (n) => {
      play('page');
      modal(`<h3>남한산성 버티기 기록</h3><div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><p><b>${held}일</b> 동안 남한산성을 지켜 냈어요.</p><div class="why">역사의 결과는 바꿀 수 없어요. 하지만 그때 성안의 사람들이 추위와 배고픔 속에서 어떤 고민을 했는지 생각해 보는 것이 중요해요.</div><p><button class="btn big" id="eNext">다음</button></p>`, (box) => {
        box.querySelector('#eNext').onclick = () => { closeModal(); n(); };
      });
    },
    (n) => showQuiz(c.endQuiz, n),
    (n) => showSummary(c, n),
  ], () => { save.cleared[c.id] = true; writeSave(); renderChapters(); show('chapters'); });
}

// ───────── 1장 지도 ─────────
const KOREA = 'M40,110 L55,104 L70,95 L100,78 L130,62 L160,50 L186,40 L215,32 L240,26 L266,20 L258,40 L246,56 L232,74 L214,92 L204,108 L202,126 L214,150 L226,180 L236,214 L242,250 L244,282 L238,306 L228,326 L214,338 L196,340 L176,344 L156,348 L134,352 L112,356 L94,350 L86,334 L90,316 L96,298 L92,278 L98,258 L102,238 L92,224 L76,214 L58,206 L64,192 L80,184 L90,168 L82,152 L70,140 L56,128 L44,118 Z';
function showMap(key, done) {
  if (key !== 'all' && !S.maps.includes(key)) S.maps.push(key);
  const has = (k) => key === 'all' || S.maps.includes(k);
  const flag = (x, y, c, n) => `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-16" stroke="#3a2a10" stroke-width="1.5"/><path d="M0,-16 L12,-12 L0,-8 Z" fill="${c}"/>${n ? `<text x="2" y="10" font-size="8" fill="#3a2a10">${n}</text>` : ''}</g>`;
  const gun4 = [[166,64],[148,72],[130,80],[112,90]].map((p, i) => flag(p[0], p[1], '#1f4e8c', '')).join('');
  const jin6 = [[204,50],[216,47],[228,44],[240,41],[251,38],[260,35]].map(p => flag(p[0], p[1], '#2f7a4f', '')).join('');
  const msg = { tsushima:'쓰시마섬을 공격해 왜구의 항복을 받았어요!', '4gun':'압록강 유역에 4군을 설치했어요!', '6jin':'두만강 유역에 6진을 설치했어요!', all:'세종 때 넓어진 조선의 영토' }[key];
  const svg = `<svg viewBox="0 -20 300 420" role="img" aria-label="조선 지도">
    <rect x="0" y="-20" width="300" height="420" fill="#cfe5f2"/>
    <path d="M0,-20 L300,-20 L300,14 L266,20 L240,26 L215,32 L186,40 L160,50 L130,62 L100,78 L70,95 L55,104 L40,110 L0,118 Z" fill="#e7dcc3"/>
    <path d="${KOREA}" fill="#f6e7c1" stroke="#8a6a3a" stroke-width="2"/>
    <path d="M184,40 L160,50 L130,62 L100,78 L70,95 L55,104 L40,110" fill="none" stroke="#2e7fbf" stroke-width="${has('4gun') ? 4 : 2.5}"/>
    <path d="M188,39 L215,32 L240,26 L266,20" fill="none" stroke="#2e7fbf" stroke-width="${has('6jin') ? 4 : 2.5}"/>
    <polygon points="186,30 180,40 192,40" fill="#7a6a58"/><text x="172" y="56" font-size="9" fill="#5a4a38">백두산</text>
    <text x="62" y="86" font-size="12" font-weight="700" fill="#1d5f99" transform="rotate(-28 62 86)">압록강</text>
    <text x="212" y="20" font-size="12" font-weight="700" fill="#1d5f99" transform="rotate(-14 212 20)">두만강</text>
    <text x="130" y="220" font-size="22" font-weight="900" fill="#8a6a3a" font-family="serif">조선</text>
    <text x="110" y="40" font-size="12" fill="#7a6a58">여진</text>
    <ellipse cx="262" cy="372" rx="6" ry="14" fill="#f6e7c1" stroke="#8a6a3a" stroke-width="1.5"/>
    <text x="222" y="398" font-size="11" font-weight="700" fill="#5a4a38">쓰시마섬</text>
    ${has('tsushima') ? flag(262, 362, '#b02a24', '') + '<text x="224" y="352" font-size="10" font-weight="900" fill="#b02a24">항복!</text>' : ''}
    ${has('4gun') ? gun4 + '<text x="112" y="110" font-size="13" font-weight="900" fill="#1f4e8c">4군</text>' : ''}
    ${has('6jin') ? jin6 + '<text x="216" y="66" font-size="13" font-weight="900" fill="#2f7a4f">6진</text>' : ''}
  </svg>`;
  play('ok');
  modal(`<h3>🗺 ${msg}</h3><div class="map-wrap">${svg}</div><p class="muted" style="font-size:.85rem">그림 지도(대략적인 모양)</p><button class="btn big" id="mpNext">다음</button>`, (box) => {
    box.querySelector('#mpNext').onclick = () => { closeModal(); done(); };
  });
}

// ───────── 메뉴 ─────────
function syncSoundBtn() { $('#btnSound').textContent = save.sound ? '🔊 소리 끄기' : '🔇 소리 켜기'; }
$('#btnMenu').onclick = () => { syncSoundBtn(); $('#menu').classList.remove('hidden'); };
$('#btnCloseMenu').onclick = () => $('#menu').classList.add('hidden');
$('#btnSound').onclick = () => { save.sound = !save.sound; writeSave(); syncSoundBtn(); };
$('#btnRestartCh').onclick = () => {
  $('#menu').classList.add('hidden'); clearInterval(timer); timer = null;
  closeModal(); $('#story').classList.add('hidden'); startChapter(S.ch);
};
$('#btnToChapters').onclick = () => {
  $('#menu').classList.add('hidden'); clearInterval(timer); timer = null;
  closeModal(); $('#story').classList.add('hidden'); renderChapters(); show('chapters');
};
