#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";

const BGM_API = "https://api.bgm.tv";
const DEFAULT_SIZE = "common";
const VALID_SIZES = new Set(["small", "grid", "large", "medium", "common"]);

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

const options = {
  size: DEFAULT_SIZE,
  dump: process.env.BGM_SUBJECT_DUMP || "",
  json: false,
  all: false,
};
const ids = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--size") {
    options.size = readOptionValue(args, ++i, "--size");
  } else if (arg === "--dump") {
    options.dump = readOptionValue(args, ++i, "--dump");
  } else if (arg === "--json") {
    options.json = true;
  } else if (arg === "--all") {
    options.all = true;
  } else if (arg.startsWith("--")) {
    fail(`未知参数：${arg}`);
  } else {
    ids.push(...arg.split(",").map((value) => value.trim()).filter(Boolean));
  }
}

if (!VALID_SIZES.has(options.size)) {
  fail(`无效尺寸：${options.size}。可用尺寸：${[...VALID_SIZES].join(", ")}`);
}

const normalizedIds = [...new Set(ids.map(normalizeSubjectId))];
if (normalizedIds.length === 0) fail("请提供至少一个 Bangumi subject id");

const dumpSubjects = options.dump
  ? await readSubjectsFromDump(options.dump, normalizedIds)
  : new Map();

const results = [];
for (const id of normalizedIds) {
  const subject = await fetchSubject(id);
  const images = subject.images || {};
  results.push({
    id,
    name: subject.name || dumpSubjects.get(id)?.name || "",
    name_cn: subject.name_cn || dumpSubjects.get(id)?.name_cn || "",
    cover: options.all ? images : images[options.size] || "",
  });
}

if (options.json || options.all) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const result of results) {
    const title = result.name_cn || result.name || `Bangumi ${result.id}`;
    console.log(`${result.id}\t${title}\t${result.cover}`);
  }
}

function printUsage() {
  console.log(`用法:
  npm run bgm-cover -- 245665
  npm run bgm-cover -- 245665 --size large
  npm run bgm-cover -- 245665,328609 --all
  npm run bgm-cover -- 245665 --dump "C:\\Users\\Hu_care\\Downloads\\dump-2026-05-19.210434Z\\subject.jsonlines"

说明:
  --size small|grid|large|medium|common，默认 common，对应 /r/400/
  --all 输出 Bangumi API 返回的全部 images 字段
  --dump 只用于从本地 dump 校验/补充条目名，封面 hash 不在 dump 里
`);
}

function readOptionValue(values, index, name) {
  const value = values[index];
  if (!value || value.startsWith("--")) fail(`${name} 缺少参数值`);
  return value;
}

function normalizeSubjectId(value) {
  if (!/^\d+$/.test(value)) fail(`无效 Bangumi subject id：${value}`);
  return String(Number(value));
}

async function readSubjectsFromDump(dumpPath, wantedIds) {
  if (!fs.existsSync(dumpPath)) fail(`找不到 dump 文件：${dumpPath}`);

  const wanted = new Set(wantedIds);
  const found = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(dumpPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const idMatch = line.match(/^\{"id":(\d+),/);
    if (!idMatch || !wanted.has(idMatch[1])) continue;

    const subject = JSON.parse(line);
    found.set(String(subject.id), {
      name: subject.name || "",
      name_cn: subject.name_cn || "",
    });

    if (found.size === wanted.size) {
      rl.close();
      break;
    }
  }

  return found;
}

async function fetchSubject(id) {
  const res = await fetch(`${BGM_API}/v0/subjects/${encodeURIComponent(id)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AnimeScreenshotPicker/1.0 (cover-url-helper)",
    },
  });

  if (!res.ok) {
    throw new Error(`Bangumi API 请求失败：subject ${id}, HTTP ${res.status}`);
  }

  return res.json();
}

function fail(message) {
  console.error(message);
  printUsage();
  process.exit(1);
}
