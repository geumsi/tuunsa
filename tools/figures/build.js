// 해설 그림 생성기: node tools/figures/build.js → data/figures.js (window.FIGURES). 외부 의존성 없음.
// 옵션 손익 그래프는 다리(legs) 사양에서 만기 손익을 계산해 그린다. 나머지는 함수·좌표로 그린다.
// 색은 class(k-*)로만 준다. 모든 도형은 currentColor를 쓰므로 class가 color를 바꾸면 선·면이 함께 바뀐다.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "data", "figures.js");

// ---------- SVG 기본 요소 ----------
const n = v => { const r = Math.round(v * 10) / 10; return Object.is(r, -0) ? 0 : r; };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cl = c => c ? ` class="${c}"` : "";
const DASH = ' stroke-dasharray="4 4"';
const DOT = ' stroke-dasharray="2 3"';
const sw = w => ` stroke-width="${w}"`;
const tint = o => ` fill="currentColor" fill-opacity="${o}"`;
const pts = a => a.map(p => n(p[0]) + "," + n(p[1])).join(" ");

const line = (x1, y1, x2, y2, c, ex = "") => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"${cl(c)}${ex}/>`;
const poly = (a, c, ex = "") => `<polyline points="${pts(a)}"${cl(c)}${ex}/>`;
const area = (a, c, op = 0.16) => `<polygon points="${pts(a)}"${cl(c)}${tint(op)} stroke="none"/>`;
const rect = (x, y, w, h, c, ex = "") => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${cl(c)}${ex}/>`;
const dot = (x, y, c, r = 3.5) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}"${cl(c)} fill="currentColor" stroke="none"/>`;
const ring = (x, y, c, r = 4) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}"${cl(c)} fill="none"${sw(2)}/>`;
// 글자: o.a 정렬(m 가운데, e 끝), o.c 색, o.b 굵게, o.s 크기, o.nh 외곽 테두리 없음
function text(x, y, s, o = {}) {
  const a = o.a === "m" ? ' text-anchor="middle"' : o.a === "e" ? ' text-anchor="end"' : "";
  const c = [o.c, o.nh ? "nh" : ""].filter(Boolean).join(" ");
  return `<text x="${n(x)}" y="${n(y)}"${a}${cl(c)}${o.b ? ' font-weight="700"' : ""}${o.s ? ` font-size="${o.s}"` : ""} fill="currentColor" stroke="none">${esc(s)}</text>`;
}
// 화살표: 선 + 끝 삼각형
function head(x, y, ang, c, s = 7) {
  const a1 = ang + Math.PI * 0.85, a2 = ang - Math.PI * 0.85;
  return `<polygon points="${pts([[x, y], [x + s * Math.cos(a1), y + s * Math.sin(a1)], [x + s * Math.cos(a2), y + s * Math.sin(a2)]])}"${cl(c)} fill="currentColor" stroke="none"/>`;
}
function arrow(x1, y1, x2, y2, c, ex = "", both = false) {
  const ang = Math.atan2(y2 - y1, x2 - x1), k = 5;
  const ex2 = x2 - k * Math.cos(ang), ey2 = y2 - k * Math.sin(ang);
  let s = line(both ? x1 + k * Math.cos(ang) : x1, both ? y1 + k * Math.sin(ang) : y1, ex2, ey2, c, ex) + head(x2, y2, ang, c);
  if (both) s += head(x1, y1, ang + Math.PI, c);
  return s;
}
// 상자 + 가운데 글자 여러 줄
function box(x, y, w, h, lines, c = "k-ac", o = {}) {
  let s = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="8"${cl(c)}${tint(o.op == null ? 0.1 : o.op)}/>`;
  const lh = 17, y0 = y + h / 2 - (lines.length - 1) * lh / 2 + 5;
  lines.forEach((t, i) => { s += text(x + w / 2, y0 + i * lh, t, {a: "m", nh: 1, b: i === 0 && o.bold !== false, c: "k-fg"}); });
  return s;
}
function svg(w, h, title, body) {
  return `<svg class="fig" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" font-size="14">${body}</svg>`;
}

// ---------- 좌표 평면 ----------
function plane(o) {
  const P = Object.assign({}, o);
  P.sx = v => o.L + (v - o.x0) / (o.x1 - o.x0) * (o.R - o.L);
  P.sy = v => o.B - (v - o.y0) / (o.y1 - o.y0) * (o.B - o.T);
  P.map = a => a.map(p => [P.sx(p[0]), P.sy(p[1])]);
  return P;
}
// 축: 가로축은 데이터 y=ax 높이, 세로축은 데이터 x=ay 위치. 끝에 화살표.
function axes(P, xl, yl, o = {}) {
  const ay = P.sx(o.ay == null ? P.x0 : o.ay), ax = P.sy(o.ax == null ? P.y0 : o.ax);
  let s = arrow(P.L, ax, P.R + 8, ax, "k-fg") + arrow(ay, P.B, ay, P.T - 12, "k-fg");
  if (xl) s += text(P.R + 8, ax + (o.xlUp ? -8 : 20), xl, {a: "e", c: "k-mu"});
  if (yl) s += text(ay + 8, P.T - 6, yl, {c: "k-mu"});
  if (o.origin) s += text(ay - 6, ax + 16, o.origin, {a: "e", c: "k-mu"});
  return s;
}
function curve(f, a, b, steps = 60) {
  const r = [];
  for (let i = 0; i <= steps; i++) { const x = a + (b - a) * i / steps; r.push([x, f(x)]); }
  return r;
}
function solve(f, a, b) { // 이분법: f(a), f(b) 부호가 다를 때 근
  let fa = f(a);
  for (let i = 0; i < 80; i++) { const m = (a + b) / 2, fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; }
  return (a + b) / 2;
}

// ---------- 옵션 손익 계산 ----------
// leg: {t:"c"|"p"|"s"(주식)|"f"(선물), q:수량(+매수, −매도), K:행사가 또는 매입가, p:프리미엄}
function legValue(l, S) {
  if (l.t === "c") return l.q * (Math.max(S - l.K, 0) - l.p);
  if (l.t === "p") return l.q * (Math.max(l.K - S, 0) - l.p);
  return l.q * (S - l.K);
}
const payoffAt = (legs, S) => legs.reduce((v, l) => v + legValue(l, S), 0);
const r2 = v => Math.round(v * 100) / 100;
function analyze(legs) {
  const ks = [...new Set(legs.filter(l => l.t === "c" || l.t === "p").map(l => l.K))].sort((a, b) => a - b);
  const bp = [0, ...ks];
  const vals = bp.map(S => payoffAt(legs, S));
  const last = bp[bp.length - 1];
  const slopeR = payoffAt(legs, last + 1) - payoffAt(legs, last);
  const roots = [];
  for (let i = 0; i + 1 < bp.length; i++) {
    const a = vals[i], b = vals[i + 1];
    if (a === 0) roots.push(bp[i]);
    else if (a * b < 0) roots.push(bp[i] + (bp[i + 1] - bp[i]) * (-a) / (b - a));
  }
  const vl = vals[vals.length - 1];
  if (vl === 0) roots.push(last);
  else if (slopeR !== 0 && vl * slopeR < 0) roots.push(last - vl / slopeR);
  let maxP = Math.max(...vals), maxL = Math.min(...vals);
  if (slopeR > 0) maxP = Infinity;
  if (slopeR < 0) maxL = -Infinity;
  return {ks, bp, vals, slopeR, bep: [...new Set(roots.map(r2))], maxP: r2(maxP), maxL: r2(maxL)};
}

const CHECK = {}; // 검산 결과 (보고용)
const fmt = v => v === Infinity ? "무한대" : v === -Infinity ? "−무한대" : (v < 0 ? "−" + Math.abs(v) : String(v));
const sgn = v => v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0";

// o: {x0,x1, legs, comps:[{legs,label,lx}], kNames:[], lab:{maxP:[S,v,anchor], maxL:[...]}, note}
function payoff(id, title, o) {
  const W = 340, H = 252;
  const A = analyze(o.legs);
  CHECK[id] = {bep: A.bep, maxP: A.maxP, maxL: A.maxL};
  const inView = s => s > o.x0 && s < o.x1;
  const xs = [...new Set([o.x0, ...A.ks.filter(inView), ...A.bep.filter(inView), o.x1])].sort((a, b) => a - b);
  const series = [o.legs, ...(o.comps || []).map(c => c.legs)];
  let lo = 0, hi = 0;
  series.forEach(L => xs.forEach(S => { const v = payoffAt(L, S); lo = Math.min(lo, v); hi = Math.max(hi, v); }));
  const span = hi - lo, pad = span * 0.2;
  const P = plane({L: 66, R: 322, T: 30, B: 186, x0: o.x0, x1: o.x1, y0: lo - pad * (o.padLo || 1), y1: hi + pad * (o.padHi || 1)});
  const z = P.sy(0);
  const main = xs.map(S => [S, payoffAt(o.legs, S)]);
  let s = "";
  // 이익·손실 면
  s += area(P.map([[o.x0, 0], ...main.map(p => [p[0], Math.max(p[1], 0)]), [o.x1, 0]]), "k-ok", 0.16);
  s += area(P.map([[o.x0, 0], ...main.map(p => [p[0], Math.min(p[1], 0)]), [o.x1, 0]]), "k-bd", 0.16);
  // 가로축(손익 0)과 세로축
  s += arrow(P.L, z, P.R + 10, z, "k-fg") + arrow(P.L, P.B, P.L, P.T - 14, "k-fg");
  s += text(P.L + 8, P.T - 6, "손익", {c: "k-mu"});
  s += text(P.L - 6, z + 5, "0", {a: "e", c: "k-mu"});
  const vR = payoffAt(o.legs, o.x1);
  s += text(P.R + 10, z + (vR > 0 ? 20 : -9), o.xl || "만기 가격", {a: "e", c: "k-mu"});
  // 행 머리
  const rowK = 212, rowB = 236;
  s += text(4, rowK, o.kHead || "행사가", {c: "k-mu"});
  // 행사가 안내선과 라벨
  A.ks.filter(inView).forEach((K, i) => {
    const y = P.sy(payoffAt(o.legs, K));
    s += line(P.sx(K), y, P.sx(K), rowK - 15, "k-ln", DOT);
    const nm = o.kNames ? o.kNames[i] + " " : "";
    s += text(P.sx(K), rowK, nm + K, {a: "m"});
  });
  (o.kExtra || []).forEach(k => { s += line(P.sx(k[0]), z, P.sx(k[0]), rowK - 15, "k-ln", DOT) + text(P.sx(k[0]), rowK, k[1], {a: "m"}); });
  // 구성 다리 점선
  (o.comps || []).forEach(c => {
    const a = xs.map(S => [S, payoffAt(c.legs, S)]);
    s += poly(P.map(a), "k-mu", DASH + sw(1.5));
    if (c.label) s += line(P.L + 10, P.T + 6, P.L + 32, P.T + 6, "k-mu", DASH + sw(1.5)) + text(P.L + 38, P.T + 11, c.label, {c: "k-mu"});
  });
  // 손익선
  s += poly(P.map(main), "k-ac", sw(3));
  // 손익분기점
  const beps = A.bep.filter(inView);
  if (beps.length) s += text(4, rowB, "손익분기", {c: "k-ac", b: 1});
  beps.forEach(b => {
    s += line(P.sx(b), z, P.sx(b), rowB - 15, "k-ac", DOT) + ring(P.sx(b), z, "k-ac");
    s += text(P.sx(b), rowB, String(b), {a: "m", c: "k-ac", b: 1});
  });
  // 최대이익·최대손실 라벨
  function place(kind, v) {
    const isP = kind === "maxP";
    const name = isP ? "최대이익" : "최대손실";
    const fixed = o.lab && o.lab[kind];
    if (v === Infinity || v === -Infinity) {
      const t = isP ? "이익 무한대" : "손실 무한대";
      const S = fixed ? fixed[0] : o.x1, yv = fixed ? fixed[1] : payoffAt(o.legs, o.x1);
      return text(P.sx(S), P.sy(yv), t, {a: fixed ? fixed[2] : "e", c: isP ? "k-ok" : "k-bd", b: 1});
    }
    let S, yv, a = "m";
    if (fixed) { [S, yv, a] = fixed; a = a || "m"; }
    else {
      const at = xs.filter(x => Math.abs(payoffAt(o.legs, x) - v) < 1e-9);
      if (!at.length) return "";
      S = (at[0] + at[at.length - 1]) / 2;
      yv = v;
      const px = P.sx(S);
      if (px < P.L + 50) { S = P.x0; a = "s"; }
      if (px > P.R - 50) { S = o.x1; a = "e"; }
    }
    const dy = fixed ? 0 : isP ? -10 : 22;
    const lead = fixed && fixed[3] != null ? line(P.sx(fixed[3]), P.sy(yv) + 5, P.sx(fixed[3]), P.sy(v) - 3, isP ? "k-ok" : "k-bd", sw(1)) : "";
    return lead + text(P.sx(S) + (a === "s" ? 4 : 0), P.sy(yv) + dy, name + " " + sgn(v) + (o.at0 && o.at0[kind] ? " (가격 0)" : ""), {a, c: isP ? "k-ok" : "k-bd", b: 1});
  }
  if (!(o.skip || []).includes("maxP")) s += place("maxP", A.maxP);
  if (!(o.skip || []).includes("maxL")) s += place("maxL", A.maxL);
  (o.extra || []).forEach(e => { s += e(P); });
  return {title, caption: o.cap, svg: svg(W, H, title, s)};
}

// ---------- 그림 정의 ----------
const F = {};
const C = (t, K, p, q = 1) => ({t: "c", K, p, q});
const Pt = (t, K, p, q = 1) => ({t: "p", K, p, q});
const STOCK = {t: "s", K: 100, q: 1};

F["pay-long-call"] = payoff("pay-long-call", "콜옵션 매수 만기 손익", {
  x0: 70, x1: 130, legs: [C(0, 100, 5)],
  cap: "행사가 100, 프리미엄 5 예시. 가격이 105를 넘으면 이익이고, 100 아래에서는 프리미엄 5만큼만 잃는다."
});
F["pay-short-call"] = payoff("pay-short-call", "콜옵션 매도 만기 손익", {
  x0: 70, x1: 130, legs: [C(0, 100, 5, -1)], lab: {maxL: [130, -22, "e"]},
  cap: "행사가 100, 프리미엄 5 예시. 받은 프리미엄 5가 최대이익이고, 105를 넘게 오르면 손실이 끝없이 커진다."
});
F["pay-long-put"] = payoff("pay-long-put", "풋옵션 매수 만기 손익", {
  x0: 70, x1: 130, legs: [Pt(0, 100, 5)], at0: {maxP: 1}, lab: {maxP: [100.5, 18, "s"]},
  cap: "행사가 100, 프리미엄 5 예시. 95 아래로 내릴수록 이익이 커지고(가격 0이면 95), 100 위에서는 프리미엄 5만 잃는다."
});
F["pay-short-put"] = payoff("pay-short-put", "풋옵션 매도 만기 손익", {
  x0: 70, x1: 130, legs: [Pt(0, 100, 5, -1)], at0: {maxL: 1}, lab: {maxL: [100.5, -18, "s"]},
  cap: "행사가 100, 프리미엄 5 예시. 100 위에서는 프리미엄 5를 그대로 갖고, 95 아래로 내릴수록 손실이 커진다(가격 0이면 95)."
});
F["pay-covered-call"] = payoff("pay-covered-call", "커버드콜 만기 손익", {
  x0: 70, x1: 130, legs: [STOCK, C(0, 110, 4, -1)], at0: {maxL: 1},
  comps: [{legs: [STOCK], label: "주식만 보유"}], lab: {maxL: [100.5, -26, "s"], maxP: [120, 3, "m"]},
  cap: "주식을 100에 사고 행사가 110 콜을 4에 판 예시. 프리미엄 4만큼 손익분기가 96으로 내려가지만 110 위의 이익은 14로 묶인다."
});
F["pay-protective-put"] = payoff("pay-protective-put", "보호적 풋 만기 손익", {
  x0: 70, x1: 130, legs: [STOCK, Pt(0, 95, 3)],
  comps: [{legs: [STOCK], label: "주식만 보유"}], lab: {maxP: [118, 27, "e"], maxL: [76, 9, "s", 84]},
  cap: "주식을 100에 사고 행사가 95 풋을 3에 산 예시. 가격이 아무리 내려도 손실은 8로 막히고, 오를 때 이익은 프리미엄 3만큼 줄어든다."
});
F["pay-bull-call-spread"] = payoff("pay-bull-call-spread", "강세 콜 스프레드 만기 손익", {
  x0: 80, x1: 120, legs: [C(0, 95, 7), C(0, 105, 3, -1)], kNames: ["K₁", "K₂"],
  cap: "행사가 95 콜을 7에 사고 105 콜을 3에 판 예시(순지출 4). 이익과 손실이 모두 정해진 상승 기대 전략이다."
});
F["pay-bear-put-spread"] = payoff("pay-bear-put-spread", "약세 풋 스프레드 만기 손익", {
  x0: 80, x1: 120, legs: [Pt(0, 105, 7), Pt(0, 95, 3, -1)], kNames: ["K₁", "K₂"],
  cap: "행사가 105 풋을 7에 사고 95 풋을 3에 판 예시(순지출 4). 가격이 95 아래면 최대이익 6, 105 위면 최대손실 4다."
});
F["pay-long-butterfly"] = payoff("pay-long-butterfly", "버터플라이 매수 만기 손익", {
  x0: 80, x1: 120, legs: [C(0, 90, 13), C(0, 100, 6, -2), C(0, 110, 2)], kNames: ["K₁", "K₂", "K₃"],
  cap: "콜 K₁ 90을 13에 1개 사고, K₂ 100을 6에 2개 팔고, K₃ 110을 2에 1개 산 예시(순지출 3). 만기 가격이 K₂ 근처에 머물 때 이익이 가장 크다."
});
F["pay-short-butterfly"] = payoff("pay-short-butterfly", "버터플라이 매도 만기 손익", {
  x0: 80, x1: 120, legs: [C(0, 90, 13, -1), C(0, 100, 6, 2), C(0, 110, 2, -1)], kNames: ["K₁", "K₂", "K₃"],
  cap: "버터플라이 매수의 반대 포지션(순수취 3). 가격이 K₁ 아래나 K₃ 위로 크게 움직이면 이익 3, K₂에 머물면 손실 7이다."
});
F["pay-long-straddle"] = payoff("pay-long-straddle", "스트래들 매수 만기 손익", {
  x0: 75, x1: 125, legs: [C(0, 100, 5), Pt(0, 100, 5)], lab: {maxP: [124, 19, "e"]},
  cap: "행사가 100 콜과 풋을 5씩 같이 산 예시. 어느 방향이든 10 넘게 움직이면 이익이고, 그대로면 프리미엄 10을 잃는다."
});
F["pay-short-straddle"] = payoff("pay-short-straddle", "스트래들 매도 만기 손익", {
  x0: 75, x1: 125, legs: [C(0, 100, 5, -1), Pt(0, 100, 5, -1)], lab: {maxL: [124, -21, "e"]},
  cap: "행사가 100 콜과 풋을 5씩 같이 판 예시. 가격이 100에 머물면 10을 벌고, 90 아래나 110 위로 움직이면 손실이 커진다."
});
F["pay-long-strangle"] = payoff("pay-long-strangle", "스트랭글 매수 만기 손익", {
  x0: 75, x1: 125, legs: [Pt(0, 95, 3), C(0, 105, 3)], kNames: ["K₁", "K₂"], lab: {maxP: [124, 16, "e"]},
  cap: "행사가 95 풋과 105 콜을 3씩 산 예시. 스트래들보다 싸지만 가격이 더 크게(89 아래, 111 위) 움직여야 이익이다."
});
F["pay-short-strangle"] = payoff("pay-short-strangle", "스트랭글 매도 만기 손익", {
  x0: 75, x1: 125, legs: [Pt(0, 95, 3, -1), C(0, 105, 3, -1)], kNames: ["K₁", "K₂"], lab: {maxL: [124, -18, "e"]},
  cap: "행사가 95 풋과 105 콜을 3씩 판 예시. 가격이 95~105 사이에 머물면 6을 벌고, 89 아래나 111 위로 가면 손실이 커진다."
});
F["pay-collar"] = payoff("pay-collar", "칼라 만기 손익", {
  x0: 80, x1: 125, legs: [STOCK, Pt(0, 95, 3), C(0, 110, 3, -1)], kNames: ["풋", "콜"],
  comps: [{legs: [STOCK], label: "주식만 보유"}], lab: {maxP: [117.5, 2, "m"], maxL: [81, 7, "s", 88]},
  cap: "주식을 100에 사고 행사가 95 풋을 3에 사며 110 콜을 3에 판 예시(비용 0). 손실은 5, 이익은 10으로 위아래가 모두 묶인다."
});
// 선물 매수·매도: 두 직선
F["pay-futures-long-short"] = (function () {
  const id = "pay-futures-long-short", title = "선물 매수·매도 만기 손익";
  const L1 = [{t: "f", K: 100, q: 1}], L2 = [{t: "f", K: 100, q: -1}];
  CHECK[id] = {bep: analyze(L1).bep, maxP: "매수 무한대, 매도 100(가격 0)", maxL: "매수 −100(가격 0), 매도 −무한대"};
  const P = plane({L: 66, R: 322, T: 30, B: 186, x0: 70, x1: 130, y0: -36, y1: 36});
  const z = P.sy(0);
  let s = arrow(P.L, z, P.R + 10, z, "k-fg") + arrow(P.L, P.B, P.L, P.T - 14, "k-fg");
  s += text(P.L + 8, P.T - 6, "손익", {c: "k-mu"}) + text(P.L - 6, z + 5, "0", {a: "e", c: "k-mu"});
  s += text(P.R + 10, z - 9, "만기 가격", {a: "e", c: "k-mu"});
  s += poly(P.map([[70, -30], [130, 30]]), "k-ac", sw(3)) + poly(P.map([[70, 30], [130, -30]]), "k-wn", sw(3));
  s += text(P.sx(112), P.sy(24), "선물 매수", {a: "e", c: "k-ac", b: 1});
  s += text(P.sx(112), P.sy(-24) + 10, "선물 매도", {a: "e", c: "k-wn", b: 1});
  s += text(P.sx(73), P.sy(-30) + 24, "매수 손실", {c: "k-bd"}) + text(P.sx(72), P.sy(6), "매도 이익", {c: "k-ok"});
  s += line(P.sx(100), z, P.sx(100), 197, "k-ln", DOT) + ring(P.sx(100), z, "k-fg");
  s += text(4, 212, "체결가", {c: "k-mu"}) + text(P.sx(100), 212, "F₀ 100", {a: "m", b: 1});
  s += text(4, 236, "가격이 1 오르면 매수 +1, 매도 −1 (기울기 ±1)", {c: "k-mu"});
  return {title, caption: "체결가 100 예시. 매수는 가격이 오른 만큼 벌고 매도는 내린 만큼 번다. 옵션과 달리 이익과 손실이 양쪽으로 열려 있다.", svg: svg(340, 252, title, s)};
})();
// ELS 스텝다운: 시간축 + 조기상환 배리어 + 낙인 배리어
F["pay-els-stepdown"] = (function () {
  const title = "ELS 스텝다운 구조";
  const steps = [90, 90, 85, 85, 80, 75];
  const P = plane({L: 50, R: 326, T: 30, B: 196, x0: 0, x1: 36, y0: 30, y1: 110});
  let s = axes(P, "개월", "기준가격 대비(%)", {xlUp: 1});
  [100, 50].forEach(v => { s += text(P.L - 6, P.sy(v) + 5, String(v), {a: "e", c: "k-mu"}); });
  s += line(P.L, P.sy(100), P.R, P.sy(100), "k-ln", DOT);
  // 계단
  const st = [];
  steps.forEach((v, i) => { st.push([i * 6, v], [(i + 1) * 6, v]); });
  s += poly(P.map(st), "k-ac", sw(2.5) + DASH);
  steps.forEach((v, i) => {
    const x = P.sx((i + 1) * 6);
    s += dot(x, P.sy(v), "k-ac") + text(x, P.sy(v) - 9, String(v), {a: "m", c: "k-ac", b: 1});
    s += text(x, P.B + 18, String((i + 1) * 6), {a: "m", c: "k-mu"});
  });
  s += text(P.sx(0.5), P.sy(100) - 8, "조기상환 조건(6개월마다 평가)", {c: "k-ac"});
  // 낙인
  s += line(P.L, P.sy(50), P.R, P.sy(50), "k-bd", sw(2.5));
  s += text(P.sx(35.5), P.sy(50) - 8, "낙인(KI) 50: 한 번이라도 닿으면 원금손실 위험", {a: "e", c: "k-bd"});
  s += text(P.sx(35.5), P.sy(75) + 22, "만기에 75 이상이면 원금+쿠폰 상환", {a: "e", c: "k-mu"});
  return {title, caption: "6개월마다 기초자산 가격이 계단(90-90-85-85-80-75%) 이상이면 쿠폰과 함께 조기상환된다. 그 사이 가격이 낙인 50% 아래로 한 번이라도 내려가면 만기에 하락률만큼 원금을 잃을 수 있다.", svg: svg(340, 230, title, s)};
})();

// ---------- 채권 ----------
const bondPrice = (c, T, y) => { let p = 0; for (let t = 1; t <= T; t++) p += c / Math.pow(1 + y, t); return p + 100 / Math.pow(1 + y, T); };
function macD(c, T, y) { let p = 0, w = 0; for (let t = 1; t <= T; t++) { const cf = (t === T ? 100 : 0) + c; const pv = cf / Math.pow(1 + y, t); p += pv; w += t * pv; } return w / p; }

F["bond-price-yield"] = (function () {
  const title = "채권 가격-수익률 곡선과 듀레이션";
  const c = 5, T = 20, y0 = 0.05, P0 = bondPrice(c, T, y0);
  const dP = -macD(c, T, y0) / (1 + y0) * P0; // 수정듀레이션 × 가격
  const P = plane({L: 50, R: 322, T: 30, B: 192, x0: 1, x1: 10, y0: 25, y1: 180});
  let s = axes(P, "수익률 y(%)", "가격 P");
  s += poly(P.map(curve(y => bondPrice(c, T, y / 100), 1, 10)), "k-ac", sw(3));
  const tan = y => P0 + dP * (y - 5) / 100;
  const ta = 1.4, tb = 9.6;
  s += poly(P.map([[ta, tan(ta)], [tb, tan(tb)]]), "k-wn", sw(2) + DASH);
  s += dot(P.sx(5), P.sy(P0), "k-fg") + text(P.sx(5) + 8, P.sy(P0) - 8, "P₀", {b: 1});
  s += line(P.sx(5), P.sy(P0), P.sx(5), P.B, "k-ln", DOT) + text(P.sx(5), P.B + 18, "y₀", {a: "m", c: "k-mu"});
  // 오차 표시 (y=8.5%)
  const ye = 8.5, a1 = P.sy(bondPrice(c, T, ye / 100)), a2 = P.sy(tan(ye));
  s += arrow(P.sx(ye), a2, P.sx(ye), a1, "k-bd", sw(1.5), true);
  s += text(P.sx(ye - 0.3), a2 + 22, "볼록성 오차", {a: "e", c: "k-bd", b: 1});
  s += text(P.sx(2.2), P.sy(160), "실제 가격(볼록)", {c: "k-ac", b: 1});
  s += text(P.sx(6.6), P.sy(118), "듀레이션 추정(접선)", {c: "k-wn", b: 1});
  return {title, caption: "20년 만기, 표면이자 5% 채권 예시. 접선(듀레이션 추정)은 늘 실제 곡선 아래에 있어, 금리가 크게 움직일수록 실제 가격이 추정보다 높게 나온다. 이 차이가 볼록성이다.", svg: svg(340, 222, title, s)};
})();

F["yield-curve-shapes"] = (function () {
  const title = "수익률곡선 4가지 형태";
  const shapes = [
    ["우상향(정상)", t => 1.5 + 3 * (1 - Math.exp(-t / 3))],
    ["우하향(역전)", t => 4.5 - 3 * (1 - Math.exp(-t / 3))],
    ["수평", () => 3],
    ["낙타형(혹)", t => 1.5 + 3.4 * (t / 3) * Math.exp(1 - t / 3)]
  ];
  let s = "";
  shapes.forEach((sh, i) => {
    const ox = i % 2 ? 176 : 8, oy = i < 2 ? 4 : 128;
    const P = plane({L: ox + 14, R: ox + 150, T: oy + 30, B: oy + 104, x0: 0, x1: 10, y0: 0, y1: 6});
    s += line(P.L, P.B, P.R, P.B, "k-fg") + line(P.L, P.B, P.L, P.T - 4, "k-fg");
    s += text(P.L, oy + 18, sh[0], {b: 1});
    s += poly(P.map(curve(sh[1], 0.3, 10, 30)), "k-ac", sw(3));
  });
  s += text(170, 252, "가로축 만기, 세로축 수익률", {a: "m", c: "k-mu"});
  return {title, caption: "보통은 만기가 길수록 수익률이 높은 우상향이다. 우하향(역전)은 경기 둔화 신호로 읽히고, 낙타형은 중기 수익률이 가장 높은 모양이다.", svg: svg(340, 262, title, s)};
})();

F["bond-duration-maturity"] = (function () {
  const title = "만기·표면이자율과 듀레이션";
  const y = 0.05, lim = (1 + y) / y;
  const P = plane({L: 50, R: 300, T: 30, B: 196, x0: 0, x1: 40, y0: 0, y1: 30});
  let s = axes(P, "만기(년)", "듀레이션(년)", {xlUp: 1});
  [10, 20, 30].forEach(v => { s += text(P.L - 6, P.sy(v) + 5, String(v), {a: "e", c: "k-mu"}); });
  [10, 20, 30, 40].forEach(v => { s += text(P.sx(v), P.B + 18, String(v), {a: "m", c: "k-mu"}); });
  s += poly(P.map([[0, 0], [28, 28]]), "k-fg", sw(2.5));
  s += text(P.sx(28) + 6, P.sy(28) + 5, "할인채(D = 만기)", {c: "k-fg", b: 1});
  [[9.5, "k-ac", "표면이자 3%"], [6, "k-ok", "표면이자 10%"]].forEach(r => { s += line(P.sx(23), P.sy(r[0]), P.sx(26), P.sy(r[0]), r[1], sw(2.5)) + text(P.sx(26.8), P.sy(r[0]) + 5, r[2], {c: r[1], b: 1}); });
  const d3 = curve(T => T < 1 ? T : macD(3, Math.round(T), y), 1, 40, 39);
  const d10 = curve(T => T < 1 ? T : macD(10, Math.round(T), y), 1, 40, 39);
  s += poly(P.map([[0, 0], ...d3]), "k-ac", sw(2.5)) + poly(P.map([[0, 0], ...d10]), "k-ok", sw(2.5));
  s += line(P.L, P.sy(lim), P.R, P.sy(lim), "k-bd", DASH);
  s += text(P.R + 2, P.sy(lim) + 5, "21", {c: "k-bd", b: 1});
  s += text(P.sx(1), P.sy(lim) + 20, "영구채 한계", {c: "k-bd"});
  return {title, caption: "시장수익률 5% 가정. 만기가 길수록 듀레이션이 길어지지만 이표채는 영구채 한계 21년 근처로 수렴하고, 표면이자율이 높을수록 듀레이션은 짧다.", svg: svg(340, 226, title, s)};
})();

F["bond-immunization"] = (function () {
  const title = "면역전략: 가격위험과 재투자위험의 상쇄";
  const c = 8, T = 10, y = 0.08, D = macD(c, T, y);
  const val = (yy, t) => bondPrice(c, T, yy) * Math.pow(1 + yy, t); // 금리 변화 직후 가격을 새 금리로 굴린 t년 뒤 가치
  const base = t => val(y, t);
  const rel = (yy, t) => val(yy, t) / base(t) * 100 - 100;
  const P = plane({L: 50, R: 300, T: 30, B: 196, x0: 0, x1: 10, y0: -18, y1: 22});
  let s = axes(P, "", "금리 불변 대비(%)", {ax: 0});
  s += text(P.R + 8, P.B + 38, "투자기간(년)", {a: "e", c: "k-mu"});
  [10, -10].forEach(v => { s += text(P.L - 6, P.sy(v) + 5, (v > 0 ? "+" : "−") + Math.abs(v), {a: "e", c: "k-mu"}); });
  s += text(P.L - 6, P.sy(0) + 5, "0", {a: "e", c: "k-mu"});
  s += poly(P.map(curve(t => rel(0.10, t), 0, 10, 40)), "k-bd", sw(2.5));
  s += poly(P.map(curve(t => rel(0.06, t), 0, 10, 40)), "k-ok", sw(2.5));
  s += line(P.sx(D), P.T, P.sx(D), P.B, "k-ac", DASH);
  s += dot(P.sx(D), P.sy(0), "k-ac", 4.5);
  s += text(P.sx(D), P.T - 6, "D ≈ " + D.toFixed(1) + "년", {a: "m", c: "k-ac", b: 1});
  s += text(P.sx(0.4), P.sy(rel(0.06, 0)) - 10, "금리 하락(6%)", {c: "k-ok", b: 1});
  s += text(P.sx(0.4), P.sy(rel(0.10, 0)) + 22, "금리 상승(10%)", {c: "k-bd", b: 1});
  s += text(P.sx(D) - 8, P.B + 18, "← 가격위험", {a: "e", c: "k-mu"}) + text(P.sx(D) + 8, P.B + 18, "재투자위험 →", {c: "k-mu"});
  return {title, caption: "10년 만기, 표면이자 8% 채권을 8%에 산 직후 금리가 바뀐 경우. 투자기간을 듀레이션(약 7.2년)에 맞추면 가격 변화와 재투자수익 변화가 서로 상쇄돼 목표 가치가 지켜진다.", svg: svg(340, 244, title, s)};
})();

F["bond-riding"] = (function () {
  const title = "수익률곡선 타기: 숄더·롤링 효과";
  const yc = t => 1 + 3.4 * (1 - Math.exp(-t / 3));
  const P = plane({L: 50, R: 322, T: 30, B: 196, x0: 0, x1: 10, y0: 0, y1: 5});
  let s = axes(P, "잔존만기(년)", "수익률(%)");
  s += poly(P.map(curve(yc, 0, 10)), "k-ac", sw(3));
  function move(a, b, cls, lab) {
    const p1 = [P.sx(a), P.sy(yc(a))], p2 = [P.sx(b), P.sy(yc(b))];
    let r = dot(p1[0], p1[1], cls) + arrow(p1[0], p1[1] + 12, p2[0], p2[1] + 12, cls, sw(2));
    [a, b].forEach(t => { r += line(P.sx(t), P.sy(yc(t)), P.sx(t), P.B, "k-ln", DOT) + text(P.sx(t), P.B + 18, t + "년", {a: "m", c: "k-mu"}); });
    const lx = P.sx(a) + 8, ly = p1[1] + 34;
    return r + text(lx, ly, lab[0], {c: cls, b: 1}) + text(lx, ly + 18, lab[1], {c: "k-mu"});
  }
  s += move(2, 1, "k-wn", ["숄더 효과", "단기 구간"]);
  s += move(6, 5, "k-ok", ["롤링 효과", "중장기 구간"]);
  return {title, caption: "우상향 곡선에서 시간이 지나 잔존만기가 줄면 적용 수익률이 내려가 가격이 오른다. 곡선이 가파른 단기 구간에서 생기면 숄더 효과, 중장기 구간에서 생기면 롤링 효과다.", svg: svg(340, 226, title, s)};
})();

// ---------- 포트폴리오 ----------
const FR = {a: 100, b: 6, c: 1 / 6}; // σ² = a + (E−b)²/c (σ, E 단위 %)
const frS = E => Math.sqrt(FR.a + (E - FR.b) * (E - FR.b) / FR.c);
const PORT = {L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 30, y0: 0, y1: 18};

F["port-diversification"] = (function () {
  const title = "종목 수와 포트폴리오 위험";
  const sys = 20, sd = N => Math.sqrt(sys * sys + 1600 / N);
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 30, y0: 0, y1: 48});
  let s = axes(P, "종목 수", "포트폴리오 위험 σ(%)");
  const cv = curve(sd, 1, 30, 58);
  s += area(P.map([[1, sys], ...cv, [30, sys]]), "k-ac", 0.14);
  s += area(P.map([[0, 0], [0, sys], [30, sys], [30, 0]]), "k-wn", 0.14);
  s += line(P.L, P.sy(sys), P.R, P.sy(sys), "k-wn", sw(2));
  s += poly(P.map(cv), "k-ac", sw(3));
  s += text(P.L - 6, P.sy(sys) + 5, "20", {a: "e", c: "k-mu"});
  [1, 10, 20].forEach(v => { s += text(P.sx(v), P.B + 18, String(v), {a: "m", c: "k-mu"}); });
  s += text(P.sx(9), P.sy(36), "비체계적 위험", {c: "k-ac", b: 1}) + text(P.sx(9), P.sy(36) + 18, "종목을 늘리면 줄어든다", {c: "k-mu"});
  s += text(P.sx(15), P.sy(11), "체계적 위험(시장위험)", {a: "m", c: "k-wn", b: 1}) + text(P.sx(15), P.sy(11) + 18, "분산해도 남는다", {a: "m", c: "k-mu"});
  return {title, caption: "체계적 위험 20% 가정. 종목 수를 늘리면 개별 기업 위험(비체계적 위험)은 빠르게 줄지만 시장 전체 위험(체계적 위험)은 그대로 남는다.", svg: svg(340, 226, title, s)};
})();

function frontier(P, o = {}) {
  let s = "";
  s += poly(P.map(curve(E => frS(E), 0.5, 6, 20).map(p => [p[1], p[0]])), "k-mu", sw(2) + DASH);
  s += poly(P.map(curve(E => frS(E), 6, o.top || 16.5, 40).map(p => [p[1], p[0]])), "k-ac", sw(3));
  return s;
}
F["port-efficient-frontier"] = (function () {
  const title = "효율적 투자선과 최소분산포트폴리오";
  const P = plane(PORT);
  let s = axes(P, "위험 σ(%)", "기대수익률 E(R)(%)") + frontier(P);
  s += dot(P.sx(10), P.sy(6), "k-fg", 4.5);
  s += text(P.sx(10) + 10, P.sy(6) + 5, "최소분산포트폴리오", {b: 1});
  [[17, 8.5], [22, 10], [26, 7], [20, 4.5], [25, 12]].forEach(p => { s += dot(P.sx(p[0]), P.sy(p[1]), "k-mu", 3); });
  s += text(P.sx(29.5), P.sy(5.6), "개별 자산", {a: "e", c: "k-mu"});
  s += text(P.sx(frS(14)) - 8, P.sy(14) - 4, "효율적 투자선", {a: "e", c: "k-ac", b: 1});
  s += text(P.sx(frS(2)) + 8, P.sy(2) + 14, "비효율적 구간", {c: "k-mu"});
  return {title, caption: "같은 위험에서 기대수익률이 가장 높은 조합을 이은 선이 효율적 투자선이다. 최소분산포트폴리오 아래쪽 점선은 같은 위험에 수익이 더 낮아 고르지 않는다.", svg: svg(340, 226, title, s)};
})();

const RF = 3;
const tangency = () => { let best = null; for (let E = 6.01; E < 30; E += 0.005) { const sl = (E - RF) / frS(E); if (!best || sl > best.sl) best = {E, s: frS(E), sl}; } return best; };
F["port-cml"] = (function () {
  const title = "자본시장선(CML)";
  const M = tangency();
  const P = plane(PORT);
  let s = axes(P, "위험 σ(%)", "기대수익률 E(R)(%)") + frontier(P);
  const x2 = 29, y2 = RF + M.sl * x2;
  s += poly(P.map([[0, RF], [x2, Math.min(y2, 17.6)]].map(p => p[1] === 17.6 ? [(17.6 - RF) / M.sl, 17.6] : p)), "k-fg", sw(2.5));
  s += dot(P.sx(0), P.sy(RF), "k-fg", 4.5) + text(P.L - 6, P.sy(RF) + 5, "Rf", {a: "e", b: 1});
  s += dot(P.sx(M.s), P.sy(M.E), "k-bd", 5) + text(P.sx(M.s) + 10, P.sy(M.E) + 14, "M 시장포트폴리오", {c: "k-bd", b: 1});
  s += text(P.sx(M.s * 0.5) + 4, P.sy(RF + M.sl * M.s * 0.5) - 12, "대출 포트폴리오", {a: "e", c: "k-mu"});
  const xb = M.s + 4.5;
  s += text(P.sx(xb) - 6, P.sy(RF + M.sl * xb) - 10, "차입 포트폴리오", {a: "e", c: "k-mu"});
  s += text(P.sx(23), P.sy(RF + M.sl * 23) + 4, "CML", {b: 1});
  s += text(P.sx(29.5), P.sy(7.5), "효율적 투자선", {a: "e", c: "k-ac"});
  return {title, caption: "무위험자산(Rf)에서 효율적 투자선에 그은 접선이 CML이고 접점 M이 시장포트폴리오다. M 왼쪽은 무위험자산에 일부 빌려준(대출) 조합, 오른쪽은 빌려서 더 산(차입) 조합이다.", svg: svg(340, 226, title, s)};
})();

F["port-sml"] = (function () {
  const title = "증권시장선(SML)";
  const Rm = 9, sml = b => RF + b * (Rm - RF);
  const P = plane({L: 58, R: 318, T: 30, B: 196, x0: 0, x1: 2, y0: 0, y1: 16});
  let s = axes(P, "베타 β", "기대수익률 E(R)(%)");
  s += poly(P.map([[0, RF], [2, sml(2)]]), "k-ac", sw(3));
  s += text(P.L - 6, P.sy(RF) + 5, "Rf", {a: "e", b: 1}) + text(P.L - 6, P.sy(Rm) + 5, "E(Rm)", {a: "e", b: 1});
  s += line(P.L, P.sy(Rm), P.sx(1), P.sy(Rm), "k-ln", DOT) + line(P.sx(1), P.sy(Rm), P.sx(1), P.B, "k-ln", DOT);
  s += text(P.sx(1), P.B + 18, "1", {a: "m", c: "k-mu"});
  s += dot(P.sx(1), P.sy(Rm), "k-fg", 4.5) + text(P.sx(1) + 10, P.sy(Rm) + 18, "M", {b: 1});
  s += text(P.sx(1.95), P.sy(sml(1.95)) + 22, "SML", {a: "e", c: "k-ac", b: 1});
  s += dot(P.sx(0.7), P.sy(11), "k-ok", 5) + text(P.sx(0.7), P.sy(11) - 26, "A 과소평가", {a: "m", c: "k-ok", b: 1}) + text(P.sx(0.7), P.sy(11) - 10, "→ 매수", {a: "m", c: "k-ok"});
  s += dot(P.sx(1.5), P.sy(8), "k-bd", 5) + text(P.sx(1.5), P.sy(8) + 22, "B 과대평가", {a: "m", c: "k-bd", b: 1}) + text(P.sx(1.5), P.sy(8) + 38, "→ 매도", {a: "m", c: "k-bd"});
  return {title, caption: "SML은 E(R) = Rf + β × (E(Rm) − Rf)로, 가로축이 β다. 선보다 위에 있는 종목(A)은 위험에 비해 기대수익이 높아 과소평가, 아래(B)는 과대평가다.", svg: svg(340, 226, title, s)};
})();

F["port-correlation"] = (function () {
  const title = "상관계수에 따른 두 자산 결합선";
  const A = {s: 8, e: 5}, B = {s: 24, e: 13};
  const sd = (w, r) => Math.sqrt(w * w * A.s * A.s + (1 - w) * (1 - w) * B.s * B.s + 2 * w * (1 - w) * r * A.s * B.s);
  const pt = (w, r) => [sd(w, r), w * A.e + (1 - w) * B.e];
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 28, y0: 0, y1: 16});
  let s = axes(P, "위험 σ(%)", "기대수익률 E(R)(%)");
  const ws = curve(w => w, 0, 1, 60).map(p => p[0]);
  s += poly(P.map(ws.map(w => pt(w, 1))), "k-fg", sw(2.5));
  s += poly(P.map(ws.map(w => pt(w, 0))), "k-ac", sw(2.5));
  const w0 = B.s / (A.s + B.s);
  s += poly(P.map([pt(0, -1), pt(w0, -1), pt(1, -1)]), "k-ok", sw(2.5));
  s += dot(P.sx(A.s), P.sy(A.e), "k-fg", 4.5) + text(P.sx(A.s) + 8, P.sy(A.e) + 18, "A", {b: 1});
  s += dot(P.sx(B.s), P.sy(B.e), "k-fg", 4.5) + text(P.sx(B.s) + 8, P.sy(B.e) + 4, "B", {b: 1});
  [[5, "k-fg", "ρ = +1"], [3.2, "k-ac", "ρ = 0"], [1.4, "k-ok", "ρ = −1"]].forEach(r => { s += line(P.sx(18), P.sy(r[0]), P.sx(20.5), P.sy(r[0]), r[1], sw(2.5)) + text(P.sx(21.3), P.sy(r[0]) + 5, r[2], {c: r[1], b: 1}); });
  s += text(P.sx(0.6), P.sy(9.4), "위험 0", {c: "k-ok", b: 1});
  return {title, caption: "상관계수가 +1이면 두 자산을 섞어도 위험이 줄지 않는 직선이고, 낮을수록 선이 왼쪽으로 휜다. −1이면 비중을 맞춰 위험을 0으로 만들 수 있다.", svg: svg(340, 226, title, s)};
})();

F["port-indifference"] = (function () {
  const title = "무차별곡선과 최적 포트폴리오";
  const k = FR.c / 10, Es = FR.b + FR.c / (2 * k), ss = frS(Es), Us = Es - k * ss * ss;
  const P = plane(PORT);
  let s = axes(P, "위험 σ(%)", "기대수익률 E(R)(%)") + frontier(P);
  [[Us - 2.5, "U₁"], [Us, "U₂"], [Us + 2.5, "U₃"]].forEach(u => {
    const sMax = Math.min(30, Math.sqrt((17.6 - u[0]) / k));
    s += poly(P.map(curve(x => u[0] + k * x * x, 0, sMax, 40)), u[1] === "U₂" ? "k-wn" : "k-mu", sw(u[1] === "U₂" ? 2.5 : 1.5) + (u[1] === "U₂" ? "" : DASH));
    s += text(P.sx(sMax) + 4, P.sy(u[0] + k * sMax * sMax) + 14, u[1], {c: u[1] === "U₂" ? "k-wn" : "k-mu", b: 1});
  });
  s += dot(P.sx(ss), P.sy(Es), "k-bd", 5);
  s += text(P.sx(ss) + 10, P.sy(Es) + 20, "최적 포트폴리오", {c: "k-bd", b: 1});
  s += line(P.sx(19), P.sy(3.2), P.sx(21.5), P.sy(3.2), "k-ac", sw(3)) + text(P.sx(22.2), P.sy(3.2) + 5, "효율적 투자선", {c: "k-ac"});
  s += line(P.sx(19), P.sy(1.2), P.sx(21.5), P.sy(1.2), "k-wn", sw(2.5)) + text(P.sx(22.2), P.sy(1.2) + 5, "무차별곡선", {c: "k-wn"});
  s += text(P.sx(0.5), P.sy(16.3), "위쪽 곡선일수록 효용↑", {c: "k-mu"});
  return {title, caption: "무차별곡선은 효용이 같은 위험·수익 조합이다. 효율적 투자선과 맞닿는 점이 그 투자자의 최적 포트폴리오이고, 위험을 싫어할수록 곡선이 가팔라 접점이 왼쪽으로 간다.", svg: svg(340, 226, title, s)};
})();

F["port-cppi"] = (function () {
  const title = "CPPI: 쿠션과 위험자산 투자비중";
  const base = 200, u = 1.5; // 1원당 높이
  let s = "";
  // 왼쪽 막대: 자산 100 = 최저보장 80 + 쿠션 20
  const x1 = 40, x2 = 220, bw = 80;
  s += box(x1, base - 80 * u, bw, 80 * u, ["최저보장액", "80"], "k-mu", {op: 0.14});
  s += box(x1, base - 100 * u, bw, 20 * u, ["쿠션 20"], "k-wn", {op: 0.25});
  s += text(x1 + bw / 2, base - 100 * u - 10, "자산가치 100", {a: "m", b: 1});
  // 오른쪽 막대: 위험자산 60 + 안전자산 40
  s += box(x2, base - 40 * u, bw, 40 * u, ["안전자산", "40"], "k-ok", {op: 0.16});
  s += box(x2, base - 100 * u, bw, 60 * u, ["위험자산", "60"], "k-bd", {op: 0.16});
  s += text(x2 + bw / 2, base - 100 * u - 10, "운용 배분", {a: "m", b: 1});
  s += arrow(x1 + bw + 8, base - 90 * u, x2 - 8, base - 70 * u, "k-wn", sw(2));
  s += text(170, base - 100 * u + 16, "× 승수 3", {a: "m", c: "k-wn", b: 1});
  s += text(170, base + 24, "위험자산 투자액 = 승수 × 쿠션 = 3 × 20 = 60", {a: "m"});
  s += text(170, base + 44, "쿠션 = 자산가치 − 최저보장액", {a: "m", c: "k-mu"});
  return {title, caption: "자산 100, 최저보장액 80, 승수 3 예시. 쿠션 20의 3배인 60을 위험자산에 넣고, 자산이 줄면 쿠션이 줄어 위험자산 비중도 자동으로 줄어든다.", svg: svg(340, 256, title, s)};
})();

// ---------- 리스크 ----------
const pdf = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
F["risk-var-normal"] = (function () {
  const title = "정규분포와 VaR";
  const P = plane({L: 16, R: 324, T: 30, B: 170, x0: -4, x1: 3.2, y0: 0, y1: 0.42});
  let s = "";
  s += area(P.map([[-4, 0], ...curve(pdf, -4, -1.65, 30), [-1.65, 0]]), "k-wn", 0.3);
  s += area(P.map([[-4, 0], ...curve(pdf, -4, -2.33, 24), [-2.33, 0]]), "k-bd", 0.45);
  s += poly(P.map(curve(pdf, -4, 3.2, 80)), "k-ac", sw(3));
  s += arrow(P.L, P.B, P.R + 8, P.B, "k-fg");
  s += text(P.R + 8, P.B - 8, "손익", {a: "e", c: "k-mu"});
  s += line(P.sx(0), P.sy(pdf(0)), P.sx(0), P.B, "k-ln", DOT) + text(P.sx(0), P.B + 18, "평균 μ", {a: "m", c: "k-mu"});
  [[-1.65, "−1.65σ", "k-wn", 18], [-2.33, "−2.33σ", "k-bd", 38]].forEach(v => {
    s += line(P.sx(v[0]), P.sy(pdf(v[0])) - 4, P.sx(v[0]), P.B + v[3] - 14, v[2], sw(2));
    s += text(P.sx(v[0]), P.B + v[3], v[1], {a: "m", c: v[2], b: 1});
  });
  // 꼬리 비율 라벨 (끌어낸 선)
  s += line(P.sx(-2.0), P.sy(0.03), P.sx(-2.6), P.sy(0.17), "k-wn") + text(P.sx(-2.6), P.sy(0.17) - 6, "5%", {a: "m", c: "k-wn", b: 1});
  s += line(P.sx(-2.6), P.sy(0.006), P.sx(-3.5), P.sy(0.1), "k-bd") + text(P.sx(-3.5), P.sy(0.1) - 6, "1%", {a: "m", c: "k-bd", b: 1});
  s += text(P.sx(0.9), P.sy(0.40), "95% VaR: 1.65σ", {c: "k-wn", b: 1});
  s += text(P.sx(0.9), P.sy(0.40) + 20, "99% VaR: 2.33σ", {c: "k-bd", b: 1});
  s += text(170, 232, "VaR = 신뢰계수 × σ × 포지션 × √보유기간", {a: "m", c: "k-mu"});
  return {title, caption: "손익이 정규분포라고 보면 95% 신뢰수준에서는 평균보다 1.65σ, 99%에서는 2.33σ 아래가 최대손실(VaR) 경계다. 색칠한 꼬리가 VaR를 넘는 손실이 날 확률이다.", svg: svg(340, 244, title, s)};
})();

F["risk-credit-el"] = (function () {
  const title = "신용손실 분포: 기대손실과 예상외 손실";
  const g = x => x * Math.exp(-x); // 감마(2,1) 밀도
  const EL = 2, q = solve(x => 1 - Math.exp(-x) * (1 + x) - 0.999, 2, 20);
  const P = plane({L: 16, R: 324, T: 56, B: 176, x0: 0, x1: 11, y0: 0, y1: 0.4});
  let s = text(170, 22, "EL = PD × LGD × EAD", {a: "m", b: 1, s: 16});
  s += area(P.map([[EL, 0], ...curve(g, EL, q, 40), [q, 0]]), "k-wn", 0.2);
  s += poly(P.map(curve(g, 0, 11, 80)), "k-ac", sw(3));
  s += arrow(P.L, P.B, P.R + 8, P.B, "k-fg") + text(P.R + 8, P.B + 20, "손실", {a: "e", c: "k-mu"});
  s += line(P.sx(EL), P.T - 4, P.sx(EL), P.B, "k-fg", sw(2));
  s += line(P.sx(q), P.T - 4, P.sx(q), P.B, "k-bd", sw(2));
  s += text(P.sx(EL), P.T - 12, "기대손실 EL", {a: "m", b: 1});
  s += text(P.sx(q), P.T - 12, "99.9% 최대손실", {a: "e", c: "k-bd", b: 1});
  s += arrow(P.sx(EL), P.B + 16, P.sx(q), P.B + 16, "k-wn", sw(1.5), true);
  s += text((P.sx(EL) + P.sx(q)) / 2, P.B + 36, "예상외 손실 UL", {a: "m", c: "k-wn", b: 1});
  s += text((P.sx(EL) + P.sx(q)) / 2, P.B + 54, "자기자본으로 대비", {a: "m", c: "k-mu"});
  s += text(P.sx(EL), P.B + 54, "충당금", {a: "m", c: "k-mu"});
  return {title, caption: "부도율(PD), 부도 시 손실률(LGD), 부도 시 익스포저(EAD)를 곱한 기대손실(EL)은 평균적으로 예상되는 손실이라 충당금으로 쌓는다. EL을 넘어 신뢰수준 최대손실까지가 예상외 손실(UL)로, 자기자본으로 대비한다.", svg: svg(340, 240, title, s)};
})();

// ---------- 기술적 분석 ----------
F["ta-dow-phases"] = (function () {
  const title = "다우이론 시장 국면";
  const pth = [[0, 30], [3, 33], [6, 29], [9, 34], [12, 31], [15, 36], [20, 48], [25, 60], [30, 72], [33, 78], [36, 74], [39, 84], [42, 79], [45, 83], [48, 78], [51, 81], [54, 75], [60, 58], [66, 42], [72, 40], [75, 36], [78, 38], [81, 33], [84, 35], [90, 31]];
  const P = plane({L: 16, R: 326, T: 64, B: 210, x0: 0, x1: 90, y0: 20, y1: 90});
  const names = ["매집", "상승", "과열", "분산", "공포", "침체"];
  let s = "";
  for (let i = 1; i < 6; i++) s += line(P.sx(i * 15), P.T - 4, P.sx(i * 15), P.B, i === 3 ? "k-fg" : "k-ln", i === 3 ? "" : DOT);
  s += text(P.sx(22.5), 24, "강세시장", {a: "m", c: "k-ok", b: 1}) + text(P.sx(67.5), 24, "약세시장", {a: "m", c: "k-bd", b: 1});
  names.forEach((nm, i) => { s += text(P.sx(i * 15 + 7.5), 48, nm, {a: "m"}); });
  s += area(P.map([[0, 20], ...pth, [90, 20]]), "k-ac", 0.1);
  s += poly(P.map(pth), "k-ac", sw(2.5));
  s += line(P.L, P.B, P.R, P.B, "k-fg") + text(P.R, P.B + 20, "시간", {a: "e", c: "k-mu"});
  return {title, caption: "강세시장은 매집, 상승, 과열 국면, 약세시장은 분산, 공포, 침체 국면으로 이어진다. 전문가는 매집 국면에 사고 일반 투자자가 몰리는 과열 국면에 판다.", svg: svg(340, 236, title, s)};
})();

F["ta-elliott"] = (function () {
  const title = "엘리어트 파동";
  const pp = [[0, 20, "0"], [1, 42, "1"], [2, 31, "2"], [3, 76, "3"], [4, 62, "4"], [5, 92, "5"], [6, 68, "a"], [7, 80, "b"], [8, 46, "c"]];
  const P = plane({L: 24, R: 316, T: 52, B: 206, x0: 0, x1: 8, y0: 15, y1: 95});
  let s = "";
  s += line(P.sx(0), P.T - 22, P.sx(5), P.T - 22, "k-ok", sw(2)) + text(P.sx(2.5), P.T - 30, "상승 5파(충격파)", {a: "m", c: "k-ok", b: 1});
  s += line(P.sx(5), P.T - 22, P.sx(8), P.T - 22, "k-bd", sw(2)) + text(P.sx(6.5), P.T - 30, "하락 3파(조정파)", {a: "m", c: "k-bd", b: 1});
  s += line(P.sx(1), P.sy(42), P.sx(4.6), P.sy(42), "k-ln", DOT);
  s += poly(P.map(pp), "k-ac", sw(2.5));
  pp.forEach((p, i) => {
    const up = i === 0 ? false : (i === pp.length - 1 ? false : p[1] > pp[i - 1][1]);
    s += dot(P.sx(p[0]), P.sy(p[1]), "k-ac", 3.5) + text(P.sx(p[0]), P.sy(p[1]) + (up ? -10 : 22), p[2], {a: "m", b: 1});
  });
  s += text(P.sx(4.1), P.sy(42) + 20, "4파 저점 > 1파 고점", {a: "m", c: "k-mu"});
  return {title, caption: "상승은 1·3·5파가 추세 방향, 2·4파가 조정인 5개 파동이고 하락은 a·b·c 3개 파동이다. 3파는 가장 짧을 수 없고, 4파 저점은 1파 고점 아래로 내려가지 않는다.", svg: svg(340, 230, title, s)};
})();

function series(len, f) { const r = []; for (let t = 0; t < len; t++) r.push(f(t)); return r; }
function ma(a, k) { return a.map((_, i) => i < k - 1 ? null : a.slice(i - k + 1, i + 1).reduce((x, y) => x + y, 0) / k); }
F["ta-cross"] = (function () {
  const title = "골든크로스와 데드크로스";
  const pr = series(140, t => 100 + 14 * Math.sin(2 * Math.PI * (t - 10) / 90) + 2.2 * Math.sin(t * 0.9) + 1.4 * Math.sin(t * 2.3));
  const s5 = ma(pr, 5), s20 = ma(pr, 20), t0 = 20, t1 = 139;
  const P = plane({L: 16, R: 324, T: 70, B: 200, x0: t0, x1: t1, y0: 66, y1: 120});
  const seg = a => P.map(a.map((v, i) => [i, v]).filter(p => p[0] >= t0 && p[1] != null));
  let s = poly(seg(pr), "k-ln", sw(1.2)) + poly(seg(s20), "k-wn", sw(2.5)) + poly(seg(s5), "k-ac", sw(2.5));
  const cr = [];
  for (let i = t0 + 1; i <= t1; i++) { const a = s5[i - 1] - s20[i - 1], b = s5[i] - s20[i]; if (a * b < 0) cr.push({i: i - 1 + a / (a - b), up: b > 0}); }
  const g = cr.find(c => c.up), d = cr.find(c => !c.up && c.i > g.i);
  const at = c => { const i = Math.floor(c.i), f = c.i - i; return s20[i] + (s20[i + 1] - s20[i]) * f; };
  s += ring(P.sx(g.i), P.sy(at(g)), "k-ok", 7) + text(P.sx(g.i), P.sy(at(g)) + 30, "골든크로스", {a: "m", c: "k-ok", b: 1}) + text(P.sx(g.i), P.sy(at(g)) + 47, "매수 신호", {a: "m", c: "k-mu"});
  s += ring(P.sx(d.i), P.sy(at(d)), "k-bd", 7) + text(P.sx(d.i), P.sy(at(d)) - 30, "데드크로스", {a: "m", c: "k-bd", b: 1}) + text(P.sx(d.i), P.sy(at(d)) - 13, "매도 신호", {a: "m", c: "k-mu"});
  s += line(16, 20, 36, 20, "k-ac", sw(2.5)) + text(42, 25, "단기 이동평균(5일)", {c: "k-ac"});
  s += line(176, 20, 196, 20, "k-wn", sw(2.5)) + text(202, 25, "장기(20일)", {c: "k-wn"});
  s += line(16, 40, 36, 40, "k-ln", sw(1.2)) + text(42, 45, "주가", {c: "k-mu"});
  s += line(P.L, P.B + 8, P.R, P.B + 8, "k-fg") + text(P.R, P.B + 28, "시간", {a: "e", c: "k-mu"});
  return {title, caption: "단기 이동평균선이 장기 이동평균선을 아래에서 위로 뚫으면 골든크로스(매수 신호), 위에서 아래로 뚫으면 데드크로스(매도 신호)다.", svg: svg(340, 236, title, s), _cross: cr.length};
})();

F["ta-head-shoulders"] = (function () {
  const title = "헤드앤숄더";
  const pp = [[0, 30], [1, 58], [2, 44], [3, 82], [4, 46], [5, 60], [6, 40], [7, 24]];
  const P = plane({L: 16, R: 324, T: 40, B: 200, x0: 0, x1: 7, y0: 15, y1: 90});
  const neck = x => 44 + (46 - 44) * (x - 2) / 2;
  let s = poly(P.map([[0.6, neck(0.6)], [7, neck(7)]]), "k-bd", sw(2) + DASH);
  s += poly(P.map(pp), "k-ac", sw(2.5));
  s += text(P.sx(1), P.sy(58) - 10, "왼쪽 어깨", {a: "m", b: 1}) + text(P.sx(3), P.sy(82) - 10, "머리", {a: "m", b: 1}) + text(P.sx(5), P.sy(60) - 10, "오른쪽 어깨", {a: "m", b: 1});
  s += text(P.sx(0.6), P.sy(neck(0.6)) + 22, "목선", {c: "k-bd", b: 1});
  s += ring(P.sx(5.78), P.sy(neck(5.78)), "k-bd", 6);
  s += text(P.sx(5.4), P.sy(neck(5.4)) + 24, "목선 하향 돌파", {a: "e", c: "k-bd", b: 1});
  s += text(P.sx(5.4), P.sy(neck(5.4)) + 42, "= 매도 신호", {a: "e", c: "k-mu"});
  return {title, caption: "상승 추세 끝에 어깨·머리·어깨 세 봉우리가 생긴 뒤 두 저점을 이은 목선을 아래로 뚫으면 하락 반전 신호로 본다.", svg: svg(340, 226, title, s)};
})();

F["ta-bollinger"] = (function () {
  const title = "볼린저 밴드";
  const pr = series(120, t => 100 + 8 * Math.sin(t / 14) + (t > 60 && t < 85 ? (t - 60) * 0.5 : t >= 85 ? 12.5 - (t - 85) * 0.3 : 0) + (t > 40 && t < 60 ? 0.6 : 2.4) * Math.sin(t * 1.3) + 1.2 * Math.sin(t * 2.9));
  const m = ma(pr, 20), sd = pr.map((_, i) => { if (i < 19) return null; const a = pr.slice(i - 19, i + 1), mu = m[i]; return Math.sqrt(a.reduce((x, y) => x + (y - mu) * (y - mu), 0) / 20); });
  const t0 = 19, t1 = 119;
  const up = [], dn = [], mid = [], p = [];
  for (let i = t0; i <= t1; i += (i < t1 - 1 ? 2 : 1)) { up.push([i, m[i] + 2 * sd[i]]); dn.push([i, m[i] - 2 * sd[i]]); mid.push([i, m[i]]); p.push([i, pr[i]]); }
  const lo = Math.min(...dn.map(q => q[1])), hi = Math.max(...up.map(q => q[1]));
  const P = plane({L: 16, R: 324, T: 60, B: 206, x0: t0, x1: t1, y0: lo - 2, y1: hi + 2});
  let s = area(P.map([...up, ...dn.slice().reverse()]), "k-ac", 0.12);
  s += poly(P.map(up), "k-ac", sw(2)) + poly(P.map(dn), "k-ac", sw(2)) + poly(P.map(mid), "k-wn", sw(2) + DASH) + poly(P.map(p), "k-fg", sw(1.5));
  s += line(16, 20, 36, 20, "k-ac", sw(2)) + text(42, 25, "상·하단 밴드 = 중심선 ± 2σ", {c: "k-ac"});
  s += line(16, 42, 36, 42, "k-wn", sw(2) + DASH) + text(42, 47, "중심선(20일 이동평균)", {c: "k-wn"});
  s += line(236, 42, 256, 42, "k-fg", sw(1.5)) + text(262, 47, "주가", {c: "k-mu"});
  s += line(P.L, P.B + 6, P.R, P.B + 6, "k-fg") + text(P.R, P.B + 26, "시간", {a: "e", c: "k-mu"});
  return {title, caption: "20일 이동평균을 중심선으로 위아래 2표준편차에 밴드를 긋는다. 변동성이 커지면 폭이 넓어지고 줄면 좁아지며, 상단 근처는 과매수, 하단 근처는 과매도로 본다.", svg: svg(340, 236, title, s)};
})();

F["ta-support-resistance"] = (function () {
  const title = "지지선·저항선과 추세선";
  const pp = [[0, 46], [1, 59], [2, 42], [3, 58], [4, 41], [5, 59], [6, 70], [7, 63], [8, 82], [9, 74], [10, 94]];
  const P = plane({L: 16, R: 324, T: 20, B: 210, x0: 0, x1: 10.4, y0: 34, y1: 100});
  const tr = x => 63 + (74 - 63) * (x - 7) / 2;
  let s = line(P.sx(0), P.sy(60), P.sx(5.1), P.sy(60), "k-bd", sw(2));
  s += line(P.sx(5.1), P.sy(60), P.sx(10.4), P.sy(60), "k-ok", sw(2) + DASH);
  s += line(P.sx(0), P.sy(41), P.sx(5.1), P.sy(41), "k-ok", sw(2));
  s += poly(P.map([[5.9, tr(5.9)], [10.4, tr(10.4)]]), "k-wn", sw(2));
  s += poly(P.map(pp), "k-ac", sw(2.5));
  [[96, "k-bd", "", "저항선"], [89, "k-ok", "", "지지선"], [82, "k-ok", DASH, "뚫린 저항선 → 지지선"], [75, "k-wn", "", "상승 추세선"]].forEach(r => { s += line(P.sx(0.1), P.sy(r[0]), P.sx(0.8), P.sy(r[0]), r[1], sw(2) + r[2]) + text(P.sx(1), P.sy(r[0]) + 5, r[3], {c: r[1], b: 1}); });
  return {title, caption: "주가가 오르다 멈추는 고점들을 이은 선이 저항선, 내리다 멈추는 저점들을 이은 선이 지지선이다. 저항선을 뚫고 오르면 그 선이 다음 지지선이 되고, 오르는 저점들을 이으면 상승 추세선이 된다.", svg: svg(340, 226, title, s)};
})();

// ---------- 기업재무 ----------
F["fin-leverage"] = (function () {
  const title = "영업·재무·결합 레버리지";
  let s = "";
  s += box(4, 30, 92, 54, ["매출액", "(판매량)"]);
  s += box(124, 30, 92, 54, ["영업이익", "(EBIT)"]);
  s += box(244, 30, 92, 54, ["주당순이익", "(EPS)"]);
  s += arrow(98, 57, 122, 57, "k-fg", sw(2)) + arrow(218, 57, 242, 57, "k-fg", sw(2));
  s += text(110, 104, "DOL", {a: "m", c: "k-ac", b: 1}) + text(230, 104, "DFL", {a: "m", c: "k-ac", b: 1});
  s += text(110, 122, "고정영업비", {a: "m", c: "k-mu"}) + text(230, 122, "이자비용", {a: "m", c: "k-mu"});
  s += poly([[50, 136], [50, 146], [290, 146], [290, 136]], "k-wn", sw(2));
  s += text(170, 168, "DCL = DOL × DFL", {a: "m", c: "k-wn", b: 1});
  s += text(4, 200, "DOL = 영업이익 변화율 ÷ 매출액 변화율", {});
  s += text(4, 222, "DFL = EPS 변화율 ÷ 영업이익 변화율", {});
  s += text(4, 244, "DCL = EPS 변화율 ÷ 매출액 변화율", {});
  return {title, caption: "고정영업비가 매출 변화를 영업이익에서 키우고(DOL), 이자비용이 영업이익 변화를 EPS에서 다시 키운다(DFL). 두 배율을 곱하면 매출 변화가 EPS를 얼마나 움직이는지(DCL)가 된다.", svg: svg(340, 256, title, s)};
})();

F["fin-ddm"] = (function () {
  const title = "정률성장 배당할인모형";
  const D1 = 1000, k = 10, pr = g => D1 / ((k - g) / 100);
  const P = plane({L: 54, R: 316, T: 52, B: 196, x0: 0, x1: 10, y0: 0, y1: 60000});
  let s = axes(P, "배당성장률 g(%)", "주가 P₀(원)", {xlUp: 1});
  s += text(P.R, 22, "P₀ = D₁ ÷ (k − g)", {a: "e", b: 1, s: 16});
  const gm = k - D1 / 600;
  s += poly(P.map(curve(pr, 0, gm, 60)), "k-ac", sw(3));
  s += line(P.sx(10), P.T - 8, P.sx(10), P.B, "k-bd", DASH) + text(P.sx(10), P.B + 18, "g = k", {a: "m", c: "k-bd", b: 1});
  [[0, "1만"], [5, "2만"], [8, "5만"]].forEach(v => {
    const y = P.sy(pr(v[0]));
    s += dot(P.sx(v[0]), y, "k-fg", 4) + line(P.L, y, P.sx(v[0]), y, "k-ln", DOT) + text(P.L - 6, y + 5, v[1], {a: "e", c: "k-mu"});
    if (v[0]) s += line(P.sx(v[0]), y, P.sx(v[0]), P.B, "k-ln", DOT) + text(P.sx(v[0]), P.B + 18, v[0] + "%", {a: "m", c: "k-mu"});
  });
  s += text(P.sx(0.5), P.sy(pr(0)) - 12, "g = 0", {c: "k-mu"});
  s += text(P.sx(7.2), P.sy(40000), "g → k이면 급등", {a: "e", c: "k-bd", b: 1});
  return {title, caption: "다음 해 배당 D₁ 1,000원, 요구수익률 k 10% 예시. 성장률 g가 커질수록 주가가 빠르게 오르고 g가 k에 다가가면 끝없이 커져, 이 모형은 k > g일 때만 쓴다.", svg: svg(340, 226, title, s)};
})();

// ---------- 거시경제 ----------
F["macro-is-lm"] = (function () {
  const title = "IS-LM과 재정·통화정책";
  let s = "";
  function panel(ox, head, shift) {
    const P = plane({L: ox + 22, R: ox + 156, T: 56, B: 196, x0: 0, x1: 10, y0: 0, y1: 10});
    let r = text(ox + 89, 22, head, {a: "m", b: 1});
    r += arrow(P.L, P.B, P.R + 6, P.B, "k-fg") + arrow(P.L, P.B, P.L, P.T - 12, "k-fg");
    r += text(P.L + 6, P.T - 6, "r", {c: "k-mu"}) + text(P.R + 6, P.B + 18, "Y", {a: "e", c: "k-mu"});
    const IS = (d, x) => 8.5 - 0.8 * (x - d), LM = (d, x) => 1.5 + 0.8 * (x - d);
    const dIS = shift === "IS" ? 2.5 : 0, dLM = shift === "LM" ? 2.5 : 0;
    r += poly(P.map([[1, IS(0, 1)], [9.4, IS(0, 9.4)]]), "k-ac", sw(2.5));
    r += poly(P.map([[1, LM(0, 1)], [9.4, LM(0, 9.4)]]), "k-wn", sw(2.5));
    if (shift === "IS") r += poly(P.map([[3, IS(dIS, 3)], [10, IS(dIS, 10)]]), "k-ac", sw(2.5) + DASH);
    else r += poly(P.map([[2.6, LM(dLM, 2.6)], [10, LM(dLM, 10)]]), "k-wn", sw(2.5) + DASH);
    const e0 = (8.5 - 1.5) / 1.6, x1 = (8.5 + 0.8 * dIS - 1.5 + 0.8 * dLM) / 1.6;
    const p0 = [e0, LM(0, e0)], p1 = [x1, LM(dLM, x1)];
    r += dot(P.sx(p0[0]), P.sy(p0[1]), "k-fg", 4) + dot(P.sx(p1[0]), P.sy(p1[1]), "k-bd", 4.5);
    r += text(P.sx(p0[0]) - 10, P.sy(p0[1]) + 5, "E₀", {a: "e", b: 1}) + text(P.sx(p1[0]) - 3, P.sy(p1[1]) - 14, "E₁", {a: "m", c: "k-bd", b: 1});
    r += text(P.sx(1), P.sy(IS(0, 1)) - 8, "IS", {c: "k-ac", b: 1}) + text(P.sx(9.4), P.sy(LM(0, 9.4)) - 8, "LM", {a: "m", c: "k-wn", b: 1});
    if (shift === "IS") r += text(P.sx(10), P.sy(IS(dIS, 10)) + 22, "IS′", {a: "e", c: "k-ac", b: 1});
    else r += text(P.sx(10), P.sy(LM(dLM, 10)) + 22, "LM′", {a: "e", c: "k-wn", b: 1});
    r += text(ox + 89, 40, shift === "IS" ? "Y 증가, r 상승" : "Y 증가, r 하락", {a: "m", c: "k-mu"});
    return r;
  }
  s += panel(2, "재정정책 확대", "IS") + panel(172, "통화정책 확대", "LM");
  return {title, caption: "정부지출을 늘리면 IS가 오른쪽으로 이동해 소득과 금리가 함께 오른다(구축효과의 원인). 통화량을 늘리면 LM이 오른쪽으로 이동해 소득은 늘고 금리는 내린다.", svg: svg(340, 226, title, s)};
})();

F["macro-ad-as"] = (function () {
  const title = "총수요·총공급";
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 10, y0: 0, y1: 10});
  let s = axes(P, "실질 GDP Y", "물가 P");
  const AD = (d, x) => 8.4 - 0.75 * (x - d), AS = x => 1.6 + 0.6 * x;
  s += poly(P.map([[1.2, AD(0, 1.2)], [9.4, AD(0, 9.4)]]), "k-ac", sw(2.5));
  s += poly(P.map([[3.2, AD(2.2, 3.2)], [10, AD(2.2, 10)]]), "k-ac", sw(2.5) + DASH);
  s += poly(P.map([[0.6, AS(0.6)], [10, AS(10)]]), "k-wn", sw(2.5));
  const Yf = (8.4 - 1.6) / 1.35;
  s += line(P.sx(Yf), P.T, P.sx(Yf), P.B, "k-fg", sw(2.5));
  s += text(P.sx(Yf), P.T - 6, "LRAS", {a: "m", b: 1}) + text(P.sx(Yf), P.B + 18, "잠재 GDP", {a: "m", c: "k-mu"});
  const y1 = (8.4 + 0.75 * 2.2 - 1.6) / 1.35;
  s += dot(P.sx(Yf), P.sy(AS(Yf)), "k-fg", 4) + text(P.sx(Yf) - 10, P.sy(AS(Yf)) + 5, "E₀", {a: "e", b: 1});
  s += dot(P.sx(y1), P.sy(AS(y1)), "k-bd", 4.5) + text(P.sx(y1) + 2, P.sy(AS(y1)) - 12, "E₁", {a: "e", c: "k-bd", b: 1});
  s += text(P.sx(1.2), P.sy(AD(0, 1.2)) - 8, "AD", {c: "k-ac", b: 1}) + text(P.sx(10), P.sy(AD(2.2, 10)) + 22, "AD′", {a: "e", c: "k-ac", b: 1});
  s += text(P.sx(10), P.sy(AS(10)) + 22, "SRAS", {a: "e", c: "k-wn", b: 1});
  return {title, caption: "총수요(AD)가 늘어 오른쪽으로 이동하면 단기에는 우상향하는 단기총공급(SRAS)을 따라 생산과 물가가 함께 오른다. 장기총공급(LRAS)은 잠재 GDP에서 수직이다.", svg: svg(340, 226, title, s)};
})();

F["macro-phillips"] = (function () {
  const title = "필립스곡선";
  const un = 5, pc = (pe, u) => pe + 14 / u - 14 / un;
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 10, y0: 0, y1: 10});
  let s = axes(P, "실업률 u(%)", "인플레이션 π(%)");
  s += poly(P.map(curve(u => pc(2, u), 1.9, 10)), "k-ac", sw(2.5));
  s += poly(P.map(curve(u => pc(5, u), 2.6, 10)), "k-ac", sw(2.5) + DASH);
  s += line(P.sx(un), P.T, P.sx(un), P.B, "k-wn", sw(2.5));
  s += text(P.sx(un) + 6, P.T + 6, "장기(수직)", {c: "k-wn", b: 1}) + text(P.sx(un), P.B + 18, "자연실업률", {a: "m", c: "k-mu"});
  s += line(P.sx(5.9), P.sy(8.3), P.sx(6.6), P.sy(8.3), "k-ac", sw(2.5)) + text(P.sx(6.8), P.sy(8.3) + 5, "단기(기대 π 2%)", {c: "k-ac", b: 1});
  s += line(P.sx(5.9), P.sy(7.1), P.sx(6.6), P.sy(7.1), "k-ac", sw(2.5) + DASH) + text(P.sx(6.8), P.sy(7.1) + 5, "단기(기대 π 5%)", {c: "k-ac", b: 1});
  s += arrow(P.sx(7.4), P.sy(pc(2, 7.4)) - 6, P.sx(7.4), P.sy(pc(5, 7.4)) + 8, "k-mu", sw(1.5));
  s += text(P.sx(7.6), P.sy(pc(3.5, 7.4)) + 5, "기대 상승", {c: "k-mu"});
  s += dot(P.sx(un), P.sy(2), "k-fg", 4);
  return {title, caption: "단기에는 실업률과 인플레이션이 반대로 움직이는 우하향 곡선이다. 기대인플레이션이 오르면 곡선이 위로 이동하고, 장기에는 자연실업률에서 수직이 되어 맞바꿈 관계가 사라진다.", svg: svg(340, 226, title, s)};
})();

F["macro-liquidity-trap"] = (function () {
  const title = "유동성함정";
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 10, y0: 0, y1: 10});
  let s = axes(P, "국민소득 Y", "이자율 r");
  const LM = (d, x) => x < 4 + d ? 1.5 : 1.5 + 0.12 * Math.pow(x - 4 - d, 2);
  s += poly(P.map(curve(x => LM(0, x), 0.4, 10, 60)), "k-wn", sw(2.5));
  s += poly(P.map(curve(x => LM(2, x), 0.4, 10, 60)), "k-wn", sw(2) + DASH);
  const IS = (d, x) => 6.4 - 1.6 * (x - d);
  s += poly(P.map([[1.4, IS(0, 1.4)], [4.4, IS(0, 4.4)]]), "k-ac", sw(2.5));
  s += poly(P.map([[3.6, IS(2.6, 3.6)], [7.4, IS(2.6, 7.4)]]), "k-ac", sw(2.5) + DASH);
  const e0 = (6.4 - 1.5) / 1.6, e1 = solve(x => IS(2.6, x) - LM(0, x), 4, 9);
  s += dot(P.sx(e0), P.sy(1.5), "k-fg", 4.5) + text(P.sx(e0) - 14, P.sy(1.5) + 20, "E₀", {a: "e", b: 1});
  s += dot(P.sx(e1), P.sy(LM(0, e1)), "k-bd", 4.5) + text(P.sx(e1), P.sy(LM(0, e1)) - 12, "E₁", {a: "m", c: "k-bd", b: 1});
  s += text(P.sx(1.4), P.sy(IS(0, 1.4)) - 8, "IS", {a: "m", c: "k-ac", b: 1}) + text(P.sx(3.6), P.sy(IS(2.6, 3.6)) - 8, "IS′", {a: "m", c: "k-ac", b: 1});
  s += text(P.sx(9.9), P.sy(LM(0, 9.9)) - 6, "LM", {a: "e", c: "k-wn", b: 1}) + text(P.sx(9.9), P.sy(LM(2, 9.9)) + 22, "LM′", {a: "e", c: "k-wn", b: 1});
  s += text(P.sx(0.3), P.sy(1.5) - 8, "수평 구간", {c: "k-wn", b: 1});
  s += text(P.sx(0.3), P.sy(8.9), "통화정책(LM→LM′): E₀ 그대로", {c: "k-mu"});
  s += text(P.sx(0.3), P.sy(8.9) + 19, "재정정책(IS→IS′): 소득 증가", {c: "k-mu"});
  return {title, caption: "금리가 아주 낮아 사람들이 돈을 그냥 쥐고 있으려는 구간에서는 LM이 수평이다. 여기서는 통화량을 늘려도 금리와 소득이 변하지 않아 통화정책이 효과가 없고, 재정정책이 효과적이다.", svg: svg(340, 226, title, s)};
})();

F["macro-jcurve"] = (function () {
  const title = "환율 J커브";
  const ca = t => t <= 0 ? 0 : -4 * t * Math.exp(-t / 1.5) + 0.9 * t;
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: -1.5, x1: 5.5, y0: -2.6, y1: 5.2});
  let s = axes(P, "시간", "경상수지", {ax: 0, ay: -1.5});
  s += text(P.L - 6, P.sy(0) + 5, "0", {a: "e", c: "k-mu"});
  s += poly(P.map(curve(ca, -1.5, 5.5, 70)), "k-ac", sw(3));
  s += line(P.sx(0), P.T, P.sx(0), P.B, "k-bd", DASH);
  s += text(P.sx(0) + 6, P.T + 8, "환율 상승", {c: "k-bd", b: 1}) + text(P.sx(0) + 6, P.T + 26, "(원화 약세)", {c: "k-bd"});
  const tm = solve(t => (ca(t + 1e-4) - ca(t)), 0.3, 3);
  s += text(P.sx(tm) - 10, P.sy(ca(tm)) + 24, "단기: 악화", {c: "k-bd", b: 1});
  s += text(P.sx(5.4), P.sy(1), "장기: 개선", {a: "e", c: "k-ok", b: 1});
  return {title, caption: "환율이 올라도 처음에는 수출입 물량이 바로 바뀌지 않아 수입 대금만 늘어 경상수지가 나빠진다. 시간이 지나 물량이 조정되면 개선되어 J자 모양이 된다.", svg: svg(340, 226, title, s)};
})();

// ---------- 부동산·대안투자 ----------
F["re-four-quadrant"] = (function () {
  const title = "부동산 4사분면 모형";
  const ox = 170, oy = 122;
  let s = "";
  s += arrow(ox, oy, 330, oy, "k-fg") + arrow(ox, oy, 10, oy, "k-fg") + arrow(ox, oy, ox, 12, "k-fg") + arrow(ox, oy, ox, 236, "k-fg");
  s += text(330, oy + 20, "재고", {a: "e", c: "k-mu"}) + text(10, oy + 20, "가격", {c: "k-mu"});
  s += text(ox + 8, 22, "임대료", {c: "k-mu"}) + text(ox + 8, 236, "신규건설", {c: "k-mu"});
  const R = 62, Sx = 104, Px = 112, Cy = 78;
  // 1사분면 수요곡선, 2사분면 가격=임대료÷환원율, 3사분면 건설비용, 4사분면 재고조정
  const dm = x => oy - R + (x - ox - Sx) * 0.55; // 수요곡선은 균형점(재고, 임대료)을 지난다
  s += poly([[ox + 20, dm(ox + 20)], [ox + 150, dm(ox + 150)]], "k-ac", sw(2.5));
  s += poly([[ox, oy], [ox - 150, oy - 150 * R / Px]], "k-ac", sw(2.5));
  s += poly([[ox - 46, oy], [ox - 140, oy + (140 - 46) * Cy / (Px - 46)]], "k-ac", sw(2.5));
  s += poly([[ox, oy], [ox + 150 * Sx / 150 + 40, oy + (150 * Sx / 150 + 40) * Cy / Sx]], "k-ac", sw(2.5));
  s += poly([[ox + Sx, oy - R], [ox - Px, oy - R], [ox - Px, oy + Cy], [ox + Sx, oy + Cy], [ox + Sx, oy - R]], "k-wn", sw(1.5) + DASH);
  [[ox + Sx, oy - R], [ox - Px, oy - R], [ox - Px, oy + Cy], [ox + Sx, oy + Cy]].forEach(p => { s += dot(p[0], p[1], "k-wn", 3.5); });
  s += text(ox + 14, oy - 12, "1 임대시장", {b: 1}) + text(ox - 108, oy - 4, "2 자산시장", {b: 1});
  s += text(ox - 6, oy + 53, "3 건설시장", {a: "e", b: 1}) + text(ox + 32, oy + 20, "4 재고조정", {b: 1});
  s += text(334, oy - 70, "수요", {a: "e", c: "k-ac"}) + text(14, oy - 48, "환원율", {c: "k-ac"});
  s += text(40, 236, "건설비용", {c: "k-ac"}) + text(334, oy + 96, "멸실률", {a: "e", c: "k-ac"});
  return {title, caption: "1사분면에서 재고와 수요로 임대료가 정해지고, 2사분면에서 임대료를 환원율로 나눠 가격이 된다. 3사분면에서 가격이 신규건설량을, 4사분면에서 건설량과 멸실이 다음 재고를 정해 사각형이 닫히면 균형이다.", svg: svg(340, 244, title, s)};
})();

F["alt-pe-jcurve"] = (function () {
  const title = "PE 펀드 J커브";
  const f = t => -40 * t * Math.exp(-t / 3) + 5 * t;
  const P = plane({L: 46, R: 318, T: 30, B: 196, x0: 0, x1: 10, y0: -46, y1: 40});
  let s = axes(P, "펀드 연차", "누적 순현금흐름", {ax: 0, xlUp: 1});
  s += text(P.L - 6, P.sy(0) + 5, "0", {a: "e", c: "k-mu"});
  const cv = curve(f, 0, 10, 60);
  s += area(P.map([[0, 0], ...cv.map(p => [p[0], Math.min(p[1], 0)]), [10, 0]]), "k-bd", 0.16);
  s += area(P.map([[0, 0], ...cv.map(p => [p[0], Math.max(p[1], 0)]), [10, 0]]), "k-ok", 0.16);
  s += poly(P.map(cv), "k-ac", sw(3));
  const be = solve(f, 4, 9);
  s += ring(P.sx(be), P.sy(0), "k-ac") + text(P.sx(be), P.sy(0) - 12, "회수 시작 약 " + Math.round(be) + "년", {a: "e", c: "k-ac", b: 1});
  [2, 4, 6, 8, 10].forEach(v => { s += text(P.sx(v), P.B + 18, String(v), {a: "m", c: "k-mu"}); });
  s += text(P.sx(0.5), P.sy(-41), "투자기간: 출자·보수로 마이너스", {c: "k-bd", b: 1});
  s += text(P.sx(7.6), P.sy(28), "회수기간: 매각·배분", {a: "e", c: "k-ok", b: 1});
  return {title, caption: "펀드 초기에는 투자금 집행과 관리보수로 현금이 빠져나가 누적 수익이 마이너스다. 투자기업을 매각해 회수가 시작되면 플러스로 돌아서 J자 모양이 된다(연차·금액은 가정).", svg: svg(340, 226, title, s)};
})();

F["alt-abs-structure"] = (function () {
  const title = "자산유동화(ABS) 구조";
  let s = "";
  s += box(4, 70, 96, 62, ["자산보유자", "(양도인)"]);
  s += box(122, 70, 96, 62, ["SPC", "(유동화회사)"], "k-wn");
  s += box(240, 50, 96, 30, ["선순위"], "k-ok", {op: 0.16});
  s += box(240, 86, 96, 30, ["중순위"], "k-ok", {op: 0.1});
  s += box(240, 122, 96, 30, ["후순위"], "k-ok", {op: 0.05});
  s += text(288, 40, "투자자", {a: "m", b: 1});
  s += arrow(100, 88, 122, 88, "k-fg", sw(2)) + arrow(122, 116, 100, 116, "k-mu", sw(2));
  s += arrow(218, 88, 240, 88, "k-fg", sw(2)) + arrow(240, 116, 218, 116, "k-mu", sw(2));
  s += text(52, 156, "① 기초자산 양도", {a: "m"}) + text(52, 174, "④ 양도대금", {a: "m", c: "k-mu"});
  s += text(178, 156, "② ABS 발행", {a: "m"}) + text(178, 174, "③ 매입대금", {a: "m", c: "k-mu"});
  s += box(4, 196, 96, 44, ["신용보강"], "k-ac");
  s += arrow(100, 200, 128, 136, "k-ac", sw(2));
  s += text(110, 214, "내부: 후순위·초과담보", {c: "k-mu"}) + text(110, 232, "외부: 보증·신용공여", {c: "k-mu"});
  s += text(4, 22, "후순위가 먼저 손실을 떠안아 선순위를 보호한다", {c: "k-mu"});
  return {title, caption: "자산보유자가 대출채권 같은 자산을 SPC에 넘기면 SPC가 그 현금흐름을 담보로 ABS를 발행해 투자자에게 판다. 선후순위 구조와 외부 보증 같은 신용보강으로 선순위 증권의 신용등급을 높인다.", svg: svg(340, 248, title, s)};
})();

F["alt-trs-cds"] = (function () {
  const title = "CDS·TRS 현금흐름 구조";
  let s = "";
  s += text(4, 20, "신용부도스와프(CDS)", {b: 1});
  s += box(4, 32, 92, 56, ["보장매입자", "(위험 넘김)"]);
  s += box(244, 32, 92, 56, ["보장매도자", "(위험 떠안음)"], "k-wn");
  s += arrow(98, 50, 242, 50, "k-fg", sw(2)) + text(170, 43, "프리미엄(정기)", {a: "m"});
  s += arrow(242, 72, 98, 72, "k-bd", sw(2)) + text(170, 92, "신용사건 시 손실 보전", {a: "m", c: "k-bd"});
  s += text(4, 134, "총수익스와프(TRS)", {b: 1});
  s += box(4, 146, 92, 56, ["TRS 지급자", "(자산 보유)"]);
  s += box(244, 146, 92, 56, ["TRS 수취자", "(위험 떠안음)"], "k-wn");
  s += arrow(98, 164, 242, 164, "k-fg", sw(2)) + text(170, 157, "총수익(이자+평가손익)", {a: "m"});
  s += arrow(242, 186, 98, 186, "k-mu", sw(2)) + text(170, 206, "기준금리 + 스프레드", {a: "m", c: "k-mu"});
  s += text(170, 236, "CDS는 신용위험만, TRS는 신용·시장위험 모두 넘긴다", {a: "m", c: "k-mu"});
  return {title, caption: "CDS는 보장매입자가 프리미엄을 내고 부도 같은 신용사건이 나면 손실을 보전받는다. TRS는 기초자산의 총수익을 넘기고 고정 금리를 받아, 자산을 팔지 않고 신용위험과 시장위험을 함께 넘긴다.", svg: svg(340, 248, title, s)};
})();

// ---------- 운용성과 ----------
F["perf-sharpe-treynor"] = (function () {
  const title = "샤프지수와 트레이너지수";
  const A = {r: 11, s: 16, b: 1.0}, B = {r: 13, s: 25, b: 1.0};
  const rf = 3;
  let s = "";
  function panel(ox, head, key, xmax, xl, unit) {
    const P = plane({L: ox + 26, R: ox + 156, T: 56, B: 190, x0: 0, x1: xmax, y0: 0, y1: 16});
    let r = text(ox + 90, 22, head, {a: "m", b: 1});
    r += text(ox + 90, 40, "기울기 = (R − Rf) ÷ " + unit, {a: "m", c: "k-mu"});
    r += arrow(P.L, P.B, P.R + 6, P.B, "k-fg") + arrow(P.L, P.B, P.L, P.T - 10, "k-fg");
    r += text(P.R + 6, P.B + 20, xl, {a: "e", c: "k-mu"}) + text(P.L - 4, P.sy(rf) + 5, "Rf", {a: "e", b: 1});
    [[A, "A", "k-ac"], [B, "B", "k-wn"]].forEach(f => {
      const x = f[0][key], y = f[0].r, sl = (y - rf) / x, xe = Math.min(xmax, (16 - rf) / sl);
      r += poly(P.map([[0, rf], [xe, rf + sl * xe]]), f[2], sw(2));
      r += dot(P.sx(x), P.sy(y), f[2], 4.5);
      const other = f[1] === "A" ? B : A, steep = sl > (other.r - rf) / other[key];
      r += text(P.sx(x) + (steep ? -8 : 8), P.sy(y) + (steep ? -8 : 18), f[1] + " " + sl.toFixed(key === "s" ? 2 : 1), {a: steep ? "e" : "s", c: f[2], b: 1});
    });
    return r;
  }
  A.b = 1.0; B.b = 1.0;
  s += panel(0, "샤프지수", "s", 30, "σ", "σ");
  // 트레이너: A는 β 1.0, B는 β 1.0이면 같은 순위가 되므로 β를 다르게 둔다
  A.b = 1.0; B.b = 0.8;
  s += panel(170, "트레이너지수", "b", 1.6, "β", "β");
  s += text(170, 230, "A는 샤프, B는 트레이너 기준으로 우수", {a: "m", c: "k-mu"});
  return {title, caption: "Rf에서 펀드까지 그은 선의 기울기가 지수다. 샤프는 가로축이 총위험 σ, 트레이너는 체계적 위험 β라서, 분산이 덜 된 펀드는 두 지수의 순위가 달라질 수 있다(수치는 가정).", svg: svg(340, 240, title, s)};
})();

F["perf-style-box"] = (function () {
  const title = "스타일 박스";
  const cols = ["가치", "혼합", "성장"], rows = ["대형", "중형", "소형"];
  const x0 = 70, y0 = 64, cw = 86, ch = 54;
  let s = "";
  cols.forEach((c, i) => { s += text(x0 + cw * i + cw / 2, y0 - 12, c, {a: "m", b: 1}); });
  rows.forEach((r, j) => { s += text(x0 - 10, y0 + ch * j + ch / 2 + 5, r, {a: "e", b: 1}); });
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const hl = i === 0 && j === 0;
    s += `<rect x="${x0 + cw * i}" y="${y0 + ch * j}" width="${cw}" height="${ch}"${cl(hl ? "k-ac" : "k-ln")}${hl ? tint(0.25) : ""}/>`;
  }
  s += text(x0 + cw / 2, y0 + ch / 2 + 5, "대형 가치", {a: "m", c: "k-ac", b: 1, nh: 1});
  s += arrow(x0, y0 + ch * 3 + 18, x0 + cw * 3, y0 + ch * 3 + 18, "k-mu");
  s += text(x0 + cw * 1.5, y0 + ch * 3 + 38, "PER·PBR 높을수록 성장", {a: "m", c: "k-mu"});
  s += text(4, 22, "가로: 투자 스타일, 세로: 시가총액", {c: "k-mu"});
  return {title, caption: "가로는 가치·성장 스타일, 세로는 기업 규모로 9칸을 나눠 펀드가 어떤 주식에 주로 투자하는지 보여 준다. 예시 칸은 대형 가치주 펀드다.", svg: svg(340, 282, title, s)};
})();

// ---------- 출력 ----------
const CATALOG = ["pay-long-call", "pay-short-call", "pay-long-put", "pay-short-put", "pay-covered-call", "pay-protective-put", "pay-bull-call-spread", "pay-bear-put-spread", "pay-long-butterfly", "pay-short-butterfly", "pay-long-straddle", "pay-short-straddle", "pay-long-strangle", "pay-short-strangle", "pay-collar", "pay-futures-long-short", "pay-els-stepdown",
  "bond-price-yield", "yield-curve-shapes", "bond-duration-maturity", "bond-immunization", "bond-riding",
  "port-diversification", "port-efficient-frontier", "port-cml", "port-sml", "port-correlation", "port-indifference", "port-cppi",
  "risk-var-normal", "risk-credit-el",
  "ta-dow-phases", "ta-elliott", "ta-cross", "ta-head-shoulders", "ta-bollinger", "ta-support-resistance",
  "fin-leverage", "fin-ddm",
  "macro-is-lm", "macro-ad-as", "macro-phillips", "macro-liquidity-trap", "macro-jcurve",
  "re-four-quadrant", "alt-pe-jcurve", "alt-abs-structure", "alt-trs-cds",
  "perf-sharpe-treynor", "perf-style-box"];

function main() {
  const missing = CATALOG.filter(id => !F[id]);
  if (missing.length) throw new Error("그림 없음: " + missing.join(", "));
  const bad = /<script|\son[a-z]+=|foreignObject|href|<image|url\(/i;
  const out = {};
  let total = 0;
  CATALOG.forEach(id => {
    const f = F[id];
    if (bad.test(f.svg)) throw new Error("금지 요소: " + id);
    out[id] = {title: f.title, caption: f.caption, svg: f.svg};
    total += Buffer.byteLength(f.svg);
    if (Buffer.byteLength(f.svg) > 6144) console.warn("6KB 초과: " + id + " " + Buffer.byteLength(f.svg));
  });
  const js = "// 자동 생성 파일: node tools/figures/build.js. 직접 고치지 말 것.\n// 해설 그림. 색은 class(k-*)로 주고 tools/figures/fig.css 규칙이 CSS 변수에 연결한다.\nwindow.FIGURES = " + JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"') + ";\n";
  fs.writeFileSync(OUT, js);
  console.log("그림 " + CATALOG.length + "개, SVG 합계 " + (total / 1024).toFixed(1) + "KB, 파일 " + (Buffer.byteLength(js) / 1024).toFixed(1) + "KB");
  if (process.argv.includes("--check")) {
    Object.keys(CHECK).forEach(id => {
      const c = CHECK[id];
      console.log(id + ": 손익분기 " + (Array.isArray(c.bep) ? c.bep.join(", ") : c.bep) + " / 최대이익 " + (typeof c.maxP === "number" ? fmt(c.maxP) : c.maxP) + " / 최대손실 " + (typeof c.maxL === "number" ? fmt(c.maxL) : c.maxL));
    });
    console.log("ta-cross 교차 수: " + F["ta-cross"]._cross);
  }
}
main();
