import { geomOf, creaseSegsOf } from '../dieline/geom.js';
import { warnsOf, layerNameOf } from '../design/layers.js';
import { registrationWarnings } from '../design/registration.js';
import { productionIssues } from '../design/productionCheck.js';

export function workspaceChecks(state, material) {
  const geometry = geomOf(state, material.t);
  const creases = creaseSegsOf(geometry);
  const design = state.layers.flatMap(layer => warnsOf(layer, creases, geometry.sbb).map(message => `图层「${layerNameOf(layer)}」：${message}`));
  design.push(...registrationWarnings(state.layers));
  if (state.bleed < material.bleed) design.push(`出血 ${state.bleed} mm 小于材质建议 ${material.bleed} mm`);
  return {
    design: [...new Set(design)],
    production: productionIssues(state.layers, { loaded: true, reconstruction: state.reconstruction }),
    pending: ['外轮廓闭合', '无自交 / 孤立线段', '最小刀距 ≥ 1.5 mm', '压痕两侧连接关系']
  };
}
