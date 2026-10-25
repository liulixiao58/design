import React, { useMemo, useState } from 'react';
import { ST, btnSt } from './widgets.jsx';
import { WORKFLOW_BRIEF_FIELDS, WORKFLOW_STAGES, normalizeWorkflow, nextWorkflowStage, workflowGate } from '../workflow.js';
import {SourceBudget} from './SourceBudget.jsx';

const card = { background: 'var(--ui-canvas)', border: '1px solid var(--ui-border-soft)', borderRadius: 8, padding: '20px 22px' };
const input = { width: '100%', border: '1px solid var(--ui-border)', borderRadius: 5, padding: '8px 9px', background: 'var(--ui-canvas)', color: 'var(--ui-ink)', fontSize: 12 };

function Field({ label, value, onChange, multiline = false, placeholder }) {
  const props = { value, placeholder, onChange: e => onChange(e.target.value), style: input };
  return <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--ui-secondary)' }}>{label}{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</label>;
}

export function WorkflowView({ state, checks, onChange, onNavigate }) {
  const workflow = normalizeWorkflow(state.workflow);
  const [draft, setDraft] = useState(workflow);
  const [saved, setSaved] = useState(false);
  const current = WORKFLOW_STAGES.find(item => item.id === draft.stage) || WORKFLOW_STAGES[0];
  const gates = useMemo(() => Object.fromEntries(WORKFLOW_STAGES.map(item => [item.id, workflowGate(item.id, { ...state, workflow: draft }, checks)])), [draft, state, checks]);

  const update = patch => setDraft(previous => ({ ...previous, ...patch, updatedAt: new Date().toISOString() }));
  const save = () => { onChange(draft); setSaved(true); setTimeout(() => setSaved(false), 1600); };
  const finish = () => {
    if (!gates[current.id]) return;
    const next = nextWorkflowStage(current.id);
    const nextDraft = { ...draft, stage: next, updatedAt: new Date().toISOString() };
    setDraft(nextDraft); onChange(nextDraft);
  };

  return <section className="workflow-view" aria-label="包装设计流程">
    <div className="workflow-heading"><div><div className="projects-eyebrow">PACKAGING WORKFLOW</div><h1>项目流程</h1><p>按阶段完成需求、方案、设计与交付。未满足放行条件时，不会标记为完成。</p></div><button className="primary" onClick={save}>{saved ? '已保存' : '保存流程资料'}</button></div>
    <div className="workflow-steps" aria-label="流程阶段">{WORKFLOW_STAGES.map((item, index) => <button key={item.id} className={item.id === current.id ? 'active' : ''} onClick={() => update({ stage: item.id })}><span>{index + 1}</span><strong>{item.label}</strong><small>{gates[item.id] ? '可放行' : '待完成'}</small></button>)}</div>
    {['proposal','design'].includes(current.id)&&<div style={{...card,marginBottom:14}}>
      <label>本次方案确认范围 <select aria-label="方案确认范围" value={draft.proposal.purpose||'concept'} onChange={e=>update({proposal:{...draft.proposal,purpose:e.target.value,confirmed:false}})}>
        <option value="concept">概念选款（不承诺生产）</option><option value="production">生产母稿技术确认</option>
      </select></label>
      <p className="workflow-hint">生产母稿技术确认要求尺寸基准和当前素材技术检查通过；不代替视觉一致性及工厂验收。</p>
      {draft.proposal.purpose==='production'&&checks.production.length>0&&<p role="alert" className="workflow-block">当前有 {checks.production.length} 项素材技术问题，生产母稿确认不能放行。请先处理下方原图，不要重新生成整盒效果图。</p>}
      <SourceBudget layers={state.layers} plan={draft.proposal.assetPlan} onPlanChange={assetPlan=>update({proposal:{...draft.proposal,assetPlan,confirmed:false}})}/>
    </div>}
    <div className="workflow-grid">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={card}><ST>{current.short}</ST><p className="workflow-description">{current.description}</p>
          {current.id === 'brief' && <div className="workflow-form">{WORKFLOW_BRIEF_FIELDS.map(([key, label]) => <Field key={key} label={label} value={draft.brief[key]} onChange={value => update({ brief: { ...draft.brief, [key]: value } })} multiline={key === 'copy' || key === 'package'} placeholder="填写已确认内容；不确定时写“待确认”。" />)}<Field label="产品尺寸 / 盒内尺寸" value={draft.dimensions.value} onChange={value => update({ dimensions: { ...draft.dimensions, value } })} placeholder="例如：80 × 40 × 120 mm；没有实测数据请明确写概念假设" /><label className="workflow-check"><input type="checkbox" checked={draft.dimensions.confirmed} onChange={e => update({ dimensions: { ...draft.dimensions, confirmed: e.target.checked } })} /> 我已确认尺寸，或已明确标记为概念假设</label></div>}
          {current.id === 'research' && <div className="workflow-form"><Field label="设计判断、参考与取舍" value={draft.research} onChange={value => update({ research: value })} multiline placeholder="写清楚：想传达什么、参考了什么、采用/淘汰的原因，以及要避免什么。" /><p className="workflow-hint">当前版本记录研究判断，不自动声称已完成联网调研；外部参考仍需人工核对来源。</p></div>}
          {current.id === 'proposal' && <div className="workflow-form"><Field label="选定方案" value={draft.proposal.selected} onChange={value => update({ proposal: { ...draft.proposal, selected: value } })} placeholder="例如：A 方案 / 深绿纸盒 + 金色局部工艺" /><Field label="方案版本" value={draft.proposal.revision} onChange={value => update({ proposal: { ...draft.proposal, revision: value } })} placeholder="例如：v01" /><label className="workflow-check"><input type="checkbox" checked={draft.proposal.confirmed} onChange={e => update({ proposal: { ...draft.proposal, confirmed: e.target.checked } })} /> 我确认按这个方案进入工作台继续设计</label></div>}
          {current.id === 'structure' && <div className="workflow-next"><p>当前盒型：<strong>{state.tpl}</strong> · 内尺寸 {state.L} × {state.W} × {state.H} mm</p><button style={btnSt} onClick={() => onNavigate('structure')}>进入结构工作区</button><p className="workflow-hint">结构尺寸仍需根据实测产品和打样确认；工作台参数不等于已经量产验证。</p></div>}
          {current.id === 'design' && <div className="workflow-next"><p>当前有 {state.layers.length} 个设计图层，设计检查 {checks.design.length} 项。</p><button style={btnSt} onClick={() => onNavigate('design')}>进入设计工作区</button><button style={{ ...btnSt, marginLeft: 8 }} onClick={() => onNavigate('three')}>查看 3D</button></div>}
          {current.id === 'delivery' && <div className="workflow-form"><label className="workflow-check"><input type="checkbox" checked={draft.delivery.structureChecked} onChange={e => update({ delivery: { ...draft.delivery, structureChecked: e.target.checked } })} /> 我已确认结构/刀线仍需印厂或 RIP 复核</label><label className="workflow-check"><input type="checkbox" checked={draft.delivery.factoryChecked} onChange={e => update({ delivery: { ...draft.delivery, factoryChecked: e.target.checked } })} /> 我已确认交付对象和生产边界</label><Field label="交付备注与待确认项" value={draft.delivery.notes} onChange={value => update({ delivery: { ...draft.delivery, notes: value } })} multiline placeholder="例如：颜色、纸张、打样、专色或刀模仍需工厂确认。" /><button style={btnSt} onClick={() => onNavigate('output')}>查看交付检查</button></div>}
        </div>
        <div style={card}><ST>当前放行条件</ST><p className={gates[current.id] ? 'workflow-pass' : 'workflow-block'}>{gates[current.id] ? '本阶段条件已满足，可以进入下一阶段。' : '本阶段仍有条件未满足，请补充资料或明确假设。'}</p>{current.id === 'design' && checks.design.length > 0 && <p className="workflow-hint">设计警示：{checks.design.join('；')}</p>}{current.id === 'delivery' && checks.production.length > 0 && <p className="workflow-hint">生产阻断：{checks.production.join('；')}</p>}<button className="primary" disabled={!gates[current.id]} onClick={finish}>{current.id === 'delivery' ? '流程完成' : '完成本阶段并继续'}</button></div>
      </div>
      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}><div style={card}><ST>操作提示</ST><ol className="workflow-list"><li>先填写真实信息；不确定内容写成假设。</li><li>方案确认后再进入结构和视觉深化。</li><li>“可放行”不等于结构打样或印厂验收通过。</li></ol></div><div style={card}><ST>工作区快捷入口</ST><div className="workflow-links"><button onClick={() => onNavigate('structure')}>结构</button><button onClick={() => onNavigate('design')}>设计</button><button onClick={() => onNavigate('three')}>3D</button><button onClick={() => onNavigate('output')}>交付</button></div></div></aside>
    </div>
  </section>;
}
