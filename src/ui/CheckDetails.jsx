import React from 'react';

export function CheckDetails({ checks }) {
  return <div className="check-details">
    <section><h3>设计警示 · {checks.design.length}</h3>
      {checks.design.length ? <ul>{checks.design.map(message => <li key={message}>{message}</li>)}</ul> : <p>当前自动检查未发现设计警示。</p>}
    </section>
    <section className={checks.production.length ? 'check-blockers' : ''}><h3>生产阻断 · {checks.production.length}</h3>
      {checks.production.length ? <ul>{checks.production.map(message => <li key={message}>{message}</li>)}</ul> : <p>当前自动检查未发现生产阻断。</p>}
    </section>
    <section><h3>待人工确认 · {checks.pending.length}</h3>
      <p>以下项目未自动检测，交付前须由印厂 / RIP 预检。</p>
      <ul>{checks.pending.map(message => <li key={message}>{message}：未检测</li>)}</ul>
    </section>
  </div>;
}
