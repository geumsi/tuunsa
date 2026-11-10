// app.js를 가짜 브라우저(vm)에서 띄우는 테스트 도구. 요소는 어떤 속성을 읽어도 스스로를 돌려주는 가짜이고,
// getElementById로 얻은 요소의 onclick·onchange와 document·window에 건 이벤트 처리기를 테스트에서 직접 부를 수 있다.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");

function stub(){
  const vals = {};
  const p = new Proxy(function(){}, {
    get(t, k){
      if(k in vals) return vals[k];
      if(k === Symbol.toPrimitive) return () => "";
      if(k === "forEach") return () => {};
      if(k === "length") return 0;
      return p;
    },
    set(t, k, v){ vals[k] = v; return true; },
    apply(){ return p; }
  });
  return p;
}
// store: localStorage 초기값, opt.hash: 처음 주소 해시, opt.pre: 모든 스크립트보다 먼저, opt.beforeApp: 데이터를 읽은 뒤 app.js 직전에 실행할 코드
function boot(store, opt){
  opt = opt || {};
  const els = {}, docL = {}, winL = {};
  const doc = stub();
  const on = (m) => (type, fn) => { (m[type] = m[type] || []).push(fn); };
  const document = new Proxy(doc, {get(t, k){
    if(k === "getElementById") return id => (els[id] = els[id] || stub());
    if(k === "querySelector") return () => stub();
    if(k === "querySelectorAll") return () => [];
    if(k === "createElement") return () => stub();
    if(k === "addEventListener") return on(docL);
    return doc[k];
  }});
  const ls = {getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }};
  const win = {document, localStorage: ls, location: {hash: opt.hash || "", pathname:"/", search:""}, history: {replaceState(){}},
    addEventListener: on(winL), scrollTo(){}, setTimeout, innerHeight: 800, navigator: {}, HTMLInputElement: class {}};
  win.window = win; win.self = win; win.top = win;
  const ctx = vm.createContext(Object.assign(win, {console}));
  if(opt.pre) vm.runInContext(opt.pre, ctx);
  const order = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/<script src="([^"]+)"/g).map(m => m.slice(13, -1))
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  order.forEach(f => {
    if(f === "app.js" && opt.beforeApp) vm.runInContext(opt.beforeApp, ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, {filename: f});
  });
  return {
    els, store, ctx,
    view: () => els.view.innerHTML,
    key: (k, code) => (docL.keydown || []).forEach(fn => fn({key: k, code: code || "", preventDefault(){}, target: {}})),
    go: hash => { win.location.hash = hash; (winL.hashchange || []).forEach(fn => fn({})); },
    stats: () => JSON.parse(store["tuunsa-stats"] || "{}")
  };
}
const text = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
module.exports = {boot, text, ROOT};
