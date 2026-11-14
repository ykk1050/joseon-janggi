// 조선 수호 장기 — 지형 칸 도트 그림 생성기 (코드로 직접 만듦)
// 숲·강·논·바위·깃발 자리·고을/진·성벽을 Pixelbolt 레시피(tiles.json)로 만든다.
// 실행: node art/gen-tiles.js → Pixelbolt로 render → img/tiles/*.png
const fs = require('fs');
const path = require('path');

const W = 28, H = 26;
const palette = {
  o: '#22180f',
  p: '#2f6a3a', P: '#1d4628', q: '#4f8a4a', e: '#5a3a22',
  b: '#2c6fb0', c: '#5aa0d8', w: '#cfe8f6', x: '#ffffff',
  g: '#5f9a3e', G: '#3f6e2a', y: '#e6c75a', m: '#6e5a3a', M: '#8a7450',
  r: '#7a746a', R: '#545048', s: '#a8a296', S: '#c8c2b4',
  f: '#cf3b2c', F: '#8e2219', t: '#9a6532', T: '#5e3a1a', Y: '#f0c03a', k: '#2a2a32', K: '#46465a',
  a: '#8c8478', A: '#6c655b', u: '#a8a092', U: '#3e3830', n: '#eef3f6',
};

function blank() { return Array.from({ length: H }, () => Array(W).fill('.')); }
function put(G, x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H && c !== '.') G[y][x] = c; }
function stamp(G, x, y, rows) { rows.forEach((r, j) => [...r].forEach((c, i) => put(G, x + i, y + j, c))); }

const PINE_S = ['..o..', '.oPo.', '.opPo', 'oPppo', 'opPpPo', 'ooooo.', '..e..'];
const PINE_L = [
  '....o....',
  '...oPo...',
  '..oPqPo..',
  '...oPo...',
  '..oPpPo..',
  '.oPpqpPo.',
  '..oPpPo..',
  '.oPppppo.',
  'oPpqppqPo',
  'ooooooooo',
  '....e....',
  '....e....',
];

function forest() {
  const G = blank();
  stamp(G, 2, 9, PINE_L); stamp(G, 15, 7, PINE_L); stamp(G, 9, 13, PINE_L);
  stamp(G, 22, 16, PINE_S);
  return G;
}
function river() {
  const G = blank();
  const wave = ['.ww..', 'w..wc', '....c'];
  for (const [x, y] of [[3, 6], [14, 4], [21, 9], [6, 14], [16, 15], [10, 20], [22, 20]]) stamp(G, x, y, wave);
  for (const [x, y] of [[9, 9], [20, 4], [2, 19], [25, 14]]) put(G, x, y, 'x');
  return G;
}
function paddy() {
  const G = blank();
  for (let y = 5; y < 23; y += 4) for (let x = 3; x < 26; x += 4) {
    stamp(G, x, y, ['y.y', 'gGg', '.G.']);
  }
  for (let x = 2; x < 27; x++) { put(G, x, 24, 'm'); }
  for (let y = 4; y < 25; y++) { put(G, 1, y, 'm'); put(G, 26, y, 'm'); }
  return G;
}
function rock() {
  const G = blank();
  stamp(G, 4, 9, [
    '....ooooo.....',
    '...oSSsssoo...',
    '..oSsssssrro..',
    '.oSssssrrrrro.',
    '.osssrrrrrRro.',
    'osssrrrrrRRRRo',
    'orrrrrRRRRRRRo',
    '.ooooooooooooo',
  ]);
  stamp(G, 16, 14, ['...ooo...', '.oSsso..', 'oSssrRo.', 'osrrRRRo', '.oooooo.']);
  stamp(G, 2, 19, ['.oo.', 'oSro', '.oo.']);
  return G;
}
function site() {
  const G = blank();
  stamp(G, 10, 2, [
    'Y.......',
    'tffffff.',
    'tfffffff',
    'tffFfff.',
    'tfffffff',
    'tfffff..',
    't.......',
    't.......',
    't.......',
    't.......',
    't.......',
    't.......',
    't.......',
    't.......',
    't.......',
    'T.......',
  ]);
  stamp(G, 4, 18, ['..ooo.......ooo..', '.oSsso.....oSsso.', 'oSsrrRo...oSsrrRo', '.ooooo.....ooooo.']);
  return G;
}
function fort() {
  const G = blank();
  // 지붕
  stamp(G, 6, 3, [
    '.......Y........',
    '....oooooooo....',
    '..okkKkKkKkKko..',
    '.okKkKkKkKkKkKo.',
    'oooooooooooooooo',
  ]);
  // 누각 기둥과 문
  stamp(G, 8, 8, [
    'oFoffffffffoFo',
    'oFoffffffffoFo',
    'oFoTTTTTTTToFo',
    'oFoT......ToFo',
  ]);
  // 나무 울타리
  for (let x = 1; x < 27; x += 3) stamp(G, x, 12, ['oto', 'oto', 'oto', 'oto', 'oto', 'oto', 'oTo', 'ooo'].map((r, i) => (i === 0 ? '.o.' : r)));
  for (let x = 1; x < 27; x++) { put(G, x, 14, 'T'); put(G, x, 17, 'T'); }
  // 깃발
  stamp(G, 24, 0, ['Y..', 'tbb', 'tbc', 'tb.', 't..', 't..', 't..', 'T..']);
  return G;
}
function wall() {
  const G = blank();
  const top = 9;
  for (let y = top; y < 25; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor((y - top) / 4), off = row % 2 ? 4 : 0;
    const mortar = (y - top) % 4 === 3 || (x + off) % 8 === 7;
    G[y][x] = mortar ? 'A' : ((Math.floor((x + off) / 8) + row) % 3 === 0 ? 'u' : 'a');
  }
  for (let x = 0; x < W; x++) { put(G, x, 25, 'U'); put(G, x, top, 'u'); }
  // 여장(성가퀴)
  for (let m = 0; m < 4; m++) stamp(G, m * 7 + 1, top - 5, ['ooooo', 'ouuao', 'oaaao', 'oaUao', 'oaaao']);
  // 이끼 몇 점
  for (const [x, y] of [[3, 20], [17, 13], [24, 22], [10, 24]]) put(G, x, y, 'G');
  return G;
}

const tiles = { forest: forest(), river: river(), paddy: paddy(), rock: rock(), site: site(), fort: fort(), wall: wall() };
const frames = Object.entries(tiles).map(([name, G]) => ({ name, duration: 1000, ops: [{ op: 'grid', x: 0, y: 0, rows: G.map(r => r.join('')) }] }));
fs.writeFileSync(path.join(__dirname, 'tiles.json'), JSON.stringify({ version: 1, name: 'tiles', width: W, height: H, palette, frames }));
console.log('tiles', Object.keys(tiles).join(','));
