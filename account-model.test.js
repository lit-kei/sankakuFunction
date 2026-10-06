import test from 'node:test';import assert from 'node:assert/strict';
import {accountEmail,validateRegistration} from './account-model.js';
test('校内の7桁生徒番号と一般のメールアドレスを分ける',()=>{
 assert.equal(accountEmail('school','0123456'),'0123456@school.local');
 assert.equal(accountEmail('general',' person@example.com '),'person@example.com');
 for(const value of ['123456','１２３４５６７','abcdefg'])assert.throws(()=>accountEmail('school',value));
 assert.throws(()=>accountEmail('general','0123456@school.local'));
});
test('本人の校内識別子を検証し、個人情報を公開プロフィールから分離',()=>{
 const input={accountType:'school',username:'student_1',studentNumber:'0123456',grade:1,classNumber:7,attendanceNumber:41};
 const result=validateRegistration(input,{email:'0123456@school.local',provider:'password'});
 assert.deepEqual(Object.keys(result.publicProfile).sort(),['accountType','schoolVerified','username']);assert.equal(result.privateProfile.studentNumber,'0123456');assert.equal(result.publicProfile.schoolVerified,false);
 assert.throws(()=>validateRegistration(input,{email:'7654321@school.local',provider:'password'}));
 assert.throws(()=>validateRegistration({...input,grade:4},{email:'0123456@school.local',provider:'password'}));
 assert.throws(()=>validateRegistration(input,{email:'0123456@school.local',provider:'anonymous'}));
});
test('一般ユーザーの名前を検証し、生徒情報を受け入れない',()=>{
 const result=validateRegistration({accountType:'general',username:'user_123',studentNumber:'0123456'},{email:'person@example.com',provider:'password'});assert.deepEqual(result.privateProfile,{accountType:'general'});
 assert.throws(()=>validateRegistration({accountType:'general',username:'<script>'},{email:'person@example.com',provider:'password'}));
});
