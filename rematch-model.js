import {validRoom,outcome} from './battle-engine.js';

export function requestRematchState(state,{uid,roomId,nextRoomId,deck,now}) {
  const room=state?.rooms?.[roomId];
  if(!room||!validRoom(room)||!outcome(room))return {type:'invalid',changed:false};
  if(uid!==room.from&&uid!==room.to)return {type:'forbidden',changed:false};
  if(room.rematchRoomId)return {type:'started',roomId:room.rematchRoomId,changed:false};
  const other=uid===room.from?room.to:room.from;
  const available=id=>{const p=state.presence?.[id];return p?.state==='playing'&&p.roomId===roomId&&p.lastSeen>now-15000;};
  if(!available(uid)||!available(other))return {type:'unavailable',changed:false};
  room.rematchRequests??={};room.rematchRequests[uid]=now;
  if(!room.rematchRequests[other])return {type:'waiting',changed:true};
  const next={from:room.from,to:room.to,fromName:room.fromName,toName:room.toName,unit:room.unit,ranked:room.ranked===true,deck,status:'accepted',createdAt:now,acceptedAt:now,rematchOf:roomId};
  if(!validRoom(next)||state.rooms[nextRoomId])return {type:'invalid',changed:false};
  state.rooms[nextRoomId]=next;room.rematchRoomId=nextRoomId;
  for(const id of [room.from,room.to])state.presence[id]={...state.presence[id],state:'playing',roomId:nextRoomId};
  return {type:'started',roomId:nextRoomId,changed:true};
}
