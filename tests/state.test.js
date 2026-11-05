// localStorage 값 검증(보안 관문 M3). 바꿔 넣은 값은 버리고 기본값으로 돌아가야 한다.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const V = require("../state.js");

const IDS = {s1_tax_001:"mc", s1_tax_002:"ox"};
const has = id => typeof id === "string" && Object.prototype.hasOwnProperty.call(IDS, id);
const isMc = id => IDS[id] === "mc";
const good = {mode:"area", title:"세제", i:0, ans:{}, startedAt:1,
  items:[{qid:"s1_tax_001", order:[2,0,3,1]}, {qid:"s1_tax_002", order:null}]};
const clone = o => JSON.parse(JSON.stringify(o));

test("정상 세션은 그대로 통과", () => {
  const s = V.session(Object.assign(clone(good), {i:2, ans:{0:3, 1:true}}), has, isMc);
  assert.deepStrictEqual(s.ans, {0:3, 1:true});
  assert.strictEqual(s.items[0].order.join(), "2,0,3,1");
});
test("보안 관문 재현값: order에 HTML, 알 수 없는 id, 범위 밖 값은 세션 전체를 버린다", () => {
  const bad = [
    {items:[{qid:"s1_tax_001", order:['"><img src=x onerror=alert(2)>',1,2,3]}]},
    {items:[{qid:"s1_tax_001", order:[0,0,1,2]}]},
    {items:[{qid:"constructor", order:null}]},
    {items:[{qid:"s1_tax_002", order:[0,1,2,3]}]},
    {i:5}, {i:-1}, {i:"0"}, {mode:"x"}, {title:"x".repeat(101)}, {ans:{0:"<img>"}}, {ans:{0:7}}, {ans:{1:3}}, {ans:{9:1}}, {ans:{"01":1}}
  ];
  bad.forEach(b => assert.strictEqual(V.session(Object.assign(clone(good), b), has, isMc), null, JSON.stringify(b)));
  [null, "x", [], 1].forEach(v => assert.strictEqual(V.session(v, has, isMc), null));
});
test("MOCK.runs에 HTML이 들어오면 0으로, seen은 알려진 id의 양의 정수만", () => {
  assert.deepStrictEqual(V.mock({runs:"<img src=x onerror=alert(1)>", seen:{}}, has), {runs:0, seen:{}});
  assert.deepStrictEqual(V.mock({runs:3, seen:{s1_tax_001:2, s1_tax_002:"1", x:1, __proto__:{}}}, has), {runs:3, seen:{s1_tax_001:2}});
  assert.deepStrictEqual(V.mock({runs:1.5}, has), {runs:0, seen:{}});
});
test("STATS는 알려진 id와 숫자 형식만 남긴다", () => {
  const s = V.stats({s1_tax_001:{c:1, w:0, last:1, t:5}, s1_tax_002:{c:"<x>", w:0, last:1}, nope:{c:1, w:0, last:0}}, has);
  assert.deepStrictEqual(Object.keys(s), ["s1_tax_001"]);
});
test("옵션은 boolean만, 테마는 목록 안의 값만", () => {
  assert.deepStrictEqual(V.opts({shuffleQ:"no", shuffleC:false, hideF:true, x:1}), {shuffleQ:true, shuffleC:false, hideF:true});
  assert.strictEqual(V.oneOf("<script>", ["system","light","dark"], "system"), "system");
});
