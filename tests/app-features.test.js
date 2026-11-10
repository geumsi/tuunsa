// 패스, 찍어서 맞음, 오답 분석, 해설의 개념·그림·용어집(app.js를 가짜 브라우저에서 띄워 확인)
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const {boot, text} = require("./harness.js");

const sess = (qid, extra) => JSON.stringify(Object.assign({mode:"area", title:"세제", i:0, ans:{}, startedAt:7,
  items:[{qid, order:[0,1,2,3]}, {qid:"s1_tax_002", order:[0,1,2,3]}]}, extra || {}));
// s1_tax_001의 정답은 보기 0(증권거래세)이다
const startQuiz = app => app.els.resume.onclick();

test("패스: 정답과 해설을 바로 보여 주고 틀린 것으로 기록(w+1, last 0, p+1)", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")});
  startQuiz(app);
  assert.ok(app.view().includes('id="pass"') && app.view().includes("모르겠어요 (패스)"));
  app.els.pass.onclick();
  const v = app.view();
  assert.ok(v.includes("패스") && v.includes('class="explain"') && !v.includes('id="pass"'));
  assert.deepStrictEqual(Object.assign({}, app.stats().s1_tax_001, {t:0}), {c:0, w:1, p:1, last:0, lk:"p", t:0});
  assert.strictEqual(JSON.parse(app.store["tuunsa-session"]).ans[0], -1);
});
test("키보드 0과 P는 패스", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")});
  startQuiz(app); app.key("p");
  assert.strictEqual(app.stats().s1_tax_001.p, 1);
  app.key("Enter"); app.key("0");
  assert.strictEqual(app.stats().s1_tax_002.p, 1);
});
test("찍어서 맞음 토글: 켜면 오답노트(last 0, g+1), 끄면 되돌림", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")});
  startQuiz(app); app.key("1");
  assert.ok(app.view().includes("찍어서 맞았어요, 오답노트에 넣기"));
  assert.strictEqual(app.stats().s1_tax_001.last, 1);
  app.els.guess.onchange({target:{checked:true}});
  let st = app.stats().s1_tax_001;
  assert.deepStrictEqual([st.c, st.w, st.last, st.g, st.lk], [1, 0, 0, 1, "g"]);
  assert.deepStrictEqual(JSON.parse(app.store["tuunsa-session"]).guess, {0:true});
  app.els.guess.onchange({target:{checked:false}});
  st = app.stats().s1_tax_001;
  assert.deepStrictEqual([st.last, st.g, st.lk], [1, 0, "o"]);
});
test("결과 화면: 패스는 오답으로 채점하고 따로 표시", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")});
  startQuiz(app); app.key("p"); app.key("Enter"); app.key("p"); app.key("Enter");
  const v = app.view();
  assert.ok(v.includes("<b>0</b>") && v.includes("패스 2문제(오답으로 채점)"));
  assert.ok(text(v).includes("틀린 2문제 다시 풀기"));
});
test("예전 기록(p·g·lk 없음)과 예전 세션은 그대로 열린다", () => {
  const old = {s1_tax_001:{c:2, w:1, last:1, t:5}};
  const app = boot({"tuunsa-stats": JSON.stringify(old), "tuunsa-session": sess("s1_tax_001")});
  assert.ok(app.view().includes('id="resume"'));
  startQuiz(app); app.key("2");
  const st = app.stats().s1_tax_001;
  assert.deepStrictEqual([st.c, st.w, st.lk], [2, 2, "x"]);
});

const many = {
  s1_tax_001:{c:0, w:1, last:0, t:1, lk:"x"}, s1_tax_002:{c:1, w:2, last:0, t:2, p:1, lk:"p"},
  s1_tax_003:{c:0, w:4, last:0, t:3, p:2, lk:"p"}, s3_bond_001:{c:3, w:1, last:1, t:4, lk:"o"}, s3_bond_002:{c:2, w:0, last:1, t:5}
};
test("오답 분석: 틀린 횟수별 묶음(1번, 2번, 3번 이상)과 영역별 오답률", () => {
  const app = boot({"tuunsa-stats": JSON.stringify(many)}, {hash:"#review"});
  const v = text(app.view());
  assert.ok(v.includes("1번 틀림 2문제") && v.includes("2번 틀림 1문제") && v.includes("3번 이상 틀림 1문제"), v.slice(0, 400));
  assert.ok(v.includes("틀림 4 · 맞음 0 · 패스 2 · 최근 패스"));
  // 세제 7/8 = 88%, 채권 1/6 = 17%
  assert.ok(v.indexOf("세제 및 절세전략") < v.indexOf("채권"), "오답률 높은 영역이 먼저");
  assert.ok(v.includes("오답률 88%") && v.includes("오답률 17%"));
  assert.ok(!app.view().includes('class="ad"'), "광고 없음");
});
test("오답 분석: 묶음 풀기는 그 묶음 문제로 시작", () => {
  const app = boot({"tuunsa-stats": JSON.stringify(many)}, {hash:"#review"});
  // data-group 버튼은 querySelectorAll로 묶이므로 가짜 DOM에서는 시작 함수를 직접 확인할 수 없다. 화면의 버튼 수만 확인
  assert.strictEqual((app.view().match(/data-group="/g) || []).length, 3);
});
test("오답 분석 업무모드: 중립 낱말", () => {
  const app = boot({"tuunsa-stats": JSON.stringify(many), "tuunsa-work":"true"}, {hash:"#review"});
  // 문제 본문 발췌(rq)는 예외라 빼고 검사
  const body = app.view().replace(/<span class="rq">[^<]*<\/span>/g, "");
  assert.deepStrictEqual(["오답", "틀림", "맞음", "패스", "시험", "모의고사", "문제"].filter(w => text(body).includes(w)), []);
  assert.ok(text(body).includes("재확인 현황") && text(body).includes("불일치 3회 이상"));
});
test("첫 화면에 오답 분석 버튼은 틀린 기록이 있을 때만", () => {
  assert.ok(!boot({}).view().includes('href="#review"'));
  assert.ok(boot({"tuunsa-stats": JSON.stringify(many)}).view().includes('href="#review"'));
});

// 데이터 파일은 고치지 않고, app.js 실행 직전에 그림·용어집과 개념 필드를 덧붙인다
const BEFORE = `window.FIGURES = {f1:{title:"세금 구분", svg:'<svg viewBox="0 0 10 10" onload="x()"><path stroke="currentColor" d="M0 0L10 10"/></svg>', caption:"국세와 지방세"}};
window.GLOSSARY = {"증권거래세":{ko:"주식 팔 때 내는 세금"}, "VaR":{full:"Value at Risk"}};
const q = window.QUIZ_DATA.s1_tax.questions.find(x => x.id === "s1_tax_001");
q.concept = "간접세 개념\\n$ 세액 = 양도가액 × 세율"; q.fig = ["f1", "없는그림"];`;
test("해설: 개념 상자와 그림이 맨 앞, 용어 풀이는 해설 영역에서 한 번만, 문제·보기에는 붙지 않음", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")}, {beforeApp: BEFORE});
  startQuiz(app);
  assert.ok(!app.view().includes("gloss"), "답하기 전(문제·보기)에는 풀이 없음");
  app.key("1");
  const v = app.view();
  const ex = v.slice(v.indexOf('class="explain"'));
  assert.ok(ex.indexOf('class="concept"') < ex.indexOf("<figure") && ex.indexOf("<figure") < ex.indexOf("<h3>해설</h3>"));
  assert.ok(ex.includes('<div class="fx">세액 = 양도가액 × 세율</div>'));
  assert.ok(!/onload/.test(v), "그림 이벤트 속성 제거");
  assert.strictEqual((v.match(/<figure/g) || []).length, 1, "없는 그림 id는 건너뜀");
  assert.strictEqual((v.match(/class="gloss"/g) || []).length, 1, "약어마다 처음 한 번만");
  assert.ok(!/<button class="choice[^>]*>[^]*?gloss[^]*?<\/button>/.test(v.slice(0, v.indexOf('class="explain"'))), "보기 버튼에는 붙지 않음");
});
test("그림·용어집 파일이 없어도 해설이 그대로 나온다", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")}, {beforeApp: "delete window.FIGURES; delete window.GLOSSARY;"});
  startQuiz(app); app.key("1");
  assert.ok(app.view().includes("<h3>해설</h3>") && !app.view().includes("gloss") && !app.view().includes("<figure"));
});
test("앱: 계산 문제·일반 문제 모두 문제 영역으로 용어집 뜻을 고른다", () => {
  const before = `window.GLOSSARY = {PD:{byArea:{s1_tax:{full:"테스트용 PD"}}}};
  const q = window.QUIZ_DATA.s1_tax.questions.find(x => x.id === "s1_tax_001"); q.explain = "PD 설명";`;
  const app = boot({"tuunsa-session": sess("s1_tax_001")}, {beforeApp: before});
  startQuiz(app); app.key("1");
  assert.ok(app.view().includes("(테스트용 PD)"));
});
