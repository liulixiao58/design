// 工作台闭合附件默认规则，非ECMA制版标准；毫米级避让与板件深度分别计算。
export function closureOf(s, t) {
  const {L,W,H}=s, gap=Math.max(1.5,2*t), opening=s.tpl==='cyl'?L:Math.min(L,W);
  const tuckBox=s.tpl==='rte'||s.tpl==='ste';
  const receiving=s.tpl==='drawer'?H:s.tpl==='cyl'?L:W;
  const glue=Math.min(Math.max(s.glue??12,opening*.04,6*t),Math.max(.5,receiving-gap));
  if(tuckBox) return {
    gap,glue,
    tuck:Math.max(.5,Math.min(Math.max(16,opening*.12,6*t),W*.55,(H-gap)/2)),
    dust:Math.max(.5,Math.min(W*.75,(L-gap)/2))
  };
  if(s.tpl==='mailer') return {
    gap,glue:0,
    tuck:Math.max(.5,Math.min(H*.7,Math.max(28,opening*.1,6*t),W-gap)),
    dust:Math.max(.5,Math.min(H*.8,Math.max(26,opening*.08,6*t),L/2-gap))
  };
  return {gap,glue:['drawer','cyl','hex'].includes(s.tpl)?glue:0,tuck:0,dust:0};
}

// 局部坐标：折线沿x轴，附件向+y生长；2D与3D使用相同的离散轮廓。
export function closureOutline(kind, width, depth, t) {
  if(kind==='glue') {
    const bevel=Math.min(Math.max(5,2*t),width/4);
    return [[0,0],[width,0],[width-bevel,depth],[bevel,depth]];
  }
  const inset=Math.min(Math.max(kind==='dust'?1.5:5,2*t),width*.12);
  if(kind==='dust') {
    const bevel=Math.min(Math.max(5,2*t),depth*.3), shoulder=Math.min(9,width*.2);
    return [[inset,0],[Math.min(3.5+Math.max(0,t-.5),shoulder),depth-bevel],[shoulder,depth],
      [width-shoulder,depth],[width-Math.min(3.5+Math.max(0,t-.5),shoulder),bevel],[width-inset,0]];
  }
  const radius=Math.min(3.5,depth*.3,(width-2*inset)/4), shoulder=Math.min(2.5,depth*.2);
  const points=[[0,0],[inset,shoulder],[inset,depth-radius]];
  const curve=(p0,pc,p1)=>{
    return Array.from({length:5},(_,i)=>{const u=(i+1)/5;return p0.map((v,j)=>v*(1-u)**2+pc[j]*2*u*(1-u)+p1[j]*u*u);});
  };
  points.push(...curve([inset,depth-radius],[inset,depth],[inset+radius,depth]));
  points.push([width-inset-radius,depth]);
  points.push(...curve([width-inset-radius,depth],[width-inset,depth],[width-inset,depth-radius]));
  return points.concat([[width-inset,shoulder],[width,0]]);
}
