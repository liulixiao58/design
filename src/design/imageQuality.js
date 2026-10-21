// 检查原素材在最终毫米尺寸下的有效精度，不使用可编辑的 pxw / DPI 标签。
export function imageTypeOf(l) {
  if (!/^data:image\/svg\+xml[;,]/i.test(l.imgSrc || '')) return 'raster';
  try {
    const comma = l.imgSrc.indexOf(',');
    const xml = /;base64/i.test(l.imgSrc.slice(0, comma)) ? atob(l.imgSrc.slice(comma + 1)) : decodeURIComponent(l.imgSrc.slice(comma + 1));
    return /<svg\b/i.test(xml) && !/<(?:[\w-]+:)?(?:image|foreignObject|filter|use)\b|<!ENTITY/i.test(xml) ? 'vector' : 'mixed';
  } catch { return 'mixed'; }
}

export function imageSizeOf(l) {
  return [l.img?.naturalWidth || l.imgW || 0, l.img?.naturalHeight || l.imgH || 0];
}

export function imageAspectOf(l) {
  const [w, h] = imageSizeOf(l), cr = l.crop || [0, 0, 1, 1];
  return w > 0 && h > 0 && cr[2] > 0 && cr[3] > 0 ? w * cr[2] / (h * cr[3]) : null;
}

export function imageQualityOf(l) {
  const type = imageTypeOf(l), [w, h] = imageSizeOf(l), cr = l.crop || [0, 0, 1, 1];
  const validCrop=Array.isArray(cr)&&cr.length===4&&cr.every(Number.isFinite)&&cr[0]>=0&&cr[1]>=0&&cr[2]>0&&cr[3]>0&&cr[0]+cr[2]<=1.000001&&cr[1]+cr[3]<=1.000001;
  if(!validCrop)return {type,pass:false,valid:false,x:0,y:0,min:0};
  if (type !== 'raster') return { type, pass: type === 'vector', valid:true };
  const valid = [w, h, l.w, l.h, cr[2], cr[3]].every(v => Number.isFinite(v) && v > 0)
    && cr[0] >= 0 && cr[1] >= 0 && cr[0] + cr[2] <= 1.000001 && cr[1] + cr[3] <= 1.000001;
  const x = valid ? w * cr[2] / l.w * 25.4 : 0, y = valid ? h * cr[3] / l.h * 25.4 : 0;
  return { type, x, y, min: Math.min(x, y), pass: valid && x > 300 && y > 300, valid };
}

export function imageQualityLabel(l) {
  const q = imageQualityOf(l);
  if(q.valid===false)return '原图像素尺寸或裁剪信息不完整 · 无法核验';
  if (q.type === 'vector') return '矢量源素材 · 不按像素 PPI 检查';
  if (q.type === 'mixed') return 'SVG 含图像/效果或引用 · 需单独核查精度';
  if (!q.valid) return '原图像素尺寸或裁剪信息不完整 · 无法核验';
  return `有效 PPI：横 ${q.x.toFixed(2)} / 纵 ${q.y.toFixed(2)}${q.pass ? ' · 均大于 300' : ' · 必须均大于 300'}`;
}

export function resizeImage(l, axis, value) {
  const v = Math.max(axis === 'w' ? 2 : 1, value);
  if (l.kind !== 'image' || l.aspectLocked === false) return { [axis]: v };
  const ratio = l.w / l.h;
  return axis === 'w' ? { w: v, h: v / ratio } : { h: v, w: v * ratio };
}

export function restoreImageAspect(l) {
  const ratio = imageAspectOf(l);
  if (!ratio) return {};
  const w = Math.min(l.w, l.h * ratio), h = w / ratio;
  return { x: l.x + (l.w - w) / 2, y: l.y + (l.h - h) / 2, w, h, aspectLocked: true };
}
