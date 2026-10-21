import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BoxEngine } from '../src/render3d/engine.js';

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
