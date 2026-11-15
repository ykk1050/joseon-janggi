// 조선 수호 장기 배경 음악 만들기 (코드로 직접 만듦, 외부 소리 없음)
// 국악 느낌: 평조·계면조 5음 음계, 대금·가야금·태평소·해금 흉내 소리, 장구·북 장단(굿거리·자진모리)
// 사용: node art/gen-bgm.js  → art/out/bgm-*.wav  (ffmpeg로 sounds/bgm-*.mp3 로 바꿈)
// 끊김 없이 되풀이되도록 곡을 두 번 연주해 두 번째 바퀴만 잘라 씀(울림 꼬리가 앞쪽에 이어짐)
const fs = require('fs');
const path = require('path');
const SR = 44100;

// ───── 작은 도구 ─────
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const PYEONG = [0, 2, 5, 7, 9];   // 평조: 솔 라 도 레 미 (밝고 점잖음)
const GYEMYEON = [0, 3, 5, 7, 10]; // 계면조: 라 도 레 미 솔 (슬프고 힘참)
function degFreq(tonic, scale, d) { const o = Math.floor(d / 5), i = ((d % 5) + 5) % 5; return tonic * Math.pow(2, o + scale[i] / 12); }
// "3/6 2/3 -/3" → [{d:3,len:6},...]  (len 단위: 한 장단 12칸 중 몇 칸)
function parse(bars) {
  const out = []; bars.forEach((b, bi) => { let u = 0; b.trim().split(/\s+/).forEach(t => { const [d, l] = t.split('/'); if (d !== '-') out.push({ bar: bi, u, d: +d, len: +l }); u += +l; }); });
  return out;
}

// ───── 악기 ─────
// 반환: (buf, t0초, ...)로 왼·오른 버퍼에 더함
function add(buf, i, v, pan) { if (i >= 0 && i < buf.L.length) { buf.L[i] += v * (1 - pan) ; buf.R[i] += v * (1 + pan); } }

// 가야금: 뜯는 소리(배음이 빨리 사라짐) + 농현(끝에서 살짝 떨기)
function gayageum(buf, t0, f, dur, vol, pan = -0.2, nong = true) {
  const n = Math.floor((dur + 1.2) * SR), i0 = Math.floor(t0 * SR); let ph = new Float64Array(9);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let fm = f;
    if (nong && t > 0.25 && dur > 0.5) fm *= 1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * (t - 0.25)) * Math.min(1, (t - 0.25) * 2);
    let s = 0;
    for (let h = 1; h <= 8; h++) { ph[h] += 2 * Math.PI * fm * h / SR; s += Math.sin(ph[h]) * Math.exp(-t * (2.2 + h * 1.1)) / Math.pow(h, 1.1); }
    const att = Math.min(1, t / 0.004); const rel = t > dur ? Math.exp(-(t - dur) * 6) : 1;
    add(buf, i0 + k, s * vol * att * rel * 0.5, pan);
  }
}
// 대금: 둥근 피리 소리 + 숨소리 + 점점 깊어지는 떨림
function daegeum(buf, t0, f, dur, vol, pan = 0.15, fPrev = 0) {
  const n = Math.floor((dur + 0.35) * SR), i0 = Math.floor(t0 * SR); let ph = 0, lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const glide = fPrev && t < 0.07 ? fPrev + (f - fPrev) * (t / 0.07) : f;
    const vib = 1 + 0.010 * Math.sin(2 * Math.PI * 5 * t) * Math.min(1, Math.max(0, t - 0.3) * 1.2);
    ph += 2 * Math.PI * glide * vib / SR;
    lp += 0.08 * ((rand() * 2 - 1) - lp);
    const s = Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph) + lp * 0.55;
    const env = Math.min(1, t / 0.08) * (t > dur ? Math.exp(-(t - dur) * 14) : 1) * (0.85 + 0.15 * Math.min(1, t / 0.6));
    add(buf, i0 + k, s * vol * env * 0.35, pan);
  }
}
// 태평소(날라리): 쨍한 겹리드 소리
function taepyeongso(buf, t0, f, dur, vol, pan = 0.1, fPrev = 0) {
  const n = Math.floor((dur + 0.15) * SR), i0 = Math.floor(t0 * SR); let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const glide = fPrev && t < 0.04 ? fPrev + (f - fPrev) * (t / 0.04) : f;
    const vib = 1 + 0.008 * Math.sin(2 * Math.PI * 6 * t) * Math.min(1, Math.max(0, t - 0.15) * 3);
    ph += 2 * Math.PI * glide * vib / SR;
    let s = 0; for (let h = 1; h <= 9; h++) s += Math.sin(h * ph) * (h % 2 ? 1 : 0.7) / Math.pow(h, 0.9);
    s = Math.tanh(s * 0.9);
    const env = Math.min(1, t / 0.025) * (t > dur ? Math.exp(-(t - dur) * 30) : 1);
    add(buf, i0 + k, s * vol * env * 0.22, pan);
  }
}
// 해금: 활로 켜는 콧소리 + 깊은 떨림 + 꺾는 소리(끝에서 아래로)
function haegeum(buf, t0, f, dur, vol, pan = 0.1, bend = false) {
  const n = Math.floor((dur + 0.4) * SR), i0 = Math.floor(t0 * SR); let ph = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let fm = f * (1 + 0.016 * Math.sin(2 * Math.PI * 4.5 * t) * Math.min(1, Math.max(0, t - 0.4)));
    if (bend && t > dur * 0.7) fm *= Math.pow(2, -1.5 / 12 * Math.min(1, (t - dur * 0.7) / (dur * 0.25)));
    ph += 2 * Math.PI * fm / SR;
    let s = 0; for (let h = 1; h <= 10; h++) s += Math.sin(h * ph) / h;
    y1 += 0.12 * (s - y1); y2 += 0.12 * (y1 - y2);
    const env = Math.min(1, t / 0.25) * (t > dur ? Math.exp(-(t - dur) * 8) : 1);
    add(buf, i0 + k, y2 * vol * env * 0.45, pan);
  }
}
// 낮게 깔리는 울림(아쟁처럼)
function drone(buf, t0, f, dur, vol) {
  const n = Math.floor(dur * SR), i0 = Math.floor(t0 * SR); let ph = 0, y = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR; ph += 2 * Math.PI * f * (1 + 0.003 * Math.sin(t * 2)) / SR;
    let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(h * ph) / h; y += 0.05 * (s - y);
    const env = Math.min(1, t / 1.5, (dur - t) / 1.5);
    add(buf, i0 + k, y * vol * env * 0.5, 0);
  }
}
// 북: 낮게 쿵 울리는 큰북
function buk(buf, t0, vol) {
  const n = Math.floor(0.7 * SR), i0 = Math.floor(t0 * SR); let ph = 0, lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR; ph += 2 * Math.PI * (52 + 70 * Math.exp(-t * 18)) / SR;
    lp += 0.15 * ((rand() * 2 - 1) - lp);
    const s = Math.sin(ph) * Math.exp(-t * 5) + lp * Math.exp(-t * 40) * 0.8;
    add(buf, i0 + k, s * vol * 0.9, 0);
  }
}
// 장구: dung(양손) kung(왼쪽 북편, 낮음) duk(오른쪽 채편, 딱) gi(작은 덕)
function janggu(buf, t0, kind, vol) {
  if (kind === 'dung') { janggu(buf, t0, 'kung', vol); janggu(buf, t0, 'duk', vol); return; }
  const n = Math.floor(0.4 * SR), i0 = Math.floor(t0 * SR); let ph = 0, y = 0, lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR; let s;
    if (kind === 'kung') { ph += 2 * Math.PI * (95 + 60 * Math.exp(-t * 30)) / SR; s = Math.sin(ph) * Math.exp(-t * 9); add(buf, i0 + k, s * vol * 0.7, -0.35); }
    else { const w = rand() * 2 - 1; lp += 0.35 * (w - lp); y = w - lp; ph += 2 * Math.PI * 420 / SR;
      s = (y * 0.8 + Math.sin(ph) * 0.6) * Math.exp(-t * (kind === 'gi' ? 70 : 45)); add(buf, i0 + k, s * vol * (kind === 'gi' ? 0.3 : 0.5), 0.35); }
  }
}
// 바람 소리(남한산성 겨울)
function wind(buf, t0, dur, vol) {
  const n = Math.floor(dur * SR), i0 = Math.floor(t0 * SR); let a = 0, b = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR; const w = rand() * 2 - 1; a += 0.02 * (w - a); b += 0.02 * (a - b);
    const g = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 7.3) * Math.sin(2 * Math.PI * t / 3.1);
    add(buf, i0 + k, b * vol * g * 6, Math.sin(t * 0.4) * 0.5);
  }
}

// 간단한 울림(공간감): 빗살 거르개 4개 + 전대역 거르개 2개
function reverb(x, mix) {
  const out = new Float32Array(x.length); const combs = [1557, 1617, 1491, 1422].map(d => ({ d, b: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [225, 556].map(d => ({ d, b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < x.length; n++) {
    let s = 0; for (const c of combs) { const y = c.b[c.i]; c.lp = y * 0.75 + c.lp * 0.25; c.b[c.i] = x[n] + c.lp * 0.80; c.i = (c.i + 1) % c.d; s += y; }
    s *= 0.25; for (const a of aps) { const y = a.b[a.i]; const v = s + y * -0.5; a.b[a.i] = v; s = y + v * 0.5; a.i = (a.i + 1) % a.d; }
    out[n] = x[n] * (1 - mix) + s * mix;
  }
  return out;
}

// ───── 곡 ─────
// 한 장단 = 12칸. unit = 한 칸 길이(초)
const JANG = {
  gutgeori: [[0, 'dung'], [2, 'gi'], [3, 'kung'], [4, 'duk'], [4.5, 'gi'], [5, 'gi'], [6, 'kung'], [8, 'gi'], [9, 'kung'], [10, 'duk']],
  jajin: [[0, 'dung'], [2, 'duk'], [3, 'kung'], [5, 'duk'], [6, 'kung'], [8, 'duk'], [9, 'kung'], [10, 'duk'], [11, 'gi']],
};
const SONGS = {
  // 시작 화면: 평조, 느린 대금 + 가야금 (점잖게 열리는 조선)
  title: { unit: 0.4, tonic: 392, scale: PYEONG, rev: 0.32,
    mel: ['0/9 1/3', '2/6 3/3 2/3', '1/12', '3/6 4/3 3/3', '5/9 4/3', '3/6 2/3 1/3', '2/9 1/3', '0/12', '-/3 -1/3 0/6', '1/6 -1/6'],
    roots: [0, 2, 1, 3, 0, 3, 2, 0, -1, 0],
    play(buf, s, at) {
      let prev = 0; parse(s.mel).forEach(n => { const f = degFreq(s.tonic, s.scale, n.d); daegeum(buf, at(n.bar, n.u), f, n.len * s.unit * 0.96, 0.55, 0.15, prev); prev = f; });
      s.roots.forEach((r, b) => [0, 3, 6, 9].forEach((u, j) => gayageum(buf, at(b, u), degFreq(s.tonic / 2, s.scale, r + [0, 2, 3, 2][j]), s.unit * 3, j ? 0.32 : 0.45, -0.3)));
      s.roots.forEach((r, b) => { janggu(buf, at(b, 0), 'kung', 0.35); janggu(buf, at(b, 9), 'gi', 0.25); });
    } },
  // 군사 준비: 평조 굿거리, 가야금 가락 + 대금 (흥겹게 준비)
  prep: { unit: 0.28, tonic: 293.66, scale: PYEONG, rev: 0.22,
    mel: ['3/3 2/2 1/1 0/3 1/3', '2/6 1/3 0/3', '-1/3 0/3 1/3 2/3', '1/9 -/3', '3/3 4/2 3/1 2/3 3/3', '5/6 4/3 3/3', '4/3 3/3 2/3 1/3', '2/9 -/3',
      '5/3 4/3 3/3 4/3', '3/3 2/3 1/6', '2/3 1/3 0/3 -1/3', '0/9 -/3'],
    roots: [0, 2, 0, 1, 3, 3, 2, 2, 3, 1, 0, 0],
    play(buf, s, at) {
      parse(s.mel).forEach(n => gayageum(buf, at(n.bar, n.u), degFreq(s.tonic, s.scale, n.d), n.len * s.unit, 0.55, -0.15));
      let prev = 0; parse(s.mel).filter(n => n.bar >= 4).forEach(n => { const f = degFreq(s.tonic * 2, s.scale, n.d); daegeum(buf, at(n.bar, n.u), f, n.len * s.unit * 0.95, 0.28, 0.3, prev); prev = f; });
      s.roots.forEach((r, b) => { gayageum(buf, at(b, 0), degFreq(s.tonic / 2, s.scale, r), s.unit * 6, 0.4, -0.35, false); gayageum(buf, at(b, 6), degFreq(s.tonic / 2, s.scale, r + 2), s.unit * 6, 0.3, -0.35, false); });
      s.roots.forEach((r, b) => JANG.gutgeori.forEach(([u, k]) => janggu(buf, at(b, u), k, 0.55)));
    } },
  // 전투: 계면조 자진모리, 태평소 + 북 (힘차게 싸움)
  battle: { unit: 0.1667, tonic: 329.63, scale: GYEMYEON, rev: 0.16,
    mel: ['5/3 4/3 3/6', '2/3 3/3 1/6', '0/3 1/3 2/3 3/3', '3/9 -/3', '5/3 5/3 6/3 5/3', '4/3 3/3 4/6', '3/3 2/3 1/3 2/3', '0/9 -/3',
      '7/6 6/3 5/3', '6/3 5/3 4/6', '5/3 4/3 3/3 4/3', '3/9 -/3', '3/2 3/1 5/3 3/2 3/1 5/3', '6/3 5/3 3/6', '2/3 3/3 4/3 3/3', '0/9 -/3'],
    roots: [0, 1, 0, 3, 0, 4, 1, 0, 2, 4, 0, 3, 3, 1, 2, 0],
    play(buf, s, at) {
      let prev = 0; parse(s.mel).forEach(n => { const f = degFreq(s.tonic, s.scale, n.d); taepyeongso(buf, at(n.bar, n.u), f, n.len * s.unit * 0.92, 0.5, 0.1, prev); prev = f; });
      s.roots.forEach((r, b) => [0, 3, 6, 9].forEach((u, j) => gayageum(buf, at(b, u), degFreq(s.tonic / 4, s.scale, r + (j % 2 ? 2 : 0)), s.unit * 3, 0.55, -0.25, false)));
      s.roots.forEach((r, b) => {
        JANG.jajin.forEach(([u, k]) => janggu(buf, at(b, u), k, 0.6));
        buk(buf, at(b, 0), 0.75); buk(buf, at(b, 6), 0.5);
        if (b % 4 === 3) [9, 10, 11].forEach(u => buk(buf, at(b, u), 0.55));
      });
    } },
  // 남한산성: 계면조, 해금 + 낮은 울림 + 북 (춥고 힘든 겨울)
  siege: { unit: 0.36, tonic: 293.66, scale: GYEMYEON, rev: 0.35,
    mel: ['3/12', '2/6 1/6', '0/9 1/3', '2/12', '3/6 4/3 3/3', '5/12', '4/6 3/3 2/3', '3/12', '2/6 1/3 0/3', '0/12'],
    play(buf, s, at) {
      parse(s.mel).forEach(n => haegeum(buf, at(n.bar, n.u), degFreq(s.tonic, s.scale, n.d), n.len * s.unit * 0.97, 0.6, 0.1, n.d === 2 && n.len >= 6));
      const bars = s.mel.length;
      drone(buf, at(0, 0), degFreq(s.tonic / 4, s.scale, 0), bars * 12 * s.unit, 0.5);
      drone(buf, at(0, 0), degFreq(s.tonic / 4, s.scale, 3), bars * 12 * s.unit, 0.25);
      for (let b = 0; b < bars; b++) { buk(buf, at(b, 0), 0.45); buk(buf, at(b, 1.2), 0.3); if (b % 2) gayageum(buf, at(b, 6), degFreq(s.tonic / 2, s.scale, 0), s.unit * 6, 0.25, -0.3); }
      wind(buf, at(0, 0), bars * 12 * s.unit, 0.12);
    } },
};

function render(name) {
  const s = SONGS[name]; seed = 7;
  const bars = s.mel.length, L = bars * 12 * s.unit, total = Math.ceil((2 * L + 3) * SR);
  const buf = { L: new Float32Array(total), R: new Float32Array(total) };
  for (let pass = 0; pass < 2; pass++) s.play(buf, s, (b, u) => pass * L + (b * 12 + u) * s.unit);
  const Lr = reverb(buf.L, s.rev), Rr = reverb(buf.R.map((v, i) => v), s.rev);
  const a = Math.round(L * SR), n = Math.round(L * SR);
  let peak = 0; for (let i = a; i < a + n; i++) peak = Math.max(peak, Math.abs(Lr[i]), Math.abs(Rr[i]));
  const g = 0.89 / peak;
  const wav = Buffer.alloc(44 + n * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { wav.writeInt16LE(Math.round(Lr[a + i] * g * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(Rr[a + i] * g * 32767), 46 + i * 4); }
  const dir = path.join(__dirname, 'out'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bgm-' + name + '.wav'), wav);
  console.log(name, L.toFixed(2) + 's');
}
(process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SONGS)).forEach(render);
