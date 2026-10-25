import { productionReleaseIssues } from './design/acceptance.js';
import { productionIssues } from './design/productionCheck.js';

export const WORKFLOW_STAGES = [
  { id: 'brief', label: '需求', short: '需求录入', description: '把产品、用户、渠道和包装条件记录清楚。' },
  { id: 'research', label: '调研', short: '调研判断', description: '记录参考、设计判断和需要避免的问题。' },
  { id: 'proposal', label: '方案', short: '方案确认', description: '选定视觉方向，并记录确认版本。' },
  { id: 'structure', label: '结构', short: '结构设计', description: '确定盒型、尺寸、材料和结构假设。' },
  { id: 'design', label: '设计', short: '视觉设计', description: '完成图层、文案、图片和工艺表达。' },
  { id: 'delivery', label: '交付', short: '交付检查', description: '检查文件并明确哪些内容仍需人工确认。' }
];

const briefFields = [
  ['product', '产品与包装什么'], ['audience', '目标购买者'], ['channel', '销售/使用场景'],
  ['copy', '必须出现的准确文案'], ['package', '包装数量与保护要求'], ['budget', '单个包装预算与交期']
];

export const emptyWorkflow = () => ({
  stage: 'brief',
  brief: Object.fromEntries(briefFields.map(([key]) => [key, ''])),
  dimensions: { value: '', confirmed: false },
  research: '',
  proposal: { selected: '', revision: '', confirmed: false, purpose: 'concept' },
  assumptions: [],
  delivery: { structureChecked: false, factoryChecked: false, notes: '' },
  updatedAt: new Date().toISOString()
});

export const WORKFLOW_BRIEF_FIELDS = briefFields;

export function normalizeWorkflow(raw) {
  const base = emptyWorkflow();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    brief: { ...base.brief, ...(raw.brief || {}) },
    dimensions: { ...base.dimensions, ...(raw.dimensions || {}) },
    proposal: { ...base.proposal, ...(raw.proposal || {}) },
    delivery: { ...base.delivery, ...(raw.delivery || {}) },
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : []
  };
}

export function workflowGate(stage, state, checks) {
  const w = normalizeWorkflow(state.workflow);
  if (stage === 'brief') return WORKFLOW_BRIEF_FIELDS.every(([key]) => String(w.brief[key] || '').trim()) && w.dimensions.confirmed;
  if (stage === 'research') return String(w.research || '').trim().length >= 20;
  if (stage === 'proposal') {
    const selected=!!String(w.proposal.selected||'').trim()&&!!String(w.proposal.revision||'').trim()&&w.proposal.confirmed;
    if(w.proposal.purpose!=='production')return selected;
    return selected&&w.dimensions.confirmed&&state.layers.length>0&&productionIssues(state.layers).length===0&&checks.production.length===0;
  }
  if (stage === 'structure') return Number(state.L) > 0 && Number(state.W) > 0 && Number(state.H) > 0;
  if (stage === 'design') return state.layers.length > 0 && checks.design.length === 0;
  if (stage === 'delivery') return checks.production.length === 0 && productionReleaseIssues(state).length === 0 && w.delivery.structureChecked && w.delivery.factoryChecked;
  return false;
}

export function nextWorkflowStage(stage) {
  const index = WORKFLOW_STAGES.findIndex(item => item.id === stage);
  return WORKFLOW_STAGES[Math.min(index + 1, WORKFLOW_STAGES.length - 1)].id;
}
