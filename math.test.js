import test from 'node:test';import assert from 'node:assert/strict';import {angles,answer,values,radians,question,tex} from './math.js';
const numeric={'−√3':-Math.sqrt(3),'−1':-1,'−√3/2':-Math.sqrt(3)/2,'−√2/2':-Math.SQRT1_2,'−√3/3':-Math.sqrt(3)/3,'−1/2':-.5,'0':0,'1/2':.5,'√3/3':Math.sqrt(3)/3,'√2/2':Math.SQRT1_2,'√3/2':Math.sqrt(3)/2,'1':1,'√3':Math.sqrt(3)};
test('すべての有名角の厳密値を数値計算と比較',()=>{assert.equal(angles[0],-900);assert.equal(angles.at(-1),900);for(const deg of angles)for(const fn of ['sin','cos','tan']){const value=answer(fn,deg);if(fn==='tan'&&Math.abs(deg%180)===90){assert.equal(value,null);continue;}assert.ok(values.includes(value));assert.ok(Math.abs(numeric[value]-Math[fn](deg*Math.PI/180))<1e-12,`${fn} ${deg}`);}});
test('弧度法の約分と負角',()=>{assert.equal(radians(-900),'−5π');assert.equal(radians(45),'π/4');assert.equal(radians(-30),'−π/6');assert.equal(radians(0),'0');assert.equal(radians(270),'3π/2');});
test('ランダム問題には必ず選択可能な正答がある',()=>{for(let i=0;i<10000;i++){const q=question();assert.ok(angles.includes(q.deg));assert.ok(values.includes(q.value));assert.equal(q.value,answer(q.fn,q.deg));}});

test('MathJax用の分数・ルート・角度表記',()=>{assert.equal(tex('−√3/2'),String.raw`-\frac{\sqrt{3}}{2}`);assert.equal(tex('3π/4'),String.raw`\frac{3\pi}{4}`);assert.equal(tex('−45°'),String.raw`-45^{\circ}`);});
