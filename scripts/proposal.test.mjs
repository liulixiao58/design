import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProject} from '../src/proposal/schema.js';

test('公开版本接受1000mm工程，超过上限拒绝，夹具不包含客户数据',()=>{
  const project={schema:'box3d-project',version:1,meta:{name:'通用尺寸测试'},box:{tpl:'rte',L:1000,W:1000,H:1000,matId:'sbs400',bleed:3,glue:14,ovr:{},typeOvr:{}},design:{layers:[{id:1,kind:'shape',panelId:'front',x:1010,y:10,w:100,h:100,color:'#333333',finish:'none',visible:true}]}};
  project.design.seq=2;project.appearance={fx:{}};
  assert.equal(validateProject(project),project);
  for(const axis of ['L','W','H']){
    const invalid=structuredClone(project);invalid.box[axis]=1000.01;
    assert.throws(()=>validateProject(invalid),/1000/);
  }
});
