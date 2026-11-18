import {Chess} from 'chess.js';
import {whiteScore} from './chess.js';
import {applyUci} from '../src/lesson-puzzles.js';
import {terminalEvaluation} from './uci-engine.js';

export function browserEvaluations(fens,results,depth){
  if(!Array.isArray(results)||results.length!==fens.length)throw new Error('Stockfish returned the wrong number of positions.');
  const evaluations=fens.map((fen,index)=>{
    const result=results[index];
    if(result?.fen!==fen)throw new Error('This position changed during analysis. Please try again.');
    const terminal=terminalEvaluation(fen);
    if(terminal)return {...terminal,best:null,white:whiteScore(terminal.score,fen.split(' ')[1])};
    const {score,best,pv,depth:actualDepth}=result;
    if(!['cp','mate'].includes(score?.type)||!Number.isInteger(score.value)||Math.abs(score.value)>100000
       ||!Number.isInteger(actualDepth)||actualDepth<1||actualDepth>depth
       ||!Array.isArray(pv)||pv.length<1||pv.length>20){
      throw new Error('Stockfish returned an invalid evaluation.');
    }
    applyUci(new Chess(fen),best);
    const line=new Chess(fen);
    for(const move of pv)applyUci(line,move);
    return {score:{type:score.type,value:score.value},best,pv,depth:actualDepth,white:whiteScore(score,fen.split(' ')[1])};
  });
  let index=0;
  return {ready(){},evaluate(){return evaluations[index++];},close(){}};
}
