// app.js를 가짜 브라우저(vm)에서 띄워 첫 화면 HTML을 확인한다.
// 업무모드 첫 화면에는 시험을 드러내는 낱말이 없어야 한다(QA M3). 문제 본문과 하단 법적 고지는 예외.
"use strict";
const test = require("node:test");
const assert = require("node:assert");

const {boot: boot0} = require("./harness.js");
const boot = store => boot0(store).view();
const text = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const BANNED = /투운사|모의고사|시험|합격|과락|오답|정답|문제|과목|자격/g;

test("업무모드 첫 화면(첫 방문)에 시험 낱말이 없다", () => {
  const h = boot({"tuunsa-work": "true"});
  assert.ok(h.length > 1000, "첫 화면이 그려져야 한다");
  assert.deepStrictEqual(text(h).match(BANNED) || [], []);
  assert.ok(!h.includes('class="card hero intro"'), "업무모드에서는 소개 카드를 쓰지 않는다");
});
test("업무모드 첫 화면(기록·모의고사 이력·풀던 세션 있음)에 시험 낱말이 없다", () => {
  const store = {"tuunsa-work": "true",
    "tuunsa-stats": JSON.stringify({s1_tax_001: {c:0, w:1, last:0, t:1}}),
    "tuunsa-mock": JSON.stringify({runs: 2, seen: {s1_tax_001: 1}}),
    "tuunsa-session": JSON.stringify({mode:"mock", title:"실전 모의고사 2회", i:1, ans:{0:1}, startedAt:1, items:[{qid:"s1_tax_001", order:[0,1,2,3]}, {qid:"s1_tax_002", order:[0,1,2,3]}]})};
  const h = boot(store);
  assert.ok(h.includes('id="resume"') && h.includes('id="wrong"'));
  assert.deepStrictEqual(text(h).match(BANNED) || [], []);
});
test("일반 모드 첫 화면은 그대로(소개 카드와 시험 안내)", () => {
  const h = boot({});
  assert.ok(h.includes('class="card hero intro"'));
  assert.ok(text(h).includes("실전 모의고사 100문항 시작"));
});
