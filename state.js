// localStorage에서 읽은 값 검증. 같은 출처의 다른 페이지가 값을 바꿔 넣을 수 있으므로
// 타입·범위·알려진 문제 id를 확인하고, 어긋나면 그 항목(또는 전체)을 버린다.
// has(id): 알려진 문제 id인지, isMc(id): 4지선다인지. app.js와 tests가 같이 쓴다.
(function(root){
"use strict";
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const MAX = 1e6;
const MODES = ["area", "subject", "calc", "wrong", "mock"];

// 문제별 기록 {c, w, last, t} + 선택 필드 p(패스 횟수), g(찍어서 맞힘 횟수), lk(최근 결과 o·x·p·g)
const LK = ["o", "x", "p", "g"];
function stats(v, has){
  const out = {};
  if(!isObj(v)) return out;
  Object.keys(v).forEach(id => {
    const s = v[id];
    if(!has(id) || !isObj(s)) return;
    if(!isInt(s.c, 0, MAX) || !isInt(s.w, 0, MAX) || (s.last !== 0 && s.last !== 1)) return;
    const r = {c:s.c, w:s.w, last:s.last, t: Number.isFinite(s.t) && s.t >= 0 ? s.t : 0};
    if(isInt(s.p, 0, MAX)) r.p = s.p;
    if(isInt(s.g, 0, MAX)) r.g = s.g;
    if(LK.indexOf(s.lk) >= 0) r.lk = s.lk;
    out[id] = r;
  });
  return out;
}
function opts(v){
  const out = {shuffleQ:true, shuffleC:true};
  if(!isObj(v)) return out;
  ["shuffleQ", "shuffleC", "hideF"].forEach(k => { if(typeof v[k] === "boolean") out[k] = v[k]; });
  return out;
}
// 모의고사 이력 {runs, seen: qid -> 출제 횟수}
function mock(v, has){
  const out = {runs:0, seen:{}};
  if(!isObj(v)) return out;
  if(isInt(v.runs, 0, MAX)) out.runs = v.runs;
  if(isObj(v.seen)) Object.keys(v.seen).forEach(id => { if(has(id) && isInt(v.seen[id], 1, MAX)) out.seen[id] = v.seen[id]; });
  return out;
}
const isPerm = o => Array.isArray(o) && o.length === 4 && [0, 1, 2, 3].every(n => o.indexOf(n) >= 0);
// 풀던 세션. 하나라도 어긋나면 세션 전체를 버린다(null).
function session(v, has, isMc){
  if(!isObj(v) || MODES.indexOf(v.mode) < 0 || typeof v.title !== "string" || v.title.length > 100) return null;
  if(!Array.isArray(v.items) || !v.items.length || v.items.length > 1000) return null;
  const items = [];
  for(const it of v.items){
    if(!isObj(it) || typeof it.qid !== "string" || !has(it.qid)) return null;
    if(isMc(it.qid) ? !isPerm(it.order) : it.order !== null) return null;
    items.push({qid:it.qid, order: it.order === null ? null : it.order.slice()});
  }
  if(!isInt(v.i, 0, items.length) || !isObj(v.ans)) return null;
  const ans = {};
  for(const k of Object.keys(v.ans)){
    const n = Number(k), a = v.ans[k];
    if(!isInt(n, 0, items.length - 1) || String(n) !== k) return null;
    if(a !== -1 && (isMc(items[n].qid) ? !isInt(a, 0, 3) : typeof a !== "boolean")) return null;   // -1은 패스
    ans[n] = a;
  }
  const out = {mode:v.mode, title:v.title, items, i:v.i, ans, startedAt: Number.isFinite(v.startedAt) ? v.startedAt : 0};
  if(isInt(v.total, items.length, 1000)) out.total = v.total;   // 중간에 그만둔 경우 원래 문항 수
  // 찍어서 맞힘 표시 {문항 번호: true}. 답한 문항만
  if(isObj(v.guess)){
    const g = {};
    Object.keys(v.guess).forEach(k => { const n = Number(k); if(String(n) === k && own(ans, k) && v.guess[k] === true) g[n] = true; });
    if(Object.keys(g).length) out.guess = g;
  }
  return out;
}
const oneOf = (v, list, d) => list.indexOf(v) >= 0 ? v : d;

// 여러 탭이 같은 기록을 쓸 때 합친다(새 객체를 돌려준다).
// 문제별 기록은 더 최근(t가 큰) 것을 남긴다.
function mergeStats(a, b){
  const out = Object.assign({}, a);
  Object.keys(b).forEach(id => { const x = out[id], y = b[id]; if(!x || (y.t || 0) > (x.t || 0)) out[id] = Object.assign({}, y); });
  return out;
}
// 모의고사 이력: 회차와 문제별 출제 횟수 모두 큰 값
function mergeMock(a, b){
  const seen = Object.assign({}, a.seen);
  Object.keys(b.seen).forEach(id => { seen[id] = Math.max(seen[id] || 0, b.seen[id]); });
  return {runs: Math.max(a.runs, b.runs), seen};
}
// 쓰기 직전에 저장소 값을 다시 읽어 메모리 값과 합치고, fn으로 고친 뒤 쓴다. 다른 탭이 쓴 기록을 덮어쓰지 않는다.
// read: 저장소 원값 → 검증된 값, merge(저장소, 메모리), fn(합친 값) → 고친 값. 돌려준 값을 메모리 값으로 쓴다.
function update(store, key, read, merge, mem, fn){
  let cur = mem;
  try{ cur = merge(read(JSON.parse(store.getItem(key))), mem); }catch(e){}
  const next = fn ? (fn(cur) || cur) : cur;
  try{ store.setItem(key, JSON.stringify(next)); }catch(e){}
  return next;
}
const api = {stats, opts, mock, session, oneOf, own, mergeStats, mergeMock, update};
root.TuunsaState = api;
if(typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
