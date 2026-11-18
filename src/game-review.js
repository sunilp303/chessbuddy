import {Chess} from 'chess.js';
import {moveFromUci} from '../server/chess.js';

export const judgments=['Blunder','Mistake','Inaccuracy'];

export function moveLabel(ply,color,san){
  return `${Math.floor(ply/2)+1}${color==='w'?'.':'…'} ${san}`;
}

function localJudgment(move,before,after){
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(before?.best||'')||!Number.isFinite(before.white)||!Number.isFinite(after?.white))return null;
  const promotion=move.san.match(/=([QRBN])/)?.[1].toLowerCase()||'';
  if(before.best===move.from+move.to+promotion)return null;
  const sign=move.color==='w'?1:-1;
  const chance=score=>100/(1+Math.exp(-0.00368*score*sign));
  const loss=chance(before.white)-chance(after.white);
  return loss>=30?'Blunder':loss>=20?'Mistake':loss>=10?'Inaccuracy':null;
}

export function reviewMoves(game,analysis){
  const cloud=game.lichess?.entries||[],engine=analysis?.evaluations||[];
  return game.moves.map((move,ply)=>{
    const official=cloud[ply],before=engine[ply],after=engine[ply+1];
    const estimate=localJudgment(move,before,after);
    const judgment=official?.judgment||estimate;
    const officialPair=hasScore(cloud[ply-1])&&hasScore(official);
    const enginePair=hasScore(before)&&hasScore(after);
    const [beforeScore,afterScore,scoreSource]=officialPair&&(!estimate||official?.judgment||!enginePair)
      ? [cloud[ply-1],official,'Lichess']
      : enginePair ? [before,after,'Stockfish'] : [null,hasScore(official)?official:null,'Lichess'];
    return {
      ...move,ply,judgment,judgmentSource:official?.judgment?'Lichess':estimate?'Stockfish estimate':null,
      evaluated:enginePair||hasScore(official)||!!official?.judgment,
      comment:official?.comment,official,before,after,beforeScore,afterScore,scoreSource
    };
  });
}

function hasScore(entry){
  return Number.isFinite(entry?.eval)||Number.isFinite(entry?.mate)||Number.isFinite(entry?.white);
}

export function evaluationText(entry){
  if(!hasScore(entry))return '—';
  if(entry.depth===0&&entry.score?.type==='mate')return 'Checkmate';
  const mate=entry.mate??(entry.score?.type==='mate'?Math.sign(entry.white)*Math.abs(entry.score.value):null);
  if(mate!==null)return mate===0?'Checkmate':`Mate in ${Math.abs(mate)} for ${mate>0?'White':'Black'}`;
  const score=entry.eval??entry.white;
  return `${score>0?'+':''}${(score/100).toFixed(2)}`;
}

export function reviewLine(fen,moves){
  const board=new Chess(fen),frames=[];
  for(const uci of moves){
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci||'')||board.isGameOver())break;
    try{
      const move=moveFromUci(board,uci);
      frames.push({san:move.san,from:move.from,to:move.to,promotion:move.promotion,fen:board.fen()});
    }catch{break;}
  }
  return frames;
}

export function recommendedLine(fen,move){
  for(const [best,pv,source] of [
    [move?.official?.best,move?.official?.variationUci,'Lichess'],
    [move?.before?.best,move?.before?.pv,'Stockfish']
  ]){
    if(!best)continue;
    const frames=reviewLine(fen,pv?.[0]===best?pv:[best]);
    if(frames.length&&frames[0].san!==move.san)return {frames,source};
  }
  return {frames:[],source:null};
}
