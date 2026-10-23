import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { root, walkAllMarkdown } from './lib.mjs';

const entries = [];
for (const file of await walkAllMarkdown(join(root, 'book'))) {
  const text = await readFile(file, 'utf8');
  if (!/^[A-J]-\d{2}-.+\.md$/.test(file.split(/[\\/]/).at(-1))) continue;

  const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const headings = [...text.matchAll(/^###\s+(\d+(?:\.\d+)?)\s+(.+)$/gm)].map((match) => ({
    number: match[1],
    name: match[2].trim(),
  }));

  entries.push({
    file,
    id: text.match(/^id:\s*([A-J]-\d{2})$/m)?.[1],
    title,
    headings,
  });
}

const byId = new Map(entries.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
const errors = [];
const files = [
  ...(await walkAllMarkdown(join(root, 'book'))),
  ...(await walkAllMarkdown(join(root, 'checklists'))),
  join(root, 'README.md'),
];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const relativePath = relative(root, file).replaceAll('\\', '/');

  for (const match of text.matchAll(/见\s*([A-J]-\d{2})《([^》]+)》\s*(\d+(?:\.\d+)?)\s*「([^」]+)」/g)) {
    const [, id, title, number, name] = match;
    const target = byId.get(id);
    if (!target) {
      errors.push(`${relativePath}: 引用的条目 ${id} 不存在`);
      continue;
    }
    if (target.title !== title) {
      errors.push(`${relativePath}: 引用 ${id} 的标题写成「${title}」，实际是「${target.title}」`);
    }
    const heading = target.headings.find((item) => item.number === number && item.name === name);
    if (!heading) {
      errors.push(`${relativePath}: ${id} 找不到步骤 ${number}「${name}」`);
    }
  }

  for (const match of text.matchAll(/见\s*([A-J]-\d{2})《([^》]+)》(?!\s*\d)/g)) {
    const [, id, title] = match;
    const target = byId.get(id);
    if (!target) {
      errors.push(`${relativePath}: 引用的条目 ${id} 不存在`);
      continue;
    }
    if (target.title !== title) {
      errors.push(`${relativePath}: 引用 ${id} 的标题写成「${title}」，实际是「${target.title}」`);
    }
  }

  for (const match of text.matchAll(/见\s*([A-J]-\d{2})(?!《)/g)) {
    errors.push(`${relativePath}: 裸编号引用「见 ${match[1]}」，必须带《标题》`);
  }

  for (const match of text.matchAll(/见(下一条|上一条|上一篇|下一篇|上文|下文)/g)) {
    errors.push(`${relativePath}: 相对指路「见${match[1]}」，必须写清条目和步骤`);
  }
}

if (errors.length) {
  console.error(`交叉引用检查失败，共 ${errors.length} 处：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`交叉引用检查通过：扫描 ${files.length} 个 Markdown 文件。`);
