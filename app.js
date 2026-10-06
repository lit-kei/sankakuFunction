import {question,values,answer,radians,tex} from './math.js';
const $=id=>document.getElementById(id);let unit='rad',current,selected=null,done=false,count=0,last='';
function math(label, source=tex(label)){return `<span class="math" data-tex="${source}" aria-label="${label}">${label}</span>`;}
let mathQueue=Promise.resolve();
function typeset(){
 const mj=window.MathJax;
 if(!mj?.startup?.promise||!mj.tex2chtmlPromise)return;
 mathQueue=mathQueue.then(async()=>{
  await mj.startup.promise;
  for(const node of document.querySelectorAll('[data-tex]')){
   if(node.dataset.rendered===node.dataset.tex)continue;
   const source=node.dataset.tex;
   const output=await mj.tex2chtmlPromise(source,{display:false});
   if(node.isConnected&&node.dataset.tex===source){node.replaceChildren(output);node.dataset.rendered=source;}
  }
 }).catch(()=>{});
}
window.addEventListener('mathjax-ready',typeset);
function animateQuestion(){const card=$('formula');card.classList.remove('question-enter');void card.offsetWidth;card.classList.add('question-enter');}
function angle(deg){return unit==='rad'?radians(deg):`${deg<0?'−':''}${Math.abs(deg)}°`;}
function renderFormula(){$('formula').innerHTML=math(`${current.fn} (${angle(current.deg)}) = ?`, String.raw`\${current.fn}\left(${tex(angle(current.deg))}\right) = \ ?`);$('range').textContent=unit==='rad'?'−5π 〜 5π':'−900° 〜 900°';if(done)draw();typeset();}
for(const u of ['rad','deg'])$(u).onclick=()=>{unit=u;for(const v of ['rad','deg']){$(v).classList.toggle('active',v===u);$(v).setAttribute('aria-pressed',String(v===u));}renderFormula();animateQuestion();};
function next(){do{current=question();}while(`${current.fn}:${current.deg}`===last);last=`${current.fn}:${current.deg}`;count++;selected=null;done=false;$('progress').textContent=`${String(count).padStart(2,'0')} 問目`;$('feedback').textContent='';$('check').hidden=false;$('check').disabled=true;$('next').hidden=true;$('empty').hidden=false;$('reveal').hidden=true;$('answers').replaceChildren();for(const value of values){const b=document.createElement('button');b.dataset.value=value;b.innerHTML=math(value);b.setAttribute('aria-label',value);b.setAttribute('aria-pressed','false');b.onclick=()=>{selected=value;for(const button of $('answers').children){button.classList.toggle('selected',button===b);button.setAttribute('aria-pressed',String(button===b));}$('check').disabled=false;};$('answers').append(b);}renderFormula();animateQuestion();}
$('check').onclick=()=>{if(selected===null||done)return;done=true;const ok=selected===current.value;$('feedback').className=ok?'feedback-good':'feedback-bad';$('feedback').innerHTML=ok?'✓ 正解！単位円でも確かめてみましょう。':`もう一歩！ 正しい答えは ${math(current.value)} です。`;for(const b of $('answers').children){b.disabled=true;if(b.dataset.value===current.value)b.classList.add('correct');else if(b.dataset.value===selected)b.classList.add('wrong');}$('check').hidden=true;$('next').hidden=false;$('empty').hidden=true;$('reveal').hidden=false;draw();};
$('next').onclick=next;
function draw(){const norm=((current.deg%360)+360)%360,theta=norm*Math.PI/180,x=Math.cos(theta),y=Math.sin(theta),cx=200,cy=177,r=128,px=cx+x*r,py=cy-y*r;const sx=answer('cos',current.deg),sy=answer('sin',current.deg);const end=Math.min(norm,359.999)*Math.PI/180,ex=cx+34*Math.cos(end),ey=cy-34*Math.sin(end);
$('circle').innerHTML=`<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#a7b5a1"/></marker></defs><circle cx="200" cy="177" r="128" fill="#fafcf7" stroke="#c6d4be" stroke-width="1.5"/><path d="M35 177H367 M200 333V20" stroke="#b6c3b0" marker-end="url(#arrow)"/><text x="372" y="182">x</text><text x="210" y="24">y</text><text x="331" y="194">1</text><text x="59" y="194">−1</text><text x="209" y="52">1</text><text x="208" y="315">−1</text><text x="185" y="194">O</text><path d="M200 177 L${px} 177 L${px} ${py} Z" fill="#e7efdf" opacity=".7"/><line x1="200" y1="177" x2="${px}" y2="177" stroke="#557f63" stroke-width="3"/><line x1="${px}" y1="177" x2="${px}" y2="${py}" stroke="#d19a64" stroke-width="3"/><line x1="${px}" y1="${py}" x2="200" y2="${py}" stroke="#d19a64" stroke-dasharray="4 4" opacity=".6"/><line class="radius-line" pathLength="1" x1="200" y1="177" x2="${px}" y2="${py}" stroke="#456c50" stroke-width="2"/>${norm?`<path d="M234 177 A34 34 0 ${norm>180?1:0} 0 ${ex} ${ey}" fill="none" stroke="#9aae80" stroke-width="2"/>`:''}<circle class="point-marker" style="transform-origin:${px}px ${py}px" cx="${px}" cy="${py}" r="6" fill="#355f46" stroke="white" stroke-width="2"/><text x="${Math.max(30,Math.min(350,px+12))}" y="${py<70?py+22:py-12}" style="fill:#355f46;font-weight:700">P</text>`;
$('circle').setAttribute('aria-label',`角度 ${angle(current.deg)} の単位円。点 P の x 座標は ${sx}、y 座標は ${sy}。`);$('coordinates').innerHTML=math(`P = (${sx}, ${sy})`,String.raw`P=\left(${tex(sx)},\;${tex(sy)}\right)`);
let explanation=`<strong>${math(angle(current.deg))} → ${math(angle(norm))}</strong><br>1 周の範囲で見ると、この点 P に重なります。<br>`;
if(current.fn==='tan')explanation+=math(`tan θ = (${sy}) / (${sx}) = ${current.value}`,String.raw`\tan\theta=\frac{${tex(sy)}}{${tex(sx)}}=${tex(current.value)}`);else explanation+=`${current.fn} θ は ${current.fn==='cos'?'x 座標（緑）':'y 座標（オレンジ）'}。<br>だから ${math(`${current.fn} θ = ${current.value}`,String.raw`\${current.fn}\theta=${tex(current.value)}`)}`;
$('explanation').innerHTML=explanation;typeset();}
next();
