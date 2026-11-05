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
