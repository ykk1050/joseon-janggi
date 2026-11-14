/* 조선 수호 장기 — 차례(턴)제 전투 엔진 (코드로 직접 만듦)
   장기처럼 우리 차례에 군사를 하나씩 움직이고 공격한 뒤, 적의 차례가 와요.
   육각형 판, 마나·필살기, 아이템. 화면과 분리되어 node에서도 돌릴 수 있음. */
const COLS = 7, ROWS = 6;
const ATK_SCALE = 2.5;   // 차례제에서는 한 번 공격이 더 중요하므로 공격력을 키움 (화면 표시도 이 값을 곱함)
const MANA_ATK = 25;     // 공격할 때 차는 마나
const MANA_HIT = 10;     // 맞을 때 차는 마나
const MAX_ROUNDS = 12;   // 이 차례 안에 이기지 못하면 짐 (버티기 장은 surviveRounds)
const moveOf = (d) => (d.move > 1 ? 3 : 2);   // 한 번에 갈 수 있는 칸 수 (빠른 군사 3칸)

// 홀수 행이 오른쪽으로 반 칸 밀린 육각형 판
function cube(p) { const q = p.x - (p.y - (p.y & 1)) / 2; return [q, p.y, -q - p.y]; }
function hexDist(a, b) { const A = cube(a), B = cube(b); return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2])); }
const NB_EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
const NB_ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
function neighbors(x, y) { return (y & 1 ? NB_ODD : NB_EVEN).map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter(p => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS); }
function hexPx(p) { return { x: p.x + (p.y & 1) * 0.5, y: p.y * 0.866 }; } // 거리 비교용
function eucl(a, b) { const A = hexPx(a), B = hexPx(b); return Math.hypot(A.x - B.x, A.y - B.y); }

// 시너지
function countTraits(units) {
  const c = {};
  for (const u of units) {
    const d = UNITS[u.type];
    for (const t of d.traits) c[t] = (c[t] || 0) + (u.type === 'yiSS' && t === '수군' ? 2 : 1);
  }
  return c;
}
function activeBuffs(counts) {
  const b = {};
  for (const t in TRAITS) { const s = TRAITS[t].steps; let l = 0; s.forEach((n, i) => { if ((counts[t] || 0) >= n) l = i + 1; }); b[t] = l; }
  b.crisis = b['수군'] > 0 && b['의병'] > 0 && b['명군'] > 0;
  return b;
}
function starMul(star) { return star === 3 ? 3.2 : star === 2 ? 1.8 : 1; }

/* players: [{type, star, x, y, items:[]}], enemies: [[type, x, y]]
   opts: { mult, atkMul, hpMul, surviveRounds, maxRounds } */
function createBattle(players, enemies, opts = {}) {
  const units = [];
  let id = 0;
  const counts = countTraits(players.filter(p => !UNITS[p.type].fixed));
  const buffs = activeBuffs(counts);
  const make = (side, type, star, x, y, hpM, atM, items) => {
    const d = UNITS[type];
    const it = items || [];
    const has = (k) => it.filter(i => i === k).length;
    hpM *= 1 + 0.35 * has('armor');
    atM *= 1 + 0.25 * has('sword');
    const hp = Math.round(d.hp * hpM);
    const sk = d.skill ? SKILLS[d.skill] : null;
    return {
      id: id++, side, type, star, x, y, hp, maxHp: hp, atk: d.atk * atM * ATK_SCALE,
      range: d.range + (d.range > 0 ? has('quiver') : 0), mv: d.fixed ? 0 : moveOf(d),
      mana: Math.min(sk ? sk.mana : 0, 40 * has('book') + (sk ? sk.startMana || 0 : 0)), maxMana: sk ? sk.mana : 0,
      skillPow: 1 + 0.4 * has('powder'), regen: 0.08 * has('ginseng'),
      shield: 0, stun: 0, buffAtk: 1, items: it.slice(), fixed: !!d.fixed, splash: !!d.splash,
      crit: 0.1, alive: true, moved: false, done: false,
    };
  };
  for (const p of players) {
    const d = UNITS[p.type];
    let hpM = starMul(p.star), atM = starMul(p.star);
    if (!d.fixed) {
      if (buffs['관군'] && d.traits.includes('관군')) hpM *= 1.2;
      if (buffs['장수']) atM *= 1.1;
      if (buffs['수군'] && d.traits.includes('수군')) atM *= buffs['수군'] === 2 ? 1.5 : 1.25;
      if (buffs['의병'] && d.traits.includes('의병')) { hpM *= 1.3; atM *= 1.1; }
      if (buffs['명군'] && d.traits.includes('명군')) atM *= 1.3;
      if (buffs.crisis) { hpM *= 1.2; atM *= 1.2; }
      hpM *= (opts.hpMul || 1); atM *= (opts.atkMul || 1);
    }
    units.push(make('p', p.type, p.star || 1, p.x, p.y, hpM, atM, p.items));
  }
  const m = opts.mult || 1;
  for (const [type, x, y] of enemies) units.push(make('e', type, 1, x, y, m, m, []));
  return { units, round: 1, side: 'p', over: false, result: null, buffs, counts,
    surviveRounds: opts.surviveRounds || 0, maxRounds: opts.maxRounds || MAX_ROUNDS };
}

const unitAt = (b, x, y) => b.units.find(u => u.alive && u.x === x && u.y === y);
function enemiesOf(b, u) { return b.units.filter(o => o.alive && o.side !== u.side); }
function alliesOf(b, u) { return b.units.filter(o => o.alive && o.side === u.side && !o.fixed); }
const canAct = (u) => u.alive && !u.fixed && !u.done && u.stun <= 0;
const skillReady = (u) => u.maxMana > 0 && u.mana >= u.maxMana;
const skillOf = (u) => SKILLS[UNITS[u.type].skill];
const skillNeedsTarget = (u) => skillOf(u).kind === 'strike';

// 갈 수 있는 칸: 우리 편 칸은 지나갈 수 있지만 멈출 수는 없고, 적이 있는 칸은 지나갈 수 없음
function reachable(b, u) {
  if (u.moved || u.mv <= 0) return [];
  const seen = new Map([[u.x + ',' + u.y, 0]]);
  const out = [];
  let front = [{ x: u.x, y: u.y }];
  for (let step = 1; step <= u.mv; step++) {
    const next = [];
    for (const p of front) for (const n of neighbors(p.x, p.y)) {
      const k = n.x + ',' + n.y;
      if (seen.has(k)) continue;
      const o = unitAt(b, n.x, n.y);
      if (o && o.side !== u.side) continue;
      seen.set(k, step);
      next.push(n);
      if (!o) out.push({ x: n.x, y: n.y, d: step });
    }
    front = next;
  }
  return out;
}
// pos 자리에서 공격할 수 있는 적
function targetsFrom(b, u, pos = u) { return enemiesOf(b, u).filter(o => hexDist(pos, o) <= u.range); }

function dealDamage(b, ev, src, tgt, amount, opts = {}) {
  if (!tgt.alive) return;
  let dmg = amount * (0.92 + Math.random() * 0.16);
  let crit = false;
  if (!opts.noCrit && Math.random() < src.crit) { dmg *= 1.6; crit = true; }
  dmg = Math.max(1, Math.round(dmg));
  let left = dmg;
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, left); tgt.shield -= a; left -= a; }
  tgt.hp -= left;
  if (tgt.maxMana) tgt.mana = Math.min(tgt.maxMana, tgt.mana + MANA_HIT);
  ev.push({ k: 'dmg', id: tgt.id, dmg, crit, skill: !!opts.skill });
  if (tgt.hp <= 0) { tgt.alive = false; tgt.hp = 0; ev.push({ k: 'die', id: tgt.id }); }
}
function heal(ev, u, amount) {
  if (!u.alive) return;
  const a = Math.round(Math.min(u.maxHp - u.hp, amount));
  if (a <= 0) return;
  u.hp += a; ev.push({ k: 'heal', id: u.id, amt: a });
}

// 필살기
function castSkill(b, ev, u, target) {
  const sk = skillOf(u);
  const pow = u.atk * u.buffAtk * u.skillPow;
  const hit = [];
  ev.push({ k: 'cast', id: u.id, name: sk.name, fx: sk.fx, big: !!sk.big });
  const foes = enemiesOf(b, u);
  switch (sk.kind) {
    case 'strike': {
      dealDamage(b, ev, u, target, pow * sk.mult, { skill: true });
      hit.push(target);
      if (sk.splash) for (const o of foes) if (o !== target && o.alive && hexDist(o, target) <= sk.splash) { dealDamage(b, ev, u, o, pow * sk.mult * 0.6, { skill: true }); hit.push(o); }
      if (sk.stun && target.alive) { target.stun = 1; ev.push({ k: 'stun', id: target.id }); }
      if (sk.selfShield) { u.shield += u.maxHp * sk.selfShield; ev.push({ k: 'shield', id: u.id }); }
      if (sk.selfHeal) heal(ev, u, u.maxHp * sk.selfHeal);
      break;
    }
    case 'multi': {
      for (let i = 0; i < sk.n; i++) {
        const live = foes.filter(o => o.alive); if (!live.length) break;
        const t = live[Math.floor(Math.random() * live.length)];
        ev.push({ k: 'shot', from: u.id, to: t.id });
        dealDamage(b, ev, u, t, pow * sk.mult, { skill: true }); hit.push(t);
      }
      break;
    }
    case 'snipe': {
      const live = foes.filter(o => o.alive && !o.fixed); if (!live.length) break;
      const t = live.reduce((a, c) => (c.hp < a.hp ? c : a));
      ev.push({ k: 'shot', from: u.id, to: t.id });
      dealDamage(b, ev, u, t, pow * sk.mult, { skill: true }); hit.push(t);
      break;
    }
    case 'all': {
      for (const o of foes) { dealDamage(b, ev, u, o, pow * sk.mult, { skill: true }); hit.push(o); }
      break;
    }
    case 'healAll': {
      for (const a of alliesOf(b, u)) if (!sk.trait || UNITS[a.type].traits.includes(sk.trait)) { heal(ev, a, a.maxHp * sk.pct * u.skillPow); hit.push(a); }
      break;
    }
    case 'shieldAll': {
      for (const a of alliesOf(b, u)) { a.shield += a.maxHp * sk.pct * u.skillPow; ev.push({ k: 'shield', id: a.id }); hit.push(a); }
      break;
    }
    case 'shieldSelf': {
      u.shield += u.maxHp * sk.pct * u.skillPow; ev.push({ k: 'shield', id: u.id }); hit.push(u);
      break;
    }
    case 'buffAll': {
      for (const a of alliesOf(b, u)) { a.buffAtk = Math.min(1.9, a.buffAtk + sk.pct); hit.push(a); }
      ev.push({ k: 'buff', ids: hit.map(h => h.id) });
      break;
    }
  }
  ev[ev.findIndex(e => e.k === 'cast' && e.id === u.id)].targets = hit.map(h => h.id);
}

// ───────── 행동 (화면에서 부르는 것) ─────────
function doMove(b, u, x, y) {
  const ev = [];
  if (!canAct(u) || !reachable(b, u).some(p => p.x === x && p.y === y)) return ev;
  u.x = x; u.y = y; u.moved = true;
  ev.push({ k: 'move', id: u.id, x, y });
  return ev;
}
function doAttack(b, u, t) {
  const ev = [];
  if (!canAct(u) || !t || !t.alive || hexDist(u, t) > u.range) return ev;
  const hits = [t];
  if (u.splash) for (const o of b.units) if (o.alive && o.side === t.side && o !== t && hexDist(o, t) === 1) hits.push(o);
  ev.push({ k: 'atk', from: u.id, to: t.id, ranged: u.range > 1 });
  hits.forEach((h, i) => dealDamage(b, ev, u, h, u.atk * u.buffAtk * (i === 0 ? 1 : 0.5)));
  if (u.maxMana) u.mana = Math.min(u.maxMana, u.mana + MANA_ATK);
  u.done = true;
  checkEnd(b, ev);
  return ev;
}
function doSkill(b, u, t) {
  const ev = [];
  if (!canAct(u) || !skillReady(u)) return ev;
  if (skillNeedsTarget(u) && (!t || !t.alive || hexDist(u, t) > u.range)) return ev;
  u.mana = 0;
  castSkill(b, ev, u, t);
  u.done = true;
  checkEnd(b, ev);
  return ev;
}
function doWait(b, u) { u.done = true; return []; }

// 차례 시작: 인삼 회복, 기절한 군사는 이번 차례를 쉼
function beginTurn(b, side) {
  const ev = [];
  b.side = side;
  for (const u of b.units) {
    if (!u.alive || u.side !== side) continue;
    u.moved = false; u.done = false;
    if (u.regen) heal(ev, u, u.maxHp * u.regen);
    if (u.stun > 0) { u.stun--; u.done = true; ev.push({ k: 'rest', id: u.id }); }
  }
  return ev;
}
// 차례 끝: 적 차례가 끝나면 한 바퀴(라운드)가 지나감
function endTurn(b) {
  const ev = [];
  if (b.over) return ev;
  if (b.side === 'e') {
    const castle = b.units.find(u => u.fixed);
    if (castle && b.round >= b.surviveRounds) { b.over = true; b.result = 'win'; }
    else if (!castle && b.round >= b.maxRounds) { b.over = true; b.result = 'lose'; }
    else b.round++;
    if (b.over) ev.push({ k: 'end', result: b.result });
  }
  return ev;
}
function checkEnd(b, ev) {
  if (b.over) return;
  const castle = b.units.find(u => u.fixed);
  const pAlive = b.units.some(u => u.alive && u.side === 'p' && !u.fixed);
  const eAlive = b.units.some(u => u.alive && u.side === 'e');
  if (castle && !castle.alive) { b.over = true; b.result = 'lose'; }
  else if (!eAlive) { b.over = true; b.result = 'win'; }
  else if (!castle && !pAlive) { b.over = true; b.result = 'lose'; }
  if (b.over) ev.push({ k: 'end', result: b.result });
}

// ───────── 생각하는 군사 (적, 그리고 「자동」 버튼) ─────────
function pickTarget(u, list) {
  // 한 번에 쓰러뜨릴 수 있는 적 → 체력이 가장 적은 적 (성은 맨 나중)
  const dmg = u.atk * u.buffAtk;
  return list.slice().sort((a, c) => ((a.hp + a.shield <= dmg ? 0 : 1) - (c.hp + c.shield <= dmg ? 0 : 1)) || ((a.fixed ? 1 : 0) - (c.fixed ? 1 : 0)) || (a.hp + a.shield - c.hp - c.shield))[0];
}
function planMove(b, u) {
  const foes = enemiesOf(b, u);
  if (!foes.length) return null;
  const cells = [{ x: u.x, y: u.y, d: 0 }].concat(reachable(b, u));
  let best = null, bs = -1e9;
  for (const c of cells) {
    const near = Math.min(...foes.map(o => hexDist(c, o)));
    const inRange = foes.some(o => hexDist(c, o) <= u.range);
    let s;
    if (inRange) s = 1000 + (u.range > 1 ? near * 5 : -near) - c.d * 0.5;   // 활·총은 멀찍이, 칼·창은 바짝
    else s = -near * 10 - Math.min(...foes.map(o => eucl(c, o))) - c.d * 0.1;
    if (s > bs + 1e-6) { bs = s; best = c; }
  }
  return best && (best.x !== u.x || best.y !== u.y) ? best : null;
}
// 한 군사의 행동: { moveEv, actEv } (화면에서 이동과 공격을 따로 보여 주려고 나눔)
function aiAct(b, u) {
  const out = { moveEv: [], actEv: [] };
  if (!canAct(u) || b.over) return out;
  const sk = skillReady(u) && !skillNeedsTarget(u);
  const p = planMove(b, u);
  if (p) out.moveEv = doMove(b, u, p.x, p.y);
  const ts = targetsFrom(b, u);
  if (skillReady(u) && skillNeedsTarget(u) && ts.length) out.actEv = doSkill(b, u, pickTarget(u, ts));
  else if (sk) out.actEv = doSkill(b, u, null);
  else if (ts.length) out.actEv = doAttack(b, u, pickTarget(u, ts));
  else doWait(b, u);
  return out;
}
// 움직이는 순서: 적과 가까운 군사부터
function actOrder(b, side) {
  return b.units.filter(u => u.alive && u.side === side && !u.fixed)
    .sort((a, c) => Math.min(...enemiesOf(b, a).map(o => hexDist(a, o)), 99) - Math.min(...enemiesOf(b, c).map(o => hexDist(c, o)), 99));
}
// 한 편 전체를 자동으로 (난이도 시험용)
function autoTurn(b, side) {
  beginTurn(b, side);
  for (const u of actOrder(b, side)) { if (b.over) break; aiAct(b, u); }
  return endTurn(b);
}

if (typeof module !== 'undefined') module.exports = { createBattle, beginTurn, endTurn, aiAct, autoTurn };
