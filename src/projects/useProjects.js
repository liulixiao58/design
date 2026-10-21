import { useEffect, useRef, useState } from 'react';
import { store, emptyProjectState } from '../state/store.js';
import { chooseProjectFile, makeProject, projectStateOf } from './projects.js';
import { listProjects, projectContent, saveProject, setProjectDeleted, stateContent } from './projectLibrary.js';
import { importHistoryProjects } from './historyImport.js';

export function useProjects(state) {
  const [records, setRecords] = useState([]), [active, setActive] = useState(null);
  const [baseline, setBaseline] = useState(() => stateContent(state));
  const [name, setName] = useState(state.projectMeta?.name || '未保存项目');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null), resolveDialog = useRef(null);
  const ask = (title, message, value) => new Promise(resolve => {
    resolveDialog.current = resolve; setDialog({ title, message, value });
  });
  const answer = value => { setDialog(null); resolveDialog.current?.(value); resolveDialog.current = null; };
  const pending = useRef(false);
  const dirty = stateContent(state) !== baseline;
  const refresh = async () => setRecords(await listProjects());
  useEffect(() => {
    refresh().catch(e => setError(e.message));
    const focus = () => refresh().catch(e => setError(e.message));
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const run = async action => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const canLeave = async () => !dirty || await ask('放弃未保存的修改？', '当前修改尚未保存。继续切换会放弃这些修改；可取消后先点击“保存项目”。');
  const adopt = (patch, record, title) => {
    store.reset(patch);
    history.replaceState(null, '', location.pathname);
    setActive(record); setName(title); setBaseline(stateContent(store.get()));
  };
  const save = () => run(async () => {
    const title = active?.project.meta.name || (await ask('保存项目', '请输入项目名称。', name === '未保存项目' ? '新包装项目' : name))?.trim();
    if (!title) return;
    const doc = makeProject(store.get(), active?.project.meta || { id: crypto.randomUUID(), name: title });
    const record = await saveProject(doc, active?.revision);
    history.replaceState(null, '', location.pathname);
    setActive(record); setName(record.project.meta.name); setBaseline(projectContent(doc));
    await refresh();
  });
  const open = record => run(async () => {
    if (!await canLeave()) return;
    // 列表可能已过时；打开时重新读取当前已保存版本。
    const current = (await listProjects()).find(r => r.id === record.id && !r.deletedAt);
    if (!current) throw new Error('该项目已移入回收站，请刷新项目列表。');
    const patch = await projectStateOf(current.project, 'design');
    adopt({ ...patch, fold: 100 }, current, current.project.meta.name);
  });
  const create = () => run(async () => {
    if (!await canLeave()) return;
    const title = (await ask('新建项目', '创建独立的空白包装项目。', '新包装项目'))?.trim();
    if (!title) return;
    const doc = makeProject(emptyProjectState(), { name: title });
    const record = await saveProject(doc);
    adopt(await projectStateOf(doc, 'structure'), record, doc.meta.name);
    await refresh();
  });
  const importFile = () => run(async () => {
    if (!await canLeave()) return;
    const doc = await chooseProjectFile();
    if (!doc) return;
    const patch = await projectStateOf(doc, 'design');
    const record = await saveProject(doc);
    adopt({ ...patch, fold: 100 }, record, doc.meta.name);
    await refresh();
  });
  const rename = record => run(async () => {
    const title = (await ask('重命名项目', '名称仅用于识别项目，不改变设计内容。', record.project.meta.name))?.trim();
    if (!title || title === record.project.meta.name) return;
    const doc = { ...record.project, meta: { ...record.project.meta, name: title.slice(0, 60), updatedAt: new Date().toISOString() } };
    const saved = await saveProject(doc, record.revision);
    if (active?.id === record.id) { setActive(saved); setName(doc.meta.name); }
    await refresh();
  });
  const remove = record => run(async () => {
    if (active?.id === record.id && !await canLeave()) return;
    if (!await ask('删除项目？', '将“' + record.project.meta.name + '”移入回收站，可在项目页恢复。')) return;
    await setProjectDeleted(record, true);
    if (active?.id === record.id) {
      store.reset({ view: 'projects' });
      setActive(null); setName('未保存项目'); setBaseline(stateContent(store.get()));
    }
    await refresh();
  });
  const restore = record => run(async () => { await setProjectDeleted(record, false); await refresh(); });
  const importHistory = () => run(async () => {
    setNotice('正在收录历史方案并检查素材，请稍候…');
    try {
      const result = await importHistoryProjects();
      setRecords(result.records);
      if (active) setActive(result.records.find(r => r.id === active.id) || active);
      setNotice('历史方案收录完成：新增 ' + result.added + ' 个项目，关联更新 ' + result.linked + ' 份，已收录或回收站中的 ' + result.skipped + ' 份已跳过。');
    } catch (e) {
      await refresh(); setNotice('本次收录未全部完成；已完成的项目保留，可点击重试。'); throw e;
    }
  });
  const replace = load => run(async () => {
    if (!await canLeave()) return;
    if (!await ask('载入示例盒？', '已保存项目不受影响；示例盒将作为未保存的新项目。')) return;
    adopt(await load(), null, '示例盒（未保存）');
  });
  return { records, active, name, dirty, busy, error, notice, dialog, answer, save, open, create, importFile, importHistory, rename, remove, restore, replace, refresh: () => run(refresh) };
}
