import { Chess } from 'chess.js';

export function normalizeGame(g, username) {
  if (!username) return null;
  if (g.variant !== 'standard' || !['mate','resign','stalemate','timeout','draw','outoftime','cheat','noStart','variantEnd'].includes(g.status)) return null;
  const color = g.players?.white?.user?.id?.toLowerCase() === username ? 'w' : g.players?.black?.user?.id?.toLowerCase() === username ? 'b' : null;
  if (!color || !g.moves?.trim()) return null;
  const board = new Chess();
  const positions = [board.fen()];
  const moves = g.moves.trim().split(/\s+/).map(san => {
    const move = board.move(san);
    positions.push(board.fen());
    return { san: move.san, from: move.from, to: move.to, color: move.color, captured: move.captured };
  });
  return { id:g.id, color, opponent:(color === 'w' ? g.players.black : g.players.white)?.user?.name || 'Anonymous',
    speed:g.speed, date:g.createdAt, opening:g.opening?.name || 'Standard opening', rating:(color === 'w' ? g.players.white : g.players.black)?.rating,
    result: !g.winner ? 'draw' : g.winner === (color === 'w' ? 'white' : 'black') ? 'win' : 'loss',
    opponentRating:(color==='w'?g.players.black:g.players.white)?.rating ?? null,
    provisional:(color==='w'?g.players.white:g.players.black)?.provisional===true,
    opponentProvisional:(color==='w'?g.players.black:g.players.white)?.provisional===true,
    rated:g.rated===true,division:g.division || null,
    positions, moves, pgn:g.pgn || '', status:g.status, lichess: normalizeLichess(g, positions, moves) };
}
// Lichess analysis[i] evaluates the position AFTER move i, but its best move
// and variation are alternatives to that move, starting BEFORE it.
export function normalizeLichess(raw, positions, moves) {
  if (!Array.isArray(raw.analysis) || !raw.analysis.length) return null;
  const entries = raw.analysis.slice(0,moves.length).map((entry,ply)=>{
    entry ||= {};
    let best = null, bestSan = null, variation = [], variationUci = [];
    const board = new Chess(positions[ply]);
    try {
      if(entry.best){const m=moveFromUci(board,entry.best);best=m.from+m.to+(m.promotion||'');bestSan=m.san;}
    } catch { /* An invalid upstream move must never become a practice answer. */ }
    if(typeof entry.variation==='string'&&entry.variation.trim()){
      const line=new Chess(positions[ply]);
      for(const san of entry.variation.trim().split(/\s+/)){
        try {const m=line.move(san);variation.push(m.san);variationUci.push(m.from+m.to+(m.promotion||''));} catch {break;}
      }
    }
    if(!best&&!entry.best&&variationUci.length){best=variationUci[0];bestSan=variation[0];}
    // Only attach a recommendation line when it agrees with the validated best move.
    if(!best || variationUci[0]!==best){variation=[];variationUci=[];}
    const judgment=['Inaccuracy','Mistake','Blunder'].includes(entry.judgment?.name)?entry.judgment.name:null;
    return {ply,played:moves[ply].san,color:moves[ply].color,
      eval:Number.isFinite(entry.eval)?entry.eval:null,mate:Number.isFinite(entry.mate)?entry.mate:null,
      judgment,comment:entry.judgment?.comment || '',best,bestSan,variation,variationUci};
  });
  return {source:'Lichess computer analysis',importedAt:Date.now(),complete:entries.length===moves.length,
    entries,summary:{white:raw.players?.white?.analysis || null,black:raw.players?.black?.analysis || null}};
}

export function preserveLichessAnalysis(game,previous){
  if(!previous?.lichess||previous.moves.length!==game.moves.length||
     previous.moves.some((move,index)=>move.san!==game.moves[index].san))return game.lichess;
  const incoming=game.lichess,stored=previous.lichess;
  if(!incoming)return stored;
  const entries=Array.from({length:Math.max(incoming.entries.length,stored.entries.length)},(_,ply)=>{
    const fresh=incoming.entries[ply],cached=stored.entries[ply];
    if(!fresh||!cached)return fresh||cached;
    const best=fresh.best||cached.best,compatible=best===cached.best;
    const line=fresh.variationUci.length||!compatible?fresh:cached;
    const score=fresh.eval!==null||fresh.mate!==null?fresh:cached;
    return {...fresh,eval:score.eval,mate:score.mate,best,bestSan:fresh.bestSan||cached.bestSan,
      judgment:fresh.judgment||cached.judgment,comment:fresh.comment||(compatible?cached.comment:''),
      variation:line.variation,variationUci:line.variationUci};
  });
  return {...incoming,entries,complete:entries.length===game.moves.length,
    summary:{white:incoming.summary.white||stored.summary.white,black:incoming.summary.black||stored.summary.black}};
}

export function lichessLessons(game) {
  return (game.lichess?.entries || []).filter(e=>e.color===game.color && e.judgment && e.best).map(e=>{
    const board=new Chess(game.positions[e.ply]);const best=moveFromUci(board,e.best);
    const theme=best.san.includes('#')?'Checkmate':best.captured?'Captures & threats':best.san.includes('+')?'Checks & attacks':e.ply<20?'Opening care':'Piece safety';
    return {id:`${game.id}-${e.ply}`,gameId:game.id,ply:e.ply,fen:game.positions[e.ply],color:game.color,
      played:e.played,best:e.best,bestSan:e.bestSan,theme,hint:'Look for checks, captures, and threats. What would change after your move?',
      severity:e.judgment,source:'Lichess computer analysis',
      explanation:`You played ${e.played}. Lichess marked it as ${e.judgment.toLowerCase()} and recommends ${e.bestSan}.${e.variation.length?' Suggested line: '+e.variation.join(' ')+'.':''} What does the better move change?`,
      pv:e.variationUci.length?e.variationUci:[e.best],variation:e.variation,depth:null};
  });
}
export function mergeLichessReview(game, existing) {
  if(!game.lichess)return existing;
  return {...existing,lessons:lichessLessons(game),createdAt:existing?.createdAt || Date.now(),
    source:'Lichess computer analysis',engine:existing?.engine || null};
}
export function whiteScore(score, turn) {
  const value = score.type === 'mate' ? Math.sign(score.value) * (100000 - Math.min(999,Math.abs(score.value))*100) : score.value;
  return turn === 'w' ? value : -value;
}
export function moveFromUci(board, uci) {
  // Lichess exports castling as king-to-rook (e1h1/e8a8).
  const from=uci.slice(0,2),to=uci.slice(2,4),piece=board.get(from),target=board.get(to);
  if(piece?.type==='k'&&target?.type==='r'&&piece.color===target.color&&from[1]===to[1]&&['a','h'].includes(to[0])){
    return board.move({from,to:(to[0]==='h'?'g':'c')+from[1]});
  }
  return board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4] || 'q'});
}
export function makeLesson(game, ply, before, after) {
  const sign = game.color === 'w' ? 1 : -1;
  const loss = Math.max(0, (before.white - after.white) * sign);
  // Winning positions with large numeric swings can distract from useful beginner lessons.
  if (loss < 120 || !before.best || before.best === '(none)' || Math.abs(before.white) > 1800) return null;
  const board = new Chess(game.positions[ply]);
  let best;
  try { best = moveFromUci(board,before.best); } catch { return null; }
  const actual = game.moves[ply];
  if (best.san === actual.san) return null;
  const theme = best.san.includes('#') ? 'Checkmate' : best.captured ? 'Captures & threats' : best.san.includes('+') ? 'Checks & attacks' : ply < 20 ? 'Opening care' : 'Piece safety';
  const hints = {
    'Checkmate':'Look for a check that leaves the king with no safe square.',
    'Captures & threats':'Look at every capture. Which piece can you take safely?',
    'Checks & attacks':'Start with checks. Can you make the other king move?',
    'Opening care':'Pause and look at your opponent’s threats before choosing a move.',
    'Piece safety':'Check which pieces are attacked. Can you improve your position?'
  };
  return {id:`${game.id}-${ply}`,gameId:game.id,ply,fen:game.positions[ply],color:game.color,
    played:actual.san,best:before.best,bestSan:best.san,theme,hint:hints[theme],
    loss:Math.round(loss),severity:loss >= 250 ? 'Big learning moment' : 'Learning moment',
    explanation:`In the game you played ${actual.san}. Stockfish prefers ${best.san}. ${hints[theme]} Try to say what changes after your move.`,
    pv:before.pv,depth:before.depth};
}
