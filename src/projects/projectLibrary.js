import { makeProject } from './projects.js';

const conflict = () => new Error('此项目已在其他页面修改或移入回收站。请重新打开项目；当前修改仍保留，可先导出工程备份。');
let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('openbox3d-projects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(new Error('无法打开本地项目库，请检查浏览器存储权限。')); };
    request.onblocked = () => { database = null; reject(new Error('项目库正在被其他页面占用，请关闭旧页面后重试。')); };
  });
  return database;
}

export function projectContent(doc) {
  return JSON.stringify([doc.box, doc.design, doc.appearance, doc.scene, doc.meta.reconstruction || null, doc.meta.proposalApproval || null, doc.meta.workflow || null]);
}
export const stateContent = state => projectContent(makeProject(state));

export function assertRevision(previous, expected) {
  if (expected == null ? !!previous : !previous || previous.revision !== expected || !!previous.deletedAt) throw conflict();
}

export async function listProjects() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly'), request = tx.objectStore('projects').getAll();
    tx.oncomplete = () => resolve(request.result.sort((a, b) => b.project.meta.updatedAt.localeCompare(a.project.meta.updatedAt)));
    tx.onerror = () => reject(tx.error || new Error('读取项目库失败。'));
  });
}

// 同一事务内比较版本并写入，避免多标签页静默覆盖。
export async function saveProject(doc, expected = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite'), objects = tx.objectStore('projects');
    let result, error;
    const request = objects.get(doc.meta.id);
    request.onsuccess = () => {
      try {
        assertRevision(request.result, expected);
        result = { id: doc.meta.id, project: doc, revision: crypto.randomUUID(), deletedAt: null };
        objects.put(result);
      } catch (e) { error = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(error || tx.error || new Error('项目保存失败，未覆盖已保存的版本。请导出工程备份。'));
  });
}

export async function setProjectDeleted(record, deleted) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite'), objects = tx.objectStore('projects');
    let error;
    const request = objects.get(record.id);
    request.onsuccess = () => {
      const current = request.result;
      if (!current || current.revision !== record.revision) { error = conflict(); tx.abort(); return; }
      objects.put({ ...current, deletedAt: deleted ? new Date().toISOString() : null, revision: crypto.randomUUID() });
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(error || tx.error || new Error('项目状态更新失败。'));
  });
}
