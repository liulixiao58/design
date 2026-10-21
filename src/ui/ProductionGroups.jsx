import React, { useState } from 'react';
import { store } from '../state/store.js';
import { FACTORIES, PROCESS_NAMES, productionGroups, processOf, factoryOf, plateIdOf, moveMembers, updateMembers } from '../design/production.js';
import { btnSt, inputSt, selectSt } from './widgets.jsx';

function MemberControls({ members, name }) {
  const [dx,setDx]=useState('0'),[dy,setDy]=useState('0');
  const ids=members.map(l=>l.id);
  const registered=members.filter(l=>l.registration);
  const patch=p=>store.set(st=>({layers:updateMembers(st.layers,ids,p)}));
  return <div style={{display:'grid',gap:5,margin:'6px 0'}}>
    <div style={{fontSize:10.5,color:"var(--ui-muted)"}}>位移 X / Y · mm</div>
    <div style={{display:'flex',gap:4}}>
      <input aria-label={name+' X位移 mm'} type="number" value={dx} onChange={e=>setDx(e.target.value)} style={{...inputSt,width:65}}/>
      <input aria-label={name+' Y位移 mm'} type="number" value={dy} onChange={e=>setDy(e.target.value)} style={{...inputSt,width:65}}/>
      <button disabled={!ids.length} style={{...btnSt,fontSize:11}} onClick={()=>{try{if(dx.trim()===''||dy.trim()==='')throw new Error('请输入X、Y位移。');store.set(st=>({layers:moveMembers(st.layers,ids,+dx,+dy)}));setDx('0');setDy('0');}catch(e){alert(e.message);}}}>移动</button>
    </div>
    <div style={{display:'flex',gap:4}}>
      <button style={btnSt} disabled={!ids.length} onClick={()=>patch({visible:!members.every(l=>l.visible!==false)})}>{members.every(l=>l.visible!==false)?'全隐':'全显'}</button>
      <button style={btnSt} disabled={!ids.length} onClick={()=>patch({locked:!members.every(l=>l.locked)})}>{ids.length&&members.every(l=>l.locked)?'全解锁':'全锁定'}</button>
    </div>
    {registered.length>0&&<div style={{display:'flex',gap:4}}>{[false,true].map(linked=><button key={String(linked)} disabled={members.some(l=>l.locked)} style={btnSt} onClick={()=>store.set(st=>({layers:st.layers.map(l=>ids.includes(l.id)&&l.registration?{...l,registration:{...l.registration,linked}}:l)}))}>{linked?'全部套准联动':'全部解除联动'}</button>)}</div>}
  </div>;
}

export function ProductionGroups({ layers, fallback, renderLayer }) {
  return <div style={{display:'grid',gap:8}}>{productionGroups(layers,fallback).map(group=><section aria-label={group.name} key={group.id} style={{border:"1px solid var(--ui-border)",borderRadius:6,padding:6}}>
    <details open={group.layers.length>0}><summary style={{fontSize:12,fontWeight:700,cursor:'pointer'}}>{group.name} · {group.layers.length}素材</summary>
      <MemberControls members={group.layers} name={group.name}/>
      {group.plates.length===0&&<div style={{fontSize:11,color:"var(--ui-muted)"}}>暂无素材，可在右栏指定工艺。</div>}
      {group.plates.map(plate=><section aria-label={plate.name} key={plate.process+':'+plate.id} style={{marginTop:6,borderTop:"1px dashed var(--ui-border)",paddingTop:5}}>
        <details open><summary style={{fontSize:12,cursor:'pointer'}}>{plate.name} · {plate.layers.length}素材</summary>
          <MemberControls members={plate.layers} name={plate.name}/>
          <div style={{display:'grid',gap:5}}>{plate.layers.slice().reverse().map(renderLayer)}</div>
        </details>
      </section>)}
    </details>
  </section>)}</div>;
}

export function ProductionPlateEditor({ layer, layers, fallback }) {
  const factory=factoryOf(layer),process=processOf(layer,fallback),groups=productionGroups(layers,fallback);
  const plate=groups.find(g=>g.id===factory)?.plates.find(p=>p.id===plateIdOf(layer)&&p.process===process);
  const ids=plate.layers.map(l=>l.id);
  const patch=p=>{if(plate.layers.some(l=>l.locked)){alert('版内有锁定素材，请先解锁。');return;}store.set(st=>({layers:updateMembers(st.layers,ids,p)}));};
  return <div style={{display:'grid',gap:6,fontSize:11}}>
    <label>所属工厂组<select aria-label="所属工厂组" value={factory} disabled={process==='none'} onChange={e=>patch({factoryId:e.target.value,plateId:plate.id==='default'?crypto.randomUUID():plate.id})} style={selectSt}>
      {FACTORIES.filter(f=>process==='none'?f.id==='print':f.id!=='print').map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
    </select></label>
    <label>版名称<input aria-label="版名称" maxLength={60} value={plate.name} onChange={e=>patch({plateName:e.target.value.trim()||PROCESS_NAMES[process]})} style={inputSt}/></label>
    <label>素材归属版<select aria-label="素材归属版" value={plate.id} onChange={e=>{
      const target=groups.find(g=>g.id===factory).plates.find(p=>p.id===e.target.value&&p.process===process);
      store.set(st=>({layers:updateMembers(st.layers,[layer.id],{plateId:target.id,plateName:target.name})}));
    }} style={selectSt}>{groups.find(g=>g.id===factory).plates.filter(p=>p.process===process).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <button style={btnSt} onClick={()=>store.set(st=>({layers:updateMembers(st.layers,[layer.id],{plateId:crypto.randomUUID(),plateName:(PROCESS_NAMES[process]||process)+' · 独立版'})}))}>将本素材拆为独立版</button>
    <div style={{color:"var(--ui-muted)"}}>改版名称、工厂会作用于整版；素材归属只调整当前素材。全显/全隐、全锁/全解会统一设置组内各素材状态。</div>
  </div>;
}
