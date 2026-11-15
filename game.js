/* 조선 수호 장기 — 화면과 진행 (코드로 직접 만듦) */
const VERSION = 'v1.012';
const $ = (s) => document.querySelector(s);
const BENCH = 6, SHOP_N = 5, TRAY_MAX = 8;
const HW = 100 / (COLS + 0.5);            // 육각 칸 너비(% of board)
const BH = 0.75 * (ROWS - 1) + 1;         // 판 높이(칸 높이 단위)
const HH = 100 / BH;                      // 육각 칸 높이(% of board)
const hexLeft = (x, y) => (x + (y & 1) * 0.5) * HW;
const hexTop = (y) => y * 0.75 * HH;

// ───────── 저장 ─────────
const SAVE_KEY = 'joseonJanggi';
let save = { cleared: {}, best3: 0, sound: true, music: true };
try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); if (v) save = Object.assign(save, v); } catch (e) {}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ───────── 소리 ─────────
const SND = {};
['click','ok','place','hit','boom','coin','page','error','win','lose'].forEach(n => { SND[n] = new Audio('sounds/' + n + '.mp3'); SND[n].preload = 'auto'; });
let lastHit = 0;
function play(n, vol = 0.6) {
  if (!save.sound) return;
  if (n === 'hit' || n === 'boom') { const t = performance.now(); if (t - lastHit < 80) return; lastHit = t; }
  if (n === 'win' || n === 'lose') musicDuck();
  try { const a = SND[n].cloneNode(); a.volume = vol; a.play().catch(() => {}); } catch (e) {}
}

// ───────── 배경 음악 (art/gen-bgm.js로 코드로 직접 만든 국악풍 곡, 끊김 없이 되풀이) ─────────
// title: 시작·장 고르기(평조 대금) / prep: 군사 준비(굿거리) / battle: 전투(자진모리 태평소·북) / siege: 남한산성(계면조 해금)
const BGM_VOL = 0.42;
const BGM = { ctx: null, master: null, cur: null, want: null, bufs: {}, loading: {}, nodes: null };
function bgmCtx() {
  if (BGM.ctx) return BGM.ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  BGM.ctx = new AC(); BGM.master = BGM.ctx.createGain(); BGM.master.gain.value = BGM_VOL; BGM.master.connect(BGM.ctx.destination);
  return BGM.ctx;
}
function bgmLoad(n) {
  if (!BGM.loading[n]) BGM.loading[n] = fetch('sounds/bgm-' + n + '.mp3').then(r => r.arrayBuffer())
    .then(a => new Promise((ok, no) => BGM.ctx.decodeAudioData(a, ok, no))).then(b => (BGM.bufs[n] = b))
    .catch(() => { delete BGM.loading[n]; return null; });
  return BGM.loading[n];
}
function bgmFadeOut(nodes, sec = 1) {
  if (!nodes) return; const t = BGM.ctx.currentTime;
  try { nodes.g.gain.cancelScheduledValues(t); nodes.g.gain.setValueAtTime(nodes.g.gain.value, t); nodes.g.gain.linearRampToValueAtTime(0, t + sec); nodes.src.stop(t + sec + 0.05); } catch (e) {}
}
function music(name) {
  if (name) BGM.want = name;
  if (!save.music || !BGM.ctx || BGM.ctx.state !== 'running') return;
  if (BGM.cur === BGM.want) return;
  const n = BGM.want; BGM.cur = n;
  bgmFadeOut(BGM.nodes); BGM.nodes = null;
  bgmLoad(n).then(buf => {
    if (!buf || BGM.cur !== n || !save.music) return;
    const src = BGM.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = BGM.ctx.createGain(); const t = BGM.ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 1.5);
    src.connect(g); g.connect(BGM.master); src.start(t);
    BGM.nodes = { src, g };
  });
}
function musicStop() { if (BGM.ctx) bgmFadeOut(BGM.nodes, 0.4); BGM.nodes = null; BGM.cur = null; }
// 승리·패배 음악이 나올 때 잠깐 작게
function musicDuck(sec = 3) {
  if (!BGM.master) return; const t = BGM.ctx.currentTime, g = BGM.master.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(BGM_VOL * 0.25, t + 0.3);
  g.setValueAtTime(BGM_VOL * 0.25, t + sec); g.linearRampToValueAtTime(BGM_VOL, t + sec + 1.5);
}
const prepTrack = () => (S && chap().siege ? 'siege' : 'prep');
// 브라우저는 처음 터치한 뒤에만 소리를 낼 수 있음
function musicUnlock() {
  const c = bgmCtx(); if (!c) return;
  const go = () => music();
  if (c.state !== 'running') c.resume().then(go, () => {}); else go();
}
document.addEventListener('pointerdown', musicUnlock, true);
document.addEventListener('keydown', musicUnlock, true);
document.addEventListener('visibilitychange', () => {
  if (!BGM.ctx) return;
  if (document.hidden) BGM.ctx.suspend().catch(() => {}); else BGM.ctx.resume().then(() => music(), () => {});
});

// ───────── 상태 ─────────
let S = null;
let uidSeq = 1;
const newUnit = (type, star = 1) => ({ uid: uidSeq++, type, star, items: [] });
const chap = () => CHAPTERS[S.ch];
const stage = () => (chap().stages ? chap().stages[S.stage] : null);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function show(id) {
  ['title','chapters','game'].forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
  if (id === 'game') requestAnimationFrame(sizeBoard);
  music(id === 'game' ? prepTrack() : 'title');
}
document.querySelectorAll('.ver').forEach(e => e.textContent = VERSION);
function toast(msg, ms = 1500) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function seq(steps, done) { let i = 0; const next = () => { if (i < steps.length) steps[i++](next); else if (done) done(); }; next(); }

// ───────── 이야기 상자 ─────────
function showStory(lines, done) {
  if (!lines || !lines.length) { done && done(); return; }
  let i = 0;
  const box = $('#story');
  const render = () => {
    const l = lines[i], who = $('#storyWho');
    who.textContent = l.who + (l.more ? ' · 📜 더 알아보기' : '');
    who.className = 'story-who' + (['세종','인조'].includes(l.who) ? ' king' : l.who === '안내' ? ' guide' : l.who === '성 밖 소식' ? ' news' : '');
    $('#storyText').textContent = l.text;
    $('#storyPage').textContent = (i + 1) + ' / ' + lines.length;
    $('#btnStoryNext').textContent = i === lines.length - 1 ? '확인 ✔' : '다음 ▶';
    $('#btnStoryPrev').style.visibility = i > 0 ? 'visible' : 'hidden';
  };
  box.classList.remove('hidden'); render(); play('page', .4);
  $('#btnStoryNext').onclick = () => { i++; if (i >= lines.length) { box.classList.add('hidden'); document.onkeydown = null; done && done(); } else { render(); play('page', .4); } };
  $('#btnStoryPrev').onclick = () => { if (i > 0) { i--; render(); play('page', .4); } };
  // 키보드: ← 이전, → 또는 Enter 다음
  document.onkeydown = (e) => {
    if (box.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') $('#btnStoryPrev').click();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); $('#btnStoryNext').click(); }
  };
}

// ───────── 범용 창 ─────────
function modal(html, bind) { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); bind && bind($('#modalBox')); }
function closeModal() { $('#modal').classList.add('hidden'); }

const shuffled = (n) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 순서 맞추기 / 원인→결과 잇기: 다 고르면 「확인」, 맞으면 군량 +2
function showQuizSteps(qz, done, o) {
  const head = `<h3>${o.title || '📜 역사 퀴즈'}${o.tag ? ` <span class="qtag">${o.tag}</span>` : ''}</h3>${o.sub ? `<p class="muted small">${o.sub}</p>` : ''}<p class="q">${qz.q}</p>`;
  const LET = ['㉠', '㉡', '㉢', '㉣'];
  let body, picked, ready, isRight, answerHTML;
  if (qz.kind === 'order') {
    const ord = shuffled(qz.a.length); picked = [];
    body = `<div class="order">${ord.map(i => `<button class="btn choice ocard" data-i="${i}"><span class="onum"></span>${qz.a[i]}</button>`).join('')}</div><p class="muted small">일어난 차례대로 누르세요. 다시 누르면 취소돼요.</p>`;
    ready = () => picked.length === qz.a.length;
    isRight = () => picked.every((v, i) => v === i);
    answerHTML = () => `<ol class="ans">${qz.a.map(t => `<li>${t}</li>`).join('')}</ol>`;
  } else {
    const eff = shuffled(qz.pairs.length); picked = qz.pairs.map(() => -1);
    body = `<div class="effects"><div class="etag">결과 보기 (그래서 어떻게 되었나?)</div>${eff.map((pi, k) => `<div><b>${LET[k]}</b> ${qz.pairs[pi][1]}</div>`).join('')}</div>
      <div class="match"><div class="mhead"><span class="h-cause">원인 (왜?)</span><span class="h-eff">결과 고르기</span></div>
      ${qz.pairs.map((p, ci) => `<div class="mrow"><div class="cause"><span class="ctag">원인</span>${p[0]}</div><span class="marrow">➜</span><div class="mbtns">${eff.map((pi, k) => `<button class="btn mbtn" data-c="${ci}" data-e="${pi}">${LET[k]}</button>`).join('')}</div></div>`).join('')}</div>
      <p class="muted small"><b>원인</b>(빨간 표)마다 알맞은 <b>결과</b>(㉠㉡㉢)를 골라요.</p>`;
    ready = () => picked.every(v => v >= 0);
    isRight = () => picked.every((v, ci) => v === ci);
    answerHTML = () => `<ul class="ans">${qz.pairs.map(p => `<li><span class="ctag">원인</span>${p[0]} ➜ <span class="etag2">결과</span><b>${p[1]}</b></li>`).join('')}</ul>`;
  }
  modal(`${head}${body}<p><button class="btn big" id="qCheck" disabled>확인</button></p><div id="qAfter"></div>`, (box) => {
    const chk = box.querySelector('#qCheck');
    const sync = () => {
      if (qz.kind === 'order') box.querySelectorAll('.ocard').forEach(b => { const k = picked.indexOf(+b.dataset.i); b.querySelector('.onum').textContent = k >= 0 ? (k + 1) + '. ' : ''; b.classList.toggle('on', k >= 0); });
      else box.querySelectorAll('.mbtn').forEach(b => b.classList.toggle('on', picked[+b.dataset.c] === +b.dataset.e));
      chk.disabled = !ready();
    };
    if (qz.kind === 'order') box.querySelectorAll('.ocard').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, k = picked.indexOf(i);
      if (k >= 0) picked.splice(k); else picked.push(i);
      play('click', .3); sync();
    });
    else box.querySelectorAll('.mbtn').forEach(b => b.onclick = () => { picked[+b.dataset.c] = +b.dataset.e; play('click', .3); sync(); });
    chk.onclick = () => {
      const right = isRight();
      box.querySelectorAll('.ocard, .mbtn').forEach(b => { b.disabled = true; });
      chk.remove();
      let msg;
      if (right) { play('coin'); S.gold += 2; updateTop(); msg = `<b>정답! 군량 +2${o.okMore || ''}</b>`; }
      else { play('error'); msg = `<b>아쉬워요! 바른 답을 확인해 보세요.${o.wrongMore || ''}</b>${answerHTML()}`; }
      box.querySelector('#qAfter').innerHTML = `<div class="why">${msg}${qz.why}</div><p><button class="btn big" id="qNext">다음</button></p>`;
      box.querySelector('#qNext').onclick = () => { closeModal(); done(right); };
    };
  });
}
function showQuiz(qz, done, o = {}) {
  if (!qz) { done(false); return; }
  if (qz.kind) return showQuizSteps(qz, done, o);
  const order = qz.a.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  modal(`<h3>${o.title || '📜 역사 퀴즈'}${o.tag ? ` <span class="qtag">${o.tag}</span>` : ''}</h3>${o.sub ? `<p class="muted small">${o.sub}</p>` : ''}<p class="q">${qz.q}</p><div>${order.map(i => `<button class="btn choice" data-i="${i}">${qz.a[i]}</button>`).join('')}</div><div id="qAfter"></div>`, (box) => {
    box.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      const pick = +b.dataset.i;
      box.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (+x.dataset.i === qz.ok) x.classList.add('right'); });
      let msg;
      if (pick === qz.ok) { play('coin'); S.gold += 2; updateTop(); msg = `<b>정답! 군량 +2${o.okMore || ''}</b>`; }
      else { b.classList.add('wrong'); play('error'); msg = `<b>아쉬워요! 정답을 확인해 보세요.${o.wrongMore || ''}</b>`; }
      box.querySelector('#qAfter').innerHTML = `<div class="why">${msg}<br>${qz.why}</div><p><button class="btn big" id="qNext">다음</button></p>`;
      box.querySelector('#qNext').onclick = () => { closeModal(); done(pick === qz.ok); };
    });
  });
}

// ───────── 작전 회의: 전투 전에 앞에서 배운 것을 떠올리기 ─────────
// 단계 퀴즈는 그 단계 바로 뒤가 아니라 다음 전투 전에 물어봄(시간을 두고 떠올리면 오래 기억해요).
// 틀린 문제는 S.retry에 남아 다음 작전 회의에 다시 나옴.
const BRIEF_MANA = 20;
function quizByKey(k) {
  if (EXTRA_QUIZ[k]) return { qz: EXTRA_QUIZ[k], ch: EXTRA_QUIZ[k].ch };
  for (const c of CHAPTERS) for (const st of (c.stages || [])) if (st.id === k) return { qz: st.quiz, ch: c.id };
  return null;
}
const quizReady = (k) => { const r = quizByKey(k); return r && r.qz && (r.ch === chap().id || save.cleared[r.ch]) && (r.qz.need || []).every(c => save.cleared[c]); };
function runBrief(keys, done, final) {
  const list = [];
  S.retry.forEach(k => { if (list.length < 2 && !list.includes(k)) list.push(k); });
  keys.forEach(k => { if (list.length < 3 && !list.includes(k) && quizReady(k)) list.push(k); });
  if (final) S.retry.forEach(k => { if (!list.includes(k)) list.push(k); });
  if (!list.length) return done();
  let ok = 0, i = 0;
  const next = () => {
    if (i >= list.length) {
      if (!final) {
        S.briefMana = ok * BRIEF_MANA;
        toast(ok ? `🗺 작전 성공! 이번 전투에서 모든 군사의 마나 +${S.briefMana}` : '🗺 틀린 문제는 다음 작전 회의에서 다시 나와요', 2400);
      }
      return done();
    }
    const k = list[i++], qz = quizByKey(k).qz, again = S.retry.includes(k);
    showQuiz(qz, (right) => {
      S.quizLog.total++;
      if (right) { ok++; S.quizLog.ok++; S.retry = S.retry.filter(x => x !== k); }
      else if (!S.retry.includes(k)) S.retry.push(k);
      next();
    }, {
      title: `${final ? '📜 마지막 점검' : '🗺 작전 회의'} ${i}/${list.length}`,
      tag: [again ? '🔁 다시 풀기' : '', qz.more ? '📜 더 알아보기' : ''].filter(Boolean).join(' · '),
      sub: i === 1 ? (final ? '이번 장에서 배운 것을 마지막으로 떠올려 봐요.' : '싸우기 전에, 지난번에 배운 것을 떠올려 봐요. 맞힐 때마다 🌾 군량 +2, 그리고 이번 전투에서 모든 군사의 마나가 더 찬 채로 시작해요!') : '',
      okMore: final ? '' : ` · 마나 +${BRIEF_MANA}`,
      wrongMore: final ? '' : ' 이 문제는 다음 작전 회의에 다시 나와요.',
    });
  };
  next();
}

// ───────── 시작 화면, 장 선택 ─────────
$('#btnStart').onclick = () => { play('click'); renderChapters(); show('chapters'); };
$('#btnBackTitle').onclick = () => { play('click'); show('title'); };
function renderChapters() {
  const list = $('#chapterList'); list.innerHTML = '';
  CHAPTERS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'ch-card'; b.style.setProperty('--cc', c.color);
    const desc = ['쓰시마섬을 공격하고, 압록강과 두만강의 여진을 몰아내요.', '조총을 가진 일본군을 수군·의병·명군의 힘으로 막아요.', '청군에 포위된 남한산성을 최대한 오래 지켜요.'][i];
    const faces = [['leeJM','choiYD','kimJS'], ['yiSS','turtle','militia'], ['castle','qing','qingG']][i];
    let status = save.cleared[c.id] ? '✔ 완료' : '▶ 시작';
    if (c.siege && save.cleared[c.id]) status = `✔ 완료 · 최고 ${save.best3}일 버팀`;
    b.innerHTML = `<div class="ch-faces">${faces.map(f => `<span class="mini">${spriteHTML(f)}</span>`).join('')}</div><h3>${c.title}</h3><p>${desc}</p><div class="ch-status">${status}</div>`;
    b.onclick = () => { play('click'); startChapter(i); };
    list.appendChild(b);
  });
}

// ───────── 장 진행 ─────────
function startChapter(i) {
  const c = CHAPTERS[i];
  S = { ch: i, stage: 0, day: 1, gold: c.startGold, level: c.startLevel, xp: 0, streak: 0,
        bench: Array(BENCH).fill(null), board: [], items: [], shop: [], phase: 'prep',
        sel: null, info: null, maps: [], food: 100, wood: 100, held: 0, meetBuff: null, speed: 1, firstRoll: true,
        retry: [], briefMana: 0, quizLog: { ok: 0, total: 0 }, seen: new Set(), said: new Set(), flags: {} };
  show('game');
  $('#tbSiege').classList.toggle('hidden', !c.siege);
  updateTop();
  showStory(c.intro, () => c.siege ? startDay(1) : startStage(0));
}
function startStage(i) {
  S.stage = i; S.firstRoll = true; S.briefMana = 0; S.pass = null;
  fixDeployment();
  showStory(stage().pre, () => runBrief(stage().brief || [], () => choosePass(() => enterPrep(true))));
}
function startDay(d) {
  const c = chap();
  S.day = d; S.briefMana = 0; updateTop();
  const lines = [{ who:'안내', text:`${d}일째 아침이에요. 🍚 식량 ${S.food}, 🔥 땔감 ${S.wood} 남았어요.` }].concat((c.news && c.news[d]) || []);
  showStory(lines, () => runBrief((c.dayBrief && c.dayBrief[d]) || [], () => enterPrep(true)));
}
// 2-1: 어디에서 막을지 고르기 (고른 곳에 따라 판이 달라짐)
function choosePass(done) {
  const ps = stage().pass;
  if (!ps) return done();
  modal(`<h3>🗺 작전 회의 — 어디에서 막을까?</h3><p>${ps.q}</p><div class="meeting">
    <button class="opinion" data-k="hill"><b>${ps.hillText}</b><small>${ps.hillMore}</small></button>
    <button class="opinion" data-k="field"><b>${ps.fieldText}</b><small>${ps.fieldMore}</small></button></div>`, (box) => {
    const go = () => { S.pass = 'field'; play('ok'); closeModal(); S.passAfter = ps.after; done(); };
    box.querySelectorAll('.opinion').forEach(b => b.onclick = () => {
      if (b.dataset.k === 'field' || !ps.forced) { S.pass = b.dataset.k; play('ok'); closeModal(); S.passAfter = ps.after; return done(); }
      // 실제 역사: 신립은 조령을 버리고 충주 탄금대 들판을 골랐다 → 학생이 고개를 골라도 들판에서 싸움
      play('error');
      const lines = ps.forced; let i = 0;
      const step = () => {
        const l = lines[i];
        box.innerHTML = `<h3>${l.title || '⚔ 장수 신립이 나섰어요'}</h3><div class="forced"><div class="face">${spriteHTML(ps.forcedFace)}<b>${l.who}</b></div>
          <div class="bubble">${l.text}</div></div>
          <div class="meeting dim"><div class="opinion x"><b>${ps.hillText}</b><small>신립이 받아들이지 않았어요</small></div><div class="opinion pick"><b>${ps.fieldText}</b><small>신립의 명령</small></div></div>
          <p><button class="btn big" id="fNext">${i < lines.length - 1 ? '다음 ▶' : '🐎 들판으로 나가 싸운다'}</button></p>`;
        box.querySelector('#fNext').onclick = () => { if (++i < lines.length) { play('page', .4); step(); } else go(); };
      };
      step();
    });
  });
}
// 판에 설 수 없는 군사(땅 판의 배, 바다 판의 군사)를 대기석으로 옮김. 자리가 없으면 팔아서 군량으로
function fixDeployment() {
  const cells = cellsNow();
  const moved = [];
  S.board = S.board.filter(o => {
    if (canStandType(o.u.type, cells[o.x + ',' + o.y] || '')) return true;
    [o.u].concat(o.u.cargo || []).forEach(u => { const fit = u === o.u ? u : Object.assign(u, {}); toBench(fit, moved); });
    o.u.cargo = [];
    return false;
  });
  if (moved.length) toast(moved.join(' · '), 2600);
}
function toBench(u, log) {
  const i = S.bench.indexOf(null);
  if (i >= 0) { S.bench[i] = u; if (log) log.push(`${UNITS[u.type].name} → 대기석`); }
  else { S.gold += sellPrice(u); u.items.forEach(it => S.items.push(it)); if (log) log.push(`${UNITS[u.type].name} 팔기 +${sellPrice(u)}`); }
}
const cellAt = (x, y) => cellsNow()[x + ',' + y] || '';
const deployed = () => S.board.reduce((n, o) => n + 1 + ((o.u.cargo || []).length), 0);
// 이 단계 판의 지형 칸
function cellsNow() { return chap().siege ? {} : stageCells(stage(), S.pass); }
function enemiesNow() {
  const c = chap();
  if (c.siege) { let w = c.waves[S.day - 1].slice(); if (S.meetBuff === 'peace') w = w.slice(0, Math.max(3, w.length - 2)); return w; }
  return stageEnemies(stage());
}
function poolNow() { return chap().siege ? chap().pool : stage().pool; }
function siegeMul() { return { atk: 0.6 + 0.4 * S.food / 100, hp: 0.6 + 0.4 * S.wood / 100 }; }

// ───────── 상점 ─────────
function rollShop() {
  const pool = poolNow();
  const odds = ODDS[S.level];
  S.shop = [];
  for (let i = 0; i < SHOP_N; i++) {
    let r = Math.random() * 100, tier = 1;
    for (let t = 0; t < 5; t++) { if (r < odds[t]) { tier = t + 1; break; } r -= odds[t]; }
    let cands = [];
    for (let t = tier; t >= 1 && !cands.length; t--) cands = pool.filter(u => UNITS[u].cost === t);
    if (!cands.length) cands = pool;
    S.shop.push(rnd(cands));
  }
  // 단계마다 처음 한 번은 그 단계의 장수를 꼭 보여 줌(역사 인물을 만나도록)
  const st = stage();
  if (S.firstRoll && st && st.feature && !allOwned().some(o => o.u.type === st.feature)) S.shop[SHOP_N - 1] = st.feature;
  S.firstRoll = false;
}
$('#btnReroll').onclick = () => {
  if (S.phase !== 'prep') return;
  if (S.gold < REROLL_COST) { play('error'); toast('군량이 부족해요'); return; }
  S.gold -= REROLL_COST; play('click'); rollShop(); renderAll();
};
$('#btnXp').onclick = () => {
  if (S.phase !== 'prep') return;
  if (S.level >= MAX_LEVEL) { toast('가장 높은 레벨이에요'); return; }
  if (S.gold < XP_COST) { play('error'); toast('군량이 부족해요'); return; }
  S.gold -= XP_COST; play('coin', .5); addXp(XP_BUY); renderAll();
};
function addXp(n) {
  S.xp += n;
  while (S.level < MAX_LEVEL && S.xp >= XP_NEED[S.level]) {
    S.xp -= XP_NEED[S.level]; S.level++;
    play('ok'); toast(`⬆ 레벨 ${S.level}! 이제 ${S.level}명까지 놓을 수 있어요`, 2000);
  }
  if (S.level >= MAX_LEVEL) S.xp = 0;
}

function allOwned() {
  const r = [];
  S.board.forEach((b, i) => { r.push({ where: 'board', i, u: b.u }); (b.u.cargo || []).forEach((c, j) => r.push({ where: 'cargo', ship: b.u, j, u: c })); });
  S.bench.forEach((u, i) => { if (u) r.push({ where: 'bench', i, u }); });
  return r;
}
function buy(i) {
  const t = S.shop[i];
  if (!t || S.phase !== 'prep') return;
  const d = UNITS[t];
  if (S.gold < d.cost) { play('error'); toast('군량이 부족해요'); return; }
  const slot = S.bench.indexOf(null);
  const same = allOwned().filter(o => o.u.type === t && o.u.star === 1).length;
  if (slot < 0 && same < 2) { play('error'); toast('대기석이 가득 찼어요. 군사를 팔거나 판에 놓아 주세요'); return; }
  S.gold -= d.cost; S.shop[i] = null; play('coin', .5);
  const u = newUnit(t);
  if (slot >= 0) S.bench[slot] = u; else S.bench.push(u);
  tryMerge();
  S.bench = S.bench.slice(0, BENCH); while (S.bench.length < BENCH) S.bench.push(null);
  S.info = { unit: u };
  renderAll();
}
function tryMerge() {
  let again = true;
  while (again) {
    again = false;
    const groups = {};
    allOwned().forEach(o => { if (o.u.star < 3) { const k = o.u.type + '|' + o.u.star; (groups[k] = groups[k] || []).push(o); } });
    for (const k in groups) {
      const g = groups[k];
      if (g.length < 3) continue;
      g.sort((a, b) => (a.where === 'board' ? 0 : 1) - (b.where === 'board' ? 0 : 1));
      const keep = g[0], gone = g.slice(1, 3);
      keep.u.star++;
      gone.forEach(o => { o.u.items.forEach(it => { if (keep.u.items.length < 3) keep.u.items.push(it); else S.items.push(it); }); });
      gone.forEach(o => { if (o.where === 'bench') S.bench[o.i] = null; });
      gone.filter(o => o.where === 'cargo').forEach(o => { o.ship.cargo = o.ship.cargo.filter(c => c !== o.u); });
      const rm = new Set(gone.filter(o => o.where === 'board').map(o => o.u.uid));
      S.board = S.board.filter(b => !rm.has(b.u.uid));
      play('ok'); toast(`✨ ${UNITS[keep.u.type].name} ${'★'.repeat(keep.u.star)} 합체!`);
      S.mergedUid = keep.u.uid;
      again = true; break;
    }
  }
}
$('#btnSell').onclick = () => {
  if (!S.sel || S.sel.item !== undefined || S.phase !== 'prep') return;
  let u;
  if (S.sel.where === 'bench') { u = S.bench[S.sel.i]; S.bench[S.sel.i] = null; }
  else {
    u = S.board[S.sel.i].u;
    if ((u.cargo || []).length && S.bench.filter(x => !x).length < u.cargo.length) { play('error'); toast('먼저 배에 탄 군사를 대기석으로 내려 주세요'); return; }
    (u.cargo || []).forEach(c => toBench(c)); u.cargo = [];
    S.board.splice(S.sel.i, 1);
  }
  const refund = sellPrice(u);
  u.items.forEach(it => S.items.push(it));
  S.gold += refund; S.sel = null; S.info = null; play('coin', .5); toast(`군량 +${refund}` + (u.items.length ? ' · 아이템은 돌려받았어요' : ''));
  renderAll();
};
const sellPrice = (u) => UNITS[u.type].cost * Math.pow(3, u.star - 1) - (u.star > 1 ? 1 : 0);

// ───────── 배치 ─────────
const boardAt = (x, y) => S.board.findIndex(b => b.x === x && b.y === y);
const castleCell = (x, y) => chap().siege && x === 3 && y === 5;
function selectedUnit() {
  if (!S.sel || S.sel.item !== undefined) return null;
  return S.sel.where === 'bench' ? S.bench[S.sel.i] : S.board[S.sel.i].u;
}
function giveItem(u) {
  const it = S.items[S.sel.item];
  if (u.items.length >= 3) { play('error'); toast('아이템은 3개까지 들 수 있어요'); return; }
  u.items.push(it); S.items.splice(S.sel.item, 1); S.sel = null; S.info = { unit: u };
  play('ok'); toast(`${UNITS[u.type].name}에게 ${ITEMS[it].name}!`);
}
function tapCell(x, y) {
  if (S.phase === 'battle') return tapBattle(x, y);
  if (S.phase !== 'prep') return;
  if (y < 3) {
    const e = enemiesNow().find(en => en[1] === x && en[2] === y);
    if (e) { S.info = { type: e[0] }; S.sel = null; play('click'); renderAll(); }
    return;
  }
  if (castleCell(x, y)) { S.info = { type: 'castle' }; S.sel = null; renderAll(); return; }
  const bi = boardAt(x, y);
  const moving = S.sel && S.sel.item === undefined ? selectedUnit() : null;
  if (moving && !(bi >= 0 && S.board[bi].u === moving)) {
    const cell = cellAt(x, y);
    const there = bi >= 0 ? S.board[bi].u : null;
    // 군사를 병선 위에 놓으면 배에 탐
    if (there && !UNITS[moving.type].naval && UNITS[there.type].carry && cell === 'water') {
      there.cargo = there.cargo || [];
      if (there.cargo.length >= UNITS[there.type].carry) { play('error'); toast(`${UNITS[there.type].name}에는 ${UNITS[there.type].carry}명까지 탈 수 있어요`); return; }
      if (S.sel.where === 'bench') { if (deployed() >= S.level) { play('error'); toast(`지금은 ${S.level}명까지 놓을 수 있어요. 「레벨업」을 해 보세요!`); return; } S.bench[S.sel.i] = null; }
      else S.board.splice(S.sel.i, 1);
      there.cargo.push(moving); play('place'); toast(`⛵ ${UNITS[moving.type].name}이(가) ${UNITS[there.type].name}에 탔어요`); S.sel = null; renderAll(); return;
    }
    if (!there && !canStandType(moving.type, cell)) {
      play('error');
      toast(cell === 'rock' ? '바위 칸에는 군사를 놓을 수 없어요'
        : UNITS[moving.type].naval ? '배는 물 칸에만 놓을 수 있어요'
        : chap().stages && stage() && stage().pool.some(t => UNITS[t].carry) ? '군사는 바다를 걸어서 건널 수 없어요. 병선 위에 놓아 배에 태워 보세요! (1척에 2명)' : '이 판의 바다에는 배만 나설 수 있어요', 2600);
      return;
    }
    if (there && S.sel.where === 'board') { const from = S.board[S.sel.i]; if (!canStandType(there.type, cellAt(from.x, from.y))) { play('error'); toast('그 자리는 서로 바꿀 수 없어요'); return; } }
    if (there && S.sel.where === 'bench' && !canStandType(moving.type, cell)) { play('error'); toast('그 칸에는 놓을 수 없어요'); return; }
  }
  if (S.sel && S.sel.item !== undefined) { if (bi >= 0) giveItem(S.board[bi].u); renderAll(); return; }
  if (!S.sel) { if (bi >= 0) { S.sel = { where: 'board', i: bi }; S.info = { unit: S.board[bi].u }; play('click'); } renderAll(); return; }
  if (S.sel.where === 'board') {
    const from = S.board[S.sel.i];
    if (bi === S.sel.i) { S.sel = null; renderAll(); return; }
    if (bi >= 0) { const o = S.board[bi]; [o.x, from.x] = [from.x, o.x]; [o.y, from.y] = [from.y, o.y]; }
    else { from.x = x; from.y = y; }
  } else {
    const u = S.bench[S.sel.i];
    if (bi >= 0) { const o = S.board[bi]; S.bench[S.sel.i] = o.u; o.u = u; }
    else {
      if (deployed() >= S.level) { play('error'); toast(`지금은 ${S.level}명까지 놓을 수 있어요. 「레벨업」을 해 보세요!`); return; }
      S.board.push({ u, x, y }); S.bench[S.sel.i] = null;
    }
  }
  play('place'); S.sel = null; renderAll();
}
function tapBench(i) {
  if (S.phase !== 'prep') return;
  const u = S.bench[i];
  if (S.sel && S.sel.item !== undefined) { if (u) giveItem(u); renderAll(); return; }
  if (!S.sel) { if (u) { S.sel = { where: 'bench', i }; S.info = { unit: u }; play('click'); } renderAll(); return; }
  if (S.sel.where === 'bench') {
    if (S.sel.i === i) { S.sel = null; renderAll(); return; }
    [S.bench[i], S.bench[S.sel.i]] = [S.bench[S.sel.i], S.bench[i]];
    S.sel = null;
  } else {
    const b = S.board[S.sel.i];
    if (!u && (b.u.cargo || []).length) { const c = b.u.cargo.pop(); S.bench[i] = c; S.sel = null; play('place'); toast(`${UNITS[c.type].name}이(가) 배에서 내렸어요`); renderAll(); return; }
    if (u && !canStandType(u.type, cellAt(b.x, b.y))) { play('error'); toast('그 군사는 그 칸에 설 수 없어요'); return; }
    if (u) { S.bench[i] = b.u; b.u = u; } else { S.bench[i] = b.u; S.board.splice(S.sel.i, 1); }
    S.sel = null;
  }
  play('place'); renderAll();
}
function tapItem(i) {
  if (S.phase !== 'prep') return;
  if (S.sel && S.sel.item === i) { S.sel = null; } else { S.sel = { item: i }; S.info = { item: S.items[i] }; play('click'); }
  renderAll();
}

// ───────── 그림 조각 ─────────
function spriteHTML(type) {
  if (UNITS[type].wall) return '<div class="spr wallblock"></div>';
  // 고해상도 도트 그림(Gemini 원화): 사람·말은 키 31칸, 배·기계·성은 너비 fitW칸에 맞춤 (옛 28칸 그림의 --k 기준)
  const hd = typeof HD !== 'undefined' && HD[type];
  if (hd) {
    const s = hd.fitW ? hd.fitW / hd.w : 31 / hd.h;
    return `<div class="spr hd${hd.fitW ? ' ship' : ''}" style="background-image:url(${hd.img});width:calc(var(--k) * ${(hd.w * s).toFixed(2)});height:calc(var(--k) * ${(hd.h * s).toFixed(2)})"></div>`; }
  const f0 = SPRITE.frames[type + '-i0'], f1 = SPRITE.frames[type + '-i1'], fa = SPRITE.frames[type + '-a'];
  return `<div class="spr" style="--x0:${f0[0]};--y0:${f0[1]};--x1:${f1[0]};--y1:${f1[1]};--xa:${fa[0]};--ya:${fa[1]}"></div>`;
}
// 아래 줄(화면 앞쪽)일수록 위에 그림 → 뒤 군사가 앞 군사를 가리지 않음
const zOf = (y) => 3 + y * 2;
function placeEl(el, x, y) { el.style.left = hexLeft(x, y) + '%'; el.style.top = hexTop(y) + '%'; el.style.zIndex = zOf(y); }
// 보는 방향: 기본은 우리 편 오른쪽, 적 왼쪽. 움직이거나 칠 때 그쪽을 봄
function faceTo(el, fromX, toX) { if (!el || Math.abs(toX - fromX) < 0.5) return; el.classList.toggle('face-l', toX < fromX); el.classList.toggle('face-r', toX > fromX); }
function pieceHTML(type, star, o = {}) {
  const d = UNITS[type];
  const tier = d.side === 'p' && !d.fixed ? d.cost : 0;
  const cls = ['piece', d.side, d.fixed ? 'fixed' : '', o.sel ? 'sel' : '', o.cls || '', (o.odd ? 'odd' : '')].join(' ');
  const pos = o.x !== undefined ? `style="left:${hexLeft(o.x, o.y)}%;top:${hexTop(o.y)}%;z-index:${zOf(o.y)}"` : '';
  const stars = star > 1 ? `<div class="stars s${star}">${'★'.repeat(star)}</div>` : '';
  const bars = o.bars ? `<div class="bars"><div class="hpb"><i class="hp"></i><i class="sh"></i></div>${d.skill ? '<div class="mpb"><i class="mp"></i></div>' : ''}</div>` : '';
  const items = o.items && o.items.length ? `<div class="its">${o.items.map(it => `<span>${ITEMS[it].icon}</span>`).join('')}</div>` : '';
  const cargo = o.cargo && o.cargo.length ? `<div class="cargo">${o.cargo.map(c => `<span class="mini p">${spriteHTML(c.type)}</span>`).join('')}</div>` : '';
  return `<div class="${cls}" ${pos} ${o.id !== undefined ? `data-id="${o.id}"` : ''}>${tier ? `<div class="base" style="--tc:${TIER_COLORS[tier]}"></div>` : '<div class="base enemy"></div>'}${spriteHTML(type)}${stars}${bars}${items}${cargo}</div>`;
}

function sizeBoard() {
  const b = $('#board');
  const w = b.clientWidth;
  const k = (w * HW / 100) * 1.1 / SPRITE.w;
  document.documentElement.style.setProperty('--k', k + 'px');
  document.documentElement.style.setProperty('--hexw', (w * HW / 100) + 'px');
  document.documentElement.style.setProperty('--kcargo', (k * 0.55) + 'px');
  const sw = ($('#bench').clientWidth - 30) / 6;
  document.documentElement.style.setProperty('--kb', Math.min(k, sw * 0.9 / SPRITE.w) + 'px');
}
window.addEventListener('resize', sizeBoard);

function boardBase() {
  const c = chap();
  const terrain = c.siege ? 'siege' : stage().terrain;
  const cells = cellsNow();
  const b = $('#board');
  b.className = 'board ' + terrain + ' bg-' + (c.siege ? 'snow' : stage().bg);
  let html = '';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const mine = y >= 3;
    html += `<div class="hex ${mine ? 'mine' : 'foe'}${c.siege && y === 5 ? ' wall' : ''}${cells[x + ',' + y] ? ' ' + cells[x + ',' + y] : ''}" data-x="${x}" data-y="${y}" style="left:${hexLeft(x, y)}%;top:${hexTop(y)}%;width:${HW}%;height:${HH}%"></div>`;
  }
  b.innerHTML = html + '<div class="frontline"></div>';
  b.querySelectorAll('.hex').forEach(h => h.onclick = () => tapCell(+h.dataset.x, +h.dataset.y));
}
function renderBoardPrep() {
  boardBase();
  const b = $('#board');
  let html = '';
  enemiesNow().forEach(([t, x, y], i) => { html += pieceHTML(t, 1, { x, y, cls: 'preview', odd: i & 1 }); });
  if (chap().siege) html += pieceHTML('castle', 1, { x: 3, y: 5 });
  S.board.forEach((o, i) => { html += pieceHTML(o.u.type, o.u.star, { x: o.x, y: o.y, items: o.u.items, cargo: o.u.cargo, sel: S.sel && S.sel.where === 'board' && S.sel.i === i, odd: i & 1, cls: o.u.uid === S.mergedUid ? 'merged' : '' }); });
  b.insertAdjacentHTML('beforeend', html);
  const su = selectedUnit();
  if (su) b.querySelectorAll('.hex.mine').forEach(h => {
    const x = +h.dataset.x, y = +h.dataset.y, bi = boardAt(x, y), there = bi >= 0 ? S.board[bi].u : null;
    const boardable = there && !UNITS[su.type].naval && UNITS[there.type].carry && (there.cargo || []).length < UNITS[there.type].carry;
    if (!castleCell(x, y) && (canStandType(su.type, cellAt(x, y)) || boardable)) h.classList.add('hl');
  });
  if (S.sel && S.sel.item !== undefined) b.querySelectorAll('.piece.p').forEach(p => p.classList.add('can-item'));
}
function renderBench() {
  const el = $('#bench'); el.innerHTML = '';
  S.bench.forEach((u, i) => {
    const s = document.createElement('div');
    s.className = 'slot';
    if (u) s.innerHTML = pieceHTML(u.type, u.star, { items: u.items, sel: S.sel && S.sel.where === 'bench' && S.sel.i === i, odd: i & 1, cls: (u.uid === S.mergedUid ? 'merged ' : '') + (S.sel && S.sel.item !== undefined ? 'can-item' : '') });
    s.onclick = () => tapBench(i);
    el.appendChild(s);
  });
  const tray = $('#tray'); tray.innerHTML = '';
  if (!S.items.length) tray.innerHTML = '<span class="muted small">전투에서 이기면 아이템을 얻어요</span>';
  S.items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'item' + (S.sel && S.sel.item === i ? ' sel' : '');
    b.innerHTML = ITEMS[it].icon; b.title = ITEMS[it].name;
    b.onclick = () => tapItem(i);
    tray.appendChild(b);
  });
}
function renderShop() {
  const el = $('#shop'); el.innerHTML = '';
  S.shop.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    if (!t) { b.classList.add('sold'); el.appendChild(b); return; }
    const d = UNITS[t];
    b.style.setProperty('--tc', TIER_COLORS[d.cost]);
    if (S.gold < d.cost) b.classList.add('poor');
    const owned = allOwned().filter(o => o.u.type === t && o.u.star === 1).length;
    b.innerHTML = `<div class="mini">${spriteHTML(t)}</div><div class="cname">${d.name}</div><div class="ctrait">${d.traits.map(x => TRAITS[x].icon).join('')}</div><div class="ccost">🌾${d.cost}</div>${owned >= 2 ? '<div class="pair">★2 가능!</div>' : owned === 1 ? '<div class="pair one">2/3</div>' : ''}`;
    b.onclick = () => buy(i);
    el.appendChild(b);
  });
  const odds = ODDS[S.level];
  $('#odds').innerHTML = odds.map((p, i) => p ? `<span style="color:${TIER_COLORS[i + 1]}">●${p}%</span>` : '').join(' ');
  $('#btnReroll').disabled = S.gold < REROLL_COST;
  $('#btnXp').disabled = S.gold < XP_COST || S.level >= MAX_LEVEL;
  const su = selectedUnit();
  $('#btnSell').disabled = !su;
  $('#btnSell').textContent = su ? `팔기 🌾${sellPrice(su)}` : '팔기';
}
function renderTraits() {
  const counts = countTraits(S.board.map(b => ({ type: b.u.type })));
  const buffs = activeBuffs(counts);
  const shown = new Set(['관군','장수']);
  if (S.ch === 1) (stage() && stage().sea ? ['수군'] : ['의병','명군']).forEach(t => shown.add(t));
  Object.keys(counts).forEach(t => shown.add(t));
  let h = '<b>시너지</b>';
  shown.forEach(t => {
    const tr = TRAITS[t]; if (!tr.steps.length) return;
    const on = buffs[t] > 0;
    h += `<div class="trait ${on ? 'on' : ''}"><span class="ti">${tr.icon}</span><span>${t}</span><span class="cnt">${counts[t] || 0} / ${tr.steps.join('·')}</span><div class="tdesc">${tr.desc}</div></div>`;
  });
  if (S.ch === 1) {
    const on = crisisNow(counts);
    h += `<div class="crisis ${on ? 'on' : ''}">${on ? '🔥 위기 극복! 모든 군사 강화' : '<b>위기 극복까지</b>'}<br>${S.flags.navy ? '✅' : '⬜'} ⚓ 수군의 승리(2-2) · ${S.flags.militia ? '✅' : '⬜'} ✊ 의병의 승리(2-3) · ${(counts['명군'] || 0) >= 2 ? '✅' : '⬜'} 🤝 명군 2명</div>`;
  }
  if (chap().siege) {
    const m = siegeMul();
    h += `<div class="crisis">배고픔: 공격력 ×${m.atk.toFixed(2)} · 추위: 체력 ×${m.hp.toFixed(2)}${S.meetBuff === 'fight' ? '<br>회의 결과: 공격력 +20%' : ''}</div>`;
  }
  $('#traitPanel').innerHTML = h;
}
function crisisNow(counts) { return S.ch === 1 && !!S.flags.navy && !!S.flags.militia && (counts['명군'] || 0) >= 2; }
function renderInfo() {
  const el = $('#infoPanel');
  const I = S.info;
  if (!I) { el.innerHTML = '<p class="muted">군사나 아이템을 누르면 설명이 나와요.</p>'; return; }
  if (I.item) { const it = ITEMS[I.item]; el.innerHTML = `<h4>${it.icon} ${it.name}</h4><p class="fact">${it.desc}</p><p class="muted small">이제 아이템을 줄 군사를 누르세요.</p>`; return; }
  const type = I.unit ? I.unit.type : I.type, star = I.unit ? I.unit.star : 1;
  const d = UNITS[type], m = star === 2 ? 1.8 : star === 3 ? 3.2 : 1;
  const rng = d.range === 0 ? '-' : d.range === 1 ? '1칸' : d.range + '칸';
  const sk = d.skill ? SKILLS[d.skill] : null;
  const tier = d.side === 'p' && d.cost ? `<span class="tier" style="background:${TIER_COLORS[d.cost]}">${d.cost}등급</span>` : '';
  const items = I.unit && I.unit.items.length ? `<div class="stats">아이템: ${I.unit.items.map(i => ITEMS[i].icon + ITEMS[i].name).join(', ')}</div>` : '';
  el.innerHTML = `<div class="info-head"><div class="mini ${d.side}">${spriteHTML(type)}</div><div><h4>${d.name} ${star > 1 ? '★'.repeat(star) : ''} ${tier}</h4>
    <div class="stats">❤ ${Math.round(d.hp * m)} · ⚔ ${Math.round(d.atk * m * ATK_SCALE)} · 사거리 ${rng}${d.fixed ? '' : ` · 이동 ${moveOf(d)}칸`}</div>
    ${I.live ? `<div class="stats now">지금 ❤ ${I.live.hp} / ${I.live.maxHp}${I.live.shield > 0 ? ` 🛡${Math.round(I.live.shield)}` : ''}${I.live.maxMana ? ` · 마나 ${I.live.mana} / ${I.live.maxMana}` : ''}</div>` : ''}
    <div class="stats">${(d.traits || []).map(t => TRAITS[t].icon + t).join(' ')}</div></div></div>
    ${sk ? `<div class="skill"><b>💥 ${sk.name}</b>${sk.desc ? ' — ' + sk.desc : ''}</div>` : ''}${d.rule ? `<div class="rule">${d.rule}</div>` : ''}${items}<p class="fact">📜 ${d.fact}</p>`;
}
function updateTop() {
  const c = chap();
  $('#tbChapter').textContent = c.title;
  $('#tbStage').textContent = c.siege ? `${S.day}일째 — 남한산성을 지켜라` : `${stage() ? stage().id + '. ' + stage().title : ''}`;
  $('#tbGold').textContent = S.gold;
  $('#tbLevel').textContent = S.level;
  const need = XP_NEED[S.level] || 1;
  $('#tbXp').style.width = (S.level >= MAX_LEVEL ? 100 : S.xp / need * 100) + '%';
  $('#tbXpText').textContent = S.level >= MAX_LEVEL ? 'MAX' : `${S.xp}/${need}`;
  $('#tbCap').textContent = `${S.phase === 'battle' ? S.board.length : deployed()}/${S.level}`;
  const st = $('#tbStreak');
  if (Math.abs(S.streak) >= 2) { st.classList.remove('hidden'); st.textContent = S.streak > 0 ? `🔥 ${S.streak}연승` : `💧 ${-S.streak}연패`; } else st.classList.add('hidden');
  const interest = Math.min(3, Math.floor(S.gold / 10));
  $('#tbInterest').textContent = interest ? `이자 +${interest}` : '';
  if (c.siege) { $('#mFood').style.width = S.food + '%'; $('#mWood').style.width = S.wood + '%'; }
}
function renderAll() {
  updateTop();
  if (S.phase === 'prep') { renderBoardPrep(); renderShop(); }
  renderBench(); renderTraits(); renderInfo();
  S.mergedUid = null;
}
setInterval(() => { const b = $('#board'); if (b) b.classList.toggle('beat'); document.body.classList.toggle('beat'); }, 420);

// ───────── 역사 한마디 (전투 중 말풍선, 하나씩 차례로) ─────────
const sayQ = [];
let sayOn = false;
function say(type, html, more) {
  sayQ.push({ type, html, more });
  if (!sayOn) nextSay();
}
function sayRule(k) {
  const r = RULE_SAY[k];
  if (!r || S.said.has(k)) return;
  S.said.add(k); say(r.type, r.text, r.more);
}
function nextSay() {
  const s = sayQ.shift();
  if (!s) { sayOn = false; return; }
  sayOn = true;
  const el = document.createElement('div');
  el.className = 'saying';
  el.innerHTML = `${s.type ? `<span class="mini ${UNITS[s.type].side}">${spriteHTML(s.type)}</span>` : ''}<p>${s.more ? '<span class="qtag">📜 더 알아보기</span> ' : ''}${s.html}</p>`;
  $('.board-col').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); nextSay(); }, 400); }, 4600);
}

// ───────── 전투 (장기처럼 차례를 번갈아) ─────────
$('#btnFight').onclick = () => {
  if (S.phase !== 'prep') return;
  if (!S.board.length) { play('error'); toast('판 아래쪽에 군사를 먼저 놓아 주세요'); return; }
  startBattle();
};
$('#btnSpeed').onclick = () => { S.speed = S.speed === 1 ? 2 : 1; $('#btnSpeed').textContent = S.speed === 1 ? '⏩ 적 차례 빠르게' : '▶ 적 차례 보통 속도'; };

let bTok = 0;   // 전투를 그만두면 늘려서, 예약해 둔 움직임을 멈춤
function later(fn, ms) { const t = bTok; setTimeout(() => { if (t === bTok) fn(); }, ms / (S.speed || 1)); }
const hexEl = (x, y) => $('#board').querySelector(`.hex[data-x="${x}"][data-y="${y}"]`);
const selU = () => (S.bs.sel !== null ? S.battle.units[S.bs.sel] : null);

function startBattle() {
  play('ok');
  S.phase = 'battle'; S.sel = null; bTok++;
  music('battle');
  $('#prepControls').classList.add('hidden');
  $('#battleControls').classList.remove('hidden');
  $('#game').classList.add('in-battle');
  const c = chap();
  const players = S.board.map(b => ({ type: b.u.type, star: b.u.star, x: b.x, y: b.y, items: b.u.items,
    cargo: (b.u.cargo || []).map(c => ({ type: c.type, star: c.star, items: c.items })) }));
  let opts;
  if (c.siege) {
    players.push({ type: 'castle', star: 1, x: 3, y: 5 });
    const m = siegeMul();
    opts = { surviveRounds: c.surviveRounds, atkMul: m.atk * (S.meetBuff === 'fight' ? 1.2 : 1), hpMul: m.hp,
             castleHpMul: c.cannonDay && S.day >= c.cannonDay ? c.cannonHp : 0 };
  } else opts = { mult: stage().mult };
  opts.startMana = S.briefMana; opts.cells = cellsNow();
  if (!c.siege) { opts.leader = stage().leader; opts.weak = stage().weak; }
  if (S.ch === 1) {
    opts.crisis = crisisNow(countTraits(players.flatMap(p => [p].concat(p.cargo))));
    if (S.flags.navy && stage().id !== '2-2') opts.mult *= 0.92;   // 바닷길이 막혀 일본군 보급이 끊김
  }
  const bt = createBattle(players, enemiesNow(), opts);
  S.battle = bt;
  S.bs = { sel: null, mode: null, busy: true, finished: false };
  boardBase();
  $('#board').insertAdjacentHTML('beforeend', bt.units.map((u, i) => pieceHTML(u.type, u.star, { x: u.x, y: u.y, id: u.id, bars: true, items: u.items, cargo: u.cargo, odd: i & 1 })).join(''));
  syncBars();
  renderTraits(); renderBench();
  // 역사 한마디: 처음 만나는 적
  if (bt.buffs.crisis) sayRule('crisis');
  if (S.ch === 1 && S.flags.navy && stage().id !== '2-2') sayRule('supply');
  if (players.some(p => p.cargo.length)) say('ship', '⛵ 배가 땅(섬)에 닿으면 타고 있던 군사가 내려요. 배를 해안으로 몰아 보세요!');
  if (bt.leader) say(bt.leader, `<b>👑 ${UNITS[bt.leader].name}</b>를 쓰러뜨리면 남은 적이 항복해요!`);
  if (Object.values(bt.cells).includes('site')) say(null, `🚩 강 건너 깃발 자리에 군사를 세우면 ${stage().fortWord || '진'}을 세워요. ${stage().siteName}를 세워 보세요!`);
  [...new Set(bt.units.filter(u => u.side === 'e' && !u.wall).map(u => u.type))].filter(t => !S.seen.has(t)).slice(0, 2)
    .forEach(t => { S.seen.add(t); say(t, `<b>${UNITS[t].name}</b> — ${UNITS[t].fact}`); });
  bt.units.filter(u => u.side === 'e').forEach(u => S.seen.add(u.type));
  if (bt.units.some(u => u.rush)) sayRule('rush');
  playerTurn();
}
function playerTurn() {
  const bt = S.battle;
  drawEvents(beginTurn(bt, 'p')); syncBars();
  S.bs.sel = null; S.bs.mode = null; S.bs.busy = false;
  banner(chap().siege ? `${bt.round}번째 차례 — 성을 지켜라!` : `${bt.round}번째 차례 — 우리 차례!`, 'p');
  if (!bt.units.some(u => u.side === 'p' && canAct(u))) { S.bs.busy = true; toast('모든 군사가 기절해서 이번 차례는 쉬어요'); later(enemyTurn, 1200); }
  renderBattle();
}
function renderBattle() {
  const bt = S.battle, bs = S.bs, sel = selU();
  const board = $('#board');
  const myTurn = bt.side === 'p' && !bs.busy && !bt.over;
  board.querySelectorAll('.hex.mv, .hex.tg').forEach(h => h.classList.remove('mv', 'tg'));
  bs.aim = null; showAoe(null);
  for (const u of bt.units) {
    const el = pieceEl(u.id); if (!el) continue;
    const mine = u.alive && u.side === 'p' && !u.fixed;
    el.classList.toggle('can-act', mine && myTurn && canAct(u) && u !== sel);
    el.classList.toggle('done', mine && bt.side === 'p' && !canAct(u));
    el.classList.toggle('sel', u === sel);
    el.classList.toggle('sk-ready', u.alive && skillReady(u));
    el.classList.toggle('hidden-in', u.alive && u.side === 'p' && traitsOf(u).includes('의병') && cellOf(bt, u) === 'forest');
    el.classList.remove('tgt', 'crane');
  }
  const targets = sel && myTurn ? targetsFrom(bt, sel) : [];
  if (sel && myTurn) {
    if (bs.mode !== 'skill') reachable(bt, sel).forEach(p => hexEl(p.x, p.y).classList.add('mv'));
    targets.forEach(t => { hexEl(t.x, t.y).classList.add('tg'); pieceEl(t.id).classList.add('tgt'); if (craneMul(bt, sel, t) > 1) pieceEl(t.id).classList.add('crane'); });
  }
  // 버튼
  const bSk = $('#btnSkill');
  const canSk = myTurn && sel && skillReady(sel) && (!skillNeedsTarget(sel) || targets.length > 0);
  bSk.disabled = !(canSk || bs.mode === 'skill');
  bSk.classList.toggle('ready', !!canSk && bs.mode !== 'skill');
  bSk.textContent = bs.mode === 'skill' ? '✖ 필살기 취소' : sel && sel.maxMana ? `💥 ${skillOf(sel).name}` : '💥 필살기';
  $('#btnWait').disabled = !(myTurn && sel);
  $('#btnAuto').disabled = !myTurn;
  $('#btnEndTurn').disabled = !myTurn;
  // 안내 글
  $('#battleMsg').textContent = chap().siege
    ? `🏯 ${bt.round} / ${bt.surviveRounds}번째 차례 버티는 중`
    : `⚔ ${bt.round}번째 차례 · 남은 차례 ${bt.maxRounds - bt.round + 1}`;
  let hint;
  if (bt.over) hint = '전투가 끝났어요!';
  else if (bt.side === 'e') hint = '적이 움직이고 있어요…';
  else if (bs.busy) hint = '우리 군사가 움직이고 있어요…';
  else if (!sel) hint = '빛나는 군사를 눌러 고르세요. (흐린 군사는 이번 차례에 이미 움직였어요)';
  else if (bs.mode === 'skill') hint = splashOf(sel, true) ? `💥 ${skillOf(sel).name}! 빨간 칸의 적을 누르면, 그 적과 바로 옆 칸까지 함께 맞는 곳이 노랗게 보여요.` : `💥 ${skillOf(sel).name}! 빨간 칸의 적을 누르세요.`;
  else if (!sel.moved) hint = targets.length ? '파란 칸을 누르면 이동, 빨간 칸의 적을 누르면 공격해요.' : '파란 칸을 눌러 이동하세요. 적이 사거리 안에 오면 빨갛게 빛나요.';
  else hint = targets.length ? '빨간 칸의 적을 눌러 공격하세요.' : '공격할 수 있는 적이 없어요.';
  if (sel && myTurn && targets.some(t => craneMul(bt, sel, t) > 1)) hint += ' 🪶 「학익진」 표시가 있는 적은 더 세게 칠 수 있어요!';
  $('#battleHint').textContent = hint;
}
// 마우스를 적 위에 올리면 범위 공격이 맞을 칸을 미리 보여 줌
$('#board').addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse' || !S || S.phase !== 'battle' || !S.battle || !S.bs || S.bs.aim != null) return;
  const sel = selU(); if (!sel || S.battle.side !== 'p') return;
  const h = ev.target.closest && ev.target.closest('.hex');
  const u = h ? unitAt(S.battle, +h.dataset.x, +h.dataset.y) : null;
  const r = splashOf(sel, S.bs.mode === 'skill');
  showAoe(u && r && u.side !== sel.side && hexDist(sel, u) <= sel.range ? u : null, r);
});
function tapBattle(x, y) {
  const bt = S.battle, bs = S.bs, sel = selU();
  const u = unitAt(bt, x, y);
  if (u) { S.info = { unit: { type: u.type, star: u.star, items: u.items }, live: u }; renderInfo(); }
  if (bt.side !== 'p' || bs.busy || bt.over) return;
  if (sel && u && u.side !== sel.side && hexDist(sel, u) <= sel.range) {
    const skill = bs.mode === 'skill', r = splashOf(sel, skill);
    // 범위 공격은 먼저 맞을 칸을 보여 주고, 같은 적을 한 번 더 누르면 실행
    if (r && bs.aim !== u.id) {
      bs.aim = u.id; showAoe(u, r); play('click', .3);
      $('#battleHint').textContent = `🎯 노란 칸에 있는 적이 모두 맞아요. 같은 적을 한 번 더 누르면 ${skill ? '필살기를 써요' : '공격해요'}! (다른 적을 누르면 바꿔요)`;
      return;
    }
    bs.aim = null; showAoe(null);
    return act(skill ? doSkill(bt, sel, u) : doAttack(bt, sel, u));
  }
  if (bs.mode === 'skill') { bs.mode = null; renderBattle(); return; }
  if (sel && !u && reachable(bt, sel).some(p => p.x === x && p.y === y)) {
    play('place', .5);
    drawEvents(doMove(bt, sel, x, y));
    // 옮긴 뒤 할 수 있는 일이 없으면 이 군사의 차례는 끝
    if (!targetsFrom(bt, sel).length && !(skillReady(sel) && !skillNeedsTarget(sel))) { doWait(bt, sel); bs.sel = null; }
    return afterAction();
  }
  if (u && u === sel) { bs.sel = null; renderBattle(); return; }
  if (u && u.side === 'p' && !u.fixed) {
    if (canAct(u)) { bs.sel = u.id; play('click'); renderBattle(); }
    else toast('이 군사는 이번 차례에 이미 움직였어요');
    return;
  }
  if (u && u.side === 'e' && sel) { play('error', .4); toast(`너무 멀어요! ${UNITS[sel.type].name}의 사거리는 ${sel.range}칸이에요`); }
}
function act(ev) {
  drawEvents(ev); syncBars();
  S.bs.sel = null; S.bs.mode = null;
  afterAction();
}
function afterAction() {
  const bt = S.battle;
  if (bt.over) return finishBattle();
  if (!bt.units.some(u => u.side === 'p' && canAct(u))) { S.bs.busy = true; renderBattle(); later(enemyTurn, 700); return; }
  renderBattle();
}
function finishBattle() {
  if (S.bs.finished) return;
  S.bs.finished = true; S.bs.busy = true;
  renderBattle();
  later(() => endBattle(S.battle.result), 1000);
}
$('#btnWait').onclick = () => {
  const sel = selU(); if (!sel || S.bs.busy) return;
  play('click'); doWait(S.battle, sel); S.bs.sel = null; S.bs.mode = null; afterAction();
};
$('#btnSkill').onclick = () => {
  const sel = selU(); if (!sel || S.bs.busy) return;
  if (S.bs.mode === 'skill') { S.bs.mode = null; renderBattle(); return; }
  if (!skillReady(sel)) return;
  if (!skillNeedsTarget(sel)) return act(doSkill(S.battle, sel, null));
  S.bs.mode = 'skill'; play('click'); renderBattle();
};
$('#btnEndTurn').onclick = () => {
  if (S.phase !== 'battle' || S.bs.busy || S.battle.side !== 'p') return;
  play('click'); S.bs.busy = true; enemyTurn();
};
$('#btnAuto').onclick = () => {
  if (S.phase !== 'battle' || S.bs.busy || S.battle.side !== 'p') return;
  play('click'); S.bs.busy = true; S.bs.sel = null; S.bs.mode = null; renderBattle();
  runUnits(actOrder(S.battle, 'p'), () => later(enemyTurn, 300));
};
// 군사들을 하나씩 생각해서 움직이게 함 (적 차례, 「자동」 버튼)
function runUnits(list, done) {
  const bt = S.battle;
  const step = (i) => {
    if (bt.over) return finishBattle();
    if (i >= list.length) return done();
    const u = list[i];
    if (!canAct(u)) return step(i + 1);
    const r = aiAct(bt, u);
    drawEvents(r.moveEv);
    later(() => {
      drawEvents(r.actEv); syncBars(); renderBattle();
      later(() => step(i + 1), r.actEv.length ? 450 : 150);
    }, r.moveEv.length ? 360 : 80);
  };
  step(0);
}
function enemyTurn() {
  const bt = S.battle;
  if (bt.over) return finishBattle();
  for (const u of bt.units) if (u.side === 'p') u.done = true;   // 움직이지 않은 군사는 그 자리에서 쉼
  S.bs.busy = true; S.bs.sel = null; S.bs.mode = null;
  drawEvents(beginTurn(bt, 'e')); syncBars();
  const amb = !chap().siege && stage().ambush;
  if (amb && bt.round === amb.round) {
    amb.units.forEach(([t, x, y]) => {
      const u = bt.spawn(t, x, y); if (!u) return;
      u.done = false;
      $('#board').insertAdjacentHTML('beforeend', pieceHTML(u.type, 1, { x, y, id: u.id, bars: true, cls: 'spawn' }));
    });
    syncBars(); sayRule('ambushE');
  }
  renderBattle();
  banner('적의 차례', 'e');
  later(() => runUnits(actOrder(bt, 'e'), () => {
    drawEvents(endTurn(bt));
    if (bt.over) return finishBattle();
    later(playerTurn, 300);
  }), 1000);
}
const pieceEl = (id) => $('#board').querySelector(`.piece[data-id="${id}"]`);
const far0 = (e) => e.ranged || e.k === 'shot';
// 범위 칸: 가운데 t와 거리 r 안의 칸 (판 밖 제외)
function areaCells(t, r) { const out = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (hexDist({ x, y }, t) <= r) out.push({ x, y }); return out; }
function aoeFlash(t, r) {
  if (!t) return;
  areaCells(t, r).forEach(p => { const h = hexEl(p.x, p.y); if (!h) return; h.classList.remove('aoe-hit'); void h.offsetWidth; h.classList.add('aoe-hit'); setTimeout(() => h.classList.remove('aoe-hit'), 700); });
}
// 범위 공격 미리 보기: 이 적을 노리면 어느 칸까지 맞는지
function splashOf(u, skill) { if (skill) { const sk = skillOf(u); return sk.kind === 'strike' && sk.splash ? sk.splash : 0; } return u.splash ? 1 : 0; }
function showAoe(t, r) {
  $('#board').querySelectorAll('.hex.aoe, .hex.aoe-c').forEach(h => h.classList.remove('aoe', 'aoe-c'));
  if (!t || !r) return;
  areaCells(t, r).forEach(p => { const h = hexEl(p.x, p.y); if (h) h.classList.add(p.x === t.x && p.y === t.y ? 'aoe-c' : 'aoe'); });
}
function centerOf(u) { return { x: hexLeft(u.x, u.y) + HW / 2, y: hexTop(u.y) + HH / 2 }; }
function syncBars() {
  for (const u of S.battle.units) {
    const el = pieceEl(u.id); if (!el) continue;
    const hp = el.querySelector('.hp'), sh = el.querySelector('.sh'), mp = el.querySelector('.mp');
    const tot = Math.max(u.maxHp, u.hp + u.shield);
    if (hp) hp.style.width = (u.hp / tot * 100) + '%';
    if (sh) { sh.style.width = (u.shield / tot * 100) + '%'; sh.style.left = (u.hp / tot * 100) + '%'; }
    if (mp && u.maxMana) mp.style.width = (u.mana / u.maxMana * 100) + '%';
    el.classList.toggle('stunned', u.stun > 0);
  }
}
function floatText(u, text, cls) {
  const c = centerOf(u);
  const d = document.createElement('div');
  d.className = 'ftext ' + cls; d.textContent = text;
  d.style.left = c.x + '%'; d.style.top = (c.y - HH * 0.35) + '%';
  $('#board').appendChild(d); setTimeout(() => d.remove(), 900);
}
function shot(a, t, kind) {
  const s = document.createElement('div');
  s.className = 'shot ' + kind;
  const A = centerOf(a), T = centerOf(t);
  s.style.left = A.x + '%'; s.style.top = A.y + '%';
  const ang = Math.atan2((T.y - A.y) * 0.73, T.x - A.x) * 180 / Math.PI;
  s.style.transform = `rotate(${ang}deg)`;
  $('#board').appendChild(s);
  requestAnimationFrame(() => requestAnimationFrame(() => { s.style.left = T.x + '%'; s.style.top = T.y + '%'; }));
  setTimeout(() => s.remove(), 260);
}
function playFx(name, u, scale = 1) {
  const f = FX[name]; if (!f) return;
  const board = $('#board');
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) * (name === 'cartoon-pow' ? 0.22 : 0.34) * scale;
  const el = document.createElement('div');
  el.className = 'fx';
  const c = centerOf(u);
  el.style.width = f.w * k + 'px'; el.style.height = f.h * k + 'px';
  el.style.left = `calc(${c.x}% - ${f.pivot[0] * k}px)`; el.style.top = `calc(${c.y + HH * 0.3}% - ${f.pivot[1] * k}px)`;
  el.style.backgroundImage = `url(${f.img})`; el.style.backgroundSize = `${f.sw * k}px ${f.sh * k}px`;
  board.appendChild(el);
  const step = f.n > 40 ? 2 : 1;
  let i = 0;
  const iv = setInterval(() => {
    if (i >= f.n) { clearInterval(iv); el.remove(); return; }
    el.style.backgroundPosition = `${-(i % f.cols) * f.w * k}px ${-Math.floor(i / f.cols) * f.h * k}px`;
    i += step;
  }, 1000 / f.fps);
}
function banner(text, side) {
  const b = document.createElement('div');
  b.className = 'banner ' + side; b.textContent = text;
  $('#board').appendChild(b); setTimeout(() => b.remove(), 1300);
}
function drawEvents(ev) {
  const bt = S.battle;
  for (const e of ev) {
    if (e.k === 'move') {
      const el = pieceEl(e.id);
      if (el) {
        faceTo(el, hexLeft(e.fx !== undefined ? e.fx : e.x, e.fy !== undefined ? e.fy : e.y), hexLeft(e.x, e.y));
        el.classList.remove('walk'); void el.offsetWidth; el.classList.add('walk'); setTimeout(() => el.classList.remove('walk'), 380);
        placeEl(el, e.x, e.y);
      }
    } else if (e.k === 'atk' || e.k === 'shot') {
      const a = bt.units[e.from], t = bt.units[e.to], el = pieceEl(e.from);
      if (el) {
        const A = centerOf(a), T = centerOf(t), far = e.ranged || e.k === 'shot';
        faceTo(el, A.x, T.x);
        const cls = far ? 'atk-r' : 'atk-m';
        el.classList.remove('atk-r', 'atk-m'); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 420);
        if (!far) { setTimeout(() => { el.style.translate = `${(T.x - A.x) * 2.2}% ${(T.y - A.y) * 1.4}%`; }, 110); setTimeout(() => { el.style.translate = ''; }, 300); }
      }
      if (UNITS[a.type].splash && e.k === 'atk') setTimeout(() => aoeFlash(t, 1), far0(e) ? 220 : 120);
      if (e.ranged || e.k === 'shot') {
        const d = UNITS[a.type];
        shot(a, t, d.boom || ['gunner','mingGun','rocket','panok','ship','turtle'].includes(a.type) ? 'ball' : 'arrow');
      }
      const d = UNITS[a.type];
      play(d.boom || ['gunner','mingGun','rocket','panok','ship'].includes(a.type) ? 'boom' : 'hit', .3);
    } else if (e.k === 'dmg') {
      const u = bt.units[e.id], el = pieceEl(e.id);
      if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      floatText(u, e.dmg + (e.crit ? '!' : ''), (e.crit ? 'crit ' : '') + (e.skill ? 'sk ' : '') + u.side);
    } else if (e.k === 'heal') {
      floatText(bt.units[e.id], '+' + e.amt, 'heal');
    } else if (e.k === 'die') {
      const el = pieceEl(e.id); if (el) el.classList.add('dead');
    } else if (e.k === 'cast') {
      const u = bt.units[e.id];
      const sk = SKILLS[UNITS[u.type].skill];
      floatText(u, sk.name + '!', 'cast ' + u.side);
      if (u.side === 'p' && !S.said.has('sk-' + u.type)) { S.said.add('sk-' + u.type); say(u.type, `<b>${UNITS[u.type].name}</b> — ${UNITS[u.type].fact}`); }
      if (e.big) { banner(`${UNITS[u.type].name} — ${sk.name}!`, u.side); const b = $('#board'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); play('boom', .6); }
      else play('ok', .35);
      if (sk.fx) (e.targets || []).slice(0, 4).forEach((id, i) => setTimeout(() => playFx(sk.fx, bt.units[id], e.big ? 1.15 : .85), i * 90));
      // 범위 공격이 닿은 칸을 잠깐 빨갛게
      if (sk.splash && e.targets && e.targets.length) aoeFlash(bt.units[e.targets[0]], sk.splash);
      else if (sk.kind === 'all' && e.targets) e.targets.forEach(id => aoeFlash(bt.units[id], 0));
    } else if (e.k === 'fort') {
      const h = hexEl(e.x, e.y); if (h) { h.classList.remove('site'); h.classList.add('fort'); }
      floatText(bt.units[e.id], `🏯 진 ${e.n}곳!`, 'cast p'); play('coin', .5);
      sayRule(stage() && stage().id === '1-3' ? 'fort3' : 'fort1');
    } else if (e.k === 'land') {
      const u = bt.units[e.id], ship = bt.units[e.from];
      $('#board').insertAdjacentHTML('beforeend', pieceHTML(u.type, u.star, { x: ship.x, y: ship.y, id: u.id, bars: true, items: u.items, cls: 'spawn' }));
      const sEl = pieceEl(ship.id); if (sEl) { const cg = sEl.querySelector('.cargo .mini'); if (cg) cg.remove(); }
      requestAnimationFrame(() => requestAnimationFrame(() => { const el = pieceEl(u.id); if (el) placeEl(el, e.x, e.y); }));
      floatText(u, '⛵ 상륙!', 'cast p'); play('place', .6); sayRule('landing');
    } else if (e.k === 'surrender') {
      banner('왜구가 항복했어요!', 'p'); sayRule('surrender');
    } else if (e.k === 'rule') {
      const u = bt.units[e.id];
      if (e.rule === 'crane') floatText(u, '🪶 학익진!', 'cast p');
      else if (e.rule === 'ambush') floatText(u, '🌲 매복!', 'cast p');
      else if (e.rule === 'sink') { floatText(u, '배가 가라앉았어요…', 'cast ' + u.side); const el = pieceEl(u.id); if (el) { const cg = el.querySelector('.cargo'); if (cg) cg.remove(); } }
      sayRule(e.rule);
    } else if (e.k === 'rest') {
      floatText(bt.units[e.id], '기절해서 쉬어요', 'cast ' + bt.units[e.id].side);
    } else if (e.k === 'stun') {
      playFx('stunned', bt.units[e.id], .7);
    } else if (e.k === 'buff') {
      e.ids.forEach(id => playFx('blessing', bt.units[id], .7));
    }
  }
}

// ───────── 전투가 끝난 뒤 ─────────
function income(won) {
  const c = chap();
  const base = c.siege ? (c.income[S.day] || 2) : 5;
  const interest = Math.min(3, Math.floor(S.gold / 10));
  const s = Math.abs(S.streak);
  const streak = s >= 4 ? 3 : s >= 3 ? 2 : s >= 2 ? 1 : 0;
  const winB = won ? 1 : 0;
  const total = base + interest + streak + winB;
  S.gold += total;
  addXp(2);
  return `<div class="income"><div>기본 수입 <b>+${base}</b></div><div>이자 (군량 10마다 1) <b>+${interest}</b></div>${streak ? `<div>${S.streak > 0 ? '🔥 연승' : '💧 연패'} 보너스 <b>+${streak}</b></div>` : ''}${winB ? '<div>승리 보너스 <b>+1</b></div>' : ''}<div class="sum">🌾 군량 +${total} · 경험치 +2</div></div>`;
}
function pickItem(done) {
  const keys = Object.keys(ITEMS);
  const opts = [];
  while (opts.length < 3) { const k = rnd(keys); if (!opts.includes(k)) opts.push(k); }
  modal(`<h3>🎁 전리품 상자</h3><p>아이템 하나를 골라요. 대기석 아래 아이템 칸에서 눌러 군사에게 줄 수 있어요.</p><div class="item-pick">${opts.map(k => `<button class="ipick" data-k="${k}"><span class="big-ic">${ITEMS[k].icon}</span><b>${ITEMS[k].name}</b><small>${ITEMS[k].desc}</small></button>`).join('')}</div>`, (box) => {
    box.querySelectorAll('.ipick').forEach(b => b.onclick = () => {
      if (S.items.length < TRAY_MAX) S.items.push(b.dataset.k); play('coin'); closeModal(); done();
    });
  });
}
function backToBoard() {
  S.phase = 'prep'; music(prepTrack());
  $('#game').classList.remove('in-battle');
  $('#prepControls').classList.remove('hidden');
  $('#battleControls').classList.add('hidden');
}
function endBattle(result) {
  const c = chap();
  const won = result === 'win';
  S.streak = won ? Math.max(1, S.streak + 1) : Math.min(-1, S.streak - 1);
  if (c.siege) return endSiegeDay(result);
  const st = stage();
  const inc = income(won);
  updateTop();
  if (won || st.scripted) {
    play(won ? 'win' : 'lose');
    modal(`<div class="big-result ${won ? 'win' : 'lose'}">${won ? '승리!' : '패배…'}</div><p>${won ? '조선군이 이겼어요!' : '조총을 가진 일본군이 너무 강했어요.'}</p>${inc}<button class="btn big" id="rNext">계속</button>`, (box) => {
      box.querySelector('#rNext').onclick = () => { closeModal(); backToBoard(); afterStage(won); };
    });
  } else {
    play('lose');
    modal(`<div class="big-result lose">아쉬워요!</div><p>자리를 바꾸거나, 군사를 더 사거나, ★2를 만들거나, 아이템을 줘서 다시 도전해 보세요.</p>${inc}<button class="btn big" id="rRetry">다시 도전</button>`, (box) => {
      box.querySelector('#rRetry').onclick = () => { closeModal(); backToBoard(); enterPrep(true); };
    });
  }
}
function enterPrep(newShop) {
  S.phase = 'prep'; S.sel = null;
  if (newShop) rollShop();
  backToBoard();
  renderAll();
}
function afterStage(won) {
  const c = chap(), st = stage();
  if (won && st.id === '2-2') S.flags.navy = true;
  if (won && st.id === '2-3') S.flags.militia = true;
  let lines = st.scripted ? (won ? st.win.concat(st.lose.slice(1)) : st.lose) : st.win;
  const forts = S.battle ? S.battle.forts : 0;
  if (won && forts) { S.gold += forts; updateTop(); lines = [{ who:'안내', text:`🏯 ${stage().fortWord || '진'}을 ${forts}곳 세웠어요! 군량 +${forts}` }].concat(lines); }
  if (st.pass && S.passAfter) lines = lines.concat([S.passAfter]);
  const steps = [];
  if (won) steps.push((n) => pickItem(n));
  steps.push((n) => showStory(lines, n));
  if (st.map) steps.push((n) => showMap(st.map, n));
  steps.push((n) => { if (st.reward.xp) addXp(st.reward.xp); n(); });
  seq(steps, () => { if (S.stage + 1 < c.stages.length) startStage(S.stage + 1); else endChapter(); });
}
function endChapter() {
  const c = chap();
  const steps = [(n) => showStory(c.outro, n)];
  if (c.id === 1) steps.push((n) => showMap('all', n));
  if (c.damage) steps.push((n) => showDamage('전쟁의 결과', c.damage, n));
  steps.push((n) => runBrief(c.endBrief || [], n, true));
  if (c.endQuiz) steps.push((n) => showQuiz(c.endQuiz, () => n()));
  steps.push((n) => showSummary(c, n));
  seq(steps, () => { save.cleared[c.id] = true; writeSave(); renderChapters(); show('chapters'); });
}
function showDamage(title, cards, done) {
  play('page');
  modal(`<h3>${title}</h3><div class="dmg-cards">${cards.map((d, i) => `<div class="dmg-card" style="animation-delay:${i * .6}s"><span class="ic">${d.icon}</span><span>${d.text}</span></div>`).join('')}</div><button class="btn big" id="dNext">다음</button>`, (box) => {
    box.querySelector('#dNext').onclick = () => { closeModal(); done(); };
  });
}
// 빈칸 낱말은 [정답] 또는 [정답|다른 답]. 띄어쓰기·'섬'·숫자/한글(4군=사군)은 같게 봄
const normAns = (t) => t.replace(/[\s·,.]/g, '').replace(/사(?=군)/g, '4').replace(/육(?=진)/g, '6').replace(/섬$/, '');
function showSummary(c, done) {
  const ans = [];
  const html = c.summary.text.replace(/\[([^\]]+)\]/g, (_, w) => { const k = ans.length; ans.push(w.split('|')); return `<input class="blank" data-k="${k}" autocomplete="off" autocapitalize="off" spellcheck="false" size="${Math.max(3, w.split('|')[0].length + 1)}" aria-label="빈칸 ${k + 1}">`; });
  modal(`<h3>📖 교과서 정리</h3><p class="muted">빈칸에 들어갈 말을 <b>직접 써</b> 보세요.</p><p class="summary">${html}</p>
    <p id="sMsg" class="muted small"></p><p><button class="btn big" id="sCheck">확인</button><button class="btn big hidden" id="sNext">${c.title.split('.')[0]} 완료!</button></p>`, (box) => {
    const inputs = [...box.querySelectorAll('.blank')], tries = ans.map(() => 0);
    inputs.forEach((b, i) => b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); (inputs[i + 1] || box.querySelector('#sCheck')).focus(); } }));
    const check = () => {
      let left = 0, firstWrong = null;
      inputs.forEach((b, k) => {
        if (b.classList.contains('ok') || b.classList.contains('shown')) return;
        const v = normAns(b.value);
        if (v && ans[k].some(a => normAns(a) === v)) { b.classList.remove('wrong'); b.classList.add('ok'); b.readOnly = true; return; }
        tries[k]++;
        if (tries[k] >= 3) { b.value = ans[k][0]; b.classList.remove('wrong'); b.classList.add('shown'); b.readOnly = true; return; }
        left++;
        b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
        if (tries[k] === 2) { b.value = ''; b.placeholder = ans[k][0][0] + '…'; }
        firstWrong = firstWrong || b;
      });
      const msg = box.querySelector('#sMsg');
      if (left) { play('error'); msg.textContent = '빨간 칸을 다시 써 보세요. 두 번 틀리면 첫 글자를, 세 번 틀리면 정답을 알려 줘요.'; firstWrong.focus(); }
      else { play('coin'); msg.textContent = inputs.some(b => b.classList.contains('shown')) ? '회색 칸은 정답을 알려 준 거예요. 한 번 더 읽어 보세요.' : '모두 맞혔어요! 훌륭해요.';
        box.querySelector('#sCheck').classList.add('hidden'); box.querySelector('#sNext').classList.remove('hidden'); }
    };
    box.querySelector('#sCheck').onclick = check;
    box.querySelector('#sNext').onclick = () => { play('win'); closeModal(); done(); };
  });
}

// ───────── 병자호란(버티기) ─────────
function endSiegeDay(result) {
  const c = chap();
  backToBoard();
  if (result === 'win') {
    S.held = S.day; play('win');
    S.food = Math.max(0, S.food - 20); S.wood = Math.max(0, S.wood - 20);
    const last = S.day >= c.days;
    const inc = last ? '' : income(true);
    updateTop();
    modal(`<div class="big-result win">${S.day}일째를 버텼어요!</div><p>하지만 성안의 🍚식량과 🔥땔감은 또 줄었어요. (식량 ${S.food}, 땔감 ${S.wood})</p>${inc}<button class="btn big" id="sdNext">계속</button>`, (box) => {
      box.querySelector('#sdNext').onclick = () => {
        closeModal();
        if (S.meetBuff) S.meetBuff = null;
        if (last) return surrender(false);
        const next = () => (S.day === c.meeting.after ? showMeeting(() => startDay(S.day + 1)) : startDay(S.day + 1));
        pickItem(next);
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
      modal(`<h3>남한산성 버티기 기록</h3><div class="stars-big">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><p><b>${held}일</b> 동안 남한산성을 지켜 냈어요.</p><div class="why">역사의 결과는 바꿀 수 없어요. 하지만 그때 성안의 사람들이 추위와 배고픔 속에서 어떤 고민을 했는지 생각해 보는 것이 중요해요.</div><p><button class="btn big" id="eNext">다음</button></p>`, (box) => {
        box.querySelector('#eNext').onclick = () => { closeModal(); n(); };
      });
    },
    (n) => runBrief(c.endBrief || [], n, true),
    (n) => showQuiz(c.endQuiz, () => n()),
    (n) => showSummary(c, n),
  ], () => { save.cleared[c.id] = true; writeSave(); renderChapters(); show('chapters'); });
}

// ───────── 1장 지도 ─────────
const KOREA = 'M40,110 L55,104 L70,95 L100,78 L130,62 L160,50 L186,40 L215,32 L240,26 L266,20 L258,40 L246,56 L232,74 L214,92 L204,108 L202,126 L214,150 L226,180 L236,214 L242,250 L244,282 L238,306 L228,326 L214,338 L196,340 L176,344 L156,348 L134,352 L112,356 L94,350 L86,334 L90,316 L96,298 L92,278 L98,258 L102,238 L92,224 L76,214 L58,206 L64,192 L80,184 L90,168 L82,152 L70,140 L56,128 L44,118 Z';
function showMap(key, done) {
  if (key !== 'all' && !S.maps.includes(key)) S.maps.push(key);
  const has = (k) => key === 'all' || S.maps.includes(k);
  const flag = (x, y, c) => `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-16" stroke="#3a2a10" stroke-width="1.5"/><path d="M0,-16 L12,-12 L0,-8 Z" fill="${c}"/></g>`;
  const gun4 = [[166,64],[148,72],[130,80],[112,90]].map(p => flag(p[0], p[1], '#1f4e8c')).join('');
  const jin6 = [[204,50],[216,47],[228,44],[240,41],[251,38],[260,35]].map(p => flag(p[0], p[1], '#2f7a4f')).join('');
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
    ${has('tsushima') ? flag(262, 362, '#b02a24') + '<text x="224" y="352" font-size="10" font-weight="900" fill="#b02a24">항복!</text>' : ''}
    ${has('4gun') ? gun4 + '<text x="112" y="110" font-size="13" font-weight="900" fill="#1f4e8c">4군</text>' : ''}
    ${has('6jin') ? jin6 + '<text x="216" y="66" font-size="13" font-weight="900" fill="#2f7a4f">6진</text>' : ''}
  </svg>`;
  play('ok');
  modal(`<h3>🗺 ${msg}</h3><div class="map-wrap">${svg}</div><p class="muted small">그림 지도(대략적인 모양)</p><button class="btn big" id="mpNext">다음</button>`, (box) => {
    box.querySelector('#mpNext').onclick = () => { closeModal(); done(); };
  });
}

// ───────── 메뉴 ─────────
function syncSoundBtn() {
  $('#btnSound').textContent = save.sound ? '🔊 효과음 끄기' : '🔇 효과음 켜기';
  $('#btnMusic').textContent = save.music ? '🎵 음악 끄기' : '🔇 음악 켜기';
  $('#btnMusicT').textContent = save.music ? '🎵 음악 켜짐' : '🔇 음악 꺼짐';
}
function toggleMusic() { save.music = !save.music; writeSave(); syncSoundBtn(); if (save.music) { BGM.cur = null; musicUnlock(); } else musicStop(); }
$('#btnMusic').onclick = toggleMusic;
$('#btnMusicT').onclick = (e) => { e.stopPropagation(); toggleMusic(); };
syncSoundBtn();
$('#btnMenu').onclick = () => { syncSoundBtn(); $('#menu').classList.remove('hidden'); };
$('#btnCloseMenu').onclick = () => $('#menu').classList.add('hidden');
$('#btnSound').onclick = () => { save.sound = !save.sound; writeSave(); syncSoundBtn(); };
function stopAll() { $('#menu').classList.add('hidden'); bTok++; sayQ.length = 0; if (S) backToBoard(); closeModal(); $('#story').classList.add('hidden'); }
$('#btnRestartCh').onclick = () => { stopAll(); startChapter(S.ch); };
$('#btnToChapters').onclick = () => { stopAll(); renderChapters(); show('chapters'); };

// 시작 화면 군사들
$('#titleArmy').innerHTML = ['yiSS','turtle','spear','archer','militia'].map(t => `<span class="mini p">${spriteHTML(t)}</span>`).join('') + '<span class="vs">VS</span>' + ['gun','samurai','qing'].map(t => `<span class="mini e">${spriteHTML(t)}</span>`).join('');

// 개발용 미리보기: ?demo=prep|battle&ch=0 (화면 확인용, 수업에는 쓰지 않음)
(function demo() {
  const q = new URLSearchParams(location.search);
  if (!q.get('demo')) return;
  const ch = +(q.get('ch') || 0);
  startChapter(ch);
  $('#story').classList.add('hidden');
  if (CHAPTERS[ch].siege) { S.day = 1; } else { S.stage = +(q.get('st') || 0); }
  S.level = 5; S.gold = 23; S.streak = 2;
  const st = CHAPTERS[ch].stages ? CHAPTERS[ch].stages[S.stage] : null;
  const army = st && st.sea && st.id === '1-1' ? [['ship',2,4,1,['leeJM','spear']],['ship',4,4,1,['archer','spear']],['ship',3,5,1]]
    : st && st.sea ? [['yiSS',3,5,1],['turtle',3,3,2],['panok',4,4,1],['panok',2,4,1],['ship',5,3,1]]
    : ch === 2 ? [['spear',2,4,2],['spear',4,4,1],['archer',2,5,1],['gunner',4,5,1],['spear',3,4,1]]
    : ch === 1 ? [['ming',3,3,2],['mingGun',3,5,1],['militia',2,3,1],['milLead',4,4,1],['ming',5,3,1]]
    : [['kimJS',3,4,1],['spear',2,3,2],['cavalry',4,3,1],['archer',3,5,1],['rocket',1,5,1]];
  S.flags = { navy: true, militia: true };
  S.board = army.map(([t, x, y, s, cg]) => ({ u: Object.assign(newUnit(t, s), { items: UNITS[t].general ? ['sword', 'book'] : [], cargo: (cg || []).map(c => newUnit(c)) }), x, y }));
  S.bench[0] = newUnit('spear'); S.bench[1] = newUnit('cavalry');
  S.items = ['armor', 'powder', 'ginseng'];
  enterPrep(true);
  S.info = { unit: S.board[0].u };
  renderAll();
  if (q.get('demo') === 'battle') { S.speed = 1; setTimeout(startBattle, 300); }
})();
