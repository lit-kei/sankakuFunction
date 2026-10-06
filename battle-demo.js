import {applyAction} from './battle-engine.js';
const STORAGE='sankaku-battle-demo-v1';
// Demo clients share storage only in this browser. Web Locks serializes moves.
export async function connectDemo() {
  if(!navigator.locks||!window.BroadcastChannel)throw Error('お試し対戦には Web Locks 対応ブラウザーが必要です。Chrome / Edge などをご利用ください。');
  const uid=crypto.randomUUID(),channel=new BroadcastChannel(STORAGE),listeners=new Set();
  const read=()=>JSON.parse(localStorage.getItem(STORAGE)||'{"presence":{},"rooms":{},"inbox":{}}');
  function notify(){const state=read();for(const listener of listeners)listener(state);}
  channel.onmessage=notify;
  async function act(action){await navigator.locks.request(STORAGE,()=>{const state=read();applyAction(state,uid,action,Date.now());localStorage.setItem(STORAGE,JSON.stringify(state));});notify();channel.postMessage('change');}
  function watch(select,callback){const f=state=>callback(select(state));listeners.add(f);queueMicrotask(()=>{if(listeners.has(f))f(read());});return()=>listeners.delete(f);}
  let heartbeat;
  return {uid,mode:'demo',now:()=>Date.now(),
    async join(name){await act({type:'join',name});heartbeat=setInterval(()=>act({type:'heartbeat'}).catch(()=>{}),5000);},
    watchLobby:cb=>watch(s=>s.presence,cb),watchInbox:cb=>watch(s=>s.inbox[uid]||{},cb),
    watchRoom:(id,cb)=>watch(s=>s.rooms[id]||null,cb),getRoom:async id=>read().rooms[id]||null,
    invite:(id,room)=>act({type:'invite',id,room}),accept:id=>act({type:'accept',id}),
    cancel:id=>act({type:'cancel',id}),submit:(id,index,value)=>act({type:'submit',id,index,value}),
    reset:async()=>{const name=read().presence[uid]?.name;await act({type:'join',name});},
    async close(){clearInterval(heartbeat);await act({type:'leave'});channel.close();listeners.clear();},
  };
}
