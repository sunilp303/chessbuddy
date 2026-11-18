import React,{useEffect,useRef,useState} from 'react';
import {Chess} from 'chess.js';
import {HELPER_SECONDS} from './move-helper.js';

const storageKey='chessbuddy-move-helper';
// The server runs one Stockfish search at a time, so hint searches queue here and moves wait for them.
let hintQueue=Promise.resolve();
const START_DELAY_MS=1000;

export function useHelperSetting(){
  const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(storageKey)==='on';}catch{return false;}});
  function change(next){
    setEnabled(next);
    try{localStorage.setItem(storageKey,next?'on':'off');}catch{}
  }
  return [enabled,change];
}

// While it is the player's turn, ask Stockfish for its move in the background and reveal it after 30 seconds.
export function useMoveHelper({enabled,active,positionKey,fetchHint}){
  const [hint,setHint]=useState(null),[left,setLeft]=useState(null),[shown,setShown]=useState(false);
  const pending=useRef(null),wanted=useRef(null),timerRef=useRef(null),fetchRef=useRef(fetchHint);
  fetchRef.current=fetchHint;
  useEffect(()=>{
    setHint(null);setShown(false);setLeft(null);pending.current=null;wanted.current=null;
    if(!enabled||!active)return;
    // `needed` is set when the player moves, so the search still runs after this position is left.
    const job={live:true,needed:false},fetchHint=fetchRef.current,go=()=>job.live||job.needed;
    const request=new Promise(resolve=>setTimeout(resolve,START_DELAY_MS))
      .then(()=>go()?hintQueue=hintQueue.then(()=>go()?fetchHint().catch(()=>false):null):null);
    request.then(result=>{if(job.live&&result!==null)setHint(result);});
    pending.current=request;wanted.current=job;
    const started=Date.now();
    setLeft(HELPER_SECONDS);
    const timer=setInterval(()=>{
      const remaining=HELPER_SECONDS-Math.floor((Date.now()-started)/1000);
      if(remaining>0)return setLeft(remaining);
      clearInterval(timer);setLeft(0);setShown(true);
    },1000);
    timerRef.current=timer;
    return()=>{job.live=false;clearInterval(timer);};
  },[enabled,active,positionKey]);

  // Call before sending a move: waits for the background search so two Stockfish requests never overlap.
  async function settle(){
    const request=pending.current,timedOut=shown;
    if(wanted.current)wanted.current.needed=true;
    const result=request?await request:null;
    await hintQueue;
    return {hint:result||null,timedOut};
  }
  // Skip the wait: show the suggestion now (counts the same as waiting 30 seconds).
  function revealNow(){
    clearInterval(timerRef.current);
    setLeft(0);setShown(true);
  }
  const suggestion=shown&&hint?.best?hint.best:null;
  return {settle,revealNow,suggestion,shown,failed:hint===false,secondsLeft:left,running:enabled&&active&&!shown};
}

export function helperArrow(helper){
  const best=helper.suggestion;
  return best?[{from:best.from,to:best.to,color:'#267154',label:`Helper suggests ${best.san}`}]:[];
}

export function MoveHelperPanel({enabled,setEnabled,helper,note}){
  return <div className="move-helper">
    <label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
      Helper mode: show a suggestion after {HELPER_SECONDS} seconds, or check my move if I play sooner</label>
    {enabled&&helper.running&&helper.secondsLeft!==null&&<div className="helper-wait">
      <p className="muted" aria-live="off">Your turn. A suggestion appears in {helper.secondsLeft}s.</p>
      <button type="button" className="button outline helper-now" onClick={helper.revealNow}>Show suggestion now</button>
    </div>}
    {enabled&&helper.shown&&(helper.suggestion
      ?<p role="status" className="notice"><b>Helper suggestion: {helper.suggestion.san}</b> (green arrow). You can play it or choose your own move.</p>
      :<p role="status" className="muted">{helper.failed?'Stockfish could not make a suggestion right now.':'Stockfish is still thinking about a suggestion…'}</p>)}
    {note&&<p role="status" className={`notice${note.tone==='better'?' helper-better':''}`}>{note.text}</p>}
  </div>;
}

const YOU='#3b6fb6',ENGINE='#7d4fa6';

// A turn is {user, reply}; each move is {from,to,san,color,piece}.
export function turnMarks(turn){
  const list=turn?[[turn.user,YOU,'Your move'],[turn.reply,ENGINE,'Stockfish replied']].filter(([move])=>move):[];
  return {
    arrows:list.map(([move,color,label])=>({from:move.from,to:move.to,color,label:`${label} ${move.san}`})),
    ghosts:list.map(([move])=>({square:move.from,color:move.color,type:move.piece}))
  };
}

// Stockfish's reply as a turn record, read from the position before the reply.
export function replyMove(fenBefore,reply){
  if(!reply)return null;
  const piece=new Chess(fenBefore).get(reply.from);
  return piece?{from:reply.from,to:reply.to,san:reply.san,color:piece.color,piece:piece.type}:null;
}

export function TurnLegend({turn}){
  if(!turn)return null;
  return <div className="turn-legend" aria-hidden="true">
    <span><i style={{background:YOU}}/>Your move {turn.user.san}</span>
    {turn.reply&&<span><i style={{background:ENGINE}}/>Stockfish {turn.reply.san}</span>}
    <span><span className="ghost-key">♟</span>Grey: where the pieces came from</span>
  </div>;
}

export function PlayEngineButton({onClick,disabled,thinking}){
  return <button type="button" className="button outline" disabled={disabled} onClick={onClick}
    title="Ask Stockfish for its best move here and play it for you">
    {thinking?'Stockfish is choosing…':'Play Stockfish’s move ▶'}
  </button>;
}
