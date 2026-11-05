#!/usr/bin/env node
// config.js(SITE_NAME·BRAND·SITE_URL·CONTACT·ADS)를 정적 파일에 반영한다. 이름이나 도메인이 바뀌면 이것 한 번만 돌린다.
// 만드는 것: index.html의 site:head·site:brand·site:foot 구역, privacy.html, terms.html, 404.html,
//            manifest.webmanifest, robots.txt, sitemap.xml, ads.txt, img/og.svg(+ img/og.png)
// 사용: node tools/sync-site.js [--check] [--png] [--cname]
//   --check  파일을 쓰지 않고, config와 어긋난 파일이 있으면 목록을 찍고 종료 코드 1
//   --png    img/og.svg가 그대로여도 img/og.png를 다시 뽑는다 (gstack browse 필요, 없으면 건너뜀)
//   --cname  자체 도메인일 때 GitHub Pages용 CNAME 파일을 만든다. github.io 주소나 하위 경로면 거절
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const {execFileSync} = require("child_process");
const {ROOT, loadConfig, loadData} = require("./lib");
const SITE = require("../site.js");
const esc = SITE.esc;

const DESC = "투자자산운용사 과목별 4지선다 문제, 정답 O·X 표시와 상세 해설, 실전 100문항 모의고사";
const AD_NAMES = {adsense:"Google AdSense", adfit:"카카오 애드핏"};

// {{#flag}}...{{/flag}}는 flag가 참일 때만 남기고, {{KEY}}는 vars 값(이미 HTML 안전한 값)으로 바꾼다.
function render(tpl, vars, flags){
  let s = tpl.replace(/^<!--[\s\S]*?-->\n/, "");   // 맨 앞 작성 메모 주석은 뺀다
  const block = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  for(let prev = ""; prev !== s;){ prev = s; s = s.replace(block, (_, k, body) => flags[k] ? body : ""); }
  return s.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if(!(k in vars)) throw new Error("템플릿 값 없음: " + k);
    return vars[k];
  });
}
// 시작·끝 표시 사이를 바꾼다. 표시가 없으면 오류.
function replaceBlock(s, tag, body){
  const re = new RegExp(`(<!-- site:${tag}\\b[^>]*-->)[\\s\\S]*?(<!-- /site:${tag} -->)`);
  if(!re.test(s)) throw new Error(`index.html에 site:${tag} 표시가 없습니다`);
  return s.replace(re, (_, a, b) => `${a}${body}${b}`);
}
const adsOn = cfg => !!(cfg.ADS && AD_NAMES[cfg.ADS.provider]);
const isRoot = url => new URL(url).pathname === "/";

function headHtml(cfg){
  const name = SITE.name(cfg), owner = SITE.owner(cfg), url = cfg.SITE_URL, title = `${name} · 투자자산운용사 문제와 해설`;
  const og = url + "img/og.png";
  const ld = {"@context":"https://schema.org", "@type":"WebSite", "name":name, "alternateName":"투자자산운용사 모의고사",
    "url":url, "inLanguage":"ko", "description":"투자자산운용사 과목별 문제와 보기별 해설, 실전 100문항 모의고사",
    "about":{"@type":"EducationalOccupationalCredential", "name":"투자자산운용사"}};
  if(SITE.brand(cfg)) ld.publisher = {"@type":"Organization", "name":SITE.brand(cfg)};
  return `
<meta name="apple-mobile-web-app-title" content="${esc(name)}">
<title>${esc(name)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${esc(owner)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="투자자산운용사 과목별 문제, 보기별 해설, 실전 100문항 모의고사">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="투자자산운용사 과목별 문제, 보기별 해설, 실전 100문항 모의고사">
<meta name="twitter:image" content="${esc(og)}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<script type="application/ld+json">
${JSON.stringify(ld).replace(/</g, "\\u003c")}
</script>
`;
}

// privacy·terms·404 공용 틀. up: 사이트 루트까지 경로(404는 어느 경로에서든 열리므로 절대 주소)
function page(cfg, {file, title, body, up, noindex}){
  const name = SITE.name(cfg);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- tools/sync-site.js가 만든 파일. 직접 고치지 말고 템플릿이나 config.js를 고친다 -->
<title>${esc(title)} · ${esc(name)}</title>
${noindex ? `<meta name="robots" content="noindex">\n` : `<link rel="canonical" href="${esc(cfg.SITE_URL + file)}">\n`}<link rel="icon" href="${up}img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}style.css">
</head>
<body>
<div class="app">
  <header class="top"><a class="brand" href="${up || "./"}" style="text-decoration:none"><span class="brand-text"><b>${esc(name)}</b><small>투자자산운용사 2026</small></span></a></header>
  <main class="card legal">
${body}
  </main>
  <footer class="sitefoot">${SITE.footerHtml(cfg, up)}</footer>
</div>
</body>
</html>
`;
}

function counts(){
  const areas = loadData();
  let q = 0, calc = 0, real = 0;
  areas.forEach(a => a.questions.forEach(x => { q++; if(x.calc) calc++; if(x.case && x.case.type === "real") real++; }));
  return {q, calc, real};
}
// og 이미지: 글자 폭을 대략 잡아(한글 1em, 숫자·영문 0.57em, 공백 0.3em) 칩 너비와 이름 크기를 정한다(가정값).
const textW = (t, size) => Array.from(t).reduce((w, ch) => w + size * (/[ㄱ-힝]/.test(ch) ? 1 : ch === " " ? .3 : .57), 0);
function ogSvg(cfg, n){
  const tpl = fs.readFileSync(path.join(__dirname, "templates", "og.svg"), "utf8");
  const name = SITE.name(cfg);
  const nameSize = Math.max(28, Math.min(44, Math.floor(44 * 520 / Math.max(1, textW(name, 44)))));
  let x = 90;
  const chips = [`문제 ${n.q}개`, `계산 문제 ${n.calc}개`, `실제 사례 ${n.real}건`].map(t => {
    const w = Math.round(textW(t, 22) + 40), cx = x + w / 2;
    const out = `    <rect x="${x}" y="462" width="${w}" height="46" rx="23" fill="#e7eefc"/>\n    <text x="${cx}" y="493" text-anchor="middle" fill="#2557d6">${esc(t)}</text>`;
    x += w + 14;
    return out;
  }).join("\n");
  return tpl.replace("{{NAME_SIZE}}", String(nameSize)).replace("{{NAME}}", esc(name)).replace("{{CHIPS}}", chips);
}

function outputs(cfg){
  const url = cfg.SITE_URL, name = SITE.name(cfg);
  const flags = {contact: !!SITE.contact(cfg), ads: adsOn(cfg), adsense: adsOn(cfg) && cfg.ADS.provider === "adsense", adfit: adsOn(cfg) && cfg.ADS.provider === "adfit"};
  const vars = {NAME: esc(name), NAME_EUL: SITE.josa(name, "을", "를"), OWNER: esc(SITE.owner(cfg)), URL: esc(url), CONTACT: SITE.contactHtml(cfg),
    DATE: /^\d{4}-\d{2}-\d{2}$/.test(cfg.POLICY_DATE || "") ? esc(cfg.POLICY_DATE) : "게시일(확정 전)",
    ADNAME: flags.ads ? esc(AD_NAMES[cfg.ADS.provider]) : ""};
  const tpl = f => render(fs.readFileSync(path.join(__dirname, "templates", f), "utf8"), vars, flags);
  const out = {};
  let ix = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ix = replaceBlock(ix, "head", headHtml(cfg));
  ix = replaceBlock(ix, "brand", `<b>${esc(name)}</b><small>투자자산운용사 2026</small>`);
  ix = replaceBlock(ix, "foot", SITE.footerHtml(cfg, ""));
  out["index.html"] = ix;
  out["privacy.html"] = page(cfg, {file:"privacy.html", title:"개인정보처리방침", body:tpl("privacy.html"), up:""});
  out["terms.html"] = page(cfg, {file:"terms.html", title:"이용약관", body:tpl("terms.html"), up:""});
  out["404.html"] = page(cfg, {title:"페이지를 찾을 수 없습니다", up:url, noindex:true,
    body:`    <h1>페이지를 찾을 수 없습니다</h1>\n    <p>주소가 바뀌었거나 없는 페이지입니다.</p>\n    <p><a class="btn primary" href="${esc(url)}">문제 풀러 가기</a></p>`});
  out["manifest.webmanifest"] = JSON.stringify({
    name, short_name: name, description: "투자자산운용사 과목별 문제와 해설, 실전 100문항 모의고사", lang: "ko",
    start_url: "./", scope: "./", display: "standalone", background_color: "#f6f7f9", theme_color: "#2557d6",
    icons: [{src:"img/icon-192.png", sizes:"192x192", type:"image/png"}, {src:"img/icon-512.png", sizes:"512x512", type:"image/png"}, {src:"img/icon.svg", sizes:"any", type:"image/svg+xml"}]
  }, null, 2) + "\n";
  const qSitemap = fs.existsSync(path.join(ROOT, "q", "sitemap.xml"));
  out["robots.txt"] = `${isRoot(url) ? "" : `# 주의: ${url}은 도메인 루트가 아니라서 크롤러가 이 파일을 읽지 않는다. 자체 도메인 연결 후부터 효력이 있다.\n`}User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n${qSitemap ? `Sitemap: ${url}q/sitemap.xml\n` : ""}`;
  out["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["", "privacy.html", "terms.html"].map(p => `  <url><loc>${esc(url + p)}</loc></url>`).join("\n")}\n</urlset>\n`;
  out["ads.txt"] = `# ads.txt 자리. 광고 네트워크 승인 뒤 그 네트워크가 안내하는 줄을 이 아래에 그대로 붙인다.\n# 도메인 루트(https://도메인/ads.txt)에 있어야 읽힌다.${isRoot(url) ? "" : ` 지금 주소 ${url}은 루트가 아니라서 효력이 없다.`}\n`;
  out["img/og.svg"] = ogSvg(cfg, counts());
  return out;
}

function browseBin(){
  const p = process.env.BROWSE || path.join(os.homedir(), ".claude/skills/gstack/browse/dist/browse");
  return fs.existsSync(p) ? p : "";
}
function renderPng(){
  const b = browseBin();
  if(!b){ console.log("img/og.png: gstack browse가 없어 건너뜀. img/og.svg를 1200x630 PNG로 직접 뽑아 주세요."); return; }
  execFileSync(b, ["viewport", "1200x630"], {stdio:"ignore"});
  execFileSync(b, ["goto", "file://" + path.join(ROOT, "img", "og.svg")], {stdio:"ignore"});
  execFileSync(b, ["screenshot", "--viewport", path.join(ROOT, "img", "og.png")], {stdio:"ignore"});
  console.log("img/og.png 다시 뽑음");
}

function main(){
  const args = process.argv.slice(2), check = args.includes("--check");
  const cfg = loadConfig(), out = outputs(cfg), changed = [];
  Object.keys(out).forEach(f => {
    const p = path.join(ROOT, f), cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    if(cur === out[f]) return;
    changed.push(f);
    if(!check) fs.writeFileSync(p, out[f]);
  });
  if(args.includes("--cname")){
    const u = new URL(cfg.SITE_URL);
    if(/\.github\.io$/.test(u.hostname) || u.pathname !== "/") { console.error(`CNAME 거절: ${cfg.SITE_URL}은 자체 도메인 루트가 아닙니다.`); process.exit(1); }
    if(!check) fs.writeFileSync(path.join(ROOT, "CNAME"), u.hostname + "\n");
    console.log(`CNAME: ${u.hostname}`);
  }
  if(check){
    if(changed.length){ console.log("config.js와 어긋난 파일: " + changed.join(", ") + "\nnode tools/sync-site.js를 돌리세요."); process.exit(1); }
    console.log("모든 파일이 config.js와 맞습니다."); return;
  }
  console.log(changed.length ? "다시 쓴 파일: " + changed.join(", ") : "바뀐 파일 없음");
  if(changed.includes("img/og.svg") || args.includes("--png")) renderPng();
}

module.exports = {outputs, render, replaceBlock, ogSvg};
if(require.main === module) main();
