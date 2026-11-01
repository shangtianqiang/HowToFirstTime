// 清单校验：验证每份可打印清单的任务条目都出自其关联正文
// 硬错误（退出码 1）：链接失效、正文缺失、条目中出现正文没有的数字
// 警告（不阻断）：条目与正文的用字重合度过低（bigram 支撑度）
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { root, parseFrontMatter } from './lib.mjs';

const checklistsDir = join(root, 'checklists');

function cjkRuns(text) {
  return text.match(/[\u4e00-\u9fff]+/g) || [];
}

function bigrams(text) {
  const set = new Set();
  for (const run of cjkRuns(text)) {
    for (let i = 0; i < run.length - 1; i += 1) set.add(run.slice(i, i + 2));
  }
  return set;
}

// 提取数字（含小数），如 10 / 2.6 / 2026
function numbers(text) {
  return text.match(/\d+(?:\.\d+)?/g) || [];
}

function normalize(text) {
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '') // frontmatter
    .replace(/```[\s\S]*?```/g, ' '); // 代码块
}

const files = (await readdir(checklistsDir)).filter((f) => f.endsWith('.md')).sort();

const hardErrors = [];
const warnings = [];
let okCount = 0;
let totalItems = 0;
let checkedNumbers = 0;

for (const file of files) {
  const path = join(checklistsDir, file);
  const text = await readFile(path, 'utf8');
  const rel = relative(root, path).replaceAll('\\', '/');

  // 1) 标题与条目
  const titleMatch = text.match(/^# (.+)$/m);
  if (!titleMatch) {
    hardErrors.push(`${rel}: 缺少一级标题`);
    continue;
  }
  const idMatch = titleMatch[1].match(/^([A-J]-\d{2})/);
  if (!idMatch) {
    hardErrors.push(`${rel}: 一级标题未以条目 ID 开头（${titleMatch[1]}）`);
    continue;
  }
  const id = idMatch[1];

  const items = [...text.matchAll(/^\s*[-*] \[( |x)\] (.+)$/gm)].map((m) => m[2]);
  totalItems += items.length;

  // 2) 关联正文
  const linkTargets = [...text.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1])
    .filter((t) => !/^https?:/.test(t));
  for (const target of linkTargets) {
    const resolved = resolve(dirname(path), target);
    try {
      await readFile(resolved);
    } catch {
      hardErrors.push(`${rel}: 链接目标不存在 ${target}`);
    }
  }
  const articleLink = linkTargets.find((t) => t.includes('/book/'));
  if (!articleLink) {
    hardErrors.push(`${rel}: 未找到指向 book/ 正文的链接`);
    continue;
  }
  const articlePath = resolve(dirname(path), articleLink);
  let articleText;
  try {
    articleText = normalize(await readFile(articlePath, 'utf8'));
  } catch {
    hardErrors.push(`${rel}: 正文读取失败 ${articleLink}`);
    continue;
  }

  // 3) 条目 ID 与正文 frontmatter 一致
  const articleFm = parseFrontMatter(articleText);
  if (articleFm && String(articleFm.id) !== id) {
    hardErrors.push(`${rel}: 清单 ID ${id} 与正文 ID ${articleFm.id} 不一致`);
  }

  // 4) 数字必须出自正文（防编造时限/金额）
  const articleNumbers = new Set(numbers(articleText));
  for (const item of items) {
    for (const num of numbers(item)) {
      checkedNumbers += 1;
      if (!articleNumbers.has(num)) {
        hardErrors.push(`${rel}: 条目数字「${num}」未见于正文 —— ${item.slice(0, 40)}`);
      }
    }
  }

  // 5) bigram 支撑度（启发式，仅警告）
  const articleGrams = bigrams(articleText);
  const weak = [];
  for (const item of items) {
    const grams = [...bigrams(item)];
    if (grams.length < 4) continue; // 极短条目跳过
    const hit = grams.filter((g) => articleGrams.has(g)).length;
    const ratio = hit / grams.length;
    if (ratio < 0.5) weak.push(`「${item.slice(0, 26)}」支撑度 ${(ratio * 100).toFixed(0)}%`);
  }
  if (weak.length) {
    warnings.push(`${rel}: ${weak.length}/${items.length} 条支撑度低 —— ${weak.slice(0, 3).join('；')}`);
  }

  okCount += 1;
}

console.log(`清单校验：${okCount}/${files.length} 份通过，复选框 ${totalItems} 条，数字核对 ${checkedNumbers} 处。`);

if (warnings.length) {
  console.warn(`\n警告（支撑度低，建议人工核对 ${warnings.length} 份）：`);
  for (const w of warnings) console.warn(`- ${w}`);
}

if (hardErrors.length) {
  console.error(`\n清单校验失败，共 ${hardErrors.length} 处硬错误：`);
  for (const e of hardErrors) console.error(`- ${e}`);
  process.exit(1);
}
