import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkflow, normalizeWorkflow, workflowGate } from '../src/workflow.js';
import { ACCEPTANCE_ITEMS, acceptanceFingerprint } from '../src/design/acceptance.js';

const checks = { design: [], production: [] };
const readyState = () => ({
  workflow: emptyWorkflow(), L: 80, W: 40, H: 120, layers: [{ id: 1 }]
});

test('旧工程缺少流程资料时使用默认结构', () => {
  const w = normalizeWorkflow(null);
  assert.equal(w.stage, 'brief');
  assert.equal(w.proposal.confirmed, false);
  assert.deepEqual(w.assumptions, []);
});

test('需求阶段必须完成资料并确认尺寸假设', () => {
  const state = readyState();
  for (const key of Object.keys(state.workflow.brief)) state.workflow.brief[key] = '已确认';
  assert.equal(workflowGate('brief', state, checks), false);
  state.workflow.dimensions.confirmed = true;
  assert.equal(workflowGate('brief', state, checks), true);
});

test('设计与交付阶段分别受现有检查和人工确认控制', () => {
  const state = readyState();
  assert.equal(workflowGate('design', state, checks), true);
  assert.equal(workflowGate('delivery', state, checks), false);
  state.workflow.delivery.structureChecked = true;
  state.workflow.delivery.factoryChecked = true;
  assert.equal(workflowGate('delivery', state, checks), false, '旧勾选不能冒充当前工程核验');
  state.workflow.acceptance = { reference: '锁定测试原稿-v1' };
  const fingerprint = acceptanceFingerprint(state);
  for (const [id] of ACCEPTANCE_ITEMS) state.workflow.acceptance[id] = { fingerprint, note: '测试用已核验凭据', at: '2026-10-24' };
  assert.equal(workflowGate('delivery', state, checks), true);
  assert.equal(workflowGate('delivery', state, { production: ['低清图片'], design: [] }), false);
});
