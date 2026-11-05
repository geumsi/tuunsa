#!/usr/bin/env node
// config.js SITE_URL을 정적 파일에 반영한다. 지금 주소는 index.html canonical에서 읽는다.
// 사용: node tools/sync-site-url.js [--dry]
"use strict";
const fs = require("fs");
const path = require("path");
const {ROOT, loadConfig} = require("./lib");

const FILES = ["index.html", "404.html", "privacy.html", "terms.html", "robots.txt", "sitemap.xml"];
const dry = process.argv.includes("--dry");
const next = loadConfig().SITE_URL;
const m = /<link rel="canonical" href="([^"]+)">/.exec(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
if(!m) { console.error("index.html에서 canonical을 찾지 못했습니다."); process.exit(1); }
const prev = m[1];
if(prev === next){ console.log("이미 같은 주소입니다: " + next); process.exit(0); }
FILES.forEach(f => {
  const p = path.join(ROOT, f);
  if(!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, "utf8"), n = s.split(prev).length - 1;
  if(!n) return;
  if(!dry) fs.writeFileSync(p, s.split(prev).join(next));
  console.log(`${dry ? "(dry) " : ""}${f}: ${n}곳 ${prev} → ${next}`);
});
