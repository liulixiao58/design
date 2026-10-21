import { imageQualityOf, imageAspectOf } from './imageQuality.js';
import { registrationWarnings } from './registration.js';
import { validateProduction } from './production.js';
import { sourceRegistrationWarnings } from './sourceRegistration.js';
import { productionFontFile } from '../export/productionFonts.js';
export function productionIssues(layers,{loaded=false,reconstruction}={}){
  const issues=registrationWarnings(layers).concat(sourceRegistrationWarnings(layers));
  if(reconstruction)issues.unshift('实物反推参考工程：盖面尺寸、对位及材料参数尚未生产确认，不能作为制版文件导出');
  try{validateProduction(layers);}catch(e){issues.push(e.message);}
  for(const l of layers.filter(l=>l.visible)){
    const name=l.name||l.id;
    if(l.kind==='image'){
      const q=imageQualityOf(l),ratio=imageAspectOf(l);
      if(!q.pass)issues.push(`${name}：原素材精度未通过（须横纵均 >300 PPI，混合SVG须重建或拆分）`);
      if(loaded&&!l.img)issues.push(`${name}：原图未加载`);
      if(ratio&&Math.abs(l.w/l.h/ratio-1)>.005)issues.push(`${name}：图案存在非等比拉伸`);
    }
    if(l.kind==='text'&&!productionFontFile(l))issues.push(`${name}：字体或字重尚未接入生产PDF，须先接入并核对排版`);
  }
  return [...new Set(issues)];
}
