import test from 'node:test';
import assert from 'node:assert/strict';
import { cropResize } from '../src/design/layers.js';

const close = (a,b) => assert(Math.abs(a-b)<1e-7, `${a} != ${b}`);
const layer = {kind:'image',x:10,y:20,w:60,h:40,crop:[.2,.2,.6,.4]};
test('八方向裁切保留对边与源像素尺度，已裁过的图片可再次裁切和向外恢复',()=>{
  for(const rot of [0,30,90,-45])for(const mode of ['n','ne','e','se','s','sw','w','nw'])for(const delta of [-10,10,1000,-1000]){
    const source={...layer,rot},p=cropResize(source,mode,delta,delta);
    const [u,v,w,h]=p.crop;
    assert(u>=0&&v>=0&&u+w<=1+1e-9&&v+h<=1+1e-9&&w>0&&h>0);
    close(p.w/w,100);close(p.h/h,100);
    if(mode.includes('w'))close(u+w,.8);else if(mode.includes('e'))close(u,.2);
    if(mode.includes('n'))close(v+h,.6);else if(mode.includes('s'))close(v,.2);
    // 同一个源像素在旋转后的世界坐标中保持不动。
    const world=(l,cr)=>{
      const dx=(.5-cr[0]-cr[2]/2)*100,dy=(.4-cr[1]-cr[3]/2)*100,a=rot*Math.PI/180;
      return [l.x+l.w/2+dx*Math.cos(a)-dy*Math.sin(a),l.y+l.h/2+dx*Math.sin(a)+dy*Math.cos(a)];
    };
    world(source,source.crop).forEach((value,i)=>close(value,world(p,p.crop)[i]));
  }
  close(cropResize(layer,'w',10,0).w,50);
  close(cropResize(layer,'n',0,10).h,30);
});
