import React, { useEffect, useRef } from 'react';

// 原生 disclosure 保留 Tab 顺序，不声明需要完整方向键协议的 ARIA menu。
export function ActionMenu({ label, children, className = '' }) {
  const ref = useRef(null);
  const close = focus => {
    const menu = ref.current;
    if (!menu?.open) return;
    menu.open = false;
    if (focus) menu.querySelector('summary').focus();
  };
  useEffect(() => {
    const outside = e => { if (!ref.current?.contains(e.target)) close(false); };
    const resize = () => close(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, []);
  return <details ref={ref} className={'action-menu ' + className}
    onToggle={e => {
      if (e.target !== ref.current || !ref.current.open) return;
      const menu = ref.current, panel = menu.querySelector('.action-menu-panel'), anchor = menu.querySelector('summary').getBoundingClientRect();
      panel.style.maxHeight = Math.max(0, window.innerHeight - 16) + 'px';
      panel.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - panel.offsetWidth - 8)) + 'px';
      const top = anchor.bottom + 6 + panel.offsetHeight <= window.innerHeight - 8 ? anchor.bottom + 6 : anchor.top - panel.offsetHeight - 6;
      panel.style.top = Math.max(8, Math.min(top, window.innerHeight - panel.offsetHeight - 8)) + 'px';
    }}
    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) close(false); }}>
    <summary>{label}</summary>
    <div className="action-menu-panel" onClick={e => { if (e.target.closest('button:not(:disabled),a')) close(true); }}>{children}</div>
  </details>;
}
