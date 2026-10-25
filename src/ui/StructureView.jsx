// 结构视图：盒型库 / 内尺寸 / 材质 / 工艺参数 / 线型编辑 + 中央刀版画布 + 右栏规格与校验
import React from 'react';
import { store, useStore } from '../state/store.js';
import { TPLS, MATS } from '../dieline/templates.js';
import { geomOf } from '../dieline/geom.js';
import { closureOf } from '../dieline/closure.js';
import { reflowLayersToContainers } from '../design/containers.js';
import { SheetCanvas } from './SheetCanvas.jsx';
import { CheckDetails } from './CheckDetails.jsx';
import { workspaceChecks } from './workspaceChecks.js';
import { ST, Block, Toggle, ToggleRow, NumField, Note, KV, selectSt, btnSt } from './widgets.jsx';

const setNum = (key, min, max) => e => {
  const v = parseFloat(e.target.value);
  if (!isNaN(v)) store.set(st => {
    const next = { ...st, [key]: Math.min(max, Math.max(min, v)) }, mat = store.mat();
    return { [key]: next[key], layers: reflowLayersToContainers(st.layers, geomOf(st, mat.t), geomOf(next, mat.t)) };
  });
};

export function StructureView() {
  const s = useStore();
  const m = store.mat();
  const g = geomOf(s, m.t);
  const fmt = v => Math.round(v * 10) / 10;
  const t = m.t;
  const sw = g.sbb[2] - g.sbb[0], sh = g.sbb[3] - g.sbb[1];
  const closure = closureOf(s,t), tkNow = closure.tuck;
  const specTpl = {
    rte: [{ k: '板宽序列', v: fmt(s.W + t) + '·' + fmt(s.L + t) + '·' + fmt(s.W + t) + '·' + fmt(s.L + 2 * t) }, { k: '盖深 / 插舌', v: fmt(s.W + t) + ' / ' + fmt(tkNow) }],
    ste: [{ k: '板宽序列', v: fmt(s.W + t) + '·' + fmt(s.L + t) + '·' + fmt(s.W + t) + '·' + fmt(s.L + 2 * t) }, { k: '盖深 / 插舌', v: fmt(s.W + t) + ' / ' + fmt(tkNow) }],
    mailer: [{ k: '侧墙宽', v: fmt(s.H + t) }, { k: '插舌深', v: fmt(tkNow) }],
    lidbase: [{ k: '盖内放量', v: '+1.0 mm/边' }, { k: '盖高', v: fmt(Math.max(14, s.H * 0.45)) }],
    drawer: [{ k: '套筒放量', v: '+2~4 × t' }, { k: '筒深', v: fmt(s.L + 2) }],
    cyl: [{ k: '直径 D', v: fmt(s.L) + ' mm' }, { k: '分段', v: '24 × ' + fmt(Math.PI * s.L / 24) + ' mm' }],
    hex: [{ k: '边长', v: fmt(s.W) + ' mm' }, { k: '外接圆径', v: fmt(2 * s.W / (2 * Math.sin(Math.PI / 6))) + ' mm' }]
  };
  const specRows = [
    { k: '展开尺寸', v: fmt(sw) + ' × ' + fmt(sh) },
    { k: '含出血', v: fmt(sw + 2 * s.bleed) + ' × ' + fmt(sh + 2 * s.bleed) },
    { k: '纸厚 t', v: t + ' mm' }
  ].concat(specTpl[s.tpl] || []);
  const checks = workspaceChecks(s, m);
  const compNote = s.tpl === 'rte' || s.tpl === 'ste' ? '当前：W+t · L+t · W+t · L+2t，高度 H+t' : s.tpl === 'mailer' ? '当前：楞厚 t=' + t + '，侧墙 H+t，盖宽 W+3t' : s.tpl === 'cyl' ? '当前：直径 D=L，筒身 24 段卷合，盖为 24 边形' : s.tpl === 'hex' ? '当前：边长 W，六棱筒，盖为正六边形' : '当前：盖/套筒按 +1mm/边 放量';
  const editOn = s.editMode;
  const typeOvrCount = Object.keys(s.typeOvr).length;
  const selSegOk = editOn && s.selSeg != null && g.segs[s.selSeg];
  const curSegT = selSegOk ? g.segs[s.selSeg].t : '';

  return (<>
    <div style={{ width: 246, flex: 'none', background: "var(--ui-panel)", borderRight: "1px solid var(--ui-border)", overflowY: 'auto' }}>
      <details className="professional-section"><summary>盒型库</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {TPLS.map(b => (
            <button type="button" key={b.id} aria-pressed={s.tpl === b.id} onClick={() => store.set(st => { const mat = store.mat(), next = { ...st, tpl: b.id, ovr: {}, typeOvr: {} }; return { tpl: b.id, ovr: {}, typeOvr: {}, selSeg: null, fitNonce: st.fitNonce + 1, layers: reflowLayersToContainers(st.layers, geomOf(st, mat.t), geomOf(next, mat.t)) }; })}
              style={{ cursor: 'pointer', textAlign: 'left', color: 'var(--ui-ink)', border: '1px solid ' + (s.tpl === b.id ? "var(--ui-accent)" : "var(--ui-border)"), background: s.tpl === b.id ? "var(--ui-selected)" : '#fff', borderRadius: 6, padding: '7px 9px' }}>
              <span style={{ display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: s.tpl === b.id ? "var(--ui-accent)" : "var(--ui-muted)" }}>{b.code}</span>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginTop: 1 }}>{b.name}</span>
              <span style={{ display: 'block', fontSize: 10, color: "var(--ui-muted)" }}>{b.sub}</span>
            </button>
          ))}
        </div>
      </details>
      <Block>
        <ST>内尺寸 · mm</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
          <NumField label="长 L" value={s.L} onChange={setNum('L', 20, 1000)} />
          <NumField label="宽 W" value={s.W} onChange={setNum('W', 15, 1000)} />
          <NumField label="高 H" value={s.H} onChange={setNum('H', 15, 1000)} />
        </div>
      </Block>
      <Block>
        <ST>材质</ST>
        <select aria-label="结构材质" value={s.matId} onChange={e => { const nm = MATS.find(x => x.id === e.target.value); store.set(st => { const om = MATS.find(x => x.id === st.matId) || MATS[0], next = { ...st, matId: nm.id, bleed: nm.bleed }; return { matId: nm.id, bleed: nm.bleed, layers: reflowLayersToContainers(st.layers, geomOf(st, om.t), geomOf(next, nm.t)) }; }); }} style={selectSt}>
          {MATS.map(mm => <option key={mm.id} value={mm.id}>{mm.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: "var(--ui-muted)", marginTop: 7 }}>厚度 t = <b style={{ color: "var(--ui-accent)", fontFamily: "'JetBrains Mono',monospace" }}>{t} mm</b> · {m.note}</div>
      </Block>
      <details className="professional-section"><summary>高级结构与线型{s.editMode ? " · 编辑中" : ""}</summary>
      <Block>
        <ST>工艺参数</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <NumField label="出血 mm" value={s.bleed} onChange={setNum('bleed', 0, 10)} />
          <NumField label="糊口基准 mm" value={s.glue} onChange={setNum('glue', 5, 100)} />
        </div>
        <div style={{fontSize:11,color:'var(--ui-muted)',marginTop:8,lineHeight:1.6}}>
          {closure.tuck>0&&<>插舌 {fmt(closure.tuck)} mm · {s.tpl==='mailer'?'侧翼':'防尘翼'} {fmt(closure.dust)} mm<br /></>}
          {closure.glue>0&&<>实际糊口 {fmt(closure.glue)} mm（结合纸厚及粘接面计算）<br /></>}
          附件按各自空间计算；默认结构须白样确认。
        </div>
      </Block>
      <Block>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ST style={{ marginBottom: 0 }}>线型编辑</ST>
          <Toggle label="线型编辑" on={s.editMode} onClick={() => store.set(st => ({ editMode: !st.editMode, selSeg: null }))} />
        </div>
        {editOn && (<>
          <div style={{ fontSize: 11, color: "var(--ui-muted)", marginTop: 8, lineHeight: 1.6 }}>点击线段后可切换为切线或压痕。已修改线型 <b style={{ color: "var(--ui-accent)" }}>{typeOvrCount}</b> 处。</div>
          {selSegOk && (
            <div style={{ marginTop: 9, background: "var(--ui-subtle)", border: "1px solid var(--ui-border)", borderRadius: 6, padding: '9px 11px' }}>
              <div style={{ fontSize: 11, color: "var(--ui-secondary)", marginBottom: 7 }}>选中线段 · 当前：{curSegT === 'cut' ? '切线' : '压痕'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => store.set(st => ({ typeOvr: { ...st.typeOvr, [st.selSeg]: 'cut' } }))} style={{ ...btnSt, flex: 1, background: curSegT === 'cut' ? '#C8102E' : '#fff', color: curSegT === 'cut' ? '#fff' : "var(--ui-secondary)" }}>切线</button>
                <button onClick={() => store.set(st => ({ typeOvr: { ...st.typeOvr, [st.selSeg]: 'crease' } }))} style={{ ...btnSt, flex: 1, background: curSegT === 'crease' ? '#2E7D46' : '#fff', color: curSegT === 'crease' ? '#fff' : "var(--ui-secondary)" }}>压痕</button>
              </div>
            </div>
          )}
          <button onClick={() => store.set({ typeOvr: {}, selSeg: null })} style={{ ...btnSt, marginTop: 9, width: '100%', padding: '7px 0', color: "var(--ui-secondary)" }}>重置线型编辑</button>
        </>)}
      </Block>
      <div style={{ padding: 14 }}>
        <Note><b style={{ color: "var(--ui-ink)" }}>纸厚补偿</b>　制造尺寸 = 内尺寸 + n × t<br />{compNote}</Note>
      </div>
      </details>
    </div>

    <SheetCanvas view="structure" g={g} />

    <div style={{ width: 258, flex: 'none', background: "var(--ui-panel)", borderLeft: "1px solid var(--ui-border)", overflowY: 'auto' }}>
      <details className="professional-section"><summary>制造尺寸与刀模统计</summary>
      <Block><ST>制造尺寸（已补偿）</ST>{specRows.map(r => <KV key={r.k} k={r.k} v={r.v} />)}</Block>
      <Block>
        <ST>刀模统计</ST>
        <KV k="切线" v={fmt(g.cutLen / 1000) + ' m · ' + g.cutN + ' 段'} />
        <KV k="压痕" v={fmt(g.creaseLen / 1000) + ' m · ' + g.creaseN + ' 段'} />
      </Block>
      </details>
      <Block>
        <ST>显示</ST>
        {[['bleed', '出血带'], ['safe', '安全区'], ['dims', '尺寸标注'], ['labels', '面板名称']].map(x => (
          <ToggleRow key={x[0]} label={x[1]} on={s.show[x[0]]} onClick={() => store.set(st => ({ show: { ...st.show, [x[0]]: !st.show[x[0]] } }))} />
        ))}
      </Block>
      <div style={{ padding: 14 }}>
        <ST>检查</ST>
        <CheckDetails checks={checks} />
      </div>
    </div>
  </>);
}
