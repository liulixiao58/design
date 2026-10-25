import test from 'node:test';
import assert from 'node:assert/strict';
import {bindRegistration,applyRegistration,registeredLayer,registrationWarnings} from '../src/design/registration.js';
import {moveMembers} from '../src/design/production.js';
const target={id:1,kind:'shape',finish:'none',panelId:'top',x:10,y:20,w:30,h:20,visible:true};
const mask={id:2,kind:'shape',finish:'foil',panelId:'top',x:12,y:23,w:20,h:10,visible:true};
const plate={...mask,registration:bindRegistration(mask,target)},base=[target,plate];
const close=(x,y)=>assert(Math.abs(x-y)<1e-7);

test('同源矢量替换后烫金与击凸轮廓同步，解除联动后保持独立',()=>{
  const source={...target,kind:'image',imgSrc:'old-vector',imgW:500,imgH:500};
  const plates=['foil','emboss'].map((finish,i)=>{const l={...source,id:i+2,finish};return {...l,registration:bindRegistration(l,source)};});
  assert(plates.every(l=>l.registration.syncContent));
  const before=[source,...plates],next=applyRegistration(before,[{...source,imgSrc:'new-vector',imgW:600},...plates]);
  assert(next.every(l=>l.imgSrc==='new-vector'&&l.imgW===600));
  const off=plates.map(l=>({...l,registration:{...l.registration,linked:false}}));
  assert.equal(applyRegistration([source,...off],[{...source,imgSrc:'new-vector'},...off])[1].imgSrc,'old-vector');
  assert.throws(()=>applyRegistration(before,[source,{...plates[0],imgSrc:'independent-edit'},plates[1]]),/母稿|同源/);
  assert.throws(()=>applyRegistration([source,{...plates[0],locked:true}],[{...source,imgSrc:'new-vector'},{...plates[0],locked:true}]),/锁定/);
});

test('同源UV文字改长短不改变字号，仍跟随母稿内容、位置和字体',()=>{
  const source={...target,kind:'text',content:'15袋',font:'Noto Sans SC',weight:400,size:3};
  const uv={...source,id:2,finish:'uv'};uv.registration=bindRegistration(uv,source);
  const next=applyRegistration([source,uv],[{...source,content:'速溶咖啡 · 15袋',x:14,font:'ZCOOL XiaoWei'},uv]);
  assert.equal(next[1].content,next[0].content);assert.equal(next[1].font,next[0].font);
  close(next[1].size,3);close(next[1].x,14);assert.deepEqual(registrationWarnings(next),[]);
});
test('印刷平移及等比缩放会带动关联版；版移动会带动目标且不累加两次',()=>{
  let next=applyRegistration(base,[{...target,x:15,y:18},plate]);close(next[1].x,17);close(next[1].y,21);
  next=applyRegistration(base,[target,{...plate,x:16,y:25}]);close(next[0].x,14);close(next[0].y,22);close(next[1].x,16);
  next=applyRegistration(base,[{...target,x:14,y:22},{...plate,x:16,y:25}]);close(next[0].x,14);close(next[1].x,16);
  next=applyRegistration(base,[{...target,w:60,h:40},plate]);close(next[1].w,40);close(next[1].h,20);assert.equal(registrationWarnings(next).length,0);
});
test('解锁可独立偏移，再套准不会反向移动印刷；基准保存在JSON中',()=>{
  const off={...plate,x:17,registration:{...plate.registration,linked:false}};
  let next=applyRegistration(base,[target,off]);close(next[0].x,10);close(next[1].x,17);assert(registrationWarnings(next).length);
  const snap={...registeredLayer(off,target),registration:{...off.registration,linked:true}};
  next=applyRegistration([target,off],[target,snap]);close(next[0].x,10);close(next[1].x,12);assert.equal(registrationWarnings(JSON.parse(JSON.stringify(next))).length,0);
});
test('锁定目标和锁定版不会被联动绕过，缺失目标不能通过生产检查',()=>{
  assert.throws(()=>applyRegistration([{...target,locked:true},plate],[{...target,locked:true},{...plate,x:13}]),/锁定/);
  assert.throws(()=>applyRegistration([target,{...plate,locked:true}],[{...target,x:12},{...plate,locked:true}]),/锁定/);
  assert(registrationWarnings([plate]).length);
  assert.throws(()=>bindRegistration(mask,{...target,panelId:'other'}),/同一盒面/);
});

test('从工艺版缩放和旋转会反向带动印刷目标，不能静默恢复原尺寸',()=>{
  const resized={...plate,w:40,h:20};
  const next=applyRegistration(base,[target,resized]);
  close(next[1].w,40);close(next[1].h,20);close(next[0].w,60);close(next[0].h,40);
  assert.equal(registrationWarnings(next).length,0);
  const rotated=applyRegistration(base,[target,{...plate,rot:30}]);
  close(rotated[1].rot,30);close(rotated[0].rot,30);
  assert.throws(()=>applyRegistration([{...target,locked:true},plate],[{...target,locked:true},resized]),/锁定/);
});

test('多张工艺版共同联动同一原图时，结果不能取决于数组顺序',()=>{
  const second={...mask,id:3,finish:'uv',x:15,registration:bindRegistration({...mask,id:3,x:15},target)};
  const layers=[target,plate,second];
  const same=layers.map(l=>l.id===1?l:{...l,x:l.x+5});
  const result=applyRegistration(layers,same);
  close(result[0].x,target.x+5);close(result[1].x,plate.x+5);close(result[2].x,second.x+5);
  const conflict=layers.map(l=>l.id===1?l:{...l,x:l.x+(l.id===2?5:8)});
  assert.throws(()=>applyRegistration(layers,conflict),/冲突/);
  assert.throws(()=>applyRegistration(layers.slice().reverse(),conflict.slice().reverse()),/冲突/);
  assert.deepEqual(JSON.parse(JSON.stringify(applyRegistration(layers,moveMembers(layers,[2,3],5,0)))),JSON.parse(JSON.stringify(result)));
});

test('原图和关联版被同时改成矛盾位置时拒绝修改，不静默覆盖其中一方',()=>{
  assert.throws(()=>applyRegistration(base,[{...target,x:20},{...plate,x:30}]),/冲突/);
});

test('原图或工艺版换盒面时联动统一归属，锁定和解锁规则仍有效',()=>{
  const fromTarget=applyRegistration(base,[{...target,panelId:'front'},plate]);
  assert(fromTarget.every(l=>l.panelId==='front'));assert.equal(registrationWarnings(fromTarget).length,0);
  const fromPlate=applyRegistration(base,[target,{...plate,panelId:'front'}]);
  assert(fromPlate.every(l=>l.panelId==='front'));
  assert.throws(()=>applyRegistration([{...target,locked:true},plate],[{...target,locked:true},{...plate,panelId:'front'}]),/锁定/);
  const unlocked={...plate,registration:{...plate.registration,linked:false}};
  const independent=applyRegistration([target,unlocked],[target,{...unlocked,panelId:'front'}]);
  assert.equal(independent[0].panelId,'top');assert.equal(independent[1].panelId,'front');
  const snapped=registeredLayer(independent[1],independent[0]);
  assert.equal(snapped.panelId,'top');close(snapped.x,plate.x);
});
