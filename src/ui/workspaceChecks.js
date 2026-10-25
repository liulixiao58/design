import { geomOf, creaseSegsOf } from '../dieline/geom.js';
import { warnsOf, layerNameOf } from '../design/layers.js';
import { registrationWarnings } from '../design/registration.js';
import { productionIssues } from '../design/productionCheck.js';
import { productionReleaseIssues } from '../design/acceptance.js';
import { imageQualityLabel } from '../design/imageQuality.js';

export function workspaceChecks(state, material) {
  const geometry = geomOf(state, material.t);
  const creases = creaseSegsOf(geometry);
  const design = state.layers.flatMap(layer => warnsOf(layer, creases, geometry.sbb).map(message => `图层「${layerNameOf(layer)}」：${message}`));
  design.push(...registrationWarnings(state.layers));
  if (state.bleed < material.bleed) design.push(`出血 ${state.bleed} mm 小于材质建议 ${material.bleed} mm`);
  const release = productionReleaseIssues(state);
  const production = productionIssues(state.layers, { loaded: true, reconstruction: state.reconstruction });
  return {
    design: [...new Set(design)],
    production,
    release,
    assets: state.layers.filter(l => l.visible && l.kind === 'image').map(layer => ({ id: layer.id, name: layerNameOf(layer), quality: imageQualityLabel(layer), issues: production.filter(message => message.startsWith((layer.name || layer.id) + '：')) })),
    pending: release
  };
}
