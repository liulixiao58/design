// 仅供编辑画布：屏幕可读性不改变刀版毫米坐标、出血参数或导出比例。
export function sheetViewMetrics(g, k, bleed) {
  const px = value => value / Math.max(k, 1e-6);
  const dimensions = g.dims.map(d => {
    const horizontal=d.axis==='h',normal=horizontal?d.y:d.x;
    const start=horizontal?d.x:d.y-d.len,end=start+d.len;
    const points=g.fills.flat().filter(p=>p[horizontal?0:1]>=start-.01&&p[horizontal?0:1]<=end+.01);
    const nearest=points.reduce((best,p)=>Math.abs(p[horizontal?1:0]-normal)<Math.abs(best-normal)?p[horizontal?1:0]:best,Infinity);
    const gap=Number.isFinite(nearest)?normal-nearest:0;
    const shift=Math.sign(gap||1)*Math.max(0,px(20)-Math.abs(gap));
    return {...d,screenTransform:d.gtf+' translate(0 '+shift+')'};
  });
  return {dimensions,fontSize:px(12),tick:px(3),textOffset:px(5),dash:[px(4),px(3)].join(' '),bleedStroke:Math.max(bleed*2,px(6)),bleedEnhanced:bleed>0&&bleed*k<3};
}
