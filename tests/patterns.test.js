import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {findPatterns} from '../src/patterns.js';

function gameFrom(sans,fen){
  const board=fen?new Chess(fen):new Chess(),positions=[board.fen()],moves=[];
  for(const san of sans){const m=board.move(san);moves.push({san:m.san,from:m.from,to:m.to,color:m.color});positions.push(board.fen());}
  return {positions,moves};
}
const ids=list=>list.map(p=>`${p.ply}:${p.id}`);

test('finds Scholar’s mate, its earlier threat and the defence arrow',()=>{
  const game=gameFrom(['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#']);
  const found=findPatterns(game,[]);
  assert.deepEqual(ids(found),['5:scholars-threat','6:scholars-mate']);
  assert.equal(found[0].color,'b');
  assert.ok(found[1].arrows.some(a=>a.from==='c4'&&a.to==='f7'));
});
test('finds Fool’s mate',()=>{
  assert.deepEqual(ids(findPatterns(gameFrom(['f3','e5','g4','Qh4#']))),['3:fools-mate']);
});
test('finds smothered and back-rank mates',()=>{
  assert.deepEqual(ids(findPatterns(gameFrom(['Nf7#'],'6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1'))),['0:smothered-mate']);
  assert.deepEqual(ids(findPatterns(gameFrom(['Re8#'],'6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1'))),['0:back-rank-mate']);
});
test('finds a safe knight fork but not an unsafe one',()=>{
  assert.deepEqual(ids(findPatterns(gameFrom(['Nc7+'],'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1'))),['0:knight-fork']);
  // Knight on c7 attacks a8 and e8 rooks but the queen on d8 can take it.
  assert.deepEqual(ids(findPatterns(gameFrom(['Nc7'],'r2qr1k1/8/8/1N6/8/8/8/7K w - - 0 1'))),[]);
});
test('reports a missed pattern from the engine recommendation on a flagged move',()=>{
  const game=gameFrom(['Kh1'],'6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1');
  const reviewed=[{...game.moves[0],judgment:'Blunder',before:{best:'e1e8',pv:['e1e8']}}];
  const found=findPatterns(game,reviewed);
  assert.deepEqual(ids(found),['0:missed-back-rank-mate']);
  assert.equal(found[0].arrows[0].to,'e8');
});
