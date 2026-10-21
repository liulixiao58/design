import test from 'node:test';
import assert from 'node:assert/strict';
import { geomOf } from '../src/dieline/geom.js';
import { pageBoxes, rasterFrame } from '../src/export/coordinates.js';

const close = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
for (const tpl of ['rte', 'ste', 'mailer', 'lidbase', 'drawer', 'cyl', 'hex']) {
  test(`${tpl}: 毫米、PDF点与印刷/工艺像素坐标使用同一基准`, () => {
    const s = { tpl, L: 120.37, W: 80.23, H: 30.19, bleed: 3, glue: 14 };
    const g = geomOf(s, .5), b = pageBoxes(s, g);
    close(+b.PX(g.sbb[0]) / b.k, 3);
    close((b.Hpt - +b.PY(g.sbb[1])) / b.k, 3);
    close((+b.PX(g.sbb[0] + 100) - +b.PX(g.sbb[0])) / b.k, 100);
    const f = rasterFrame(b, 300 / 25.4), m = f.matrix.split(' ').map(Number);
    // 从实际 PDF 图像放置矩阵反算：像素中心必须回到同一毫米坐标。
    const x = g.sbb[0] + 7.31, y = g.sbb[1] + 12.43;
    const rx = (x - b.ox) * 300 / 25.4, ry = (y - b.oy) * 300 / 25.4;
    close(rx / f.W * m[0], +b.PX(x));
    close(m[5] + (1 - ry / f.H) * m[3], +b.PY(y));
    // 旧导出把取整画布铺满页面，100mm 会被缩放；此处应始终为100mm。
    close(100 * 300 / 25.4 / f.W * m[0] / b.k, 100);
  });
}

test('非零/负数刀版原点和出血只改变位置，不改变尺寸', () => {
  const b = pageBoxes({ bleed: 4.17 }, { sbb: [-20.3, 8.17, 200.24, 181.29] });
  close(+b.PX(-20.3) / b.k, 4.17);
  close((+b.PY(8.17) - +b.PY(108.17)) / b.k, 100);
  const f = rasterFrame(b, 8);
  assert(f.W / 8 >= b.Wmm && f.H / 8 >= b.Hmm);
});
