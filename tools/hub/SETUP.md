결론 1: 호스팅은 GitHub 조직 geumsi로 옮긴다. 허브 저장소는 geumsi/geumsi.github.io이고 여기에 geumsi.com을 연결한다. 이 사이트는 geumsi/tuunsa이고 geumsi.com/tuunsa/로 열린다.
결론 2: 이 폴더(tools/hub/)의 index.html, robots.txt, ads.txt, CNAME은 허브 저장소 루트로 복사할 파일이다. `node tools/sync-site.js`가 config.js 값으로 다시 만든다. 이 저장소 루트에는 CNAME을 두지 않는다.
결론 3: 주소는 README의 명령 한 줄로 바꾼다. 조직으로 옮긴 직후에는 geumsi.github.io/tuunsa/, 도메인을 연결한 뒤에는 geumsi.com/tuunsa/로 바꾼다.

# 허브와 도메인 연결 (조직 geumsi)

작성 2026-11-05, 개발팀. 모든 작업은 오너가 한다(조직 생성, 저장소, DNS, push).

## 구조

- https://geumsi.com/ : geumsi/geumsi.github.io (허브. 자격증 목록, ads.txt, robots.txt)
- https://geumsi.com/tuunsa/ : geumsi/tuunsa (투운사 모의고사)
- 자격증을 늘리면 조직에 저장소를 하나 더 만들고 geumsi.com/저장소이름/으로 연다
- 근거: 조직 사이트(geumsi.github.io)에 커스텀 도메인을 걸면 "that same custom domain will be used for all project sites owned by the same account"
  - 출처: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages (2026-11-05 확인)
- 조직 사이트 저장소 이름은 `<organization>.github.io` 형식이어야 한다
  - 출처: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages (2026-11-05 확인)
- 무료 조직(GitHub Free for organizations)에서는 Pages 저장소가 공개여야 한다
  - 출처: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site (2026-11-05 확인)

## 순서

1. GitHub 무료 조직 geumsi 만들기
2. 도메인 소유 확인: 조직 Settings > Pages에서 geumsi.com을 추가하고 안내된 TXT 레코드를 DNS에 넣는다. 레코드 이름은 `_github-pages-challenge-geumsi.geumsi.com` 형식이다. 확인 명령은 `dig _github-pages-challenge-geumsi.geumsi.com +nostats +nocomments +nocmd TXT`이다.
   - 출처: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages (2026-11-05 확인)
3. DNS
   - geumsi.com A 레코드 4개: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - IPv6를 쓰면 AAAA 4개: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
   - www.geumsi.com CNAME 레코드 → geumsi.github.io
   - 출처: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site (2026-11-05 확인)
4. 이 사이트를 geumsi/tuunsa로 옮기고 Pages를 켠다. 직후 임시 주소로 맞춘다.
   - `node tools/sync-site.js --url https://geumsi.github.io/tuunsa/ && node tools/build-pages.js`
5. 허브 저장소 geumsi/geumsi.github.io를 공개로 만든다. 이 폴더의 index.html, robots.txt, ads.txt를 루트로 복사하고 Pages를 켠다.
6. 도메인을 연결한다. 이 저장소에서 아래 명령을 실행하면 tools/hub/CNAME(geumsi.com)이 생긴다. 이 폴더 파일을 허브 저장소 루트로 다시 복사한다.
   - `node tools/sync-site.js --url https://geumsi.com/tuunsa/ --cname && node tools/build-pages.js`
7. 허브 저장소 Settings > Pages에서 Custom domain이 geumsi.com인지 확인하고 Enforce HTTPS를 켠다.
8. 확인
   - https://geumsi.com/ 에 자격증 목록이 뜨는지
   - https://geumsi.com/tuunsa/ 에서 문제가 풀리는지, 콘솔 에러가 없는지
   - https://geumsi.com/ads.txt, https://geumsi.com/robots.txt 가 열리는지
   - https://geumsi.github.io/tuunsa/ 가 geumsi.com/tuunsa/로 넘어가는지(원문 미확인이라 직접 열어 기록한다)

## 주의

- 이 저장소 루트에 CNAME을 두면 이 사이트만 따로 도메인에 묶여 허브 구조가 깨진다. `sync-site --cname`은 tools/hub/CNAME만 만들고, 루트에 CNAME이 있으면 오류를 낸다.
- 허브와 조직의 모든 자격증 사이트가 geumsi.com 출처(origin)를 함께 쓴다. localStorage도 함께 쓰므로 새 사이트는 tuunsa-가 아닌 다른 키 접두어를 쓴다. 이 사이트는 읽은 값을 state.js로 검증한다.
- 이 저장소의 robots.txt와 ads.txt는 /tuunsa/ 아래라서 효력이 없다. 효력이 있는 것은 허브 루트 파일이다.
- GitHub Pages 이용 제한: "not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions..." 광고가 붙은 학습 사이트를 직접 다룬 문장은 없다(해석은 가정).
  - 출처: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits (2026-11-05 확인)
