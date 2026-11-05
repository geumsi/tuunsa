// 정적 문제 페이지 생성기: 모든 문제가 페이지로 나오고, 이스케이프와 정답 숨김 옵션이 지켜지는지.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const {build, parseArgs} = require("../tools/build-pages.js");
const {loadData, loadConfig} = require("../tools/lib.js");

const cfg = {SITE_URL:"https://example.com/"};
const opt = o => Object.assign({base:"q/", hideAnswer:false}, o);
const area = qs => [{id:"s1_tax", subject:1, title:"세제", examCount:7, questions:qs}];
const mc = {id:"s1_tax_001", type:"mc", q:"<script>alert(1)</script> 다음 중?", choices:["가","나","다","라"], answer:2, explain:"해설\n· 항목"};

test("실제 데이터: 문제 수만큼 문제 페이지가 생긴다", () => {
  const areas = loadData();
  const files = build(areas, loadConfig(), opt());
  const nq = areas.reduce((n, a) => n + a.questions.length, 0);
  const pages = Object.keys(files).filter(f => /\/[^/]+\.html$/.test(f) && !f.endsWith("/index.html"));
  assert.strictEqual(pages.length, nq);
  assert.strictEqual(files["sitemap.xml"].split("<url>").length - 1, 1 + 1 + areas.length + nq);
});
test("문제 글은 이스케이프되고 JSON-LD에 </script>가 그대로 들어가지 않는다", () => {
  const f = build(area([mc]), cfg, opt())["s1_tax/001.html"];
  assert.ok(!f.includes("<script>alert(1)</script>"));
  assert.ok(f.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(f.includes("\\u003c/script>"));
});
test("기본은 정답을 접힌 상태로 넣고, --hide-answer면 뺀다", () => {
  const shown = build(area([mc]), cfg, opt())["s1_tax/001.html"];
  assert.ok(shown.includes("<details><summary>정답과 해설 보기</summary>"));
  assert.ok(shown.includes("정답 3번 다"));
  const hidden = build(area([mc]), cfg, opt({hideAnswer:true}))["s1_tax/001.html"];
  assert.ok(!hidden.includes("정답 3번"));
  assert.ok(!hidden.includes("acceptedAnswer"));
});
test("사이트로 돌아가는 링크와 canonical", () => {
  const f = build(area([mc]), cfg, opt())["s1_tax/001.html"];
  assert.ok(f.includes('href="../../#q=s1_tax_001"'));
  assert.ok(f.includes('<link rel="canonical" href="https://example.com/q/s1_tax/001.html">'));
});
test("id 중복·형식 오류는 막는다", () => {
  assert.throws(() => build(area([mc, mc]), cfg, opt()), /중복/);
  assert.throws(() => build(area([Object.assign({}, mc, {id:"../x"})]), cfg, opt()), /형식/);
});
test("--base에 상위 경로는 쓸 수 없다", () => {
  assert.throws(() => parseArgs(["--base", "../x"]));
  assert.strictEqual(parseArgs(["--base", "/pages"]).base, "pages/");
});
