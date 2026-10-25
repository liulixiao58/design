import React from 'react';
import {requiredPixels,sourceBudgets} from '../design/sourceBudget.js';

export function SourceBudget({layers,plan={},onPlanChange}){
  const w=plan.widthMm||'',h=plan.heightMm||'';
  const sources=sourceBudgets(layers),raster=sources.filter(s=>s.type!=='vector');
  const pixels=requiredPixels(Number(w),Number(h));
  return <section aria-label="生成前素材预算" style={{overflowWrap:'anywhere'}}>
    <h3>生成前素材预算与复用</h3>
    <p className="workflow-hint">先填元素最终使用尺寸，再决定素材做法。这里计算裁切后需保留的原生像素；修改DPI标签或插值放大不算恢复细节。</p>
    <div className="workflow-form">
      <label>元素宽度 mm<input aria-label="素材计划宽度 mm" type="number" min="0" value={w} onChange={e=>onPlanChange({...plan,widthMm:e.target.value})}/></label>
      <label>元素高度 mm<input aria-label="素材计划高度 mm" type="number" min="0" value={h} onChange={e=>onPlanChange({...plan,heightMm:e.target.value})}/></label>
    </div>
    <p role="status">{pixels?'横纵均大于300 PPI，至少需要 '+pixels.join(' × ')+' 个有效原生像素。':'输入元素尺寸，先计算原生像素预算。'}</p>
    <p>当前 {sources.length} 份不同源素材，复用于 {sources.reduce((n,s)=>n+s.uses.length,0)} 处；其中位图或混合素材 {raster.length} 份。</p>
    {raster.map((s,i)=><details key={i}><summary>{s.pass?'技术通过':'需处理'} · {s.name} · 复用 {s.uses.length} 处</summary>
      <p>原图 {s.native.join(' × ')} px；{s.required?'按当前尺寸与裁切，原图至少需要 '+s.required.join(' × ')+' px。':'使用尺寸或裁切无效，无法计算精度预算。'}</p>
      <ul>{s.uses.map(u=><li key={u.id}>{u.name}：{u.mm.map(n=>n.toFixed(2)).join(' × ')} mm</li>)}</ul>
    </details>)}
    <p className="workflow-hint">已有合格源稿直接复用；文字、标志、流线和工艺边界优先保留矢量。复杂凝胶纹理允许合格位图。工具达不到原生精度时先调整素材做法，不重复生成同一低清效果。</p>
  </section>;
}
