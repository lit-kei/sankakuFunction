export const angles=Array.from({length:61},(_,i)=>(i-30)*30).concat(Array.from({length:41},(_,i)=>(i-20)*45)).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
export const values=['−√3','−1','−√3/2','−√2/2','−√3/3','−1/2','0','1/2','√3/3','√2/2','√3/2','1','√3'];
const sin=['0','1/2','√3/2','1','√3/2','1/2','0','−1/2','−√3/2','−1','−√3/2','−1/2'];
const sin45=['0','√2/2','1','√2/2','0','−√2/2','−1','−√2/2'];
export function answer(fn,deg){
 const a=((deg%360)+360)%360;
 if(fn==='tan'){
  if(a%180===90)return null;
  const t=a%180;
  return ({0:'0',30:'√3/3',45:'1',60:'√3',120:'−√3',135:'−1',150:'−√3/3'})[t];
 }
 const b=fn==='cos'?(a+90)%360:a;
 return b%30===0?sin[b/30]:sin45[b/45];
}
function gcd(a,b){return b?gcd(b,a%b):a;}
export function radians(deg){if(deg===0)return '0';const g=gcd(Math.abs(deg),180),n=deg/g,d=180/g;return `${n<0?'−':''}${Math.abs(n)===1?'':Math.abs(n)}π${d===1?'':`/${d}`}`;}
export function question(random=Math.random){const fn=['sin','cos','tan'][Math.floor(random()*3)];const pool=angles.filter(a=>answer(fn,a)!==null);const deg=pool[Math.floor(random()*pool.length)];return {fn,deg,value:answer(fn,deg)};}

// Convert our finite set of exact values and angles into MathJax TeX.
export function tex(value){
 const text=String(value).replaceAll('−','-');
 const negative=text.startsWith('-'),unsigned=negative?text.slice(1):text;
 const parts=unsigned.split('/');
 const numerator=parts[0].replace(/√(\d+)/g, String.raw`\sqrt{$1}`).replaceAll('π',String.raw`\pi`).replaceAll('°',String.raw`^{\circ}`);
 return (negative?'-':'')+(parts.length===2?String.raw`\frac{${numerator}}{${parts[1]}}`:numerator);
}

export function formulaTex(fn, angle){
 if(!['sin','cos','tan'].includes(fn))throw new Error('Unknown trigonometric function');
 return String.raw`\operatorname{${fn}}\left(${tex(angle)}\right) = \ ?`;
}
