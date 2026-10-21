// 与预览使用同一字体文件；只放行已接入的字重，不做静默替换。
export const productionFonts = {
  'Noto Sans SC': {400:'NotoSansSC-400.ttf',700:'NotoSansSC-700.ttf'},
  'Libre Baskerville': {700:'LibreBaskerville-Bold.ttf'},
  'ZCOOL XiaoWei': {400:'ZCOOLXiaoWei-Regular.ttf'}
};
export const productionFontFile = l => productionFonts[l.font || 'Noto Sans SC']?.[l.weight || 400];
