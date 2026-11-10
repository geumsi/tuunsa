// 해설 렌더링 공용 부품. 브라우저(app.js)와 정적 페이지 생성기(tools/build-pages.js)가 같이 쓴다.
// rich(): "· " 글머리표 줄과 "$ " 공식 줄, 용어집 풀이(gloss)를 처리한다.
// 그림(window.FIGURES)과 용어집(window.GLOSSARY)은 없거나 id가 없으면 조용히 건너뛴다.
(function(root){
"use strict";
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const NOGLOSS = {text: s => s};

// 용어집 풀이. 한 문제의 해설 영역에서 약어가 처음 나올 때만 뒤에 "(풀네임, 한글)"을 작게 붙인다.
// 입력은 esc를 거친 글자. 영문·숫자에 붙어 있으면(ISA 안의 IS) 매칭하지 않고, 한글이 붙은 경우(IS곡선)는 매칭한다.
// 이미 괄호로 풀어 쓴 경우(VaR(…), …(VaR))는 붙이지 않고 처음 나온 것으로 친다.
// 영역마다 뜻이 다른 약어는 {byArea: {영역id: {full, ko}}}로 받고, 문제의 영역(area)으로 고른다. 그 영역이 없으면 붙이지 않는다.
const hasText = e => !!e && typeof e === "object" && [e.full, e.ko].some(x => typeof x === "string" && x.trim());
function entryOf(G, k, area){
  const e = G[k];
  if(!e || typeof e !== "object") return null;
  if(e.byArea && typeof e.byArea === "object") return typeof area === "string" && own(e.byArea, area) && hasText(e.byArea[area]) ? e.byArea[area] : null;
  return hasText(e) ? e : null;
}
// exclude: 이 문제의 vars 키. 변수 풀이가 우선이라 용어집 풀이를 붙이지 않는다.
function makeGloss(G, area, exclude){
  const E = {}, ex = Array.isArray(exclude) ? exclude : [];
  if(G && typeof G === "object") Object.keys(G).forEach(k => { const e = k.trim() && ex.indexOf(k) < 0 ? entryOf(G, k, area) : null; if(e) E[k] = e; });
  const keys = Object.keys(E);
  if(!keys.length) return NOGLOSS;
  const byEsc = {};
  keys.forEach(k => { byEsc[esc(k)] = k; });
  const re = new RegExp(Object.keys(byEsc).sort((a, b) => b.length - a.length)
    .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const isW = c => !!c && /[A-Za-z0-9]/.test(c);
  const seen = new Set();
  const text = s => String(s).replace(re, (m, off, str) => {
    const before = str.slice(0, off), after = str.slice(off + m.length);
    if(isW(before.slice(-1)) || isW(after[0])) return m;
    if(/&[A-Za-z0-9#]*$/.test(before) && /^[A-Za-z0-9#]*;/.test(after)) return m;   // &amp; 같은 문자 참조 안
    const k = byEsc[m];
    if(seen.has(k)) return m;
    seen.add(k);
    if(/^\s?\(/.test(after) || /\(\s*$/.test(before)) return m;
    const parts = [E[k].full, E[k].ko].filter(x => typeof x === "string" && x.trim()).map(x => esc(x.trim()));
    return `${m}<small class="gloss">(${parts.join(", ")})</small>`;
  });
  return {text};
}

// 공식 줄의 변수 풀이. vars = {기호: 뜻}. 개념 칸 밖의 줄 중 공식 줄(=, ×, ÷, /, √, Σ, → 중 하나가 있고
// vars 키가 기호로 하나 이상 나오는 줄) 바로 아래에 "F: 선물 이론가격 · S: 현물가격"을 작게 붙인다.
// 기호는 줄에 처음 나오는 순서, 영문·숫자·아래첨자 경계 기준(d1·D₁ 안의 d·D, rate 안의 r은 아님, k보다의 k는 맞음), 긴 키부터 매칭.
// section()마다(해설 하나, 보기 하나 등) 이미 풀이한 기호는 다시 붙이지 않는다. vars가 없으면 아무것도 붙이지 않는다.
const FORMULA_OP = /[=×÷/√Σ→]/;
const NOVARS = {keys: [], section: () => ({line: () => ""})};
function makeVars(vars){
  const keys = vars && typeof vars === "object" && !Array.isArray(vars)
    ? Object.keys(vars).filter(k => k.trim() && typeof vars[k] === "string" && vars[k].trim()).sort((a, b) => b.length - a.length) : [];
  if(!keys.length) return NOVARS;
  // 아래첨자(₀~₉, ₐ 등)와 _는 기호의 일부로 본다(D₁ 안의 D는 D가 아님). 위첨자(², ³)는 거듭제곱이라 경계로 본다.
  const isW = c => !!c && /[A-Za-z0-9_\u2080-\u209C\u1D62-\u1D6A]/.test(c);
  const symbols = line => {
    const found = [];
    for(let i = 0; i < line.length;){
      const k = keys.find(x => line.startsWith(x, i) && !isW(line[i - 1]) && !isW(line[i + x.length]));
      if(k){ if(found.indexOf(k) < 0) found.push(k); i += k.length; } else i++;
    }
    return found;
  };
  return {keys, section(){
    const done = new Set();
    return {line(raw){
      const t = String(raw == null ? "" : raw);
      if(!FORMULA_OP.test(t)) return "";
      const left = symbols(t).filter(k => !done.has(k));
      left.forEach(k => done.add(k));
      return left.length ? `<div class="vleg">${left.map(k => `${esc(k)}: ${esc(vars[k].trim())}`).join(" · ")}</div>` : "";
    }};
  }};
}

// "· "로 시작하는 줄은 글머리표 목록, "$ "로 시작하는 줄은 공식 상자, 나머지 줄은 문단.
// v: makeVars(...).section(). 주면 공식 줄 아래에 변수 풀이를 붙인다(개념 칸에는 주지 않는다).
function rich(t, gloss, v){
  const g = gloss || NOGLOSS, leg = line => v ? v.line(line) : "";
  return String(t || "").split("\n").reduce((acc, line) => {
    const li = /^·\s*/.test(line), last = acc[acc.length - 1];
    if(/^\$ /.test(line)) acc.push({fx:true, text:line.slice(2)});
    else if(li && last && last.ul) last.items.push(line.replace(/^·\s*/, ""));
    else if(li) acc.push({ul:true, items:[line.replace(/^·\s*/, "")]});
    else if(line.trim()) acc.push({text:line});
    return acc;
  }, []).map(b => b.fx ? `<div class="fx">${esc(b.text)}</div>${leg(b.text)}`
    : b.ul ? `<ul>${b.items.map(i => `<li>${g.text(esc(i))}${leg(i)}</li>`).join("")}</ul>`
    : `<p>${g.text(esc(b.text))}</p>${leg(b.text)}`).join("");
}

// 그림 SVG는 저장소 파일이라 신뢰하지만, 허용 목록(디자인팀과 맞춘 요소·속성)에 있는 것만 남긴다.
// script·style·foreignObject 같은 요소는 내용째 지우고, 그 밖의 모르는 요소는 태그만 지운다. 주석·CDATA도 지운다.
const SVG_EL = ["svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "text", "tspan", "title"];
const SVG_ATTR = ["xmlns", "viewBox", "role", "aria-label", "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "width", "height", "rx",
  "dx", "dy", "text-anchor", "dominant-baseline", "font-size", "font-weight", "transform", "opacity", "fill-opacity",
  "stroke-dasharray", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill", "stroke", "class"];
const ATTR_BY_LOWER = {};
SVG_ATTR.forEach(a => { ATTR_BY_LOWER[a.toLowerCase()] = a; });
function cleanAttrs(raw){
  const out = [];
  String(raw).replace(/([^\s=/"'<>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g, (m, name, val) => {
    const a = ATTR_BY_LOWER[name.toLowerCase()];
    if(!a || val === undefined) return m;
    let v = val.replace(/^["']|["']$/g, "");
    if(/javascript:|url\(|expression\(|[<>]/i.test(v)) return m;
    if(a === "xmlns" && v !== "http://www.w3.org/2000/svg") return m;
    out.push(`${a}="${v.replace(/"/g, "&quot;")}"`);
    return m;
  });
  return out.length ? " " + out.join(" ") : "";
}
function sanitizeSvg(svg){
  let s = String(svg || "").trim();
  if(!/^<svg[\s>]/i.test(s)) return "";
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  for(let prev = ""; prev !== s;){ prev = s; s = s.replace(/<(script|style|foreignObject|iframe|embed|object|use|image|a)\b[\s\S]*?<\/\1\s*>/gi, ""); }
  return s.replace(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g, (m, close, name, attrs, self) => {
    if(SVG_EL.indexOf(name.toLowerCase()) < 0) return "";
    return close ? `</${name.toLowerCase()}>` : `<${name.toLowerCase()}${cleanAttrs(attrs)}${self ? "/" : ""}>`;
  }).replace(/<(?![\/A-Za-z])/g, "&lt;");
}
function figHtml(ids, FIG){
  if(!Array.isArray(ids) || !FIG || typeof FIG !== "object") return "";
  return ids.map(id => {
    const f = typeof id === "string" && own(FIG, id) ? FIG[id] : null;
    const svg = f && typeof f === "object" ? sanitizeSvg(f.svg) : "";
    if(!svg) return "";
    const title = typeof f.title === "string" ? f.title : "", cap = typeof f.caption === "string" ? f.caption : "";
    return `<figure class="figbox"><div class="fig-svg"${title ? ` role="img" aria-label="${esc(title)}"` : ""}>${svg}</div>${title || cap ? `<figcaption>${title ? `<b>${esc(title)}</b> ` : ""}${esc(cap)}</figcaption>` : ""}</figure>`;
  }).join("");
}
// 해설 맨 앞: 개념 상자, 그 아래 그림
function conceptHtml(q, FIG, gloss){
  const c = typeof q.concept === "string" && q.concept.trim() ? `<div class="concept"><h3>개념</h3>${rich(q.concept, gloss)}</div>` : "";
  return c + figHtml(q.fig, FIG);
}
const api = {esc, rich, makeVars, NOVARS, makeGloss, sanitizeSvg, figHtml, conceptHtml, NOGLOSS};
root.TuunsaRender = api;
if(typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
