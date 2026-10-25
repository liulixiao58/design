import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BoxEngine} from '../src/render3d/engine.js';
import {storeToRig,rigToStorePatch} from '../src/render3d/rig.js';
test('立放姿态保存重开，旧场景默认平放',()=>{
 assert.equal(rigToStorePatch(storeToRig({displayPose3d:'upright'})).displayPose3d,'upright');
 assert.equal(rigToStorePatch({}).displayPose3d,'flat');
});
test('立放使宽盒竖起并落地，重复应用不漂移；单面校样不继承整盒旋转',()=>{
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(720,120,440)));
 const engine={T:THREE,boxRoot:root,props:{displayPose:'upright'}};
 BoxEngine.prototype.applyDisplayPose.call(engine);
 assert(new THREE.Vector3(1,0,0).applyQuaternion(root.quaternion).distanceTo(new THREE.Vector3(1,0,0))<1e-8);
 assert(new THREE.Vector3(0,1,0).applyQuaternion(root.quaternion).distanceTo(new THREE.Vector3(0,0,1))<1e-8);
 let b=new THREE.Box3().setFromObject(root),size=b.getSize(new THREE.Vector3());
 assert(Math.abs(size.y-440)<1e-8);assert(Math.abs(size.z-120)<1e-8);assert(Math.abs(b.min.y)<1e-8);
 const before=root.position.clone();BoxEngine.prototype.applyDisplayPose.call(engine);assert(root.position.distanceTo(before)<1e-8);
 engine.props.detailPanel='mailer-lid';BoxEngine.prototype.applyDisplayPose.call(engine);
 assert(root.quaternion.angleTo(new THREE.Quaternion())<1e-8);
});
