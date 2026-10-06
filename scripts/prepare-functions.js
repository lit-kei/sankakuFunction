import {mkdir,copyFile} from 'node:fs/promises';
const source=new URL('../',import.meta.url),target=new URL('../functions/shared/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of ['math.js','battle-engine.js','account-model.js','rating-model.js','profile-model.js','rematch-model.js'])await copyFile(new URL(file,source),new URL(file,target));
console.log('Prepared shared functions source.');
