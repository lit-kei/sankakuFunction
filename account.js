import {getServices} from './firebase-client.js';
import {accountEmail,validateRegistration,authError} from './account-model.js';
const $=id=>document.getElementById(id);
let service,mode='login',busy=false,profile=null,unRating=null;
function notice(text=''){$('account-notice').textContent=text;}
const kind=()=>document.querySelector('input[name="account-kind"]:checked').value;
for(const [id,max]of [['grade',3],['class-number',7],['attendance-number',41]])for(let i=1;i<=max;i++){const o=document.createElement('option');o.value=i;o.textContent=i;$(id).append(o);}
function updateForm(){
 const school=kind()==='school',details=mode!=='login',finish=mode==='finish';
 $('school-identifier').hidden=!school;$('general-identifier').hidden=school;$('signup-details').hidden=!details;$('school-details').hidden=!school;$('password-fields').hidden=finish;$('password-confirm-wrap').hidden=!details;$('school-note').hidden=!school;$('reset-password').hidden=school||details;$('switch-user').hidden=!finish;
 $('login-mode').disabled=finish;$('signup-mode').disabled=finish;
 for(const [id,required]of [['student-number',school],['account-email',!school],['username',details],['grade',details&&school],['class-number',details&&school],['attendance-number',details&&school],['account-password',!finish],['password-confirm',details&&!finish]]){
  $(id).required=required;$(id).disabled=!required||(finish&&['student-number','account-email'].includes(id));
 }
 for(const radio of document.querySelectorAll('[name="account-kind"]'))radio.disabled=finish;
 $('account-password').minLength=details?8:1;$('account-password').autocomplete=details?'new-password':'current-password';
 $('login-mode').classList.toggle('active',mode==='login');$('signup-mode').classList.toggle('active',details);
 $('account-submit').textContent=finish?'アカウント情報を保存 →':details?'新規登録 →':'ログイン →';
}
async function refresh(){
 if(!service||busy)return;
 unRating?.();unRating=null;
 const user=service.auth.currentUser;
 $('account-card').hidden=true;$('account-form-panel').hidden=false;
 if(user&&!user.isAnonymous){
  try{profile=(await service.dbSDK.get(service.dbSDK.ref(service.db,`trigBattle/profiles/${user.uid}`))).val();}
  catch(error){notice('アカウント情報を読み取れません。Firebase の最新ルールが公開されているか確認してください。');return;}
  if(profile){
   $('account-form-panel').hidden=true;$('account-card').hidden=false;$('account-username').textContent=profile.username;$('account-type-label').textContent=profile.accountType==='school'?'校内用アカウント':'一般アカウント';
   unRating=service.dbSDK.onValue(service.dbSDK.ref(service.db,`trigBattle/ratings/${user.uid}`),s=>{const r=s.val();if(!r)return;$('account-rating').textContent=r.rating;$('account-games').textContent=r.games;$('account-record').textContent=`${r.wins} 勝 · ${r.losses} 敗 · ${r.draws} 分`;});
   $('private-school').hidden=profile.accountType!=='school';
   if(profile.accountType==='school'){const p=(await service.dbSDK.get(service.dbSDK.ref(service.db,`trigBattle/privateProfiles/${user.uid}`))).val();if(p)$('private-school').textContent=`本人だけに表示：${p.grade}年 ${p.classNumber}組 ${p.attendanceNumber}番 · 生徒番号 ${p.studentNumber}`;}
   mode='login';notice();return;
  }
  mode='finish';const school=/^\d{7}@school\.local$/.test(user.email||'');document.querySelector(`[name="account-kind"][value="${school?'school':'general'}"]`).checked=true;$('student-number').value=school?user.email.split('@')[0]:'';$('account-email').value=school?'':user.email;notice('ログイン済みです。ユーザー名などを入力して登録を完了してください。');
 }else{if(mode==='finish')mode='login';profile=null;}
 updateForm();
}
$('login-mode').onclick=()=>{mode='login';notice();updateForm();};$('signup-mode').onclick=()=>{mode='signup';notice();updateForm();};
for(const radio of document.querySelectorAll('[name="account-kind"]'))radio.onchange=()=>{notice();updateForm();};
$('show-password').onclick=()=>{const show=$('account-password').type==='password';$('account-password').type=show?'text':'password';$('show-password').textContent=show?'隠す':'表示';$('show-password').setAttribute('aria-pressed',String(show));};
$('account-form').onsubmit=async event=>{
 event.preventDefault();if(busy||!service||!$('account-form').reportValidity())return;
 busy=true;$('account-submit').disabled=true;notice();
 const input={accountType:kind(),username:$('username').value.trim(),studentNumber:$('student-number').value.trim(),grade:Number($('grade').value),classNumber:Number($('class-number').value),attendanceNumber:Number($('attendance-number').value)};
 let succeeded=false,errorText='';
 try{
  const email=accountEmail(kind(),kind()==='school'?input.studentNumber:$('account-email').value);
  if(mode==='login')await service.authSDK.signInWithEmailAndPassword(service.auth,email,$('account-password').value);
  else{
   if(mode!=='finish'&&$('account-password').value!==$('password-confirm').value)throw Error('2つのパスワードが一致しません。');
   validateRegistration(input,{email,provider:'password'});
   if(mode!=='finish')await service.authSDK.createUserWithEmailAndPassword(service.auth,email,$('account-password').value);
   await service.fnSDK.httpsCallable(service.functions,'registerProfile')(input);
  }
  succeeded=true;
 }catch(error){errorText=authError(error);}finally{busy=false;$('account-submit').disabled=false;$('account-password').value='';$('password-confirm').value='';await refresh();if(!succeeded)notice(errorText);}
};
async function logout(){if(busy)return;busy=true;try{await service.authSDK.signOut(service.auth);}catch(error){notice(authError(error));}finally{busy=false;mode='login';await refresh();}}
$('logout').onclick=logout;$('switch-user').onclick=logout;
$('reset-password').onclick=async()=>{if(busy||kind()!=='general')return;busy=true;try{const email=accountEmail('general',$('account-email').value);await service.authSDK.sendPasswordResetEmail(service.auth,email);notice('登録済みのメールアドレスの場合、再設定メールが届きます。');}catch(error){notice(authError(error));}finally{busy=false;}};
try{service=await getServices();notice();await refresh();service.authSDK.onAuthStateChanged(service.auth,()=>refresh().catch(error=>notice(authError(error))));}catch(error){notice(authError(error));}
