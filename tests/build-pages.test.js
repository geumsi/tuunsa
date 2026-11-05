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
  assert.ok(f.includes('href="../../#q=s1_tax_001">이 영역 이어서 풀기'));
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

const real = Object.assign({}, mc, {id:"s1_tax_002", q:"보통 문제", explain:"A증권은 제재를 받았다. 다음 문장.", case:{type:"real", year:"2023", title:"A증권 제재", text:"요약", src:"https://example.com/n"}});
test("광고는 HTML에 박지 않고 자리와 스크립트만 둔다(업무모드면 그리지 않음)", () => {
  const f = build(area([mc]), cfg, opt())["s1_tax/001.html"];
  assert.ok(f.includes('<div class="pgad" id="adPage"></div>'));
  assert.ok(!f.includes("adsbygoogle"));
  assert.ok(f.includes('localStorage.getItem("tuunsa-work")'));
  assert.ok(f.includes('A.html(C,"page",st)'));
  assert.ok(f.indexOf('id="adPage"') > f.indexOf("이 영역 이어서 풀기"), "광고는 이어서 풀기 버튼 아래");
  assert.ok(f.indexOf('id="adPage"') < f.indexOf("같은 영역 다른 문제"));
});
test("기출이 아님 안내, 하단 고지, 사례 기준일·정정 문구", () => {
  const c2 = Object.assign({}, cfg, {CASES_CHECKED:"2026-11-03"});
  const f = build(area([mc, real]), c2, opt())["s1_tax/002.html"];
  assert.ok(f.includes("실제 기출문제가 아닙니다"));
  assert.ok(f.includes("시행기관과 관련이 없습니다"));
  assert.ok(f.includes("기준일 2026-11-03"));
  assert.ok(f.includes("정정 요청: 문의 메일(준비 중)"));
});
test("실제 사례 문제는 title·description에 해설(회사명)을 넣지 않는다", () => {
  const f = build(area([mc, real]), cfg, opt())["s1_tax/002.html"];
  const head = f.slice(0, f.indexOf("</head>"));
  assert.ok(!/<title>[^<]*A증권/.test(head));
  assert.ok(!/name="description" content="[^"]*A증권/.test(head));
});
test("SITE_NAME을 바꾸면 페이지 이름도 바뀐다", () => {
  const f = build(area([mc]), Object.assign({}, cfg, {SITE_NAME:"새이름"}), opt())["s1_tax/001.html"];
  assert.ok(f.includes("| 새이름</title>"));
  assert.ok(!f.includes("투운사 모의고사"));
});
