import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {closureOf,closureOutline} from '../src/dieline/closure.js';
import {geomOf} from '../src/dieline/geom.js';
import {makePieces,Folder} from '../src/render3d/fold.js';
import {makeProject,projectStateOf} from '../src/projects/projects.js';

const flatten=n=>[n,...(n.kids||[]).flatMap(flatten)];
const box={tpl:'rte',L:1000,W:1000,H:1000,glue:14,bleed:3,ovr:{},typeOvr:{}};
const near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

test('1000mm附件真实变深；圆角及侧向避让保持毫米级，低盒插舌受盒高约束',()=>{
  const p=closureOf(box,.5);
  assert.deepEqual(p,{gap:1.5,glue:40,tuck:120,dust:499.25});
  const low=closureOf({...box,H:30},1.5);
  assert.equal(low.tuck,13.5);
  assert(low.tuck*2+low.gap<=30);
  const tab=closureOutline('tuck',1000,120,.5);
  near(tab[1][0],5);
  near(tab[2][1],116.5);
  assert.equal(closureOf({...box,L:49,W:49,H:49,glue:10},.5).tuck,16);
  assert.equal(closureOf({...box,L:49,W:49,H:49,glue:10},.5).glue,10);
});

test('附件受折入空间及纸厚约束；2D真实轮廓、3D深度和UV使用同一规则',()=>{
  for(const tpl of ['rte','ste','mailer'])for(const [L,W,H] of [[20,15,15],[80,40,120],[49,49,49],[600,600,600],[1000,1000,1000],[1000,800,30],[20,1000,1000],[1000,15,1000]])for(const t of [.22,.5,1.5,3]){
    const s={...box,tpl,L,W,H},p=closureOf(s,t),g=geomOf(s,t);
    const nodes=makePieces(tpl,L,W,H,t,s.glue).flatMap(pc=>flatten(pc.tree));
    assert.deepEqual(g.closure,p);
    assert(p.tuck>0&&p.dust>0);
    assert(p.dust*2+p.gap<=L+1e-6);
    if(tpl!=='mailer')assert(p.tuck*2+p.gap<=H+1e-6);
    for(const n of nodes.filter(n=>['dust','tuck','glue'].includes(n.shape))){
      const depth=p[n.shape==='dust'?'dust':n.shape==='tuck'?'tuck':'glue'];
      near(n.out,depth);
      assert(n.uv[2]===depth||n.uv[3]===depth);
      const width=n.shape==='glue'?H+t:n.shape==='dust'?(tpl==='mailer'?W+3*t:W+t):L+t;
      const outline=closureOutline(n.shape,width,depth,t);
      assert(outline.every(([x,y])=>x>=0&&x<=width&&y>=0&&y<=depth));
      const area=outline.reduce((a,p,i)=>{const q=outline[(i+1)%outline.length];return a+p[0]*q[1]-p[1]*q[0];},0);
      assert(Math.abs(area)>0,'附件轮廓退化');
      for(let i=0;i<outline.length;i++)for(let j=i+2;j<outline.length;j++){
        if(i===0&&j===outline.length-1)continue;
        const a=outline[i],b=outline[(i+1)%outline.length],c=outline[j],d=outline[(j+1)%outline.length];
        assert(!(cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8),'附件轮廓自交');
      }
    }
    if(tpl!=='mailer'){
      const bh=H+t,width=W+t;
      for(const yb of [0,bh]){
        const sign=yb===0?-1:1;
        const pts=closureOutline('dust',width,p.dust,t).map(([x,y])=>[x,yb+sign*y]);
        assert(g.fills.some(f=>JSON.stringify(f)===JSON.stringify(pts)),'实际刀版缺少足深防尘翼');
      }
      near(-g.sbb[0],p.glue);
      near(-g.sbb[1],W+t+p.tuck);
    }else{
      const wing=closureOutline('dust',W+3*t,p.dust,t).map(([x,y])=>[-y,x]);
      assert(g.fills.some(f=>JSON.stringify(f)===JSON.stringify(wing)));
      near(-g.sbb[1],p.tuck);
    }
    for(const f of g.fills)assert(f.flat().every(Number.isFinite));
  }
});

test('3D附件网格边界来自共用轮廓，没有独立写死的圆角或肩宽',()=>{
  const folder=new Folder(THREE,[0,0,2000,2000]);folder._t=.5;
  for(const kind of ['dust','tuck','glue']){
    const depth=kind==='dust'?499.25:kind==='tuck'?120:40;
    const mesh=folder.panelMesh(kind,1000,depth,0,'',[0,0,1000,depth]);
    const pos=mesh.geometry.attributes.position,outline=closureOutline(kind,1000,depth,.5);
    for(let i=0;i<pos.count;i++)if(Math.abs(pos.getZ(i)-.5)<1e-6){
      assert(outline.some(([x,y])=>Math.hypot(x-pos.getX(i),y-pos.getY(i))<.001));
    }
    mesh.geometry.dispose();
  }
});

test('工程保存重开保持糊口基准，重算的实际闭合参数一致',async()=>{
  const state={...box,layers:[],seq:0,fx:{},embDir:'up'};
  const project=JSON.parse(JSON.stringify(makeProject(state)));
  const restored=await projectStateOf(project);
  assert.equal(restored.glue,14);
  assert.deepEqual(geomOf(restored,.5).closure,geomOf(state,.5).closure);
});
