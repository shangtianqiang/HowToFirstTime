import { basename } from 'node:path';
import { loadEntries } from './lib.mjs';

const entries = await loadEntries();
const errors = [];
const reports = [];

for (const { file, fm, text } of entries) {
  const name = basename(file);
  const todoCount = (text.match(/待核实/g) || []).length;

  if (fm.status === '已核实' && todoCount > 0) {
    errors.push(`${name}: 状态是「已核实」，但正文还有 ${todoCount} 处「待核实」`);
  }

  if (fm.status !== '初稿' && fm.source_count === 0) {
    errors.push(`${name}: 状态是「${fm.status}」，但 source_count 为 0`);
  }

  reports.push(`${name}: ${fm.status}，待核实 ${todoCount} 处，来源 ${fm.source_count} 条`);
}

console.log('核实进度：');
for (const report of reports) console.log(`- ${report}`);

if (errors.length) {
  console.error(`待核实检查失败，共 ${errors.length} 处：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`待核实检查通过：${entries.length} 篇。初稿阶段允许保留「待核实」。`);
