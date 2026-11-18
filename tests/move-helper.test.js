import {test} from 'node:test';
import assert from 'node:assert/strict';
import {helperFeedback} from '../src/move-helper.js';

const hint={best:{uci:'e2e4',san:'e4'},white:40,score:{type:'cp',value:40}};

test('helper praises Stockfish’s own move',()=>{
  assert.equal(helperFeedback({hint,played:'e2e4',playedSan:'e4',side:'w',after:{white:35}}).tone,'good');
});
test('helper treats a near-equal move as good and names the top choice',()=>{
  const note=helperFeedback({hint,played:'d2d4',playedSan:'d4',side:'w',after:{white:20,score:{type:'cp',value:-20}}});
  assert.equal(note.tone,'good');assert.match(note.text,/top choice was e4/);
});
test('helper points out a better move after a clear loss, from either side',()=>{
  assert.equal(helperFeedback({hint,played:'g2g4',playedSan:'g4',side:'w',after:{white:-150,score:{type:'cp',value:150}}}).tone,'better');
  const black={best:{uci:'e7e5',san:'e5'},white:-30,score:{type:'cp',value:30}};
  assert.equal(helperFeedback({hint:black,played:'f7f6',playedSan:'f6',side:'b',after:{white:120,score:{type:'cp',value:120}}}).tone,'better');
  assert.equal(helperFeedback({hint:black,played:'e7e6',playedSan:'e6',side:'b',after:{white:-10,score:{type:'cp',value:-10}}}).tone,'good');
});
test('helper reports checkmate and stays quiet without a hint',()=>{
  assert.match(helperFeedback({hint,played:'d1h5',playedSan:'Qxf7#',side:'w',checkmate:true}).text,/checkmate/);
  assert.equal(helperFeedback({hint:null,played:'e2e4',playedSan:'e4',side:'w'}),null);
});
