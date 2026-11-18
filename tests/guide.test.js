import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {normalizeGame} from '../server/chess.js';
import {scanGuideGame,buildGuideReview,guideReport,GUIDE_RULES,DEFAULT_GUIDE_SETTINGS} from '../src/guide-rules.js';
function game(moves,color='w',analysis){return normalizeGame({id:'guide-test',createdAt:Date.parse('2026-10-24T19:00:00Z'),variant:'standard',status:'resign',speed:'classical',players:{white:{user:{id:color==='w'?'testplayer':'other'}},black:{user:{id:color==='b'?'testplayer':'other'}}},moves,analysis},'testplayer');}
function custom(fen,moves,color='w',entries=[]){const b=new Chess(fen),positions=[fen],history=[];for(const san of moves.split(' ')){const m=b.move(san);history.push({san:m.san,from:m.from,to:m.to,color:m.color,captured:m.captured});positions.push(b.fen());}return {id:'custom',date:Date.parse('2026-10-24T19:00:00Z'),speed:'classical',color,positions,moves:history,lichess:{entries},opponent:'Opponent'};}
test('flags early queen and rim development but not forced queen recaptures',()=>{
 const queen=scanGuideGame(game('e4 e5 Qh5'));assert.ok(queen.events.some(e=>e.ruleId==='early-queen'&&e.ply===2));
 const rim=scanGuideGame(game('Nh3 e5'));assert.ok(rim.events.some(e=>e.ruleId==='center'));
 const recapture=scanGuideGame(game('e4 d5 exd5 Qxd5','b'));assert.equal(recapture.events.filter(e=>e.ruleId==='early-queen').length,0);
});
test('piece identity survives a return home; quiet repeats are detected',()=>{
 const scan=scanGuideGame(game('Nf3 Nf6 Ng1 Ng8 Nf3'));
 assert.ok(scan.events.some(e=>e.ruleId==='repeat-piece'&&e.ply===2));
 assert.ok(scan.events.some(e=>e.ruleId==='repeat-piece'&&e.ply===4&&e.evidence.includes('2 time')));
});
test('pawn threshold is configurable and ignores forcing capture moves',()=>{
 const g=game('a3 a6 h3 h6 b3 b6 g3');
 assert.equal(scanGuideGame(g).events.filter(e=>e.ruleId==='pawn-overuse').length,1);
 assert.equal(scanGuideGame(g,{...DEFAULT_GUIDE_SETTINGS,pawnThreshold:5}).events.filter(e=>e.ruleId==='pawn-overuse').length,0);
 const captures=game('e4 d5 exd5 Qxd5');assert.equal(scanGuideGame(captures,{...DEFAULT_GUIDE_SETTINGS,pawnThreshold:2}).events.filter(e=>e.ruleId==='pawn-overuse').length,0);
});
test('castling cue requires a legal opportunity, and castling meets the deadline',()=>{
 const g=game('e4 e5 Nf3 Nc6 Bc4 Bc5 d3');
 assert.ok(scanGuideGame(g,{...DEFAULT_GUIDE_SETTINGS,castleBy:4}).events.some(e=>e.ruleId==='castle'));
 const done=game('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O');assert.equal(scanGuideGame(done,{...DEFAULT_GUIDE_SETTINGS,castleBy:4}).events.filter(e=>e.ruleId==='castle').length,0);
 const blocked=game('a3 a6 h3 h6 b3 b6 g3');assert.equal(scanGuideGame(blocked,{...DEFAULT_GUIDE_SETTINGS,castleBy:4}).events.filter(e=>e.ruleId==='castle').length,0);
});
test('only player moves are scanned and mental rules never get an automatic verdict',()=>{
 const g=game('e4 e5 Qh5 Nf6','b'),scan=scanGuideGame(g);assert.equal(scan.events.filter(e=>e.ruleId==='early-queen').length,0);
 const mental=new Set(GUIDE_RULES.filter(r=>r.mode==='Human reflection').map(r=>r.id));assert.ok(scan.events.every(e=>!mental.has(e.ruleId)));
});
test('rook-connection review uses post-castling rook squares and accepts file connections',()=>{
 const castled=game('e4 e5 Nf3 Nc6 Bc4 Bc5 d3 d6 Nc3 Nf6 O-O O-O');
 const cue=scanGuideGame(castled,{...DEFAULT_GUIDE_SETTINGS,connectBy:6}).events.find(e=>e.ruleId==='connect-rooks');
 assert.ok(cue);assert.ok(cue.squares.includes('f1'));assert.ok(!cue.squares.includes('h1'));
 const vertical=custom('4k3/8/8/8/8/2N5/4K3/R6R w - - 0 1','Ra4 Kf7 Rha1');
 assert.equal(scanGuideGame(vertical,{...DEFAULT_GUIDE_SETTINGS,connectBy:2}).events.filter(e=>e.ruleId==='connect-rooks').length,0);
});
test('loose-material cue requires Lichess criticism plus an undefended immediate capture',()=>{
 const fen='4k3/8/8/8/8/8/q3R3/4K3 w - - 0 1';
 // Move the rook off the second rank, leaving it capturable without a defender.
 const g=custom(fen,'Re4 Qe6');
 assert.equal(scanGuideGame(g).events.filter(e=>e.ruleId==='loose').length,0);
 const h=custom('4k3/8/8/8/8/8/q3R3/4K3 w - - 0 1','Rf2 Qxf2+', 'w',[{judgment:'Blunder'}]);
 // f2 is defended by the king on e1, so this must not be called loose.
 assert.equal(scanGuideGame(h).events.filter(e=>e.ruleId==='loose').length,0);
 const loose=custom('4k3/8/8/8/8/8/q3R3/4K3 w - - 0 1','Rh2 Qxh2', 'w',[{judgment:'Blunder'}]);
 assert.ok(scanGuideGame(loose).events.some(e=>e.ruleId==='loose'&&e.squares.includes('h2')));
});
test('equal-value trade while behind is a cue, not a proven mistake',()=>{
 const g=custom('4k2q/8/8/2n5/1B6/8/8/4K3 w - - 0 1','Bxc5 Qh6');
 assert.equal(scanGuideGame(g).events.filter(e=>e.ruleId==='trade-material').length,0);
 const exchange=custom('4k2q/8/1p6/2n5/1B6/8/8/4K3 w - - 0 1','Bxc5 bxc5');
 const event=scanGuideGame(exchange).events.find(e=>e.ruleId==='trade-material');assert.ok(event);assert.equal(event.materialBalance,-10);assert.equal(event.judgment,null);assert.match(event.evidence,/still be correct/);
});
test('engine-suggested queen chase is checked for legality and direct attack',()=>{
 const positive=game('e4 e5 Nc3 Qh4 a3','w',[{eval:0},{eval:0},{eval:0},{eval:0},{eval:-150,best:'g2g3',variation:'g3',judgment:{name:'Blunder'}}]);
 assert.ok(scanGuideGame(positive).events.some(e=>e.ruleId==='queen-chase'&&e.bestSan==='g3'));
 const g=game('e4 e5 Nf3 Qh4 a3','w',[{eval:0},{eval:0},{eval:0},{eval:0},{eval:-150,best:'f3h4',variation:'Nxh4',judgment:{name:'Blunder'}}]);
 // A recommendation capturing the queen is an attack on its former square only
 // through occupation, and must not be mislabeled as a tempo-gaining chase.
 assert.equal(scanGuideGame(g).events.filter(e=>e.ruleId==='queen-chase').length,0);
});
test('date filtering, rule grouping, human reflections and app thresholds remain explicit',()=>{
 const g=game('e4 e5 Qh5'),model=buildGuideReview([g]);assert.equal(model.scans.length,1);assert.ok(model.rules.some(r=>r.id==='early-queen'&&r.count===1));
 assert.equal(buildGuideReview([g],DEFAULT_GUIDE_SETTINGS,{start:'2026-10-25'}).scans.length,0);
 const report=guideReport(model,{'x':{gameId:g.id,ply:2,ruleId:'candidates',answer:'did-not-follow',note:'Only considered one move.'}});
 assert.match(report,/These are not chess-rule violations/);assert.match(report,/self-reported/);assert.match(report,/opening window 10 own moves/);assert.match(report,/Only considered one move/);
});
