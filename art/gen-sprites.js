// 조선 수호 장기 — 도트 캐릭터 레시피 생성기 (코드로 직접 만듦)
// 몸·모자·무기 조각을 조합해 Pixelbolt 레시피(units.json)를 만든다.
// 실행: node art/gen-sprites.js  →  Pixelbolt로 render
const fs = require('fs');
const path = require('path');

const W = 28, H = 26;

// 기본 팔레트 (유닛마다 frame palette로 일부 키를 바꿔 칠함)
const palette = {
  o: '#2a1d16', s: '#f2c28f', S: '#d4996a',
  h: '#2b2b33', H: '#4a4a58', d: '#1d1d24',            // 모자
  b: '#3a63a8', B: '#5c86c9', n: '#26467e',             // 옷
  p: '#4a3a2e', f: '#2e221a',                           // 바지·신발
  w: '#e3e8ee', W: '#8f9aa8', t: '#9a6532', T: '#5e3a1a', // 쇠·나무
  r: '#cf3b2c', R: '#8e2219', y: '#f0c03a', Y: '#b8861c', // 빨강·금
  c: '#f5f0e2', C: '#c9c1ad', K: '#1a1412',             // 흰 천·머리카락
  F: '#b88a5a', G: '#7a5634',                           // 털
  M: '#8a5a36', N: '#5e3b22', m: '#c08a5c',             // 말
  g: '#3f6b3a', q: '#5f8f4f',                           // 초록(거북선)
  x: '#ffffff', z: '#ff9a1f',                           // 번쩍임
  a: '#9aa0a6', A: '#6e737a', l: '#7f8890',             // 돌
};

// ── 몸 (14×17), 머리 r0~7, 몸 r8~12, 다리 r13~16
const BODY = [
  '....oooooo....',
  '...osssssso...',
  '..osssssssso..',
  '..osssssssso..',
  '..ossosssoso..',
  '..osssssssso..',
  '...oSssssSo...',
  '....oooooo....',
  '...obbbbbbo...',
  '..obBbbbbnbo..',
  '.osbBbbbbnbso.',
  '..obbbbbbnbo..',
  '..onnnyynnno..',
  '...oppppppo...',
  '...oppo.oppo..',
  '...offo.offo..',
  '...oooo.oooo..',
];
// 갑옷 몸 (장수): 비늘 무늬
const BODY_ARMOR = BODY.map((r, i) => (i === 9 ? '..oyBbybbnyo..' : i === 11 ? '..obybbybnbo..' : r));
// 긴 옷(의병장·선비풍)
const BODY_ROBE = BODY.map((r, i) => (i === 13 ? '...obbbbbbo...' : i === 14 ? '..obbbbbbbbo..' : i === 15 ? '..onnnnnnnno..' : i === 16 ? '..oooooooooo..' : r));

// ── 모자 (14칸 폭, [시작 행 오프셋, 줄들])
const HATS = {
  jeonrip: [-3, [ // 조선 군사 전립
    '......rr......',
    '.....oddo.....',
    '....oddddo....',
    '.oddddddddddo.',
    '..oooooooooo..',
  ]],
  helmet: [-4, [ // 장수 투구
    '......rr......',
    '......rr......',
    '.....oyyo.....',
    '....oyHHyo....',
    '...oWwwwwWo...',
    '..oWwwwwwwWo..',
    '..oW......Wo..',
  ]],
  topknot: [-2, [ // 의병 상투 + 흰 띠
    '......oo......',
    '.....oKKo.....',
    '...oKKKKKKo...',
    '..occcccccco..',
  ]],
  topknotRed: [-2, [
    '......oo......',
    '.....oKKo.....',
    '...oKKKKKKo...',
    '..orrrrrrrro..',
  ]],
  bandana: [0, [ // 왜구 머리띠
    '...oKKKKKKo...',
    '..oKKKKKKKKo..',
    '..orrrrrrrro..',
    '...........rr.',
  ]],
  jingasa: [-2, [ // 조총병 삿갓
    '......oo......',
    '....oddddo....',
    '..oddddddddo..',
    '.odddddddddddo',
  ]],
  kabuto: [-2, [ // 일본군 투구
    '....oooooo....',
    '...oddddddo...',
    '..oddddddddo..',
    '.odd......ddo.',
  ]],
  kabutoGen: [-4, [ // 일본 장수 투구(뿔 장식)
    '..yy......yy..',
    '...yy....yy...',
    '....yoooooy...',
    '...oddddddo...',
    '..oddddddddo..',
    '.odd......ddo.',
  ]],
  fur: [-2, [ // 여진 털모자
    '....oFFFFo....',
    '...oFGFFGFo...',
    '..oFFFFFFFFo..',
    '..oGGGGGGGGo..',
  ]],
  furChief: [-4, [
    '......rr......',
    '.....oyyo.....',
    '....oFFFFo....',
    '...oFGFFGFo...',
    '..oFFFFFFFFo..',
    '..oGGGGGGGGo..',
  ]],
  qing: [-3, [ // 청 모자(붉은 술)
    '......rr......',
    '.....rrrr.....',
    '....orrrro....',
    '...oddddddo...',
    '..oyyyyyyyyo..',
  ]],
  qingGen: [-5, [
    '.......y......',
    '......rr......',
    '.....rrrr.....',
    '....orrrro....',
    '...oyyyyyyo...',
    '..oyddddddyo..',
  ]],
  ming: [-4, [ // 명군 투구(붉은 술, 금빛)
    '......rr......',
    '.....rrrr.....',
    '.....oyyo.....',
    '....oyyyyo....',
    '...oYyyyyYo...',
    '..oY......Yo..',
  ]],
};

// ── 무기: [쉴 때, 공격할 때] 각각 {x,y,rows} (몸 기준 좌표)
const WEAPONS = {
  spear: [
    { x: 12, y: -6, rows: ['w', 'w', 'W', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 't', 'T', 'T', 'T'] },
    { x: 9, y: 2, rows: [
      '.....ww',
      '....ww.',
      '...tW..',
      '..tt...',
      '.tt....',
      'tt.....',
      't......',
    ] },
  ],
  bow: [
    { x: -2, y: 6, rows: ['.o', 'ot', 't.', 't.', 't.', 't.', 'ot', '.o'] },
    { x: -3, y: 5, rows: ['..o.', '.ot.', 'ot..', 'tw..', 'twww', 'tw..', 'ot..', '.ot.', '..o.'] },
  ],
  sword: [
    { x: 12, y: 3, rows: ['.w', '.w', '.w', 'Ww', 'yy', '.T'] },
    { x: 11, y: 2, rows: ['...w', '..w.', '.w..', 'yy..', 'T...'] },
  ],
  bigsword: [
    { x: 12, y: 0, rows: ['.w', 'ww', 'ww', 'ww', 'ww', 'Ww', 'yy', 'yy', '.T'] },
    { x: 10, y: 1, rows: ['.....w', '....ww', '...ww.', '..ww..', '.yy...', 'yy....', 'T.....'] },
  ],
  gun: [
    { x: 9, y: 4, rows: ['....W', '...W.', '..T..', '.T...', 'TT...'] },
    { x: 8, y: 5, rows: ['.....zx', '..WWWWz', 'TTTT...', 'T......'] },
  ],
  club: [
    { x: 12, y: 5, rows: ['t', 't', 't', 'T'] },
    { x: 11, y: 3, rows: ['..t', '.t.', 't..', 'T..'] },
  ],
  sickle: [
    { x: 12, y: 4, rows: ['ww', '.w', '.t', '.t', '.T'] },
    { x: 11, y: 3, rows: ['ww..', '..w.', '..t.', '.t..', 'T...'] },
  ],
  flag: [
    { x: 11, y: -6, rows: ['.yrrr', '.trrr', '.trr.', '.t...', '.t...', '.t...', '.t...', '.t...', '.t...', '.t...', '.T...'] },
    { x: 11, y: -7, rows: ['.yrrrr', '.trrrr', '.trrr.', '.t....', '.t....', '.t....', '.t....', '.t....', '.t....', '.t....', '.T....'] },
  ],
};

// ── 말 (20×10), 오른쪽을 봄
const HORSE = [
  '..............oo....',
  '.............oMMo...',
  '..ooooooooooooMMMo..',
  '.oMMMMMMMMMMMMMmMMo.',
  'oMMMMMMMMMMMMMMoMMMo',
  'oNoMMMMMMMMMMMMo.oo.',
  '.o.oNMMMMMMMMNo.....',
  '...oNo.oNo.oNo.oNo..',
  '...oNo.oNo.oNo.oNo..',
  '...ooo.ooo.ooo.ooo..',
];
const HORSE_RUN = [
  '..............oo....',
  '.............oMMo...',
  '..ooooooooooooMMMo..',
  '.oMMMMMMMMMMMMMmMMo.',
  'oMMMMMMMMMMMMMMoMMMo',
  'oNoMMMMMMMMMMMMo.oo.',
  '.o.oNMMMMMMMMNo.....',
  '..oNo..oNo.oNo..oNo.',
  '.oNo....oNooNo...oNo',
  '.oo......ooooo....oo',
];

// ── 배 (28 폭)
const SHIPS = {
  panok: [ // 판옥선: 이층 누각
    '.............rr.............',
    '.............tt.............',
    '.......oooooottoooooo.......',
    '.......orrrrrrrrrrrro.......',
    '.......otTtTtTtTtTtTo.......',
    '.....oooooooooooooooooo.....',
    '.....orrrrrrrrrrrrrrrro.....',
    '..ooottttttttttttttttttooo..',
    '.otttTttTttTttTttTttTttttto.',
    '.oTtwtTtwtTtwtTtwtTtwtTtTo..',
    '..oTTTTTTTTTTTTTTTTTTTTTo...',
    '...ooooooooooooooooooooo....',
  ],
  ship: [ // 병선: 작은 배와 돛
    '..............o.............',
    '.............oco............',
    '............occco...........',
    '...........occccco..........',
    '..........occccccco.........',
    '..............t.............',
    '....oooooooooooooooooooo....',
    '...otttttttttttttttttttto...',
    '...oTtTtTtTtTtTtTtTtTtTto...',
    '....oTTTTTTTTTTTTTTTTTTo....',
    '.....oooooooooooooooooo.....',
  ],
  turtle: [ // 거북선: 등딱지 지붕, 용머리
    '............................',
    '..........w..w..w..w........',
    '.......ooooooooooooooo......',
    '......ogqgqgqgqgqgqgqgo.oo..',
    '.....ogqgqgqgqgqgqgqgqgorro.',
    '....ooooooooooooooooooooyro.',
    '....orrrrrrrrrrrrrrrrrrrooo.',
    '..ooottttttttttttttttttooo..',
    '.otttwtttwtttwtttwtttwttto..',
    '.oTtTtTtTtTtTtTtTtTtTtTto...',
    '..oTTTTTTTTTTTTTTTTTTTTo....',
    '...oooooooooooooooooooo.....',
  ],
  jpShip: [ // 일본 배: 흰 돛에 검은 무늬
    '.............o..............',
    '..........ooocooo...........',
    '..........occccco...........',
    '..........occKcco...........',
    '..........occccco...........',
    '..........ooocooo...........',
    '.............t..............',
    '....oooooooooooooooooooo....',
    '...oKKKKKKKKKKKKKKKKKKKKo...',
    '...oKdKdKdKdKdKdKdKdKdKKo...',
    '....oKKKKKKKKKKKKKKKKKKo....',
    '.....oooooooooooooooooo.....',
  ],
};

// ── 기계 (신기전 화차, 명 대포), 성
const MACHINES = {
  rocket: [
    '..w.w.w.w.w.......',
    '..t.t.t.t.t.......',
    '.ooooooooooooo....',
    '.oTtTtTtTtTtTo....',
    '.oTtTtTtTtTtTo....',
    '.ooooooooooooo....',
    '...ott.....ott.tt.',
    '..oTTTo...oTTTo.tT',
    '..oTyTo...oTyTo...',
    '...ooo.....ooo....',
  ],
  mingGun: [
    '.........rrr......',
    '.........rr.......',
    '.........t........',
    '.oooooooooooo.....',
    'oYyyyyyyyyyyyo....',
    'oYyYyyyyyyyyyyoo..',
    '.oooooooooooo.....',
    '....ott..ott......',
    '...oTTTooTTTo.....',
    '...oTyTooTyTo.....',
    '....ooo..ooo......',
  ],
};
const CASTLE = [
  '..........oooooooo..........',
  '........ooRRRRRRRRoo........',
  '......ooRRRRRRRRRRRRoo......',
  '....ooKKKKKKKKKKKKKKKKoo....',
  '.......orrrrrrrrrrrro.......',
  '.......orcrcrcrcrcrro.......',
  '..oo.oo.oo.oo.oo.oo.oo.oo...',
  '..oaaoaaoaaoaaoaaoaaoaaao...',
  '..oaaaaaaaaaaaaaaaaaaaaao...',
  '..oalaaalaaaoooaalaaalaao...',
  '..oaaaaaaaaoKKKoaaaaaaaao...',
  '..oaaalaaaoKKKKKoaaalaaao...',
  '..oaaaaaaaoKKKKKoaaaaaaao...',
  '..oAAAAAAAoKKKKKoAAAAAAAo...',
  '..ooooooooooooooooooooooo...',
];

// ── 유닛 정의
// kind: foot | rider | ship | machine | castle
const U = {
  // 조선
  spear:   { kind: 'foot', hat: 'jeonrip', weapon: 'spear', pal: {} },
  archer:  { kind: 'foot', hat: 'jeonrip', weapon: 'bow', pal: { b: '#3d7a4a', B: '#5ea06a', n: '#285634' } },
  cavalry: { kind: 'rider', hat: 'jeonrip', weapon: 'spear', pal: { b: '#7a3a8a', B: '#9c5aae', n: '#552660' } },
  gunner:  { kind: 'foot', hat: 'jeonrip', weapon: 'gun', pal: { b: '#6a5a3a', B: '#8a7a55', n: '#4a3e26' } },
  leeJM:   { kind: 'foot', hat: 'helmet', weapon: 'bigsword', body: 'armor', pal: { b: '#b8322a', B: '#d85a48', n: '#7e1e18' } },
  choiYD:  { kind: 'foot', hat: 'helmet', weapon: 'bow', body: 'armor', pal: { b: '#2f6aa8', B: '#4f8ac8', n: '#1f4a7e', r: '#3fa0e0' } },
  kimJS:   { kind: 'rider', hat: 'helmet', weapon: 'sword', body: 'armor', pal: { b: '#2f7a4f', B: '#4f9a6a', n: '#1f5634', r: '#f0c03a' } },
  yiSS:    { kind: 'foot', hat: 'helmet', weapon: 'flag', body: 'armor', pal: { b: '#b8322a', B: '#e06a50', n: '#7e1e18', h: '#1a1a22' } },
  militia: { kind: 'foot', hat: 'topknot', weapon: 'sickle', pal: { b: '#e8e2d0', B: '#ffffff', n: '#b8b09a', y: '#8a7a5a' } },
  milLead: { kind: 'foot', hat: 'topknotRed', weapon: 'sword', body: 'robe', pal: { b: '#e8e2d0', B: '#ffffff', n: '#b8b09a' } },
  ming:    { kind: 'foot', hat: 'ming', weapon: 'spear', body: 'armor', pal: { b: '#c03a2a', B: '#e05a40', n: '#8a2218' } },
  ship:    { kind: 'ship', ship: 'ship' },
  panok:   { kind: 'ship', ship: 'panok' },
  turtle:  { kind: 'ship', ship: 'turtle' },
  rocket:  { kind: 'machine', m: 'rocket' },
  mingGun: { kind: 'machine', m: 'mingGun' },
  castle:  { kind: 'castle' },
  // 적
  wokou:   { kind: 'foot', hat: 'bandana', weapon: 'sword', enemy: true, pal: { b: '#6a5a4a', B: '#8a7a68', n: '#4a3e32', p: '#5a4a3a' } },
  wokouA:  { kind: 'foot', hat: 'bandana', weapon: 'bow', enemy: true, pal: { b: '#5a6a5a', B: '#7a8a78', n: '#3e4a3e', r: '#e0a030' } },
  wokouB:  { kind: 'foot', hat: 'bandana', weapon: 'bigsword', enemy: true, body: 'armor', pal: { b: '#4a2a2a', B: '#6a4040', n: '#2e1818' } },
  jur:     { kind: 'rider', hat: 'fur', weapon: 'sword', enemy: true, pal: { b: '#7a5a3a', B: '#9a7a58', n: '#553c24', M: '#4a3a30', N: '#2e241e', m: '#6a5a4a' } },
  jurA:    { kind: 'rider', hat: 'fur', weapon: 'bow', enemy: true, pal: { b: '#5a6a7a', B: '#7a8a9a', n: '#3e4a56', M: '#9a8a7a', N: '#6a5a4a', m: '#b8a898' } },
  jurC:    { kind: 'foot', hat: 'furChief', weapon: 'bigsword', enemy: true, body: 'armor', pal: { b: '#7a3a2a', B: '#9a5a48', n: '#552418' } },
  gun:     { kind: 'foot', hat: 'jingasa', weapon: 'gun', enemy: true, pal: { b: '#3a3a4a', B: '#5a5a6a', n: '#26262e', d: '#3a2a1e' } },
  samurai: { kind: 'foot', hat: 'kabuto', weapon: 'spear', enemy: true, body: 'armor', pal: { b: '#2a2a3a', B: '#4a4a5a', n: '#1a1a24', y: '#b02a24' } },
  jpGen:   { kind: 'foot', hat: 'kabutoGen', weapon: 'bigsword', enemy: true, body: 'armor', pal: { b: '#8a1a1a', B: '#b03030', n: '#5a1010' } },
  jpShip:  { kind: 'ship', ship: 'jpShip', enemy: true },
  qing:    { kind: 'rider', hat: 'qing', weapon: 'sword', enemy: true, pal: { b: '#3a5aa8', B: '#5a7ac8', n: '#263e7e', y: '#f0c03a', M: '#3a2e28', N: '#1e1814', m: '#5a4a40' } },
  qingA:   { kind: 'rider', hat: 'qing', weapon: 'bow', enemy: true, pal: { b: '#c8a030', B: '#e8c050', n: '#8a6a18', M: '#c8c0b0', N: '#8a8278', m: '#e8e0d0' } },
  qingG:   { kind: 'rider', hat: 'qingGen', weapon: 'bigsword', enemy: true, body: 'armor', pal: { b: '#d8b030', B: '#f0d060', n: '#9a7a18' } },
};

function grid(x, y, rows, flipX) { return { op: 'grid', x, y, rows, ...(flipX ? { flipX: true } : {}) }; }
function bodyRows(u) { return u.body === 'armor' ? BODY_ARMOR : u.body === 'robe' ? BODY_ROBE : BODY; }

// 사람 하나 그리기 (bx, by = 몸 왼쪽 위)
function personOps(u, bx, by, attack, upperOnly) {
  const ops = [];
  let rows = bodyRows(u);
  if (upperOnly) rows = rows.slice(0, 13);
  const wpn = u.weapon ? WEAPONS[u.weapon][attack ? 1 : 0] : null;
  const behind = u.weapon === 'bow';
  if (wpn && behind) ops.push(grid(bx + wpn.x, by + wpn.y, wpn.rows));
  ops.push(grid(bx, by, rows));
  const [hy, hrows] = HATS[u.hat];
  ops.push(grid(bx, by + hy, hrows));
  if (wpn && !behind) ops.push(grid(bx + wpn.x, by + wpn.y, wpn.rows));
  return ops;
}

function framesFor(id, u) {
  const out = [];
  const pal = u.pal || {};
  const flip = !!u.enemy;
  const mk = (name, ops, extra = {}) => out.push({ name: `${id}-${name}`, duration: 200, ...(Object.keys(pal).length ? { palette: pal } : {}), ops, ...extra });
  if (u.kind === 'foot') {
    const bx = 7, by = 8;
    mk('i0', personOps(u, bx, by, false));
    // 숨쉬기: 다리는 그대로, 윗몸만 1픽셀 아래로
    mk('i1', [grid(bx, by + 13, bodyRows(u).slice(13)), ...personOps(u, bx, by + 1, false, true)]);
    mk('a', personOps(u, bx + 1, by - 1, true));
  } else if (u.kind === 'rider') {
    const hx = 4, hy = 15;
    const ride = (atk, run) => [grid(hx, hy, run ? HORSE_RUN : HORSE), ...personOps(u, hx + 2, hy - 12 + (run ? 1 : 0), atk, true)];
    mk('i0', ride(false, false));
    mk('i1', ride(false, true));
    mk('a', ride(true, true));
  } else if (u.kind === 'ship') {
    const rows = SHIPS[u.ship];
    const sy = H - rows.length - 3;
    mk('i0', [grid(0, sy, rows)]);
    mk('i1', [grid(0, sy + 1, rows)]);
    mk('a', [grid(0, sy, rows), grid(u.enemy ? 0 : 24, sy + 4, ['zx', 'xz'])]);
  } else if (u.kind === 'machine') {
    const rows = MACHINES[u.m];
    const sx = 5, sy = H - rows.length - 2;
    mk('i0', [grid(sx, sy, rows)]);
    mk('i1', [grid(sx, sy, rows)]);
    mk('a', [grid(sx, sy, rows), grid(sx + (u.m === 'rocket' ? 0 : 14), sy - 3, u.m === 'rocket' ? ['..z.z.z.z.z', '..x.x.x.x.x'] : ['zxz', 'xzx'])]);
  } else if (u.kind === 'castle') {
    const sy = H - CASTLE.length - 1;
    mk('i0', [grid(0, sy, CASTLE)]);
    mk('i1', [grid(0, sy, CASTLE)]);
    mk('a', [grid(0, sy, CASTLE)]);
  }
  // 적은 게임에서 CSS로 좌우를 뒤집는다
  return out;
}

const frames = [];
const animations = {};
for (const [id, u] of Object.entries(U)) {
  const fr = framesFor(id, u);
  frames.push(...fr);
  animations[`${id}-idle`] = { frames: [`${id}-i0`, `${id}-i1`] };
  animations[`${id}-atk`] = { frames: [`${id}-a`], loop: false };
}

const recipe = { version: 1, name: 'units', width: W, height: H, palette, frames, animations };
fs.writeFileSync(path.join(__dirname, 'units.json'), JSON.stringify(recipe, null, 1));
console.log('frames', frames.length, 'units', Object.keys(U).length);
