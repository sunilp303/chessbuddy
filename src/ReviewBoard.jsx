import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MAX_VARIATION_PLIES} from './limits.js';
import {Chess} from 'chess.js';
import Board from './Board.jsx';
import {evaluationText,moveLabel,recommendedLine,reviewLine} from './game-review.js';
import {MoveHelperPanel,PlayEngineButton,TurnLegend,helperArrow,replyMove,turnMarks,useHelperSetting,useMoveHelper} from './MoveHelper.jsx';
import {helperFeedback} from './move-helper.js';

export default function ReviewBoard({game,ply,move,api,blocked,pattern}){
  const base=game.positions[ply],side=game.moves[ply]?.color??new Chess(base).turn();
  const [fen,setFen]=useState(base),[moves,setMoves]=useState([]),[turns,setTurns]=useState([]);
  const [preview,setPreview]=useState('board'),[step,setStep]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reply,setReply]=useState(null),[last,setLast]=useState(null);
  const [helperOn,setHelperOn]=useHelperSetting(),[helperNote,setHelperNote]=useState(null);
  const [lastTurn,setLastTurn]=useState(null),[suggesting,setSuggesting]=useState(false);
  const live=useRef(true);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const {frames,source}=useMemo(()=>recommendedLine(base,move),[base,move]),better=frames[0];
  const playedReply=useMemo(()=>{
    if(move?.judgment&&move.after?.best)return reviewLine(game.positions[ply+1],[move.after.best])[0];
  },[game,move,ply]);
  const frame=preview==='line'?frames[step]:null;
  const response=preview==='played'&&step===1?playedReply:null;
  const ended=new Chess(fen).isGameOver(),limit=moves.length>=MAX_VARIATION_PLIES;
  const atStart=preview==='board'&&!moves.length&&!busy;
  const interactive=preview==='board'&&!busy&&!blocked&&!ended&&!limit;
  const helper=useMoveHelper({enabled:helperOn,active:interactive,positionKey:fen,
    fetchHint:()=>api(`/api/review/${game.id}/hint`,{ply,moves})});
  const marks=preview==='board'?turnMarks(lastTurn):{arrows:[],ghosts:[]};
  const arrows=preview==='board'?[...marks.arrows,...helperArrow(helper)]:[];
  if(atStart&&pattern)arrows.push(...pattern.arrows);
  else if(atStart&&move?.judgment){
    arrows.push({from:move.from,to:move.to,color:'#ab493e',label:`Played ${move.san}`});
    if(better)arrows.push({from:better.from,to:better.to,color:'#267154',label:`Suggested ${better.san}`});
  }

  async function play(input,suggested=false){
    if(!interactive)return;
    const board=new Chess(fen);
    let user;
    try{user=board.move(input);}catch{return;}
    const played=user.from+user.to+(user.promotion||''),pending=[...moves,played];
    setBusy(true);
    setError('');
    setReply(null);
    setHelperNote(null);
    setFen(board.fen());
    setLast([user.from,user.to]);
    try{
      const {hint,timedOut}=await helper.settle();
      const result=await api(`/api/review/${game.id}/reply`,{ply,moves:pending});
      if(!live.current)return;
      setFen(result.fen);
      setMoves(result.reply?[...pending,result.reply.uci]:pending);
      setTurns([...turns,{played:user.san,reply:result.reply?.san}]);
      setReply(result);
      setLastTurn({user:{from:user.from,to:user.to,san:user.san,color:user.color,piece:user.piece},reply:replyMove(board.fen(),result.reply)});
      if(!timedOut&&!suggested)setHelperNote(helperFeedback({hint,played,playedSan:user.san,side,after:result,checkmate:result.reason==='Checkmate'&&!result.reply}));
      if(result.reply)setLast([result.reply.from,result.reply.to]);
    }catch(e){
      if(live.current){setFen(fen);setLast(last);setError(e.message);}
    }finally{if(live.current)setBusy(false);}
  }

  function reset(mode='board'){
    setPreview(mode);
    setStep(0);
    setFen(base);
    setMoves([]);
    setTurns([]);
    setReply(null);
    setLast(null);
    setError('');
    setHelperNote(null);
    setLastTurn(null);
  }

  async function playSuggestion(){
    setSuggesting(true);
    setError('');
    try{
      const {hint}=await helper.settle();
      const best=hint?.best||(await api(`/api/review/${game.id}/hint`,{ply,moves})).best;
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
    setMoves(remaining);
    setTurns(turns.slice(0,-1));
    setFen(board.fen());
    setLast(remaining.length?[remaining.at(-1).slice(0,2),remaining.at(-1).slice(2,4)]:null);
    setReply(null);
    setError('');
    setHelperNote(null);
    setLastTurn(null);
  }

  const position=preview==='played'?(response?.fen??game.positions[ply+1]):frame?.fen??fen;
  const lastMove=response?[response.from,response.to]:preview==='played'?[move.from,move.to]:frame?[frame.from,frame.to]:
    last||(!move?.judgment&&ply>0?[game.moves[ply-1].from,game.moves[ply-1].to]:null);
  const score=reply?.score?evaluationText(reply):null;

  return <>
    {move&&<section className={`review-comparison${move.judgment==='Blunder'?' review-blunder':''}`}>
      <div className="section-heading">
        <h4>Before {moveLabel(ply,side,move.san)} · {side===game.color?'Your move':'Opponent’s move'}</h4>
        {move.judgment&&<span className={`judgment ${move.judgment.toLowerCase()}`}>{move.judgment} · {move.judgmentSource}</span>}
      </div>
      <div className="review-choices">
        <button className="button outline" aria-pressed={preview==='played'} disabled={busy} onClick={()=>reset('played')}>Show played {move.san}</button>
        {better&&<button className="button outline" aria-pressed={preview==='line'} disabled={busy} onClick={()=>reset('line')}>Show better move {better.san}</button>}
        <button className="button outline" aria-pressed={preview==='board'} disabled={busy} onClick={()=>reset()}>Back to position</button>
      </div>
      {move.comment&&<p>{move.comment}</p>}
      {move.afterScore&&<p className="muted">{move.scoreSource} evaluation (White’s perspective): {evaluationText(move.beforeScore)} before → {evaluationText(move.afterScore)} after {move.san}.</p>}
      {better&&<p className="muted">Recommendation from {source}. {move.judgment?'Red shows the played move and green shows the suggestion.':''}</p>}
    </section>}
    {pattern&&<section className="pattern-explainer" aria-live="polite">
      <b>{pattern.kind==='missed'?'Missed pattern: ':pattern.kind==='threat'?'Watch out: ':''}{pattern.name}</b>
      <p>{pattern.summary}</p>
      <p>{pattern.idea}</p>
      <small>Arrows: orange shows the pattern’s pieces, red shows its targets or the move played, green shows the move to find.{!atStart?' Go back to the position to see them.':''}</small>
    </section>}
    <Board fen={position} orientation={game.color} onMove={play} disabled={!interactive||suggesting} dragPieces lastMove={lastMove} arrows={arrows} ghosts={marks.ghosts}/>
    <div className="interactive-review">
      {preview==='played'&&<>
        <p>Played in the game: <b>{moveLabel(ply,side,move.san)}</b>.</p>
        {playedReply&&<div className="analysis-actions">
          <button className="button outline" onClick={()=>setStep(response?0:1)}>
            {response?`Back to played ${move.san}`:`Show Stockfish’s reply ${playedReply.san}`}
          </button>
          {response&&<span className="muted">Suggested reply to the played move.</span>}
        </div>}
      </>}
      {frame&&<>
        <p><b>{source} suggested line</b> · {step+1}/{frames.length}</p>
        <div className="variation-history">{frames.map((item,index)=><button type="button" className="text-button" aria-pressed={step===index} key={index} onClick={()=>setStep(index)}>{moveLabel(ply+index,(ply+index)%2===0?'w':'b',item.san)}</button>)}</div>
        <div className="analysis-actions">
          <button className="text-button" disabled={step===0} onClick={()=>setStep(step-1)}>Previous line move</button>
          <button className="text-button" disabled={step>=frames.length-1} onClick={()=>setStep(step+1)}>Next line move</button>
        </div>
      </>}
      {preview==='board'&&<>
        <p className="muted">{blocked?'Stockfish will be available when the game review finishes.':ended?'This position ends the game.':`Play ${side==='w'?'White':'Black'}: drag a piece or select its square and destination. Stockfish replies automatically.`}</p>
        {busy&&<p role="status" className="notice">Stockfish is finding its reply…</p>}
        {error&&<p role="alert" className="notice error">{error} Try your move again.</p>}
        {reply?.reply&&<p role="status"><b>Stockfish replied: {reply.reply.san}</b></p>}
        {reply?.reason&&<p className="notice">{reply.reason}</p>}
        {score&&<p className="muted">Stockfish evaluation after your move: {score} (White’s perspective).</p>}
        <TurnLegend turn={preview==='board'?lastTurn:null}/>
        <MoveHelperPanel enabled={helperOn} setEnabled={setHelperOn} helper={helper} note={helperNote}/>
        <div className="variation-history">{turns.map((turn,index)=><span key={index}>You: {turn.played}{turn.reply&&` · Stockfish: ${turn.reply}`}</span>)}</div>
        <div className="analysis-actions">
          <PlayEngineButton onClick={playSuggestion} disabled={!interactive||suggesting} thinking={suggesting}/>
          {better&&!moves.length&&<button className="button green" disabled={!interactive} onClick={()=>play(better)}>Try {better.san} against Stockfish</button>}
          {moves.length>0&&<><button className="text-button" disabled={busy} onClick={undo}>Undo last turn</button><button className="text-button" disabled={busy} onClick={()=>reset()}>Reset variation</button></>}
        </div>
        {limit&&<p className="muted">Reset the variation or choose another position to keep practicing.</p>}
      </>}
    </div>
  </>;
}
