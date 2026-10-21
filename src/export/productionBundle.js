import { geomOf } from '../dieline/geom.js';
import { bboxOf } from '../design/layers.js';
import { clipPtsOf } from '../design/containers.js';
import { imageTypeOf, imageQualityOf } from '../design/imageQuality.js';
import { productionGroups } from '../design/production.js';
import { productionIssues } from '../design/productionCheck.js';
import { pageBoxes } from './coordinates.js';
import { verifyProductionPdf } from './verifyProduction.js';
import { assertProductionSvg, croppedSvgViewBox } from './svgPreflight.js';
import { MASTER_FILES, productionPdfLayers } from './pdfLayers.js';
import { asset } from '../asset.js';
import { makeProject } from '../projects/projects.js';
import { validateProject } from '../proposal/schema.js';
import { zipSync, strToU8 } from 'fflate';
import { productionFontFile } from './productionFonts.js';

const cmyk=rgb=>{const [r,g,b]=rgb.map(v=>v/255),k=1-Math.max(r,g,b);return k>=.999999?[0,0,0,100]:[(1-r-k)/(1-k)*100,(1-g-k)/(1-k)*100,(1-b-k)/(1-k)*100,k*100];};
const color=s=>{const m=/^#([\da-f]{6})$/i.exec(s||'');if(!m)throw new Error('生产颜色必须为六位十六进制色值');return cmyk([0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)));};
const decodeSvg=src=>new TextDecoder().decode(Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)));
async function fontData(layers){return Promise.all([...new Set(['NotoSansSC-400.ttf',...layers.filter(l=>l.visible&&l.kind==='text').map(productionFontFile)])].map(async file=>{const r=await fetch(asset('/fonts/'+file));if(!r.ok)throw new Error('印刷字体加载失败：'+file);return [file,new Uint8Array(await r.arrayBuffer())];}));}

function bitmap(doc,l,plate,index){
  const cr=l.crop||[0,0,1,1],W=Math.ceil(l.img.naturalWidth*cr[2]),H=Math.ceil(l.img.naturalHeight*cr[3]);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const ctx=cv.getContext('2d');ctx.drawImage(l.img,cr[0]*l.img.naturalWidth,cr[1]*l.img.naturalHeight,l.img.naturalWidth*cr[2],l.img.naturalHeight*cr[3],0,0,W,H);
  const rgba=ctx.getImageData(0,0,W,H).data,alpha=new Uint8Array(W*H),pixels=new Uint8Array(W*H*(plate?1:4));
  for(let i=0,j=0;i<rgba.length;i+=4,j++){
    alpha[j]=plate?Math.round((rgba[i]*.299+rgba[i+1]*.587+rgba[i+2]*.114)*rgba[i+3]/255):rgba[i+3];
    if(plate)pixels[j]=0;
    else pixels.set(cmyk([rgba[i],rgba[i+1],rgba[i+2]]).map(v=>Math.round(v*2.55)),j*4);
  }
  const mask=doc.ref({Type:'XObject',Subtype:'Image',Width:W,Height:H,ColorSpace:'DeviceGray',BitsPerComponent:8});mask.end(alpha);
  const ref=doc.ref({Type:'XObject',Subtype:'Image',Width:W,Height:H,ColorSpace:plate?'DeviceGray':'DeviceCMYK',BitsPerComponent:8,SMask:mask});ref.end(pixels);
  const key='Image'+index;doc.page.xobjects[key]=ref;
  doc.save().transform(l.w,0,0,-l.h,l.x,l.y+l.h).addContent('/'+key+' Do').restore();
}

async function renderPDF(group,s,g,boxes,PDFDocument,SVGtoPDF,fontBytes){
  const plate=group.id!=='print',layers=group.layers.filter(l=>l.visible);
  const doc=new PDFDocument({pdfVersion:'1.7',size:[boxes.Wpt,boxes.Hpt],margin:0,compress:true,info:{Title:MASTER_FILES[group.id],Subject:'1:1 mm; optional content plate and asset layers; source raster >300ppi; no ICC/PDF-X claim'}});
  const chunks=[];const done=new Promise((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>{const out=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let p=0;for(const b of chunks){out.set(b,p);p+=b.length;}resolve(out);});});
  doc._root.data.ViewerPreferences=doc.ref({PrintScaling:'None'});
  doc.page.dictionary.data.TrimBox=[boxes.b*boxes.k,boxes.b*boxes.k,boxes.Wpt-boxes.b*boxes.k,boxes.Hpt-boxes.b*boxes.k];
  doc.page.dictionary.data.BleedBox=[0,0,boxes.Wpt,boxes.Hpt];
  const hierarchy=productionPdfLayers(doc,group);
  for(const [file,bytes]of fontBytes)doc.registerFont(file,bytes);
  doc.save().scale(boxes.k).translate(-boxes.ox,-boxes.oy);
  for(const [index,l]of layers.entries()){
    const binding=hierarchy.bindings.get(l.id);
    doc.addContent(`/OC /${binding.plate} BDC\n/OC /${binding.asset} BDC`);
    doc.save();const pts=clipPtsOf(g.panels,l);
    if(pts?.length){doc.moveTo(...pts[0]);for(const p of pts.slice(1))doc.lineTo(...p);doc.closePath().clip();}
    const b=bboxOf(l);if(l.rot)doc.rotate(l.rot,{origin:[b[0]+b[2]/2,b[1]+b[3]/2]});
    doc.opacity(l.opacity??1);
    if(l.kind==='shape')doc.rect(l.x,l.y,l.w,l.h).fill(plate?[0,0,0,100]:color(l.color));
    else if(l.kind==='text'){
      doc.font(productionFontFile(l)).fontSize(l.size);
      for(const ch of l.content)if(!doc._font.font.hasGlyphForCodePoint(ch.codePointAt(0)))throw new Error('内嵌字体缺少字符：'+ch);
      if(l.scaleX||l.scaleY)doc.scale(l.scaleX||1,l.scaleY||1,{origin:[l.x,l.y-l.size*.345]});
      doc.fillColor(plate?[0,0,0,100]:color(l.color)).text(l.content,l.x-doc.widthOfString(l.content)/2,l.y,{lineBreak:false,baseline:'alphabetic'});
    }else if(imageTypeOf(l)==='vector'){
      const xml=new DOMParser().parseFromString(decodeSvg(l.imgSrc),'image/svg+xml');
      if(xml.querySelector('script,parsererror')||xml.querySelector('[href],[onload],[onclick]'))throw new Error('SVG存在不支持的脚本或引用');
      const root=xml.documentElement,cr=l.crop;
      assertProductionSvg(root,plate);
      if(cr)root.setAttribute('viewBox',croppedSvgViewBox(root,cr));
      const warnings=[];
      SVGtoPDF(doc,root,l.x,l.y,{width:l.w,height:l.h,assumePt:true,preserveAspectRatio:'none',fontCallback:()=> 'NotoSansSC-400.ttf',colorCallback:c=>c?[plate?[0,0,0,100]:cmyk(c[0]),c[1]]:c,warningCallback:w=>warnings.push(w)});
      if(warnings.length)throw new Error('SVG转换未通过：'+warnings.join('；'));
    }else bitmap(doc,l,plate,index);
    doc.restore();
    doc.addContent('EMC\nEMC');
  }
  doc.restore();doc.end();return {bytes:await done,plates:hierarchy.plates};
}

export async function buildProductionBundle(s,mat){
  validateProject(makeProject(s));
  const issues=productionIssues(s.layers,{loaded:true,reconstruction:s.reconstruction});if(issues.length)throw new Error('生产导出被阻止：\n'+issues.join('\n'));
  const [pdfkit,{default:SVGtoPDF},fontBytes,{default:Helvetica}]=await Promise.all([import('pdfkit'),import('svg-to-pdfkit'),fontData(s.layers),import('pdfkit/standard-fonts/Helvetica')]);
  pdfkit.registerStdFonts(Helvetica);const PDFDocument=pdfkit.default;
  const g=geomOf(s,mat.t),boxes=pageBoxes(s,g),files={},report={version:2,format:'three-layered-pdf-masters',units:'mm',box:{tpl:s.tpl,L:s.L,W:s.W,H:s.H,dimension:'inner'},page:{origin:[boxes.ox,boxes.oy],size:[boxes.Wmm,boxes.Hmm],bleed:s.bleed},marksVisible:false,checks:[],limitations:['工艺母版包含多种版；制版前仅启用所需版，不能将全部工艺叠加直接制版','PDF原生图层不保证所有编辑软件完整恢复字体和分组，需工厂试开','CMYK为数值转换，无ICC/PDF-X认证；需印厂RIP与实物打样'],layers:s.layers.filter(l=>l.visible).map(l=>({id:l.id,panelId:l.panelId,x:l.x,y:l.y,w:l.w,h:l.h,rot:l.rot||0,finish:l.finish,factoryId:l.factoryId,plateId:l.plateId,registration:l.registration,quality:l.kind==='image'?imageQualityOf(l):{type:'vector-text-or-shape'}}))};
  for(const group of productionGroups(s.layers,s.embDir)){
    const layers=group.layers.filter(l=>l.visible),file=MASTER_FILES[group.id];
    const {bytes,plates}=await renderPDF(group,s,g,boxes,PDFDocument,SVGtoPDF,fontBytes);
    const check=await verifyProductionPdf(bytes,boxes,{plates});
    if(check.rasters.length!==layers.filter(l=>l.kind==='image'&&imageTypeOf(l)!=='vector').length)throw new Error('导出复核失败：位图数量不符');
    files[file]=bytes;report.checks.push({file,factoryId:group.id,name:group.name,empty:!layers.length,plates,layerIds:layers.map(l=>l.id),...check,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')});
  }
  files['交付说明.txt']=strToU8('三份PDF母版使用相同1:1页面、原点与套准基准。\n请在支持PDF图层的软件中打开：工艺版为父图层，单独素材为子图层；矢量与文字未整页栅格化，图片保留独立图像对象。\n工艺母版默认显示全部版，仅供整体核对。制版前必须只启用所需工艺版，不能把全部工艺混在一起制版。\n空白母版表示该工厂没有可见素材，详见manifest.json。照片内部不是矢量路径；不同软件的字体、分组与图层恢复须由工厂试开确认。\n角线不进入图稿，刀版参考另附。CMYK无ICC/PDF-X认证，正式生产前仍需RIP与实物打样。');
  files['reference/dieline.svg']=strToU8(`<svg xmlns="http://www.w3.org/2000/svg" width="${boxes.Wmm}mm" height="${boxes.Hmm}mm" viewBox="${boxes.ox} ${boxes.oy} ${boxes.Wmm} ${boxes.Hmm}"><path d="${g.cutPath}" fill="none" stroke="red" stroke-width="0.15"/><path d="${g.creasePath}" fill="none" stroke="green" stroke-width="0.15"/></svg>`);
  files['manifest.json']=strToU8(JSON.stringify(report,null,2));
  return {files,report,zip:zipSync(files,{level:6})};
}
export async function exportProductionBundle(s,mat){
  const bundle=await buildProductionBundle(s,mat),url=URL.createObjectURL(new Blob([bundle.zip],{type:'application/zip'}));
  const a=document.createElement('a');a.href=url;a.download=`${s.tpl}_${s.L}x${s.W}x${s.H}_production.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return bundle.report;
}
