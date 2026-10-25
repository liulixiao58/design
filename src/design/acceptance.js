import { materialToStorePatch } from '../render3d/materialPresets.js';

// 核验记录绑定工程内容；不是签名或工厂认证，修改内容后必须重新核验。
export const ACCEPTANCE_ITEMS = [
  ['visual', '原稿一致性：轮廓、纹理、流线、字标与同源3D'],
  ['process', '工艺核样：UV块面及间隙、烫金细线、套准与实际出血'],
  ['structure', '结构白样：内尺寸、材料、刀线及装入余量'],
  ['factory', '工厂核样：文件试开、RIP、纸张色样和实物加工']
];

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, ordered(value[k])]));
  return value;
}

export function acceptanceFingerprint(state) {
  const layers = (state.layers || []).map(({ img, locked, heroPreset, ...layer }) => layer);
  const keys = ['tpl', 'L', 'W', 'H', 'matId', 'bleed', 'glue', 'ovr', 'typeOvr', 'embDir', 'fx'];
  const text = JSON.stringify(ordered({ box: Object.fromEntries(keys.map(k => [k, state[k]])), displayPose:state.displayPose3d||'flat', material: materialToStorePatch(state), layers, reference: state.workflow?.acceptance?.reference || '' }));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `content-v1-${text.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function acceptanceChecks(state) {
  const acceptance = state.workflow?.acceptance || {}, fingerprint = acceptanceFingerprint(state);
  return ACCEPTANCE_ITEMS.map(([id, label]) => {
    const record = acceptance[id];
    const pass = !!(acceptance.reference?.trim() && record?.fingerprint === fingerprint && record?.note?.trim() && record?.at);
    return { id, label, pass, note: record?.note || '', status: pass ? '已记录核验' : record ? '工程已变更或记录不完整，须重核' : '未核验' };
  });
}

export const productionReleaseIssues = state => acceptanceChecks(state).filter(item => !item.pass).map(item => `${item.label}：${item.status}`);
