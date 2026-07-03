#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const input = args[0] || process.env.BGM_SUBJECT_DUMP || "";
const output = args[1] || path.join("public", "bangumi_anime_subjects.jsonl");
const minDone = Number(process.env.BGM_MIN_DONE || 100) || 0;

if (!input || args.includes("--help") || args.includes("-h")) {
  console.log(`用法:
  node scripts/build-bangumi-anime-subjects.mjs <subject.jsonlines> [output.jsonl]

示例:
  node scripts/build-bangumi-anime-subjects.mjs "C:\\Users\\Hu_care\\Downloads\\dump-2026-05-19.210434Z\\subject.jsonlines"

默认只保留 Bangumi 看过人数 >= 100 的动画。可用环境变量 BGM_MIN_DONE 覆盖。
`);
  process.exit(input ? 0 : 1);
}

if (!fs.existsSync(input)) {
  console.error(`找不到输入文件：${input}`);
  process.exit(1);
}

await fs.promises.mkdir(path.dirname(output), { recursive: true });

const reader = readline.createInterface({
  input: fs.createReadStream(input, { encoding: "utf8" }),
  crlfDelay: Infinity,
});
const writer = fs.createWriteStream(output, { encoding: "utf8" });

let total = 0;
let animeCount = 0;

for await (const line of reader) {
  total += 1;
  if (!line.includes('"type":2')) continue;

  let raw;
  try {
    raw = JSON.parse(line);
  } catch {
    continue;
  }

  if (raw.type !== 2 || !raw.id) continue;

  const doneCount = Number(raw.favorite?.done || 0) || 0;
  if (doneCount < minDone) continue;

  const record = {
    bgm_id: String(raw.id),
    name: clean(raw.name),
    name_cn: clean(raw.name_cn),
    label_text: clean(raw.name_cn || raw.name || `Bangumi ${raw.id}`),
    date: clean(raw.date),
    done_count: doneCount,
    rating_count: sumScoreDetails(raw.score_details),
  };

  writer.write(`${JSON.stringify(record)}\n`);
  animeCount += 1;

  if (total % 10000 === 0) {
    await new Promise((resolve) => writer.write("", resolve));
  }
}

await new Promise((resolve, reject) => {
  writer.end(resolve);
  writer.on("error", reject);
});

console.log(`已写入 ${animeCount} 个动画条目：${output}（看过人数 >= ${minDone}）`);

function clean(value) {
  return String(value || "").trim();
}

function sumScoreDetails(details) {
  if (!details || typeof details !== "object") return 0;
  return Object.values(details).reduce((sum, value) => sum + (Number(value) || 0), 0);
}
