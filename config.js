// 사이트 설정. 이름·도메인·광고 네트워크가 정해지면 이 파일만 고친다.
// 고친 뒤에는 `node tools/sync-site.js`로 index.html head, privacy·terms·404, manifest, robots, sitemap, ads.txt를 다시 만든다.
window.SITE_CONFIG = {
  SITE_NAME: "투운사 모의고사",   // 이 시험 사이트 이름
  BRAND: null,                     // 여러 자격증을 묶는 통합 브랜드 이름. 정해지면 문자열
  SITE_URL: "https://jeongtai.github.io/tuunsa-quiz/",   // 끝의 / 포함. 자체 도메인이면 https://도메인/
  // provider: null이면 광고 코드를 일절 그리거나 불러오지 않는다.
  //   "adsense": client "ca-pub-숫자", slots 값은 광고 단위 번호(숫자)
  //   "adfit":   client 불필요, slots 값은 광고 단위 ID("DAN-...")
  // slots 값은 문자열 또는 {id, w, h}. h는 레이아웃 흔들림을 막는 최소 높이(px). 빈 문자열이면 그 자리는 끈다.
  // 업무모드·화면 가리기 중에는 provider와 상관없이 광고를 그리지도 불러오지도 않는다.
  ADS: {
    provider: null,
    client: "",
    minRefreshSec: 30,   // 같은 광고 자리를 다시 요청하기까지 최소 간격(초). 30 미만은 30으로 올린다
    slots: {
      quiz: "",       // 문제 화면, 답한 뒤 해설과 '다음 문제' 버튼 아래
      result: "",     // 결과 화면 맨 아래
      formulas: "",   // 공식 암기 탭 맨 아래
      calc: "",       // 계산기 사용법 탭 맨 아래
      page: ""        // 정적 문제 페이지(q/), '이 영역 이어서 풀기' 버튼 아래
    }
  },
  ANALYTICS: null,  // 아직 미사용
  CONTACT: null,    // 문의 전용 메일. 정해지면 "name@example.com". null이면 "준비 중"으로 표시
  POLICY_DATE: null,  // 개인정보처리방침·이용약관 시행일 "YYYY-MM-DD". null이면 "게시 전 확정"으로 표시
  CASES_CHECKED: "2026-11-03"   // 실제 사례 출처를 확인한 날(사례 박스 '기준일'). 사례를 다시 확인하면 고친다
};
