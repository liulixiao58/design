import test from 'node:test';
import assert from 'node:assert/strict';
import { imageBakeKey } from '../src/render3d/imageBakeKey.js';
test('相同长度的新图片和异步解码完成都必须触发3D重烘焙',()=>{
  const a={imgSrc:'image-A',img:{}},b={imgSrc:'image-B',img:{}};
  assert.equal(a.imgSrc.length,b.imgSrc.length);
  assert.notEqual(imageBakeKey(a),imageBakeKey(b));
  assert.equal(imageBakeKey(a),imageBakeKey(a));
  assert.notEqual(imageBakeKey({imgSrc:a.imgSrc}),imageBakeKey(a));
  assert.notEqual(imageBakeKey({...a,imgSrc:b.imgSrc}),imageBakeKey(a));
});
