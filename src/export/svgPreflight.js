// 当前仅接收透明背景、白色正图的矢量工艺版，避免反白区域和预览的亮度蒙版不一致。
export function croppedSvgViewBox(root, crop) {
  let box;
  const raw = root.getAttribute('viewBox');
  if (raw) box = raw.trim().split(/[ ,]+/).map(Number);
  else {
    const size = key => {
      const value = root.getAttribute(key);
      if (!value) return key === 'width' ? 300 : 150;
      const match = /^\s*(\d*\.?\d+(?:e[-+]?\d+)?)\s*(px|mm|cm|in|pt|pc)?\s*$/i.exec(value);
      if (!match) throw new Error('无viewBox的SVG须提供明确的宽高（px/mm/cm/in/pt/pc），请整理源图后导出');
      return Number(match[1]) * ({px:1,mm:96/25.4,cm:96/2.54,in:96,pt:96/72,pc:16}[match[2]?.toLowerCase() || 'px']);
    };
    box = [0, 0, size('width'), size('height')];
  }
  if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) throw new Error('SVG viewBox或源尺寸无效，不能生成裁切制版文件');
  return [box[0]+crop[0]*box[2], box[1]+crop[1]*box[3], box[2]*crop[2], box[3]*crop[3]].join(' ');
}

export function assertProductionSvg(root,plate){
  if(root.querySelector('text'))throw new Error('SVG文字须先转为矢量轮廓，避免生产字体被替换');
  if(!plate)return;
  if(root.querySelector('style,mask,filter,pattern,linearGradient,radialGradient,use')||root.hasAttribute('style')||root.querySelector('[style]'))throw new Error('复杂SVG工艺版须先整理为透明背景白色正图，不支持样式、渐变或蒙版');
  const paint=(node,key)=>{
    for(let p=node;p;p=p.parentElement){const value=p.getAttribute(key);if(value&&value!=='inherit')return value.toLowerCase().replace(/\s/g,'');}
    return key==='fill'?'black':'none';
  };
  for(const node of root.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')){
    if(node.closest('defs,clipPath'))continue;
    for(const key of ['fill','stroke'])if(!['none','white','#fff','#ffffff','rgb(255,255,255)','rgb(100%,100%,100%)'].includes(paint(node,key)))throw new Error('SVG工艺版含非白色图形，请先整理为透明背景白色正图，再核对反白与镂空');
  }
}
