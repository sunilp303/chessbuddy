import {Chess} from 'chess.js';
import {MAX_VARIATION_PLIES} from '../src/limits.js';
// expect 'reply': the variation ends with the player's move. 'hint': it is the player's turn (even length, may be empty).
export function replayVariation(game,ply,moves,expect='reply'){
 if(!Number.isInteger(ply)||ply<0||ply>=game.positions.length)throw new Error('Choose a valid position in this completed game.');
 const parity=expect==='hint'?0:1;
 if(!Array.isArray(moves)||moves.length<parity||moves.length>MAX_VARIATION_PLIES+1||moves.length%2!==parity)throw new Error(parity?`Send a variation ending with your move (maximum ${MAX_VARIATION_PLIES+1} half-moves).`:'Ask for a suggestion when it is your turn.');
 const board=new Chess(game.positions[ply]);
 for(const uci of moves){
  if(typeof uci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))throw new Error('Invalid variation move.');
  if(board.isGameOver())throw new Error('This variation has already ended.');
  try{board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}catch{throw new Error('The variation contains an illegal move.');}
 }
 return board;
}
