// 定位点统一使用毫米坐标；只允许刚体变换，不用外框、像素或覆盖率推测套准。
export function fitSourceRegistration(points, toleranceMm = 0.01) {
  if (!Array.isArray(points) || points.length < 3 || points.length > 32 || !Number.isFinite(toleranceMm) || toleranceMm <= 0 || toleranceMm > 0.01 ||
      points.some(p => !p || ![p.source, p.target].every(a => Array.isArray(a) && a.length === 2 && a.every(Number.isFinite)))) {
    throw new Error('至少需要三组有效的源稿/盒面定位点（毫米）。');
  }
  const mean = key => [0, 1].map(k => points.reduce((s, p) => s + p[key][k], 0) / points.length);
  const a = mean('source'), b = mean('target');
  const first = points[0].source;
  if (!points.some(p => points.some(q => Math.abs((p.source[0] - first[0]) * (q.source[1] - first[1]) - (p.source[1] - first[1]) * (q.source[0] - first[0])) > 1e-6))) throw new Error('三个定位点不能共线，请选取不同方向的定位点。');
  let dot = 0, cross = 0, spread = 0;
  for (const p of points) {
    const x = p.source[0] - a[0], y = p.source[1] - a[1], u = p.target[0] - b[0], v = p.target[1] - b[1];
    dot += x * u + y * v; cross += x * v - y * u; spread += x * x + y * y;
  }
  if (spread < 1e-8) throw new Error('定位点不能重合。');
  const angle = Math.atan2(cross, dot), c = Math.cos(angle), s = Math.sin(angle);
  const translationMm = [b[0] - c * a[0] + s * a[1], b[1] - s * a[0] - c * a[1]];
  const map = ([x, y]) => [c * x - s * y + translationMm[0], s * x + c * y + translationMm[1]];
  const residualMm = Math.max(...points.map(p => Math.hypot(...map(p.source).map((v, i) => v - p.target[i]))));
  if (residualMm > toleranceMm) throw new Error('定位点不能在原尺寸下同时契合，请核对点位；系统不会拉伸图案凑齐。');
  return { rotationDegrees: angle * 180 / Math.PI, translationMm, residualMm };
}

export function sourcePlacement(bboxMm, mapping) {
  if (!Array.isArray(bboxMm) || bboxMm.length !== 4 || !bboxMm.every(Number.isFinite) || bboxMm[2] <= 0 || bboxMm[3] <= 0) throw new Error('源稿毫米范围无效。');
  const [x, y, w, h] = bboxMm, a = mapping.rotationDegrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const cx = x + w / 2, cy = y + h / 2;
  return { x: c * cx - s * cy + mapping.translationMm[0] - w / 2, y: s * cx + c * cy + mapping.translationMm[1] - h / 2, w, h, rot: mapping.rotationDegrees };
}

export function placeBySourcePoints(layer, points, toleranceMm = 0.01) {
  if (layer.crop && layer.crop.some((v, i) => Math.abs(v - [0, 0, 1, 1][i]) > 1e-7)) throw new Error('请先恢复完整源稿，再按原稿定位点套准，避免把裁切内容拉伸。');
  const mapping = fitSourceRegistration(points, toleranceMm);
  return { ...layer, ...sourcePlacement(layer.sourceBboxMm, mapping), heroPreset: undefined, registration: undefined,
    sourceRegistration: { coordinateSystem: 'pdf-top-left-mm', points: structuredClone(points), toleranceMm, ...mapping } };
}

export function sourceRegistrationWarnings(layers) {
  const warnings = [];
  for (const l of layers.filter(l => l.visible)) {
    const r = l.sourceRegistration;
    if (!r) {
      if (Array.isArray(l.sourceTranslationMm) && l.sourceTranslationMm.some(v => Math.abs(v) > 1e-7)) warnings.push(`${l.name || l.id}：源版位移尚未按角线／刀线定位点校准，不能以外框或覆盖率认定套准`);
      continue;
    }
    try {
      if (r.coordinateSystem !== 'pdf-top-left-mm') throw new Error('源稿定位坐标系无效');
      const expected = sourcePlacement(l.sourceBboxMm, fitSourceRegistration(r.points, r.toleranceMm));
      // 已有关联时检查关联的初始版位；后续共同移动/缩放仍由原有套准联动处理。
      const actual = l.registration ? l.registration.plate : l;
      if (['x', 'y', 'w', 'h', 'rot'].some(k => Math.abs((actual[k] || 0) - expected[k]) > 1e-6)) warnings.push(`${l.name || l.id}：已偏离源稿定位点基准，请重新套准或更新真实定位点`);
    } catch (e) { warnings.push(`${l.name || l.id}：${e.message}`); }
  }
  return warnings;
}
