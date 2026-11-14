/* 조선 수호 장기 — 자동 전투 엔진 (코드로 직접 만듦)
   육각형 판, 마나·스킬, 아이템. 화면과 분리되어 node에서도 돌릴 수 있음. */
const COLS = 7, ROWS = 6;
const TICK_MS = 190;

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
  const seen = new Set();
  for (const u of units) {
    const d = UNITS[u.type];
    for (const t of d.traits) c[t] = (c[t] || 0) + (u.type === 'yiSS' && t === '수군' ? 2 : 1);
    seen.add(u.type);
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
   opts: { mult, atkMul, hpMul, surviveTicks, maxTicks } */
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
      id: id++, side, type, star, x, y, hp, maxHp: hp, atk: d.atk * atM,
      range: d.range, interval: d.cd * 2 / (1 + 0.35 * has('quiver')), cdLeft: side === 'e' ? 2 : 0,
      moveEvery: d.move > 1 ? 1 : 2, moveLeft: 0,
      mana: 40 * has('book') + (sk ? sk.startMana || 0 : 0), maxMana: sk ? sk.mana : 0,
      skillPow: 1 + 0.4 * has('powder'), regen: 0.01 * has('ginseng'),
      shield: 0, stun: 0, buffAtk: 1, items: it.slice(), fixed: !!d.fixed, splash: !!d.splash,
      crit: 0.1, alive: true,
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
  return { units, tick: 0, over: false, result: null, buffs, counts,
    surviveTicks: opts.surviveTicks || 0, maxTicks: opts.maxTicks || 330 };
}

function occupied(b, x, y) { return b.units.some(u => u.alive && u.x === x && u.y === y); }
function enemiesOf(b, u) { return b.units.filter(o => o.alive && o.side !== u.side); }
function alliesOf(b, u) { return b.units.filter(o => o.alive && o.side === u.side && !o.fixed); }

function findTarget(b, u) {
  let best = null, bd = 1e9, be = 1e9;
  for (const o of enemiesOf(b, u)) {
    const d = hexDist(u, o), e = eucl(u, o);
    if (d < bd || (d === bd && (e < be - 1e-6 || (Math.abs(e - be) < 1e-6 && o.hp < best.hp)))) { best = o; bd = d; be = e; }
  }
  return best;
}

function dealDamage(b, ev, src, tgt, amount, opts = {}) {
  if (!tgt.alive) return;
  let dmg = amount * (0.92 + Math.random() * 0.16);
  let crit = false;
  if (!opts.noCrit && Math.random() < src.crit) { dmg *= 1.6; crit = true; }
  dmg = Math.max(1, Math.round(dmg));
  let left = dmg;
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, left); tgt.shield -= a; left -= a; }
  tgt.hp -= left;
  if (tgt.maxMana) tgt.mana = Math.min(tgt.maxMana, tgt.mana + 3);
  ev.push({ k: 'dmg', id: tgt.id, dmg, crit, skill: !!opts.skill });
  if (tgt.hp <= 0) { tgt.alive = false; tgt.hp = 0; ev.push({ k: 'die', id: tgt.id }); }
}
function heal(ev, u, amount) {
  if (!u.alive) return;
  const a = Math.round(Math.min(u.maxHp - u.hp, amount));
  if (a <= 0) return;
  u.hp += a; ev.push({ k: 'heal', id: u.id, amt: a });
}

// 스킬 쓰기
function castSkill(b, ev, u, target) {
  const sk = SKILLS[UNITS[u.type].skill];
  const pow = u.atk * u.buffAtk * u.skillPow;
  const hit = [];
  ev.push({ k: 'cast', id: u.id, name: sk.name, fx: sk.fx, big: !!sk.big });
  const foes = enemiesOf(b, u);
  switch (sk.kind) {
    case 'strike': {
      dealDamage(b, ev, u, target, pow * sk.mult, { skill: true });
      hit.push(target);
      if (sk.splash) for (const o of foes) if (o !== target && o.alive && hexDist(o, target) <= sk.splash) { dealDamage(b, ev, u, o, pow * sk.mult * 0.6, { skill: true }); hit.push(o); }
      if (sk.stun && target.alive) { target.stun = sk.stun; ev.push({ k: 'stun', id: target.id }); }
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

function stepBattle(b) {
  if (b.over) return [];
  const ev = [];
  b.tick++;
  const order = b.units.filter(u => u.alive && !u.fixed);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const u of order) {
    if (!u.alive) continue;
    if (u.regen && b.tick % 5 === 0) heal(ev, u, u.maxHp * u.regen);
    if (u.stun > 0) { u.stun--; continue; }
    const t = findTarget(b, u);
    if (!t) break;
    if (hexDist(u, t) <= u.range) {
      u.cdLeft -= 1;
      if (u.cdLeft > 0) continue;
      u.cdLeft += u.interval;
      if (u.maxMana && u.mana >= u.maxMana) { u.mana = 0; castSkill(b, ev, u, t); continue; }
      const hits = [t];
      if (u.splash) for (const o of b.units) if (o.alive && o.side === t.side && o !== t && hexDist(o, t) === 1) hits.push(o);
      ev.push({ k: 'atk', from: u.id, to: t.id, ranged: u.range > 1 });
      hits.forEach((h, i) => dealDamage(b, ev, u, h, u.atk * u.buffAtk * (i === 0 ? 1 : 0.5)));
      if (u.maxMana) u.mana = Math.min(u.maxMana, u.mana + 10);
    } else {
      if (u.cdLeft > 0) u.cdLeft -= 1;
      u.moveLeft -= 1;
      if (u.moveLeft > 0) continue;
      u.moveLeft = u.moveEvery;
      let best = null, bd = hexDist(u, t), be = eucl(u, t);
      for (const p of neighbors(u.x, u.y)) {
        if (occupied(b, p.x, p.y)) continue;
        const d = hexDist(p, t), e = eucl(p, t);
        if (d < bd || (d === bd && e < be - 0.01)) { best = p; bd = d; be = e; }
      }
      if (best) { u.x = best.x; u.y = best.y; ev.push({ k: 'move', id: u.id, x: u.x, y: u.y }); }
    }
  }
  const pAlive = b.units.some(u => u.alive && u.side === 'p' && !u.fixed);
  const castle = b.units.find(u => u.fixed);
  const eAlive = b.units.some(u => u.alive && u.side === 'e');
  if (castle) {
    if (!castle.alive) { b.over = true; b.result = 'lose'; }
    else if (!eAlive || b.tick >= b.surviveTicks) { b.over = true; b.result = 'win'; }
  } else if (!eAlive) { b.over = true; b.result = 'win'; }
  else if (!pAlive || b.tick >= b.maxTicks) { b.over = true; b.result = 'lose'; }
  if (b.over) ev.push({ k: 'end', result: b.result });
  return ev;
}

if (typeof module !== 'undefined') module.exports = { createBattle, stepBattle };
