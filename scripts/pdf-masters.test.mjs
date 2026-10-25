import test from 'node:test';
import assert from 'node:assert/strict';
import PDFKit from 'pdfkit';
import { PDFDocument,PDFName } from 'pdf-lib';
import { productionGroups } from '../src/design/production.js';
import { MASTER_FILES,productionPdfLayers } from '../src/export/pdfLayers.js';
import { verifyProductionPdf } from '../src/export/verifyProduction.js';
const boxes={Wpt:200,Hpt:150,k:72/25.4,b:3};
async function master(group){
  const doc=new PDFKit({size:[200,150],margin:0,pdfVersion:'1.7'}),chunks=[];
  const done=new Promise((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  doc.page.dictionary.data.TrimBox=[3*boxes.k,3*boxes.k,200-3*boxes.k,150-3*boxes.k];
  doc.page.dictionary.data.BleedBox=[0,0,200,150];
  const hierarchy=productionPdfLayers(doc,group);
  for(const layer of group.layers.filter(l=>l.visible)){
    const key=hierarchy.bindings.get(layer.id);
    doc.addContent(`/OC /${key.plate} BDC\n/OC /${key.asset} BDC`);
    doc.rect(10+layer.id,20,10,5).fill('black');doc.addContent('EMC\nEMC');
  }
  doc.end();return {bytes:await done,plates:hierarchy.plates};
}
const layers=[{id:1,name:'烫金图形一',finish:'foil',kind:'shape',visible:true},{id:2,name:'烫银图形',finish:'silver',kind:'shape',visible:true},{id:3,name:'烫金图形二',finish:'foil',kind:'shape',visible:true},{id:4,name:'隐藏素材',finish:'foil',kind:'shape',visible:false}];
test('三份母版均输出，空工厂保留空白页，隐藏素材不进入PDF',async()=>{
  assert.deepEqual(Object.values(MASTER_FILES),['印刷层.pdf','工厂一工艺层.pdf','工厂二工艺层.pdf']);
  for(const group of productionGroups(layers)){
    const result=await master(group),check=await verifyProductionPdf(result.bytes,boxes,result);
    assert.equal(check.pdfLayers.assetCount,group.id==='metal'?3:0);
    assert.equal(check.pdfLayers.plateCount,group.id==='metal'?2:0);
  }
});
test('中文工艺版与每个素材独立命名，多个同工艺片段保持原始叠放顺序',async()=>{
  const result=await master(productionGroups(layers)[1]);
  assert.deepEqual(result.plates.map(p=>p.members.map(m=>m.id)),[[1,3],[2]]);
  const pdf=await PDFDocument.load(result.bytes),props=pdf.getPages()[0].node.Resources().lookup(PDFName.of('Properties'));
  assert.equal(props.lookup(PDFName.of('Asset1')).get(PDFName.of('Name')).decodeText(),'烫金图形一');
  await verifyProductionPdf(result.bytes,boxes,result);
  const swapped=structuredClone(result.plates);swapped[0].members[0].property='Asset2';
  await assert.rejects(()=>verifyProductionPdf(result.bytes,boxes,{plates:swapped}),/图层|层级/);
  const broken=await PDFDocument.load(result.bytes);broken.catalog.delete(PDFName.of('OCProperties'));
  await assert.rejects(()=>broken.save().then(bytes=>verifyProductionPdf(bytes,boxes,result)),/缺少PDF图层/);
});
