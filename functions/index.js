import {initializeApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {randomUUID} from 'node:crypto';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onValueWritten} from 'firebase-functions/v2/database';
import {setGlobalOptions} from 'firebase-functions/v2';
import {validateRegistration} from './shared/account-model.js';
import {makeDeck} from './shared/battle-engine.js';
import {createSettlementTransaction} from './shared/rating-model.js';
import {registerProfileState} from './shared/profile-model.js';
import {requestRematchState} from './shared/rematch-model.js';

initializeApp({databaseURL:'https://sankakufunction-default-rtdb.firebaseio.com'});setGlobalOptions({region:'us-central1',maxInstances:3});
export const registerProfile=onCall(async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','ログインしてください。');
  const uid=request.auth.uid;
  let profile;
  try{profile=validateRegistration(request.data,{email:request.auth.token.email,provider:request.auth.token.firebase?.sign_in_provider});}
  catch(error){throw new HttpsError('invalid-argument',error.message);}
  const now=Date.now();
  let conflict=false;
  const root=getDatabase().ref('trigBattle');await root.get();
  const result=await root.transaction(state=>{
    if(!state)state={};conflict=false;
    const registration=registerProfileState(state,uid,profile,now);
    if(registration.type!=='created'){conflict=registration.type==='conflict';return;}
    return state;
  },undefined,false);
  if(!result.committed&&conflict)throw new HttpsError('already-exists','そのユーザー名は使用されています。');
  const saved=result.snapshot.child(`profiles/${uid}`).val();
  if(!saved)throw new HttpsError('internal','登録を完了できませんでした。再試行してください。');
  return saved;
});
export const requestRematch=onCall(async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','ログインしてください。');
  const roomId=String(request.data?.roomId||'');
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(roomId))throw new HttpsError('invalid-argument','対戦が見つかりません。');
  const root=getDatabase().ref('trigBattle'),input={uid:request.auth.uid,roomId,nextRoomId:randomUUID(),deck:makeDeck(),now:Date.now()};
  let decision;
  await root.transaction(state=>{
    if(state===null)return null;
    decision=requestRematchState(state,input);
    return decision.changed?state:undefined;
  },undefined,false);
  if(!decision||decision.type==='invalid')throw new HttpsError('failed-precondition','再戦できる対戦ではありません。');
  if(decision.type==='forbidden')throw new HttpsError('permission-denied','この対戦には参加していません。');
  if(decision.type==='unavailable')throw new HttpsError('failed-precondition','相手は対戦から退出しました。');
  return {status:decision.type,roomId:decision.roomId||null};
});
export const settleMatch=onValueWritten({ref:'trigBattle/rooms/{roomId}',instance:'sankakufunction-default-rtdb',retry:true},async event=>{
  const observed=event.data.after.val();
  if(!observed||observed.settlement||observed.status==='invited')return;
  // Read the latest room in a transaction, rather than settling a stale event.
  const root=getDatabase().ref('trigBattle');
  await root.transaction(createSettlementTransaction(event.params.roomId),undefined,false);
});
