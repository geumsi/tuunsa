#!/usr/bin/env node
// 정적 문제 페이지 생성기. data/*.js를 읽어 검색엔진이 읽을 수 있는 영역별·문제별 HTML과 sitemap.xml을 만든다.
// 사용: node tools/build-pages.js [--out 디렉터리] [--base 사이트 안 경로] [--hide-answer]
//   --out   출력 폴더 (기본 ./q/)
//   --base  출력 폴더가 사이트에서 놓일 경로, SITE_URL 기준 (기본 q/)
//   --hide-answer  정답·해설을 페이지에 넣지 않는다 (기본은 접힌 상태로 넣는다)
"use strict";
const fs = require("fs");
const path = require("path");
const {ROOT, SUBJECTS, loadConfig, loadData, loadExtras} = require("./lib");
const SITE = require("../site.js");
const R = require("../render.js");

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// JSON-LD는 script 안에 들어가므로 </script> 끊김을 막는다.
const ld = o => JSON.stringify(o).replace(/</g, "\\u003c");
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// 해설 글: 앱과 같은 render.js 규칙("· " 글머리표, "$ " 공식 줄, 용어집 풀이)
const rich = (t, g, v) => R.rich(t, g, v);
const kbd = s => esc(s).replace(/`([^`]+)`/g, "<kbd>$1</kbd>");

function parseArgs(argv){
  const o = {out: path.join(ROOT, "q"), base: "q/", hideAnswer: false};
  for(let i = 0; i < argv.length; i++){
    const a = argv[i];
    if(a === "--out") o.out = path.resolve(argv[++i]);
    else if(a === "--base") o.base = argv[++i];
    else if(a === "--hide-answer") o.hideAnswer = true;
    else throw new Error("알 수 없는 옵션: " + a);
  }
  o.base = o.base.replace(/^\/+/, "");
  if(o.base && !o.base.endsWith("/")) o.base += "/";
  if(!/^[A-Za-z0-9_\-/]*$/.test(o.base) || o.base.includes("..")) throw new Error("--base는 영문·숫자·_-/만: " + o.base);
  return o;
}

// 문제 id에서 영역 접두어를 뗀 파일 이름. s1_tax_001 → 001, s3_bond_c01 → c01
const slug = (area, q) => q.id.startsWith(area.id + "_") ? q.id.slice(area.id.length + 1) : q.id;
const ansText = q => q.type === "ox" ? (q.answer ? "O (맞다)" : "X (틀리다)") : `${q.answer + 1}번 ${q.choices[q.answer]}`;

const subjLabel = n => { const s = SUBJECTS.find(x => x.n === n); return s ? (s.n ? s.name : s.full) : ""; };
const upOf = (opt, depth) => "../".repeat(opt.base.split("/").filter(Boolean).length + depth) || "./";
const PAGE_CSS = `.sp{padding:18px;margin:6px 0 14px}.sp h1{font-size:1.15rem;line-height:1.55;margin:8px 0 12px}.notice{font-size:.8rem;color:var(--muted);margin:0 0 6px}`
  + `.sp ol.ch{list-style:none;counter-reset:c;padding:0;margin:0;display:grid;gap:8px}.sp ol.ch li{counter-increment:c;display:flex;gap:10px;padding:12px 14px;border-radius:12px;background:var(--surface2)}.sp ol.ch li::before{content:counter(c);flex:none;font-weight:800;color:var(--muted)}`
  + `.sp details summary{cursor:pointer;font-weight:700;min-height:48px;display:flex;align-items:center;margin-top:12px}.crumb{font-size:.82rem;color:var(--muted);margin:6px 0}.crumb a,.pn a,.fix a{color:inherit;display:inline-block;padding:10px 0}`
  + `.pgad{margin-top:24px}.more{margin-top:40px}.more h2{font-size:1rem;margin:0 0 6px}.pn{display:flex;justify-content:space-between;gap:8px;font-size:.88rem;margin:10px 0}.qlist{padding-left:1.4em}.qlist li{margin:6px 0}.fix{font-size:.78rem;color:var(--muted);margin:8px 0 0}`;

// 업무모드면 data-work를 붙이고(색만 바뀜), 광고는 아래 슬롯 스크립트가 아예 그리지 않는다.
const WORK_JS = `<script>try{if(JSON.parse(localStorage.getItem("tuunsa-work")))document.documentElement.setAttribute("data-work","")}catch(e){}</script>`;
// 광고 슬롯 "page": config.js가 켜져 있고 업무모드가 아닐 때만 ads.js로 그린다. CSS로 숨기지 않는다.
const adJs = up => `<script src="${up}ads.js"></script>
<script>(function(){var A=window.TuunsaAds,C=window.SITE_CONFIG,el=document.getElementById("adPage"),w=false;try{w=!!JSON.parse(localStorage.getItem("tuunsa-work"))}catch(e){}
if(!A||!C||!el)return;var st={work:w,cover:false};el.innerHTML=A.html(C,"page",st);A.fill(el,C,st)})();</script>`;

function layout(cfg, {title, desc, canonical, up, body, jsonld, ad}){
  const name = SITE.name(cfg);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${SITE.CSP_META}
${SITE.FRAME_HEAD}
${WORK_JS}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(SITE.owner(cfg))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(cfg.SITE_URL + "img/og.png")}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${up}img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}style.css">
<style>${PAGE_CSS}</style>
${jsonld ? `<script type="application/ld+json">${ld(jsonld)}</script>` : ""}
</head>
<body>
<div class="app">
  <header class="top"><a class="brand" href="${up}" style="text-decoration:none"><span class="brand-text"><b>${esc(name)}</b><small>투자자산운용사 2026</small></span></a></header>
${body}
  <footer class="sitefoot">${SITE.footerHtml(cfg, up)}</footer>
</div>
<script src="${up}config.js"></script>
<script src="${up}site.js"></script>
${ad ? adJs(up) + "\n" : ""}</body>
</html>
`;
}

// 앱과 같은 순서(개념·그림, 해설, 암기, 계산기, 실무, 사례, 보기별 해설)로 그리고, 용어집 풀이도 이 순서로 처음 나온 약어에만 붙인다.
function explainHtml(cfg, q, url, extras, areaId){
  // 용어집 풀이는 처음 나온 곳에만 붙으므로 화면 순서대로 만든다. 변수 풀이(vars)는 섹션마다 따로 센다.
  const x = extras || {}, X = R.makeVars(q.vars), g = R.makeGloss(x.GLOSSARY, q.area || areaId, X.keys);
  const head = R.conceptHtml(q, x.FIGURES, g);
  const ex = rich(q.explain, g, X.section());
  const vm = X.section();
  const memo = Array.isArray(q.memo) && q.memo.length ? `<div class="memo"><h3>암기</h3><ul>${q.memo.map(m => `<li>${g.text(esc(m))}${vm.line(m)}</li>`).join("")}</ul></div>` : "";
  const vc = X.section();
  const c = q.calc ? `<div class="calc"><h3>계산기 꿀팁</h3>${q.calc.formula ? `<p class="formula">${esc(q.calc.formula)}</p>${vc.line(q.calc.formula)}` : ""}${Array.isArray(q.calc.steps) && q.calc.steps.length ? `<h4>일반 계산기</h4><ol class="keys">${q.calc.steps.map(t => `<li>${kbd(t)}${vc.line(t)}</li>`).join("")}</ol>` : ""}${q.calc.sci ? `<h4>공학용 계산기</h4><p class="keys1">${kbd(q.calc.sci)}</p>${vc.line(q.calc.sci)}` : ""}${q.calc.tip ? `<p class="tip"><b>꿀팁</b> ${kbd(q.calc.tip)}</p>${vc.line(q.calc.tip)}` : ""}</div>` : "";
  const prText = rich(q.practice, g, X.section());
  const real = q.case && q.case.type === "real";
  const cs = q.case && q.case.text ? `<div class="case ${real ? "real" : "ex"}"><p class="case-h"><span class="case-tag">${real ? `실제 사례${q.case.year ? ` · ${esc(q.case.year)}` : ""}` : "가상 사례"}</span>${q.case.title ? `<b>${esc(q.case.title)}</b>` : ""}</p>${rich(q.case.text, g, X.section())}${real && /^https:\/\//.test(q.case.src || "") ? `<a class="case-src" href="${esc(q.case.src)}" rel="noopener nofollow">출처: ${esc(q.case.srcName || q.case.src.replace(/^https:\/\/(www\.)?/, "").split("/")[0])}</a>` : ""}${real ? `<p class="case-note">${SITE.caseNote(cfg, q.case, `${url} · 사례 「${q.case.title || ""}」`)}</p>` : ""}</div>` : "";
  const pr = q.practice || cs ? `<div class="practice"><h3>실무에서는</h3>${prText}${cs}</div>` : "";
  const notes = q.type === "mc" && Array.isArray(q.choiceNotes) ? `<div class="cnotes"><h3>보기별 해설</h3>${q.choices.map((ch, k) => {
    const n = q.choiceNotes[k] || {}, v = X.section(), row = (l, t) => t ? `<div class="crow"><b>${l}</b><div>${rich(t, g, v)}</div></div>` : "";
    return `<div class="cnote${k === q.answer ? " ans" : ""}"><div class="chead"><span class="n">${k + 1}</span><span class="ctext">${esc(ch)}</span>${k === q.answer ? `<span class="ctag good">정답</span>` : ""}</div>${v.line(ch)}${row("용어", n.term)}${row("이론", n.theory)}${row("실무", n.practice)}</div>`;
  }).join("")}</div>` : "";
  return `<div class="explain"><p><b>정답 ${esc(ansText(q))}</b></p>${head}<h3>해설</h3>${ex}${memo}${c}${pr}${notes}${q.ref ? `<div class="ref">참고 단원 · ${esc(q.ref)}</div>` : ""}</div>`;
}
// 실명 사례가 있는 페이지는 title·description·og에 회사명을 넣지 않는다(법률팀 R12). 사례 본문은 그대로 둔다.
// 회사명을 따로 표시한 데이터가 없으므로, 사례 제목의 낱말(2자 이상)이 문제 글에 하나라도 있으면 문제 글 대신 영역명으로 메타를 만든다.
const caseWords = q => String(q.case && q.case.title || "").split(/[\s·,()\[\]「」『』:\/<>"'-]+/).filter(t => t.length >= 2);
const metaSafeQ = q => !(q.case && q.case.type === "real") || !caseWords(q).some(t => q.q.includes(t));
// 해설 첫 문장
const firstSentence = t => String(t || "").split("\n")[0].split(/(?<=다\.)\s/)[0];

// 위계(디자인팀 3장): 빵부스러기 > 비공식 안내 > 문제 > 접힌 정답·해설 > 이 영역 이어서 풀기 > 광고 > 같은 영역 다른 문제 > 이전·다음
function questionPage(ctx, area, q, i){
  const {cfg, opt} = ctx, site = cfg.SITE_URL, qs = area.questions, up = upOf(opt, 1);
  const url = `${site}${opt.base}${area.id}/${slug(area, q)}.html`;
  const prev = qs[i - 1], next = qs[i + 1];
  const real = q.case && q.case.type === "real", safe = metaSafeQ(q);
  const title = safe ? `${cut(q.q, 40)} · ${area.title} | ${SITE.fullName(cfg)}` : `${area.title} 연습문제 ${i + 1}번 | ${SITE.fullName(cfg)}`;
  const desc = !safe ? `투자자산운용사 ${area.title} 연습문제 ${i + 1}번. 보기와 정답·해설.`
    : cut(opt.hideAnswer || real ? `투자자산운용사 ${area.title} 연습문제. ${q.q}` : firstSentence(q.explain) || q.q, 120);
  const choices = q.type === "mc" ? `<ol class="ch">${q.choices.map(c => `<li><span>${esc(c)}</span></li>`).join("")}</ol>` : `<p class="muted small">O·X 문제: 맞으면 O, 틀리면 X</p>`;
  const answer = opt.hideAnswer ? "" : `<details><summary>정답과 해설 보기</summary>${explainHtml(cfg, q, url, ctx.extras, area.id)}</details>`;
  // 같은 영역 다른 문제 5개: 이 문제 다음부터 차례로(끝이면 처음으로 돌아감)
  const more = [];
  for(let k = 1; k < qs.length && more.length < 5; k++) more.push(qs[(i + k) % qs.length]);
  const question = {"@type":"Question", "name":cut(q.q, 110), "text":q.q,
    "eduQuestionType": q.type === "mc" ? "Multiple choice" : "True/False"};
  if(!opt.hideAnswer) question.acceptedAnswer = {"@type":"Answer", "text": ansText(q)};
  const jsonld = {"@context":"https://schema.org", "@type":"Quiz", "name":`${area.title} ${i + 1}번 문제`,
    "inLanguage":"ko", "url":url, "about":{"@type":"Thing","name":area.title},
    "educationalAlignment":{"@type":"AlignmentObject","alignmentType":"educationalSubject","targetName":"투자자산운용사"},
    "hasPart":[question]};
  const body = `  <nav class="crumb" aria-label="위치"><a href="../">${esc(subjLabel(area.subject))}</a> › <a href="./">${esc(area.title)}</a></nav>
  <main class="card sp qcard">
    <p class="notice">투자자산운용사 대비 연습문제입니다. 운영자가 직접 만든 문제이며 실제 기출문제가 아닙니다.</p>
    <span class="tag">${esc(area.title)} · ${i + 1}/${qs.length}</span>${q.calc ? ` <span class="tag">계산</span>` : ""}
    <h1>${esc(q.q)}</h1>
    ${choices}
    ${answer}
    <p style="margin-top:16px"><a class="btn primary block" href="${up}#q=${encodeURIComponent(q.id)}">이 영역 이어서 풀기</a></p>
  </main>
  <div class="pgad" id="adPage"></div>
  <section class="more"><h2>같은 영역 다른 문제</h2><ul class="qlist">${more.map(m => `<li><a href="${slug(area, m)}.html">${esc(cut(m.q, 70))}</a></li>`).join("")}</ul></section>
  <nav class="pn" aria-label="이전·다음 문제">${prev ? `<a href="${slug(area, prev)}.html" rel="prev">← 이전 문제</a>` : "<span></span>"}<a href="./">${esc(area.title)} 목록</a>${next ? `<a href="${slug(area, next)}.html" rel="next">다음 문제 →</a>` : "<span></span>"}</nav>
  <p class="fix">문제나 해설이 틀렸다면: ${SITE.fixHtml(cfg, url, "정정 요청")}</p>`;
  return {url, html: layout(cfg, {title, desc, canonical:url, up, body, jsonld, ad:true})};
}

function areaPage(ctx, area){
  const {cfg, opt} = ctx, up = upOf(opt, 1);
  const url = `${cfg.SITE_URL}${opt.base}${area.id}/`;
  const subj = SUBJECTS.find(s => s.n === area.subject);
  const body = `  <nav class="crumb" aria-label="위치"><a href="${up}">${esc(SITE.name(cfg))}</a> › <a href="../">${esc(subjLabel(area.subject))}</a></nav>
  <main class="card sp">
    <h1>${esc(area.title)} 문제 ${area.questions.length}개</h1>
    <p class="muted small">${subj ? esc(`${subj.name} ${subj.full}`) : ""}${area.examCount ? ` · 실제 시험 ${area.examCount}문항` : ""}</p>
    <ol class="qlist">${area.questions.map(q => `<li><a href="${slug(area, q)}.html">${esc(cut(q.q, 80))}</a></li>`).join("")}</ol>
  </main>`;
  return {url, html: layout(cfg, {title:`${area.title} 문제 모음 | ${SITE.fullName(cfg)}`, desc:cut(`투자자산운용사 ${area.title} 연습문제 ${area.questions.length}개와 정답·해설.`, 120), canonical:url, up, body})};
}

function indexPage(ctx, areas){
  const {cfg, opt} = ctx, up = upOf(opt, 0);
  const url = cfg.SITE_URL + opt.base;
  const total = areas.reduce((n, a) => n + a.questions.length, 0);
  const body = `  <main class="card sp">
    <h1>투자자산운용사 연습문제 모음 ${total}개</h1>
    ${SUBJECTS.slice().sort((a, b) => (a.n || 9) - (b.n || 9)).map(s => {
      const list = areas.filter(a => a.subject === s.n);
      return list.length ? `<h2>${esc(s.name === "2026" ? s.full : `${s.name} ${s.full}`)}</h2><ul class="qlist">${list.map(a => `<li><a href="${esc(a.id)}/">${esc(a.title)}</a> <span class="muted small">${a.questions.length}문제</span></li>`).join("")}</ul>` : "";
    }).join("")}
    <p><a class="btn primary block" href="${up}">사이트에서 풀어보기</a></p>
  </main>`;
  return {url, html: layout(cfg, {title:`투자자산운용사 문제 모음 | ${SITE.fullName(cfg)}`, desc:`투자자산운용사 과목·영역별 연습문제 ${total}개와 정답·보기별 해설.`, canonical:url, up, body})};
}

function sitemap(urls){
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

// 파일을 쓰지 않고 {상대경로: 내용}을 만든다. 테스트에서 그대로 쓴다.
function build(areas, cfg, opt, extras){
  // sitemap은 놓이는 폴더(q/) 아래 주소만 담는다(sitemaps.org). 사이트 루트는 루트 sitemap.xml에 있다.
  const ctx = {cfg, opt, extras: extras || {}}, files = {}, urls = [];
  const ids = new Set();
  areas.forEach(a => { if(!/^[A-Za-z0-9_]+$/.test(a.id || "")) throw new Error("영역 id 형식 오류: " + a.id); });
  areas.forEach(a => a.questions.forEach(q => {
    if(ids.has(q.id)) throw new Error("문제 id 중복: " + q.id);
    if(!/^[A-Za-z0-9_]+$/.test(q.id)) throw new Error("문제 id 형식 오류: " + q.id);
    ids.add(q.id);
  }));
  const ix = indexPage(ctx, areas); files["index.html"] = ix.html; urls.push(ix.url);
  areas.forEach(a => {
    const ap = areaPage(ctx, a); files[`${a.id}/index.html`] = ap.html; urls.push(ap.url);
    a.questions.forEach((q, i) => { const p = questionPage(ctx, a, q, i); files[`${a.id}/${slug(a, q)}.html`] = p.html; urls.push(p.url); });
  });
  files["sitemap.xml"] = sitemap(urls);
  return files;
}

function main(){
  const opt = parseArgs(process.argv.slice(2));
  const files = build(loadData(), loadConfig(), opt, loadExtras());
  let bytes = 0;
  Object.keys(files).forEach(rel => {
    const p = path.join(opt.out, rel);
    if(!path.resolve(p).startsWith(path.resolve(opt.out) + path.sep)) throw new Error("출력 폴더 밖 경로: " + rel);
    fs.mkdirSync(path.dirname(p), {recursive:true});
    fs.writeFileSync(p, files[rel]);
    bytes += Buffer.byteLength(files[rel]);
  });
  const html = Object.keys(files).filter(f => f.endsWith(".html")).length;
  console.log(`출력: ${opt.out}\nHTML ${html}개, sitemap URL ${files["sitemap.xml"].split("<url>").length - 1}개, 합계 ${(bytes / 1024 / 1024).toFixed(2)}MB`);
}

module.exports = {build, parseArgs, slug, esc, metaSafeQ};
if(require.main === module) main();
