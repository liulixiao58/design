import React, { useState } from 'react';
import { store } from '../state/store.js';
import { placeBySourcePoints } from '../design/sourceRegistration.js';
import { bindRegistration } from '../design/registration.js';
import { btnSt, inputSt } from './widgets.jsx';

export function SourceRegistrationEditor({ layer, panel }) {
  const origin = [0, 1].map(i => Math.min(...panel.pts.map(p => p[i])));
  const [values, setValues] = useState(() => layer.sourceRegistration?.points.map(p => [...p.source, ...p.target.map((v, i) => v - origin[i])].map(String)) || Array.from({ length: 3 }, () => ['', '', '', '']));
  const [error, setError] = useState('');
  return <div style={{ display: 'grid', gap: 7, fontSize: 11 }}>
    <strong>按原稿定位点套准</strong>
    <div>填写同一定位点在源PDF和盒面的位置，均为毫米、左上角为原点。至少三组，不能用图案外框替代角线／刀线定位点。</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
      {['源X', '源Y', '盒面X', '盒面Y'].map(label => <span key={label}>{label}</span>)}
      {values.map((row, i) => row.map((v, j) => <input key={i + '-' + j} aria-label={'定位点' + (i + 1) + ' ' + ['源X', '源Y', '盒面X', '盒面Y'][j]} type="number" step="any" value={v} style={{ ...inputSt, width: '100%', minWidth: 0 }} onChange={e => setValues(values.map((r, k) => k === i ? r.map((x, n) => n === j ? e.target.value : x) : r))} />))}
    </div>
    <button style={btnSt} disabled={layer.locked} onClick={() => {
      try {
        if (values.some(row => row.some(v => !v.trim()))) throw new Error('请填写三组完整定位点；系统不会自动猜测。');
        const points = values.map(row => ({ source: row.slice(0, 2).map(Number), target: row.slice(2).map((v, i) => +v + origin[i]) }));
        const result = placeBySourcePoints(layer, points);
        store.set(st => {
          const target = st.layers.find(l => l.id === layer.registration?.targetId);
          if (target) result.registration = { ...bindRegistration(result, target), linked: layer.registration.linked };
          return { layers: st.layers.map(l => l.id === layer.id ? result : l) };
        }); setError('');
      } catch (e) { setError(e.message); }
    }}>按定位点套准（保留原尺寸）</button>
    {error && <div role="alert" style={{ color: '#c0492b' }}>{error}</div>}
    <div style={{ color: "var(--ui-muted)" }}>仅平移和旋转；三点坐标一致性检查为0.01mm，不代表工厂生产公差。定位关系随工程保存，并用于校验显示和导出坐标。</div>
  </div>;
}
