import {question,answer,angles,values} from './math.js';

export const ROUND_COUNT=10;
export const COUNTDOWN_MS=5000;
export const MAX_ATTEMPTS=200;
export function makeDeck(random=Math.random) {
  const deck=[];
  while(deck.length<ROUND_COUNT) {
    const q=question(random);
    if (!deck.length || q.fn!==deck.at(-1).fn || q.deg!==deck.at(-1).deg) deck.push(q);
  }
  return deck;
}
export function validRoom(room) {
  return room && room.from!==room.to && ['rad','deg'].includes(room.unit)
    && room.deck && Object.keys(room.deck).length===ROUND_COUNT
    && Array.from({length:ROUND_COUNT},(_,i)=>room.deck[i]).every(q=>q
      && ['sin','cos','tan'].includes(q.fn) && angles.includes(q.deg)
      && values.includes(q.value) && q.value===answer(q.fn,q.deg));
}
export function progress(room,uid) {
  let correct=0,finishAt=null,attempts=0;
  for(const [,move] of Object.entries(room.moves?.[uid]||{}).sort(([a],[b])=>Number(a)-Number(b))) {
    attempts++;
    if(move.index===correct && move.value===room.deck[correct]?.value) {
      correct++;
      if(correct===ROUND_COUNT) {finishAt=move.at;break;}
    }
  }
  return {correct,finishAt,attempts};
}
export function outcome(room) {
  if(room.status==='cancelled')return {type:'cancelled'};
  const a=progress(room,room.from),b=progress(room,room.to);
  // A completed race takes precedence over a later forfeit.
  if(a.finishAt!==null||b.finishAt!==null){
    if(a.finishAt!==null&&b.finishAt!==null&&a.finishAt===b.finishAt)return {type:'draw'};
    return {type:'finished',winner:b.finishAt===null||(a.finishAt!==null&&a.finishAt<b.finishAt)?room.from:room.to};
  }
  if(room.status==='abandoned')return {type:'forfeit',winner:room.cancelledBy===room.from?room.to:room.from};
  return null;
}
// Shared protocol validation for the local two-tab demo and its tests.
export function applyAction(state,uid,action,now) {
  const me=state.presence[uid];
  if(action.type==='join') {
    if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>20)throw Error('名前は1〜20文字で入力してください。');
    state.presence[uid]={name:action.name.trim(),state:'lobby',lastSeen:now};return;
  }
  if(action.type==='heartbeat') {if(me)me.lastSeen=now;return;}
  if(action.type==='leave') {delete state.presence[uid];return;}
  if(!me)throw Error('ロビーに入り直してください。');
  if(action.type==='invite') {
    const other=state.presence[action.room.to];
    if(me.state!=='lobby'||!other||other.state!=='lobby'||other.lastSeen<now-15000)throw Error('相手は現在対戦できません。');
    if(!validRoom(action.room)||action.room.from!==uid||state.rooms[action.id])throw Error('無効な対戦です。');
    state.rooms[action.id]={...action.room,status:'invited',createdAt:now};
    me.state='inviting';me.roomId=action.id;
    (state.inbox[action.room.to]??={})[action.id]=true;return;
  }
  const room=state.rooms[action.id];
  if(!room||![room.from,room.to].includes(uid))throw Error('対戦が見つかりません。');
  if(action.type==='accept') {
    const sender=state.presence[room.from];
    if(room.status!=='invited'||room.to!==uid||me.state!=='lobby'||sender?.state!=='inviting'||sender.roomId!==action.id||sender.lastSeen<now-15000)throw Error('この申請はすでに終了しています。');
    room.status='accepted';room.acceptedAt=now;
    for(const p of [me,sender]){p.state='playing';p.roomId=action.id;}
    delete state.inbox[uid]?.[action.id];return;
  }
  if(action.type==='cancel') {
    if(['invited','accepted'].includes(room.status)){room.status=room.status==='invited'?'cancelled':'abandoned';room.cancelledBy=uid;room.cancelledAt=now;}
    return;
  }
  if(action.type==='submit') {
    if(room.status!=='accepted'||outcome(room)||now<room.acceptedAt+COUNTDOWN_MS)throw Error('回答できる時間ではありません。');
    const p=progress(room,uid);
    if(p.attempts>=MAX_ATTEMPTS||action.index!==p.correct||!values.includes(action.value))throw Error('回答が更新されています。');
    room.moves??={};const moves=room.moves[uid]??={};
    moves[p.attempts]={index:action.index,value:action.value,seq:p.attempts,at:now};return;
  }
  throw Error('不明な操作です。');
}
