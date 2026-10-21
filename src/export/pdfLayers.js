import { layerNameOf } from '../design/layers.js';

export const MASTER_FILES={print:'印刷层.pdf',metal:'工厂一工艺层.pdf',film:'工厂二工艺层.pdf'};

// 同一工艺版可跨多个绘制片段，保留原图层叠放顺序，不按版重排图案。
export function productionPdfLayers(doc,group){
  const refs=[],order=[],properties={},bindings=new Map(),plates=[];
  const ocg=name=>{const ref=doc.ref({Type:'OCG',Name:new String(name)});ref.end();refs.push(ref);return ref;};
  for(const [index,plate]of group.plates.entries()){
    const layers=plate.layers.filter(l=>l.visible);if(!layers.length)continue;
    const key='Plate'+index,ref=ocg(plate.name),children=[];
    properties[key]=ref;order.push(ref,children);
    const members=[];
    for(const layer of layers){
      const asset='Asset'+layer.id,name=layerNameOf(layer),assetRef=ocg(name);
      properties[asset]=assetRef;children.push(assetRef);
      bindings.set(layer.id,{plate:key,asset});members.push({id:layer.id,name,property:asset});
    }
    plates.push({id:plate.id,name:plate.name,process:plate.process,property:key,members});
  }
  doc.page.resources.data.Properties=properties;
  doc._root.data.OCProperties={OCGs:refs,D:{Name:new String(group.name),BaseState:'ON',ON:refs,Order:order}};
  doc._root.data.PageMode='UseOC';
  return {bindings,plates};
}
