import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { marked } from 'marked';
import { root, parseFrontMatter } from './lib.mjs';

const VOLATILITY = { S: '稳定', M: '易变', H: '高频变动' };
const RISK_CLASS = { '低': 'risk-low', '中': 'risk-mid', '高': 'risk-high' };

async function walkMarkdown(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMarkdown(full)));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

const allFiles = (await walkMarkdown(root)).sort();

const pages = [];
for (const file of allFiles) {
  const text = await readFile(file, 'utf8');
  const fm = parseFrontMatter(text) || {};
  const isArticle = Boolean(fm.id && /^[A-J]-\d{2}$/.test(String(fm.id)));
  pages.push({ file, relativePath: relative(root, file).replaceAll('\\', '/'), text, fm, isArticle });
}

const articles = pages
  .filter((page) => page.isArticle)
  .sort((a, b) => String(a.fm.id).localeCompare(String(b.fm.id)));
const articleIndex = new Map(articles.map((page, i) => [page.fm.id, i]));

function renderMarkdown(text) {
  let html = marked.parse(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''), { gfm: true });

  const headings = [];
  let sectionNo = 0;
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    const id = `sec-${sectionNo}`;
    headings.push({ id, text: inner.replace(/<[^>]+>/g, '').trim() });
    sectionNo += 1;
    return `<h2 id="${id}">${inner}</h2>`;
  });

  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replaceAll(/((?:href|src)="[^"]*)\.md(")/g, '$1.html$2');
  html = html.replaceAll('.md</a>', '.html</a>');

  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/);
  const title = h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : '';
  if (h1) html = html.replace(h1[0], '');

  return { html, headings, title };
}

const CSS = `
  :root {
    --green-900: #1E3A2B;
    --green-800: #284B37;
    --green-700: #34644A;
    --green-link: #2F6B3F;
    --lime: #D9EDBD;
    --green-soft: #E6F1D4;
    --paper: #FBFAF5;
    --card: #FFFFFF;
    --ink: #22301F;
    --muted: #5D6B5A;
    --line: #E7E3D6;
    --serif: "Songti SC", "Noto Serif SC", Georgia, serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
    line-height: 1.85;
    font-size: 15.5px;
  }
  a { color: var(--green-link); text-decoration-thickness: 1px; text-underline-offset: 3px; }
  :focus-visible { outline: 2px solid var(--green-700); outline-offset: 2px; border-radius: 4px; }

  .topbar {
    background: var(--green-900);
    color: #fff;
    position: sticky;
    top: 0;
    z-index: 20;
    box-shadow: 0 6px 20px rgba(21, 42, 29, .18);
  }
  .topbar-in {
    width: min(880px, calc(100% - 32px));
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 9px;
    color: #fff; text-decoration: none;
  }
  .brand-mark {
    width: 30px; height: 30px;
    display: grid; place-content: center;
    background: var(--lime); color: var(--green-900);
    border-radius: 9px;
    font-family: var(--serif); font-size: 15px; font-weight: 700;
  }
  .brand strong { font-size: 14.5px; letter-spacing: .02em; }
  .topbar-in > .home {
    margin-left: auto;
    color: #D8E6CF; text-decoration: none;
    font-size: 13px;
    border: 1px solid rgba(255,255,255,.3);
    border-radius: 999px;
    padding: 6px 14px;
    white-space: nowrap;
  }
  .topbar-in > .home:hover { background: rgba(255,255,255,.1); color: #fff; }

  .page { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 30px 0 60px; }

  .crumbs { font-size: 12.5px; color: var(--muted); margin-bottom: 18px; }
  .crumbs a { color: var(--muted); }

  h1.post-title {
    font-size: clamp(26px, 4vw, 36px);
    line-height: 1.3;
    font-weight: 800;
    margin: 6px 0 14px;
    letter-spacing: .01em;
  }

  .meta-chips { display: flex; flex-wrap: wrap; gap: 7px; margin: 0 0 8px; }
  .chip {
    font-size: 12px;
    color: var(--muted);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2.5px 11px;
    white-space: nowrap;
  }
  .chip b { font-weight: 600; color: var(--ink); }
  .chip.status-verified { color: var(--green-700); background: var(--green-soft); border-color: #D5E4BC; }
  .chip.status-draft { color: #A05A14; background: #F7ECD9; border-color: #EBD9B4; }
  .chip.status-stale, .chip.status-disputed { color: #B0452F; background: #F9E7E1; border-color: #EBCDC4; }
  .chip.risk-low b { color: #2E7D4F; }
  .chip.risk-mid b { color: #A8690F; }
  .chip.risk-high b { color: #B0452F; }

  .toc {
    display: flex; flex-wrap: wrap; gap: 7px;
    margin: 16px 0 4px;
    padding: 14px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
  }
  .toc a {
    font-size: 12.5px;
    color: var(--green-800);
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3.5px 12px;
    text-decoration: none;
  }
  .toc a:hover { background: var(--green-soft); border-color: #D5E4BC; }

  .content { margin-top: 10px; }
  .content h2 {
    font-size: 21px;
    font-weight: 800;
    margin: 40px 0 12px;
    padding-left: 12px;
    border-left: 4px solid var(--green-700);
    line-height: 1.4;
    scroll-margin-top: 70px;
  }
  .content h3 { font-size: 16.5px; font-weight: 700; margin: 24px 0 8px; }
  .content p { margin: 10px 0; }
  .content ul, .content ol { margin: 10px 0; padding-left: 24px; }
  .content li { margin: 4px 0; }
  .content li input[type="checkbox"] { margin-right: 7px; accent-color: var(--green-700); }
  .content blockquote {
    margin: 14px 0;
    padding: 12px 18px;
    background: var(--green-soft);
    border-left: 4px solid var(--green-700);
    border-radius: 0 12px 12px 0;
    color: #3A4A38;
  }
  .content blockquote p { margin: 4px 0; }
  .content code {
    background: #F0EDE2;
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 1px 6px;
    font-size: .86em;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    word-break: break-all;
  }
  .content pre {
    background: #1E3A2B;
    color: #E8F0DC;
    border-radius: 12px;
    padding: 14px 18px;
    overflow-x: auto;
  }
  .content pre code { background: transparent; border: 0; color: inherit; padding: 0; word-break: normal; }
  .table-wrap { overflow-x: auto; margin: 14px 0; }
  .content table { border-collapse: collapse; width: 100%; font-size: 13.5px; background: var(--card); }
  .content th, .content td {
    border: 1px solid var(--line);
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
  }
  .content th { background: var(--green-soft); color: var(--green-900); font-weight: 700; white-space: nowrap; }
  .content tr:nth-child(even) td { background: #FAF8F0; }
  .content td code { word-break: break-all; }
  .content td a { word-break: break-all; }
  .content td { min-width: 3.5em; }
  .content hr { border: 0; border-top: 1px solid var(--line); margin: 30px 0 0; }
  .content img { max-width: 100%; border-radius: 12px; }

  .neighbor {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 40px;
  }
  .neighbor a {
    display: flex; flex-direction: column; gap: 3px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 13px 16px;
    text-decoration: none;
    transition: border-color .15s ease;
  }
  .neighbor a:hover { border-color: var(--green-700); }
  .neighbor a.next { text-align: right; }
  .neighbor .dir { font-size: 11.5px; color: var(--muted); letter-spacing: .08em; }
  .neighbor .name { font-size: 13.5px; font-weight: 700; color: var(--ink); }

  .back-row {
    display: flex; flex-wrap: wrap; gap: 10px;
    margin-top: 34px;
    padding-top: 22px;
    border-top: 1px dashed var(--line);
  }
  .back-row a {
    font-size: 13px;
    color: var(--green-800);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 18px;
    text-decoration: none;
  }
  .back-row a:hover { border-color: var(--green-700); background: var(--green-soft); }

  footer.site {
    background: var(--green-900);
    color: #B9CFBB;
    padding: 26px 0 34px;
  }
  .footer-in {
    width: min(880px, calc(100% - 32px));
    margin: 0 auto;
    display: flex; flex-wrap: wrap; gap: 8px 26px; justify-content: space-between;
    font-size: 12px;
  }
  footer.site a { color: #A8C79B; }

  @media (max-width: 560px) {
    .neighbor { grid-template-columns: 1fr; }
    .neighbor a.next { text-align: left; }
  }
`;

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function chip(label, value, extraClass = '') {
  if (!value) return '';
  return `<span class="chip ${extraClass}">${esc(label)}<b>${esc(value)}</b></span>`;
}

function buildPage(page, html, headings, title, depth) {
  const rootLink = depth === 0 ? 'index.html' : '../'.repeat(depth) + 'index.html';
  const meta = page.fm;
  const isArticle = page.isArticle;

  const chips = [];
  if (isArticle) {
    chips.push(`<span class="chip status-${esc(meta.status)}"><b>${esc(meta.status)}</b></span>`);
    chips.push(chip('栏目 ', meta.domain));
    chips.push(chip('最近核实 ', meta.last_verified));
    chips.push(chip('来源 ', `${meta.source_count} 条`));
    chips.push(chip('耗时 ', meta.duration));
    chips.push(chip('花费 ', meta.cost));
    chips.push(chip('风险 ', meta.risk, RISK_CLASS[meta.risk] || ''));
    chips.push(chip('时效 ', VOLATILITY[meta.volatility] || meta.volatility));
    chips.push(chip('适用 ', meta.region));
  }

  const toc = headings.length > 1
    ? `<nav class="toc" aria-label="本页目录">${headings.map((h) => `<a href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav>`
    : '';

  let neighborHtml = '';
  if (isArticle) {
    const idx = articleIndex.get(meta.id);
    const prev = articles[idx - 1];
    const next = articles[idx + 1];
    const cell = (target, dir, label) => target
      ? `<a class="${dir}" href="${encodeURI(relative(dirname(page.file), target.file).replaceAll('\\', '/').replace(/\.md$/, '.html'))}"><span class="dir">${label}</span><span class="name">${esc(target.fm.id)} ${esc(target.fm.title)}</span></a>`
      : `<span></span>`;
    neighborHtml = `<div class="neighbor">${cell(prev, 'prev', '← 上一篇')}${cell(next, 'next', '下一篇 →')}</div>`;
  }

  const backLinks = [
    `<a href="${rootLink}">← 返回检索首页</a>`,
    depth > 0 ? `<a href="${'../'.repeat(depth)}README.html">总目录</a>` : ''
  ].filter(Boolean).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='2' width='28' height='28' rx='8' fill='%23d9edbd'/%3E%3Ctext x='16' y='23' font-family='serif' font-size='18' font-weight='bold' fill='%231e3a2b' text-anchor='middle'%3E一%3C/text%3E%3C/svg%3E">
<title>${esc(title)} · 人生第一次</title>
<style>${CSS}</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-in">
    <a class="brand" href="${rootLink}"><span class="brand-mark" aria-hidden="true">一</span><strong>人生第一次</strong></a>
    <a class="home" href="${rootLink}">检索全部条目</a>
  </div>
</header>

<div class="page">
  <nav class="crumbs"><a href="${rootLink}">检索首页</a> · <a href="${rootLink.replace(/index\.html$/, 'README.html')}">总目录</a>${isArticle ? ` · <a href="${rootLink}?domain=${encodeURIComponent(meta.domain)}">${esc(meta.domain)}</a>` : ''}</nav>
  <h1 class="post-title">${esc(title)}</h1>
  ${chips.length ? `<div class="meta-chips">${chips.join('')}</div>` : ''}
  ${toc}
  <main class="content">
${html}
  </main>
  ${neighborHtml}
  <div class="back-row">${backLinks}</div>
</div>

<footer class="site">
  <div class="footer-in">
    <span>文字内容 CC BY 4.0 · 图片来自 Unsplash（<a href="${'../'.repeat(depth)}assets/CREDITS.html">来源与许可</a>）</span>
    <span>内容不构成医疗、法律、投资建议 · 办事前以官方最新公告为准</span>
  </div>
</footer>
</body>
</html>
`;
}

let written = 0;
for (const page of pages) {
  const { html, headings, title } = renderMarkdown(page.text);
  const depth = page.relativePath.split('/').length - 1;
  const out = buildPage(page, html, headings, title, depth);
  const outPath = page.file.replace(/\.md$/, '.html');
  await writeFile(outPath, out, 'utf8');
  written += 1;
}

console.log(`站点已生成：${written} 个 HTML 页面（其中文章 ${articles.length} 篇）。`);
