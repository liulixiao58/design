import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BoxEngine } from '../src/render3d/engine.js';

test('3D模式按钮使用主题色与选中状态，不改变原鼠标映射',()=>{
  const buttons=Object.fromEntries(['rotate','pan','move','turn'].map(id=>[id,{style:{},setAttribute(k,v){this[k]=v;}}]));
  const engine={T:THREE,controls:{mouseButtons:{}},renderer:{domElement:{style:{}}},_modeBtns:buttons};
  for(const mode of Object.keys(buttons)){
    BoxEngine.prototype.setMode.call(engine,mode);
    assert.equal(engine.controls.mouseButtons.LEFT,mode==='rotate'?THREE.MOUSE.ROTATE:mode==='pan'?THREE.MOUSE.PAN:-1);
    for(const [id,button] of Object.entries(buttons)){
      assert.equal(button['aria-pressed'],String(id===mode));
      assert.equal(button.style.background,id===mode?'var(--ui-selected,#f0edfc)':'transparent');
      assert.match(button.style.color,/^var\(--ui-/);
    }
  }
});

test('自动旋转或手动转盒后回正保持盒心在原处，重复回正不漂移',()=>{
  const root=new THREE.Group();
  root.position.set(-24.5,.5,12);
  const engine={T:THREE,boxRoot:root,_centerL:new THREE.Vector3(24.5,25,-24.5)};
  const center=()=>{root.updateWorldMatrix(true,false);return root.localToWorld(engine._centerL.clone());};
  const initial=center();
  BoxEngine.prototype.turnBox.call(engine,2.35);
  assert(center().distanceTo(initial)<1e-9);
  BoxEngine.prototype.resetTurn.call(engine);
  assert(center().distanceTo(initial)<1e-9);
  assert(root.quaternion.angleTo(new THREE.Quaternion())<1e-9);
  const position=root.position.clone();
  BoxEngine.prototype.resetTurn.call(engine);
  assert(root.position.distanceTo(position)<1e-9);
});
