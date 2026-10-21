// 工作台外壳：项目入口、四工作区与状态栏。
import React, { useRef, useState } from 'react';
import { store, useStore } from './state/store.js';
import { geomOf } from './dieline/geom.js';
import { TPLS } from './dieline/templates.js';
import { workspaceChecks } from './ui/workspaceChecks.js';
import { CheckDetails } from './ui/CheckDetails.jsx';
import { ActionMenu } from './ui/ActionMenu.jsx';
import { createDeliveryTask } from './ui/deliveryTask.js';
import { StructureView } from './ui/StructureView.jsx';
import { DesignView } from './ui/DesignView.jsx';
import { ThreeView } from './ui/ThreeView.jsx';
import { OutputView } from './ui/OutputView.jsx';
import { ProjectsView, ProjectDialog } from './ui/ProjectsView.jsx';
import { useProjects } from './projects/useProjects.js';
import { exportPDF } from './export/pdf.js';
import { loadPresetBox } from './preset/presetBox.js';
import { downloadProject } from './projects/projects.js';
import { WorkflowView } from './ui/WorkflowView.jsx';

const REPO_URL = 'https://github.com/yuyou-dev/OpenBox3D';

// GitHub 八角猫标（顶栏源码入口）
function GithubMark({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <path fill={color} d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function App() {
  const s = useStore();
  const library = useProjects(s);
  const [delivery, setDelivery] = useState({ busy: false, error: '', receipt: '' });
  const task = useRef(null);
  if (!task.current) task.current = createDeliveryTask(exportPDF);
  const m = store.mat();
  const g = geomOf(s, m.t);
  const fmt = v => Math.round(v * 10) / 10;
  const sw = g.sbb[2] - g.sbb[0], sh = g.sbb[3] - g.sbb[1];
  const tplName = (TPLS.find(x => x.id === s.tpl) || TPLS[0]).name;
  const checks = workspaceChecks(s, m);
  const warnN = checks.design.length + checks.production.length;
  const tabs = [['projects', '项目'], ['workflow', '流程'], ['structure', '结构'], ['design', '设计'], ['three', '3D'], ['output', '交付']];
  const viewName = tabs.find(tb => tb[0] === s.view)?.[1] || '项目';
  const exportProject = () => {
    const stamp = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    downloadProject(store.get(), library.active?.project.meta || { name: s.projectMeta?.name || tplName + ' ' + s.L + '×' + s.W + '×' + s.H + ' ' + stamp });
  };
  const resetPreset = async () => {
    await library.replace(loadPresetBox);
  };
  const actionsBusy = library.busy || delivery.busy;
  const runExport = async mode => {
    if (library.busy || task.current.busy) return;
    const name = library.name;
    setDelivery({ busy: true, error: '', receipt: '' });
    try {
      const result = await task.current.run(mode, store.get(), store.mat());
      setDelivery({ busy: false, error: '', receipt: `已导出「${name}」${mode === 'rgb' ? '评审 PDF（仅预览）' : `生产文件包，复核 ${result.checks.length} 份分层 PDF 母版`}` });
    } catch (e) { setDelivery({ busy: false, error: e.message || String(e), receipt: '' }); }
  };

  return (
    <div className="suwa-workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <span className="workspace-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="m12 3 9 5v8l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v8" /></svg></span>
          <div><strong>苏哇工作台</strong><small>OpenBox3D</small></div>
        </div>
        <div className="sidebar-project" title={library.name}><span className="sidebar-project-dot" /><span>{library.name}</span></div>
        <nav className="workspace-nav" aria-label="工作区导航">
          {tabs.map(tb => (
            <button key={tb[0]} onClick={() => store.set({ view: tb[0] })} aria-label={tb[1]} aria-current={s.view === tb[0] ? 'page' : undefined} title={tb[1]}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {tb[0] === 'projects' && <path d="M3 7h7l2-3h9v16H3Z M3 7V4h6" />}
                {tb[0] === 'structure' && <path d="M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z M8 8h8v8H8Z" />}
                {tb[0] === 'design' && <path d="m4 16-1 5 5-1L21 7l-4-4Z M14 6l4 4 M4 16l4 4" />}
                {tb[0] === 'three' && <path d="m12 3 9 5v8l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v8" />}
                {tb[0] === 'output' && <path d="M12 3v12 m-4-4 4 4 4-4 M4 15v6h16v-6" />}
              </svg>
              <span>{tb[1]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>包装设计工作空间</span>
        </div>
      </aside>

      <div className="workspace-main">
      <header className="workspace-topbar">
        <div className="workspace-breadcrumb">
          <ActionMenu label={<span className="project-menu-name" title={library.name}>{library.name} ▾</span>} className="project-menu">
            <button disabled={actionsBusy} onClick={library.importFile}>导入工程为新项目</button>
            <button disabled={actionsBusy} onClick={exportProject}>下载工程备份（.boxproj）</button>
            <button disabled={actionsBusy} onClick={() => store.set({ view: 'projects' })}>管理项目与回收站</button>
            <p className="menu-note">项目保存在当前浏览器；工程备份下载到本机。</p>
          </ActionMenu>
          <span aria-hidden="true">/</span><strong>{viewName}</strong>
        </div>
        <div className="workspace-actions">
          <ActionMenu label={`检查 · ${warnN}`} className="workspace-check-menu">
            <CheckDetails checks={checks} />
            <button onClick={() => store.set({ view: 'output' })}>查看交付检查</button>
          </ActionMenu>
          <button disabled={actionsBusy} onClick={library.save} className="workspace-save">{library.busy ? '处理中…' : '保存'}</button>
          <ActionMenu label={delivery.busy ? '生成中…' : '交付 ▾'} className="delivery-menu">
            <button disabled={actionsBusy} onClick={() => runExport('rgb')}>评审 PDF（仅预览）</button>
            <button disabled={actionsBusy || checks.production.length > 0} onClick={() => runExport('cmyk')}>生产文件包（三份分层母版）</button>
            {checks.production.length > 0 && <p className="menu-blocker">有 {checks.production.length} 项生产阻断，请查看检查。</p>}
            <button onClick={() => store.set({ view: 'output' })}>交付详情与文件说明</button>
          </ActionMenu>
          <ActionMenu label="更多操作" className="workspace-more-menu">
            <button disabled={actionsBusy} onClick={resetPreset}>载入示例盒（保留已保存项目）</button>
            <details className="menu-about"><summary>关于苏哇工作台</summary><p>基于 OpenBox3D · MIT</p><a href={REPO_URL} target="_blank" rel="noopener noreferrer"><GithubMark /> GitHub 开源仓库</a></details>
          </ActionMenu>
        </div>
      </header>

      <div role="status" className="workspace-project-status">
        {library.dirty ? '有未保存修改' : library.active ? '已保存到本地项目库' : '尚未加入项目库，请保存当前工作'}
        {checks.production.length > 0 && <span className="menu-blocker"> · {checks.production.length} 项生产阻断</span>}
        {checks.design.length > 0 && <span> · {checks.design.length} 项设计警示</span>}
        <span> · {checks.pending.length} 项需人工确认</span>
      </div>
      {delivery.busy && <div role="status" className="workspace-notice">正在生成交付文件，请稍候…</div>}
      {delivery.error && <div role="alert" className="workspace-notice is-error">{delivery.error}</div>}
      {delivery.receipt && <div role="status" className="workspace-notice">上次交付：{delivery.receipt}</div>}
      {library.error && <div role="alert" style={{ padding: '10px 14px', background: "var(--ui-error-bg)", color: "var(--ui-error)" }}>{library.error}</div>}
      {s.proposalApproval && <div style={{ padding: '8px 14px', background: "var(--ui-success-bg)", color: "var(--ui-success)", fontSize: 12 }}>已载入确认提案：{s.proposalApproval.title} · {s.proposalApproval.revision} · {s.layers.length} 个独立图层。通过“保存项目”加入项目库，也可“导出工程”备份。</div>}
      {s.reconstruction&&<div role="status" style={{padding:'8px 14px',background:"var(--ui-warning-bg)",color:"var(--ui-warning)",fontSize:12}}>{s.reconstruction.notice}</div>}
      <main className={'workspace-content view-' + s.view}>
        {s.view === 'projects' && <ProjectsView library={library} deliveryBusy={delivery.busy} />}
        {s.view === 'workflow' && <WorkflowView state={s} checks={checks} onChange={workflow => store.set({ workflow })} onNavigate={view => store.set({ view })} />}
        {s.view === 'structure' && <StructureView />}
        {s.view === 'design' && <DesignView />}
        {s.view === 'three' && <ThreeView />}
        {s.view === 'output' && <OutputView checks={checks} exporting={actionsBusy} onExport={runExport} />}
      </main>
      {library.dialog && <ProjectDialog key={library.dialog.title} dialog={library.dialog} onAnswer={library.answer} />}

      <footer className="workspace-statusbar">
        <span>{tplName} · {m.name} t={m.t}</span>
        <span>展开 {fmt(sw)}×{fmt(sh)} mm</span>
        <span>出血 {s.bleed} mm</span>
        <div style={{ flex: 1 }} />
        <span>缩放 {Math.round((s.k || 1) * 100)}%</span>
        <span>单位 mm</span>
      </footer>
      </div>
    </div>
  );
}
