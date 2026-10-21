import { embDirOf } from './emboss.js';
import { validateRegistration } from './registration.js';

export const FACTORIES = [
  { id:'print', name:'印刷组' },
  { id:'metal', name:'锌板工艺组' },
  { id:'film', name:'菲林工艺组' }
];
export const PROCESS_NAMES = { none:'印刷版', foil:'烫金版', silver:'烫银版', 'emboss-up':'击凸版', 'emboss-down':'击凹版', holo:'镭射版', uv:'UV版', gloss:'亮面版', screen:'丝印版', frost:'磨砂版', coldfoil:'冷烫版' };
export const PENDING_FINISHES = ['screen','frost','coldfoil'];
export const processOf = (l, fallback='up') => l.finish==='emboss' ? 'emboss-'+embDirOf(l,fallback) : l.finish || 'none';
export const factoryOf = l => l.finish==='none'||!l.finish ? 'print' : ['metal','film'].includes(l.factoryId) ? l.factoryId : ['uv','gloss',...PENDING_FINISHES].includes(l.finish) ? 'film' : 'metal';
export const plateIdOf = l => l.plateId || 'default';

export function productionGroups(layers, fallback='up') {
  return FACTORIES.map(factory=>{
    const members=layers.filter(l=>factoryOf(l)===factory.id), plates=[];
    for(const l of members){
      const process=processOf(l,fallback), id=plateIdOf(l);
      let plate=plates.find(p=>p.id===id&&p.process===process);
      if(!plate){plate={id,process,name:l.plateName||PROCESS_NAMES[process]||process,layers:[]};plates.push(plate);}
      plate.layers.push(l);
    }
    return {...factory,layers:members,plates};
  });
}

export function updateMembers(layers, ids, patch) {
  const chosen=new Set(ids);
  return layers.map(l=>chosen.has(l.id)?{...l,...patch}:l);
}

export function moveMembers(layers, ids, dx, dy) {
  const chosen=new Set(ids), members=layers.filter(l=>chosen.has(l.id));
  if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new Error('位移必须是有效的毫米数值。');
  if(members.some(l=>l.locked))throw new Error('组内有锁定素材，请先解锁后整体移动。');
  if(members.some(l=>Math.abs(l.x+dx)>10000||Math.abs(l.y+dy)>10000))throw new Error('移动后坐标超出工程范围。');
  return layers.map(l=>chosen.has(l.id)?{...l,x:l.x+dx,y:l.y+dy,heroPreset:undefined}:l);
}

export function validateProduction(layers) {
  validateRegistration(layers);
  for(const l of layers){
    if(l.factoryId!=null&&!['print','metal','film'].includes(l.factoryId))throw new Error('工厂分组无效。');
    for(const key of ['plateId','plateName'])if(l[key]!=null&&(typeof l[key]!=='string'||!l[key].trim()||l[key].length>80))throw new Error('工艺版编号或名称无效。');
  }
}
