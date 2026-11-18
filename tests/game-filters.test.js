import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterGames,gameFilterOptions,timeControlLabel} from '../src/game-filters.js';

const g=(id,extra)=>({id,opponent:'Someone',opening:'Italian Game',rated:true,speed:'classical',result:'win',color:'w',status:'mate',date:Date.parse('2026-11-01T12:00:00'),opponentRating:1000,pgn:'[TimeControl "1500+5"]',...extra});
const games=[g('a'),g('b',{opponent:'Anonymous',rated:false,speed:'correspondence',pgn:'[TimeControl "-"]',opponentRating:null,result:'loss'}),
  g('c',{speed:'rapid',pgn:'[TimeControl "600+5"]',color:'b',date:Date.parse('2026-11-10T09:00:00'),opponentRating:1400}),g('d',{speed:'bullet',pgn:'[TimeControl "30+0"]'})];
const ids=list=>list.map(x=>x.id).join('');

test('time controls read like Lichess',()=>{
  assert.equal(timeControlLabel(games[0]),'25+5');assert.equal(timeControlLabel(games[1]),'Unlimited');assert.equal(timeControlLabel(games[3]),'½+0');
  assert.deepEqual(gameFilterOptions(games).timeControls,['½+0','10+5','25+5','Unlimited']);
});
test('filters by rated, registered opponents, time control and more',()=>{
  assert.equal(ids(filterGames(games,{rated:'rated',opponent:'registered'})),'acd');
  assert.equal(ids(filterGames(games,{opponent:'anonymous'})),'b');
  assert.equal(ids(filterGames(games,{timeControl:'25+5'})),'a');
  assert.equal(ids(filterGames(games,{color:'b'})),'c');
  assert.equal(ids(filterGames(games,{result:'loss'})),'b');
  assert.equal(ids(filterGames(games,{from:'2026-11-10',to:'2026-11-10'})),'c');
  assert.equal(ids(filterGames(games,{minRating:'1200'})),'c');
  assert.equal(ids(filterGames(games,{search:'ITALIAN',speed:'bullet'})),'d');
  assert.equal(ids(filterGames(games,{reviewed:'reviewed'},{c:{}})),'c');
  assert.equal(ids(filterGames(games,{})),'abcd');
});
test('win/loss summary uses the filtered games',async()=>{
  const {resultSummary}=await import('../src/game-filters.js');
  assert.deepEqual(resultSummary(games),{total:4,wins:3,losses:1,draws:0,winPct:75,lossPct:25,drawPct:0});
  assert.equal(resultSummary([]).winPct,0);
});
