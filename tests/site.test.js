// 사이트 이름·문의처·고지 문구와 sync-site 산출물.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const SITE = require("../site.js");
const {outputs} = require("../tools/sync-site.js");
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
  assert.ok(out["index.html"].includes('"publisher":{"@type":"Organization","name":"금융책방"}'));
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
