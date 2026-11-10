// 사이트 이름·문의처·고지 문구와 sync-site 산출물.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const SITE = require("../site.js");
const {outputs, setUrl} = require("../tools/sync-site.js");
const {loadConfig, ROOT} = require("../tools/lib.js");

test("조사: 받침 유무", () => {
  assert.strictEqual(SITE.josa("투운사 모의고사", "은", "는"), "는");
  assert.strictEqual(SITE.josa("금융책방", "은", "는"), "은");
  assert.strictEqual(SITE.josa("ABC", "을", "를"), "를");
});
test("문의 메일은 형식이 맞을 때만 링크로 쓴다", () => {
  assert.strictEqual(SITE.contact({CONTACT:null}), "");
  assert.strictEqual(SITE.contact({CONTACT:'a@b.co"><script>'}), "");
  assert.strictEqual(SITE.contactHtml({}), "문의 메일(준비 중)");
  assert.ok(SITE.contactHtml({CONTACT:"help@example.com"}).includes('href="mailto:help@example.com"'));
});
test("사례 문구: 기준일, 정정 요청 메일 링크", () => {
  const n = SITE.caseNote({CONTACT:"help@example.com", CASES_CHECKED:"2026-11-03"}, {title:"X"}, "문제 a");
  assert.ok(n.includes("기준일 2026-11-03"));
  assert.ok(n.includes("mailto:help@example.com?subject="));
  assert.ok(!SITE.caseNote({CASES_CHECKED:"bad"}, {}).includes("기준일"));
  assert.ok(SITE.caseNote({CASES_CHECKED:"2026-11-03"}, {checked:"2027-01-02"}).includes("기준일 2027-01-02"));
});
test("커밋된 정적 파일이 config.js와 맞다 (sync-site --check와 같음)", () => {
  const out = outputs(loadConfig());
  const diff = Object.keys(out).filter(f => fs.readFileSync(path.join(ROOT, f), "utf8") !== out[f]);
  assert.deepStrictEqual(diff, []);
});
test("이름·브랜드·주소를 바꾸면 모든 산출물에 반영되고 옛 값이 남지 않는다", () => {
  const cfg = Object.assign({}, loadConfig(), {SITE_NAME:"금융책방 투운사", BRAND:"금융책방", SITE_URL:"https://example.com/", CONTACT:"help@example.com"});
  const out = outputs(cfg);
  ["index.html", "privacy.html", "terms.html", "404.html", "manifest.webmanifest", "img/og.svg"].forEach(f => {
    assert.ok(!out[f].includes("투운사 모의고사"), f + "에 옛 이름이 남음");
    assert.ok(out[f].includes("금융책방"), f + "에 새 이름이 없음");
  });
  ["index.html", "privacy.html", "terms.html", "404.html", "robots.txt", "sitemap.xml"].forEach(f => assert.ok(!out[f].includes("jeongtai.github.io"), f + "에 옛 주소가 남음"));
  assert.ok(out["index.html"].includes('"publisher":{"@type":"Organization","name":"금융책방","url":"https://example.com/"'));
  assert.ok(out["robots.txt"].indexOf("주의") < 0, "루트 도메인이면 경고 없음");
  assert.ok(out["terms.html"].includes("help@example.com"));
  assert.ok(!("CNAME" in out), "CNAME은 --cname일 때만");
});
test("광고를 켜야 개인정보처리방침에 광고 쿠키 조항이 들어간다", () => {
  const base = loadConfig();
  assert.ok(!outputs(base)["privacy.html"].includes("광고 쿠키"));
  const on = Object.assign({}, base, {ADS:{provider:"adsense", client:"ca-pub-1234567890123456", slots:{}}});
  const p = outputs(on)["privacy.html"];
  assert.ok(p.includes("광고 쿠키") && p.includes("Google AdSense") && p.includes("google.com/settings/ads"));
  assert.ok(!p.includes("{{"));
});

test("브랜드: 제목은 \"사이트 | 브랜드\", 하단 고지와 약관·처리방침의 운영 주체는 브랜드", () => {
  const cfg = Object.assign({}, loadConfig(), {SITE_NAME:"투운사 모의고사", BRAND:"금시초문", BRAND_SUB:"금융자격증 문제풀이"});
  const out = outputs(cfg);
  assert.ok(out["index.html"].includes("<title>투운사 모의고사 | 금시초문</title>"));
  assert.ok(out["index.html"].includes("금시초문은 개인이 운영하는 비공식 학습 사이트"));
  assert.ok(out["privacy.html"].includes("<h1>금시초문 개인정보처리방침</h1>"));
  assert.ok(out["privacy.html"].includes("<title>개인정보처리방침 · 투운사 모의고사 | 금시초문</title>"));
  assert.ok(out["terms.html"].includes("이 약관은 금시초문(이하"));
  assert.ok(out["terms.html"].includes(")을 이용하는"));
  assert.ok(out["tools/hub/index.html"].includes("<title>금시초문 | 금융자격증 문제풀이</title>"));
  assert.strictEqual(SITE.fullName({SITE_NAME:"A"}), "A");
});
test("허브 초안: 도메인 루트 기준 링크·robots, CNAME은 만들지 않는다", () => {
  const cfg = Object.assign({}, loadConfig(), {SITE_URL:"https://geumsi.com/tuunsa/"});
  const out = outputs(cfg);
  assert.ok(out["tools/hub/index.html"].includes('href="/tuunsa/"'));
  assert.ok(out["tools/hub/index.html"].includes('<link rel="canonical" href="https://geumsi.com/">'));
  assert.ok(out["tools/hub/robots.txt"].includes("Sitemap: https://geumsi.com/tuunsa/sitemap.xml"));
  assert.ok(!Object.keys(out).some(f => /(^|\/)CNAME$/.test(f)), "CNAME은 --cname일 때 tools/hub에만");
  assert.ok(!fs.existsSync(path.join(ROOT, "CNAME")), "저장소 루트에 CNAME이 없어야 한다");
});
test("--url: config.js의 SITE_URL만 바꾸고, 잘못된 주소는 거절", () => {
  const src = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
  const next = setUrl(src, "https://geumsi.com/tuunsa/");
  assert.ok(next.includes('SITE_URL: "https://geumsi.com/tuunsa/"'));
  assert.strictEqual(next.replace('"https://geumsi.com/tuunsa/"', '"' + loadConfig().SITE_URL + '"'), src);
  assert.throws(() => setUrl(src, "http://geumsi.com/tuunsa/"));
  assert.throws(() => setUrl(src, "https://geumsi.com/tuunsa"));
  assert.throws(() => setUrl(src, 'https://x.com/"/'));
});

test("모든 정적 페이지와 허브에 CSP 메타와 iframe 방어가 들어간다", () => {
  const out = outputs(loadConfig());
  ["index.html", "privacy.html", "terms.html", "404.html", "tools/hub/index.html"].forEach(f => {
    assert.ok(out[f].includes(SITE.CSP_META), f + " CSP");
    assert.ok(out[f].includes("window.top!==window.self"), f + " 프레임 방어");
  });
  const ix = out["index.html"];
  assert.ok(ix.indexOf('src="state.js"') > 0 && ix.indexOf('src="state.js"') < ix.indexOf('src="app.js"'));
});
test("감싸였는지 판단: 확인할 수 없으면 감싼 것으로 본다", () => {
  const T = global.top, S = global.self;
  try{
    global.self = globalThis; global.top = {}; assert.strictEqual(SITE.framed(), true);
    global.top = globalThis; assert.strictEqual(SITE.framed(), false);
    Object.defineProperty(global, "top", {configurable:true, get(){ throw new Error("cross-origin"); }});
    assert.strictEqual(SITE.framed(), true);
  } finally { Object.defineProperty(global, "top", {configurable:true, writable:true, value:T}); global.self = S; }
});

test("README 사이트 주소도 --url 값으로 바뀐다", () => {
  const out = outputs(Object.assign({}, loadConfig(), {SITE_URL:"https://geumsi.github.io/tuunsa/"}));
  assert.ok(out["README.md"].includes("<!-- site:url -->https://geumsi.github.io/tuunsa/<!-- /site:url -->"));
  assert.ok(out["tools/hub/index.html"].includes('<link rel="canonical" href="https://geumsi.github.io/">'));
});
test("앱·도구 코드와 README는 docs/를 참조하지 않는다(docs/는 비공개)", () => {
  const files = ["app.js", "ads.js", "site.js", "state.js", "config.js", "index.html", "README.md", "style.css",
    "tools/lib.js", "tools/sync-site.js", "tools/build-pages.js", "tools/templates/privacy.html", "tools/templates/terms.html",
    "tools/templates/og.svg", "tools/hub/index.html", "tools/hub/SETUP.md", "img/og.svg"];
  const bad = files.filter(f => /docs\//.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  assert.deepStrictEqual(bad, []);
});
test("허브를 개인 jeongtai.github.io로 가정한 문구가 없다", () => {
  ["tools/sync-site.js", "tools/hub/SETUP.md", "config.js"].forEach(f => {
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/허브[^\n]{0,20}jeongtai\.github\.io/.test(t), f);
  });
});
test("index.html: 그림·용어집·render.js를 app.js보다 먼저 읽는다", () => {
  const ix = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const at = f => ix.indexOf(`src="${f}"`);
  ["data/figures.js", "data/glossary.js", "render.js"].forEach(f => assert.ok(at(f) > 0 && at(f) < at("app.js"), f));
});
