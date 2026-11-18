import React,{useEffect,useRef,useState} from 'react';
import {MAX_VARIATION_PLIES} from './limits.js';
import {Chess} from 'chess.js';
import Board from './Board.jsx';
import {MoveHelperPanel,PlayEngineButton,TurnLegend,helperArrow,replyMove,turnMarks,useHelperSetting,useMoveHelper} from './MoveHelper.jsx';
import {helperFeedback} from './move-helper.js';

// Practice a position from your games: the first move is scored, then play on against Stockfish.
export default function PracticeTime({lesson,lessons,practice,api,refresh,onChoose}){
  const base=lesson.fen,side=lesson.color;
  const [fen,setFen]=useState(base),[moves,setMoves]=useState([]),[turns,setTurns]=useState([]),[last,setLast]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
  const [clue,setClue]=useState(null),[revealed,setRevealed]=useState(false),[graded,setGraded]=useState(false);
  const [helperOn,setHelperOn]=useHelperSetting(),[helperNote,setHelperNote]=useState(null);
  const [lastTurn,setLastTurn]=useState(null),[suggesting,setSuggesting]=useState(false);
  const live=useRef(true);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const ended=new Chess(fen).isGameOver(),limit=moves.length>=MAX_VARIATION_PLIES,interactive=!busy&&!ended&&!limit;
  const helper=useMoveHelper({enabled:helperOn,active:interactive,positionKey:fen,
    fetchHint:()=>api(`/api/review/${lesson.gameId}/hint`,{ply:lesson.ply,moves})});

  async function play(input,suggested=false){
    if(!interactive)return;
    const board=new Chess(fen);
    let user;
    try{user=board.move(input);}catch{return;}
    const played=user.from+user.to+(user.promotion||''),pending=[...moves,played];
    setBusy(true);setError('');setClue(null);setHelperNote(null);
    setFen(board.fen());setLast([user.from,user.to]);
    try{
      const {hint,timedOut}=await helper.settle();
      if(!graded){
        const usedHelp=revealed||timedOut||suggested;
        const scored=await api(`/api/practice/${lesson.id}`,{move:played,revealed:usedHelp});
        if(!live.current)return;
        setGraded(true);
        if(usedHelp)setRevealed(true);
        setFeedback(scored.correct
          ?(usedHelp?'You replayed the move. Try it without a clue next time.':'You found it! Tell someone what your move does.')
          :`Good try. ${user.san} is not the move from your review. Keep playing to see what happens, or reset and try again.`);
      }
      const result=await api(`/api/review/${lesson.gameId}/reply`,{ply:lesson.ply,moves:pending});
      if(!live.current)return;
      setFen(result.fen);
      setMoves(result.reply?[...pending,result.reply.uci]:pending);
      setTurns([...turns,{played:user.san,reply:result.reply?.san}]);
      if(result.reply)setLast([result.reply.from,result.reply.to]);
      setLastTurn({user:{from:user.from,to:user.to,san:user.san,color:user.color,piece:user.piece},reply:replyMove(board.fen(),result.reply)});
      if(result.reason)setFeedback(result.reason==='Checkmate'?(result.reply?'Checkmate. Stockfish won this one. Reset to try again.':'Checkmate! Well played.'):'The game is a draw.');
      if(!timedOut&&!suggested)setHelperNote(helperFeedback({hint,played,playedSan:user.san,side,after:result,checkmate:result.reason==='Checkmate'&&!result.reply}));
    }catch(e){
      if(live.current){setFen(fen);setLast(last);setError(e.message);}
    }finally{if(live.current){setBusy(false);refresh();}}
  }

  async function showClue(){
    if(!moves.length){
      setRevealed(true);
      setClue({from:lesson.best.slice(0,2),to:lesson.best.slice(2,4),title:`One possibility: ${lesson.bestSan}`,text:lesson.explanation,
        note:lesson.source==='Lichess computer analysis'?'Lichess recommendation; other moves may also be good.':`Engine preference at depth ${lesson.depth}; other moves may also be good.`});
      return;
    }
    setBusy(true);setError('');
    try{
      await helper.settle();
      const hint=await api(`/api/review/${lesson.gameId}/hint`,{ply:lesson.ply,moves});
      if(live.current)setClue({from:hint.best.from,to:hint.best.to,title:`Stockfish suggests ${hint.best.san}`,text:'Look at what this move attacks or defends before you play it.',note:'Best move found in a limited search; other moves may also be good.'});
    }catch(e){if(live.current)setError(e.message);}finally{if(live.current)setBusy(false);}
  }

  async function playSuggestion(){
    setSuggesting(true);setError('');
    try{
      const {hint}=await helper.settle();
      const best=hint?.best||(await api(`/api/review/${lesson.gameId}/hint`,{ply:lesson.ply,moves})).best;
      if(!live.current)return;
      setSuggesting(false);
      await play({from:best.from,to:best.to,promotion:best.uci[4]},true);
    }catch(e){if(live.current)setError(e.message);}
    finally{if(live.current)setSuggesting(false);}
  }

  function undo(){
    const remaining=moves.slice(0,-(moves.length%2?1:2));
    const board=new Chess(base);
    for(const uci of remaining)board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
    setMoves(remaining);setTurns(turns.slice(0,-1));setFen(board.fen());
    setLast(remaining.length?[remaining.at(-1).slice(0,2),remaining.at(-1).slice(2,4)]:null);
    setClue(null);setHelperNote(null);setError('');setLastTurn(null);
  }

  function reset(){
    setFen(base);setMoves([]);setTurns([]);setLast(null);setError('');setFeedback('');
    setClue(null);setRevealed(false);setGraded(false);setHelperNote(null);setLastTurn(null);
  }

  const marks=turnMarks(lastTurn);
  const arrows=[...marks.arrows,...(clue?[{from:clue.from,to:clue.to,color:'#267154',label:clue.title}]:helperArrow(helper))];
  return <div className="practice-layout">
    <section className="card">
      <div className="section-heading"><h3>{side==='w'?'White':'Black'} to move</h3><span className="tag">From your game</span></div>
      <Board fen={fen} orientation={side} onMove={play} disabled={!interactive||suggesting} dragPieces lastMove={last} arrows={arrows} ghosts={marks.ghosts}/>
      <TurnLegend turn={lastTurn}/>
      <div className="variation-history">{turns.map((turn,index)=><span key={index}>You: {turn.played}{turn.reply&&` · Stockfish: ${turn.reply}`}</span>)}</div>
    </section>
    <section className="card practice-coach">
      <span className="eyebrow">TAKE YOUR TIME</span>
      <h2>Pause. Look.<br/>Find a possibility.</h2>
      <p>{moves.length?'Keep playing against Stockfish to see how the position goes.':'What would you play here? Drag a piece, or select it and then its destination. Stockfish replies, so you can keep playing.'}</p>
      {!moves.length&&<div className="prompt">Look for checks, captures, and threats. What does your opponent want?</div>}
      {busy&&<p role="status" className="notice">Stockfish is thinking…</p>}
      {feedback&&<div className="notice" role="status">{feedback}</div>}
      {error&&<p role="alert" className="notice error">{error}</p>}
      {clue&&<div className="hint"><b>{clue.title}</b><p>{clue.text}</p><small>{clue.note} The green arrow shows the move.</small></div>}
      <MoveHelperPanel enabled={helperOn} setEnabled={setHelperOn} helper={helper} note={helperNote}/>
      <div className="practice-actions">
        <button className="button outline" disabled={busy||ended||suggesting} onClick={showClue}>Show me a clue</button>
        <PlayEngineButton onClick={playSuggestion} disabled={!interactive||suggesting} thinking={suggesting}/>
        {moves.length>0&&<button className="text-button" disabled={busy} onClick={undo}>Undo last turn</button>}
        <button className="text-button" disabled={busy} onClick={reset}>Reset position ↻</button>
      </div>
      {limit&&<p className="muted">This practice line reached its length limit. Reset to try again.</p>}
      <small className="muted">Solved without a clue: {practice[lesson.id]?.solved||0} times</small>
      <hr/>
      <h3>Your practice notebook</h3>
      {lessons.map(l=><button key={l.id} className={`lesson-row ${l.id===lesson.id?'chosen':''}`} onClick={()=>onChoose(l)}><span>{l.theme}<small>Move {Math.floor(l.ply/2)+1} · {practice[l.id]?.dueAt>Date.now()?'Revisit later':'Ready to try'}</small></span><span>↗</span></button>)}
    </section>
  </div>;
}
