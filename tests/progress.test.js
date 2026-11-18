import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGame} from '../server/chess.js';
import {buildProgress,gamePhase,opponentBand,progressReport,gameMetrics} from '../src/progress-utils.js';
function game(id='a',day=1,overrides={}){
 return normalizeGame({id,createdAt:new Date(2026,9,day,12).getTime(),rated:true,variant:'standard',status:'resign',speed:'classical',
 players:{white:{user:{id:'testplayer'},rating:1000,analysis:{accuracy:80,acpl:50,phases:{opening:70,middlegame:80,endgame:90}}},black:{user:{id:'opponent',name:'Opponent'},rating:1200}},
 division:{middle:3,end:7},moves:'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6',winner:'white',opening:{name:'Ruy Lopez'},
 analysis:[{eval:10,judgment:{name:'Blunder'}},{eval:20,judgment:{name:'Blunder'}},{eval:10,judgment:{name:'Mistake'}},{eval:20},{eval:10,judgment:{name:'Inaccuracy'}},{eval:20},{eval:10},{eval:20}],...overrides},'testplayer');
}
test('preserves game-time player/opponent ratings, provisional flags, phases, accuracy',()=>{
 const g=game();assert.equal(g.opponentRating,1200);assert.equal(g.rating,1000);assert.equal(g.lichess.summary.white.accuracy,80);assert.equal(g.division.middle,3);assert.equal(g.provisional,false);assert.equal(g.rated,true);
 assert.equal(gamePhase(g,0),'Opening');assert.equal(gamePhase(g,2),'Middlegame');assert.equal(gamePhase(g,6),'Endgame');assert.equal(gamePhase({...g,division:null},0),'Unknown');
});
test('uses only evaluated player moves; rates normalize move count and phases use supplied accuracy',()=>{
 const m=buildProgress([game()]);assert.equal(m.summary.moves,4);assert.deepEqual(m.summary.counts,{Inaccuracy:1,Mistake:1,Blunder:1});assert.equal(m.summary.rates.Blunder,25);assert.equal(m.summary.accuracy,80);
 assert.equal(m.phases[0].moves,1);assert.equal(m.phases[0].accuracy,70);assert.equal(m.phases[1].moves,2);assert.equal(m.phases[1].counts.Mistake,1);assert.equal(m.phases[2].accuracy,90);
 assert.equal(m.phases[0].acpl,null);
 assert.equal(m.periods[0].phases.Opening.rates.Blunder,100);
});
test('Los Angeles date grouping is consistent around UTC midnight',()=>{
 const g={...game(),date:Date.parse('2026-10-02T02:00:00Z')};
 assert.equal(buildProgress([g],{start:'2026-10-01',end:'2026-10-01'}).selected,1);
 assert.equal(buildProgress([g],{start:'2026-10-02',end:'2026-10-02'}).selected,0);
});
test('missing/partial analysis and missing phase data are not zero scores',()=>{
 const g=game();const missing={...g,id:'missing',lichess:null};
 const partial={...g,id:'partial',division:null,lichess:{...g.lichess,entries:g.lichess.entries.slice(0,2),summary:{white:{}}}};
 const m=buildProgress([missing,partial]);assert.equal(m.selected,2);assert.equal(m.unreviewed,1);assert.equal(m.partial,1);assert.equal(m.summary.moves,1);assert.equal(m.summary.accuracy,null);assert.equal(m.phases[0].moves,0);assert.equal(m.phases[0].rates.Blunder,null);
 assert.match(progressReport(m),/lack|no Lichess phase boundaries/);
});
test('opponent bands use historical rating gap including exact ±100 boundaries',()=>{
 const g=game();assert.equal(opponentBand(g),'Higher');assert.equal(opponentBand({...g,opponentRating:1100}),'Similar');assert.equal(opponentBand({...g,opponentRating:900}),'Similar');assert.equal(opponentBand({...g,opponentRating:899}),'Lower');assert.equal(opponentBand({...g,opponentRating:null}),'Unknown');
});
test('filters inclusive dates, time controls, opponent ranges and provisional games',()=>{
 const a=game('a',1),b={...game('b',10),speed:'rapid'},c={...game('c',11),provisional:true};
 assert.equal(buildProgress([a,b,c],{start:'2026-10-01',end:'2026-10-01'}).selected,1);
 assert.equal(buildProgress([a,b,c],{speed:'classical',excludeProvisional:true}).selected,1);
 assert.equal(buildProgress([a,b,c],{band:'Lower'}).selected,0);
 assert.equal(buildProgress([a,b,c],{minOpponent:'1201'}).selected,0);
 assert.equal(buildProgress([a,b,c],{maxOpponent:'1200'}).selected,3);
 assert.equal(buildProgress([a,b,c],{group:'month'}).periods.length,1);
});
test('reports earlier/recent and comparable opponent cohorts without inventing adjustments',()=>{
 const games=Array.from({length:6},(_,i)=>game(String(i),i+1));const m=buildProgress(games,{speed:'classical'}),r=progressReport(m);
 assert.equal(m.earlier.games,3);assert.equal(m.recent.games,3);assert.equal(m.comparisonBands[2].earlier.games,3);
 assert.match(r,/Within higher-rated opponents/);assert.match(r,/Opening earlier vs recent/);assert.match(r,/Rating bands provide context, not a statistical adjustment/);
 const small=progressReport(buildProgress([games[0]]));assert.match(small,/Not enough analyzed games/);assert.match(small,/not yet three earlier/);
});
test('uses black player accuracy and excludes opponent judgments for black games',()=>{
 const g=game('black',1,{players:{white:{user:{id:'other'},rating:1500,analysis:{accuracy:99}},black:{user:{id:'testplayer'},rating:900,provisional:true,analysis:{accuracy:55,phases:{opening:40}}}}});
 const row=gameMetrics(g);assert.equal(row.accuracy,55);assert.equal(g.opponentRating,1500);assert.equal(g.provisional,true);assert.equal(row.entries.length,4);assert.equal(buildProgress([g]).summary.counts.Blunder,1);
});
