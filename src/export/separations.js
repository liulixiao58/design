// 兼容旧入口，统一使用逐版生产文件包。
export async function exportSeparations(s,mat){
  return (await import('./productionBundle.js')).exportProductionBundle(s,mat);
}
