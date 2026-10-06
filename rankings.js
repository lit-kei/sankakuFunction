import {getServices} from './firebase-client.js';
let profiles={},ratings={},filter='all';
const status=document.getElementById('ranking-status'),list=document.getElementById('rankings');
function render(){
 const entries=Object.entries(ratings).filter(([uid,r])=>r.games>0&&profiles[uid]&&(filter==='all'||profiles[uid].accountType===filter)).sort(([ua,a],[ub,b])=>b.rating-a.rating||b.wins-a.wins||profiles[ua].username.localeCompare(profiles[ub].username));
 list.replaceChildren();status.textContent=entries.length?`${Math.min(entries.length,100)} 人を表示`:'まだ対戦記録がありません。';
 entries.slice(0,100).forEach(([uid,r],i)=>{const row=document.createElement('div');row.className='ranking-row';const rank=document.createElement('span');rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');const info=document.createElement('div');const name=document.createElement('b');name.textContent=profiles[uid].username;const type=document.createElement('small');type.textContent=profiles[uid].accountType==='school'?'校内用':'一般用';info.append(name,type);const rating=document.createElement('span');rating.className='rating';rating.textContent=r.rating;const games=document.createElement('small');games.textContent=`${r.games} 戦`;row.append(rank,info,rating,games);list.append(row);});
}
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;for(const button of document.querySelectorAll('[data-filter]'))button.setAttribute('aria-pressed',String(button===b));render();};
try{const {auth,authSDK,db,dbSDK}=await getServices();if(!auth.currentUser)await authSDK.signInAnonymously(auth);const fail=()=>{status.textContent='ランキングを取得できません。Firebase の最新ルールが公開されているか確認してください。';};dbSDK.onValue(dbSDK.ref(db,'trigBattle/profiles'),s=>{profiles=s.val()||{};render();},fail);dbSDK.onValue(dbSDK.ref(db,'trigBattle/ratings'),s=>{ratings=s.val()||{};render();},fail);}catch{status.textContent='ランキングに接続できませんでした。少し待ってから再読み込みしてください。';}
