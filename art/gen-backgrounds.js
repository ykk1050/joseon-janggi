// 조선 수호 장기 — 전투장 배경 도트 그림 생성기 (코드로 직접 만듦)
// 픽셀마다 팔레트 글자를 계산해 Pixelbolt 레시피(backgrounds.json)를 만든다.
// 실행: node art/gen-backgrounds.js → Pixelbolt로 render
const fs = require('fs');
const path = require('path');

const W = 168, H = 144;   // 정사각형 칸 판 7×6 (칸 하나 = 24×24 도트)

const palette = {
  // 바다
  a: '#123456', b: '#1b4a72', c: '#24608e', d: '#3478a8', w: '#7fb6d8', x: '#d8eef8',
  // 땅·풀
  g: '#557c3f', G: '#4b7138', h: '#5f8846', H: '#6b944e', k: '#2c4a26',
  // 마른 풀(북쪽 땅)
  y: '#a09058', Y: '#8e7f4c', z: '#b0a066',
  // 흙·모래·길
  s: '#d8c48e', S: '#b8a070', r: '#8a6a44', R: '#6a4e30',
  // 바위
  o: '#6e6a62', O: '#4e4a44', q: '#9a958a',
  // 눈
  n: '#eef3f6', N: '#cfdbe4', m: '#a9bccb',
  // 성벽 돌
  t: '#8c8478', T: '#6c655b', u: '#a8a092', U: '#4a443c',
  // 소나무
  p: '#2f5a34', P: '#1f4026', e: '#5a3a24',
  // 꽃·기와
  f: '#e8d36a', F: '#d06a5a', v: '#3a3a44',
};

// 결정적 잡음
function hash(x, y, s = 1) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise(x, y, sc, s = 1) {
  const X = Math.floor(x / sc), Y = Math.floor(y / sc), fx = x / sc - X, fy = y / sc - Y;
  const L = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
  return L(L(hash(X, Y, s), hash(X + 1, Y, s), fx), L(hash(X, Y + 1, s), hash(X + 1, Y + 1, s), fx), fy);
}
function makeGrid(fill) { return Array.from({ length: H }, () => Array(W).fill(fill)); }
function put(G, x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H && c !== '.') G[y][x] = c; }
function stamp(G, x, y, rows) { rows.forEach((r, j) => [...r].forEach((c, i) => put(G, x + i, y + j, c))); }
function ellipse(G, cx, cy, rx, ry, fn) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1) put(G, x, y, fn(x, y, d)); } }

const PINE = [
  '...P...',
  '..PpP..',
  '.PpppP.',
  '..PpP..',
  '.PpppP.',
  'PpppppP',
  '...e...',
  '...e...',
];
const PINE_SNOW = [
  '...n...',
  '..nPn..',
  '.PnppP.',
  '..PnP..',
  '.nppnP.',
  'PpnppnP',
  '...e...',
  '...e...',
];
const ROCK = ['.OOo.', 'OoqqO', 'Ooooo', '.OOO.'];
const REED = ['k.k', 'kGk', '.G.', '.G.'];
const WAVE = ['..ww..', '.w..w.', 'w....x'];

function sea(islands = true) {
  const G = makeGrid('c');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = y / H + (noise(x, y, 18, 3) - 0.5) * 0.25;
    G[y][x] = t < 0.18 ? 'a' : t < 0.42 ? 'b' : t < 0.78 ? 'c' : 'd';
    if (noise(x, y, 6, 5) > 0.82 && hash(x, y, 9) > 0.5) G[y][x] = G[y][x] === 'a' ? 'b' : G[y][x] === 'b' ? 'c' : 'd';
  }
  // 물결
  for (let j = 0; j < 46; j++) { const x = Math.floor(hash(j, 1, 11) * (W - 6)), y = Math.floor(hash(j, 2, 11) * (H - 3)); stamp(G, x, y, WAVE); }
  // 쓰시마 쪽 바위섬(왼쪽 위)과 조선 쪽 섬(오른쪽 아래)
  if (islands) {
    ellipse(G, 14, 10, 20, 12, (x, y, d) => (d > 0.8 ? 's' : noise(x, y, 4, 7) > 0.5 ? 'o' : 'O'));
    ellipse(G, 10, 6, 12, 7, (x, y) => (noise(x, y, 3, 8) > 0.45 ? 'g' : 'G'));
    stamp(G, 6, 0, PINE); stamp(G, 14, 1, PINE);
    ellipse(G, 160, 136, 20, 12, (x, y, d) => (d > 0.78 ? 's' : noise(x, y, 4, 9) > 0.5 ? 'h' : 'g'));
    stamp(G, 152, 124, PINE); stamp(G, 160, 126, PINE);
  }
  ellipse(G, 156, 8, 9, 5, (x, y, d) => (d > 0.7 ? 'x' : 'o'));
  for (const [x, y] of [[154, 5], [159, 7]]) put(G, x, y, 'q');
  return G;
}

function river(north) {
  const G = makeGrid('g');
  const mid = (x) => 60 + Math.round(4 * Math.sin(x / 23) + 2 * Math.sin(x / 9));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = mid(x), n = noise(x, y, 7, 2), n2 = hash(x, y, 4);
    if (y < m - 9) { // 북쪽 땅(여진)
      G[y][x] = n > 0.62 ? 'z' : n > 0.35 ? 'y' : 'Y';
      if (north && noise(x, y, 10, 6) > 0.72) G[y][x] = n2 > 0.3 ? 'n' : 'N';
    } else if (y < m - 6) G[y][x] = n2 > 0.4 ? 's' : 'S';
    else if (y <= m + 6) { // 강
      G[y][x] = Math.abs(y - m) > 4 ? 'd' : 'c';
      if (hash(x, y, 13) > 0.94) G[y][x] = 'w';
    } else if (y < m + 9) G[y][x] = n2 > 0.4 ? 's' : 'S';
    else { // 조선 땅
      G[y][x] = n > 0.66 ? 'H' : n > 0.4 ? 'h' : n > 0.2 ? 'g' : 'G';
      if (hash(x, y, 21) > 0.992) G[y][x] = hash(x, y, 22) > 0.5 ? 'f' : 'F';
    }
  }
  for (let j = 0; j < 16; j++) { const x = Math.floor(hash(j, 3, 31) * (W - 3)); stamp(G, x, mid(x) + 6 + (j % 2), REED); }
  for (let j = 0; j < 10; j++) { const x = Math.floor(hash(j, 4, 31) * (W - 5)); stamp(G, x, mid(x) - 12, ['.R.', 'RrR']); }
  // 가장자리 소나무와 바위
  for (const [x, y] of [[2, 112], [10, 120], [154, 114], [160, 122], [4, 132], [146, 132]]) stamp(G, x, y, PINE);
  for (const [x, y] of [[20, 10], [140, 20], [90, 6], [56, 30]]) stamp(G, x, y, north ? PINE_SNOW : ROCK);
  return G;
}

function field() {
  const G = makeGrid('g');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x, y, 8, 12);
    G[y][x] = n > 0.68 ? 'H' : n > 0.44 ? 'h' : n > 0.22 ? 'g' : 'G';
  }
  // 논(오른쪽 위, 왼쪽 아래)
  const paddy = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(G, x, y, (y - y0) % 7 === 0 || (x - x0) % 13 === 0 ? 'r' : ((x + y) % 5 === 0 ? 'G' : 'd')); };
  paddy(130, 4, 36, 22); paddy(2, 120, 32, 22);
  // 흙길
  for (let y = 0; y < H; y++) { const cx = Math.round(W * 0.42 + Math.sin(y / 17) * 14 + (y - 72) * 0.25); for (let dx = -4; dx <= 4; dx++) put(G, cx + dx, y, Math.abs(dx) === 4 ? 'S' : hash(cx + dx, y, 41) > 0.85 ? 'R' : 'r'); }
  for (let j = 0; j < 8; j++) stamp(G, Math.floor(hash(j, 5, 51) * (W - 5)), Math.floor(hash(j, 6, 51) * (H - 4)), ROCK);
  for (const [x, y] of [[4, 4], [12, 8], [152, 110], [160, 116], [84, 2], [114, 132]]) stamp(G, x, y, PINE);
  for (let j = 0; j < 60; j++) { const x = Math.floor(hash(j, 7, 61) * W), y = Math.floor(hash(j, 8, 61) * H); if (G[y][x] !== 'r') put(G, x, y, hash(j, 9, 61) > 0.5 ? 'f' : 'F'); }
  return G;
}

function snowFort() {
  const G = makeGrid('n');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x, y, 9, 71);
    G[y][x] = n > 0.7 ? 'N' : n < 0.18 ? 'm' : 'n';
    if (hash(x, y, 72) > 0.985) G[y][x] = 'm';
  }
  // 청군이 오는 북쪽 소나무 숲
  for (let j = 0; j < 12; j++) stamp(G, Math.floor(hash(j, 1, 81) * (W - 7)), Math.floor(hash(j, 2, 81) * 26), PINE_SNOW);
  // 발자국 길
  for (let y = 30; y < 112; y++) { const cx = Math.round(84 + Math.sin(y / 13) * 10); put(G, cx - 1, y, 'm'); put(G, cx + 2, y, 'N'); }
  // 남한산성 성벽(아래쪽)
  const top = 122;   // 성벽 = 맨 아래 줄(120~144)
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor((y - top) / 5), off = row % 2 ? 6 : 0;
    const mortar = (y - top) % 5 === 4 || (x + off) % 12 === 11;
    G[y][x] = mortar ? 'T' : hash(Math.floor((x + off) / 12), row, 91) > 0.5 ? 't' : 'u';
    if (!mortar && hash(x, y, 92) > 0.97) G[y][x] = 'U';
  }
  // 여장(성가퀴)과 쌓인 눈
  for (let x = 0; x < W; x++) {
    const merlon = Math.floor(x / 8) % 2 === 0;
    for (let y = top - 6; y < top; y++) if (merlon) put(G, x, y, (x % 8 === 0 || x % 8 === 7) ? 'U' : (y === top - 6 ? 'n' : 't'));
    put(G, x, top, 'n'); if (hash(x, 1, 93) > 0.5) put(G, x, top + 1, 'N');
    if (merlon) put(G, x, top - 7, hash(x, 2, 94) > 0.3 ? 'n' : '.');
  }
  // 성문 지붕(기와)
  const gx = 72;    // 성문 = 가운데 칸(3열, 72~96)
  for (let y = top - 14; y < top - 4; y++) for (let x = gx - (y - top + 14); x < gx + 24 + (y - top + 14); x++) put(G, x, y, (y - top) % 2 ? 'v' : 'U');
  for (let x = gx - 10; x < gx + 34; x++) put(G, x, top - 15, 'n');
  for (let y = top - 4; y < top + 18; y++) for (let x = gx + 4; x < gx + 20; x++) put(G, x, y, y > top + 2 && x > gx + 6 && x < gx + 18 ? 'U' : 'R');
  return G;
}

// 1-1 상륙전: 위쪽은 쓰시마섬(땅), 아래쪽은 바다. 섬 가운데가 바다 쪽으로 튀어나온 모래사장(상륙 자리)
// 해안선은 data.js 1-1의 land 칸(0~1행 전부 + 2행 2~4열)과 맞춤
function landing() {
  const G = sea(false);
  // 해안선 = 땅 칸 경계: 0~1행(y<48) 전부 + 2행의 2~4열(x 48~120, y<72). 모서리는 둥글게
  const bump = (x) => Math.max(0, Math.min(1, (x - 44) / 8), 0) * Math.max(0, Math.min(1, (124 - x) / 8));
  const coast = (x) => 49 + 24 * bump(x) + Math.round(Math.sin(x / 7) * 1.2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = coast(x);
    if (y > c + 3) continue;
    if (y > c - 1) { G[y][x] = hash(x, y, 101) > 0.5 ? 'w' : 'x'; continue; }      // 파도 거품
    if (y > c - 6) { G[y][x] = hash(x, y, 102) > 0.35 ? 's' : 'S'; continue; }     // 모래사장
    const n = noise(x, y, 7, 103);
    G[y][x] = n > 0.66 ? 'H' : n > 0.4 ? 'h' : n > 0.2 ? 'g' : 'G';
  }
  // 섬의 숲(매복 자리: 왼쪽 위·오른쪽 위)과 바위
  for (const [x, y] of [[2, 2], [10, 4], [5, 12], [146, 2], [154, 6], [160, 12]]) stamp(G, x, y, PINE);
  for (const [x, y] of [[36, 30], [122, 30], [64, 4]]) stamp(G, x, y, ROCK);
  // 왜구 마을의 초가집
  const HUT = ['..RRRR..', '.RyyyyR.', 'RyyyyyyR', '.rrrrrr.', '.rRrrRr.', '.rrrrrr.'];
  for (const [x, y] of [[56, 16], [100, 12], [80, 56]]) stamp(G, x, y, HUT);
  return G;
}

const scenes = { sea: sea(false), landing: landing(), river: river(false), riverN: river(true), field: field(), snow: snowFort() };
const frames = Object.entries(scenes).map(([name, G]) => ({ name, duration: 1000, ops: [{ op: 'grid', x: 0, y: 0, rows: G.map(r => r.join('')) }] }));
const recipe = { version: 1, name: 'backgrounds', width: W, height: H, palette, frames };
fs.writeFileSync(path.join(__dirname, 'backgrounds.json'), JSON.stringify(recipe));
console.log('scenes', Object.keys(scenes).join(','));
