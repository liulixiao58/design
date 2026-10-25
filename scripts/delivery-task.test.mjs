import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeliveryTask } from '../src/ui/deliveryTask.js';

test('跨入口同时导出只执行一次；结束后可以再次导出', async () => {
  let release, calls = 0;
  const task = createDeliveryTask(async () => { calls++; await new Promise(resolve => { release = resolve; }); return { checks: [] }; });
  const first = task.run('rgb', { layers: [] }, {});
  assert.equal(task.busy, true);
  await assert.rejects(() => task.run('rgb', { layers: [] }, {}), /正在生成/);
  assert.equal(calls, 1);
  release(); await first;
  assert.equal(task.busy, false);
  const next = task.run('rgb', { layers: [] }, {}); release(); await next;
  assert.equal(calls, 2);
});

test('生产阻断不会进入导出器；评审不误用生产门槛，失败后释放锁', async () => {
  const state = { layers: [{ id: 1, kind: 'text', visible: true, font: 'Noto Serif SC', weight: 600 }] };
  const modes = [];
  const task = createDeliveryTask(async (s, m, mode) => { modes.push(mode); if (mode === 'rgb') throw new Error('预览失败'); });
  await assert.rejects(() => task.run('cmyk', state, {}), /字体/);
  assert.equal(task.busy, false);
  assert.deepEqual(modes, []);
  await assert.rejects(() => task.run('rgb', state, {}), /预览失败/);
  assert.equal(task.busy, false);
  assert.deepEqual(modes, ['rgb']);
});
