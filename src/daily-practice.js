import {Chess} from 'chess.js';
import {reviewLine} from './game-review.js';

const examples={
  mate:{
    fen:'7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',line:['f7g7'],goal:'mate',
    prompt:'Find checkmate in one move.',
    hint:'Look for a square where your queen can check safely with help from your king.',
    explanation:'The queen checks on g7. Your king protects the queen and Black has no escape square.',
    takeaway:'Before a check, look at every square the king could escape to.'
  },
  capture:{
    fen:'6k1/8/8/3q4/8/8/3R4/6K1 w - - 0 1',line:['d2d5'],
    prompt:'Which piece can your rook capture?',
    hint:'Look straight up the d-file from your rook.',
    explanation:'Rxd5 captures an undefended queen. Black has no piece that can take the rook back.',
    takeaway:'Before moving, look for undefended pieces and check who can capture back.'
  },
  check:{
    fen:'7k/5K2/8/8/8/8/8/R7 w - - 0 1',line:['a1h1'],goal:'mate',
    prompt:'Give checkmate with your rook.',
    hint:'Your king guards the g-file escape squares. Which file can your rook check along?',
    explanation:'Rh1# checks along the h-file. Your king covers g7 and g8.',
    takeaway:'Look at checks, then see how your pieces can work together.'
  }
};

function gameExercise(lesson,game){
  const frames=reviewLine(lesson.fen,lesson.pv?.[0]===lesson.best?lesson.pv.slice(0,6):[lesson.best]);
  if(!frames.length||!game?.positions[lesson.ply+1])return null;
  const best=new Chess(lesson.fen).move({from:frames[0].from,to:frames[0].to,promotion:frames[0].promotion});
  const theme=best.san.endsWith('#')?'mate':best.captured?'capture':best.san.endsWith('+')?'check':null;
  return {
    id:lesson.id,fen:lesson.fen,line:frames.map(move=>move.from+move.to+(move.promotion||'')),
    playedFen:game.positions[lesson.ply+1],played:lesson.played,theme,goal:theme==='mate'?'mate':undefined,
    prompt:'You reached this position in your game. What would you try now?',
    hint:theme==='mate'?'Look for a check that takes away all the king’s escapes.':
      theme==='capture'?'Look at the pieces you can capture. Which capture looks safe?':
      theme==='check'?'Look for a move that gives check.': 'Look at checks, captures, and threats.',
    explanation:`You played ${lesson.played}. ${lesson.source==='Lichess computer analysis'?'Lichess':'Stockfish'} suggests ${best.san}. Step through the line and see how the other side can reply.`,
    caption:`Move ${Math.floor(lesson.ply/2)+1} against ${game.opponent}`
  };
}

export function createPractice(games,lessons,progress,previous){
  const byGame=new Map(games.map(game=>[game.id,game]));
  const sorted=[...lessons].sort((a,b)=>
    Number(a.id===previous?.exercises[0].id)-Number(b.id===previous?.exercises[0].id)||
    Number((progress[a.id]?.dueAt||0)>Date.now())-Number((progress[b.id]?.dueAt||0)>Date.now())||
    (byGame.get(b.gameId)?.date||0)-(byGame.get(a.gameId)?.date||0)||a.ply-b.ply
  );
  const game=sorted.map(lesson=>gameExercise(lesson,byGame.get(lesson.gameId))).find(Boolean);
  const fallback=previous?.exercises[0].id==='example-mate'?'check':'mate';
  const first=game||{...examples[fallback],id:'example-'+fallback};
  const followUp=game?.theme||(first.id==='example-mate'?'check':first.id==='example-check'?'mate':'capture');
  return {
    version:1,exercises:[first,{...examples[followUp],id:'example-'+followUp}],
    index:0,phase:'try',hint:false,attempts:0,step:0,results:[]
  };
}

export function tryPracticeMove(exercise,input){
  const board=new Chess(exercise.fen);
  let move;
  try{move=board.move(input);}catch{return null;}
  const uci=move.from+move.to+(move.promotion||'');
  return {san:move.san,fen:board.fen(),from:move.from,to:move.to,
    correct:exercise.goal==='mate'?board.isCheckmate():uci===exercise.line[0]};
}

export function readPractice(key){
  try{
    const session=JSON.parse(localStorage.getItem(key));
    if(session?.version===1&&session.exercises?.length===2&&[0,1].includes(session.index)
       &&['try','replay','recap'].includes(session.phase)&&Array.isArray(session.results))return session;
  }catch{}
  return null;
}
