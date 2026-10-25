import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { validateProject, validateProposal, jsonForHtml } from '../src/proposal/schema.js';
import { ENVIRONMENT_PRESETS } from '../src/render3d/presets.js';
import { STAGES } from '../src/render3d/stage.js';
import { inspectProjectSources } from './project-preflight.mjs';
import { validateCustomer } from '../src/proposal/customer.js';
import { checkResearch } from '../.agents/skills/alterlab-vcd-packaging/scripts/check-research.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };
const inside = p => { const r = path.relative(root, p); return r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r); };

async function localFile(file, base) {
  if (typeof file !== 'string' || /^(https?:|file:)/i.test(file)) throw new Error('请先将素材保存到本项目，再导出离线提案');
  const full = await fs.realpath(path.resolve(base, file));
  if (!inside(full)) throw new Error('素材路径超出当前项目：' + file);
  return full;
}

async function embed(file, base, expected) {
  if (file.startsWith('data:')) {
    if (!file.startsWith('data:' + expected)) throw new Error('素材类型不符合预期');
    return file;
  }
  const full = await localFile(file, base), type = mime[path.extname(full).toLowerCase()];
  if (!type?.startsWith(expected)) throw new Error('不支持的离线素材格式：' + file);
  const bytes = await fs.readFile(full);
  if (bytes.length > 12_000_000) throw new Error('单个素材不能超过 12 MB：' + file);
  if (type === 'image/svg+xml') {
    const xml = bytes.toString('utf8');
    if (/<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*['"](?:https?:|\/\/)/i.test(xml)) throw new Error('SVG 必须为无脚本、无外部资源的静态图形');
  }
  return 'data:' + type + ';base64,' + bytes.toString('base64');
}

export async function prepareProposal(manifest) {
  const file = await localFile(manifest, root), base = path.dirname(file);
  const p = validateProposal(JSON.parse(await fs.readFile(file, 'utf8')));
  if(p.researchRecord){
    const record=await localFile(p.researchRecord,base);
    const result=await checkResearch(JSON.parse(await fs.readFile(record,'utf8')),path.dirname(record));
    if(result.issues.length)throw new Error('设计前研究未完成：'+result.issues.join('；'));
  }
  p.project = JSON.parse(await fs.readFile(await localFile(p.project, base), 'utf8'));
  for (const l of p.project.design.layers) if (l.kind === 'image') {
    l.imgSrc = await embed(l.imgSrc.startsWith('/') ? '.' + l.imgSrc : l.imgSrc, l.imgSrc.startsWith('/') ? path.join(root, 'public') : base, 'image/');
  }
  validateProject(p.project);
  const preflight=inspectProjectSources(p.project);p.project=preflight.project;p.productionIssues=preflight.issues.concat(preflight.releaseIssues);
  if(p.deliveryMode==='production'&&preflight.issues.length)throw new Error('生产交接预检失败：'+preflight.issues.join('；'));
  if(p.project.design.layers.some(l=>l.kind==='text'&&(l.font||'Noto Sans SC')==='Noto Sans SC')){
    p.fonts=p.fonts||[];
    for(const weight of ['400','700'])if(!p.fonts.some(f=>f.family==='Noto Sans SC'&&f.weight===weight))p.fonts.push({family:'Noto Sans SC',weight,src:path.relative(base,path.join(root,'public/fonts/NotoSansSC-'+weight+'.ttf'))});
  }
  if(p.customer)validateCustomer(p.customer);
  for (const s of [...p.sections,...(p.customer?.sections||[])]) for (const v of s.visuals) {
    if (v.kind === 'image') v.src = await embed(v.src, base, 'image/');
    if (v.kind === 'panel' && !p.project.design.layers.some(l => l.panelId === v.panelId)) throw new Error('盒面预览没有对应图层：' + v.panelId);
    if (v.sourceUrl && !/^https?:\/\//.test(v.sourceUrl)) throw new Error('参考链接须为 http(s)');
  }
  p.fonts = await Promise.all((p.fonts || []).map(async f => ({ family: f.family, weight: f.weight || '400', src: await embed(f.src, base, 'font/'), ...(f.licenseFile ? {license:await fs.readFile(await localFile(f.licenseFile,base),'utf8')} : {}) })));
  if (JSON.stringify({ project: p.project, fonts: p.fonts }).length > 35_000_000) throw new Error('工程与字体合计过大，请压缩图片或拆分素材后重试（交接数据限约 35 MB）');
  p.assets = {};
  const env = ENVIRONMENT_PRESETS.find(e => e.id === p.project.scene?.environment?.source);
  if (env?.url) p.assets[env.url] = await embed('.' + env.url, path.join(root, 'public'), 'application/');
  const stage = p.project.scene?.stage;
  if (stage && stage !== 'none') {
    if (!STAGES.some(s => s.id === stage)) throw new Error('未知地面场景：' + stage);
    for (const suffix of ['diff', 'nor_gl', 'arm']) {
      const url = '/textures/' + stage + '_' + suffix + '_1k.jpg';
      p.assets[url] = await embed('.' + url, path.join(root, 'public'), 'image/');
    }
  }
  p.warnings = [...(p.warnings || [])];
  if (!p.fonts.length) p.warnings.push('此提案未内嵌专用字体，离线时采用本机字体回退；正式交付请提供获授权字体文件并重新导出。');
  p.thirdPartyNotices = (await Promise.all(['three', 'react', 'react-dom'].map(async name => name + '\n' + await fs.readFile(path.join(root, 'node_modules', name, 'LICENSE'), 'utf8')))).join('\n\n');
  if(p.fonts.some(f=>f.family==='Noto Sans SC'))p.thirdPartyNotices+='\n\nNoto Sans SC\n'+await fs.readFile(path.join(root,'public/fonts/OFL.txt'),'utf8');
  for(const f of p.fonts)if(f.license)p.thirdPartyNotices+='\n\n'+f.family+'\n'+f.license;
  return p;
}

export function documentHtml(p, script, css) {
  const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src data: blob:; base-uri 'none'; form-action 'none'"><title>${escape(p.title)} · ${escape(p.revision)}</title><style>${css}</style></head><body><div id="proposal-root">正在准备离线视觉系统…</div><script id="proposal-data" type="application/json">${jsonForHtml(p)}</script><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}

export async function exportProposal(manifest, output) {
  const p = await prepareProposal(manifest);
  const out = path.resolve(output || path.join('drafts', p.id + '-视觉系统.html'));
  if (!inside(out) || path.extname(out) !== '.html') throw new Error('输出须为当前项目内的 .html 文件');
  p.outputName = path.basename(out);
  const assetPath = path.join(root, 'src/asset.js').replaceAll('\\', '/');
  const result = await build({ configFile: false, root, logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, plugins: [{ name: 'offline-assets', enforce: 'pre', load(id) {
    if (id.replaceAll('\\', '/') === assetPath) return "export const asset = p => { const value = globalThis.__OPENBOX_PROPOSAL_ASSETS__[p]; if (!value) throw new Error('离线文件缺少资源：' + p); return value; };";
  } }], build: { write: false, minify: true, cssCodeSplit: false, lib: { entry: path.join(root, 'src/proposal/runtime.jsx'), name: 'OpenBoxProposal', formats: ['iife'] }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
  const script = chunks.filter(c => c.type === 'chunk').map(c => c.code).join('\n');
  const css = chunks.filter(c => c.type === 'asset' && c.fileName.endsWith('.css')).map(c => c.source).join('\n');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, documentHtml(p, script, css));
  return { output: out, bytes: (await fs.stat(out)).size, sections: p.sections.length, layers: p.project.design.layers.length, demo: !!p.demo };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error('用法：npm run proposal:export -- <提案.json> [输出.html]');
    console.log(JSON.stringify(await exportProposal(process.argv[2], process.argv[3]), null, 2));
  } catch (e) { console.error('提案未导出：' + e.message); process.exitCode = 1; }
}
