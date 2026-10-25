import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCEPTANCE_ITEMS, acceptanceFingerprint, productionReleaseIssues } from '../src/design/acceptance.js';
import { workspaceChecks } from '../src/ui/workspaceChecks.js';
import { createDeliveryTask } from '../src/ui/deliveryTask.js';



const source = () => ({ tpl: 'rte', L: 80, W: 40, H: 120, glue: 14, bleed: 3, ovr: {}, typeOvr: {}, layers: [{ id: 1, kind: 'shape', visible: true, x: 20, y: 20, w: 10, h: 10, finish: 'none', color: '#111111' }], workflow: { acceptance: { reference: '母稿-sha256-test' } } });
function confirm(s) { const fingerprint = acceptanceFingerprint(s); for (const [id] of ACCEPTANCE_ITEMS) s.workflow.acceptance[id] = { fingerprint, note: '测试夹具，不代表工厂验收', at: '2026-10-24' }; return s; }

test('旧工程和清晰矢量也必须保留黄色核验，不因技术0阻断成为生产合格', () => {
  const s = source(), checks = workspaceChecks(s, { t: .4, bleed: 3 });
  assert.equal(checks.production.length, 0);
  assert.equal(checks.pending.length, 4);
  assert.equal(productionReleaseIssues(confirm(s)).length, 0);
});
test('素材、位置、盒尺寸、工艺或原稿基准变更使确认失效；保存与加载不失效', () => {
  const s = confirm(source());
  assert.equal(productionReleaseIssues(JSON.parse(JSON.stringify(s))).length, 0);
  for (const mutate of [s => s.layers[0].x++, s => s.layers[0].color = '#222222', s => s.layers[0].finish = 'uv', s => s.layers[0].imgSrc = 'changed', s => s.W++, s => s.uvRoughness3d = .6, s => s.workflow.acceptance.reference = '另一原稿']) {
    const next = structuredClone(s); mutate(next); assert.equal(productionReleaseIssues(next).length, 4);
  }
  const next = structuredClone(s); next.layers[0].img = { naturalWidth: 1 }; next.layers[0].locked = true;
  assert.equal(productionReleaseIssues(next).length, 0);
});
test('没有凭据或原稿基准不能靠写入指纹放行', () => {
  const s = confirm(source()); s.workflow.acceptance.visual.note = '';
  assert.equal(productionReleaseIssues(s).length, 1);
  s.workflow.acceptance.reference = ''; assert.equal(productionReleaseIssues(s).length, 4);
});
test('所有UI导出入口共享门槛，工程无核验不能进入生产导出，评审仍可执行', async () => {
  const modes = [], task = createDeliveryTask(async (s, m, mode) => modes.push(mode)), s = source();
  await assert.rejects(() => task.run('cmyk', s, {}), /未核验/);
  assert.deepEqual(modes, []);
  await task.run('rgb', s, {}); assert.deepEqual(modes, ['rgb']);
  await task.run('proof', s, {}); assert.deepEqual(modes, ['rgb', 'proof']);
  confirm(s); await task.run('cmyk', s, {}); assert.deepEqual(modes, ['rgb', 'proof', 'cmyk']);
});
test('工厂核样模式不能绕过低精度技术红灯', async () => {
  const s=source();s.layers=[{id:1,kind:'image',visible:true,finish:'none',x:0,y:0,w:100,h:100,imgSrc:'data:image/png;base64,AA==',imgW:100,imgH:100,img:{naturalWidth:100,naturalHeight:100}}];
  const task=createDeliveryTask(async()=>assert.fail('不应到达导出器'));
  await assert.rejects(()=>task.run('proof',s,{}),/PPI/);
});
