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
    + `<a href="javascript:alert(3)"><rect onmouseover='y()' fill="var(--accent)"/></a><g/onload=z()></g><SCRIPT src=x></SCRIPT></svg>`;
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
