#!/usr/bin/env node
// 정적 문제 페이지 생성기. data/*.js를 읽어 검색엔진이 읽을 수 있는 영역별·문제별 HTML과 sitemap.xml을 만든다.
// 사용: node tools/build-pages.js [--out 디렉터리] [--base 사이트 안 경로] [--hide-answer]
//   --out   출력 폴더 (기본 ./q/)
//   --base  출력 폴더가 사이트에서 놓일 경로, SITE_URL 기준 (기본 q/)
//   --hide-answer  정답·해설을 페이지에 넣지 않는다 (기본은 접힌 상태로 넣는다)
"use strict";
const fs = require("fs");
const path = require("path");
const {ROOT, SUBJECTS, loadConfig, loadData} = require("./lib");

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// JSON-LD는 script 안에 들어가므로 </script> 끊김을 막는다.
const ld = o => JSON.stringify(o).replace(/</g, "\\u003c");
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// app.js rich()와 같은 규칙: "· "로 시작하는 줄은 글머리표
const rich = t => String(t || "").split("\n").reduce((acc, line) => {
  const li = /^·\s*/.test(line), last = acc[acc.length - 1];
  if(li && last && last.ul) last.items.push(line.replace(/^·\s*/, ""));
  else if(li) acc.push({ul:true, items:[line.replace(/^·\s*/, "")]});
  else if(line.trim()) acc.push({ul:false, text:line});
  return acc;
}, []).map(b => b.ul ? `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p>${esc(b.text)}</p>`).join("");
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

function layout({title, desc, canonical, up, body, jsonld, siteUrl, ogImage}){
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="투운사 모의고사">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${up}img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}style.css">
<style>.sp{padding:18px;margin:6px 0 14px}.sp h1{font-size:1.15rem;line-height:1.55;margin:8px 0 12px}.sp ol.ch{padding-left:1.4em}.sp ol.ch li{margin:6px 0}.sp details summary{cursor:pointer;font-weight:700;margin-top:12px}.crumb{font-size:.82rem;color:var(--muted);margin:6px 0}.crumb a,.pn a{color:inherit}.pn{display:flex;justify-content:space-between;gap:8px;font-size:.88rem;margin:10px 0}.qlist{padding-left:1.4em}.qlist li{margin:6px 0}</style>
${jsonld ? `<script type="application/ld+json">${ld(jsonld)}</script>` : ""}
</head>
<body>
<div class="app">
  <header class="top"><a class="brand" href="${up}" style="text-decoration:none"><span class="brand-text"><b>투운사 모의고사</b><small>투자자산운용사 2026</small></span></a></header>
${body}
  <p class="foot">이 사이트는 개인이 만든 학습용 사이트이며 한국금융투자협회의 공식 자료가 아닙니다. 세법·규정은 바뀔 수 있으니 시험 전 <a href="https://license.kofia.or.kr" rel="noopener">금융투자협회 자격시험센터</a> 공지를 확인하세요.<br>
    <a href="${up}">문제 풀러 가기</a> · <a href="${up}privacy.html">개인정보처리방침</a> · <a href="${up}terms.html">이용약관</a></p>
</div>
</body>
</html>
`;
}

function explainHtml(q){
  const memo = Array.isArray(q.memo) && q.memo.length ? `<div class="memo"><h3>암기</h3><ul>${q.memo.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>` : "";
  const c = q.calc ? `<div class="calc"><h3>계산기 꿀팁</h3>${q.calc.formula ? `<p class="formula">${esc(q.calc.formula)}</p>` : ""}${Array.isArray(q.calc.steps) && q.calc.steps.length ? `<h4>일반 계산기</h4><ol class="keys">${q.calc.steps.map(t => `<li>${kbd(t)}</li>`).join("")}</ol>` : ""}${q.calc.sci ? `<h4>공학용 계산기</h4><p class="keys1">${kbd(q.calc.sci)}</p>` : ""}${q.calc.tip ? `<p class="tip"><b>꿀팁</b> ${kbd(q.calc.tip)}</p>` : ""}</div>` : "";
  const cs = q.case && q.case.text ? `<div class="case ${q.case.type === "real" ? "real" : "ex"}"><p class="case-h"><span class="case-tag">${q.case.type === "real" ? `실제 사례${q.case.year ? ` · ${esc(q.case.year)}` : ""}` : "가상 사례"}</span>${q.case.title ? `<b>${esc(q.case.title)}</b>` : ""}</p>${rich(q.case.text)}${q.case.type === "real" && /^https:\/\//.test(q.case.src || "") ? `<a class="case-src" href="${esc(q.case.src)}" rel="noopener nofollow">출처: ${esc(q.case.srcName || q.case.src.replace(/^https:\/\/(www\.)?/, "").split("/")[0])}</a>` : ""}</div>` : "";
  const pr = q.practice || cs ? `<div class="practice"><h3>실무에서는</h3>${rich(q.practice)}${cs}</div>` : "";
  const notes = q.type === "mc" && Array.isArray(q.choiceNotes) ? `<div class="cnotes"><h3>보기별 해설</h3>${q.choices.map((ch, k) => {
    const n = q.choiceNotes[k] || {}, row = (l, t) => t ? `<div class="crow"><b>${l}</b><div>${rich(t)}</div></div>` : "";
    return `<div class="cnote${k === q.answer ? " ans" : ""}"><div class="chead"><span class="n">${k + 1}</span><span class="ctext">${esc(ch)}</span>${k === q.answer ? `<span class="ctag good">정답</span>` : ""}</div>${row("용어", n.term)}${row("이론", n.theory)}${row("실무", n.practice)}</div>`;
  }).join("")}</div>` : "";
  return `<div class="explain"><p><b>정답 ${esc(ansText(q))}</b></p><h3>해설</h3>${rich(q.explain)}${memo}${c}${pr}${notes}${q.ref ? `<div class="ref">정리노트 · ${esc(q.ref)}</div>` : ""}</div>`;
}

function questionPage(ctx, area, q, i){
  const {site, opt} = ctx, qs = area.questions, up = "../" + "../".repeat(opt.base.split("/").filter(Boolean).length);
  const url = `${site}${opt.base}${area.id}/${slug(area, q)}.html`;
  const prev = qs[i - 1], next = qs[i + 1];
  const title = `${cut(q.q, 48)} | ${area.title} | 투운사 모의고사`;
  const desc = cut(`투자자산운용사 ${area.title} 문제. ${q.q}${opt.hideAnswer ? "" : " 정답과 보기별 해설."}`, 155);
  const choices = q.type === "mc" ? `<ol class="ch">${q.choices.map(c => `<li>${esc(c)}</li>`).join("")}</ol>` : `<p class="muted small">O·X 문제: 맞으면 O, 틀리면 X</p>`;
  const answer = opt.hideAnswer ? "" : `<details><summary>정답과 해설 보기</summary>${explainHtml(q)}</details>`;
  const question = {"@type":"Question", "name":cut(q.q, 110), "text":q.q,
    "eduQuestionType": q.type === "mc" ? "Multiple choice" : "True/False"};
  if(!opt.hideAnswer) question.acceptedAnswer = {"@type":"Answer", "text": ansText(q)};
  const jsonld = {"@context":"https://schema.org", "@type":"Quiz", "name":`${area.title} ${i + 1}번 문제`,
    "inLanguage":"ko", "url":url, "about":{"@type":"Thing","name":area.title},
    "educationalAlignment":{"@type":"AlignmentObject","alignmentType":"educationalSubject","targetName":"투자자산운용사"},
    "hasPart":[question]};
  const body = `  <nav class="crumb" aria-label="위치"><a href="${up}">투운사 모의고사</a> › <a href="../">문제 모음</a> › <a href="./">${esc(area.title)}</a></nav>
  <main class="card sp qcard">
    <span class="tag">${esc(area.title)} · ${i + 1}/${qs.length}</span>${q.calc ? ` <span class="tag">계산</span>` : ""}
    <h1>${esc(q.q)}</h1>
    ${choices}
    ${answer}
    <p style="margin-top:16px"><a class="btn primary block" href="${up}#q=${encodeURIComponent(q.id)}">사이트에서 풀어보기</a></p>
  </main>
  <nav class="pn" aria-label="이전·다음 문제">${prev ? `<a href="${slug(area, prev)}.html" rel="prev">← 이전 문제</a>` : "<span></span>"}<a href="./">${esc(area.title)} 목록</a>${next ? `<a href="${slug(area, next)}.html" rel="next">다음 문제 →</a>` : "<span></span>"}</nav>`;
  return {url, html: layout({title, desc, canonical:url, up, body, jsonld, ogImage: site + "img/og.png"})};
}

function areaPage(ctx, area){
  const {site, opt} = ctx, up = "../" + "../".repeat(opt.base.split("/").filter(Boolean).length);
  const url = `${site}${opt.base}${area.id}/`;
  const subj = SUBJECTS.find(s => s.n === area.subject);
  const body = `  <nav class="crumb" aria-label="위치"><a href="${up}">투운사 모의고사</a> › <a href="../">문제 모음</a></nav>
  <main class="card sp">
    <h1>${esc(area.title)} 문제 ${area.questions.length}개</h1>
    <p class="muted small">${subj ? esc(`${subj.name} ${subj.full}`) : ""}${area.examCount ? ` · 실제 시험 ${area.examCount}문항` : ""}</p>
    <ol class="qlist">${area.questions.map(q => `<li><a href="${slug(area, q)}.html">${esc(cut(q.q, 80))}</a></li>`).join("")}</ol>
  </main>`;
  return {url, html: layout({title:`${area.title} 문제 모음 | 투운사 모의고사`, desc:cut(`투자자산운용사 ${area.title} 문제 ${area.questions.length}개와 정답·해설.`, 155), canonical:url, up, body, ogImage: site + "img/og.png"})};
}

function indexPage(ctx, areas){
  const {site, opt} = ctx, up = "../".repeat(opt.base.split("/").filter(Boolean).length) || "./";
  const url = site + opt.base;
  const total = areas.reduce((n, a) => n + a.questions.length, 0);
  const body = `  <main class="card sp">
    <h1>투자자산운용사 문제 모음 ${total}개</h1>
    ${SUBJECTS.slice().sort((a, b) => (a.n || 9) - (b.n || 9)).map(s => {
      const list = areas.filter(a => a.subject === s.n);
      return list.length ? `<h2>${esc(s.name === "2026" ? s.full : `${s.name} ${s.full}`)}</h2><ul class="qlist">${list.map(a => `<li><a href="${a.id}/">${esc(a.title)}</a> <span class="muted small">${a.questions.length}문제</span></li>`).join("")}</ul>` : "";
    }).join("")}
    <p><a class="btn primary block" href="${up}">사이트에서 풀어보기</a></p>
  </main>`;
  return {url, html: layout({title:"투자자산운용사 문제 모음 | 투운사 모의고사", desc:`투자자산운용사 과목·영역별 문제 ${total}개와 정답·보기별 해설.`, canonical:url, up, body, ogImage: site + "img/og.png"})};
}

function sitemap(urls){
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

// 파일을 쓰지 않고 {상대경로: 내용}을 만든다. 테스트에서 그대로 쓴다.
function build(areas, cfg, opt){
  const ctx = {site: cfg.SITE_URL, opt}, files = {}, urls = [cfg.SITE_URL];
  const ids = new Set();
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
  const files = build(loadData(), loadConfig(), opt);
  let bytes = 0;
  Object.keys(files).forEach(rel => {
    const p = path.join(opt.out, rel);
    fs.mkdirSync(path.dirname(p), {recursive:true});
    fs.writeFileSync(p, files[rel]);
    bytes += Buffer.byteLength(files[rel]);
  });
  const html = Object.keys(files).filter(f => f.endsWith(".html")).length;
  console.log(`출력: ${opt.out}\nHTML ${html}개, sitemap URL ${files["sitemap.xml"].split("<url>").length - 1}개, 합계 ${(bytes / 1024 / 1024).toFixed(2)}MB`);
}

module.exports = {build, parseArgs, slug, esc};
if(require.main === module) main();
