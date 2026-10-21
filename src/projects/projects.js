// Box3D 工程文件（.boxproj）：盒型/设计/正式材质/正式场景；纯本地文件导入导出，无服务端
import { storeToRig, rigToStorePatch } from '../render3d/rig.js';
import { normalizeMaterial, materialToStorePatch } from '../render3d/materialPresets.js';
import { asset } from '../asset.js';
import { validateProduction } from '../design/production.js';
import { normalizeWorkflow } from '../workflow.js';

export const PROJECT_SCHEMA = 'box3d-project';
export const PROJECT_VERSION = 1;

const BOX_FIELDS = ['tpl', 'L', 'W', 'H', 'matId', 'bleed', 'glue', 'ovr', 'typeOvr'];
const copyFields = (src, fields) => Object.fromEntries(fields.map(k => [k, structuredClone(src[k])]));
const cleanLayer = layer => {
  const out = { ...layer };
  delete out.img;
  return out;
};
const newId = () => crypto.randomUUID ? crypto.randomUUID() : 'project-' + Date.now().toString(36);
const now = () => new Date().toISOString();

export function makeProject(state, meta = {}) {
  const time = now();
  return {
    schema: PROJECT_SCHEMA,
    version: PROJECT_VERSION,
    meta: {
      id: meta.id || newId(),
      name: String(meta.name || '未命名包装工程').trim().slice(0, 60) || '未命名包装工程',
      createdAt: meta.createdAt || time,
      updatedAt: time,
      ...(state.reconstruction ? { reconstruction: structuredClone(state.reconstruction) } : {}),
      ...(state.proposalApproval ? { proposalApproval: structuredClone(state.proposalApproval) } : {}),
      thumbnail: typeof state.projectThumbnail === 'string' && state.projectThumbnail.startsWith('data:image/')
        ? state.projectThumbnail
        : (typeof meta.thumbnail === 'string' ? meta.thumbnail : ''),
      ...(Array.isArray(meta.documents) ? { documents: structuredClone(meta.documents) } : {}),
      ...(Array.isArray(meta.historySources) ? { historySources: [...meta.historySources] } : {}),
      workflow: normalizeWorkflow(state.workflow)
    },
    box: copyFields(state, BOX_FIELDS),
    design: { layers: state.layers.map(cleanLayer), seq: state.seq },
    appearance: {
      material: normalizeMaterial(state),
      fx: structuredClone(state.fx),
      embDir: state.embDir
    },
    scene: storeToRig(state)
  };
}

function assertProject(doc) {
  if (!doc || doc.schema !== PROJECT_SCHEMA || doc.version !== PROJECT_VERSION || !doc.meta || !doc.box || !doc.design || !Array.isArray(doc.design.layers)) {
    throw new Error('不是有效的 Box3D 工程文件。');
  }
  validateProduction(doc.design.layers);
  const ids = new Set();
  for (const layer of doc.design.layers) {
    if (!Number.isSafeInteger(layer.id) || layer.id < 1 || ids.has(layer.id)) throw new Error('图层编号无效或重复，无法安全导入工程。');
    ids.add(layer.id);
  }
  return doc;
}

const imageOf = src => new Promise(resolve => {
  if (!src) return resolve(null);
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src[0] === '/' ? asset(src) : src; // 站点绝对路径过 base 前缀（GitHub Pages 子路径）；data:/http(s): 原样
});

export async function projectStateOf(raw, view = 'design') {
  const doc = assertProject(raw);
  // 先载入工程实际使用的字体，避免第一次3D烘焙缓存回退字形。
  if (typeof document !== 'undefined' && document.fonts) {
    const specs = new Set(doc.design.layers.filter(l => l.kind === 'text').map(l => (l.weight || 400) + ' 16px ' + JSON.stringify(l.font || 'Noto Sans SC')));
    await Promise.all([...specs].map(spec => document.fonts.load(spec)));
  }
  const approval = doc.meta.proposalApproval;
  const layers = await Promise.all(doc.design.layers.map(async layer => {
    const clean = { ...layer };
    const img = await imageOf(clean.imgSrc);
    if (clean.imgSrc && !img) throw new Error('图片无法加载：' + (clean.name || clean.id) + '。工程未导入，请检查源图片。');
    return img ? { ...clean, img } : clean;
  }));
  return {
    ...copyFields(doc.box, BOX_FIELDS),
    projectMeta: structuredClone(doc.meta),
    layers,
    reconstruction:doc.meta.reconstruction?structuredClone(doc.meta.reconstruction):null,
    detailPanel3d:doc.meta.reconstruction?.scope==='lid-only'?'lid-top':'',
    proposalApproval: approval && typeof approval.title === 'string' && typeof approval.revision === 'string' ? structuredClone(approval) : null,
    workflow: normalizeWorkflow(doc.meta.workflow),
    seq: Math.max(Number.isSafeInteger(doc.design.seq) ? doc.design.seq : 1, ...layers.map(l => l.id + 1)),
    ...materialToStorePatch(doc.appearance && doc.appearance.material),
    fx: Object.fromEntries(['foil','suv','emb','gloss','holo'].map(key => [key, typeof doc.appearance?.fx?.[key] === 'boolean' ? doc.appearance.fx[key] : true])),
    embDir: doc.appearance && doc.appearance.embDir || 'up',
    ...rigToStorePatch(doc.scene),
    view,
    sel: null,
    selSeg: null,
    editMode: false,
    uiCrop: false,
    foldFromQuery: !!doc.meta.reconstruction,
    projectThumbnail: typeof doc.meta.thumbnail === 'string' ? doc.meta.thumbnail : '',
    fitNonce: Date.now()
  };
}

export function downloadProject(state, meta) {
  const project = makeProject(state, meta);
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  a.href = url;
  a.download = project.meta.name.replace(/[\\/:*?"<>|]+/g, '-') + '.boxproj';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function chooseProjectFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.boxproj,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      try {
        const doc = assertProject(JSON.parse(await file.text()));
        doc.meta = { ...doc.meta, id: newId(), name: doc.meta.name || file.name.replace(/\.boxproj$/i, ''), createdAt: now(), updatedAt: now() };
        resolve(doc);
      } catch (e) { reject(e); }
    };
    input.click();
  });
}
