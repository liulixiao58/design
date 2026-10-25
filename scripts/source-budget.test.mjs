import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredPixels,sourceBudgets} from '../src/design/sourceBudget.js';
import {emptyWorkflow,normalizeWorkflow,workflowGate} from '../src/workflow.js';

const image={id:1,kind:'image',visible:true,name:'凝胶',imgSrc:'data:image/png;base64,AA==',imgW:1605,imgH:980,w:723,h:441.8333333333333,finish:'none',factoryId:'print',plateId:'print-main',panelId:'mailer-lid'};
test('生成前按毫米计算原生像素；严格大于300PPI，非法尺寸不出预算',()=>{
 assert.deepEqual(requiredPixels(723,441.8333333333333),[8540,5219]);
 assert.deepEqual(requiredPixels(25.4,25.4),[301,301]);
 assert.equal(requiredPixels(0,20),null);assert.equal(requiredPixels(NaN,20),null);
});
test('同一原图的正反面只计一份素材，按最大使用尺寸和裁切计算',()=>{
 const list=sourceBudgets([image,{...image,id:2,panelId:'mailer-bottom',crop:[0,0,.5,1],w:723},{...image,id:3,visible:false}]);
 assert.equal(list.length,1);assert.equal(list[0].uses.length,2);assert.equal(list[0].pass,false);
 assert.deepEqual(list[0].required,[17079,5219]);
});
test('概念确认可以保留低清参考；生产母稿在方案阶段拦住低清和空稿',()=>{
 const workflow=emptyWorkflow();workflow.proposal={selected:'A',revision:'v1',confirmed:true,purpose:'concept'};workflow.dimensions.confirmed=true;
 const s={workflow,layers:[image]},checks={production:[],design:[]};
 assert.equal(workflowGate('proposal',s,checks),true);
 workflow.proposal.purpose='production';assert.equal(workflowGate('proposal',s,checks),false);
 s.layers=[];assert.equal(workflowGate('proposal',s,checks),false);
 s.layers=[{...image,imgW:8540,imgH:5219}];assert.equal(workflowGate('proposal',s,checks),true);
 s.layers[0].w*=2;s.layers[0].h*=2;assert.equal(workflowGate('proposal',s,checks),false,'放大使用尺寸后须重算，不能沿用旧通过结果');
});

test('生成预算和确认范围随流程资料保留，旧工程仍为概念范围',()=>{
 const proposal={purpose:'production',assetPlan:{widthMm:'723',heightMm:'441.8333333333333'}};
 assert.deepEqual(normalizeWorkflow({proposal}).proposal.assetPlan,proposal.assetPlan);
 assert.equal(normalizeWorkflow({proposal}).proposal.purpose,'production');
 assert.equal(normalizeWorkflow({}).proposal.purpose,'concept');
});
