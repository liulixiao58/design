import catalog from './historyCatalog.json' with { type: 'json' };
import { projectStateOf } from './projects.js';
import { listProjects, saveProject } from './projectLibrary.js';

export function historyContent(doc) {
  const { id, name, ...scene } = doc.scene || {};
  return JSON.stringify([doc.box, doc.design, doc.appearance, scene]);
}
export function mergeDocuments(previous = [], incoming = []) {
  return [...new Map([...previous, ...incoming].map(d => [d.href, d])).values()];
}

export async function importHistoryProjects() {
  const loaders = import.meta.glob(['../../drafts/**/*.boxproj', '!../../drafts/**/编辑独立性验证/**', '!../../drafts/**/导出验证/**'], { query: '?raw', import: 'default' });
  const records = await listProjects();
  let added = 0, linked = 0, skipped = 0;
  for (const item of catalog) {
    const load = loaders['../../' + item.source];
    if (!load) throw new Error('历史工程不存在：' + item.source);
    const doc = JSON.parse(await load()), content = historyContent(doc);
    const index = records.findIndex(r => r.project.meta.historySources?.includes(item.source) || historyContent(r.project) === content);
    const previous = records[index];
    if (previous?.deletedAt) { skipped++; continue; }
    const documents = mergeDocuments(previous?.project.meta.documents, item.documents);
    const sources = [...new Set([...(previous?.project.meta.historySources || []), item.source])];
    if (previous && JSON.stringify(previous.project.meta.documents) === JSON.stringify(documents) && JSON.stringify(previous.project.meta.historySources) === JSON.stringify(sources)) { skipped++; continue; }
    const project = previous ? { ...previous.project, meta: { ...previous.project.meta, documents, historySources: sources } } :
      { ...doc, meta: { ...doc.meta, id: 'history/' + item.source, documents, historySources: sources } };
    // 新收录文件先实际载入素材；失败不写入空白项目，不覆盖已编辑内容。
    if (!previous) await projectStateOf(project);
    const saved = await saveProject(project, previous?.revision);
    if (previous) { records[index] = saved; linked++; } else { records.push(saved); added++; }
  }
  return { records, added, linked, skipped, sources: catalog.length };
}
