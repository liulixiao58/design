import test from 'node:test';
import assert from 'node:assert/strict';
import {productionGroups,moveMembers,updateMembers,validateProduction} from '../src/design/production.js';
import {productionIssues} from '../src/design/productionCheck.js';

const layers=[
  {id:1,finish:'none',x:10,y:20,visible:true},
  {id:2,finish:'foil',x:30,y:40,visible:true},
  {id:3,finish:'foil',x:50,y:60,visible:false},
  {id:4,finish:'silver',x:70,y:80,visible:true},
  {id:5,finish:'emboss',embDir:'down',x:80,y:80,visible:true},
  {id:6,finish:'uv',x:20,y:30,visible:true},
  ...['screen','frost','coldfoil'].map((finish,i)=>({id:7+i,finish,x:0,y:0,visible:true}))
];
test('旧工程无元数据也能归组；金银、凹凸与新增版别保持独立',()=>{
  const [print,metal,film]=productionGroups(layers);
  assert.deepEqual(print.layers.map(l=>l.id),[1]);
  assert.deepEqual(metal.plates.map(p=>[p.process,p.layers.length]),[['foil',2],['silver',1],['emboss-down',1]]);
  assert.deepEqual(film.plates.map(p=>p.process),['uv','screen','frost','coldfoil']);
  assert.equal(productionGroups([{...layers[4],embDir:undefined}],'up')[1].plates[0].process,'emboss-up');
});
test('分组整体移动包含隐藏素材，内部距离不变，不动印刷与另一工厂',()=>{
  const moved=moveMembers(layers,[2,3,4,5],3.5,-2);
  for(const id of [2,3,4,5]){const old=layers.find(l=>l.id===id),now=moved.find(l=>l.id===id);assert.equal(now.x,old.x+3.5);assert.equal(now.y,old.y-2);}
  assert.equal(moved[2].x-moved[1].x,20);assert.equal(moved[0],layers[0]);assert.equal(moved[5],layers[5]);
  assert.throws(()=>moveMembers([{...layers[1],locked:true}], [2],1,0),/锁定/);
  assert.throws(()=>moveMembers(layers,[2],NaN,0),/有效/);
});
test('同工艺可拆版、改名、移交工厂并重新归版，JSON不丢分版关系',()=>{
  let next=updateMembers(layers,[3],{plateId:'red-line',plateName:'红线字母版',factoryId:'film'});
  next=JSON.parse(JSON.stringify(next));validateProduction(next);
  assert.equal(productionGroups(next)[1].plates.find(p=>p.process==='foil').layers.length,1);
  const plate=productionGroups(next)[2].plates.find(p=>p.id==='red-line');
  assert.equal(plate.name,'红线字母版');assert.equal(plate.process,'foil');assert.deepEqual(plate.layers.map(l=>l.id),[3]);
  next=updateMembers(next,[3],{factoryId:'metal',plateId:'default',plateName:'烫金版'});
  assert.equal(productionGroups(next)[1].plates.find(p=>p.process==='foil').layers.length,2);
});
test('组全隐和全锁写到实际素材，单版操作不影响其他版；非法分组不能导入',()=>{
  const changed=updateMembers(layers,[2,3],{visible:false,locked:true});
  assert(changed.slice(1,3).every(l=>!l.visible&&l.locked));assert.equal(changed[3],layers[3]);
  assert.throws(()=>validateProduction([{factoryId:'unknown'}]),/分组/);
  assert.throws(()=>validateProduction([{plateId:{bad:1}}]),/编号/);
});

test('新生产检查会拦截低清位图，不再拒绝合法独立版',()=>{
  assert.equal(productionIssues([{kind:'shape',visible:true,finish:'screen',plateId:'separate-a'}]).length,0);
  assert(productionIssues([{kind:'image',visible:true,finish:'foil',imgW:100,imgH:100,w:100,h:100}]).length>0);
});
