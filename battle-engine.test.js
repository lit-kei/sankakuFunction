import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDeck,validRoom,applyAction,progress,penaltyUntil,outcome,COUNTDOWN_MS,WRONG_PENALTY_MS} from './battle-engine.js';
function setup(){const state={presence:{},rooms:{},inbox:{}};applyAction(state,'a',{type:'join',name:'Alice'},1000);applyAction(state,'b',{type:'join',name:'Bob'},1000);applyAction(state,'a',{type:'invite',id:'room',room:{from:'a',to:'b',fromName:'Alice',toName:'Bob',unit:'rad',deck:makeDeck()}},1000);return state;}
test('共有問題は10問・全て範囲内の有名角・tan未定義を除外',()=>{for(let n=0;n<100;n++){const deck=makeDeck();assert.equal(deck.length,10);assert.ok(validRoom({from:'a',to:'b',unit:'rad',deck}));for(const q of deck)assert.ok(q.deg>=-900&&q.deg<=900);}});
test('承諾・カウントダウン・誤答の再回答・先着の勝者',()=>{
 const state=setup();applyAction(state,'b',{type:'accept',id:'room'},1200);const room=state.rooms.room;
 assert.throws(()=>applyAction(state,'a',{type:'submit',id:'room',index:0,value:room.deck[0].value},1201));
 const start=1200+COUNTDOWN_MS;
 const wrong=room.deck[0].value==='0'?'1':'0';applyAction(state,'a',{type:'submit',id:'room',index:0,value:wrong},start);
 assert.equal(progress(room,'a').correct,0);assert.equal(progress(room,'a').attempts,1);assert.equal(penaltyUntil(room,'a'),start+WRONG_PENALTY_MS);
 assert.throws(()=>applyAction(state,'a',{type:'submit',id:'room',index:0,value:room.deck[0].value},start+WRONG_PENALTY_MS-1));
 for(let i=0;i<10;i++){if(i<7)applyAction(state,'b',{type:'submit',id:'room',index:i,value:room.deck[i].value},start+i*200+1);applyAction(state,'a',{type:'submit',id:'room',index:i,value:room.deck[i].value},start+WRONG_PENALTY_MS+i*200);}
 assert.equal(progress(room,'a').correct,10);assert.equal(progress(room,'b').correct,7);assert.equal(outcome(room).winner,'a');
 assert.throws(()=>applyAction(state,'b',{type:'submit',id:'room',index:7,value:room.deck[7].value},start+5000));
});
test('二重承諾・第三者・順序飛ばし・誤った正答データを拒否',()=>{
 const state=setup();applyAction(state,'c',{type:'join',name:'Carol'},1000);
 assert.throws(()=>applyAction(state,'c',{type:'accept',id:'room'},1100));
 applyAction(state,'b',{type:'accept',id:'room'},1100);
 assert.throws(()=>applyAction(state,'b',{type:'accept',id:'room'},1100));
 assert.throws(()=>applyAction(state,'a',{type:'submit',id:'room',index:5,value:'0'},7000));
 const invalid=structuredClone(state.rooms.room);invalid.deck[0].value='undefined';assert.equal(validRoom(invalid),false);
});
test('同一相手への複数申請から一つだけ承諾できる',()=>{
 const state=setup();applyAction(state,'c',{type:'join',name:'Carol'},1000);applyAction(state,'c',{type:'invite',id:'second',room:{from:'c',to:'b',unit:'deg',deck:makeDeck()}},1000);applyAction(state,'b',{type:'accept',id:'room'},1100);assert.throws(()=>applyAction(state,'b',{type:'accept',id:'second'},1101));
});
test('退出・辞退・途中終了を扱う',()=>{const state=setup();applyAction(state,'b',{type:'cancel',id:'room'},1100);assert.equal(outcome(state.rooms.room).type,'cancelled');const next=setup();applyAction(next,'b',{type:'accept',id:'room'},1100);applyAction(next,'a',{type:'cancel',id:'room'},7000);assert.deepEqual(outcome(next.rooms.room),{type:'forfeit',winner:'b'});applyAction(next,'a',{type:'leave'},7000);assert.equal(next.presence.a,undefined);});
test('ロビーのチャットは名前を固定し120文字以内だけ保存する',()=>{const state={presence:{},rooms:{},inbox:{}};applyAction(state,'a',{type:'join',name:'Alice'},1000);applyAction(state,'a',{type:'chat',id:'one',text:' こんにちは '},1001);assert.deepEqual(state.chat.one,{uid:'a',name:'Alice',text:'こんにちは',at:1001});assert.throws(()=>applyAction(state,'a',{type:'chat',id:'two',text:'x'.repeat(121)},1002));});
