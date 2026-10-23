import { basename } from 'node:path';
import { loadEntries } from './lib.mjs';

const BLOCKS = [
  '## 0. 30 秒速查',
  '## 1. 准备事项',
  '## 2. 现场流程',
  '## 3. 常见问题',
  '## 4. 避坑提醒',
  '## 5. 特殊情况与应急',
  '## 6. 费用与时间预算',
  '## 7. 延伸资源',
  '## 8. 依据与核实',
];

const REQUIRED_LINES = ['> **一句话**：', '> **适用**：', '> **不适用**：'];

const entries = await loadEntries();
const errors = [];

for (const { file, text } of entries) {
  const name = basename(file);
  const positions = [];

  for (const block of BLOCKS) {
    const index = text.indexOf(block);
    if (index === -1) {
      errors.push(`${name}: 缺少板块「${block}」`);
    } else {
      positions.push({ block, index });
    }
  }

  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i].index < positions[i - 1].index) {
      errors.push(`${name}: 板块顺序错误，「${positions[i].block}」应在「${positions[i - 1].block}」之后`);
    }
  }

  for (const line of REQUIRED_LINES) {
    if (!text.includes(line)) errors.push(`${name}: 缺少 ${line.trim()}`);
  }

  if (!text.includes('[← 回总目录]')) {
    errors.push(`${name}: 缺少返回总目录的链接`);
  }
}

if (errors.length) {
  console.error(`结构检查失败，共 ${errors.length} 处：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`结构检查通过：${entries.length} 篇，9 个板块齐全。`);
