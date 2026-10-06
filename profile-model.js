import {initialRating} from './rating-model.js';
export function registerProfileState(state,uid,profile,now) {
  if(state.profiles?.[uid])return {type:'existing',profile:state.profiles[uid]};
  const key='u_'+profile.publicProfile.username.toLowerCase();
  if(state.usernames?.[key]&&state.usernames[key]!==uid)return {type:'conflict'};
  state.profiles??={};state.privateProfiles??={};state.ratings??={};state.usernames??={};
  const saved={...profile.publicProfile,createdAt:now};
  state.profiles[uid]=saved;state.privateProfiles[uid]=profile.privateProfile;
  state.ratings[uid]=initialRating();state.usernames[key]=uid;
  return {type:'created',profile:saved};
}
