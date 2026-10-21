import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { imageSize } from 'image-size';

const filled = v => typeof v === 'string' && !!v.trim();
const escape = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = a => Array.isArray(a) ? a : [];
const webUrl = v => {try{return ['https:','http:'].includes(new URL(v).protocol);}catch{return false;}};
const sourceLink = c => webUrl(c.url) ? '<a href="'+escape(c.url)+'" rel="noreferrer">'+escape(c.url)+'</a>' : '<p>'+escape(c.sourceNote||'来源未记录')+'</p>';

export async function checkResearch(board, base) {
  const issues=[], images=new Map(), cases=list(board.cases), ids=new Map();
  for(const key of ['project','scope'])if(!filled(board[key]))issues.push('缺少'+key);
  if(!cases.length)issues.push('没有已看图的案例，搜索结果不算完成调研');
  for(const c of cases){
    const name=c.title||c.id||'未命名案例';
    if(!filled(c.id)||ids.has(c.id))issues.push(name+'：案例编号缺失或重复');
    ids.set(c.id,c);
    for(const key of ['title','publishedAt','accessedAt','observed','interpretation','reason'])if(!filled(c[key]))issues.push(name+'：缺少'+key);
    if(c.sourceType==='customer'?!filled(c.sourceNote):!webUrl(c.url))issues.push(name+'：来源链接无效或客户资料缺少来源说明');
    if(!['采用','淘汰','证据不足'].includes(c.decision))issues.push(name+'：未完成取舍');
    if(c.decision==='采用'&&!filled(c.application))issues.push(name+'：没有原创应用说明');
    if(c.decision!=='证据不足'){
      try{
        if(!filled(c.evidence)||path.isAbsolute(c.evidence)||/^[a-z]+:/i.test(c.evidence))throw new Error();
        const bytes=await fs.readFile(path.resolve(base,c.evidence)), size=imageSize(bytes);
        if(!['png','jpg','webp'].includes(size.type)||!size.width||!size.height)throw new Error();
        images.set(c.id,'data:image/'+(size.type==='jpg'?'jpeg':size.type)+';base64,'+bytes.toString('base64'));
      }catch{issues.push(name+'：缺少可解码的本地看图证据');}
    }
  }
  const questions=list(board.questions), qIds=new Set();
  if(!questions.length)issues.push('未列出本次研究问题');
  for(const q of questions){
    if(!filled(q.id)||qIds.has(q.id))issues.push('研究问题编号缺失或重复');qIds.add(q.id);
    if(!filled(q.question)||!filled(q.conclusion)||q.reviewed!==true)issues.push((q.question||q.id)+'：关键问题未完成复审');
    if(!list(q.sourceIds).length||list(q.sourceIds).some(id=>!ids.has(id)||ids.get(id).decision==='证据不足'))issues.push((q.question||q.id)+'：结论缺少可复核的案例');
  }
  if(!list(board.choices).length)issues.push('没有参考到设计选择的转化记录');
  for(const c of list(board.choices)){
    if(!filled(c.element)||!filled(c.application))issues.push('设计选择缺少元素或应用说明');
    if(!list(c.sourceIds).length||list(c.sourceIds).some(id=>ids.get(id)?.decision!=='采用'))issues.push((c.element||'设计选择')+'：使用了未采用或不存在的参考');
  }
  return {issues,images};
}

export function researchHtml(board,{issues,images}){
  board={...board,cases:list(board.cases).map(c=>({...c,url:webUrl(c.url)?c.url:'',publishedAt:c.publishedAt||'未记录',accessedAt:c.accessedAt||'未记录'}))};
  const text=v=>'<p>'+escape(v)+'</p>';
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(board.project)+' · 研究板</title><style>body{margin:0;background:#f5f3ee;color:#243d34;font:16px/1.7 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:28px}article,section{background:white;padding:24px;margin:20px 0;border-radius:12px}img{display:block;width:100%;height:auto;border:1px solid #ddd}h1,h2{line-height:1.3}a{color:#725224;overflow-wrap:anywhere}small{color:#666}.status{border-left:6px solid '+(issues.length?'#b54432':'#368365')+'}dt{font-weight:700;margin-top:12px}dd{margin:0}li{margin:8px 0}</style><main><h1>'+escape(board.project)+' · 设计前研究板</h1><section class="status"><h2>'+(issues.length?'未放行：需补充研究材料':'研究资料完整，可复核')+'</h2>'+text('本次范围：'+board.scope)+text('检查只验证记录与图证，不替代审美、趋势、客户或工厂验收。')+'<ul>'+issues.map(i=>'<li>'+escape(i)+'</li>').join('')+'</ul></section><section><h2>本次研究问题与结论</h2>'+list(board.questions).map(q=>'<h3>'+escape(q.question)+'</h3>'+text(q.conclusion)+text('复审：'+(q.reviewed===true?'已记录':'未完成')+'；依据：'+list(q.sourceIds).join('、'))).join('')+'</section>'+list(board.cases).map(c=>'<article><h2>'+escape(c.id+' · '+c.title)+'</h2>'+sourceLink(c)+text('作品时间：'+c.publishedAt+'；查看日期：'+c.accessedAt)+(images.has(c.id)?'<img src="'+images.get(c.id)+'" alt="'+escape(c.title+'看图证据')+'">':text('图证未提供／未通过检查'))+'<dl>'+[['实际观察',c.observed],['设计推断',c.interpretation],['决定',c.decision],['取舍理由',c.reason],['原创应用',c.application]].map(([k,v])=>'<dt>'+k+'</dt><dd>'+escape(v)+'</dd>').join('')+'</dl></article>').join('')+'<section><h2>参考如何进入设计</h2>'+list(board.choices).map(c=>'<h3>'+escape(c.element)+'</h3>'+text(c.application)+text('依据：'+list(c.sourceIds).join('、'))).join('')+'</section><section><h2>尚未解决／范围限制</h2><ul>'+list(board.limitations).map(l=>'<li>'+escape(l)+'</li>').join('')+'</ul></section></main></html>';
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const file=path.resolve(process.argv[2]),base=path.dirname(file),board=JSON.parse(await fs.readFile(file,'utf8'));
    const result=await checkResearch(board,base),receipt={checkedAt:new Date().toISOString(),scope:board.scope,complete:!result.issues.length,issues:result.issues};
    await fs.writeFile(path.join(base,'研究板.html'),researchHtml(board,result));
    await fs.writeFile(path.join(base,'研究检查.json'),JSON.stringify(receipt,null,2));
    console.log(JSON.stringify(receipt,null,2));if(result.issues.length)process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=1;}
}
