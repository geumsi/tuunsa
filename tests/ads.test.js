// 광고 슬롯 표시 조건. 광고가 꺼져 있거나 업무모드·화면 가리기 중이면 아무것도 그리지 않아야 한다.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const ads = require("../ads.js");

const on = {work:false, cover:false};
const sense = (slots, client) => ({ADS:{provider:"adsense", client: client || "ca-pub-1234567890123456", slots}});

test("provider null이면 슬롯을 그리지 않는다", () => {
  const cfg = {ADS:{provider:null, client:"ca-pub-1234567890123456", slots:{quiz:"1234567890"}}};
  assert.strictEqual(ads.html(cfg, "quiz", on), "");
  assert.strictEqual(ads.canShow(cfg, "quiz", on), false);
});
test("설정이 없거나 모르는 provider면 그리지 않는다", () => {
  assert.strictEqual(ads.html({}, "quiz", on), "");
  assert.strictEqual(ads.html(undefined, "quiz", on), "");
  assert.strictEqual(ads.html({ADS:{provider:"other", slots:{quiz:"1"}}}, "quiz", on), "");
});
test("업무모드·화면 가리기 중에는 그리지 않는다", () => {
  const cfg = sense({quiz:"1234567890"});
  assert.ok(ads.html(cfg, "quiz", on).includes("adsbygoogle"));
  assert.strictEqual(ads.html(cfg, "quiz", {work:true, cover:false}), "");
  assert.strictEqual(ads.html(cfg, "quiz", {work:false, cover:true}), "");
  assert.strictEqual(ads.html(cfg, "quiz", null), "");
});
test("슬롯 id가 비었거나 형식이 틀리면 그리지 않는다", () => {
  assert.strictEqual(ads.html(sense({quiz:""}), "quiz", on), "");
  assert.strictEqual(ads.html(sense({quiz:"123\"><script>"}), "quiz", on), "");
  assert.strictEqual(ads.html(sense({quiz:"1234567890"}, "pub-x"), "quiz", on), "");
  assert.strictEqual(ads.html(sense({quiz:"1234567890"}), "result", on), "");
});
test("adfit은 DAN- 단위 id와 크기를 쓰고 최소 높이를 예약한다", () => {
  const cfg = {ADS:{provider:"adfit", slots:{result:{id:"DAN-abc123XYZ", w:300, h:250}}}};
  const h = ads.html(cfg, "result", on);
  assert.ok(h.includes('data-ad-unit="DAN-abc123XYZ"'));
  assert.ok(h.includes('data-ad-height="250"'));
  assert.ok(h.includes("min-height:250px"));
  assert.strictEqual(ads.html({ADS:{provider:"adfit", slots:{result:"1234"}}}, "result", on), "");
});
test("크기 값이 비정상이면 기본 높이를 쓴다", () => {
  const h = ads.html(sense({quiz:{id:"1234567890", h:-5}}), "quiz", on);
  assert.ok(h.includes("min-height:120px"));
});

// 가짜 DOM: 슬롯 요소와 head에 들어간 스크립트 수만 센다.
function fakeDom(names){
  const scripts = [];
  global.document = {createElement: () => ({dataset:{}}), head: {appendChild: s => scripts.push(s)}};
  const els = names.map(n => ({dataset:{ad:n}, removed:false, remove(){ this.removed = true; }}));
  const box = {querySelectorAll: sel => els.filter(e => !e.removed && (sel === ".ad" || !("filled" in e.dataset)))};
  return {box, els, scripts, live: () => els.filter(e => !e.removed).length};
}

test("업무모드에서 fill하면 슬롯을 지우고 스크립트를 넣지 않는다", () => {
  const cfg = sense({quiz:"1234567890"});
  const d = fakeDom(["quiz"]);
  assert.strictEqual(ads.fill(d.box, cfg, {work:true, cover:false}), 0);
  assert.strictEqual(d.live(), 0);
  assert.strictEqual(d.scripts.length, 0);
});
test("가리기를 켜면 광고를 DOM에서 지우고, 풀어도 되살리지 않는다", () => {
  const cfg = sense({quiz:"1234567890"});
  const d = fakeDom(["quiz"]);
  assert.strictEqual(ads.fill(d.box, cfg, on), 1);
  assert.strictEqual(ads.sync(d.box, {work:false, cover:true}), 1);
  assert.strictEqual(d.live(), 0);
  assert.strictEqual(ads.sync(d.box, on), 0);   // 해제: 아무것도 하지 않음
  assert.strictEqual(d.live(), 0);
  assert.strictEqual(ads.fill(d.box, cfg, on), 0);   // 남은 슬롯이 없으니 다시 채울 것도 없음
});
test("업무모드를 켜면 지운다", () => {
  const d = fakeDom(["quiz", "result"]);
  assert.strictEqual(ads.sync(d.box, {work:true, cover:false}), 2);
  assert.strictEqual(d.live(), 0);
});

// 정책: CSS로 광고를 숨기지 않는다(AdSense는 display:none 숨김 금지). 숨김은 ads.js의 DOM 제거로만.
const fs = require("fs");
const path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
test("style.css에 광고를 숨기는 규칙이 없다", () => {
  const css = read("style.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  const bad = rules.filter(r => /(^|[\s,>])\.(ad|ad-box|adsbygoogle|kakao_ad_area)\b/.test(r.split("{")[0]) && /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?!\.)/.test(r));
  assert.deepStrictEqual(bad, []);
});
test("app.js는 가리기 화면을 붙이기 전에 광고를 지운다", () => {
  const src = read("app.js");
  const fn = src.slice(src.indexOf("function setCover("), src.indexOf("let lastEsc"));
  assert.ok(fn.indexOf("ADS.sync(") > 0, "setCover에서 ADS.sync를 불러야 한다");
  assert.ok(fn.indexOf("ADS.sync(") < fn.indexOf("appendChild"), "오버레이를 붙이기 전에 지워야 한다");
  const work = src.slice(src.indexOf("function applyWork("), src.indexOf("function setCover("));
  assert.ok(work.includes("ADS.sync("), "applyWork에서 ADS.sync를 불러야 한다");
});
