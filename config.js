// 사이트 설정. 도메인·광고 네트워크가 정해지면 이 파일만 고친다.
// SITE_URL을 바꾼 뒤에는 `node tools/sync-site-url.js`로 index.html 등 정적 파일의 주소도 맞춘다.
window.SITE_CONFIG = {
  SITE_URL: "https://jeongtai.github.io/tuunsa-quiz/",   // 끝의 / 포함
  // provider: null이면 광고 코드를 일절 그리거나 불러오지 않는다.
  //   "adsense": client "ca-pub-숫자", slots 값은 광고 단위 번호(숫자)
  //   "adfit":   client 불필요, slots 값은 광고 단위 ID("DAN-...")
  // slots 값은 문자열 또는 {id, w, h}. h는 레이아웃 흔들림을 막는 최소 높이(px)
  ADS: {
    provider: null,
    client: "",
    slots: {
      quiz: "",     // 문제 화면, 해설과 '다음 문제' 버튼 아래
      result: ""    // 결과 화면 맨 아래
    }
  },
  ANALYTICS: null,  // 아직 미사용. 정해지면 2라운드에 연결
  CONTACT: null     // 문의 메일 등. 문자열이면 푸터에 표시
};
