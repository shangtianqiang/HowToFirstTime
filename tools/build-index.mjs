import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEntries, root } from './lib.mjs';

const entries = await loadEntries();

const items = entries.map((entry) => ({
  id: entry.fm.id,
  title: entry.fm.title,
  domain: entry.fm.domain,
  stage: entry.fm.stage,
  prerequisites: entry.fm.prerequisites,
  duration: entry.fm.duration,
  cost: entry.fm.cost,
  risk: entry.fm.risk,
  volatility: entry.fm.volatility,
  region: entry.fm.region,
  last_verified: entry.fm.last_verified,
  status: entry.fm.status,
  source_count: entry.fm.source_count,
  related: entry.fm.related,
  summary: entry.summary,
  path: entry.relativePath,
}));

items.sort((a, b) => String(a.id).localeCompare(String(b.id)));

const stats = {
  planned: 107,
  built: items.length,
  verified: items.filter((item) => item.status === '已核实').length,
  draft: items.filter((item) => item.status === '初稿').length,
  updated: items.map((item) => item.last_verified).sort().at(-1) ?? '',
};

const payload = {
  generated_at: new Date().toISOString(),
  stats,
  items,
};

await writeFile(join(root, 'index.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`index.json 已生成：${items.length} 篇，已核实 ${stats.verified} 篇，初稿 ${stats.draft} 篇。`);
