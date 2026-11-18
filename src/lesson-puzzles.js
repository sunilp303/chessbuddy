import {Chess} from 'chess.js';
import {MAX_VARIATION_PLIES} from './limits.js';
export function applyUci(board,uci){
 if(typeof uci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))throw new Error('Invalid move notation.');
 return board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
}
export function normalizePuzzle(raw,theme){
 if(!raw.game?.pgn||!raw.puzzle?.id||!Array.isArray(raw.puzzle.solution)||!raw.puzzle.solution.length||!Number.isInteger(raw.puzzle.initialPly)||raw.puzzle.initialPly<0)throw new Error('Lichess returned an incomplete puzzle.');
 if(!raw.puzzle.themes?.includes(theme))throw new Error('The puzzle did not match the requested lesson theme.');
 const game=new Chess();game.loadPgn(raw.game.pgn);const history=game.history();
 const setupCount=raw.puzzle.initialPly+1;if(setupCount>history.length)throw new Error('The puzzle setup is incomplete.');
 const board=new Chess();for(const san of history.slice(0,setupCount))board.move(san);
 const fen=board.fen(),solution=[...raw.puzzle.solution],san=[];
 for(const uci of solution){if(board.isGameOver())throw new Error('Puzzle line continues after the position ends.');san.push(applyUci(board,uci).san);}
 return {id:raw.puzzle.id,theme,themes:raw.puzzle.themes,rating:raw.puzzle.rating,fen,solution,san,gameId:raw.game.id,source:`https://lichess.org/training/${raw.puzzle.id}`,loadedAt:Date.now()};
}
export function replayLesson(fen,moves=[]){
 if(!Array.isArray(moves)||moves.length>MAX_VARIATION_PLIES+2)throw new Error('Lesson variation is too long. Reset the board.');
 const board=new Chess(fen);for(const u of moves){if(board.isGameOver())throw new Error('This variation has ended.');applyUci(board,u);}return board;
}
export function checkPuzzleAttempt(puzzle,moves){
 if(!Array.isArray(moves)||!moves.length||moves.length%2!==1||moves.length>puzzle.solution.length)throw new Error('Choose the next player move in this puzzle.');
 const prefix=moves.slice(0,-1);if(prefix.some((m,i)=>m!==puzzle.solution[i]))throw new Error('The puzzle position changed. Reset this exercise.');
 const board=replayLesson(puzzle.fen,prefix),played=applyUci(board,moves.at(-1));
 const correct=moves.at(-1)===puzzle.solution[prefix.length];
 if(!correct)return {correct:false,fen:replayLesson(puzzle.fen,prefix).fen(),moves:prefix,played:played.san,complete:false};
 const accepted=[...moves];let reply=null;
 if(accepted.length<puzzle.solution.length){const u=puzzle.solution[accepted.length];reply={uci:u,san:applyUci(board,u).san};accepted.push(u);}
 return {correct:true,fen:board.fen(),moves:accepted,played:played.san,reply,complete:accepted.length>=puzzle.solution.length};
}
