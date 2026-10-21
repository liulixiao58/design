// 设计视图：图层列表 + 分层画布 + 属性面板（内容/变换/对齐/排版/尺寸/工艺/排列/警示）
import React, { useEffect } from 'react';
import { store, useStore } from '../state/store.js';
import { geomOf, creaseSegsOf } from '../dieline/geom.js';
import { heroPanelOf } from '../dieline/hero.js';
import { bboxOf, warnsOf, FIN, layerNameOf } from '../design/layers.js';
import { imageQualityOf, imageQualityLabel, resizeImage, restoreImageAspect } from '../design/imageQuality.js';
import { bboxOfPts, containerOfLayer } from '../design/containers.js';
import { embDirOf } from '../design/emboss.js';
import { uploadImage, imageFilesOf, readImageFile, imageLayerAt } from '../design/images.js';
import { SheetCanvas } from './SheetCanvas.jsx';
import { ProductionGroups, ProductionPlateEditor } from './ProductionGroups.jsx';
import { RegistrationEditor } from './RegistrationEditor.jsx';
import { SourceRegistrationEditor } from './SourceRegistrationEditor.jsx';
import { ActionMenu } from './ActionMenu.jsx';
import { ST, Block, Note, inputSt, selectSt, btnSt } from './widgets.jsx';

export function DesignView() {
  const s = useStore();
  const m = store.mat();
  const g = geomOf(s, m.t);
  const hero = heroPanelOf(g);
  const creaseSegs = creaseSegsOf(g);
  const upd = patch => store.set(st => ({ layers: st.layers.map(l => l.id === st.sel ? { ...l, ...patch, heroPreset: undefined } : l) }));
  const sel = s.layers.find(l => l.id === s.sel);
  const selWarns = sel ? warnsOf(sel, creaseSegs, g.sbb) : [];
  const [histPastN, histFutureN] = store.histDepth(); // 撤销/重做栈深度（随 store 变更自动刷新）

  // 键盘：⌘Z 撤销 · ⌘⇧Z/⌃Y 重做 · 方向键微移 1mm（Shift=5mm）· Delete 删除 · ⌘D 复制 · Esc 取消选中
  useEffect(() => {
    const kd = e => {
      const st = store.get();
      if (st.view !== 'design') return;
      const tag = (document.activeElement || {}).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); store.redo(); return; }
      if (st.sel == null) return;
      const l = st.layers.find(x => x.id === st.sel); if (!l) return;
      if(l.locked&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();return;}
      const step = e.shiftKey ? 5 : 1;
      const mv = (dx, dy) => { e.preventDefault(); if (!l.locked) store.set(s2 => ({ layers: s2.layers.map(x => x.id === s2.sel ? { ...x, x: x.x + dx, y: x.y + dy, heroPreset: undefined } : x) })); };
      if (e.key === 'ArrowLeft') mv(-step, 0);
      else if (e.key === 'ArrowRight') mv(step, 0);
      else if (e.key === 'ArrowUp') mv(0, -step);
      else if (e.key === 'ArrowDown') mv(0, step);
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.set(s2 => ({ layers: s2.layers.filter(x => x.id !== s2.sel), sel: null })); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); dupLayer(); }
      else if (e.key === 'Escape') store.set({ sel: null });
    };
    window.addEventListener('keydown', kd);
    return () => { window.removeEventListener('keydown', kd); store.endEdit(); };
  }, []);

  const dupLayer = () => store.set(st => {
    const l = st.layers.find(x => x.id === st.sel); if (!l || l.locked) return null;
    const nl = { ...l, id: st.seq, locked: false, heroPreset: undefined }; // 原位置复制，不偏移
    return { layers: st.layers.concat([nl]), seq: st.seq + 1, sel: nl.id };
  });
  const addL = mk => store.set(st => {
    const nl = mk(st.seq, hero);
    const bound = nl.panelId == null && hero ? { ...nl, panelId: hero.panelId } : nl;
    return { layers: st.layers.concat([bound]), seq: st.seq + 1, sel: bound.id };
  });
  const moveL = d => store.set(st => {
    const i = st.layers.findIndex(l => l.id === st.sel); if (i < 0) return null;
    const j = i + d; if (j < 0 || j >= st.layers.length) return null;
    const ls = st.layers.slice(); const it = ls.splice(i, 1)[0]; ls.splice(j, 0, it);
    return { layers: ls };
  });
  const alignSel = ty => {
    if (!sel || sel.locked) return;
    const b = bboxOf(sel);
    const panel = containerOfLayer(g, sel);
    let pb = panel ? bboxOfPts(panel.pts) : null;
    if (!pb) pb = [g.sbb[0], g.sbb[1], g.sbb[2], g.sbb[3]];
    const m2 = 3;
    let tx = null, ty2 = null;
    if (ty === 'l') tx = pb[0] + m2; else if (ty === 'cx') tx = (pb[0] + pb[2]) / 2 - b[2] / 2; else if (ty === 'r') tx = pb[2] - m2 - b[2];
    if (ty === 't') ty2 = pb[1] + m2; else if (ty === 'cy') ty2 = (pb[1] + pb[3]) / 2 - b[3] / 2; else if (ty === 'b') ty2 = pb[3] - m2 - b[3];
    upd({ ...(tx != null ? { x: sel.x + (tx - b[0]) } : {}), ...(ty2 != null ? { y: sel.y + (ty2 - b[1]) } : {}) });
  };
  const numIn = fn => e => { const v = parseFloat(e.target.value); if (!isNaN(v)) fn(v); };
  const dropImages = async (files, point, panel) => {
    const imageFiles = imageFilesOf(files); if (!imageFiles.length || !panel) return;
    try {
      const assets = await Promise.all(imageFiles.map(readImageFile));
      store.set(st => {
        const added = assets.map((asset, i) => imageLayerAt(st.seq + i, asset, panel, [point[0] + i * 2, point[1] + i * 2]));
        return { layers: st.layers.concat(added), seq: st.seq + added.length, sel: added[added.length - 1].id };
      });
    } catch (_) { alert('图片读取失败，请使用 PNG、JPG 或 WebP 文件。'); }
  };

  const renderLayer = l => {
            const warn = warnsOf(l, creaseSegs, g.sbb).length > 0;
            return (
              <div key={l.id} data-layer-id={l.id} data-production-layer-id={l.id}
                title={layerNameOf(l)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden', padding: '7px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (s.sel === l.id ? "var(--ui-accent)" : "var(--ui-border-soft)"), background: s.sel === l.id ? "var(--ui-selected)" : '#fff' }}>
                <button type="button" className="layer-state-button" aria-label={(l.visible ? '隐藏' : '显示') + layerNameOf(l)} aria-pressed={!!l.visible} onClick={e => { e.stopPropagation(); store.set(st => ({ layers: st.layers.map(x => x.id === l.id ? { ...x, visible: !x.visible } : x) })); }} title="显示/隐藏">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!l.visible && <path d="m3 3 18 18"/>}</svg>
                </button>
                <button type="button" className="layer-state-button" aria-label={(l.locked ? '解锁' : '锁定') + layerNameOf(l)} aria-pressed={!!l.locked} onClick={e => { e.stopPropagation(); store.set(st => ({ layers: st.layers.map(x => x.id === l.id ? { ...x, locked: !x.locked } : x) })); }} title="锁定/解锁">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d={l.locked ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M8 10V7a4 4 0 0 1 8-1'}/></svg>
                </button>
                <button type="button" className="layer-select-button" aria-pressed={s.sel === l.id} onClick={() => store.set({ sel: l.id })}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontWeight: 700, color: "var(--ui-muted)", border: "1px solid var(--ui-border)", borderRadius: 3, padding: '1px 4px', flex: 'none' }}>{l.kind === 'text' ? 'T' : l.kind === 'image' ? '图' : '块'}</span>
                <span data-layer-name={layerNameOf(l)} style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ui-ink)", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{layerNameOf(l)}</span>
                <span style={{ fontSize: 10, color: "var(--ui-accent)", flex: 'none' }}>{l.finish === 'emboss' ? '压纹' + (embDirOf(l, s.embDir) === 'up' ? '↑' : '↓') : (FIN[l.finish] || '')}</span>
                </button>
                {warn && <span role="img" aria-label="此图层有设计警示" title="此图层有设计警示" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--ui-warning)', flex: 'none' }} />}
              </div>
            );
          };

  return (<>
    <div style={{ width: 246, flex: 'none', background: "var(--ui-panel)", borderRight: "1px solid var(--ui-border)", overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <Block>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
          <ST style={{ marginBottom: 0 }}>素材分组</ST>
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => store.undo()} disabled={!histPastN} title="上一步（⌘Z / Ctrl+Z）" style={{ ...btnSt, padding: '3px 8px', fontSize: 11, opacity: histPastN ? 1 : 0.4, cursor: histPastN ? 'pointer' : 'default' }}>↶ 上一步</button>
            <button onClick={() => store.redo()} disabled={!histFutureN} title="下一步（⌘⇧Z / Ctrl+Shift+Z）" style={{ ...btnSt, padding: '3px 8px', fontSize: 11, opacity: histFutureN ? 1 : 0.4, cursor: histFutureN ? 'pointer' : 'default' }}>↷ 下一步</button>
          </div>
        </div>
        <ActionMenu label="添加内容 ▾" className="add-layer-menu">
          <button onClick={() => addL((id, hp) => ({ id, kind: 'text', x: hp.cx, y: hp.cy, content: '双击右栏编辑文字', font: 'Noto Sans SC', size: 6, weight: 400, color: '#211d18', finish: 'none', visible: true }))} style={{ ...btnSt, flex: 1, fontSize: 11.5 }}>+ 文字</button>
          <button onClick={() => uploadImage(addL)} style={{ ...btnSt, flex: 1, fontSize: 11.5 }}>+ 图片</button>
          <button onClick={() => addL((id, hp) => { const w = Math.min(30, hp.safeBox[2] - hp.safeBox[0]), h = Math.min(8, hp.safeBox[3] - hp.safeBox[1]); return { id, kind: 'shape', x: hp.cx - w / 2, y: hp.cy - h / 2, w, h, content: '色块', color: '#9a5b1f', finish: 'none', visible: true }; })} style={{ ...btnSt, flex: 1, fontSize: 11.5 }}>+ 色块</button>
        </ActionMenu>
        <ProductionGroups layers={s.layers} fallback={s.embDir} renderLayer={renderLayer} />
      </Block>
      <details className="professional-section"><summary>图层与快捷键帮助</summary>
        <Note><b style={{ color: "var(--ui-ink)" }}>分层规则</b>　位图按实际尺寸检查横纵 PPI，必须均大于 300；矢量源素材单独识别。比例变形或精度不合格时显示警示。</Note>
        <p className="delivery-intro">方向键微移 1mm（Shift=5mm）；Ctrl/⌘Z 撤销，Ctrl/⌘D 复制，Delete 删除。拖拽默认等比，Shift 自由缩放；旋转时 Shift 吸附 15°。</p>
      </details>
    </div>

    <SheetCanvas view="design" g={g} onImageDrop={dropImages} />

    <div style={{ width: 258, flex: 'none', background: "var(--ui-panel)", borderLeft: "1px solid var(--ui-border)", overflowY: 'auto' }}>
      {!sel && <div style={{ padding: '20px 14px', fontSize: 12, color: "var(--ui-muted)", lineHeight: 1.7 }}>未选中图层。点击画布中的元素或左侧图层列表进行编辑。</div>}
      {sel && (<>
        {sel.locked&&<button onClick={()=>upd({locked:false})} style={{...btnSt,margin:12}}>已锁定 · 解锁编辑</button>}
        <fieldset disabled={!!sel.locked}
          onFocusCapture={e => { if (e.target.matches('input:not([type="checkbox"]),textarea')) store.beginEdit(); }}
          onBlurCapture={() => store.endEdit()}
          style={{border:0,padding:0,margin:0,minWidth:0,pointerEvents:sel.locked?'none':undefined}}>
        <Block>
          <ST>图层名称</ST>
          <input aria-label="图层名称" maxLength={32} value={typeof sel.name === 'string' ? sel.name : layerNameOf(sel)} onChange={e => upd({ name: e.target.value })} style={{ ...inputSt, fontFamily: 'inherit' }} />
        </Block>
        {sel.kind === 'text' && <Block><ST>文字内容</ST><input aria-label="文字内容" value={sel.content || ''} onChange={e => upd({ content: e.target.value })} style={{ ...inputSt, fontFamily: 'inherit' }} /></Block>}
        <Block>
          <ST>变换</ST>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 10 }}>
            <div><div style={{ fontSize: 10.5, color: "var(--ui-muted)", marginBottom: 3 }}>X mm</div><input aria-label="X 坐标 mm" type="number" step="0.5" value={Math.round(sel.x * 10) / 10} onChange={numIn(v => upd({ x: v }))} style={inputSt} /></div>
            <div><div style={{ fontSize: 10.5, color: "var(--ui-muted)", marginBottom: 3 }}>Y mm</div><input aria-label="Y 坐标 mm" type="number" step="0.5" value={Math.round(sel.y * 10) / 10} onChange={numIn(v => upd({ y: v }))} style={inputSt} /></div>
            <div><div style={{ fontSize: 10.5, color: "var(--ui-muted)", marginBottom: 3 }}>旋转 °</div><input aria-label="旋转角度" type="number" step="1" value={sel.rot || 0} onChange={numIn(v => upd({ rot: ((v % 360) + 360) % 360 }))} style={inputSt} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontSize: 10.5, color: "var(--ui-muted)" }}>不透明度</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--ui-accent)" }}>{Math.round((sel.opacity == null ? 1 : sel.opacity) * 100)}%</div>
          </div>
          <input aria-label="不透明度" type="range" min="0" max="100" value={Math.round((sel.opacity == null ? 1 : sel.opacity) * 100)} onChange={numIn(v => upd({ opacity: Math.min(1, Math.max(0, v / 100)) }))} style={{ width: '100%', accentColor: "var(--ui-accent)", margin: 0 }} />
        </Block>
        <details className="professional-section"><summary>对齐到当前盒面</summary>
        <Block>
          <ST>对齐 · 所在面板</ST>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5 }}>
            {[['l', '⊢', '左对齐'], ['cx', '↔', '水平居中'], ['r', '⊣', '右对齐'], ['t', '⊤', '顶对齐'], ['cy', '↕', '垂直居中'], ['b', '⊥', '底对齐']].map(x => (
              <button key={x[0]} onClick={() => alignSel(x[0])} aria-label={x[2]} title={x[2]} style={{ ...btnSt, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{x[1]}</button>
            ))}
          </div>
        </Block>
        </details>
        {sel.kind === 'text' && (
          <Block>
            <ST>排版</ST>
            <select aria-label="字体" value={sel.font} onChange={e => upd({ font: e.target.value, ...(e.target.value === 'Libre Baskerville' ? { weight: 700 } : e.target.value === 'ZCOOL XiaoWei' ? { weight: 400 } : {}) })} style={{ ...selectSt, marginBottom: 8 }}>
              <option value="Noto Sans SC">思源黑体 Noto Sans SC</option>
              <option value="ZCOOL XiaoWei">小薇明体 ZCOOL XiaoWei</option>
              <option value="Libre Baskerville">Libre Baskerville（已载入粗体）</option>
              <option value="Noto Serif SC">思源宋体 Noto Serif SC</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
            </select>
            <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: "var(--ui-muted)", marginBottom: 3 }}>字号 mm</div><input aria-label="字号 mm" type="number" step="0.5" value={sel.size} onChange={numIn(v => upd({ size: Math.min(60, Math.max(1.5, v)) }))} style={inputSt} /></div>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-end' }}><button aria-pressed={sel.weight === 700} onClick={() => upd({ weight: sel.weight === 700 ? 400 : 700 })} style={{ padding: '7px 12px', borderRadius: 5, border: "1px solid var(--ui-border)", cursor: 'pointer', fontSize: 12, fontWeight: 700, background: sel.weight === 700 ? "var(--ui-ink)" : '#fff', color: sel.weight === 700 ? '#fff' : "var(--ui-ink)", whiteSpace: 'nowrap' }}>B 加粗</button></div>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              {['#211d18', '#9a5b1f', '#C9A227', '#4a5d4e', '#fdfcf7'].map(c => (
                <button type="button" key={c} aria-label={'文字颜色 ' + c} aria-pressed={sel.color === c} onClick={() => upd({ color: c })} style={{ width: 24, height: 24, padding: 0, borderRadius: 5, background: c, cursor: 'pointer', border: '2px solid ' + (sel.color === c ? "var(--ui-accent)" : "var(--ui-border)"), boxSizing: 'border-box' }} />
              ))}
            </div>
          </Block>
        )}
        {sel.kind !== 'text' && (
          <Block>
            <ST>尺寸 · mm</ST>
            <div style={{ display: 'flex', gap: 7 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: "var(--ui-muted)", marginBottom: 3 }}>宽</div><input aria-label="图层宽度 mm" type="number" value={sel.w} onChange={numIn(v => upd(resizeImage(sel, 'w', v)))} style={inputSt} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: "var(--ui-muted)", marginBottom: 3 }}>高</div><input aria-label="图层高度 mm" type="number" value={sel.h} onChange={numIn(v => upd(resizeImage(sel, 'h', v)))} style={inputSt} /></div>
            </div>
            {sel.kind === 'image' && <div style={{ marginTop: 8, fontSize: 11 }}>
              <label><input type="checkbox" checked={sel.aspectLocked !== false} onChange={e => upd({ aspectLocked: e.target.checked })} />锁定图片比例</label>
              <button onClick={() => upd(restoreImageAspect(sel))} style={{ ...btnSt, marginTop: 6 }}>恢复原图比例</button>
            </div>}
            {sel.kind === 'image' && sel.imgSrc && (
              <div style={{ marginTop: 8, fontSize: 10.5, color: imageQualityOf(sel).pass ? "var(--ui-muted)" : '#c0492b', fontFamily: "'JetBrains Mono',monospace", display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span>{imageQualityLabel(sel)}</span>
                <button type="button" className="image-action" onClick={() => uploadImage(addL, sel.id)}>替换图片</button>
                <button type="button" className="image-action" aria-pressed={!!s.uiCrop} onClick={() => store.set(st => ({ uiCrop: !st.uiCrop }))}>{s.uiCrop ? '裁剪中' : '裁剪'}</button>
              </div>
            )}
          </Block>
        )}
        <Block>
          <ST>{s.reconstruction?'3D效果模拟通道':'工艺'}</ST>
           {sel.finish==='uv'&&<Note>透明UV：设计画布以半透明蓝色标示覆盖范围，不是白色印刷；实际局部亮光请在3D中旋转查看。</Note>}
          {sel.sourceCraft&&<Note>原始工艺文件：{sel.sourceCraft}。文件名为工艺来源；下方通道仅用于近似显示。</Note>}
          <select aria-label="图层工艺" value={sel.finish} onChange={e => {
            const finish = e.target.value;
            const effect = { foil: 'foil', silver: 'foil', uv: 'suv', gloss: 'gloss', emboss: 'emb', holo: 'holo' }[finish];
            store.set(st => ({
              layers: st.layers.map(l => l.id === st.sel ? { ...l, finish, plateId: undefined, plateName: undefined, factoryId: undefined, heroPreset: undefined } : l),
              ...(effect ? { fx: { ...st.fx, [effect]: true } } : {}),
              ...(finish === 'holo' && !st.iridescence3d ? { iridescence3d: .85 } : {})
            }));
          }} style={selectSt}>
            <option value="none">无（四色印刷）</option>
            <option value="foil">烫金 · R 通道</option>
            <option value="silver">烫银 · R 通道</option>
            <option value="uv">局部 UV · G 通道</option>
            <option value="gloss">亮面 · 反光通道</option>
            <option value="emboss">压纹 · B 通道</option>
            <option value="holo">镭射 · 幻彩通道</option>
            <option value="screen">丝印 · 工艺版</option>
            <option value="frost">磨砂 · 工艺版</option>
            <option value="coldfoil">冷烫 · 工艺版</option>
          </select>
          {['screen','frost','coldfoil'].includes(sel.finish)&&<Note>已接入版图覆盖范围和3D近似模拟；真实墨层、磨砂颗粒与冷烫箔样仍需打样。</Note>}
          {sel.finish === 'emboss' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => upd({ embDir: 'up' })} style={{ ...btnSt, flex: 1, background: embDirOf(sel, s.embDir) === 'up' ? "var(--ui-accent)" : '#fff', color: embDirOf(sel, s.embDir) === 'up' ? '#fff' : "var(--ui-secondary)" }}>击凸 ↑</button>
              <button onClick={() => upd({ embDir: 'down' })} style={{ ...btnSt, flex: 1, background: embDirOf(sel, s.embDir) === 'down' ? "var(--ui-accent)" : '#fff', color: embDirOf(sel, s.embDir) === 'down' ? '#fff' : "var(--ui-secondary)" }}>击凹 ↓</button>
            </div>
          )}
        </Block>
        <details className="professional-section"><summary>生产设置与套准{sel.registration ? ' · 已关联' : ''}{sel.sourceBboxMm ? ' · 有源稿定位' : ''}</summary>
          <Block><ST>生产分组与版</ST><ProductionPlateEditor layer={sel} layers={s.layers} fallback={s.embDir}/></Block>
          {(sel.finish || 'none') !== 'none' && <Block><ST>套准与联动</ST><RegistrationEditor layer={sel} layers={s.layers} show={s.showRegistration}/></Block>}
          {sel.sourceBboxMm&&<Block><SourceRegistrationEditor key={sel.id} layer={sel} panel={g.panels.find(p=>p.panelId===sel.panelId)}/></Block>}
        </details>
        <details className="professional-section"><summary>排列与对象操作</summary>
        <Block>
          <ST>排列</ST>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
            <button onClick={() => store.set(st => { const i = st.layers.findIndex(l => l.id === st.sel); if (i < 0) return null; const ls = st.layers.slice(); ls.push(ls.splice(i, 1)[0]); return { layers: ls }; })} style={{ ...btnSt, fontSize: 11.5 }}>置顶</button>
            <button onClick={() => moveL(1)} style={{ ...btnSt, fontSize: 11.5 }}>上移</button>
            <button onClick={() => moveL(-1)} style={{ ...btnSt, fontSize: 11.5 }}>下移</button>
            <button onClick={() => store.set(st => { const i = st.layers.findIndex(l => l.id === st.sel); if (i < 0) return null; const ls = st.layers.slice(); ls.unshift(ls.splice(i, 1)[0]); return { layers: ls }; })} style={{ ...btnSt, fontSize: 11.5 }}>置底</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <button onClick={dupLayer} style={{ ...btnSt, padding: '7px 0' }}>复制 ⌘D</button>
            <button onClick={() => upd({ locked: !sel.locked })} style={{ ...btnSt, padding: '7px 0', background: sel.locked ? "var(--ui-ink)" : '#fff', color: sel.locked ? '#fff' : "var(--ui-ink)" }}>{sel.locked ? '已锁定' : '锁定'}</button>
            <button onClick={() => store.set(st => ({ layers: st.layers.filter(x => x.id !== st.sel), sel: null }))} style={{ ...btnSt, padding: '7px 0', border: '1px solid #e0b7a8', color: '#c0492b' }}>删除 ⌫</button>
          </div>
        </Block>
        </details>
        {selWarns.length > 0 && (
          <div style={{ padding: 14 }}>
            <ST style={{ color: '#c0492b' }}>警示</ST>
            {selWarns.map(wn => (
              <div key={wn} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0', fontSize: 12, color: "var(--ui-ink)", lineHeight: 1.5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: '#d05a2a', flex: 'none', transform: 'translateY(-1px)' }} />{wn}
              </div>
            ))}
          </div>
        )}
        </fieldset>
      </>)}
    </div>
  </>);
}
