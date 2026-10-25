import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import { TPLS } from '../src/dieline/templates.js';
import { geomOf } from '../src/dieline/geom.js';
import { sheetViewMetrics } from '../src/dieline/viewMetrics.js';
import { pageBoxes, pdfPageLayout, reviewRasterScale } from '../src/export/coordinates.js';
import { verifyProductionPdf } from '../src/export/verifyProduction.js';
import { atlasScaleOf } from '../src/render3d/bake.js';

test('全部盒型在小尺寸、600及1000毫米下保留安全区、标签和尺寸；屏幕辅助不修改毫米几何',()=>{
  for(const {id:tpl} of TPLS)for(const size of [60,600,1000]){
    const s={tpl,L:size,W:size,H:size,bleed:3,glue:14,ovr:{},typeOvr:{}};
    const g=geomOf(s,.5),snapshot=JSON.stringify(g),boxes=pageBoxes(s,g);
    assert(g.dims.length>0&&g.labels.length>0&&g.safePath);
    for(const k of [.05,.16,1,4]){
      const guides=sheetViewMetrics(g,k,s.bleed);
      assert.equal(guides.dimensions.length,g.dims.length);
      assert(Math.abs(guides.fontSize*k-12)<1e-7);
      assert(guides.bleedStroke*k>=6-1e-7);
      assert(guides.dimensions.every(d=>!d.screenTransform.includes('NaN')&&!d.screenTransform.includes('Infinity')));
    }
    assert.equal(JSON.stringify(g),snapshot);
    assert.equal(boxes.b,3);
    assert(Math.abs(boxes.Wmm-(g.sbb[2]-g.sbb[0]+6))<1e-7);
    const layout=pdfPageLayout(boxes);
    assert(layout.width<=14400&&layout.height<=14400);
    assert(Math.abs(layout.width*layout.userUnit/boxes.k-boxes.Wmm)<1e-6);
    const S=reviewRasterScale(boxes),w=Math.ceil(boxes.Wmm*S),h=Math.ceil(boxes.Hmm*S);
    assert(Math.max(w,h)<=4097&&w*h<12_010_000);
    for(const detail of [false,true]){
      const scale=atlasScaleOf(boxes.Wmm,boxes.Hmm,detail);
      assert(Math.round(boxes.Wmm*scale)*Math.round(boxes.Hmm*scale)<(detail?9_450_000:4_210_000));
    }
  }
});

test('超过200英寸的PDF按UserUnit恢复真实尺寸和PPI，错误页面单位被拒绝',async()=>{
  const boxes={Wpt:6000*72/25.4,Hpt:4000*72/25.4,k:72/25.4,b:3};
  async function sample(ppi,unit=2){
    const pdf=await PDFDocument.create(),page=pdf.addPage([boxes.Wpt/2,boxes.Hpt/2]);
    page.node.set(PDFName.of('UserUnit'),PDFNumber.of(unit));
    const b=boxes.b*boxes.k/2;
    page.setTrimBox(b,b,boxes.Wpt/2-2*b,boxes.Hpt/2-2*b);
    page.setBleedBox(0,0,boxes.Wpt/2,boxes.Hpt/2);
    const img=await pdf.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64'));
    page.drawImage(img,{x:20,y:20,width:72/ppi/2,height:72/ppi/2});
    return pdf.save();
  }
  const out=await verifyProductionPdf(await sample(600),boxes);
  assert(Math.abs(out.pageMm[0]-6000)<1e-7);
  assert(Math.abs(out.rasters[0].ppi[0]-600)<1e-4);
  await assert.rejects(()=>sample(300).then(b=>verifyProductionPdf(b,boxes)),/PPI/);
  await assert.rejects(()=>sample(600,1).then(b=>verifyProductionPdf(b,boxes)),/尺寸/);
});
