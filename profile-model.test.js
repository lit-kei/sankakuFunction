import test from 'node:test';import assert from 'node:assert/strict';
import {registerProfileState} from './profile-model.js';
const profile=name=>({publicProfile:{username:name,accountType:'general',schoolVerified:false},privateProfile:{accountType:'general'}});
test('登録・初期レート・ユーザー名確保を同時に作り、登録の再送ではレートを初期化しない',()=>{const state={};assert.equal(registerProfileState(state,'a',profile('Alice'),1000).type,'created');assert.equal(state.ratings.a.rating,1500);state.ratings.a.rating=1532;assert.equal(registerProfileState(state,'a',profile('Alice'),2000).type,'existing');assert.equal(state.ratings.a.rating,1532);});
test('大小文字を問わず同じユーザー名の二重登録を拒否し、既存データを保つ',()=>{const state={};registerProfileState(state,'a',profile('Alice'),1000);const saved=structuredClone(state);assert.equal(registerProfileState(state,'b',profile('alice'),1001).type,'conflict');assert.deepEqual(state,saved);});
test('特殊な JavaScript プロパティ名も安全なキーとして保存する',()=>{const state={};registerProfileState(state,'a',profile('__proto__'),1000);assert.equal(state.usernames.u___proto__,'a');assert.equal(Object.getPrototypeOf(state.usernames),Object.prototype);});
