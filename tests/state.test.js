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

// 두 탭 동시 사용(QA M2): 쓰기 직전에 다시 읽어 합치므로 기록을 잃지 않는다.
function fakeStore(){ const m = {}; return {getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = v; }, m}; }
const ALL = id => /^s\d_\w+_\d{3}$/.test(id);
const answer = (store, mem, id, ok, t) => V.update(store, "tuunsa-stats", v => V.stats(v, ALL), V.mergeStats, mem, all => {
  const st = Object.assign({c:0, w:0}, all[id]); if(ok) st.c++; else st.w++; st.last = ok ? 1 : 0; st.t = t; all[id] = st;
});
test("두 탭이 번갈아 풀어도 6문제 기록이 모두 남는다", () => {
  const store = fakeStore();
  let A = {}, B = {};
  A = answer(store, A, "s1_tax_001", true, 1);
  B = answer(store, B, "s1_product_001", false, 2);
  A = answer(store, A, "s1_tax_002", true, 3);
  B = answer(store, B, "s1_product_002", true, 4);
  A = answer(store, A, "s1_tax_003", false, 5);
  B = answer(store, B, "s1_product_003", true, 6);
  const saved = JSON.parse(store.m["tuunsa-stats"]);
  assert.strictEqual(Object.keys(saved).length, 6);
  assert.strictEqual(saved.s1_tax_003.w, 1);
});
test("같은 문제를 두 탭에서 풀면 횟수를 이어서 센다", () => {
  const store = fakeStore();
  let A = {}, B = {};
  A = answer(store, A, "s1_tax_001", true, 1);
  B = answer(store, B, "s1_tax_001", false, 2);
  const saved = JSON.parse(store.m["tuunsa-stats"]).s1_tax_001;
  assert.deepStrictEqual([saved.c, saved.w, saved.last], [1, 1, 0]);
});
test("모의고사 이력: 두 탭에서 한 번씩 시작하면 2회", () => {
  const store = fakeStore();
  const run = (mem, ids) => V.update(store, "tuunsa-mock", v => V.mock(v, ALL), V.mergeMock, mem, m => { ids.forEach(id => { m.seen[id] = (m.seen[id] || 0) + 1; }); m.runs++; });
  let A = {runs:0, seen:{}}, B = {runs:0, seen:{}};
  A = run(A, ["s1_tax_001"]);
  B = run(B, ["s1_tax_002"]);
  assert.deepStrictEqual(JSON.parse(store.m["tuunsa-mock"]), {runs:2, seen:{s1_tax_001:1, s1_tax_002:1}});
});
test("mergeStats는 더 최근 기록을 남기고 원본을 바꾸지 않는다", () => {
  const a = {x:{c:1, w:0, last:1, t:5}}, b = {x:{c:0, w:1, last:0, t:3}, y:{c:1, w:0, last:1, t:1}};
  const m = V.mergeStats(a, b);
  assert.strictEqual(m.x.t, 5); assert.ok(m.y);
  assert.strictEqual(Object.keys(a).length, 1);
});
test("중간에 그만둔 세션의 원래 문항 수(total)는 범위 안일 때만 남긴다", () => {
  assert.strictEqual(V.session(Object.assign(clone(good), {i:2, total:100}), has, isMc).total, 100);
  assert.strictEqual(V.session(Object.assign(clone(good), {i:2, total:1}), has, isMc).total, undefined);
  assert.strictEqual(V.session(Object.assign(clone(good), {i:2, total:"<x>"}), has, isMc).total, undefined);
});

test("기록 새 필드 p·g·lk는 형식이 맞을 때만 남기고, 예전 기록은 그대로", () => {
  const s = V.stats({s1_tax_001:{c:1, w:2, last:0, t:5, p:1, g:0, lk:"p"}, s1_tax_002:{c:1, w:0, last:1, t:1}}, has);
  assert.deepStrictEqual(s.s1_tax_001, {c:1, w:2, last:0, t:5, p:1, g:0, lk:"p"});
  assert.deepStrictEqual(s.s1_tax_002, {c:1, w:0, last:1, t:1});
  const bad = V.stats({s1_tax_001:{c:1, w:0, last:1, t:1, p:"<x>", g:-1, lk:"<img>"}}, has);
  assert.deepStrictEqual(bad.s1_tax_001, {c:1, w:0, last:1, t:1});
});
test("두 탭 병합에 새 필드가 함께 간다", () => {
  const m = V.mergeStats({x:{c:1, w:0, last:1, t:1}}, {x:{c:1, w:1, last:0, t:2, p:1, lk:"p"}});
  assert.deepStrictEqual(m.x, {c:1, w:1, last:0, t:2, p:1, lk:"p"});
});
test("세션: 패스(-1) 답과 찍어서 맞음 표시(guess)", () => {
  const s = V.session(Object.assign(clone(good), {i:2, ans:{0:-1, 1:-1}, guess:{0:true, 5:true, 1:"x"}}), has, isMc);
  assert.deepStrictEqual(s.ans, {0:-1, 1:-1});
  assert.deepStrictEqual(s.guess, {0:true});
  assert.strictEqual(V.session(Object.assign(clone(good), {ans:{0:-2}}), has, isMc), null);
});
test("세션 passUndo: 그 문항이 패스 상태이고 기록 형식이 맞을 때만", () => {
  const base = Object.assign(clone(good), {i:1, ans:{0:-1}});
  assert.deepStrictEqual(V.session(Object.assign({}, base, {passUndo:{i:0, prev:{c:1, w:0, last:1, t:2}}}), has, isMc).passUndo, {i:0, prev:{c:1, w:0, last:1, t:2}});
  assert.deepStrictEqual(V.session(Object.assign({}, base, {passUndo:{i:0, prev:null}}), has, isMc).passUndo, {i:0, prev:null});
  assert.strictEqual(V.session(Object.assign({}, base, {passUndo:{i:0, prev:{c:"<x>"}}}), has, isMc).passUndo, undefined);
  assert.strictEqual(V.session(Object.assign({}, base, {ans:{0:2}, passUndo:{i:0, prev:null}}), has, isMc).passUndo, undefined);
});
