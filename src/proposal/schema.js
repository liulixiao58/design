import { MATS, TPLS } from '../dieline/templates.js';
import { geomOf } from '../dieline/geom.js';
import { FIN, bboxOf } from '../design/layers.js';
import { validateProduction } from '../design/production.js';

export const SECTION_IDS = ['mood', 'context', 'form', 'hero', 'material', 'interaction', 'views', 'light', 'information'];
const check = (ok, message) => { if (!ok) throw new Error(message); };
const text = v => typeof v === 'string' && v.trim().length > 0;
const finite = v => typeof v === 'number' && Number.isFinite(v);
export const httpUrl = v => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };
export const jsonForHtml = value => JSON.stringify(value).replace(/</g, '\\u003c');

export function validateProject(doc) {
  check(doc?.schema === 'box3d-project' && doc.version === 1 && text(doc.meta?.name), '工程格式或名称无效');
  if(doc.meta.reconstruction){const r=doc.meta.reconstruction;check(r.scope==='lid-only'&&r.dimensionStatus==='estimated'&&text(r.notice)&&Array.isArray(r.lidFaceMm)&&r.lidFaceMm.length===2&&r.lidFaceMm.every(v=>finite(v)&&v>0&&v<=602),'反推参考工程标记无效');}
  const box = doc.box;
  check(box && TPLS.some(t => t.id === box.tpl), '工程盒型无效');
  const mat = MATS.find(m => m.id === box.matId);
  check(mat, '工程纸材无效');
  for (const key of ['L', 'W', 'H']) check(finite(box[key]) && box[key] > 0 && box[key] <= 600, '盒内尺寸须在 0～600 mm 内：' + key);
  check(finite(box.bleed) && box.bleed >= 0 && box.bleed <= 20 && finite(box.glue) && box.glue > 0 && box.glue <= 100, '出血或糊口无效');
  for (const key of ['ovr', 'typeOvr']) check(box[key] && typeof box[key] === 'object' && !Array.isArray(box[key]), '刀版覆盖数据无效');
  check(Object.keys(box.ovr).length === 0 && Object.keys(box.typeOvr).length === 0, '提案桥第一版仅支持参数化刀版，请先移除手动节点/线型覆盖，避免 2D 与 3D 不一致');
  const layers = doc.design?.layers;
  check(Array.isArray(layers) && layers.length > 0 && layers.length <= 500, '工程须包含 1～500 个独立图层');
  validateProduction(layers);
  const panels = geomOf(box, mat.t).panels;
  const ids = new Set();
  for (const l of layers) {
    check(Number.isInteger(l.id) && l.id > 0 && !ids.has(l.id), '图层 ID 无效或重复'); ids.add(l.id);
    check(['text', 'shape', 'image'].includes(l.kind) && panels.some(p => p.panelId === l.panelId), '图层类型或面板归属无效：' + l.id);
    check(Object.hasOwn(FIN, l.finish) && typeof l.visible === 'boolean', '图层工艺或可见性无效：' + l.id);
    check([l.x, l.y].every(finite), '图层坐标无效：' + l.id);
    if (l.kind === 'text') check(text(l.content) && finite(l.size) && l.size > 0 && l.size <= 60, '文字或字号无效：' + l.id);
    else check([l.w, l.h].every(v => finite(v) && v > 0 && v <= 5000), '图层尺寸无效：' + l.id);
    if (l.kind === 'image') check(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(l.imgSrc || '') && l.imgSrc.length <= 16_000_000, '图片须为内嵌图像且小于 12 MB：' + l.id);
    const b = bboxOf(l);
    check(b.every(finite) && b.every(v => Math.abs(v) <= 10000), '图层边界无效：' + l.id);
    if (l.opacity != null) check(finite(l.opacity) && l.opacity >= 0 && l.opacity <= 1, '图层透明度无效');
    if (l.rot != null) check(finite(l.rot), '图层旋转无效');
  }
  check(Number.isInteger(doc.design.seq) && doc.design.seq > Math.max(...ids), '图层序号必须大于现有 ID');
  check(doc.appearance?.fx && typeof doc.appearance.fx === 'object', '工程缺少工艺设置');
  return doc;
}

export function validateProposal(p) {
  check(p?.deliveryMode==null||['concept','production'].includes(p.deliveryMode),'交付模式无效');
  check(p?.schema === 'openbox3d-proposal' && p.version === 1, '提案格式无效');
  for (const key of ['id', 'title', 'revision', 'summary', 'brief', 'typography']) check(text(p[key]), '提案缺少：' + key);
  for (const key of ['pending', 'warnings']) if (p[key] != null) check(Array.isArray(p[key]) && p[key].every(text), '提案列表内容无效：' + key);
  if (p.fonts != null) check(Array.isArray(p.fonts) && p.fonts.length <= 12 && p.fonts.every(f => text(f.family) && text(f.src) && (f.weight == null || typeof f.weight === 'string')), '字体配置无效');
  check(Array.isArray(p.research), '提案缺少调研来源列表');
  check(p.demo === true || p.research.length > 0 || text(p.researchSkippedReason), '正式提案须有调研来源，或记录设计师同意跳过调研的原因');
  for (const r of p.research) check(text(r.title) && text(r.insight) && text(r.application) && text(r.accessedAt) && httpUrl(r.url), '调研记录缺少来源、访问日期、分析或应用依据');
  check(Array.isArray(p.palette) && p.palette.length > 0 && p.palette.every(c => text(c.name) && /^#[\da-f]{6}$/i.test(c.value) && text(c.role)), '提案配色无效');
  check(Array.isArray(p.sections) && p.sections.length === SECTION_IDS.length && new Set(p.sections.map(s => s.id)).size === SECTION_IDS.length, '提案须包含九个不同的视觉系统板块');
  for (const s of p.sections) {
    check(SECTION_IDS.includes(s.id) && text(s.title) && text(s.intent), '板块缺少标题或设计理念');
    if (s.english != null) check(typeof s.english === 'string', '板块英文标题无效');
    if (s.pending != null) check(Array.isArray(s.pending) && s.pending.every(text), '板块待确认列表无效');
    check(Array.isArray(s.rules) && s.rules.length > 0 && s.rules.every(text), '板块缺少使用规则：' + s.id);
    check(Array.isArray(s.visuals) && s.visuals.length > 0, '板块缺少视觉内容：' + s.id);
    for (const v of s.visuals) {
      check(['palette', 'panel', 'dieline', 'views', 'finishes', 'image'].includes(v.kind) && text(v.caption), '板块视觉类型或图注无效');
      if (v.kind === 'image') check(text(v.src) && text(v.alt), '图片缺少素材或替代说明');
      if (v.kind === 'panel') check(text(v.panelId), '盒面预览缺少 panelId');
    }
  }
  return p;
}

export async function projectDigest(project) {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
