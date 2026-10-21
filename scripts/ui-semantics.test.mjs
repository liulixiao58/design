import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// 仅验证输出标记；不把服务端渲染当成浏览器键盘或视觉验收。
const bundled = await build({
  stdin: {
    contents: "export { ActionMenu } from './src/ui/ActionMenu.jsx'; export { Toggle, NumField } from './src/ui/widgets.jsx'; export { CheckDetails } from './src/ui/CheckDetails.jsx';",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx'
  },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { ActionMenu, Toggle, NumField, CheckDetails } = module.exports;
const render = (component, props, children) => renderToStaticMarkup(React.createElement(component, props, children));

test('开关使用有名称和状态的原生按钮，数值输入关联可见标签', () => {
  const toggle = render(Toggle, { on: true, label: '显示安全区', onClick() {} });
  assert.match(toggle, /<button[^>]*role="switch"[^>]*aria-checked="true"[^>]*aria-label="显示安全区"/);
  const field = render(NumField, { label: '出血 mm', value: 3, onChange() {} });
  assert.match(field, /<label[^>]*><span[^>]*>出血 mm<\/span><input/);
});

test('动作入口是默认关闭的原生 disclosure，不冒充 ARIA 菜单', () => {
  const menu = render(ActionMenu, { label: '交付' }, React.createElement('button', { disabled: true }, '生产文件包'));
  assert.match(menu, /^<details[^>]*><summary>交付<\/summary>/);
  assert.doesNotMatch(menu, /role="menu"|<details[^>]*\bopen(?:=|\s|>)/);
  assert.match(menu, /<button disabled="">生产文件包/);
});

test('零警示时仍输出待人工确认，不宣称结构全部通过', () => {
  const markup = render(CheckDetails, { checks: { design: [], production: [], pending: ['外轮廓闭合'] } });
  assert.match(markup, /待人工确认/);
  assert.match(markup, /外轮廓闭合/);
  assert.doesNotMatch(markup, /全部通过|校验通过/);
});
