import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const bookDir = join(root, 'book');

export function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (/^-?\d+$/.test(value)) {
      value = Number(value);
    }

    data[key] = value;
  }
  return data;
}

export function parseSummary(text) {
  const match = text.match(/^> \*\*一句话\*\*：(.*)$/m);
  return match ? match[1].trim() : '';
}

export async function walkAllMarkdown(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkAllMarkdown(full)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export async function walkEntries(dir = bookDir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkEntries(full)));
    } else if (entry.isFile() && /^[A-J]-\d{2}-.+\.md$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

export async function loadEntries() {
  const files = await walkEntries();
  const entries = [];

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const fm = parseFrontMatter(text);
    if (!fm) continue;

    entries.push({
      file,
      relativePath: relative(root, file).replaceAll('\\', '/'),
      text,
      fm,
      summary: parseSummary(text),
    });
  }

  return entries;
}

export const ENUMS = {
  domain: [
    '出行与交通',
    '证件与跨境',
    '工作与职业',
    '学习与技能',
    '家庭与育儿',
    '健康与医疗',
    '钱与消费',
    '居住与生活',
    '数字与网络',
    '人生节点',
  ],
  duration: ['半小时内', '半天', '1-3天', '长期'],
  cost: ['免费', '百元内', '千元级', '万元级'],
  risk: ['低', '中', '高'],
  volatility: ['S', 'M', 'H'],
  region: ['全国', '分省', '分市', '分机构'],
  status: ['初稿', '已核实', '待更新', '有争议'],
  stage: ['学生', '初入职场', '新婚', '新手父母', '中年', '退休'],
};

export const REQUIRED_FIELDS = [
  'id',
  'title',
  'domain',
  'stage',
  'prerequisites',
  'duration',
  'cost',
  'risk',
  'volatility',
  'region',
  'last_verified',
  'status',
  'source_count',
  'related',
];
