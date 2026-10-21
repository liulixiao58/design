import { bboxOf } from './layers.js';

const pose=l=>{const b=bboxOf(l);return {x:l.x,y:l.y,w:b[2],h:b[3],cx:b[0]+b[2]/2,cy:b[1]+b[3]/2,rot:l.rot||0,size:l.size||0};};
const moved=(a,b)=>['x','y','w','h','rot','size'].some(k=>Math.abs(a[k]-b[k])>1e-7);
const sourceKeys=l=>l.kind==='image'?['imgSrc','imgW','imgH','crop']:l.kind==='text'?['content','font','weight','scaleX','scaleY']:[];
const sameSource=(a,b)=>a.kind===b.kind&&sourceKeys(a).length>0&&sourceKeys(a).every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));
export function bindRegistration(layer,target){
  if(!target||(target.finish||'none')!=='none'||layer.panelId!==target.panelId||layer.id===target.id)throw new Error('请选择同一盒面的印刷图案作为套准目标。');
  return {targetId:target.id,linked:true,target:pose(target),plate:pose(layer),...(sameSource(layer,target)?{syncContent:true}:{})};
}
export function registeredLayer(layer,target){
  const r=layer.registration,a=r.target,b=r.plate,c=pose(target);
  // 同源文字变长不是缩放；字号变化才改变关联版的尺寸。
  const sx=r.syncContent&&target.kind==='text'?c.size/a.size:c.w/a.w,sy=r.syncContent&&target.kind==='text'?c.size/a.size:c.h/a.h;
  if(Math.abs(sx-sy)>1e-6&&((a.rot%180)!==0||(b.rot%180)!==0))throw new Error('旋转图案请使用等比缩放，或先解锁工艺版再调整。');
  const angle=(c.rot-a.rot)*Math.PI/180,dx=(b.cx-a.cx)*sx,dy=(b.cy-a.cy)*sy;
  const cx=c.cx+dx*Math.cos(angle)-dy*Math.sin(angle),cy=c.cy+dx*Math.sin(angle)+dy*Math.cos(angle);
  const rot=b.rot+c.rot-a.rot;
  if(layer.kind==='text'){
    if(Math.abs(sx-sy)>1e-6)throw new Error('关联文字版请使用等比缩放。');
    const size=b.size*sx;
    return {...layer,x:cx,y:cy+size*.345,size,rot,panelId:target.panelId};
  }
  return {...layer,x:cx-b.w*sx/2,y:cy-b.h*sy/2,w:b.w*sx,h:b.h*sy,rot,panelId:target.panelId};
}

// 所有编辑入口（数值、拖拽、组移动）统一联动，不建立另一套显示坐标。
export function applyRegistration(previous,next){
  const old=new Map(previous.map(l=>[l.id,l])),map=new Map(next.map(l=>[l.id,l]));
  const targets=new Map(),panels=new Map();
  for(const l of next){
    const r=l.registration,before=old.get(l.id),target=map.get(r?.targetId),oldTarget=old.get(r?.targetId);
    if(!r?.linked||!before?.registration?.linked||r!==before.registration||!target||!oldTarget)continue;
    const targetMoved=moved(pose(oldTarget),pose(target)),plateMoved=moved(pose(before),pose(l));
    const targetPanel=target.panelId!==oldTarget.panelId,platePanel=l.panelId!==before.panelId;
    if((target.locked&&(targetMoved||targetPanel))||(l.locked&&(plateMoved||platePanel)))throw new Error('套准对象已锁定，请先解锁后调整。');
    if(targetPanel||platePanel){
      if(targetPanel&&platePanel&&target.panelId!==l.panelId)throw new Error('套准盒面修改冲突，请让原图和关联工艺版使用同一盒面。');
      const panel=targetPanel?target.panelId:l.panelId;
      if(panels.has(target.id)&&panels.get(target.id)!==panel)throw new Error('套准盒面修改冲突，请分开调整或先解除联动。');
      panels.set(target.id,panel);
    }
    if(!plateMoved)continue;
    if(targetMoved){
      if(moved(pose(l),pose(registeredLayer(l,target))))throw new Error('套准位置修改冲突，请让原图和关联工艺版保持同一变换。');
      continue;
    }
    const inverse=registeredLayer({...target,registration:{target:r.plate,plate:r.target}},l);
    if(target.locked&&moved(pose(target),pose(inverse)))throw new Error('套准目标已锁定，请解锁或解除联动后调整工艺版。');
    if(targets.has(target.id)&&moved(pose(targets.get(target.id)),pose(inverse)))throw new Error('套准位置修改冲突，多张工艺版不能把同一原图改到不同位置。');
    targets.set(target.id,{...inverse,registration:target.registration,heroPreset:undefined});
  }
  for(const [id,target]of targets)map.set(id,target);
  for(const l of next){
    const root=l.registration?.linked?l.registration.targetId:l.id;
    if(!panels.has(root))continue;
    const current=map.get(l.id),panelId=panels.get(root);
    if(current.locked&&current.panelId!==panelId)throw new Error('套准对象已锁定，请先解锁后更换盒面。');
    map.set(l.id,{...current,panelId});
  }
  return next.map(l=>{
    let current=map.get(l.id);const r=current.registration,target=map.get(r?.targetId);
    if(!r?.linked||!target)return current;
    if(r.syncContent){
      if(current.kind!==target.kind||!sourceKeys(target).length)throw new Error('同源工艺版与母稿类型不一致。');
      const before=old.get(l.id);
      if(before?.registration?.syncContent&&r===before.registration&&!sameSource(before,current)&&!sameSource(current,target))throw new Error('同源工艺内容请修改印刷母稿；独立修改工艺版须先解除联动。');
      if(current.locked&&!sameSource(current,target))throw new Error('关联工艺素材已锁定，请先解锁后修改母稿。');
      if(!sameSource(current,target)){
        const patch=Object.fromEntries(sourceKeys(target).map(k=>[k,target[k]]));
        current={...current,...patch,...(target.kind==='image'?{img:target.img}:{})};
      }
    }
    const result=registeredLayer(current,target);
    if(current.locked&&moved(pose(current),pose(result)))throw new Error('关联工艺素材已锁定，请先解锁后联动。');
    return result;
  });
}

export function registrationWarnings(layers){
  const out=[];
  for(const l of layers){
    if(!l.visible||!l.registration)continue;
    const target=layers.find(t=>t.id===l.registration.targetId);
    if(!target||target.panelId!==l.panelId||(target.finish||'none')!=='none'){out.push(`${l.name||l.id}：套准目标缺失或不在同一盒面`);continue;}
    if(l.registration.syncContent&&!sameSource(l,target))out.push(`${l.name||l.id}：同源工艺轮廓或文字与母稿不一致，请重新联动`);
    try{const expected=registeredLayer(l,target);if(moved(pose(l),pose(expected)))out.push(`${l.name||l.id}：工艺版偏离套准基准，请重新套准`);}catch(e){out.push(e.message);}
  }
  return out;
}

export function validateRegistration(layers){
  for(const l of layers){const r=l.registration;if(!r)continue;
    if(!Number.isInteger(r.targetId)||r.targetId===l.id||typeof r.linked!=='boolean')throw new Error('套准关联无效。');
    if(r.syncContent!=null&&typeof r.syncContent!=='boolean')throw new Error('同源工艺关联无效。');
    for(const p of [r.target,r.plate])if(!p||!['x','y','w','h','cx','cy','rot','size'].every(k=>Number.isFinite(p[k]))||p.w<=0||p.h<=0)throw new Error('套准基准尺寸无效。');
  }
}
