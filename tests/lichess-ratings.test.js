import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {normalizeGame,mergeLichessReview,moveFromUci,preserveLichessAnalysis} from '../server/chess.js';
import {reviewMoves,recommendedLine} from '../src/game-review.js';
import {normalizeRatingHistory,validateUSCF} from '../server/ratings.js';
import {presetRange,filterPoints,lichessRatingSeries,ratingSummary} from '../src/rating-utils.js';

test('rating fallback uses the latest rated game per day and preserves official series',()=>{
 const game={rated:true,speed:'classical',rating:1000,date:Date.parse('2026-10-25T03:00:00Z')};
 const history=[{name:'rapid',points:[{date:'2026-10-24',rating:900}]}];
 const games=[{...game,rating:1010,date:game.date+60000},game,{...game,rated:false,rating:1200},{...game,speed:'rapid'}];
 const [rapid,classical]=lichessRatingSeries(history,games);
 assert.deepEqual(rapid,history[0]);
 assert.equal(classical.fromGames,true);
 assert.deepEqual(classical.points.map(({date,rating})=>({date,rating})),[{date:'2026-10-24',rating:1010}]);
});

const raw={id:'test1234',variant:'standard',status:'mate',players:{white:{user:{id:'testplayer'},analysis:{blunder:1,acpl:100}},black:{user:{id:'other'}}},moves:'f3 e5 g4 Qh4#',winner:'black',analysis:[
 {eval:-40,best:'e2e4',variation:'e4 e5 Nf3',judgment:{name:'Inaccuracy',comment:'e4 was best.'}},
 {eval:-30},
 {mate:-1,best:'g2g3',variation:'g3 d5',judgment:{name:'Blunder',comment:'Checkmate is now unavoidable.'}},
 {mate:0}
]};

test('review compares the exact pre-move board and fills a missing recommendation with Stockfish',()=>{
 const game=normalizeGame({...raw,analysis:[{eval:-40,variation:'e4 e5 Nf3',judgment:{name:'Inaccuracy'}},{eval:-30},{mate:-1,judgment:{name:'Blunder'}}]},'testplayer');
 const reviews=reviewMoves(game,{evaluations:[null,null,{best:'g2g3',pv:['g2g3','d7d5'],white:-30},{white:-99900}]});
 assert.equal(recommendedLine(game.positions[0],reviews[0]).frames[0].san,'e4');
 assert.equal(reviews[2].beforeScore.eval,-30);
 assert.equal(reviews[2].afterScore.mate,-1);
 const line=recommendedLine(game.positions[2],reviews[2]);
 assert.equal(line.source,'Stockfish');
 assert.deepEqual(line.frames.map(frame=>frame.san),['g3','d5']);
 assert.equal(new Chess(line.frames[0].fen).get('g3').type,'p');
 assert.equal(reviews[2].judgmentSource,'Lichess');
 const lean=normalizeGame({...raw,analysis:[{eval:-42}]},'testplayer');
 assert.equal(preserveLichessAnalysis(lean,game).entries[0].variationUci[0],'e2e4');
});
test('imports post-move evaluations and pre-move alternatives without an off-by-one error',()=>{
 const game=normalizeGame(raw,'testplayer'),entries=game.lichess.entries;
 assert.equal(entries[0].played,'f3');assert.equal(entries[0].bestSan,'e4');assert.equal(entries[0].eval,-40);
 assert.deepEqual(entries[0].variation,['e4','e5','Nf3']);assert.equal(entries[2].bestSan,'g3');assert.equal(entries[2].mate,-1);
 assert.equal(entries[3].mate,0);assert.equal(game.lichess.complete,true);assert.equal(game.lichess.summary.white.acpl,100);
 const review=mergeLichessReview(game,{evaluations:[{white:10}],lessons:[]});
 assert.equal(review.lessons.length,2);assert.equal(review.lessons[1].ply,2);assert.equal(review.lessons[1].source,'Lichess computer analysis');assert.equal(review.evaluations.length,1);
});
test('all flagged own moves become exercises; opponent annotations stay in game review',()=>{
 const game=normalizeGame({...raw,players:{white:{user:{id:'other'}},black:{user:{id:'testplayer'}}}},'testplayer');
 assert.equal(game.lichess.entries.filter(e=>e.judgment).length,2);assert.equal(mergeLichessReview(game).lessons.length,0);
});
test('rejects illegal recommendations and mismatched lines, handles incomplete exports',()=>{
 const game=normalizeGame({...raw,analysis:[{eval:0,best:'a1a8',variation:'e4 e5',judgment:{name:'Blunder'}}]},'testplayer');
 assert.equal(game.lichess.complete,false);assert.equal(game.lichess.entries[0].best,null);assert.deepEqual(game.lichess.entries[0].variation,[]);assert.equal(mergeLichessReview(game).lessons.length,0);
 const mismatch=normalizeGame({...raw,analysis:[{eval:0,best:'e2e4',variation:'d4 d5'}]},'testplayer');assert.deepEqual(mismatch.lichess.entries[0].variation,[]);
});
test('normalizes Lichess king-to-rook castling to a legal practice move',()=>{
 const b=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert.equal(moveFromUci(b,'e1h1').san,'O-O');assert.equal(moveFromUci(b,'e8a8').san,'O-O-O');
});
test('Lichess history uses zero-based months and preserves separate series',()=>{
 const result=normalizeRatingHistory([{name:'classical',points:[[2026,9,24,1243],[2026,0,1,900]]},{name:'rapid',points:[]}]);
 assert.deepEqual(result[0].points,[{date:'2026-01-01',rating:900},{date:'2026-10-24',rating:1243}]);assert.equal(result[1].name,'rapid');
});
test('USCF entries require real dates, valid type and numeric whole-number ratings',()=>{
 assert.throws(()=>validateUSCF({date:'2026-02-30',type:'Regular',rating:800}));
 assert.throws(()=>validateUSCF({date:'2026-10-24',type:'Other',rating:800}));
 assert.throws(()=>validateUSCF({date:'2026-10-24',type:'Regular',rating:'800'}));
 assert.throws(()=>validateUSCF({date:'2026-10-24',type:'Regular',rating:800.5}));
 assert.equal(validateUSCF({date:'2024-02-29',type:'Regular',rating:850,provisional:true}).provisional,true);
});
test('date presets, inclusive custom ranges and trend summaries',()=>{
 const today=new Date(2026,9,24,12);
 assert.deepEqual(presetRange('week',today),{start:'2026-10-18',end:'2026-10-24'});
 assert.deepEqual(presetRange('month',today),{start:'2026-09-25',end:'2026-10-24'});
 assert.deepEqual(presetRange('ytd',today),{start:'2026-01-01',end:'2026-10-24'});
 assert.deepEqual(presetRange('previous',today),{start:'2025-01-01',end:'2025-12-31'});
 const points=filterPoints([{date:'2026-10-24',rating:900},{date:'2026-10-01',rating:800},{date:'2026-09-01',rating:1000}],'2026-10-01','2026-10-24');
 assert.equal(points.length,2);assert.equal(ratingSummary(points).change,100);assert.equal(ratingSummary([]),null);assert.equal(ratingSummary(points.slice(0,1)).count,1);
});
