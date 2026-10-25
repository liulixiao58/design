import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRevision, projectContent, stateContent } from '../src/projects/projectLibrary.js';
import { makeProject, projectStateOf } from '../src/projects/projects.js';
globalThis.location = { search: '' };
const { store, emptyProjectState } = await import('../src/state/store.js');

test('项目内容检查覆盖结构、图层、材质、场景；导航、选中和缩略图不误报未保存', () => {
  const initial = emptyProjectState(), baseline = stateContent(initial);
  assert.equal(stateContent({ ...initial, view: 'projects', sel: 3, projectThumbnail: 'data:image/png;base64,a' }), baseline);
  for (const patch of [{ L: 90 }, { layers: [{ id: 1, kind: 'shape', x: 1 }] }, { foilRoughness3d: .8 }, { expo3d: 3 }]) {
    assert.notEqual(stateContent({ ...initial, ...patch }), baseline);
  }
  const doc = makeProject(initial, { name: '项目A' });
  assert.equal(projectContent({ ...doc, meta: { ...doc.meta, updatedAt: '2030-01-01', name: '改名' } }), projectContent(doc));
});

test('新项目空白，切换项目重置编辑历史，改A不会写进B', async () => {
  const blank = emptyProjectState();
  const a = makeProject({ ...blank, L: 50, layers: [{ id: 1, kind: 'shape', x: 10, y: 10, w: 5, h: 5, visible: true, finish: 'none' }], seq: 2 }, { name: 'A' });
  const b = makeProject({ ...blank, L: 90 }, { name: 'B' });
  store.reset(await projectStateOf(a));
  store.set(s => ({ layers: s.layers.map(l => ({ ...l, x: 12 })) }));
  assert.equal(store.histDepth()[0], 1);
  store.reset(await projectStateOf(b));
  assert.deepEqual(store.histDepth(), [0, 0]);
  assert.equal(store.get().L, 90); assert.deepEqual(store.get().layers, []);
  store.undo(); assert.equal(store.get().L, 90);
  store.reset(await projectStateOf(a)); assert.equal(store.get().layers[0].x, 10);
  assert.deepEqual(emptyProjectState().layers, []);
});

test('版本检查拒绝重复创建、跨页旧版本和删除后的保存，阻止静默覆盖', () => {
  const record = { revision: 'v2', deletedAt: null };
  assert.doesNotThrow(() => assertRevision(null, null));
  assert.doesNotThrow(() => assertRevision(record, 'v2'));
  for (const [previous, version] of [[record, null], [record, 'v1'], [null, 'v2'], [{ ...record, deletedAt: 'now' }, 'v2']]) {
    assert.throws(() => assertRevision(previous, version), /其他页面/);
  }
});
