// Optional emulator integration test. Keep Firebase test dependencies external
// to the dependency-free website, or install them in your development checkout.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeDeck} from '../battle-engine.js';
const require=createRequire(process.env.FIREBASE_TEST_PACKAGE_JSON||import.meta.url);
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {ref,set,get,update,serverTimestamp}=require('firebase/database');
const env=await initializeTestEnvironment({projectId:'demo-sankaku',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('./database.rules.json',import.meta.url),'utf8')}});
const root='trigBattle';
try {
  const alice=env.authenticatedContext('alice').database(),bob=env.authenticatedContext('bob').database(),eve=env.authenticatedContext('eve').database(),anon=env.unauthenticatedContext().database();
  const presence=(db,uid,name)=>set(ref(db,`${root}/presence/${uid}`),{name,state:'lobby',lastSeen:serverTimestamp()});
  await assertFails(get(ref(anon,`${root}/presence`)));
  await assertSucceeds(presence(alice,'alice','Alice'));await assertSucceeds(presence(bob,'bob','Bob'));await assertSucceeds(presence(eve,'eve','Eve'));
  await assertFails(presence(eve,'alice','Hijacked'));
  await assertSucceeds(set(ref(alice,`${root}/chat/messages/message1`),{uid:'alice',name:'Alice',text:'こんにちは',at:serverTimestamp()}));
  await assertFails(set(ref(eve,`${root}/chat/messages/message2`),{uid:'alice',name:'Alice',text:'なりすまし',at:serverTimestamp()}));
  await assertFails(get(ref(anon,`${root}/chat/messages`)));await assertSucceeds(get(ref(bob,`${root}/chat/messages`)));
  await assertFails(set(ref(alice,`${root}/ratings/alice`),{rating:9999,games:10}));
  await assertFails(set(ref(alice,`${root}/profiles/alice`),{username:'Alice',accountType:'school'}));
  await assertFails(get(ref(eve,`${root}/privateProfiles/alice`)));
  await assertSucceeds(update(ref(alice,`${root}/presence/alice`),{state:'inviting',roomId:'match'}));
  const deck=makeDeck();const room={from:'alice',to:'bob',fromName:'Alice',toName:'Bob',unit:'rad',status:'invited',createdAt:serverTimestamp(),deck};
  const corrupt=structuredClone(room);corrupt.deck[0].value='not-an-answer';
  await assertFails(set(ref(alice,`${root}/rooms/match`),corrupt));
  await assertSucceeds(set(ref(alice,`${root}/rooms/match`),room));
  await assertFails(get(ref(eve,`${root}/rooms/match`)));
  await assertSucceeds(get(ref(bob,`${root}/rooms/match`)));
  await assertSucceeds(set(ref(alice,`${root}/inbox/bob/match`),true));
  await assertFails(get(ref(eve,`${root}/inbox/bob`)));
  await assertFails(update(ref(alice,`${root}/rooms/match`),{status:'accepted',acceptedAt:serverTimestamp()}));
  await assertSucceeds(update(ref(bob),{
    [`${root}/rooms/match/status`]:'accepted',[`${root}/rooms/match/acceptedAt`]:serverTimestamp(),
    [`${root}/presence/bob`]:{name:'Bob',state:'playing',roomId:'match',lastSeen:serverTimestamp()},
    [`${root}/presence/alice/state`]:'playing',[`${root}/inbox/bob/match`]:null,
  }));
  await assertFails(set(ref(alice,`${root}/chat/messages/message3`),{uid:'alice',name:'Alice',text:'対戦中',at:serverTimestamp()}));
  await assertFails(set(ref(alice,`${root}/rooms/match/moves/alice/0`),{index:0,value:deck[0].value,at:serverTimestamp()}));
  await assertFails(set(ref(alice,`${root}/rooms/match/deck/0/value`),'0'));
  await new Promise(resolve=>setTimeout(resolve,5100));
  const move=(db,uid,seq,index,value,at=serverTimestamp())=>set(ref(db,`${root}/rooms/match/moves/${uid}/${seq}`),{index,value,seq,at});
  await assertFails(move(eve,'alice',0,0,deck[0].value));
  await assertFails(move(alice,'alice',0,0,deck[0].value,1));
  await assertFails(move(alice,'alice',0,5,deck[5].value));
  const wrong=deck[0].value==='0'?'1':'0';await assertSucceeds(move(alice,'alice',0,0,wrong));
  await assertFails(move(alice,'alice',1,1,deck[1].value));
  await assertFails(move(alice,'alice',1,0,deck[0].value));
  await new Promise(resolve=>setTimeout(resolve,10100));
  await assertSucceeds(move(alice,'alice',1,0,deck[0].value));
  await assertFails(move(alice,'alice',1,0,deck[0].value));
  for(let i=1;i<10;i++)await assertSucceeds(move(alice,'alice',i+1,i,deck[i].value));
  await assertFails(move(alice,'alice',11,9,deck[9].value));
  await assertSucceeds(update(ref(bob,`${root}/rooms/match`),{status:'abandoned',cancelledBy:'bob',cancelledAt:serverTimestamp()}));
  await assertFails(move(bob,'bob',0,0,deck[0].value));
  assert.equal((await get(ref(alice,`${root}/rooms/match/status`))).val(),'abandoned');
  console.log('Firebase rules passed: authenticated lobby, valid deck, invitations, acceptance, countdown, correct sequencing, immutable moves, access isolation, server timestamps, abandonment.');
} finally {await env.cleanup();}
