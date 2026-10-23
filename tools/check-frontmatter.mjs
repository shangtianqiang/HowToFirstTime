import { basename } from 'node:path';
import { loadEntries, ENUMS, REQUIRED_FIELDS } from './lib.mjs';

const errors = [];
const entries = await loadEntries();
const ids = new Map();

if (entries.length === 0) {
  errors.push('book/ 下没有找到任何条目文件。');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const { file, fm, text } of entries) {
  const name = basename(file);

  for (const field of REQUIRED_FIELDS) {
    if (!(field in fm)) errors.push(`${name}: 缺少字段 ${field}`);
  }

  if (!/^[A-J]-\d{2}$/.test(String(fm.id))) {
    errors.push(`${name}: id 格式不对（${fm.id}），应为 A-01 这种形式`);
  }

  if (!name.startsWith(`${fm.id}-`)) {
    errors.push(`${name}: 文件名没有以 ${fm.id}- 开头`);
  }

  if (ids.has(fm.id)) {
    errors.push(`id 重复：${fm.id}（${ids.get(fm.id)} 和 ${name}）`);
  } else {
    ids.set(fm.id, name);
  }

  if (fm.title && !new RegExp(`^# ${escapeRegExp(fm.title)}\\s*$`, 'm').test(text)) {
    errors.push(`${name}: 一级标题与 title 不一致`);
  }

  for (const field of ['domain', 'duration', 'cost', 'risk', 'volatility', 'region', 'status']) {
    if (fm[field] !== undefined && !ENUMS[field].includes(fm[field])) {
      errors.push(`${name}: ${field} 取值不在枚举内（${fm[field]}）`);
    }
  }

  if (!Array.isArray(fm.stage)) {
    errors.push(`${name}: stage 应为数组`);
  } else {
    for (const stage of fm.stage) {
      if (!ENUMS.stage.includes(stage)) errors.push(`${name}: stage 含未知值 ${stage}`);
    }
  }

  if (!Array.isArray(fm.prerequisites)) errors.push(`${name}: prerequisites 应为数组`);
  if (!Array.isArray(fm.related)) errors.push(`${name}: related 应为数组`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fm.last_verified))) {
    errors.push(`${name}: last_verified 应为 YYYY-MM-DD`);
  }

  if (typeof fm.source_count !== 'number') {
    errors.push(`${name}: source_count 应为数字`);
  }
}

if (errors.length) {
  console.error(`元数据检查失败，共 ${errors.length} 处：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`元数据检查通过：${entries.length} 篇。`);
