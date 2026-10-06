import {validRoom,progress,outcome,COUNTDOWN_MS} from './battle-engine.js';
export const INITIAL_RATING=1500,K_FACTOR=32;
export function initialRating(){return {rating:INITIAL_RATING,games:0,wins:0,losses:0,draws:0};}
export function elo(a,b,scoreA){
  if(![a,b].every(Number.isFinite)||![0,.5,1].includes(scoreA))throw Error('Invalid Elo input');
  const delta=Math.round(K_FACTOR*(scoreA-1/(1+10**((b-a)/400))));
  return {a:a+delta,b:b-delta,delta};
}
function updateRating(current,next,score){return {...current,rating:next,games:current.games+1,wins:current.wins+(score===1?1:0),losses:current.losses+(score===0?1:0),draws:current.draws+(score===.5?1:0)};}
// Called in one Admin SDK transaction: profiles, both ratings, and settlement
// commit together. A repeated event cannot award the same match twice.
export function settleRating(state,roomId,now) {
  const room=state?.rooms?.[roomId];
  if(!validRoom(room)||room.settlement||room.status==='invited')return false;
  const result=outcome(room);
  if(!result)return false;
  const profileA=state.profiles?.[room.from],profileB=state.profiles?.[room.to];
  const ranked=room.ranked===true&&profileA&&profileB&&room.status!=='cancelled'
    &&(result.type!=='forfeit'||(Number.isFinite(room.cancelledAt)&&room.cancelledAt>=room.acceptedAt+COUNTDOWN_MS));
  const settlement={rated:!!ranked,type:result.type,winner:result.winner||null,at:now};
  if(ranked) {
    const a=state.ratings?.[room.from]||initialRating(),b=state.ratings?.[room.to]||initialRating();
    const score=result.type==='draw'?.5:result.winner===room.from?1:0;
    const change=elo(a.rating,b.rating,score);
    state.ratings??={};state.ratings[room.from]=updateRating(a,change.a,score);state.ratings[room.to]=updateRating(b,change.b,1-score);
    settlement.players={
      [room.from]:{before:a.rating,after:change.a,delta:change.delta},
      [room.to]:{before:b.rating,after:change.b,delta:-change.delta},
    };
  }
  room.settlement=settlement;return true;
}
