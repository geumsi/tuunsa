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
function makeGloss(G){
  const keys = G && typeof G === "object" ? Object.keys(G).filter(k => k.trim() && G[k] && typeof G[k] === "object" &&
    [G[k].full, G[k].ko].some(x => typeof x === "string" && x.trim())) : [];
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
    const parts = [G[k].full, G[k].ko].filter(x => typeof x === "string" && x.trim()).map(x => esc(x.trim()));
    return `${m}<small class="gloss">(${parts.join(", ")})</small>`;
  });
  return {text};
}

// "· "로 시작하는 줄은 글머리표 목록, "$ "로 시작하는 줄은 공식 상자, 나머지 줄은 문단.
function rich(t, gloss){
  const g = gloss || NOGLOSS;
  return String(t || "").split("\n").reduce((acc, line) => {
    const li = /^·\s*/.test(line), last = acc[acc.length - 1];
    if(/^\$ /.test(line)) acc.push({fx:true, text:line.slice(2)});
    else if(li && last && last.ul) last.items.push(line.replace(/^·\s*/, ""));
    else if(li) acc.push({ul:true, items:[line.replace(/^·\s*/, "")]});
    else if(line.trim()) acc.push({text:line});
    return acc;
  }, []).map(b => b.fx ? `<div class="fx">${esc(b.text)}</div>`
    : b.ul ? `<ul>${b.items.map(i => `<li>${g.text(esc(i))}</li>`).join("")}</ul>`
    : `<p>${g.text(esc(b.text))}</p>`).join("");
}

// 그림 SVG는 저장소 파일이라 신뢰하지만, 넣기 전에 script·foreignObject·이벤트 속성·javascript: 링크를 걸러 낸다.
function sanitizeSvg(svg){
  let s = String(svg || "").trim();
  if(!/^<svg[\s>]/i.test(s)) return "";
  for(let prev = ""; prev !== s;){
    prev = s;
    s = s.replace(/<(script|foreignObject|iframe|embed|object)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<\/?(script|foreignObject|iframe|embed|object)\b[^>]*>/gi, "")
      .replace(/[\s/]on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
      .replace(/\s(?:xlink:)?href\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi, " ");
  }
  return s;
}
function figHtml(ids, FIG){
  if(!Array.isArray(ids) || !FIG || typeof FIG !== "object") return "";
  return ids.map(id => {
    const f = typeof id === "string" && own(FIG, id) ? FIG[id] : null;
    const svg = f && typeof f === "object" ? sanitizeSvg(f.svg) : "";
    if(!svg) return "";
    const title = typeof f.title === "string" ? f.title : "", cap = typeof f.caption === "string" ? f.caption : "";
    return `<figure class="fig"><div class="fig-svg"${title ? ` role="img" aria-label="${esc(title)}"` : ""}>${svg}</div>${title || cap ? `<figcaption>${title ? `<b>${esc(title)}</b> ` : ""}${esc(cap)}</figcaption>` : ""}</figure>`;
  }).join("");
}
// 해설 맨 앞: 개념 상자, 그 아래 그림
function conceptHtml(q, FIG, gloss){
  const c = typeof q.concept === "string" && q.concept.trim() ? `<div class="concept"><h3>개념</h3>${rich(q.concept, gloss)}</div>` : "";
  return c + figHtml(q.fig, FIG);
}
const api = {esc, rich, makeGloss, sanitizeSvg, figHtml, conceptHtml, NOGLOSS};
root.TuunsaRender = api;
if(typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
