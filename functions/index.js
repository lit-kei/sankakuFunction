import {initializeApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onValueWritten} from 'firebase-functions/v2/database';
import {setGlobalOptions} from 'firebase-functions/v2';
import {validateRegistration} from './shared/account-model.js';
import {settleRating} from './shared/rating-model.js';
import {registerProfileState} from './shared/profile-model.js';

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
export const settleMatch=onValueWritten({ref:'trigBattle/rooms/{roomId}',instance:'sankakufunction-default-rtdb',retry:true},async event=>{
  const observed=event.data.after.val();
  if(!observed||observed.settlement||observed.status==='invited')return;
  // Read the latest room in a transaction, rather than settling a stale event.
  const root=getDatabase().ref('trigBattle');
  await root.get();
  await root.transaction(state=>{
    if(!settleRating(state,event.params.roomId,Date.now()))return;
    return state;
  },undefined,false);
});
