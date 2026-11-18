export const DEFAULT_SCOPE={mode:'all',gameId:'',month:'',year:'',start:'',end:''};
export function scopeDate(timestamp){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));}
export function resolveScope(games,input={}){
 const scope={...DEFAULT_SCOPE,...input};let start='',end='',label='All imported games',error='';
 if(scope.mode==='game'){
  const game=games.find(g=>g.id===scope.gameId);if(!game)error='Choose a game.';
  else{start=end=scopeDate(game.date);label=`Game ${game.id} · vs ${game.opponent} · ${start}`;}
 }else if(scope.mode==='month'){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(scope.month))error='Choose a calendar month.';
  else{const [year,month]=scope.month.split('-').map(Number);start=scope.month+'-01';end=scope.month+'-'+new Date(Date.UTC(year,month,0)).getUTCDate();label=`Calendar month ${scope.month}`;}
 }else if(scope.mode==='year'){
  if(!/^\d{4}$/.test(String(scope.year))||+scope.year<1900||+scope.year>9999)error='Choose a year from 1900 to 9999.';
  else{start=scope.year+'-01-01';end=scope.year+'-12-31';label=`Calendar year ${scope.year}`;}
 }else if(scope.mode==='custom'){
  start=scope.start;end=scope.end;
  if([start,end].some(d=>d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)))error='Choose valid dates.';
  else if(start&&end&&start>end)error='Start date must be on or before end date.';
  label=`Custom dates ${start||'first'} through ${end||'latest'}`;
 }else if(scope.mode!=='all')error='Choose a valid review scope.';
 const selected=error?[]:games.filter(g=>(scope.mode!=='game'||g.id===scope.gameId)&&(!start||scopeDate(g.date)>=start)&&(!end||scopeDate(g.date)<=end));
 return {...scope,start,end,label,error,games:selected};
}
