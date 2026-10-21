// 输出视图：项目摘要 / 导出前校验 / 工艺分版清单 / 生产文件
import React from 'react';
import { store, useStore } from '../state/store.js';
import { geomOf } from '../dieline/geom.js';
import { TPLS } from '../dieline/templates.js';
import { FIN_NAMES, layerNameOf } from '../design/layers.js';
import { imageQualityOf, imageTypeOf } from '../design/imageQuality.js';
import { embDirOf } from '../design/emboss.js';
import { CheckDetails } from './CheckDetails.jsx';
import { pageBoxes } from '../export/coordinates.js';
import { productionGroups, PENDING_FINISHES } from '../design/production.js';
import { ST, KV, btnSt } from './widgets.jsx';

export function OutputView({ checks, exporting, onExport }) {
  const s = useStore();
  const productionErrors = checks.production;
  const m = store.mat();
  const g = geomOf(s, m.t);
  const fmt = v => Math.round(v * 10) / 10;
  const sw = g.sbb[2] - g.sbb[0], sh = g.sbb[3] - g.sbb[1];
  const page = pageBoxes(s, g);
  const tplName = (TPLS.find(x => x.id === s.tpl) || TPLS[0]).name;
  const typeOvrCount = Object.keys(s.typeOvr).length;
  const missingImages = s.layers.filter(l => l.visible && l.kind === 'image' && !l.img);
  const loadedImages = s.layers.filter(l => l.visible && l.kind === 'image' && l.img);
  const rasterImages = loadedImages.filter(l => imageTypeOf(l) === 'raster');
  const lowDpiImages = rasterImages.filter(l => !imageQualityOf(l).pass);
  const vectorImages = loadedImages.filter(l => imageTypeOf(l) === 'vector');
  const checksArr = [
    { label: '页面按毫米 1:1 生成，并写入 TrimBox / BleedBox', dot: '#3f9e5f' },
    { label: '刀版另附1:1参考SVG，生产图稿不带角线', dot: '#3f9e5f' },
    { label: '出血 ' + s.bleed + ' mm ' + (s.bleed >= m.bleed ? '≥' : '<') + ' 材质建议 ' + m.bleed + ' mm（' + m.note + '）', dot: s.bleed >= m.bleed ? '#3f9e5f' : '#d05a2a' },
    { label: missingImages.length ? '有 ' + missingImages.length + ' 个图片资源尚未加载，专业净稿/工艺分版将阻止导出' : '图片资源均已加载', dot: missingImages.length ? '#d05a2a' : '#3f9e5f' },
    { label: lowDpiImages.length ? '有 ' + lowDpiImages.length + ' 个位图未通过横纵 PPI > 300 检查' : rasterImages.length ? '已加载位图横纵 PPI 均大于 300' : '暂无已加载位图可检查 PPI', dot: lowDpiImages.length ? '#d05a2a' : rasterImages.length ? '#3f9e5f' : '#9a8f7e' },
    { label: '识别到 ' + vectorImages.length + ' 个纯矢量源素材；生产PDF保留矢量，评审PDF仅供预览', dot: '#3f9e5f' },
    { label: '轮廓闭合、自交、孤立线段与最小刀距：本版本未自动检测，交付前须由印厂/RIP 预检', dot: '#9a8f7e' }
  ];
  const outSummary = [
    { k: '盒型', v: tplName }, { k: s.reconstruction ? '模板占位参数（非成品尺寸）' : '内尺寸', v: s.L + ' × ' + s.W + ' × ' + s.H + ' mm' },
    { k: '材质', v: m.name + ' · t=' + m.t }, { k: '出血', v: s.bleed + ' mm' },
    { k: '展开尺寸', v: fmt(sw) + ' × ' + fmt(sh) + ' mm' },
    { k: '导出页面（含出血）', v: page.Wmm.toFixed(2) + ' × ' + page.Hmm.toFixed(2) + ' mm' },
    { k: '共同坐标基准', v: '展开图毫米坐标 · 印刷/工艺版一致' },
    { k: '刀线', v: g.cutN + ' 切 · ' + g.creaseN + ' 压 · 线型调整 ' + typeOvrCount },
    { k: '设计图层', v: s.layers.length + ' 层' }
  ];
  const outFins = ['foil', 'silver', 'uv', 'gloss', 'holo', ...PENDING_FINISHES].map(f => ({ k: FIN_NAMES[f] + '版', v: s.layers.filter(l => l.finish === f).map(layerNameOf).join('、') || '—' }))
    .concat(['up', 'down'].map(dir => ({ k: (dir === 'up' ? '击凸' : '击凹') + '版', v: s.layers.filter(l => l.finish === 'emboss' && embDirOf(l, s.embDir) === dir).map(layerNameOf).join('、') || '—' })))
    .concat([{ k: '四色印刷', v: s.layers.filter(l => l.finish === 'none').length + ' 层' }])
    .concat(productionGroups(s.layers,s.embDir).map(group=>({k:group.name,v:group.plates.map(p=>p.name+'（'+p.layers.length+'素材）').join('、')||'—'})));
  const card = { background: 'var(--ui-canvas)', border: '1px solid var(--ui-border-soft)', borderRadius: 8, padding: '22px 24px' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: "var(--ui-subtle)" }}>
      <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 20px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={card}>
          <h1 className="delivery-title">交付文件</h1>
          <p className="delivery-intro">{tplName} · {s.reconstruction ? '模板占位参数（非成品尺寸）' : '内尺寸'} {s.L} × {s.W} × {s.H} mm · {s.layers.length} 个图层</p>
          <button disabled={exporting} onClick={() => onExport('rgb')} style={{ ...btnSt, width: '100%' }}>评审 PDF（仅预览，不能制版）</button>
          <button disabled={exporting || productionErrors.length > 0} onClick={() => onExport('cmyk')} style={{ ...btnSt, marginTop: 10, width: '100%' }}>
            {exporting ? '正在生成，请稍候…' : '生产文件包（三份分层 PDF 母版）'}
          </button>
          {productionErrors.length > 0 && <p className="menu-blocker">有 {productionErrors.length} 项生产阻断，详情见右侧检查。</p>}
          <p className="delivery-intro">交付前仍须完成印厂 / RIP 人工预检。生成状态和错误在工作台顶部显示。</p>
        </div>
        <div style={card}><ST>交付检查</ST><CheckDetails checks={checks} /></div>
        <details className="professional-section" style={card}><summary>项目与文件尺寸详情</summary>{outSummary.map(r => (
          <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 12.5, borderBottom: "1px dashed var(--ui-border-soft)" }}>
            <span style={{ color: "var(--ui-secondary)", whiteSpace: 'nowrap' }}>{r.k}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--ui-ink)", textAlign: 'right' }}>{r.v}</span>
          </div>))}
        </details>
        <details className="professional-section" style={card}>
          <summary>文件规范与素材统计</summary>
          {checksArr.map(c => (
            <div key={c.label} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '4px 0', fontSize: 12.5, color: "var(--ui-ink)", lineHeight: 1.5 }}>
              {c.label}
            </div>))}
        </details>
        <details className="professional-section" style={card}><summary>{s.reconstruction ? '3D模拟通道与原版分组（箔色、凸凹仅作示意）' : '生产分组与工艺分版清单'}</summary>{outFins.map(f => (
          <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 12.5, borderBottom: "1px dashed var(--ui-border-soft)" }}>
            <span style={{ color: "var(--ui-secondary)", whiteSpace: 'nowrap' }}>{f.k}</span>
            <span style={{ color: "var(--ui-ink)", textAlign: 'right' }}>{f.v}</span>
          </div>))}
        </details>
        <details className="professional-section" style={card}>
          <summary>生产文件说明与兼容性</summary>
          <div style={{fontSize:11,lineHeight:1.7,color:"var(--ui-muted)"}}>输出印刷层、工厂一工艺层、工厂二工艺层三份同尺寸PDF母版；内部按版与单独素材保留PDF图层，矢量与文字保持独立对象，图片保留原生精度。工艺制版前只启用所需版。角线不写入图稿，刀版另附参考SVG。不同软件的编辑兼容性须由工厂试开确认；CMYK无ICC/PDF-X认证。</div>
          <p className="delivery-intro">生成记录中的 manifest.json 保留图层、独立素材、页面尺寸、位图 PPI 与 SHA-256 复核信息。</p>
        </details>
      </div>
    </div>
  );
}
