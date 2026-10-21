import { validateProject, projectDigest } from '../proposal/schema.js';

export async function loadProposalFonts(fonts = []) {
  if (!Array.isArray(fonts) || fonts.length > 12) throw new Error('提案字体列表无效');
  for (const f of fonts) {
    if (typeof f.family !== 'string' || !/^data:font\/(woff2?|ttf|otf);base64,[A-Za-z0-9+/=]+$/.test(f.src || '')) throw new Error('提案字体必须内嵌');
    const face = new FontFace(f.family, 'url(' + f.src + ')', { weight: f.weight || '400' });
    document.fonts.add(await face.load());
  }
  await document.fonts.ready;
}

// 只在带一次性口令的新窗口中接收 opener 发送的工程；普通工作台不会注册监听。
export function receiveProposal(token) {
  if (!/^[\da-f-]{36}$/i.test(token) || !window.opener) return Promise.reject(new Error('请从视觉系统提案中确认并打开工作台'));
  return new Promise((resolve, reject) => {
    const sender = window.opener;
    const finish = () => { clearTimeout(timer); window.removeEventListener('message', receive); };
    const timer = setTimeout(() => { finish(); reject(new Error('未收到提案，请返回提案页面重新打开')); }, 20000);
    async function receive(event) {
      if (event.source !== sender || !['null', location.origin].includes(event.origin) || event.data?.token !== token || event.data?.type !== 'openbox3d:project') return;
      finish();
      try {
        const { project, fonts, approval } = event.data;
        if (JSON.stringify(event.data).length > 40_000_000) throw new Error('提案过大，无法载入');
        validateProject(project);
        if (!approval || typeof approval.title !== 'string' || typeof approval.revision !== 'string' || typeof approval.approvedAt !== 'string' || approval.projectHash !== await projectDigest(project)) throw new Error('提案版本校验失败');
        await loadProposalFonts(fonts);
        resolve({ project, approval, sender, token });
      } catch (e) {
        sender.postMessage({ type: 'openbox3d:error', token, message: e.message }, event.origin === 'null' ? '*' : event.origin);
        reject(e);
      }
    }
    window.addEventListener('message', receive);
    sender.postMessage({ type: 'openbox3d:ready', token }, '*');
  });
}

export function openProposalInWorkbench(payload) {
  const token = crypto.randomUUID();
  const target = new URL('http://127.0.0.1:26847/');
  target.searchParams.set('proposalToken', token);
  return new Promise((resolve, reject) => {
    let child;
    const finish = () => { clearTimeout(timer); window.removeEventListener('message', receive); };
    const timer = setTimeout(() => { finish(); reject(new Error('连接超时。请确认本地工作台已启动，再点击重试。提案仍可离线查看。')); }, 25000);
    function receive(event) {
      if (event.source !== child || event.origin !== target.origin || event.data?.token !== token) return;
      if (event.data.type === 'openbox3d:ready') child.postMessage({ ...payload, token, type: 'openbox3d:project' }, target.origin);
      if (event.data.type === 'openbox3d:loaded') { finish(); resolve(); }
      if (event.data.type === 'openbox3d:error') { finish(); reject(new Error(event.data.message)); }
    }
    window.addEventListener('message', receive);
    child = window.open(target.href, '_blank');
    if (!child) { finish(); reject(new Error('浏览器阻止了新窗口，请允许此页面打开工作台后重试')); }
  });
}
