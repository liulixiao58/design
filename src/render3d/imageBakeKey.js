const revisions = new WeakMap();
let sequence = 0;
export function imageBakeKey(layer) {
  if (!layer.img) return layer.imgSrc || '';
  let revision = revisions.get(layer.img);
  if (!revision || revision.src !== layer.imgSrc) {
    revision = { src: layer.imgSrc, id: ++sequence };
    revisions.set(layer.img, revision);
  }
  return revision.id;
}
