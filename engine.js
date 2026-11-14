/* 조선 수호 장기 — 자동 전투 엔진 (코드로 직접 만듦)
   화면과 분리되어 있어 node에서도 돌릴 수 있음. */
const COLS = 6, ROWS = 6;

function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
function eucl(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// 판 위 아군 구성으로 시너지 계산
function countTraits(units) {
  const c = {};
  for (const u of units) {
    const d = UNITS[u.type];
    for (const t of d.traits) c[t] = (c[t] || 0) + (u.type === 'yiSS' && t === '수군' ? 2 : 1);
  }
  return c;
}
function activeBuffs(counts) {
  const b = { names: [] };
  const lv = (t) => { const s = TRAITS[t].steps; let l = 0; s.forEach((n, i) => { if ((counts[t] || 0) >= n) l = i + 1; }); return l; };
  b['관군'] = lv('관군'); b['장수'] = lv('장수'); b['수군'] = lv('수군'); b['의병'] = lv('의병'); b['명군'] = lv('명군');
  b.crisis = b['수군'] > 0 && b['의병'] > 0 && b['명군'] > 0;
  return b;
}

function starMul(star) { return star === 3 ? 3.2 : star === 2 ? 1.8 : 1; }

/* createBattle
   players: [{type, star, x, y}]   (y 3~5)
   enemies: [[type, x, y]]          (y 0~2)
   opts: { mult, atkMul, hpMul, surviveTicks, maxTicks } */
function createBattle(players, enemies, opts = {}) {
  const units = [];
  let id = 0;
  const counts = countTraits(players.filter(p => !UNITS[p.type].fixed));
  const buffs = activeBuffs(counts);
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
    const hp = Math.round(d.hp * hpM);
    units.push({ id: id++, side: 'p', type: p.type, star: p.star || 1, x: p.x, y: p.y, hp, maxHp: hp,
      atk: d.atk * atM, range: d.range, cd: d.cd, cdLeft: 0, move: d.move, fixed: !!d.fixed, splash: !!d.splash, alive: true });
  }
  const m = opts.mult || 1;
  for (const [type, x, y] of enemies) {
    const d = UNITS[type];
    const hp = Math.round(d.hp * m);
    units.push({ id: id++, side: 'e', type, star: 1, x, y, hp, maxHp: hp,
      atk: d.atk * m, range: d.range, cd: d.cd, cdLeft: 1, move: d.move, splash: !!d.splash, alive: true });
  }
  return { units, tick: 0, over: false, result: null, buffs, counts,
    surviveTicks: opts.surviveTicks || 0, maxTicks: opts.maxTicks || 160 };
}

function occupied(b, x, y) { return b.units.some(u => u.alive && u.x === x && u.y === y); }

function findTarget(b, u) {
  let best = null, bd = 1e9, be = 1e9;
  for (const o of b.units) {
    if (!o.alive || o.side === u.side) continue;
    const d = cheb(u, o), e = eucl(u, o);
    if (d < bd || (d === bd && (e < be || (e === be && o.hp < best.hp)))) { best = o; bd = d; be = e; }
  }
  return best;
}

// 한 틱 진행. 화면용 이벤트 배열을 돌려줌
function stepBattle(b) {
  if (b.over) return [];
  const ev = [];
  b.tick++;
  const order = b.units.filter(u => u.alive && !u.fixed);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const u of order) {
    if (!u.alive) continue;
    const t = findTarget(b, u);
    if (!t) break;
    if (cheb(u, t) <= u.range) {
      if (u.cdLeft > 0) { u.cdLeft--; continue; }
      u.cdLeft = u.cd - 1;
      const hits = [t];
      if (u.splash) for (const o of b.units) if (o.alive && o.side === t.side && o !== t && cheb(o, t) === 1) hits.push(o);
      ev.push({ k: 'atk', from: u.id, to: t.id, ranged: u.range > 1 });
      hits.forEach((h, i) => {
        const dmg = Math.max(1, Math.round(u.atk * (i === 0 ? 1 : 0.5) * (0.9 + Math.random() * 0.2)));
        h.hp -= dmg;
        ev.push({ k: 'dmg', id: h.id, dmg });
        if (h.hp <= 0) { h.alive = false; h.hp = 0; ev.push({ k: 'die', id: h.id }); }
      });
    } else {
      if (u.cdLeft > 0) u.cdLeft--;
      for (let s = 0; s < u.move; s++) {
        let best = null, bd = cheb(u, t), be = eucl(u, t);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const nx = u.x + dx, ny = u.y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || occupied(b, nx, ny)) continue;
          const p = { x: nx, y: ny }, d = cheb(p, t), e = eucl(p, t);
          if (d < bd || (d === bd && e < be - 0.01)) { best = p; bd = d; be = e; }
        }
        if (!best) break;
        u.x = best.x; u.y = best.y;
        ev.push({ k: 'move', id: u.id, x: u.x, y: u.y });
        if (cheb(u, t) <= u.range) break;
      }
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

if (typeof module !== 'undefined') module.exports = { createBattle, stepBattle, countTraits, activeBuffs, COLS, ROWS };
