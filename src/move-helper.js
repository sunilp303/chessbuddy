import {evaluationText} from './game-review.js';

export const HELPER_SECONDS=30;
// Centipawns; a move this close to Stockfish's choice counts as "about as strong".
const CLOSE_ENOUGH=30;

// hint: Stockfish's best move before the player moved. after: the reply result ({white,score}) for the position after the player’s move.
export function helperFeedback({hint,played,playedSan,side,after,checkmate}){
  if(!hint?.best)return null;
  if(checkmate)return {tone:'good',text:`${playedSan} is checkmate!`};
  if(played===hint.best.uci)return {tone:'good',text:`Nice: ${playedSan} is Stockfish’s top choice too.`};
  if(!Number.isFinite(hint.white)||!Number.isFinite(after?.white))return {tone:'better',text:`Stockfish preferred ${hint.best.san}.`};
  const loss=(hint.white-after.white)*(side==='w'?1:-1);
  if(loss<=CLOSE_ENOUGH)return {tone:'good',text:`Good move. Stockfish’s top choice was ${hint.best.san}, and your ${playedSan} is about as strong.`};
  return {tone:'better',text:`A better move was ${hint.best.san} (${evaluationText(hint)}). After your ${playedSan}: ${evaluationText(after)}. Evaluations are from White’s side.`};
}
