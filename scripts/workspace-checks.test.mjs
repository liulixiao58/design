import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceChecks } from '../src/ui/workspaceChecks.js';

const box = { tpl: 'rte', L: 80, W: 40, H: 120, glue: 14, bleed: 3, ovr: {}, typeOvr: {}, layers: [] };
const material = { t: .4, bleed: 3 };

test('没有设计警示也必须显示未接入字体的生产阻断', () => {
  const layer = { id: 1, kind: 'text', panelId: 'front', x: 30, y: 30, size: 6, content: '文字', font: 'Noto Serif SC', weight: 600, finish: 'none', visible: true };
  const checks = workspaceChecks({ ...box, layers: [layer] }, material);
  assert.equal(checks.design.length, 0);
  assert.ok(checks.production.some(s => s.includes('字体')));
  assert.equal(checks.pending.length, 4);
});

test('出血按实际数值检查，未执行的结构检测保持待人工确认', () => {
  const checks = workspaceChecks({ ...box, bleed: 1 }, material);
  assert.ok(checks.design.some(s => s.includes('出血')));
  assert.ok(checks.pending.some(s => s.includes('外轮廓')));
  const normal = workspaceChecks(box, material);
  assert.equal(normal.design.length, 0);
  assert.equal(normal.production.length, 0);
  assert.equal(normal.pending.length, 4);
});

test('缺图和反推未确认在统一检查中保留生产阻断', () => {
  const image = { id: 2, kind: 'image', panelId: 'front', x: 0, y: 0, w: 10, h: 10, finish: 'none', visible: true };
  const checks = workspaceChecks({ ...box, layers: [image], reconstruction: { notice: '尺寸未确认' } }, material);
  assert.ok(checks.production.some(s => s.includes('未加载')));
  assert.ok(checks.production.some(s => s.includes('尚未生产确认')));
});
