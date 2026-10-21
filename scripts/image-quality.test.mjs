import test from 'node:test';
import assert from 'node:assert/strict';
import { imageQualityOf, imageTypeOf, restoreImageAspect, resizeImage } from '../src/design/imageQuality.js';
import { warnsOf } from '../src/design/layers.js';
const photo = { kind:'image', panelId:'test', imgSrc:'data:image/png;base64,AA==', imgW:1200, imgH:600, w:100, h:100, x:10, y:20, pxw:999999 };
const close=(x,y)=>assert(Math.abs(x-y)<1e-8);

test('纯矢量不能绕过非法裁剪检查',()=>{
  const imgSrc='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"/></svg>').toString('base64');
  const vector={...photo,imgSrc};
  assert.equal(imageQualityOf(vector).pass,true);
  for(const crop of [[-1,0,1,1],[0,0,2,1],[0,0,0,1],[0,0,1],['0',0,1,1]])assert.equal(imageQualityOf({...vector,crop}).pass,false);
});

test('宽合格但高不合格必须报警，不能用pxw伪装精度',()=>{
  const q=imageQualityOf(photo);
  close(q.x,304.8);close(q.y,152.4);assert.equal(q.pass,false);
  assert(warnsOf(photo,[],[0,0,500,500]).some(w=>w.includes('纵 152.40')));
  assert(warnsOf(photo,[],[0,0,500,500]).some(w=>w.includes('可能被拉伸')));
});
test('实际加载尺寸优先；300本身和取整后300均不能通过大于300的门槛',()=>{
  const l={...photo,w:25.4,h:25.4,imgW:999999,imgH:999999,img:{naturalWidth:300,naturalHeight:301}};
  assert.equal(imageQualityOf(l).pass,false);
  assert.equal(imageQualityOf({...l,w:25.401}).pass,false);
  assert.equal(imageQualityOf({...l,img:{naturalWidth:301,naturalHeight:301}}).pass,true);
});
test('裁剪精度按保留下来的像素数计算；非法裁剪不通过',()=>{
  const l={...photo,w:50,h:25,crop:[.25,.25,.5,.5]};
  close(imageQualityOf(l).min,304.8);
  assert.equal(imageQualityOf(l).pass,true);
  assert.equal(imageQualityOf({...l,crop:[.9,0,.5,1]}).pass,false);
});
test('识别纯矢量SVG，不将含位图或引用的SVG整体放行',()=>{
  const svg=xml=>({...photo,imgSrc:'data:image/svg+xml;base64,'+btoa(xml)});
  const l=svg('<svg><path d="M0 0H100"/></svg>');
  assert.equal(imageTypeOf(l),'vector');assert.equal(imageQualityOf(l).pass,true);
  assert(!warnsOf(l,[],[0,0,500,500]).some(w=>w.includes('PPI')));
  for(const content of ['<image href="x.png"/>','<use href="x.svg#p"/>','<filter/>']){
    const mixed=svg('<svg>'+content+'</svg>');
    assert.equal(imageTypeOf(mixed),'mixed');assert.equal(imageQualityOf(mixed).pass,false);
  }
});
test('恢复原图比例不拉伸、不超过旧框，居中放置；数值宽高默认联动，可解锁',()=>{
  const p=restoreImageAspect(photo);
  close(p.w/p.h,2);close(p.x+p.w/2,60);close(p.y+p.h/2,70);
  assert(p.w<=photo.w&&p.h<=photo.h);
  const l={...photo,...p};const changed=resizeImage(l,'w',80);
  close(changed.w/changed.h,2);
  assert.deepEqual(resizeImage({...l,aspectLocked:false},'w',80),{w:80});
  close(restoreImageAspect({...photo,crop:[0,0,.5,1]}).w/restoreImageAspect({...photo,crop:[0,0,.5,1]}).h,1);
});
