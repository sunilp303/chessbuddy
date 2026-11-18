import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {normalizeGame,whiteScore,makeLesson,moveFromUci} from '../server/chess.js';
import {Engine} from '../server/engine.js';

function raw(overrides={}){return {id:'test1234',variant:'standard',status:'mate',players:{white:{user:{id:'testplayer'}},black:{user:{id:'other',name:'Other'}}},winner:'black',moves:'f3 e5 g4 Qh4#',...overrides};}
test('imports only completed standard games for this player',()=>{
 assert.equal(normalizeGame(raw({status:'started'}),'testplayer'),null);
 assert.equal(normalizeGame(raw({variant:'chess960'}),'testplayer'),null);
 assert.equal(normalizeGame(raw({players:{white:{user:{id:'a'}},black:{user:{id:'b'}}}}),'testplayer'),null);
 const g=normalizeGame(raw(),'testplayer');assert.equal(g.result,'loss');assert.equal(g.positions.length,5);assert.ok(new Chess(g.positions[4]).isCheckmate());
 const black=normalizeGame(raw({players:{black:{user:{id:'testplayer'}},white:{user:{id:'other'}}}}),'testplayer');assert.equal(black.color,'b');assert.equal(black.result,'win');
});
test('scores use white perspective and preserve mate direction',()=>{
 assert.equal(whiteScore({type:'cp',value:120},'b'),-120);
 assert.ok(whiteScore({type:'mate',value:-3},'b')>0);
 assert.ok(whiteScore({type:'mate',value:2},'w')>whiteScore({type:'mate',value:4},'w'));
});
test('lessons validate legal engine moves and ignore small differences',()=>{
 const g=normalizeGame(raw(),'testplayer');
 const before={white:20,best:'e2e4',pv:['e2e4'],depth:12};
 assert.equal(makeLesson(g,0,before,{white:-30}),null);
 const l=makeLesson(g,0,before,{white:-200});assert.equal(l.bestSan,'e4');assert.equal(l.played,'f3');
 assert.equal(makeLesson(g,0,{...before,best:'a1a8'},{white:-300}),null);
});
test('local Stockfish returns a legal forced mate and terminates',async()=>{
 const engine=new Engine();try{await engine.ready();const b=new Chess();['f3','e5','g4'].forEach(m=>b.move(m));const result=await engine.evaluate(b.fen());assert.equal(moveFromUci(b,result.best).san,'Qh4#');assert.ok(result.white<0);const terminal=await engine.evaluate(b.fen());assert.ok(terminal.white<0);}finally{engine.close();}
});
