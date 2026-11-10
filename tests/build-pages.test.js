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
  assert.strictEqual(files["sitemap.xml"].split("<url>").length - 1, 1 + areas.length + nq);
  assert.ok(!files["sitemap.xml"].includes(`<loc>${loadConfig().SITE_URL}</loc>`), "q/ sitemap에 사이트 루트 주소를 넣지 않는다");
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

test("정적 페이지 광고 자리는 1개, 접힌 해설은 HTML 본문에 들어 있다", () => {
  const f = build(area([mc]), cfg, opt())["s1_tax/001.html"];
  assert.strictEqual(f.split('id="adPage"').length - 1, 1);
  const d = f.slice(f.indexOf("<details>"), f.indexOf("</details>"));
  assert.ok(d.includes("보기별") || d.includes("해설"));
  assert.ok(d.includes("<li>항목</li>"), "해설 본문이 details 안에 정적 HTML로 있다");
});
test("실명 사례 페이지: 사례 제목 낱말이 문제 글에 있으면 메타를 영역명으로 만든다(사례 본문은 그대로)", () => {
  const r2 = Object.assign({}, real, {q:"UBS의 CDO 손실과 관련된 설명은?", case:Object.assign({}, real.case, {title:"UBS 서브프라임 CDO 손실"})});
  const f = build(area([mc, r2]), cfg, opt())["s1_tax/002.html"];
  const head = f.slice(0, f.indexOf("</head>")).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
  const metas = (head.match(/<title>[^<]*<\/title>|content="[^"]*"/g) || []).join(" ");
  assert.ok(!metas.includes("UBS"));
  assert.ok(metas.includes("세제 연습문제 2번"));
  assert.ok(f.includes("UBS 서브프라임 CDO 손실"), "사례 본문에는 그대로");
});
test("실제 데이터: 실명 사례 페이지 메타에 사례 제목 낱말이 없다", () => {
  const areas = loadData(), files = build(areas, loadConfig(), opt());
  const bad = [];
  areas.forEach(a => a.questions.forEach(q => {
    if(!(q.case && q.case.type === "real")) return;
    const key = Object.keys(files).find(k => k.startsWith(a.id + "/") && files[k].includes(`#q=${q.id}"`));
    const head = files[key].slice(0, files[key].indexOf("</head>")).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
    const metas = (head.match(/<title>[^<]*<\/title>|content="[^"]*"/g) || []).join(" ");
    const words = String(q.case.title || "").split(/[\s·,()\[\]「」『』:\/<>"'-]+/).filter(t => t.length >= 2);
    if(words.some(w => metas.includes(w))) bad.push(q.id);
  }));
  assert.deepStrictEqual(bad, []);
});

test("정적 페이지: CSP 메타, iframe 방어, 영역 id 검사", () => {
  const f = build(area([mc]), cfg, opt())["s1_tax/001.html"];
  assert.ok(f.includes(`content="object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests"`));
  assert.ok(f.includes("window.top!==window.self"));
  assert.ok(f.indexOf('src="../../site.js"') > 0);
  assert.throws(() => build([{id:"../x", subject:1, title:"t", questions:[]}], cfg, opt()), /영역 id/);
});

test("정적 페이지 해설에도 개념·그림·용어집 풀이가 앱과 같은 규칙으로 들어간다", () => {
  const q = Object.assign({}, mc, {id:"s1_tax_009", q:"VaR 문제", concept:"VaR 개념\n$ a = b", fig:["f1", "nope"], explain:"VaR 해설"});
  const extras = {FIGURES:{f1:{title:"그림1", svg:'<svg onload="x()"><path/></svg>', caption:"설명"}}, GLOSSARY:{VaR:{full:"Value at Risk"}}};
  const f = build(area([q]), cfg, opt(), extras)["s1_tax/009.html"];
  const d = f.slice(f.indexOf("<details>"), f.indexOf("</details>"));
  assert.ok(d.indexOf('class="concept"') < d.indexOf("<figure") && d.indexOf("<figure") < d.indexOf("<h3>해설</h3>"));
  assert.ok(d.includes('<div class="fx">a = b</div>') && !/onload/.test(f));
  assert.strictEqual((f.match(/class="gloss"/g) || []).length, 1, "해설 영역에서 한 번만, h1(문제)에는 없음");
  assert.ok(f.includes("<h1>VaR 문제</h1>"));
});
test("정적 페이지 용어집 영역별 뜻: 영역 id로 고른다", () => {
  const GL = {PD:{byArea:{s1_tax:{full:"Probability of Default", ko:"부도확률"}}}};
  const q = Object.assign({}, mc, {id:"s1_tax_010", explain:"PD를 추정한다."});
  const f = build(area([q]), cfg, opt(), {GLOSSARY:GL})["s1_tax/010.html"];
  assert.ok(f.includes("(Probability of Default, 부도확률)"));
  const f2 = build([{id:"s2_risk", subject:2, title:"리스크", questions:[Object.assign({}, q, {id:"s2_risk_001"})]}], cfg, opt(), {GLOSSARY:GL})["s2_risk/001.html"];
  assert.ok(!f2.includes('class="gloss"'));
});
