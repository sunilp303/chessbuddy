export const PHASES=['Opening','Middlegame','Endgame'];
export const ERRORS=['Inaccuracy','Mistake','Blunder'];
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export const displayMetric=(n,digits=1)=>Number.isFinite(n)?n.toFixed(digits):'—';
export function opponentBand(g){
 if(!Number.isFinite(g.rating)||!Number.isFinite(g.opponentRating))return 'Unknown';
 const gap=g.opponentRating-g.rating;return gap>100?'Higher':gap< -100?'Lower':'Similar';
}
export function gamePhase(g,ply){
 const middle=g.division?.middle,end=g.division?.end;
 if(!Number.isInteger(middle))return 'Unknown';
 const movePly=ply+1;
 return movePly<middle?'Opening':Number.isInteger(end)&&movePly>=end?'Endgame':'Middlegame';
}
export function gameMetrics(game){
 const entries=game.lichess?.entries || [];
 const own=entries.filter(e=>e.color===game.color&&(Number.isFinite(e.eval)||Number.isFinite(e.mate)));
 const accuracy=game.lichess?.summary?.[game.color==='w'?'white':'black']?.accuracy;
 const summary=game.lichess?.summary?.[game.color==='w'?'white':'black'];
 return {game,entries:own.map(e=>({...e,phase:gamePhase(game,e.ply)})),phaseAccuracies:summary?.phases || {},
   accuracy:Number.isFinite(accuracy)?accuracy:null,acpl:Number.isFinite(summary?.acpl)?summary.acpl:null,
   totalOwnMoves:game.moves.filter(m=>m.color===game.color).length};
}
export function summarizeMetrics(rows,phase=null){
 const entries=rows.flatMap(r=>r.entries.filter(e=>!phase||e.phase===phase));
 const scopedRows=phase?rows.filter(r=>r.entries.some(e=>e.phase===phase)):rows;
 const accuracyValues=scopedRows.map(r=>phase?r.phaseAccuracies[phase.toLowerCase()]:r.accuracy).filter(Number.isFinite);
 const counts=Object.fromEntries(ERRORS.map(name=>[name,entries.filter(e=>e.judgment===name).length]));
 const moves=entries.length;
 return {games:rows.filter(r=>r.entries.some(e=>!phase||e.phase===phase)).length,moves,counts,
   rates:Object.fromEntries(ERRORS.map(name=>[name,moves?100*counts[name]/moves:null])),
   accuracy:mean(accuracyValues),accuracyGames:accuracyValues.length,
   acpl:phase?null:mean(scopedRows.map(r=>r.acpl).filter(Number.isFinite)),opponentRating:mean(scopedRows.map(r=>r.game.opponentRating).filter(Number.isFinite)),
   provisionalGames:scopedRows.filter(r=>r.game.provisional||r.game.opponentProvisional).length,
   wins:scopedRows.filter(r=>r.game.result==='win').length,draws:scopedRows.filter(r=>r.game.result==='draw').length};
}
function dateFor(g){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(g.date));const get=key=>parts.find(p=>p.type===key).value;return `${get('year')}-${get('month')}-${get('day')}`;}
function periodKey(g,group){const key=dateFor(g);if(group==='month')return key.slice(0,7);if(group==='game')return `${key} · ${g.id}`;const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);}
export function buildProgress(games,filters={}){
 const selected=games.filter(g=>(!filters.start||dateFor(g)>=filters.start)&&(!filters.end||dateFor(g)<=filters.end)&&(!filters.speed||filters.speed==='all'||g.speed===filters.speed)&&(!filters.band||filters.band==='all'||opponentBand(g)===filters.band)&&(!filters.excludeProvisional||(!g.provisional&&!g.opponentProvisional))&&(!filters.minOpponent||Number.isFinite(g.opponentRating)&&g.opponentRating>=Number(filters.minOpponent))&&(!filters.maxOpponent||Number.isFinite(g.opponentRating)&&g.opponentRating<=Number(filters.maxOpponent)));
 const rows=selected.filter(g=>g.lichess?.entries?.length).map(gameMetrics).sort((a,b)=>a.game.date-b.game.date||a.game.id.localeCompare(b.game.id));
 const periodMap=new Map();for(const row of rows){const key=periodKey(row.game,filters.group||'week');if(!periodMap.has(key))periodMap.set(key,[]);periodMap.get(key).push(row);}
 const periods=[...periodMap].map(([date,items])=>({date,...summarizeMetrics(items),phases:Object.fromEntries(PHASES.map(name=>[name,summarizeMetrics(items,name)]))}));
 const midpoint=Math.floor(rows.length/2),earlier=rows.slice(0,midpoint),recent=rows.slice(midpoint);
 const bands=['Lower','Similar','Higher','Unknown'].map(name=>{const items=rows.filter(r=>opponentBand(r.game)===name);return {name,...summarizeMetrics(items)};});
 const openings=new Map();for(const r of rows){const key=r.game.opening;if(!openings.has(key))openings.set(key,[]);openings.get(key).push(r);}
 return {selected: selected.length,rows,summary:summarizeMetrics(rows),periods,bands,
   partial:rows.filter(r=>r.entries.length<r.totalOwnMoves).length,unreviewed:selected.length-rows.length,
   phases:PHASES.map(name=>({name,...summarizeMetrics(rows,name)})),
   phaseTrends:PHASES.map(name=>({name,earlier:summarizeMetrics(earlier,name),recent:summarizeMetrics(recent,name)})),
   openings:[...openings].map(([name,items])=>({name,...summarizeMetrics(items,'Opening')})),
   earlier:summarizeMetrics(earlier),recent:summarizeMetrics(recent),
   comparisonBands:['Lower','Similar','Higher'].map(name=>({name,earlier:summarizeMetrics(earlier.filter(r=>opponentBand(r.game)===name)),recent:summarizeMetrics(recent.filter(r=>opponentBand(r.game)===name))})),filters};
}
export function progressReport(model,username){
 const {summary:s,earlier:a,recent:b}=model,f=displayMetric;
 const lines=[`CHESSBUDDY SKILL PROGRESS${username?' — '+username:''}`,
   `Scope: ${model.filters.scopeLabel||'All imported games'}. Filters: ${model.filters.start||'first recorded date'} through ${model.filters.end||'latest date'}; time control ${model.filters.speed||'all'}; opponent band ${model.filters.band||'all'}${model.filters.minOpponent?' ; minimum opponent '+model.filters.minOpponent:''}${model.filters.maxOpponent?' ; maximum opponent '+model.filters.maxOpponent:''}; provisional ratings ${model.filters.excludeProvisional?'excluded':'included'}.`,
   `Coverage: ${s.games} analyzed games out of ${model.selected} selected; ${s.moves} evaluated player moves; ${model.partial} partially evaluated games; ${model.unreviewed} games awaiting Lichess analysis.`,
   `Player mistakes only: ${s.counts.Inaccuracy} inaccuracies, ${s.counts.Mistake} mistakes, ${s.counts.Blunder} blunders. Per 100 evaluated moves: ${f(s.rates.Inaccuracy)}, ${f(s.rates.Mistake)}, ${f(s.rates.Blunder)} respectively.`,
   `Lichess game accuracy: ${f(s.accuracy)}% across ${s.accuracyGames} games (equal game weight); average ACPL ${f(s.acpl)}. Missing values are not zero.`,
   `Opponent rating at game time: average ${f(s.opponentRating,0)}. ${s.provisionalGames} analyzed games involve at least one provisional rating. Ratings refer to each game's Lichess time-control pool, not USCF; compare time controls separately.`,
   '',`EARLIER VS RECENT (chronological halves of analyzed games)`];
 if(a.games>=2&&b.games>=2){lines.push(`Earlier ${a.games} games: ${f(a.rates.Blunder)} blunders/100 moves, ${f(a.accuracy)}% Lichess accuracy, average opponent ${f(a.opponentRating,0)}. Recent ${b.games} games: ${f(b.rates.Blunder)} blunders/100 moves, ${f(b.accuracy)}% accuracy, average opponent ${f(b.opponentRating,0)}.`);lines.push(`Observed blunder-rate change: ${f(b.rates.Blunder-a.rates.Blunder)} per 100 moves (negative is better). This is descriptive; different opponents, positions, and a small sample may explain the change.`);}
 else lines.push('Not enough analyzed games for a useful comparison. Analyze at least four selected games.');
 lines.push('', 'OPPONENT CONTEXT (relative to player’s rating at game time; similar means within 100 points)');
 for(const band of model.bands)lines.push(`${band.name}: ${band.games} games; opponent average ${f(band.opponentRating,0)}; blunders/100 moves ${f(band.rates.Blunder)}; accuracy ${f(band.accuracy)}%; wins ${band.wins}, draws ${band.draws}.`);
 for(const band of model.comparisonBands)if(band.earlier.games>=3&&band.recent.games>=3)lines.push(`Within ${band.name.toLowerCase()}-rated opponents: earlier ${band.earlier.games} games at ${f(band.earlier.rates.Blunder)} vs recent ${band.recent.games} at ${f(band.recent.rates.Blunder)} blunders/100. Rating bands provide context, not a statistical adjustment.`);
 if(!model.comparisonBands.some(x=>x.earlier.games>=3&&x.recent.games>=3))lines.push('There are not yet three earlier and three recent games in the same known opponent band. Avoid treating the overall change as strength-adjusted improvement.');
 lines.push('', 'GAME PHASES (Lichess boundaries; unclassified moves excluded)');
 for(const p of model.phases)lines.push(`${p.name}: ${p.moves} evaluated player moves in ${p.games} games; I/M/B ${p.counts.Inaccuracy}/${p.counts.Mistake}/${p.counts.Blunder}; blunders/100 ${f(p.rates.Blunder)}; Lichess phase accuracy ${f(p.accuracy)}% across ${p.accuracyGames} games.`);
 for(const p of model.phaseTrends)if(p.earlier.games>=2&&p.recent.games>=2)lines.push(`${p.name} earlier vs recent: ${f(p.earlier.rates.Blunder)} → ${f(p.recent.rates.Blunder)} blunders/100; ${f(p.earlier.accuracy)}% → ${f(p.recent.accuracy)}% phase accuracy (${p.earlier.games} vs ${p.recent.games} games reaching this phase). Opponent mix may differ.`);
 lines.push('A high endgame score can reflect already-decided positions; it does not establish endgame mastery.');
 const unknown=model.rows.flatMap(r=>r.entries).filter(e=>e.phase==='Unknown').length;if(unknown)lines.push(`${unknown} moves have no Lichess phase boundaries and are excluded from phase comparisons.`);
 lines.push('', 'NEXT PRACTICE');
 const worst=model.phases.filter(p=>p.moves>=10).sort((x,y)=>(y.rates.Blunder-x.rates.Blunder)||(y.counts.Mistake-x.counts.Mistake))[0];
 if(worst&&worst.counts.Blunder)lines.push(`Start with ${worst.name.toLowerCase()}: ${worst.counts.Blunder} blunders in ${worst.moves} evaluated moves. Replay one flagged position, ask what the opponent threatens, and try the engine-checked alternative. This is a practice priority, not a proven weakness diagnosis.`);
 else lines.push('Review one flagged move and say what the opponent was threatening. Collect more analyzed games before naming a phase weakness.');
 const candidates=model.rows.flatMap(r=>r.entries.filter(e=>e.judgment==='Blunder'&&e.best).map(e=>({game:r.game,e}))).sort((x,y)=>Number(y.e.phase===worst?.name)-Number(x.e.phase===worst?.name)||y.game.date-x.game.date).slice(0,2);
 for(const {game:g,e} of candidates)lines.push(`Practice ${g.id}, move ${Math.floor(e.ply/2)+1}: ${e.played} → ${e.bestSan}. Opponent ${g.opponent} (${g.opponentRating??'unknown'}${g.opponentProvisional?' provisional':''}); your rating ${g.rating??'unknown'}.`);
 lines.push('Use slower games and the same time-control/opponent filters when checking again. Aim for fewer repeat errors and thoughtful explanations; rating and accuracy can be noisy.', '', 'METHOD: Error counts are imported Lichess judgments on evaluated player moves. Rates use evaluated moves, including partial games. Game accuracy is imported from Lichess, not inferred from ACPL. Phase accuracy is imported from Lichess when supplied. Displayed game and phase accuracy averages give equal weight to each available game; missing values are excluded. No opponent-rating accuracy multiplier, estimated performance rating, or causal claim is used.');
 return lines.join('\n');
}
