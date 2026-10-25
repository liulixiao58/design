import {imageQualityOf,imageSizeOf,imageTypeOf} from './imageQuality.js';

export function requiredPixels(w,h){
  return [w,h].every(n=>Number.isFinite(n)&&n>0)?[w,h].map(n=>Math.floor(n/25.4*300)+1):null;
}

// 按原始内容复用；复用次数不等于需要重新生成的素材数。
export function sourceBudgets(layers){
  const sources=new Map();
  for(const l of layers.filter(l=>l.visible&&l.kind==='image')){
    const type=imageTypeOf(l),quality=imageQualityOf(l),crop=l.crop||[0,0,1,1];
    const required=quality.valid===false?null:requiredPixels(l.w/crop[2],l.h/crop[3]);
    const source=sources.get(l.imgSrc)||{name:l.name||String(l.id),type,native:imageSizeOf(l),required:null,pass:true,uses:[]};
    source.pass&&=quality.pass;source.uses.push({id:l.id,name:l.name,panel:l.panelId,mm:[l.w,l.h]});
    if(required)source.required=(source.required||[0,0]).map((n,i)=>Math.max(n,required[i]));
    sources.set(l.imgSrc,source);
  }
  return [...sources.values()];
}
