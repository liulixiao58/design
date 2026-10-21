import React from 'react';
import { store } from '../state/store.js';
import { bindRegistration, registeredLayer } from '../design/registration.js';
import { btnSt,selectSt } from './widgets.jsx';
export function RegistrationEditor({layer,layers,show}){
  if((layer.finish||'none')==='none')return <div style={{fontSize:11}}>工艺版可在此盒面的印刷图案上建立套准关联。</div>;
  const r=layer.registration,target=layers.find(l=>l.id===r?.targetId);
  const update=patch=>store.set(st=>({layers:st.layers.map(l=>l.id===layer.id?{...l,...patch}:l)}));
  return <div style={{display:'grid',gap:7,fontSize:11}}>
    <label>对应印刷图案<select aria-label="套准目标" value={r?.targetId||''} style={selectSt} onChange={e=>{
      const t=layers.find(l=>l.id===+e.target.value);update({registration:t?bindRegistration(layer,t):undefined});
    }}><option value="">独立工艺图案／未关联</option>{layers.filter(l=>(l.finish||'none')==='none'&&l.panelId===layer.panelId&&l.id!==layer.id).map(l=><option key={l.id} value={l.id}>{l.name||l.content||l.id}</option>)}</select></label>
    {r&&<><label><input type="checkbox" checked={r.linked} onChange={e=>update({registration:{...r,linked:e.target.checked}})}/>联动套准</label>
      {r.syncContent&&<div>同源模式：启用联动时，轮廓／文字随印刷母稿更新；单独修改工艺内容前请先解除联动。</div>}
      <button style={btnSt} disabled={!target} onClick={()=>update({...registeredLayer(layer,target),registration:{...r,linked:true}})}>重新套准并联动</button>
      <button style={btnSt} disabled={!target} onClick={()=>update({registration:bindRegistration(layer,target)})}>将当前对位设为基准</button></>}
    <label><input type="checkbox" checked={!!show} onChange={e=>store.set({showRegistration:e.target.checked})}/>显示套准角线（仅编辑辅助）</label>
    <div style={{color:"var(--ui-muted)"}}>默认联动；解锁可单独调版。角线默认隐藏，不进入成品3D、提案或生产图稿。独立工艺图案无需强行关联印刷内容。</div>
  </div>;
}
