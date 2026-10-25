import { productionIssues } from '../design/productionCheck.js';
import { productionReleaseIssues } from '../design/acceptance.js';

export function createDeliveryTask(exportFile) {
  let busy = false;
  return {
    get busy() { return busy; },
    async run(mode, state, material) {
      if (busy) throw new Error('已有文件正在生成，请稍候。');
      busy = true;
      try {
        if (mode !== 'rgb') {
          const issues = productionIssues(state.layers, { loaded: true, reconstruction: state.reconstruction }).concat(mode === 'proof' ? [] : productionReleaseIssues(state));
          if (issues.length) throw new Error('生产导出被阻止：' + issues.join('；'));
        }
        return await exportFile(state, material, mode);
      } finally { busy = false; }
    }
  };
}
