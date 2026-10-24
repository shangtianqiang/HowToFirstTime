import { readFile } from 'node:fs/promises';
import { root, walkAllMarkdown } from './lib.mjs';

const files = await walkAllMarkdown(root);
const urls = new Set();

for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/https?:\/\/[^\s()<>"']+/g)) {
    let url = match[0].replace(/[.,;:]+$/, '');
    if (url.includes('…') || url.includes('...')) continue;
    if (url.includes('example.com') || url.includes('localhost') || url.includes('127.0.0.1')) continue;
    urls.add(url);
  }
}

const list = [...urls];
const results = [];

async function check(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml',
  };

  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers });
    if ([403, 404, 405, 501].includes(response.status)) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    }
    return { url, status: response.status };
  } catch (error) {
    return { url, status: 0, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

let cursor = 0;
const workers = Array.from({ length: 5 }, async () => {
  while (cursor < list.length) {
    const url = list[cursor];
    cursor += 1;
    results.push(await check(url));
  }
});

await Promise.all(workers);

const OK_STATUS = new Set([200, 201, 204, 301, 302, 307, 308, 403, 405]);
const broken = results.filter((item) => item.status === 404 || item.status === 410);
const unreachable = results.filter(
  (item) => item.status === 0 || (!OK_STATUS.has(item.status) && item.status !== 404 && item.status !== 410),
);

for (const item of results.sort((a, b) => a.url.localeCompare(b.url))) {
  const state = item.status === 0 ? `连不上：${item.error}` : `HTTP ${item.status}`;
  console.log(`${state}  ${item.url}`);
}

if (unreachable.length) {
  console.warn(`\n提醒：${unreachable.length} 个链接返回了非 404/410 的异常状态，先人工看一眼，不阻断。`);
}

if (broken.length) {
  console.error(`\n链接检查失败：${broken.length} 个链接确定失效（404/410）。`);
  for (const item of broken) console.error(`- ${item.url}`);
  process.exit(1);
}

console.log(`\n链接检查通过：共 ${list.length} 个链接，没有 404/410。`);
