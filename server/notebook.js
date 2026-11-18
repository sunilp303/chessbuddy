import { DEFAULT_GUIDE_SETTINGS } from '../src/guide-rules.js';

export function createNotebook(){
  return {username:null, games:[], analyses:{}, practice:{}, lastSync:null, lichessProfiles:{},
    ratings:{lichess:[],uscf:[],lastSync:null},
    guide:{settings:{...DEFAULT_GUIDE_SETTINGS},reflections:{}},
    learning:{puzzles:{},progress:{}}};
}

export function accountData(state) {
  return {
    games:state.games, analyses:state.analyses, practice:state.practice, lastSync:state.lastSync,
    lichessRatings:state.ratings.lichess, ratingSync:state.ratings.lastSync, reflections:state.guide.reflections
  };
}
export function activateAccount(state,username) {
  const {lichessProfiles}=state;
  const profile=username && Object.hasOwn(lichessProfiles,username) ? lichessProfiles[username] : null;
  state.username=username;
  state.games=profile?.games ?? [];
  state.analyses=profile?.analyses ?? {};
  state.practice=profile?.practice ?? {};
  state.lastSync=profile?.lastSync ?? null;
  state.ratings.lichess=profile?.lichessRatings ?? [];
  state.ratings.lastSync=profile?.ratingSync ?? null;
  state.guide.reflections=profile?.reflections ?? {};
  if(profile)delete lichessProfiles[username];
}
