import {firebaseConfig} from './firebase-config.js';
import {progress,outcome} from './battle-engine.js';
import {getServices} from './firebase-client.js';
export function isConfigured(){return ['apiKey','databaseURL','projectId','appId'].every(key=>typeof firebaseConfig[key]==='string'&&firebaseConfig[key].length>0);}
export async function connectFirebase() {
  if(!isConfigured())throw Error('オンライン対戦は準備中です。Firebase の接続設定が必要です。下のお試し対戦は利用できます。');
  const {auth,authSDK,db,dbSDK}=await getServices();
  if(!auth.currentUser)await authSDK.signInAnonymously(auth);
  const user=auth.currentUser,uid=user.uid,root='trigBattle';
  const profile=user.isAnonymous?null:(await dbSDK.get(dbSDK.ref(db,`${root}/profiles/${uid}`))).val();
  if(!user.isAnonymous&&!profile)throw Error('アカウントページで登録を完了してから対戦してください。');
  const path=p=>dbSDK.ref(db,`${root}/${p}`);
  let offset=0,name='',heartbeat,connected=false,activeState='lobby',activeRoom=null;
  const unOffset=dbSDK.onValue(dbSDK.ref(db,'.info/serverTimeOffset'),s=>{offset=s.val()||0;});
  const now=()=>Date.now()+offset;
  const presence=()=>({name,state:activeState,lastSeen:dbSDK.serverTimestamp(),...(activeRoom?{roomId:activeRoom}:{})});
  const watch=(p,cb)=>dbSDK.onValue(path(p),s=>cb(s.val()||{}),error=>window.dispatchEvent(new CustomEvent('battle-error',{detail:error.message})));
  let unConnected,owned=false;
  return {uid,mode:'online',now,profile,
    watchRatings:cb=>watch('ratings',cb),watchProfiles:cb=>watch('profiles',cb),
    async join(value){
      name=profile?.username||value;
      const reserved=await dbSDK.runTransaction(path(`presence/${uid}`),p=>!p||p.lastSeen<now()-15000?presence():undefined,{applyLocally:false});
      if(!reserved.committed)throw Error('このアカウントは別のタブで対戦ロビーに参加中です。先にそちらを退出してください。');
      owned=true;
      await dbSDK.onDisconnect(path(`presence/${uid}`)).remove();
      await dbSDK.set(path(`presence/${uid}`),presence());
      unConnected=dbSDK.onValue(dbSDK.ref(db,'.info/connected'),async s=>{
        connected=s.val()===true;
        window.dispatchEvent(new CustomEvent('battle-connection',{detail:connected}));
        if(connected){try{await dbSDK.onDisconnect(path(`presence/${uid}`)).remove();await dbSDK.set(path(`presence/${uid}`),presence());}catch(error){window.dispatchEvent(new CustomEvent('battle-error',{detail:error.message}));}}
      });
      heartbeat=setInterval(()=>{if(connected)dbSDK.update(path(`presence/${uid}`),{lastSeen:dbSDK.serverTimestamp()}).catch(()=>{});},5000);
    },
    watchLobby:cb=>watch('presence',data=>{if(data[uid]){activeState=data[uid].state;activeRoom=data[uid].roomId||null;}cb(data);}),watchInbox:cb=>watch(`inbox/${uid}`,cb),
    watchRoom:(id,cb)=>dbSDK.onValue(path(`rooms/${id}`),s=>cb(s.val()),e=>window.dispatchEvent(new CustomEvent('battle-error',{detail:e.message}))),
    getRoom:async id=>(await dbSDK.get(path(`rooms/${id}`))).val(),
    async invite(id,room){
      const reserved=await dbSDK.runTransaction(path(`presence/${uid}`),p=>p?.state==='lobby'?{...p,state:'inviting',roomId:id}:undefined);
      if(!reserved.committed)throw Error('すでに対戦申請中です。');
      activeState='inviting';activeRoom=id;
      try{const peer=(await dbSDK.get(path(`profiles/${room.to}`))).val();await dbSDK.set(path(`rooms/${id}`),{...room,ranked:room.ranked!==false&&!!profile&&!!peer,status:'invited',createdAt:dbSDK.serverTimestamp()});await dbSDK.set(path(`inbox/${room.to}/${id}`),true);}
      catch(error){activeState='lobby';activeRoom=null;await dbSDK.set(path(`presence/${uid}`),presence());throw error;}
    },
    async accept(id){
      const room=(await dbSDK.get(path(`rooms/${id}`))).val();
      if(!room||room.to!==uid)throw Error('対戦申請が見つかりません。');
      await dbSDK.update(dbSDK.ref(db),{
        [`${root}/rooms/${id}/status`]:'accepted',
        [`${root}/rooms/${id}/acceptedAt`]:dbSDK.serverTimestamp(),
        [`${root}/presence/${uid}`]:{...presence(),state:'playing',roomId:id},
        [`${root}/presence/${room.from}/state`]:'playing',
        [`${root}/inbox/${uid}/${id}`]:null,
      });activeState='playing';activeRoom=id;
    },
    async cancel(id){
      const room=(await dbSDK.get(path(`rooms/${id}`))).val();
      if(!room||!['invited','accepted'].includes(room.status)||outcome(room))return;
      await dbSDK.update(path(`rooms/${id}`),{status:room.status==='invited'?'cancelled':'abandoned',cancelledBy:uid,cancelledAt:dbSDK.serverTimestamp()});
    },
    async submit(id,index,value){
      if(!connected)throw Error('接続が切れています。再接続をお待ちください。');
      const room=(await dbSDK.get(path(`rooms/${id}`))).val();
      const p=progress(room,uid);
      await dbSDK.set(path(`rooms/${id}/moves/${uid}/${p.attempts}`),{index,value,seq:p.attempts,at:dbSDK.serverTimestamp()});
    },
    async reset(){activeState='lobby';activeRoom=null;await dbSDK.set(path(`presence/${uid}`),presence());},
    async close(){
      clearInterval(heartbeat);unOffset();unConnected?.();
      if(owned){await dbSDK.remove(path(`presence/${uid}`));await dbSDK.onDisconnect(path(`presence/${uid}`)).cancel();owned=false;}
      // Keep the persistent account signed in when leaving the lobby.
    },
  };
}
