// tools 공용: config.js와 data/*.js를 브라우저와 같은 방식으로 읽는다. 외부 의존성 없음.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
// app.js ORDER와 같은 순서
const ORDER = ["s1_tax","s1_product","s1_realestate","s2_alt","s2_global","s2_analysis","s2_risk",
  "s3_ethics","s3_law","s3_kofia","s3_equity","s3_bond","s3_deriv","s3_perf","s3_macro","s3_portfolio","s0_2026"];
const SUBJECTS = [
  {n:1, name:"1과목", full:"금융상품 및 세제"},
  {n:2, name:"2과목", full:"투자운용 및 전략Ⅱ · 투자분석"},
  {n:3, name:"3과목", full:"직무윤리·법규 · 투자운용 및 전략Ⅰ · 거시경제·분산투자"},
  {n:0, name:"2026", full:"2026 달라진 점"}
];

function runFiles(files){
  const sandbox = {window:{}};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  files.forEach(f => vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, {filename:f}));
  return sandbox.window;
}
function loadConfig(root){
  const w = runFiles([path.join(root || ROOT, "config.js")]);
  const cfg = w.SITE_CONFIG || {};
  if(!/^https:\/\/[^\s"'<>]+\/$/.test(cfg.SITE_URL || "")) throw new Error("config.js SITE_URL은 https://로 시작하고 /로 끝나야 합니다: " + cfg.SITE_URL);
  return cfg;
}
// 계산 문제(data/calc.js)를 area 영역에 합친 영역 목록을 돌려준다. app.js와 같은 규칙.
function loadData(root){
  const dir = path.join(root || ROOT, "data");
  const files = ORDER.map(id => path.join(dir, id + ".js")).filter(f => fs.existsSync(f));
  const calc = path.join(dir, "calc.js");
  const w = runFiles(fs.existsSync(calc) ? files.concat(calc) : files);
  const D = w.QUIZ_DATA || {};
  const C = w.CALC_DATA || {questions:[]};
  C.questions.forEach(q => { if(D[q.area] && !D[q.area].questions.some(x => x.id === q.id)) D[q.area].questions.push(q); });
  return ORDER.filter(id => D[id] && Array.isArray(D[id].questions)).map(id => D[id]);
}
module.exports = {ROOT, ORDER, SUBJECTS, loadConfig, loadData};
