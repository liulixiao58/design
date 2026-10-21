import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRegistration } from '../src/design/registration.js';

globalThis.location = { search: '' };
const { store } = await import('../src/state/store.js');
const print = { id: 1, kind: 'shape', finish: 'none', panelId: 'top', x: 10, y: 20, w: 30, h: 20 };
const mask = { ...print, id: 2, finish: 'uv' };
const layers = [print, { ...mask, registration: bindRegistration(mask, print) }];
const reset = () => store.reset({ layers, sel: 1, seq: 3 });
const edit = patch => store.set(st => ({ layers: st.layers.map(l => l.id === 1 ? { ...l, ...patch } : l) }));

test('快速的独立操作分别撤销，删除撤销恢复选中和编号', () => {
  reset(); edit({ x: 12 }); edit({ locked: true });
  assert.deepEqual(store.histDepth(), [2, 0]);
  store.undo(); assert.equal(store.get().layers[0].locked, undefined);
  store.undo(); assert.equal(store.get().layers[0].x, 10);
  store.redo(); assert.equal(store.get().layers[1].x, 12);
  store.set({ layers: [], sel: null, seq: 7 });
  store.undo(); assert.equal(store.get().sel, 1); assert.equal(store.get().seq, 3);
  store.redo(); assert.equal(store.get().sel, null); assert.equal(store.get().seq, 7);
});

test('一次长拖动只记一步，联动、缩放、旋转和裁切完整恢复', () => {
  reset(); const before = store.get().layers;
  const now = Date.now; let time = now(); Date.now = () => time;
  try {
    store.beginEdit();
    for (let i = 1; i <= 4; i++) { time += 800; edit({ x: 10 + i, w: 30 + i * 3, h: 20 + i * 2, rot: i * 5, crop: [0, 0, .8, .8] }); }
    store.endEdit();
    const after = store.get().layers;
    assert.deepEqual(store.histDepth(), [1, 0]);
    store.undo(); assert.deepEqual(store.get().layers, before);
    store.redo(); assert.deepEqual(store.get().layers, after);
  } finally { Date.now = now; }
});

test('无变化不占历史、不破坏重做；新编辑清除重做；重置清空历史', () => {
  reset(); edit({ x: 15 }); store.undo();
  edit({ x: 10 });
  assert.deepEqual(store.histDepth(), [0, 1]);
  store.beginEdit(); store.endEdit();
  assert.deepEqual(store.histDepth(), [0, 1]);
  edit({ y: 25 }); assert.deepEqual(store.histDepth(), [1, 0]);
  reset(); assert.deepEqual(store.histDepth(), [0, 0]);
});

test('工艺变更携带的效果开关随撤销重做恢复', () => {
  reset(); const fx = store.get().fx;
  store.set({ layers: [{ ...print, finish: 'holo' }], fx: { ...fx, holo: true }, iridescence3d: .85 });
  store.undo(); assert.deepEqual(store.get().fx, fx);
  store.redo(); assert.equal(store.get().layers[0].finish, 'holo'); assert.equal(store.get().fx.holo, true);
});

test('连续编辑结束后独立操作不会混入同一步，历史最多60步', () => {
  reset(); store.beginEdit(); edit({ x: 11 }); edit({ x: 12 }); store.endEdit();
  edit({ visible: false });
  store.undo(); assert.equal(store.get().layers[0].x, 12); assert.equal(store.get().layers[0].visible, undefined);
  store.undo(); assert.equal(store.get().layers[0].x, 10);
  for (let i = 1; i <= 70; i++) edit({ x: 10 + i });
  assert.deepEqual(store.histDepth(), [60, 0]);
  for (let i = 0; i < 60; i++) store.undo();
  assert.equal(store.get().layers[0].x, 20);
});

test('被锁定套准对象拒绝的编辑不入历史、不破坏重做', () => {
  reset();
  store.set(st => ({ layers: st.layers.map(l => l.id === 2 ? { ...l, locked: true } : l) }));
  edit({ visible: false }); store.undo();
  const before = store.get(); const depth = store.histDepth();
  const alert = globalThis.alert; let message;
  globalThis.alert = value => { message = value; };
  try { edit({ x: 20 }); } finally { globalThis.alert = alert; }
  assert.match(message, /锁定/); assert.equal(store.get(), before); assert.deepEqual(store.histDepth(), depth);
});
