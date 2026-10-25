import React from 'react';

export function CheckDetails({ checks }) {
  return <div className="check-details">
    <section><h3>设计警示 · {checks.design.length}</h3>
      {checks.design.length ? <ul>{checks.design.map(message => <li key={message}>{message}</li>)}</ul> : <p>当前自动检查未发现设计警示。</p>}
    </section>
    <section className={checks.production.length ? 'check-blockers' : ''}><h3>生产阻断 · {checks.production.length}</h3>
      {checks.production.length ? <ul>{checks.production.map(message => <li key={message}>{message}</li>)}</ul> : <p>当前自动检查未发现生产阻断。</p>}
    </section>
    <section><h3>待人工确认 / {checks.pending.length ? '禁止生产放行' : '核验记录已齐'} · {checks.pending.length}</h3>
      <p>自动检查无阻断不代表可生产。黄色表示尚未核验，不是合格。</p>
      <ul>{checks.pending.map(message => <li key={message}>{message}</li>)}</ul>
    </section>
    <details><summary>逐项素材审查 · {checks.assets?.length || 0}</summary>
      {(checks.assets || []).map(item => <div key={item.id} style={{ margin: '10px 0', color: item.issues.length ? 'var(--ui-error)' : 'var(--ui-secondary)' }}><strong>{item.issues.length ? '● 红：技术不合格' : '● 绿：自动技术项通过'} · {item.name}</strong><div>{item.quality}</div>{item.issues.map(message => <div key={message}>{message}</div>)}<small>技术通过不代表与原稿一致；视觉及工艺确认见交付核验。</small></div>)}
    </details>
  </div>;
}
