import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveScope,scopeDate} from '../src/scope.js';
import {normalizeGame} from '../server/chess.js';
import {replayVariation} from '../server/variation.js';

const games=[{id:'a',date:Date.parse('2024-02-29T20:00:00Z'),opponent:'A'},{id:'b',date:Date.parse('2024-03-01T20:00:00Z'),opponent:'B'},{id:'c',date:Date.parse('2026-10-24T20:00:00Z'),opponent:'C'},{id:'d',date:Date.parse('2026-10-24T21:00:00Z'),opponent:'D'}];
test('scope selects exactly one game, all games, calendar months and years',()=>{
 assert.equal(resolveScope(games,{mode:'all'}).games.length,4);
 const one=resolveScope(games,{mode:'game',gameId:'c'});assert.deepEqual(one.games.map(g=>g.id),['c']);assert.equal(one.start,'2026-10-24');assert.equal(one.end,one.start);
 const feb=resolveScope(games,{mode:'month',month:'2024-02'});assert.equal(feb.end,'2024-02-29');assert.deepEqual(feb.games.map(g=>g.id),['a']);
 assert.deepEqual(resolveScope(games,{mode:'year',year:'2024'}).games.map(g=>g.id),['a','b']);
 assert.equal(resolveScope(games,{mode:'year',year:'2025'}).games.length,0);
 assert.equal(scopeDate(Date.parse('2026-10-25T02:00:00Z')),'2026-10-24');
});
test('invalid scopes are empty and custom ranges are inclusive',()=>{
 for(const s of [{mode:'game',gameId:'missing'},{mode:'month',month:'2026-13'},{mode:'year',year:'26'},{mode:'custom',start:'2026-02-30'},{mode:'custom',start:'2026-10-25',end:'2026-10-24'}]){const r=resolveScope(games,s);assert.ok(r.error);assert.equal(r.games.length,0);}
 assert.equal(resolveScope(games,{mode:'custom',start:'2026-10-24',end:'2026-10-24'}).games.length,2);
});
function game(){return normalizeGame({id:'mate',variant:'standard',status:'mate',players:{white:{user:{id:'testplayer'}},black:{user:{id:'other'}}},moves:'f3 e5 g4 Qh4#'},'testplayer');}
test('variation replay uses an imported position, validates every move and terminal states',()=>{
 const g=game();const b=replayVariation(g,2,['g2g4']);assert.equal(b.turn(),'b');assert.ok(!b.isGameOver());
 const terminal=replayVariation(g,3,['d8h4']);assert.ok(terminal.isCheckmate());
 for(const [ply,moves] of [[-1,['e2e4']],[99,['e2e4']],[0,[]],[0,['e2e4','e7e5']],[0,['e2e9']],[0,['b1b5']],[4,['a2a3']]])assert.throws(()=>replayVariation(g,ply,moves));
});
