import test from 'node:test';
import assert from 'node:assert/strict';
import { croppedSvgViewBox } from '../src/export/svgPreflight.js';
const root = attrs => ({getAttribute:key=>attrs[key]||null});
const crop=[.2,.1,.6,.8];
test('裁切导出使用SVG源坐标，缺少imgW/H仍能精确计算',()=>{
  assert.equal(croppedSvgViewBox(root({width:'1000',height:'600'}),crop),'200 60 600 480');
  assert.equal(croppedSvgViewBox(root({viewBox:'-10 20 1000 600'}),crop),'190 80 600 480');
  assert.equal(croppedSvgViewBox(root({}),crop),'60 15 180 120');
  for(const unit of ['in','mm','cm','pt','pc','px']){
    const size={in:1,mm:25.4,cm:2.54,pt:72,pc:6,px:96}[unit];
    const values=croppedSvgViewBox(root({width:size+unit,height:size+unit}),crop).split(' ').map(Number);
    values.forEach((v,i)=>assert(Math.abs(v-[19.2,9.6,57.6,76.8][i])<1e-7));
  }
});
test('无效或相对SVG尺寸明确拒绝，不允许NaN进入生产PDF',()=>{
  for(const attrs of [{width:'100%',height:'100%'},{viewBox:'0 0 NaN 20'},{viewBox:'0 0 0 20'}])assert.throws(()=>croppedSvgViewBox(root(attrs),crop),/SVG/);
});
