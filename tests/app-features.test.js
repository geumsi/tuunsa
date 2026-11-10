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

test("한글 자판: ㅔ와 e.code KeyP도 패스", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")});
  startQuiz(app); app.key("ㅔ", "KeyP");
  assert.strictEqual(app.stats().s1_tax_001.p, 1);
  app.key("Enter"); app.key("Process", "KeyP");   // 조합 중인 키도 code로 판정
  assert.strictEqual(app.stats().s1_tax_002.p, 1);
});
test("패스 취소: 기록을 패스 전 값으로 되돌리고 다시 고를 수 있다", () => {
  const before = {s1_tax_001:{c:2, w:1, last:1, t:5, lk:"o"}};
  const app = boot({"tuunsa-stats": JSON.stringify(before), "tuunsa-session": sess("s1_tax_001")});
  startQuiz(app); app.key("p");
  assert.ok(app.view().includes('id="unpass"'));
  assert.deepStrictEqual([app.stats().s1_tax_001.w, app.stats().s1_tax_001.p], [2, 1]);
  app.els.unpass.onclick();
  const st = app.stats().s1_tax_001;
  assert.deepStrictEqual([st.c, st.w, st.last, st.lk, st.p], [2, 1, 1, "o", undefined]);
  const ss = JSON.parse(app.store["tuunsa-session"]);
  assert.strictEqual(ss.ans[0], undefined); assert.strictEqual(ss.passUndo, undefined);
  assert.ok(app.view().includes('id="pass"') && !app.view().includes('id="unpass"'), "다시 고르는 화면");
  app.key("1");
  assert.deepStrictEqual([app.stats().s1_tax_001.c, app.stats().s1_tax_001.w], [3, 1]);
});
test("패스 취소: 처음 푼 문제면 기록을 지운다, 다음 문제로 넘어가면 취소할 수 없다", () => {
  const app = boot({"tuunsa-session": sess("s1_tax_001")});
  startQuiz(app); app.key("p"); app.els.unpass.onclick();
  assert.strictEqual(app.stats().s1_tax_001, undefined);
  app.key("p"); app.key("Enter"); app.key("ArrowLeft");
  assert.ok(!app.view().includes('id="unpass"'), "넘어갔다 돌아오면 취소 버튼 없음");
  assert.strictEqual(JSON.parse(app.store["tuunsa-session"]).passUndo, undefined);
});
test("오답 분석: 오답노트와 개수 기준을 한 줄로 설명하고 두 개수를 함께 보인다", () => {
  const app = boot({"tuunsa-stats": JSON.stringify(many)}, {hash:"#review"});
  // last 0인 기록 3개(오답노트), w>0인 기록 4개(오답 분석)
  assert.ok(text(app.view()).includes("오답노트는 최근에 틀린 문제 기준(3문제), 오답 분석은 누적으로 틀린 횟수 기준(4문제)입니다."));
});

// s3_deriv_008: 해설 "· F = S × [1 + (r − d) × t] → F − S = S × (r − d) × t" 아래에 F, S, r, d, t 모두
const VARS8 = `const q8 = window.QUIZ_DATA.s3_deriv.questions.find(x => x.id === "s3_deriv_008");
q8.vars = {F:"선물 이론가격", S:"현물가격", r:"무위험이자율", d:"배당수익률", t:"잔존기간(연)"};`;
const sess8 = extra => JSON.stringify(Object.assign({mode:"area", title:"파생", i:0, ans:{}, startedAt:7, items:[{qid:"s3_deriv_008", order:[0,1,2,3]}]}, extra || {}));
test("s3_deriv_008: 해설 공식 줄 아래에 F, S, r, d, t 풀이가 모두 나온다", () => {
  const app = boot({"tuunsa-session": sess8()}, {beforeApp: VARS8});
  startQuiz(app); app.key("p");
  const v = app.view();
  const ex = v.slice(v.indexOf("<h3>해설</h3>"));
  const m = ex.match(/F = S × \[1 \+ \(r − d\) × t\] → F − S = S × \(r − d\) × t<div class="vleg">([^<]*)<\/div>/);
  assert.ok(m, "공식 줄 바로 아래 범례");
  ["F: 선물 이론가격", "S: 현물가격", "r: 무위험이자율", "d: 배당수익률", "t: 잔존기간(연)"].forEach(x => assert.ok(m[1].includes(x), x));
  const concept = v.slice(v.indexOf('class="concept"'), v.indexOf("<h3>해설</h3>"));
  assert.ok(!concept.includes("vleg"), "개념 칸에는 붙이지 않음");
  assert.ok(!v.slice(0, v.indexOf('class="explain"')).includes("vleg"), "문제 본문과 보기에는 붙이지 않음");
});
test("보기 표시가 공식이면 보기별 해설 첫 줄 아래에 붙인다", () => {
  const app = boot({"tuunsa-session": sess8()}, {beforeApp: VARS8 + `q8.choices = q8.choices.slice(); q8.choices[1] = "F − S = S × (r − d) × t";`});
  startQuiz(app); app.key("p");
  const v = app.view(), notes = v.slice(v.indexOf('class="cnotes"'));
  assert.ok(/<span class="ctext">F − S = S × \(r − d\) × t<\/span>(<span[^>]*>[^<]*<\/span>)?<\/div><div class="vleg">F: 선물 이론가격/.test(notes));
  const choicesArea = v.slice(0, v.indexOf('class="explain"'));
  assert.ok(!choicesArea.includes("vleg"));
});
test("vars가 없으면 해설 화면이 이전과 같다(범례 없음)", () => {
  const app = boot({"tuunsa-session": sess8()}, {beforeApp: `delete window.QUIZ_DATA.s3_deriv.questions.find(x => x.id === "s3_deriv_008").vars;`});
  startQuiz(app); app.key("p");
  assert.ok(!app.view().includes("vleg"));
});

// 실제 데이터와 실제 용어집(data/glossary.js)으로 확인
const sessQ = qid => JSON.stringify({mode:"area", title:"t", i:0, ans:{}, startedAt:7, items:[{qid, order:[0,1,2,3]}]});
test("s2_risk_033 암기 'EL = EAD × PD × LGD' 아래에 EL·EAD·PD·LGD 뜻(PD는 리스크관리 뜻)", () => {
  const app = boot({"tuunsa-session": sessQ("s2_risk_033")});
  startQuiz(app); app.key("p");
  const v = app.view(), memo = v.slice(v.indexOf('class="memo"'));
  const m = memo.match(/예상손실\(EL\) = EAD × PD × LGD<div class="vleg">([^<]*)<\/div>/);
  assert.ok(m, "공식 줄 바로 아래 범례");
  ["EL: 예상손실", "EAD: 부도시 익스포저", "PD: 부도확률", "LGD: 부도시 손실률"].forEach(x => assert.ok(m[1].includes(x), x + " / " + m[1]));
});
test("s1_realestate_008 암기 'DSCR = 순운용소득 / 부채상환액' 아래에 DSCR 뜻", () => {
  const app = boot({"tuunsa-session": sessQ("s1_realestate_008")});
  startQuiz(app); app.key("p");
  const v = app.view();
  assert.ok(/DSCR = 순운용소득 \/ 부채상환액<div class="vleg">DSCR: 부채상환비율\(부채감당률\)<\/div>/.test(v));
});
