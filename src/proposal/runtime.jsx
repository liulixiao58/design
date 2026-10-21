import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoxPreview } from '../render3d/BoxPreview.jsx';
import { projectStateOf } from '../projects/projects.js';
import { loadProposalFonts, openProposalInWorkbench } from '../projects/proposalBridge.js';
import { validateProject, validateProposal, projectDigest } from './schema.js';
import { MATS } from '../dieline/templates.js';
import { geomOf } from '../dieline/geom.js';
import { drawLayer, FIN_NAMES, warnsOf } from '../design/layers.js';
import { bboxOfPts, clipPtsOf } from '../design/containers.js';
import { creaseSegsOf } from '../dieline/geom.js';
import './style.css';
import { productionIssues } from '../design/productionCheck.js';
import { customerDocument, validateCustomer } from './customer.js';

// 保留内嵌运行代码，供客户专用页面启用同源3D；客户正文另行生成。
const exportDocument = document.documentElement.cloneNode(true);
exportDocument.querySelectorAll('script[src],link[rel="modulepreload"]').forEach(node => node.remove());
const sourceHtml = '<!doctype html>\n' + exportDocument.outerHTML;
const proposal = JSON.parse(document.getElementById('proposal-data').textContent);
globalThis.__OPENBOX_PROPOSAL_ASSETS__ = proposal.assets;

function Drawing({ visual, state, geom }) {
  const ref = useRef(null);
  useEffect(() => drawVisual(ref.current,visual,state,geom), [visual, state, geom]);
  return <canvas ref={ref} role="img" aria-label={visual.caption} className="artboard" />;
}

function drawVisual(c,visual,state,geom) {
    const panel = visual.kind === 'panel' ? geom.panels.find(p => p.panelId === visual.panelId) : null;
    const box = panel ? bboxOfPts(panel.pts) : geom.sbb;
    const pad = visual.kind === 'panel' ? 0 : 5;
    const w = box[2] - box[0] + pad * 2, h = box[3] - box[1] + pad * 2, sc = 960 / w;
    c.width = 960; c.height = Math.ceil(h * sc);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#f9f7f2'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate((-box[0] + pad) * sc, (-box[1] + pad) * sc);
    for (const p of geom.panels) {
      ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x * sc, y * sc) : ctx.moveTo(x * sc, y * sc)); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    }
    for (const l of state.layers) if (l.visible && (!panel || l.panelId === panel.panelId)) {
      // 击凸不另印一层深色；镭射版的白色正形用银色示意，反射仍以3D为准。
      if (l.kind === 'image' && l.finish === 'emboss' && l.registration?.linked) continue;
      drawLayer(ctx, l, sc, l.kind === 'image' && l.finish === 'holo' ? '#c9ceda' : undefined, clipPtsOf(geom.panels, l));
    }
    if (!panel) for (const seg of geom.segs) { ctx.beginPath(); seg.pts.forEach(([x, y], i) => i ? ctx.lineTo(x * sc, y * sc) : ctx.moveTo(x * sc, y * sc)); ctx.strokeStyle = seg.t === 'cut' ? '#b45036' : '#839489'; ctx.lineWidth = 0.2 * sc; ctx.setLineDash(seg.t === 'cut' ? [] : [2 * sc, sc]); ctx.stroke(); }
}

function Visual({ visual, p, state, geom, shots }) {
  let content;
  if (visual.kind === 'image') content = <img src={visual.src} alt={visual.alt} />;
  if (['panel', 'dieline'].includes(visual.kind)) content = <Drawing visual={visual} state={state} geom={geom} />;
  if (visual.kind === 'palette') content = <div className="swatches">{p.palette.map(c => <div key={c.value}><span style={{ background: c.value }} /><b>{c.name}</b><code>{c.value}</code><small>{c.role}</small></div>)}</div>;
  if (visual.kind === 'views') content = <div className="views">{[['front', '正面'], ['side', '侧面'], ['iso', '斜侧面']].map(([id, name]) => <div key={id}>{shots[id] ? <img src={shots[id]} alt={name + '实际工程渲染'} /> : <span className="shot-loading">正在生成工程视图…</span>}<small>{name} · 实际工程渲染</small></div>)}</div>;
  if (visual.kind === 'finishes') content = <div className="finish-grid">{[...new Set(state.layers.map(l => l.finish))].map(f => <div className={'finish ' + f} key={f}><span>Aa / 工艺</span><b>{FIN_NAMES[f] || '普通印刷'}</b><small>{state.layers.filter(l => l.finish === f).length} 个独立图层</small></div>)}</div>;
  return <figure>{content}<figcaption>{visual.caption}{visual.sourceUrl && <> · <a href={visual.sourceUrl} target="_blank" rel="noreferrer">参考来源</a></>}</figcaption></figure>;
}

function Proposal({ p, state, hash }) {
  const engine = useRef(null), geom = geomOf(state, MATS.find(m => m.id === state.matId).t);
  const [spin, setSpin] = useState(true), [shots, setShots] = useState({}), [reviewed, setReviewed] = useState(false);
  const [phase, setPhase] = useState('review'), [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    let cancelled = false, busy = false;
    const poll = setInterval(async () => {
      const e = engine.current;
      if (!e?.ready || !e.boxRoot || busy) return;
      busy = true; clearInterval(poll);
      try {
        await e.studio.environmentReady;
        if (cancelled) return;
        const captures = {};
        const position = e.camera.position.clone(), target = e.controls.target.clone();
        const boxPosition = e.boxRoot.position.clone(), boxRotation = e.boxRoot.quaternion.clone();
        try {
          e.resetTurn();
          for (const view of ['front', 'side', 'iso']) {
            e.setView(view); e.renderer.render(e.scene, e.camera);
            captures[view] = e.renderer.domElement.toDataURL('image/png');
          }
        } finally {
          e.boxRoot.position.copy(boxPosition); e.boxRoot.quaternion.copy(boxRotation);
          e.boxRoot.updateWorldMatrix(true, true);
          e.camera.position.copy(position); e.controls.target.copy(target); e.controls.update();
        }
        setShots(captures); setReady(true);
      } catch (error) {
        setPreviewError('3D 取景失败：' + error.message);
      }
    }, 150);
    const timeout = setTimeout(() => { if (!engine.current?.ready) { clearInterval(poll); setPreviewError('3D 未能就绪，请检查浏览器是否支持 WebGL 2'); } }, 30000);
    return () => { cancelled = true; clearInterval(poll); clearTimeout(timeout); };
  }, []);

  const open = async () => {
    setPhase('opening'); setMessage('正在连接本地工作台…');
    try {
      const issues=productionIssues(state.layers,{loaded:true,reconstruction:state.reconstruction});
      if(p.deliveryMode==='production'&&issues.length)throw new Error('生产交接被阻止：'+issues.join('；'));
      await openProposalInWorkbench({ project: p.project, fonts: p.fonts, approval: { id: p.id, title: p.title, revision: p.revision, deliveryMode:p.deliveryMode||'concept', projectHash: hash, approvedAt: new Date().toISOString() } });
      setPhase('loaded'); setMessage('同一版本已载入工作台。文字、图片与工艺可分别编辑；修改后请导出工程保存。');
    } catch (e) { setPhase('review'); setMessage(e.message); }
  };
  const download = () => {
    try {
      const previews={...shots};
      validateCustomer(p.customer);
      for(const section of p.customer.sections)for(const [i,v]of section.visuals.entries())if(['panel','dieline'].includes(v.kind)){
        const canvas=document.createElement('canvas');drawVisual(canvas,v,state,geom);
        previews[section.id+'-'+i]=canvas.toDataURL('image/png');
      }
      const html=customerDocument(sourceHtml,p,previews);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = p.customer.title+'-设计方案.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }catch(error){setPreviewError('设计方案未生成：'+error.message);}
  };
  const warnings = state.layers.flatMap(l => warnsOf(l, creaseSegsOf(geom), geom.sbb).map(w => (l.name || l.content) + '：' + w));
  return <>
    <header><a className="brand" href="#top">包装设计研究室 <span>/ DESIGN STUDY</span></a><span>{p.revision} · {p.demo ? '流程演示' : '待设计师评审'}</span><button onClick={download} disabled={!p.customer||!ready} title={!p.customer?'尚未填写客户专用方案内容':!ready?'请等待3D取景完成':'生成客户专用HTML'}>设计方案</button></header>
    {previewError && <p role="alert" className="notice">{previewError}</p>}
    <main id="top">
      <section className="intro"><div><p className="eyebrow">PACKAGING VISUAL SYSTEM · {p.revision}</p><h1>{p.title}</h1><p className="summary">{p.summary}</p><div className="tags"><span>{state.L} × {state.W} × {state.H} mm · 内尺寸</span><span>{state.layers.length} 个独立图层</span><span>离线 3D</span></div>{p.demo && <p className="notice">这是用于验收流程的演示设计，未进行客户市场调研，不能作为趋势报告或量产稿。</p>}</div><div className="viewer-wrap"><div className="viewer" aria-label="包装 3D 自动旋转展示"><BoxPreview s={{ ...state, spin, fold: 100, check: 'art' }} m={MATS.find(m => m.id === state.matId)} engineRef={engine} shadowSamples={3} /></div><div className="viewer-caption"><span role="status">{ready ? '3D 已就绪 · 可拖动查看' : '正在准备 3D…'}</span><button onClick={() => setSpin(!spin)}>{spin ? '暂停旋转' : '自动旋转'}</button></div></div></section>
      <nav aria-label="视觉系统目录">{p.sections.map((s, i) => <a key={s.id} href={'#' + s.id}>{String(i + 1).padStart(2, '0')} {s.title}</a>)}</nav>
      <section className="brief"><h2>设计任务与边界</h2><p>{p.brief}</p><div className="pending"><b>仍需确认</b><ul>{(p.pending || []).map((v, i) => <li key={i}>{v}</li>)}</ul></div></section>
      {p.sections.map((s, i) => <section className="system-section" id={s.id} key={s.id}><div className="section-heading"><span>{String(i + 1).padStart(2, '0')}</span><h2>{s.title}</h2><small>{s.english || ''}</small></div><div className="section-grid"><div className="visuals">{s.visuals.map((v, j) => <Visual key={j} visual={v} p={p} state={state} geom={geom} shots={shots} />)}</div><div className="rationale"><h3>设计理念</h3><p>{s.intent}</p><h3>使用规则</h3><ul>{s.rules.map((r, j) => <li key={j}>{r}</li>)}</ul>{s.pending?.length > 0 && <><h3>待确认</h3><ul>{s.pending.map((r, j) => <li key={j}>{r}</li>)}</ul></>}</div></div></section>)}
      <section className="brief"><h2>字体与独立素材</h2><p>{p.typography}</p><div className="asset-list">{p.project.design.layers.filter(l => l.kind === 'image').map(l => <figure key={l.id}><img src={l.imgSrc} alt={l.name || l.content} /><figcaption>{l.name || l.content} · {l.panelId} · {FIN_NAMES[l.finish] || '普通印刷'}</figcaption></figure>)}</div><p>文字保留内容、字号和字体属性；插画以独立图片图层承载，可调整或替换。插画内部路径不在第一版编辑范围内。</p></section>
      <section className="brief"><h2>调研来源与转化依据</h2>{p.research.length ? p.research.map((r, i) => <article className="source" key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a><small>{r.author || '作者未标明'} · 作品日期：{r.publishedAt || '未核实'} · 访问：{r.accessedAt}</small><p>观察：{r.insight}</p><p>本案应用：{r.application}</p></article>) : <p>{p.demo ? '演示提案未填入真实设计调研。本页用于检查导出、离线展示和可编辑工程交接。' : p.researchSkippedReason}</p>}</section>
      <section className="approval" id="approval"><p className="eyebrow">REVIEW & HANDOFF</p><h2>确认这一版，再进入工作台</h2><p>将载入「{p.title} · {p.revision}」的同一份设计数据，保留 {state.layers.length} 个独立图层。打开编辑需要本地工作台运行；本提案的离线查看不需要服务。</p>{warnings.length > 0 && <div className="notice"><b>工程警示</b><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}{p.warnings.map((w, i) => <p className="notice" key={i}>{w}</p>)}<label className="review-check"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />我已确认本版视觉系统，可以进入工作台继续编辑。</label><button className="primary" disabled={!reviewed || !ready || phase === 'opening'} onClick={open}>{phase === 'opening' ? '正在打开…' : phase === 'loaded' ? '再次打开这份设计' : '确认方案并打开工作台'}</button><p role="status" className="handoff-status">{message}</p><small>版本指纹 {hash.slice(0, 16)} · 视觉确认不代表印前与结构打样验收。</small></section>
    </main><footer>Codex × OpenBox3D · 包装视觉系统提案 <details><summary>开源组件许可</summary><pre>{p.thirdPartyNotices}</pre></details></footer>
  </>;
}

async function start() {
  if(proposal.audience==='customer'){
    validateCustomer(proposal.customer);validateProject(proposal.project);
    const deadline=promise=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('交互资源加载超时，仍可查看完整静态方案')),20000))]);
    try{
      await deadline(loadProposalFonts(proposal.fonts));
      const state=await deadline(projectStateOf(proposal.project,'three'));
      createRoot(document.getElementById('customer-model')).render(<CustomerViewer state={state}/>);
    }catch(e){document.getElementById('customer-status').textContent='当前显示静态方案。'+e.message;}
    return;
  }
  validateProposal(proposal); validateProject(proposal.project);
  await loadProposalFonts(proposal.fonts);
  const state = await projectStateOf(proposal.project, 'three');
  if (state.layers.some(l => l.kind === 'image' && !l.img)) throw new Error('有图片素材无法解码，提案未完成加载');
  const hash = await projectDigest(proposal.project);
  createRoot(document.getElementById('proposal-root')).render(<Proposal p={proposal} state={state} hash={hash} />);
}

function CustomerViewer({state}) {
  const engine=useRef(null),[spin,setSpin]=useState(true);
  useEffect(()=>{
    const status=document.getElementById('customer-status'),host=document.getElementById('customer-model');
    const poll=setInterval(()=>{if(!engine.current?.ready)return;clearInterval(poll);clearTimeout(timeout);host.classList.add('ready');status.textContent='3D已就绪，可拖动查看；下方为同一设计的视觉系统。';},150);
    const timeout=setTimeout(()=>{clearInterval(poll);status.textContent='当前浏览器未能启动3D，已保留完整静态方案。';},20000);
    return()=>{clearInterval(poll);clearTimeout(timeout);};
  },[]);
  return <><div className="customer-engine"><BoxPreview s={{...state,spin,fold:100,check:'art'}} m={MATS.find(m=>m.id===state.matId)} engineRef={engine} shadowSamples={3}/></div><button className="customer-reset" onClick={()=>{setSpin(false);engine.current?.resetTurn();engine.current?.setView('iso');}}>回到主视角</button><button className="customer-spin" onClick={()=>setSpin(!spin)}>{spin?'暂停旋转':'自动旋转'}</button></>;
}

start().catch(e => { const target=document.getElementById(proposal.audience==='customer'?'customer-status':'proposal-root');if(target)target.textContent='提案加载失败：' + e.message; });

