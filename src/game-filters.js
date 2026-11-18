export const DEFAULT_GAME_FILTERS={rated:'all',opponent:'all',timeControl:'all',speed:'all',result:'all',color:'all',ending:'all',reviewed:'all',from:'',to:'',minRating:'',maxRating:'',search:''};

const endings={mate:'Checkmate',resign:'Resignation',timeout:'Time / left the game',outoftime:'Ran out of time',draw:'Draw',stalemate:'Stalemate',cheat:'Cheat detected',noStart:'Did not start',variantEnd:'Variant end'};

// Lichess PGN stores "1500+5" (seconds + increment); show it the way Lichess does, as "25+5".
export function timeControlLabel(game){
  const raw=game.pgn?.match(/\[TimeControl "([^"]*)"\]/)?.[1];
  if(!raw)return null;
  const match=raw.match(/^(\d+)\+(\d+)$/);
  if(!match)return 'Unlimited';
  const seconds=Number(match[1]),minutes=seconds/60;
  const base=seconds===15?'¼':seconds===30?'½':seconds===45?'¾':Number.isInteger(minutes)?String(minutes):minutes.toFixed(1);
  return `${base}+${match[2]}`;
}

export const endingLabel=status=>endings[status]||status;

const distinct=values=>[...new Set(values.filter(Boolean))];

export function gameFilterOptions(games){
  const minutes=label=>label==='Unlimited'?Infinity:label.startsWith('¼')?.25:label.startsWith('½')?.5:label.startsWith('¾')?.75:parseFloat(label);
  return {
    timeControls:distinct(games.map(timeControlLabel)).sort((a,b)=>minutes(a)-minutes(b)||a.localeCompare(b,undefined,{numeric:true})),
    speeds:distinct(games.map(g=>g.speed)),
    endings:distinct(games.map(g=>g.status))
  };
}

const dayStart=value=>value?new Date(value+'T00:00:00').getTime():null;

export function filterGames(games,filters,analyses={}){
  const f={...DEFAULT_GAME_FILTERS,...filters};
  const from=dayStart(f.from),to=dayStart(f.to),min=f.minRating===''?null:Number(f.minRating),max=f.maxRating===''?null:Number(f.maxRating);
  const search=f.search.trim().toLowerCase();
  return games.filter(g=>{
    const anonymous=!g.opponent||g.opponent==='Anonymous';
    if(f.rated==='rated'&&!g.rated)return false;
    if(f.rated==='casual'&&g.rated)return false;
    if(f.opponent==='registered'&&anonymous)return false;
    if(f.opponent==='anonymous'&&!anonymous)return false;
    if(f.timeControl!=='all'&&timeControlLabel(g)!==f.timeControl)return false;
    if(f.speed!=='all'&&g.speed!==f.speed)return false;
    if(f.result!=='all'&&g.result!==f.result)return false;
    if(f.color!=='all'&&g.color!==f.color)return false;
    if(f.ending!=='all'&&g.status!==f.ending)return false;
    if(f.reviewed==='reviewed'&&!analyses[g.id])return false;
    if(f.reviewed==='not-reviewed'&&analyses[g.id])return false;
    if(from!==null&&g.date<from)return false;
    if(to!==null&&g.date>=to+86400000)return false;
    if((min!==null||max!==null)&&!Number.isFinite(g.opponentRating))return false;
    if(min!==null&&g.opponentRating<min)return false;
    if(max!==null&&g.opponentRating>max)return false;
    if(search&&!`${g.opponent} ${g.opening}`.toLowerCase().includes(search))return false;
    return true;
  });
}

export const activeFilterCount=filters=>Object.entries({...DEFAULT_GAME_FILTERS,...filters}).filter(([key,value])=>value!==DEFAULT_GAME_FILTERS[key]).length;

export function resultSummary(games){
  const count=result=>games.filter(g=>g.result===result).length;
  const total=games.length,percent=n=>total?Math.round(n/total*100):0;
  const wins=count('win'),losses=count('loss'),draws=count('draw');
  return {total,wins,losses,draws,winPct:percent(wins),lossPct:percent(losses),drawPct:percent(draws)};
}
