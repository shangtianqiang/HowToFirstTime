import { basename } from 'node:path';
import { loadEntries } from './lib.mjs';

const LIMIT_MONTHS = { S: 24, M: 12, H: 6 };
const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

const entries = await loadEntries();
const today = new Date();
const errors = [];
const warnings = [];

for (const { file, fm } of entries) {
  const name = basename(file);
  const limit = LIMIT_MONTHS[fm.volatility];
  if (!limit) {
    errors.push(`${name}: volatility 取值无效（${fm.volatility}）`);
    continue;
  }

  const verified = new Date(`${fm.last_verified}T00:00:00`);
  if (Number.isNaN(verified.getTime())) {
    errors.push(`${name}: last_verified 不是有效日期（${fm.last_verified}）`);
    continue;
  }

  const months = (today - verified) / MS_PER_MONTH;
  if (months > limit) {
    errors.push(`${name}: 已 ${months.toFixed(1)} 个月未复审，超过 ${fm.volatility} 级的 ${limit} 个月上限`);
  } else if (months > limit * 0.8) {
    warnings.push(`${name}: 还有 ${(limit - months).toFixed(1)} 个月到期，建议安排复审`);
  }
}

if (warnings.length) {
  console.warn('提醒：');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`时效检查失败，共 ${errors.length} 处：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`时效检查通过：${entries.length} 篇都在复审周期内。`);
