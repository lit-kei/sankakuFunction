import {values,radians,formulaTex,displayValue} from './math.js';
import {math,typeset} from './math-render.js';
import {makeDeck,validRoom,progress,penaltyUntil,outcome,ROUND_COUNT,COUNTDOWN_MS,WRONG_PENALTY_MS,MAX_ATTEMPTS} from './battle-engine.js';
import {connectFirebase,isConfigured} from './battle-firebase.js';
import {connectDemo} from './battle-demo.js';
import {getServices} from './firebase-client.js';

const $=id=>document.getElementById(id);
let backend=null,players={},room=null,roomId=null,subscriptions=[],unRoom=null,busy=false,lastQuestion='',lastResult='',localPenaltyUntil=0,inboxGeneration=0,connected=true;
const pending=new Set();let invitationIds=[],lobbySignature='',ratingData={},profileData={};
function message(text=''){$('notice').textContent=text;}
function errorMessage(error){return error.code==='PERMISSION_DENIED'||error.code==='database/permission-denied'?'対戦へのアクセスが許可されていません。Firebase の対戦用ルールが公開されているか確認してください。':error.code==='auth/operation-not-allowed'?'オンライン対戦の準備中です。Firebase で匿名認証を有効にしてください。':error.message||'通信に失敗しました。もう一度お試しください。';}
async function action(key,fn){if(pending.has(key))return;pending.add(key);try{await fn();}catch(error){message(errorMessage(error));}finally{pending.delete(key);}}
function show(id){for(const view of ['entry','lobby','arena'])$(view).hidden=view!==id;}
function button(text,fn,disabled=false){const b=document.createElement('button');b.className='secondary';b.textContent=text;b.disabled=disabled;b.onclick=fn;return b;}
function playerRow(name,description){const row=document.createElement('div');row.className='player-row';const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=Array.from(name)[0]||'?';const info=document.createElement('div');info.className='player-info';const title=document.createElement('b');title.textContent=name;const sub=document.createElement('small');sub.textContent=description;info.append(title,sub);row.append(avatar,info);return row;}
function empty(container,text){const p=document.createElement('p');p.className='empty-list';p.textContent=text;container.append(p);}
function renderChat(messages){
 const container=$('chat-messages'),nearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<40;
 container.replaceChildren();const entries=Object.values(messages||{}).filter(item=>item&&typeof item.text==='string').sort((a,b)=>a.at-b.at).slice(-30);
 if(!entries.length)empty(container,'まだメッセージはありません。');
 for(const item of entries){const row=document.createElement('div');row.className='chat-message';const name=document.createElement('b');name.textContent=item.name;const text=document.createElement('span');text.textContent=item.text;const time=document.createElement('time');time.textContent=Number.isFinite(item.at)?new Date(item.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'';row.append(name,text,time);container.append(row);}
 if(nearBottom)container.scrollTop=container.scrollHeight;
}
function renderLobby(){
 if(!backend)return;
 const active=Object.entries(players).filter(([uid,p])=>uid!==backend.uid&&p.lastSeen>backend.now()-15000);
 $('waiting').hidden=!(room?.status==='invited'&&room.from===backend.uid);
 if(!$('waiting').hidden)$('waiting-name').textContent=`${room.toName} さんへ申請しました。${room.unit==='rad'?'弧度法':'度数法'}で対戦します。`;
 const signature=JSON.stringify([active.map(([uid,p])=>[uid,p.name,p.state,ratingData[uid]?.rating,profileData[uid]?.accountType]),connected,busy,roomId]);
 if(signature===lobbySignature)return;lobbySignature=signature;
 $('player-count').textContent=`${active.length+1} 人`;
 $('players').replaceChildren();
 if(!active.length)empty($('players'),backend.mode==='demo'?'別のタブでもこのページを開き、「お試し対戦」でロビーに入ると相手が表示されます。':'まだ対戦相手がいません。友だちにもこのページを開いてロビーに入ってもらいましょう。');
 for(const [uid,p]of active){const availability=p.state==='lobby'?'対戦できます':p.state==='inviting'?'申請中':'対戦中';const row=playerRow(p.name,`${availability} · ${profileData[uid]?`R ${ratingData[uid]?.rating??1500}`:'ゲスト'}`);row.append(button('対戦する',()=>action('invite',()=>challenge(uid)),!connected||busy||!!roomId||p.state!=='lobby'));$('players').append(row);}

}
async function renderInvitations(ids){
 invitationIds=Object.keys(ids);const generation=++inboxGeneration;
 const loaded=await Promise.all(invitationIds.map(async id=>{try{return {id,room:await backend.getRoom(id)};}catch{return null;}}));
 if(generation!==inboxGeneration||!backend)return;
 $('invitations').replaceChildren();
 const valid=loaded.filter(item=>item&&validRoom(item.room)&&item.room.status==='invited'&&players[item.room.from]?.lastSeen>backend.now()-15000);
 if(!valid.length)empty($('invitations'),'対戦申請が届くと、ここに表示されます。');
 for(const item of valid){const row=playerRow(item.room.fromName,`${item.room.ranked?'レーティング':'フレンドリー'} · ${item.room.unit==='rad'?'弧度法':'度数法'}`);row.className='invite-row';const controls=document.createElement('div');controls.className='invite-actions';controls.append(button('対戦する',()=>action('accept',async()=>{await backend.accept(item.id);watchMatch(item.id);}),!connected||busy||!!roomId),button('辞退',()=>action(`decline-${item.id}`,async()=>{await backend.cancel(item.id);await renderInvitations(Object.fromEntries(invitationIds.map(id=>[id,true])));})));row.append(controls);$('invitations').append(row);}
}
async function join(mode){
 if(backend)return;const name=$('player-name').value.trim();
 if(!name){$('player-name').reportValidity();return;}
 $('join').disabled=true;$('demo').disabled=true;
 try{
  const b=mode==='demo'?await connectDemo():await connectFirebase();
  try{await b.join(name);}catch(error){await b.close().catch(()=>{});throw error;}
  backend=b;connected=true;if(b.profile)$('player-name').value=b.profile.username;$('my-name').textContent=`あなた：${name} · ${$('battle-unit').value==='rad'?'弧度法':'度数法'}で申請`;
  $('mode-label').textContent=mode==='demo'?'LOCAL DEMO · 同じブラウザー内':'ONLINE LOBBY';
  message(mode==='demo'?'お試し対戦です。同じブラウザーの別タブでもこのページを開き、別の名前で入室してください。別の端末にはつながりません。':'');
  subscriptions.push(b.watchLobby(data=>{players=data;renderLobby();renderMatch();if(invitationIds.length)renderInvitations(Object.fromEntries(invitationIds.map(id=>[id,true]))).catch(()=>{});}),b.watchInbox(ids=>renderInvitations(ids).catch(error=>message(errorMessage(error)))),b.watchChat(renderChat));
  if(b.watchRatings)subscriptions.push(b.watchRatings(data=>{ratingData=data;renderLobby();}),b.watchProfiles(data=>{profileData=data;renderLobby();}));
  show('lobby');renderLobby();
 }catch(error){message(errorMessage(error));}finally{$('join').disabled=false;$('demo').disabled=false;}
}
async function challenge(uid){
 busy=true;renderLobby();
 try{const id=crypto.randomUUID(),candidate={from:backend.uid,to:uid,fromName:players[backend.uid].name,toName:players[uid].name,unit:$('battle-unit').value,ranked:backend.mode==='online'&&!!backend.profile&&$('rated-match').checked,deck:makeDeck()};await backend.invite(id,candidate);watchMatch(id);}finally{busy=false;renderLobby();}
}
function watchMatch(id){
 unRoom?.();roomId=id;lastQuestion='';lastResult='';localPenaltyUntil=0;
 unRoom=backend.watchRoom(id,data=>{
  if(!data)return;if(!validRoom(data)){message('無効な問題を含む対戦です。ロビーに戻ってください。');return;}
  if(data.rematchRoomId&&data.rematchRoomId!==id){queueMicrotask(()=>watchMatch(data.rematchRoomId));return;}
  room=data;
  if(room.status==='invited'){show('lobby');renderLobby();return;}
  if(room.status==='cancelled'){returnLobby().catch(error=>message(errorMessage(error)));message('対戦申請は取り消されました。');return;}
  show('arena');renderMatch();
 });
}
function renderMatch(){
 if(!room||!backend)return;
 const self=progress(room,backend.uid),otherId=room.from===backend.uid?room.to:room.from,other=progress(room,otherId),result=outcome(room);
 $('self-name').textContent=room.from===backend.uid?room.fromName:room.toName;$('opponent-name').textContent=room.from===backend.uid?room.toName:room.fromName;
 $('self-score').textContent=`${self.correct} / ${ROUND_COUNT}`;$('opponent-score').textContent=`${other.correct} / ${ROUND_COUNT}`;
 $('self-bar').style.width=`${self.correct*10}%`;$('opponent-bar').style.width=`${other.correct*10}%`;$('battle-unit-label').textContent=room.unit==='rad'?'弧度法':'度数法';
 $('result').hidden=!result;$('forfeit').hidden=!!result;
 if(result){
  $('countdown').textContent='';$('race-question').hidden=true;$('race-answers').hidden=true;$('race-feedback').textContent='';
  $('result-label').textContent=result.type==='draw'?'DRAW':result.winner===backend.uid?'YOU WIN':'GOOD GAME';
  $('result-title').textContent=result.type==='draw'?'同時ゴール！':result.winner===backend.uid?'あなたの勝ち！':'相手の勝ち！';
  const winnerProgress=result.type==='draw'?self:progress(room,result.winner);
  $('result-detail').textContent=result.type==='forfeit'?(result.winner===backend.uid?'相手が対戦を終了したため、あなたの勝ちです。':'対戦を終了しました。相手の勝ちです。'):`${result.type==='draw'?'ふたりとも':'勝者は'} ${((winnerProgress.finishAt-room.acceptedAt-COUNTDOWN_MS)/1000).toFixed(2)} 秒で10問正解。あなた ${self.correct} 問 · 相手 ${other.correct} 問`;
  const change=room.settlement?.players?.[backend.uid];
  $('rating-change').textContent=change?`R ${change.before} → ${change.after}（${change.delta>0?'+':''}${change.delta}）${room.settlement?.pairDailyCount===5?' · 本日5回目':''}`:room.settlement?.reason==='daily_pair_limit'?'同じ相手との本日のレーティング対戦は5回に達したため、レート変更なし':room.ranked&&!room.settlement?'レートを集計しています…':room.ranked&&!room.settlement?.rated?'レート変更なし':'フレンドリー対戦のためレートは変わりません。';
  const presence=players[otherId],available=connected&&presence?.state==='playing'&&presence.roomId===roomId&&presence.lastSeen>backend.now()-15000,mine=!!room.rematchRequests?.[backend.uid],theirs=!!room.rematchRequests?.[otherId],rematch=$('rematch');
  const opponentGone=!presence||presence.lastSeen<=backend.now()-15000||presence.state!=='playing';
  rematch.disabled=busy||mine||!available;rematch.classList.toggle('rematch-alert',theirs&&!mine&&available);rematch.textContent=mine?'相手を待っています…':theirs&&available?'相手が再戦を希望 · 再戦する':'再戦';
  // A different roomId can mean the rematch transaction has already moved the
  // opponent to the next room while this client still has the old room snapshot.
  // Do not treat that normal transition as the opponent leaving.
  if(mine&&opponentGone&&!room.rematchRoomId)queueMicrotask(()=>action('rematch-left',async()=>{await returnLobby();message('相手が対戦から抜けたため、ロビーに戻りました。');}));
  if(lastResult!==JSON.stringify(result)){lastResult=JSON.stringify(result);$('result').classList.remove('result-enter');void $('result').offsetWidth;$('result').classList.add('result-enter');}
  return;
 }
 const ready=backend.now()>=room.acceptedAt+COUNTDOWN_MS;
 $('race-question').hidden=!ready;$('race-answers').hidden=!ready;
 if(!ready)return;
 $('countdown').textContent='';$('question-count').textContent=`${self.correct+1} / ${ROUND_COUNT} 問`;
 const q=room.deck[self.correct];if(!q)return;
 const key=`${roomId}:${self.correct}`;
 if(lastQuestion!==key){
  lastQuestion=key;$('race-feedback').textContent='';const label=room.unit==='rad'?radians(q.deg):`${q.deg}°`;
  $('race-question').innerHTML=math(`${q.fn} (${label}) = ?`,formulaTex(q.fn,label));$('race-question').classList.remove('question-enter');void $('race-question').offsetWidth;$('race-question').classList.add('question-enter');
  $('race-answers').replaceChildren();for(const value of values){const b=document.createElement('button');const label=displayValue(value);b.dataset.value=value;b.setAttribute('aria-label',label);b.innerHTML=math(label);b.onclick=()=>submit(value);$('race-answers').append(b);}typeset();
 }
 const lockedUntil=Math.max(localPenaltyUntil,penaltyUntil(room,backend.uid)),remaining=lockedUntil-backend.now();
 if(remaining>0)$('race-feedback').textContent=`不正解。あと ${Math.ceil(remaining/1000)} 秒は回答できません。`;
 else if(localPenaltyUntil||$('race-feedback').textContent.startsWith('不正解。あと ')){localPenaltyUntil=0;$('race-feedback').textContent='もう一度回答できます。';}
 for(const b of $('race-answers').children)b.disabled=busy||!connected||remaining>0;
 if(self.attempts>=MAX_ATTEMPTS){$('race-feedback').textContent='回答回数の上限に達しました。ロビーに戻って再挑戦してください。';for(const b of $('race-answers').children)b.disabled=true;}
}
async function submit(value){
 if(busy||!connected||!room||outcome(room))return;
 const index=progress(room,backend.uid).correct,q=room.deck[index];busy=true;renderMatch();
 try{await backend.submit(roomId,index,value);if(value!==q.value&&progress(room,backend.uid).correct===index){localPenaltyUntil=backend.now()+WRONG_PENALTY_MS;$('race-feedback').textContent='不正解。10秒間は回答できません。';}}
 catch(error){message(errorMessage(error));}finally{busy=false;renderMatch();}
}
async function requestRematch(){
 if(!room||!outcome(room))return;const current=roomId,other=room.from===backend.uid?room.to:room.from,presence=players[other];
 if(!presence||presence.state!=='playing'||presence.roomId!==current||presence.lastSeen<=backend.now()-15000){await returnLobby();message('相手が対戦から抜けたため、ロビーに戻りました。');return;}
 try{const result=await backend.requestRematch(current);if(result?.roomId)watchMatch(result.roomId);}
 catch(error){if(error.code==='functions/failed-precondition'||/退出/.test(error.message||'')){await returnLobby();message('相手が対戦から抜けたため、ロビーに戻りました。');return;}throw error;}
}
async function returnLobby(){unRoom?.();unRoom=null;roomId=null;room=null;lastQuestion='';lastResult='';localPenaltyUntil=0;await backend.reset();show('lobby');renderLobby();await renderInvitations(Object.fromEntries(invitationIds.map(id=>[id,true])));}
async function leave(){if(roomId&&room&&!outcome(room))await backend.cancel(roomId);unRoom?.();unRoom=null;for(const un of subscriptions)un();subscriptions=[];await backend.close();backend=null;room=null;roomId=null;players={};invitationIds=[];lobbySignature='';show('entry');message();}
$('join-form').onsubmit=e=>{e.preventDefault();action('join',()=>join('online'));};$('demo').onclick=()=>action('join',()=>join('demo'));
$('leave').onclick=()=>action('leave',leave);$('cancel-invite').onclick=()=>action('cancel',()=>backend.cancel(roomId));
$('forfeit').onclick=()=>action('forfeit',()=>backend.cancel(roomId));$('return-lobby').onclick=()=>action('return',returnLobby);
$('rematch').onclick=()=>action('rematch',requestRematch);$('chat-form').onsubmit=e=>{e.preventDefault();const input=$('chat-input'),text=input.value.trim();if(!text||!backend)return;input.disabled=true;action('chat',async()=>{try{await backend.sendChat(text);input.value='';}finally{input.disabled=false;input.focus();}});};
window.addEventListener('battle-error',e=>message(e.detail));window.addEventListener('battle-connection',e=>{connected=e.detail;if(backend?.mode==='online')message(connected?'':'接続が切れました。再接続しています。');renderLobby();renderMatch();});
window.addEventListener('pagehide',()=>{if(backend){if(roomId&&room&&!outcome(room))backend.cancel(roomId).catch(()=>{});backend.close().catch(()=>{});}});
setInterval(()=>{
 if(!backend)return;
 renderLobby();
 if(room?.status==='invited'&&room.from===backend.uid&&backend.now()-room.createdAt>60000){action('expired',()=>backend.cancel(roomId));}
 if(room?.status==='accepted'&&!outcome(room)){
  const remaining=room.acceptedAt+COUNTDOWN_MS-backend.now();
  if(remaining>0)$('countdown').textContent=`${Math.ceil(remaining/1000)} 秒後にスタート`;
  else{$('clock').textContent=`${((backend.now()-room.acceptedAt-COUNTDOWN_MS)/1000).toFixed(2)} s`;renderMatch();}
  const other=room.from===backend.uid?room.to:room.from;
  if(!players[other]||players[other].lastSeen<backend.now()-15000)$('race-feedback').textContent='相手の接続が切れています。再接続を待つか、対戦を終了してください。';
 }
},100);
if(!isConfigured())message('オンライン対戦は Firebase の接続設定を準備中です。お試し対戦は同じブラウザーの2つのタブで利用できます。');

async function refreshSession(){
 try{
  const {auth,db,dbSDK}=await getServices();const user=auth.currentUser;
  $('session-card').replaceChildren();
  const link=document.createElement('a');link.href='./account.html';
  if(user&&!user.isAnonymous){
   const profile=(await dbSDK.get(dbSDK.ref(db,`trigBattle/profiles/${user.uid}`))).val();
   if(profile){const strong=document.createElement('strong');strong.textContent=profile.username;$('session-card').append(strong);link.textContent=' · アカウント / ログアウト';$('player-name').value=profile.username;$('player-name').readOnly=true;$('rated-choice').hidden=false;
    const rating=(await dbSDK.get(dbSDK.ref(db,`trigBattle/ratings/${user.uid}`))).val();const sub=document.createElement('small');sub.textContent=`R ${rating?.rating??1500} · ログイン済み同士の対戦でレートが変わります`;$('session-card').append(sub);
   }else{link.textContent='アカウント登録を完了する →';}
  }else{link.textContent='ログイン / 新規登録 →';}
  $('session-card').append(link);
 }catch{ /* Login link remains usable if the network is unavailable. */ }
}
refreshSession();
