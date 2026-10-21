// 展开图坐标：毫米、X 向右、Y 向下；印刷与工艺版共用同一页面原点。
export function pageBoxes(s, g) {
  const b = s.bleed;
  const ox = g.sbb[0] - b, oy = g.sbb[1] - b;
  const Wmm = g.sbb[2] - g.sbb[0] + 2 * b, Hmm = g.sbb[3] - g.sbb[1] + 2 * b;
  const k = 72 / 25.4, Wpt = Wmm * k, Hpt = Hmm * k;
  const trim = [b * k, b * k, Wpt - b * k, Hpt - b * k].map(v => v.toFixed(6)).join(' ');
  const trimRect = [b * k, b * k, Wpt - 2 * b * k, Hpt - 2 * b * k].map(v => v.toFixed(6)).join(' ');
  const PX = v => ((v - ox) * k).toFixed(6);
  const PY = v => (Hpt - (v - oy) * k).toFixed(6);
  return { b, ox, oy, Wmm, Hmm, k, Wpt, Hpt, trim, trimRect, PX, PY };
}

export function rasterFrame(boxes, S) {
  const W = Math.ceil(boxes.Wmm * S), H = Math.ceil(boxes.Hmm * S);
  // 像素取整只补页面边缘，不将图稿拉伸回页面宽高；每像素始终对应 1/S 毫米。
  const matrix = [W / S * boxes.k, 0, 0, H / S * boxes.k, 0, boxes.Hpt - H / S * boxes.k]
    .map(v => v.toFixed(6)).join(' ');
  return { W, H, matrix };
}
