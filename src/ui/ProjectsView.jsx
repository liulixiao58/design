import React, { useState } from 'react';
import { TPLS } from '../dieline/templates.js';
import { asset } from '../asset.js';
import { ActionMenu } from './ActionMenu.jsx';
import './projects.css';

export function ProjectDialog({ dialog, onAnswer }) {
  const [value, setValue] = useState(dialog.value || '');
  const naming = dialog.value !== undefined;
  return <div className="project-dialog-backdrop" onKeyDown={e => {
    if (e.key === 'Escape') onAnswer(null);
    if (e.key === 'Tab') {
      const controls = [...e.currentTarget.querySelectorAll('input,button:not(:disabled)')], first = controls[0], last = controls.at(-1);
      if (e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
    }
  }}>
    <form className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" onSubmit={e => { e.preventDefault(); onAnswer(naming ? value.trim() : true); }}>
      <h2 id="project-dialog-title">{dialog.title}</h2><p>{dialog.message}</p>
      {naming && <label>项目名称<input autoFocus aria-label="项目名称" maxLength={60} value={value} onChange={e => setValue(e.target.value)} /></label>}
      <div><button type="button" autoFocus={!naming} onClick={() => onAnswer(null)}>取消</button><button type="submit" disabled={naming && !value.trim()}>确定</button></div>
    </form>
  </div>;
}

export function ProjectsView({ library, deliveryBusy = false }) {
  const [trash, setTrash] = useState(false);
  const records = library.records.filter(r => !!r.deletedAt === trash);
  const busy = library.busy || deliveryBusy;
  return <section className="projects-view" aria-label="项目管理">
    <div className="projects-heading">
      <div><div className="projects-eyebrow">PACKAGING WORKSPACE</div><h1>我的项目</h1><p>每一份设计，独立保存，随时继续。</p></div>
      <div className="projects-actions">
        <button className="primary" disabled={busy} onClick={library.create}>新建项目</button>
        <ActionMenu label="项目操作 ▾">
          <button disabled={busy} onClick={library.importFile}>导入工程为新项目</button>
          <button disabled={busy} onClick={library.refresh}>刷新列表</button>
          <details className="menu-about"><summary>迁移与维护</summary><button disabled={busy} onClick={library.importHistory}>收录历史方案</button></details>
        </ActionMenu>
      </div>
    </div>
    {library.notice && <p role="status">{library.notice}</p>}
    <div className="projects-toolbar">
      <div><button aria-pressed={!trash} onClick={() => setTrash(false)}>全部项目 · {library.records.filter(r => !r.deletedAt).length}</button><button aria-pressed={trash} onClick={() => setTrash(true)}>回收站 · {library.records.filter(r => r.deletedAt).length}</button></div>
    </div>
    {!records.length ? <div className="projects-empty"><div aria-hidden="true">▱</div><h2>{trash ? '回收站为空' : '从一个包装项目开始'}</h2><p>{trash ? '移入回收站的项目可以在这里恢复。' : '新建项目，或导入已有 .boxproj；当前工作也可通过上方“保存项目”加入项目库。'}</p></div> :
      <div className="projects-grid">{records.map(record => {
        const doc = record.project, current = record.id === library.active?.id;
        const tpl = TPLS.find(t => t.id === doc.box.tpl)?.name || doc.box.tpl;
        const documents = (doc.meta.documents || []).filter(d => /^\/(drafts|docs)\//.test(d.href));
        const customerDocuments = documents.filter(d => /客户.*方案/.test(d.title + d.href));
        const otherDocuments = documents.filter(d => !customerDocuments.includes(d));
        return <article className={'project-card' + (current ? ' current' : '')} key={record.id} aria-label={'项目：' + doc.meta.name}>
          <button className="project-cover" disabled={busy || trash} aria-label={'打开项目：' + doc.meta.name} onClick={() => library.open(record)}>
            {doc.meta.thumbnail ? <img src={doc.meta.thumbnail} alt={doc.meta.name + ' 包装预览'} /> : <div className="project-placeholder"><span aria-hidden="true">▱</span><strong>{tpl}</strong><small>{doc.box.L} × {doc.box.W} × {doc.box.H} mm · 内尺寸</small></div>}
            {current && <span className="project-badge">当前项目</span>}
          </button>
          <div className="project-info"><h2>{doc.meta.name}</h2><p>{tpl} · {doc.design.layers.length} 个图层</p><small>{trash ? '移入回收站 ' + new Date(record.deletedAt).toLocaleString('zh-CN') : '修改于 ' + new Date(doc.meta.updatedAt).toLocaleString('zh-CN')}</small></div>
          {!!otherDocuments.length && <details className="project-documents"><summary>设计方案与资料 · {otherDocuments.length}</summary>{otherDocuments.map(d => <a key={d.href} href={asset(d.href)} target="_blank" rel="noopener noreferrer">{d.title}</a>)}</details>}
          <div className="project-buttons">{trash ? <button disabled={busy} onClick={() => library.restore(record)}>恢复项目</button> : <>
            <button className="primary" disabled={busy} onClick={() => library.open(record)}>打开项目</button>
            <ActionMenu label="项目更多操作">
              {customerDocuments.length ? customerDocuments.map(d => <a key={d.href} href={asset(d.href)} target="_blank" rel="noopener noreferrer">给客户的方案{customerDocuments.length > 1 ? ' · ' + d.title : ''}</a>) : <button disabled>给客户的方案（尚未生成）</button>}
              <button disabled={busy} onClick={() => library.rename(record)}>重命名</button>
              <button className="danger" disabled={busy} onClick={() => library.remove(record)}>移入回收站</button>
            </ActionMenu>
          </>}</div>
        </article>;
      })}</div>}
    <p className="projects-storage">项目保存在当前浏览器的本地项目库。清除网站数据、切换浏览器或访问地址不会迁移项目；请定期从顶部项目菜单“下载工程备份”。</p>
  </section>;
}
