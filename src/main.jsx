import React from 'react';
import './fonts.css';
import './workspace.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { store } from './state/store.js';
import { loadPresetBox } from './preset/presetBox.js';
import { projectStateOf } from './projects/projects.js';
import { receiveProposal } from './projects/proposalBridge.js';
import { productionIssues } from './design/productionCheck.js';
import { productionReleaseIssues } from './design/acceptance.js';

// 先注入预设示例盒再挂载，避免空白盒闪屏；素材加载失败也保证应用可开。
// ?heroTest/?embTest/?surfaceTest 调试场景自带测试图层，跳过预设注入。
const debugScene = ['heroTest', 'embTest', 'surfaceTest'].some(k => new URLSearchParams(location.search).has(k));
async function loadInitialBox() {
  const token = new URLSearchParams(location.search).get('proposalToken');
  if (token) {
    const { project, approval, sender } = await receiveProposal(token);
    const patch = await projectStateOf(project, 'design');
    if(approval.deliveryMode==='production'){
      const issues=productionIssues(patch.layers,{loaded:true,reconstruction:patch.reconstruction}).concat(productionReleaseIssues(patch));
      if(issues.length){sender.postMessage({type:'openbox3d:error',token,message:'生产交接被阻止：'+issues.join('；')},'*');throw new Error('生产交接预检不通过');}
    }
    if (patch.layers.some(l => l.kind === 'image' && !l.img)) {
      sender.postMessage({ type: 'openbox3d:error', token, message: '存在无法加载的素材，工程未载入' }, '*');
      throw new Error('提案图片加载失败');
    }
    document.title = approval.title + ' · ' + approval.revision + ' · OpenBox3D';
    history.replaceState(null, '', location.pathname);
    sender.postMessage({ type: 'openbox3d:loaded', token }, '*');
    return { ...patch, fold: 100, proposalApproval: approval };
  }
  const name = new URLSearchParams(location.search).get('draft');
  if (!name) {
    const preset = await loadPresetBox();
    return { ...preset, view: new URLSearchParams(location.search).get('view') || 'projects' };
  }
  const drafts = import.meta.glob('../drafts/*.boxproj', { query: '?raw', import: 'default' });
  const load = drafts['../drafts/' + name];
  if (!load) throw new Error('找不到草稿：' + name);
  return { ...await projectStateOf(JSON.parse(await load()), 'three'), fold: 100 };
}

loadInitialBox().catch(e => { window.alert('工程加载失败：' + e.message); return null; }).then(preset => {
  if (preset && !debugScene) store.reset(preset);
  createRoot(document.getElementById('root')).render(<App />);
});
