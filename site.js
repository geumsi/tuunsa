// 사이트 이름·문의처·하단 고지·사례 기준일 문구. 브라우저(app.js)와 node 도구(tools/)가 같이 쓴다.
// 고지 문구는 법률팀 초안(docs/teams/legal-terms.md)을 따른다.
(function(root){
"use strict";
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const name = c => (c && typeof c.SITE_NAME === "string" && c.SITE_NAME.trim()) || "투운사 모의고사";
// 통합 브랜드가 정해지면 운영 주체·og:site_name으로 쓴다.
const brand = c => (c && typeof c.BRAND === "string" && c.BRAND.trim()) || "";
const owner = c => brand(c) || name(c);
const brandSub = c => brand(c) && c && typeof c.BRAND_SUB === "string" ? c.BRAND_SUB.trim() : "";
// 제목 끝에 붙이는 이름: "투운사 모의고사 | 금시초문". 브랜드가 없으면 사이트 이름만
const fullName = c => brand(c) ? `${name(c)} | ${brand(c)}` : name(c);
const contact = c => c && typeof c.CONTACT === "string" && /^[^\s@<>"'&]+@[^\s@<>"'&]+\.[A-Za-z]{2,}$/.test(c.CONTACT) ? c.CONTACT : "";
const contactHtml = c => contact(c) ? `<a href="mailto:${esc(contact(c))}">${esc(contact(c))}</a>` : "문의 메일(준비 중)";
const validDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
// 한글 조사: 마지막 글자에 받침이 있으면 a(은·을·이), 없으면 b(는·를·가). 한글이 아니면 b
const josa = (w, a, b) => { const ch = String(w).trim().slice(-1).charCodeAt(0) - 0xAC00; return ch >= 0 && ch <= 11171 && ch % 28 ? a : b; };
// 정정 요청 메일 링크. 문의 메일이 없으면 "준비 중" 글자만
function fixHtml(c, about, label){
  if(!contact(c)) return "문의 메일(준비 중)";
  const body = `대상: ${about}\n사실과 다르다고 보는 부분과 바른 내용:\n근거 자료(링크나 사본):\n처리 결과를 받을 연락처:\n`;
  return `<a href="mailto:${esc(contact(c))}?subject=${encodeURIComponent("[정정 요청] " + name(c))}&amp;body=${encodeURIComponent(body)}">${esc(label || "정정 요청 메일 보내기")}</a>`;
}
// 모든 화면 하단 고지(법률팀 2라운드 문구). up: 사이트 루트까지의 상대 경로("" 또는 "../../")
const footerHtml = (c, up) => `<p>${esc(owner(c))}${josa(owner(c), "은", "는")} 개인이 운영하는 비공식 학습 사이트이며 각 자격시험 시행기관과 관련이 없습니다. 시험 공부용 자료이며 투자 권유가 아닙니다.</p>
    <p class="footlinks"><a href="${up}terms.html">이용약관</a> · <a href="${up}privacy.html">개인정보처리방침</a> · ${contact(c) ? `<a href="mailto:${esc(contact(c))}">문의</a>` : `<span>문의(준비 중)</span>`}</p>`;
// 실제 사례 박스 하단 문구. 사례에 checked(YYYY-MM-DD)가 있으면 그 날짜, 없으면 config CASES_CHECKED
// about: 정정 요청 메일 본문에 미리 채울 대상(페이지 주소·문제 id·사례 제목)
const caseNote = (c, cs, about) => {
  const d = validDate(cs && cs.checked) || validDate(c && c.CASES_CHECKED);
  return `공개 보도와 감독기관 발표를 요약한 내용입니다${d ? `(기준일 ${d})` : ""}. 이후 바뀐 내용이 있을 수 있습니다. 정정 요청: ${fixHtml(c, about || (cs && cs.title) || "", "메일 보내기")}`;
};
const api = {esc, name, brand, brandSub, fullName, owner, contact, contactHtml, footerHtml, caseNote, fixHtml, josa};
root.TuunsaSite = api;
if(typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
