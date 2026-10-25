import React, { useState } from 'react';
import { store, useStore } from '../state/store.js';
import { acceptanceChecks, acceptanceFingerprint } from '../design/acceptance.js';

export function AcceptancePanel() {
  const state = useStore(), acceptance = state.workflow?.acceptance || {};
  const [notes, setNotes] = useState({});
  const update = patch => store.set(s => ({ workflow: { ...s.workflow, acceptance: { ...s.workflow?.acceptance, ...patch } } }));
  return <section aria-label="生产放行核验">
    <h3>生产放行核验</h3><p>只记录实际完成的核验及凭据。工程变更后记录失效；概念选款不等于生产验收。未放行仍可下载 .boxproj 供评审。</p>
    <label>锁定原稿 / 版本 / 指纹<input aria-label="核验原稿基准" value={acceptance.reference || ''} onChange={e => update({ reference: e.target.value })} style={{ width: '100%' }} /></label>
    {acceptanceChecks(state).map(item => <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--ui-border-soft)' }}>
      <strong style={{ color: item.pass ? 'var(--ui-success)' : 'var(--ui-warning)' }}>{item.pass ? '● 已核验' : '● 待核验'} · {item.label}</strong>
      <p>{item.status}{item.note ? ' · 上次记录：' + item.note : ''}</p>
      <textarea aria-label={item.label + '核验凭据'} placeholder="核验人、对照版本、样张或试开记录；不能只填“通过”" value={notes[item.id] || ''} onChange={e => setNotes({ ...notes, [item.id]: e.target.value })} style={{ width: '100%' }} />
      <button disabled={!acceptance.reference?.trim() || (notes[item.id] || '').trim().length < 8} onClick={() => {
        const current = store.get();
        update({ [item.id]: { fingerprint: acceptanceFingerprint(current), note: notes[item.id].trim(), at: new Date().toISOString() } });
      }}>记录本版已实际核验</button>
      {acceptance[item.id] && <button onClick={() => update({ [item.id]: null })}>撤销此项记录</button>}
    </div>)}
  </section>;
}
