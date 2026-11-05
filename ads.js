// 광고 슬롯. config.js의 ADS.provider가 null이면 아무것도 그리거나 불러오지 않는다.
// 업무모드·화면 가리기 상태에서는 슬롯을 그리지 않고, 이미 있는 슬롯은 DOM에서 지운다.
// CSS로 숨기거나(display:none) 다른 요소로 덮지 않는다. AdSense 정책이 둘 다 금지한다.
// 지운 슬롯은 상태가 풀려도 되살리지 않고, 다음에 화면을 새로 그릴 때만 다시 그린다.
(function(root){
"use strict";
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PROVIDERS = {
  adsense: {
    validClient: c => /^ca-pub-\d{10,20}$/.test(c || ""),
    validId: id => /^\d{6,20}$/.test(id),
    h: 120,
    src: cfg => "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.client),
    ins: (cfg, s) => `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.client)}" data-ad-slot="${esc(s.id)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`,
    // 스크립트는 한 번만 넣고, 슬롯마다 push로 채운다.
    fill: () => { (root.adsbygoogle = root.adsbygoogle || []).push({}); },
    once: true
  },
  adfit: {
    validClient: () => true,
    validId: id => /^DAN-[A-Za-z0-9]{6,40}$/.test(id),
    h: 100,
    src: () => "https://t1.daumcdn.net/kas/static/ba.min.js",
    ins: (cfg, s) => `<ins class="kakao_ad_area" style="display:none" data-ad-unit="${esc(s.id)}" data-ad-width="${s.w || 320}" data-ad-height="${s.h || 100}"></ins>`,
    // 화면을 다시 그려 새로 생긴 슬롯은 스크립트를 다시 넣어야 읽힌다(가정, 공식 문서 원문 미확인).
    fill: () => {},
    once: false
  }
};
// 슬롯 설정을 {id, w, h}로 맞춘다. 잘못된 값이면 null.
function slotOf(cfg, name){
  const a = cfg && cfg.ADS, p = a && PROVIDERS[a.provider];
  if(!p || !p.validClient(a.client) || !a.slots) return null;
  let s = a.slots[name];
  if(typeof s === "string") s = {id:s};
  if(!s || typeof s.id !== "string" || !p.validId(s.id)) return null;
  const n = v => Number.isInteger(v) && v > 0 && v <= 1000 ? v : 0;
  return {id:s.id, w:n(s.w), h:n(s.h)};
}
function canShow(cfg, name, state){
  if(!state || state.work || state.cover) return false;
  return !!slotOf(cfg, name);
}
function html(cfg, name, state){
  if(!canShow(cfg, name, state)) return "";
  const p = PROVIDERS[cfg.ADS.provider], s = slotOf(cfg, name);
  return `<aside class="ad" data-ad="${esc(name)}" aria-label="광고"><span class="ad-label">광고</span><div class="ad-box" style="min-height:${s.h || p.h}px">${p.ins(cfg.ADS, s)}</div></aside>`;
}
let loaded = false;
function addScript(src){
  const sc = document.createElement("script");
  sc.async = true; sc.src = src; sc.crossOrigin = "anonymous";
  document.head.appendChild(sc);
}
// 그려진 슬롯을 채운다. 상태가 바뀌어 보여 주면 안 되는 슬롯은 지운다.
function fill(container, cfg, state){
  const slots = Array.from(container.querySelectorAll(".ad:not([data-filled])"));
  if(!slots.length) return 0;
  let n = 0;
  slots.forEach(el => {
    if(!canShow(cfg, el.dataset.ad, state)){ el.remove(); return; }
    el.dataset.filled = "";
    n++;
  });
  if(!n) return 0;
  const p = PROVIDERS[cfg.ADS.provider];
  if(!p.once || !loaded){ addScript(p.src(cfg.ADS)); loaded = true; }
  for(let i = 0; i < n; i++){ try{ p.fill(); }catch(e){} }
  return n;
}
function clear(container){ const els = container.querySelectorAll(".ad"); els.forEach(el => el.remove()); return els.length; }
// 업무모드·화면 가리기 상태가 바뀔 때 부른다. 켜질 때는 지우고, 꺼질 때는 아무것도 하지 않는다.
// 가리기 화면을 띄우기 전에 불러야 광고가 덮이는 순간이 없다.
function sync(container, state){ return state && (state.work || state.cover) ? clear(container) : 0; }
const api = {canShow, html, fill, clear, sync, slotOf, PROVIDERS};
root.TuunsaAds = api;
if(typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
