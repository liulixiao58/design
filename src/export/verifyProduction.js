import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
const multiply=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
export async function verifyProductionPdf(bytes,boxes,hierarchy){
  const pdf=await PDFDocument.load(bytes),pages=pdf.getPages();
  if(pages.length!==1)throw new Error('导出复核失败：页数错误');
  const p=pages[0],size=p.getSize(),trim=p.getTrimBox();
  const expectedTrim=[boxes.b*boxes.k,boxes.b*boxes.k,boxes.Wpt-2*boxes.b*boxes.k,boxes.Hpt-2*boxes.b*boxes.k];
  if(Math.abs(size.width-boxes.Wpt)>1e-3||Math.abs(size.height-boxes.Hpt)>1e-3||[trim.x,trim.y,trim.width,trim.height].some((v,i)=>Math.abs(v-expectedTrim[i])>1e-3))throw new Error('导出复核失败：页面/裁切尺寸不一致');
  const bleed=p.getBleedBox();
  if([bleed.x,bleed.y,bleed.width-boxes.Wpt,bleed.height-boxes.Hpt].some(v=>Math.abs(v)>1e-3))throw new Error('导出复核失败：出血框不一致');
  let contents=p.node.Contents();
  const streams=contents instanceof PDFRawStream?[contents]:contents.asArray().map(r=>pdf.context.lookup(r));
  const source=streams.map(s=>new TextDecoder('latin1').decode(decodePDFRawStream(s).decode())).join('\n');
  let pdfLayers;
  if(hierarchy){
    const oc=pdf.catalog.lookup(PDFName.of('OCProperties'));
    if(!oc)throw new Error('导出复核失败：缺少PDF图层');
    const refs=oc.lookup(PDFName.of('OCGs')).asArray(),declared=new Set(refs.map(r=>r.toString()));
    const props=p.node.Resources().lookup(PDFName.of('Properties'));
    const order=oc.lookup(PDFName.of('D')).lookup(PDFName.of('Order')).asArray();
    const expected=new Map();
    const validate=(key,name)=>{
      const ref=props.get(PDFName.of(key)),obj=props.lookup(PDFName.of(key));
      if(!ref||!declared.has(ref.toString())||obj.get(PDFName.of('Type'))?.toString()!=='/OCG'||obj.get(PDFName.of('Name'))?.decodeText()!==name)throw new Error('导出复核失败：PDF图层名称或引用不符');
      return ref;
    };
    let total=0;
    for(const [i,plate]of hierarchy.plates.entries()){
      const ref=validate(plate.property,plate.name),children=order[2*i+1];
      if(order[2*i]?.toString()!==ref.toString()||!children||children.size()!==plate.members.length)throw new Error('导出复核失败：PDF工艺版层级不符');
      for(const [j,member]of plate.members.entries()){
        const asset=validate(member.property,member.name);
        if(children.get(j).toString()!==asset.toString())throw new Error('导出复核失败：PDF素材层级不符');
        expected.set(member.property,plate.property);total++;
      }
    }
    if(refs.length!==total+hierarchy.plates.length||order.length!==hierarchy.plates.length*2)throw new Error('导出复核失败：PDF图层数量不符');
    const stack=[],seen=new Set();
    for(const token of source.matchAll(/\/OC\s+\/(\w+)\s+BDC\b|\bEMC\b/g)){
      if(token[1]){
        if(stack.length===1){if(expected.get(token[1])!==stack[0]||seen.has(token[1]))throw new Error('导出复核失败：素材未绑定独立工艺版');seen.add(token[1]);}
        else if(stack.length!==0||!hierarchy.plates.some(p=>p.property===token[1]))throw new Error('导出复核失败：PDF图层内容层级错误');
        stack.push(token[1]);
      }else if(!stack.pop())throw new Error('导出复核失败：PDF图层内容未闭合');
    }
    if(stack.length||seen.size!==total)throw new Error('导出复核失败：独立素材内容缺失');
    pdfLayers={plateCount:hierarchy.plates.length,assetCount:total};
  }
  const xobjects=p.node.Resources().lookup(PDFName.of('XObject'));
  const number='[-+]?(?:\\d*\\.)?\\d+(?:e[-+]?\\d+)?';
  const operators=new RegExp(`(?<!\\S)(q|Q)(?!\\S)|(${number}(?:\\s+${number}){5})\\s+cm\\b|/([^\\s/<>\\[\\]()]+)\\s+Do\\b`,'g');
  let matrix=[1,0,0,1,0,0],stack=[],rasters=[];
  for(const match of source.matchAll(operators)){
    if(match[1]==='q')stack.push(matrix.slice());
    else if(match[1]==='Q')matrix=stack.pop()||matrix;
    else if(match[2])matrix=multiply(matrix,match[2].trim().split(/\s+/).map(Number));
    else if(match[3]){
      const obj=xobjects?.lookup(PDFName.of(match[3]));
      if(obj?.dict.get(PDFName.of('Subtype'))?.toString()!=='/Image')continue;
      const w=obj.dict.get(PDFName.of('Width')).asNumber(),h=obj.dict.get(PDFName.of('Height')).asNumber();
      const x=w/Math.hypot(matrix[0],matrix[1])*72,y=h/Math.hypot(matrix[2],matrix[3])*72;
      if(!(x>300&&y>300))throw new Error('导出复核失败：实际PDF中图片PPI不大于300');
      rasters.push({pixels:[w,h],ppi:[x,y],matrix});
    }
  }
  return {pageMm:[size.width/boxes.k,size.height/boxes.k],trimMm:[trim.x/boxes.k,trim.y/boxes.k,trim.width/boxes.k,trim.height/boxes.k],rasters,...(pdfLayers?{pdfLayers}:{})};
}
