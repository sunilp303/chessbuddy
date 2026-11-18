import {Chess} from 'chess.js';
import {recommendedLine} from './game-review.js';

// Famous, mechanically checkable patterns. Each entry opens the position before `ply` with teaching arrows.
const ORANGE='#c77d2e',RED='#ab493e',GREEN='#267154';
const sideName=color=>color==='w'?'White':'Black';
const enemy=color=>color==='w'?'b':'w';
const pieceNames={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};

function kingSquare(board,color){
  for(const row of board.board())for(const cell of row)if(cell?.type==='k'&&cell.color===color)return cell.square;
  return null;
}
function neighbours(square){
  const f=square.charCodeAt(0),r=Number(square[1]),out=[];
  for(const df of [-1,0,1])for(const dr of [-1,0,1]){
    if(!df&&!dr)continue;
    const nf=f+df,nr=r+dr;
    if(nf>=97&&nf<=104&&nr>=1&&nr<=8)out.push(String.fromCharCode(nf)+nr);
  }
  return out;
}
function knightTargets(square){
  const f=square.charCodeAt(0),r=Number(square[1]),out=[];
  for(const [df,dr] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]){
    const nf=f+df,nr=r+dr;
    if(nf>=97&&nf<=104&&nr>=1&&nr<=8)out.push(String.fromCharCode(nf)+nr);
  }
  return out;
}
function tryMove(fen,move){
  const board=new Chess(fen);
  try{return {board,move:board.move(move)};}catch{return null;}
}

// Classify a checkmating move. Returns a pattern without ply/kind, or null.
function mateShape(before,after,move,ply){
  if(!after.isCheckmate())return null;
  const mover=move.color,target=kingSquare(after,enemy(mover)),weak=mover==='w'?'f7':'f2';
  if(ply<=3&&move.piece==='q')return {id:'fools-mate',name:'Fool’s mate',
    idea:`The fastest checkmate. Weakening pawn moves opened the diagonal to the king, so the queen mates at once. Defend by keeping the f- and g-pawns at home early.`,
    arrows:[{from:move.from,to:move.to,color:ORANGE,label:`Queen mates on ${move.to}`},{from:move.to,to:target,color:RED,label:'Open diagonal to the king'}]};
  if(ply<24&&move.piece==='q'&&move.to===weak){
    const bishop=before.attackers(weak,mover).find(square=>before.get(square)?.type==='b');
    return {id:'scholars-mate',name:'Scholar’s mate',
      idea:`The queen and bishop both aim at ${weak}, a square only the king defends. The queen takes on ${weak} with the bishop's support, and the king cannot recapture or escape.`,
      arrows:[{from:move.from,to:move.to,color:ORANGE,label:`Queen takes on ${weak}`},...(bishop?[{from:bishop,to:weak,color:ORANGE,label:`Bishop supports ${weak}`}]:[])]};
  }
  const around=neighbours(target);
  if(move.piece==='n'&&around.every(square=>after.get(square)?.color===enemy(mover)))return {id:'smothered-mate',name:'Smothered mate',
    idea:`The king is boxed in by its own pieces, so a knight check cannot be blocked or escaped. Look for knight checks when the enemy king has no free squares.`,
    arrows:[{from:move.from,to:move.to,color:ORANGE,label:`Knight mates on ${move.to}`},...around.map(square=>({from:target,to:square,color:RED,label:`${square} is blocked by its own piece`}))]};
  const backRank=mover==='w'?'8':'1',front=mover==='w'?'7':'2';
  if(['r','q'].includes(move.piece)&&target?.[1]===backRank&&move.to[1]===backRank){
    const shelter=around.filter(square=>square[1]===front);
    if(shelter.length&&shelter.every(square=>after.get(square)?.color===enemy(mover)))return {id:'back-rank-mate',name:'Back-rank mate',
      idea:`The king is stuck behind its own pawns, so a ${pieceNames[move.piece]} on the back rank gives mate. Defend by making "luft" (an escape square with a pawn move) or keeping a rook on the back rank.`,
      arrows:[{from:move.from,to:move.to,color:ORANGE,label:`${pieceNames[move.piece]} reaches the back rank`},...shelter.map(square=>({from:target,to:square,color:RED,label:`${square} is blocked by a pawn or piece`}))]};
  }
  return null;
}

// A knight move that attacks two or more of king, queen and rook, and is a real threat (check or the knight is safe).
function forkShape(after,move){
  if(move.piece!=='n')return null;
  const them=enemy(move.color);
  const targets=knightTargets(move.to).filter(square=>{const p=after.get(square);return p?.color===them&&['k','q','r'].includes(p.type);});
  if(targets.length<2)return null;
  const check=targets.some(square=>after.get(square).type==='k');
  if(!check&&after.isAttacked(move.to,them))return null;
  const names=targets.map(square=>`${pieceNames[after.get(square).type]} on ${square}`);
  return {id:'knight-fork',name:'Knight fork',
    idea:`The knight on ${move.to} attacks the ${names.join(' and the ')} at the same time. The opponent can only save one, so material is won. Look for squares where a knight hits two big pieces.`,
    arrows:[{from:move.from,to:move.to,color:ORANGE,label:`Knight jumps to ${move.to}`},...targets.map(square=>({from:move.to,to:square,color:RED,label:`Attacks the ${pieceNames[after.get(square).type]}`}))]};
}

function shapeFor(fen,input,ply){
  const tried=tryMove(fen,input);
  if(!tried)return null;
  return mateShape(new Chess(fen),tried.board,tried.move,ply)||forkShape(tried.board,tried.move);
}

// After a quiet move, would Qxf7 (or Qxf2) be mate if the opponent did nothing?
function scholarThreat(game,ply){
  if(ply>=16)return null;
  const mover=game.moves[ply].color,weak=mover==='w'?'f7':'f2',after=game.positions[ply+1];
  const parts=after.split(' ');
  if(new Chess(after).inCheck())return null;
  parts[1]=mover;parts[3]='-';
  let board;try{board=new Chess(parts.join(' '));}catch{return null;}
  const attackers=board.attackers(weak,mover);
  const queen=attackers.find(square=>board.get(square)?.type==='q'),bishop=attackers.find(square=>board.get(square)?.type==='b');
  if(!queen||!bishop)return null;
  const strike=tryMove(board.fen(),{from:queen,to:weak});
  if(!strike?.board.isCheckmate())return null;
  return {queen,bishop,weak,mover};
}

export function findPatterns(game,reviewed=[]){
  const found=[];
  game.moves.forEach((move,ply)=>{
    const before=game.positions[ply];
    const played=shapeFor(before,{from:move.from,to:move.to,promotion:move.san.match(/=([QRBN])/)?.[1].toLowerCase()},ply);
    if(played)found.push({...played,ply,color:move.color,kind:'played',
      summary:`${sideName(move.color)} played ${move.san}: a ${played.name.toLowerCase()}.`});

    const threat=scholarThreat(game,ply);
    // Report a threat once, when it first appears.
    if(threat&&game.moves[ply+1]&&!(ply>=2&&scholarThreat(game,ply-2))){
      const reply=reviewed[ply+1],{frames}=recommendedLine(game.positions[ply+1],reply);
      const defence=frames[0]&&frames[0].san!==game.moves[ply+1].san?frames[0]:null;
      found.push({id:'scholars-threat',name:'Scholar’s mate threat',ply:ply+1,color:enemy(threat.mover),kind:'threat',
        summary:`${sideName(threat.mover)} threatens Qx${threat.weak}#. ${sideName(enemy(threat.mover))} must defend ${threat.weak}.`,
        idea:`The queen and bishop both aim at ${threat.weak}, which only the king defends. Stop it by covering ${threat.weak} (for example with the queen or a knight) or by attacking the queen with tempo.${defence?` Stockfish’s move here is ${defence.san} (green).`:''}`,
        arrows:[{from:threat.queen,to:threat.weak,color:RED,label:`Queen eyes ${threat.weak}`},{from:threat.bishop,to:threat.weak,color:RED,label:`Bishop eyes ${threat.weak}`},
          ...(defence?[{from:defence.from,to:defence.to,color:GREEN,label:`Defend with ${defence.san}`}]:[])]});
    }

    const entry=reviewed[ply];
    if(!entry?.judgment)return;
    const best=recommendedLine(before,entry).frames[0];
    if(!best||best.san===move.san)return;
    const missed=shapeFor(before,{from:best.from,to:best.to,promotion:best.promotion},ply)||
      (best.san.endsWith('#')?{id:'mate-in-one',name:'Checkmate in one',idea:`${best.san} would have ended the game. Before every move, check all checks: one of them may be mate.`,arrows:[]}:null);
    if(!missed)return;
    found.push({...missed,id:'missed-'+missed.id,ply,color:move.color,kind:'missed',
      summary:`${sideName(move.color)} played ${move.san}, but ${best.san} was a ${missed.name.toLowerCase()}.`,
      arrows:[{from:best.from,to:best.to,color:GREEN,label:`The pattern move: ${best.san}`},...missed.arrows.slice(1),{from:move.from,to:move.to,color:RED,label:`Played ${move.san}`}]});
  });
  return found;
}
