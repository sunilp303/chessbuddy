import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {LESSONS,lessonById,studyFrames} from '../src/lesson-catalog.js';
import {normalizePuzzle,checkPuzzleAttempt,replayLesson} from '../src/lesson-puzzles.js';

const mate={game:{id:'source',pgn:'f3 e5 g4'},puzzle:{id:'fixture-mate',initialPly:2,rating:800,solution:['d8h4'],themes:['mateIn1']}};
test('catalog has unique IDs, teaching content and legal non-terminal study starts',()=>{
 assert.equal(LESSONS.length,89);assert.equal(new Set(LESSONS.map(l=>l.id)).size,89);
 for(const lesson of LESSONS){assert.ok(lesson.idea&&lesson.example&&lesson.question&&lesson.hint);if(lesson.kind==='study'){const frames=studyFrames(lesson);assert.ok(frames.length>1);assert.ok(!new Chess(frames[0].fen).isGameOver(),lesson.id);frames.forEach(f=>assert.ok(new Chess(f.fen)));}}
 assert.ok(new Chess(studyFrames(lessonById('calculation')).at(-1).fen).isCheckmate());
 for(const id of ['queen-king-mate','rook-king-mate','ladder-mate','counter-check'])assert.ok(new Chess(studyFrames(lessonById(id)).at(-1).fen).isCheckmate(),id);
 assert.ok(new Chess(studyFrames(lessonById('avoid-stalemate')).at(-1).fen).isStalemate());
});
test('puzzle import uses the position after initialPly and validates the whole line',()=>{
 const p=normalizePuzzle(mate,'mateIn1');assert.equal(new Chess(p.fen).turn(),'b');assert.deepEqual(p.san,['Qh4#']);assert.equal(p.source,'https://lichess.org/training/fixture-mate');
 assert.throws(()=>normalizePuzzle(mate,'fork'));
 assert.throws(()=>normalizePuzzle({...mate,puzzle:{...mate.puzzle,solution:['d8d4']}},'mateIn1'));
 assert.throws(()=>normalizePuzzle({...mate,puzzle:{...mate.puzzle,initialPly:200}},'mateIn1'));
});
test('puzzle attempts distinguish a legal alternative, illegal moves, and completion',()=>{
 const p=normalizePuzzle(mate,'mateIn1'),wrong=checkPuzzleAttempt(p,['b8c6']);assert.equal(wrong.correct,false);assert.equal(wrong.fen,p.fen);
 assert.throws(()=>checkPuzzleAttempt(p,['b8b5']));assert.throws(()=>checkPuzzleAttempt(p,[]));assert.throws(()=>checkPuzzleAttempt(p,['b8c6','e1f2']));
 const result=checkPuzzleAttempt(p,['d8h4']);assert.equal(result.complete,true);assert.equal(result.correct,true);assert.ok(new Chess(result.fen).isCheckmate());
});
test('multi-move puzzles play the published reply and validate every prefix',()=>{
 const b=new Chess();['e4','e5','Nf3'].forEach(m=>b.move(m));
 const p={fen:b.fen(),solution:['b8c6','f1b5','a7a6']};
 const first=checkPuzzleAttempt(p,['b8c6']);assert.equal(first.reply.san,'Bb5');assert.equal(first.complete,false);assert.deepEqual(first.moves,['b8c6','f1b5']);
 const last=checkPuzzleAttempt(p,[...first.moves,'a7a6']);assert.equal(last.complete,true);
 assert.throws(()=>checkPuzzleAttempt(p,['g8f6','f1b5','a7a6']));
});
test('lesson engine branches validate moves and cannot continue after checkmate',()=>{
 const p=normalizePuzzle(mate,'mateIn1');assert.ok(replayLesson(p.fen,['d8h4']).isCheckmate());assert.throws(()=>replayLesson(p.fen,['d8h4','a2a3']));assert.throws(()=>replayLesson(p.fen,['a1a9']));assert.throws(()=>replayLesson(p.fen,new Array(61).fill('a2a3')));
});
