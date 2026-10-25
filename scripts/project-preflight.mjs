import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { imageSize } from 'image-size';
import { validateProject } from '../src/proposal/schema.js';
import { imageTypeOf } from '../src/design/imageQuality.js';
import { productionIssues } from '../src/design/productionCheck.js';
import { productionReleaseIssues } from '../src/design/acceptance.js';
export function inspectProjectSources(project){
  const doc=structuredClone(project);validateProject(doc);
  for(const l of doc.design.layers.filter(l=>l.kind==='image'&&imageTypeOf(l)==='raster')){
    const size=imageSize(Buffer.from(l.imgSrc.split(',')[1],'base64'));l.imgW=size.width;l.imgH=size.height;
  }
  const state = { ...doc.box, ...doc.appearance?.material, displayPose3d:doc.scene?.displayPose||'flat', layers: doc.design.layers, workflow: doc.meta.workflow, fx: doc.appearance?.fx, embDir: doc.appearance?.embDir };
  return {project:doc,issues:productionIssues(doc.design.layers,{reconstruction:doc.meta.reconstruction}),releaseIssues:productionReleaseIssues(state)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const {project,issues,releaseIssues}=inspectProjectSources(JSON.parse(await fs.readFile(process.argv[2],'utf8')));console.log(JSON.stringify({name:project.meta.name,issues,releaseIssues,productionReady:issues.length===0&&releaseIssues.length===0},null,2));if((issues.length||releaseIssues.length)&&process.argv.includes('--production'))process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
}
