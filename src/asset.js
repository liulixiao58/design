// 站点资源路径：兼容 GitHub Pages 子路径部署（由 vite base 注入）。
// p 约定为以 / 开头的站点绝对路径（/brand/…、/hdri/…、/textures/…、/preset/…）；
// 开发（base=/）与 Pages 构建自动带前缀。
export const asset = p => import.meta.env.BASE_URL.replace(/\/$/, '') + p;
