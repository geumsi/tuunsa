// 해설 렌더링(render.js): "$ " 공식 줄, 용어집 풀이, 그림 정리, 개념 상자.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const R = require("../render.js");

const G = {VaR:{full:"Value at Risk", ko:"최대예상손실"}, IS:{full:"Investment-Saving", ko:"생산물시장 균형"},
  ISA:{full:"Individual Savings Account", ko:"개인종합자산관리계좌"}, "S&P":{full:"Standard & Poor's"}, amp:{ko:"엉뚱한 키"},
  X:{full:"<b>x</b>"}};

test("$ 줄은 공식 상자로, 이스케이프하고 용어 풀이를 붙이지 않는다", () => {
  const h = R.rich("설명\n$ VaR = 1.65 × σ × <W>\n· 항목", R.makeGloss(G));
  assert.ok(h.includes('<div class="fx">VaR = 1.65 × σ × &lt;W&gt;</div>'));
  assert.ok(h.includes("<ul><li>항목</li></ul>"));
  assert.ok(R.rich("$100 이익").includes("<p>$100 이익</p>"), "\"$ \"로 시작할 때만");
});
test("용어집: 해설 영역에서 처음 나올 때만, 영문 경계 기준", () => {
  const g = R.makeGloss(G);
  const a = g.text(R.esc("VaR는 손실 한도다. VaR를 다시 쓴다."));
  assert.strictEqual(a.split('class="gloss"').length - 1, 1);
  assert.ok(a.startsWith('VaR<small class="gloss">(Value at Risk, 최대예상손실)</small>는'));
  assert.ok(!g.text("VaR 또 나옴").includes("gloss"), "같은 풀이기(한 문제) 안에서는 다시 붙이지 않는다");
  const g2 = R.makeGloss(G);
  const b = g2.text("ISA 계좌와 IS곡선, CVaR");
  assert.ok(b.includes("ISA<small"), "ISA는 ISA로 매칭");
  assert.ok(b.includes('IS<small class="gloss">(Investment-Saving, 생산물시장 균형)</small>곡선'), "IS곡선은 매칭");
  assert.ok(!b.includes("CVaR<small") && !b.includes("CVaR (") && b.includes("CVaR"), "CVaR 안의 VaR는 매칭하지 않음");
  assert.strictEqual((b.match(/class="gloss"/g) || []).length, 2);
});
test("용어집: 이미 괄호로 풀어 쓴 경우는 붙이지 않고 처음 나온 것으로 친다", () => {
  const g = R.makeGloss(G);
  assert.ok(!g.text("VaR(Value at Risk)는").includes("gloss"));
  assert.ok(!g.text("VaR 뒤").includes("gloss"));
  const g2 = R.makeGloss(G);
  assert.ok(!g2.text("최대예상손실(VaR)").includes("gloss"));
});
test("용어집: esc를 거친 뒤 붙이고, 문자 참조(&amp;) 안은 건드리지 않으며 풀이 글도 이스케이프", () => {
  const g = R.makeGloss(G);
  const h = g.text(R.esc("S&P 500과 X"));
  assert.ok(h.startsWith('S&amp;P<small class="gloss">(Standard &amp; Poor&#39;s)</small>'));
  assert.ok(!h.includes("엉뚱한 키"));
  assert.ok(h.includes("(&lt;b&gt;x&lt;/b&gt;)"));
  assert.strictEqual(R.makeGloss(null).text("VaR"), "VaR");
  assert.strictEqual(R.makeGloss({constructor:{}}).text("constructor"), "constructor");
});
test("그림 SVG 정리: script, on* 속성, foreignObject, javascript: 링크 제거", () => {
  const bad = `<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><foreignObject><div onclick="x()">h</div></foreignObject>`
    + `<a href="javascript:alert(3)"><circle/></a><rect onmouseover='y()' fill="var(--accent)"/><g/onload=z()></g><SCRIPT src=x></SCRIPT></svg>`;
  const s = R.sanitizeSvg(bad);
  assert.ok(!/script|onload|onclick|onmouseover|foreignObject|javascript:/i.test(s), s);
  assert.ok(s.includes('fill="var(--accent)"'));
  assert.strictEqual(R.sanitizeSvg("<div>x</div>"), "");
  assert.strictEqual(R.sanitizeSvg(null), "");
});
test("그림: 없는 파일·없는 id는 조용히 건너뛰고, 제목·설명은 이스케이프", () => {
  const F = {a:{title:"듀레이션<", svg:'<svg viewBox="0 0 1 1"><path stroke="currentColor"/></svg>', caption:"설명"}, b:{svg:"not svg"}};
  const h = R.figHtml(["a", "zz", "b", "constructor", 3], F);
  assert.strictEqual((h.match(/<figure/g) || []).length, 1);
  assert.ok(h.includes('aria-label="듀레이션&lt;"') && h.includes("<b>듀레이션&lt;</b> 설명"));
  assert.strictEqual(R.figHtml(["a"], undefined), "");
  assert.strictEqual(R.figHtml("a", F), "");
});
test("개념 상자는 그림보다 앞, 용어 풀이는 개념에서 처음 붙는다", () => {
  const g = R.makeGloss(G);
  const F = {f1:{title:"그림", svg:"<svg></svg>"}};
  const h = R.conceptHtml({concept:"VaR는 손실 추정\n$ a = b", fig:["f1"]}, F, g);
  assert.ok(h.indexOf('class="concept"') < h.indexOf("<figure"));
  assert.ok(h.includes('<div class="fx">a = b</div>'));
  assert.ok(h.includes("gloss"));
  assert.ok(!g.text("VaR").includes("gloss"));
  assert.strictEqual(R.conceptHtml({}, F, g), "");
});

const GA = {PD:{byArea:{s2_risk:{full:"Probability of Default", ko:"부도확률"}, s3_bond:{full:"Primary Dealer", ko:"국고채전문딜러"}}}, VaR:G.VaR};
test("용어집 영역별 뜻: 문제 영역으로 고르고, 그 영역이 없으면 붙이지 않는다", () => {
  assert.ok(R.makeGloss(GA, "s2_risk").text("PD 추정").includes("(Probability of Default, 부도확률)"));
  assert.ok(R.makeGloss(GA, "s3_bond").text("PD 제도").includes("(Primary Dealer, 국고채전문딜러)"));
  const g = R.makeGloss(GA, "s1_tax");
  assert.ok(!g.text("PD").includes("gloss"));
  assert.ok(g.text("VaR").includes("gloss"), "영역 구분 없는 항목은 그대로");
  assert.ok(!R.makeGloss(GA).text("PD").includes("gloss"), "영역을 모르면 붙이지 않음");
  assert.ok(!R.makeGloss({PD:{byArea:{s2_risk:{}}}}, "s2_risk").text("PD").includes("gloss"));
  assert.ok(!R.makeGloss({PD:{byArea:{}}}, "toString").text("PD").includes("gloss"), "프로토타입 키(toString)는 영역으로 치지 않음");
});
test("그림 허용 목록: 디자인팀 요소·속성만 남기고 class 색은 유지", () => {
  const svg = `<svg viewBox="0 0 100 50" class="fig" role="img" aria-label="그림" style="x" xmlns="http://www.w3.org/2000/svg"><title>제목</title>`
    + `<g transform="translate(1 2)"><polyline points="0,0 1,1" class="ac" stroke-width="2" stroke-dasharray="3 2"/><text x="5" y="9" text-anchor="middle" dominant-baseline="middle" class="fg">축<tspan dx="2" class="mu">값</tspan></text></g>`
    + `<rect class="f-ok" width="10" height="5" rx="2" fill="url(http://evil)"/><a href="https://x"><circle r="1"/></a><image href="x.png"/><use href="#a"/><style>.fg{fill:red}</style><!-- c --><defs><path d="M0 0"/></defs></svg>`;
  const s = R.sanitizeSvg(svg);
  assert.ok(s.startsWith('<svg viewBox="0 0 100 50" class="fig" role="img" aria-label="그림" xmlns="http://www.w3.org/2000/svg"><title>제목</title>'), s);
  ["polyline", 'class="ac"', 'stroke-dasharray="3 2"', 'text-anchor="middle"', 'dominant-baseline="middle"', "<tspan", 'class="f-ok"', 'rx="2"', '<path d="M0 0"/>'].forEach(t => assert.ok(s.includes(t), t));
  ["style", "url(", "<a", "<circle", "<image", "<use", "<!--", "<defs", "evil"].forEach(t => assert.ok(!s.includes(t), t + " 남음: " + s));
});
test("공식 상자: 가로로 넘칠 때 가장자리 그림자 단서(스크롤과 함께 움직이는 덮개)", () => {
  const css = require("fs").readFileSync(require("path").join(__dirname, "..", "style.css"), "utf8");
  const rule = css.slice(css.indexOf(".fx{"), css.indexOf("}", css.indexOf(".fx{")));
  assert.ok(/no-repeat local/.test(rule) && /no-repeat scroll/.test(rule) && /overflow-x:auto/.test(rule));
});

// 공식 줄 아래 변수 풀이(vars)
const V8 = {F:"선물 이론가격", S:"현물가격", r:"무위험이자율", d:"배당수익률", t:"잔존기간(연)"};
test("변수 풀이: 공식 줄 바로 아래, 기호가 처음 나오는 순서", () => {
  const X = R.makeVars(V8);
  const h = R.rich("설명 문장이다.\n· F = S × [1 + (r − d) × t] → F − S = S × (r − d) × t", null, X.section());
  assert.ok(h.includes('× t<div class="vleg">F: 선물 이론가격 · S: 현물가격 · r: 무위험이자율 · d: 배당수익률 · t: 잔존기간(연)</div></li>'), h);
  assert.ok(h.startsWith("<p>설명 문장이다.</p><ul>"), "공식 줄이 아니면 붙이지 않음");
});
test("변수 풀이: 영문·숫자 경계, 긴 키 먼저, 한글 옆 기호는 매칭", () => {
  const v = R.makeVars({d:"배당", d1:"다음 기 배당", "D₀":"올해 배당", D:"배당 총액", r:"할인율", k:"요구수익률", g:"성장률"}).section();
  assert.strictEqual(v.line("P = d1/(k − g)"), '<div class="vleg">d1: 다음 기 배당 · k: 요구수익률 · g: 성장률</div>');
  assert.strictEqual(R.makeVars({r:"할인율", k:"요구수익률"}).section().line("rate = 3%, k보다 크다"), '<div class="vleg">k: 요구수익률</div>');
  assert.strictEqual(R.makeVars({"D₀":"올해 배당", D:"배당 총액"}).section().line("D₁ = D₀ × (1+g)"), '<div class="vleg">D₀: 올해 배당</div>');
  assert.strictEqual(R.makeVars({σ:"표준편차"}).section().line("VaR = 1.65 × σ²"), '<div class="vleg">σ: 표준편차</div>');
});
test("변수 풀이: 같은 섹션에서 이미 풀이한 기호는 다시 붙이지 않고, 남은 기호가 없으면 안 붙인다", () => {
  const X = R.makeVars(V8), sec = X.section();
  assert.ok(sec.line("F = S × t").includes("F: "));
  assert.strictEqual(sec.line("F − S = S × t"), "");
  assert.strictEqual(sec.line("F = S × (r − d)"), '<div class="vleg">r: 무위험이자율 · d: 배당수익률</div>');
  assert.ok(X.section().line("F = S").includes("F: "), "새 섹션은 처음부터");
});
test("변수 풀이: 연산자가 없거나 vars가 없으면 그대로, 뜻은 이스케이프", () => {
  assert.strictEqual(R.makeVars(V8).section().line("F와 S의 차이"), "");
  assert.strictEqual(R.makeVars({}), R.NOVARS);
  assert.strictEqual(R.makeVars(null).section().line("F = S"), "");
  const t = "가격\n· F = S × t\n$ F = S";
  assert.strictEqual(R.rich(t, null, R.makeVars(undefined).section()), R.rich(t), "vars 없는 문제는 지금과 같다");
  assert.ok(R.makeVars({x:"<b>뜻</b>"}).section().line("y = x").includes("x: &lt;b&gt;뜻&lt;/b&gt;"));
  assert.ok(R.rich("$ F = S × t", null, R.makeVars(V8).section()).includes('</div><div class="vleg">F: '), "해설의 $ 줄에도 붙음");
});
test("변수 풀이 키는 용어집 풀이에서 뺀다(vars 우선)", () => {
  const g = R.makeGloss({VaR:{full:"Value at Risk"}, ES:{full:"Expected Shortfall"}}, "s2_risk", ["VaR"]);
  const h = g.text("VaR와 ES");
  assert.ok(!h.includes("Value at Risk") && h.includes("Expected Shortfall"));
});

test("공식 범례에 용어집 약어도 넣는다(ko만, byArea 규칙, vars 우선)", () => {
  const GL = {EL:{full:"Expected Loss", ko:"예상손실"}, EAD:{full:"Exposure At Default", ko:"부도시 익스포저"},
    LGD:{full:"Loss Given Default", ko:"부도시 손실률"}, PD:{byArea:{s2_risk:{full:"Probability of Default", ko:"부도확률"}, s3_bond:{ko:"국고채전문딜러"}}},
    NAV:{full:"Net Asset Value"}};
  const line = "예상손실(EL) = EAD × PD × LGD";
  assert.strictEqual(R.makeVars(null, GL, "s2_risk").section().line(line),
    '<div class="vleg">EL: 예상손실 · EAD: 부도시 익스포저 · PD: 부도확률 · LGD: 부도시 손실률</div>');
  assert.strictEqual(R.makeVars(null, GL, "s1_tax").section().line(line), '<div class="vleg">EL: 예상손실 · EAD: 부도시 익스포저 · LGD: 부도시 손실률</div>', "영역에 없는 byArea 약어는 뺀다");
  assert.ok(R.makeVars({EL:"기대손실(직접 정의)"}, GL, "s2_risk").section().line(line).includes("EL: 기대손실(직접 정의)"), "vars 우선");
  assert.ok(R.makeVars(null, GL).section().line("NAV = 순자산 / 좌수").includes("NAV: Net Asset Value"), "ko가 없으면 full");
  assert.deepStrictEqual(R.makeVars({F:"x"}, GL, "s2_risk").keys, ["F"], "용어집 풀이에서 뺄 키는 vars 키만");
  assert.strictEqual(R.makeVars(null, GL, "s2_risk").section().line("EL은 평균 손실"), "", "연산자 없는 줄은 그대로");
});
