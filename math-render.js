import {tex} from './math.js';

export function math(label, source=tex(label)) {
  return `<span class="math" role="img" data-tex="${source}" aria-label="${label}">${label}</span>`;
}
let queue=Promise.resolve();
export function typeset() {
  const mj=window.MathJax;
  if (!mj?.startup?.promise || !mj.tex2svgPromise) return;
  queue=queue.then(async()=>{
    await mj.startup.promise;
    for (const node of document.querySelectorAll('[data-tex]')) {
      if (node.dataset.rendered===node.dataset.tex) continue;
      const source=node.dataset.tex;
      const output=await mj.tex2svgPromise(source,{display:false});
      output.querySelectorAll('mjx-assistive-mml').forEach(copy=>copy.remove());
      output.setAttribute('aria-hidden','true');
      if (node.isConnected && node.dataset.tex===source) {
        node.replaceChildren(output);
        node.dataset.rendered=source;
      }
    }
  }).catch(error=>console.error('数式を描画できませんでした。',error));
}
window.addEventListener('mathjax-ready',typeset);
