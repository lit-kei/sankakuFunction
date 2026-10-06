import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('GitHub Pages の成果物に画面が参照するローカルモジュールをすべて含める',async()=>{
  const workflow=await readFile(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
  const pending=['app.js','account.js','battle.js','rankings.js'],seen=new Set();
  while(pending.length){
    const file=pending.pop();if(seen.has(file))continue;seen.add(file);
    const source=await readFile(new URL(file,import.meta.url),'utf8');
    for(const match of source.matchAll(/from\s+['"]\.\/(.+?\.js)['"]/g))pending.push(match[1]);
  }
  for(const file of seen)assert.match(workflow,new RegExp(`(?:^|\\s)${file.replaceAll('.','\\.')}(?:\\s|$)`),`${file} が Pages のコピー対象にありません`);
});
