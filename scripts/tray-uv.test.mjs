import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Folder,makePieces} from '../src/render3d/fold.js';
import {geomOf} from '../src/dieline/geom.js';

for(const tpl of ['lidbase','drawer'])test(`${tpl}: tray walls follow the unfolded dieline without mirroring`,()=>{
  const state={tpl,L:500,W:400,H:160,glue:14,bleed:3,ovr:{},typeOvr:{}};
  const geom=geomOf(state,.5),pieces=makePieces(tpl,500,400,160,.5,14);
  const folder=new Folder(THREE,geom.sbb),material=new THREE.MeshBasicMaterial();
  const root=folder.build(pieces,.5,material,material);root.updateMatrixWorld(true);
  for(const piece of pieces.filter(p=>p.tree.kids?.length===4)){
    const tree=piece.tree;
    let checked=0;
    piece.pg.traverse(mesh=>{
      if(mesh.geometry?.type!=='BoxGeometry')return;
      checked++;
      const {position,uv}=mesh.geometry.attributes;
      for(let i=0;i<position.count;i++){
        if(Math.abs(position.getZ(i)-.5)>1e-6)continue;
        const point=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
        piece.pg.worldToLocal(point);
        const x=geom.sbb[0]+uv.getX(i)*(geom.sbb[2]-geom.sbb[0]);
        const y=geom.sbb[1]+(1-uv.getY(i))*(geom.sbb[3]-geom.sbb[1]);
        assert(Math.abs(x-(tree.uv[0]+point.x))<.001,'wall X must match flat dieline');
        assert(Math.abs(y-(tree.uv[1]+tree.ly-point.y))<.001,'wall Y must match flat dieline');
      }
    });
    assert.equal(checked,5);
  }
});
