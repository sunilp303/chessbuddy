import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {replayVariation} from '../server/variation.js';
import {MAX_VARIATION_PLIES} from '../src/limits.js';

// A long legal line from a fixed pseudo-random walk, stopping before the game ends.
function longLine(plies){
  const board=new Chess(),line=[];let seed=7;
  while(line.length<plies){
    const moves=board.moves({verbose:true});
    seed=(seed*1103515245+12345)%2147483648;
    const move=moves[seed%moves.length];
    board.move(move);
    if(board.isGameOver()){board.undo();continue;}
    line.push(move.from+move.to+(move.promotion||''));
  }
  return line;
}

test('practice lines can go well past the old 58-move limit',()=>{
  const game={positions:[new Chess().fen()]};
  const line=longLine(121);
  assert.equal(replayVariation(game,0,line).history().length,121);
  assert.equal(replayVariation(game,0,line.slice(0,120),'hint').history().length,120);
  assert.throws(()=>replayVariation(game,0,new Array(MAX_VARIATION_PLIES+3).fill('e2e4')),/maximum/);
});
