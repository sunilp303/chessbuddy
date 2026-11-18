import React,{useState,useEffect,useId} from 'react';
import {Chess} from 'chess.js';
const glyphs={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
export default function Board({fen,orientation='w',onMove,lastMove,disabled=false,highlights={},arrows=[],ghosts=[],dragPieces=false}){
  const [selected,setSelected]=useState(null),[promotion,setPromotion]=useState(null);
  useEffect(()=>{setSelected(null);setPromotion(null);},[fen]);
  const chess=new Chess(fen),files=orientation==='w'?'abcdefgh':'hgfedcba',ranks=orientation==='w'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const legal=selected?chess.moves({square:selected,verbose:true}):[];
  function sendMove(from,to,candidates){
    if(candidates.some(move=>move.promotion))setPromotion({from,to});
    else onMove({from,to});
    setSelected(null);
  }
  function choose(square){
    if(disabled || !onMove)return;
    const match=legal.filter(m=>m.to===square);
    if(match.length)sendMove(selected,square,match);
    else setSelected(chess.get(square)?.color===chess.turn()?square:null);
  }
  function drop(event,to){
    if(!dragPieces||disabled||!onMove)return;
    event.preventDefault();
    const from=event.dataTransfer.getData('application/x-chessbuddy-square');
    if(!/^[a-h][1-8]$/.test(from))return;
    const candidates=chess.moves({square:from,verbose:true}).filter(move=>move.to===to);
    if(candidates.length)sendMove(from,to,candidates);
  }
  return <div className="board-wrap"><div className="board" role="group" aria-label="Chess board">{ranks.flatMap((rank,ri)=>[...files].map((file,fi)=>{const square=file+rank,piece=chess.get(square),target=legal.some(m=>m.to===square);return <button key={square} aria-label={`${square}${piece?` ${piece.color==='w'?'white':'black'} ${names[piece.type]}`:''}${highlights[square]?' · '+highlights[square].label:''}`} className={`square ${(file.charCodeAt(0)+rank)%2===0?'dark':'light'} ${selected===square?'selected':''} ${lastMove?.includes(square)?'last':''} ${highlights[square]?'guide-'+highlights[square].kind:''}`} onClick={()=>choose(square)} draggable={dragPieces&&!disabled&&piece?.color===chess.turn()} onDragStart={event=>{event.dataTransfer.setData('application/x-chessbuddy-square',square);event.dataTransfer.effectAllowed='move';setSelected(square);}} onDragOver={event=>{if(dragPieces&&!disabled&&onMove)event.preventDefault();}} onDrop={event=>drop(event,square)}>{(()=>{const ghost=!piece&&ghosts.find(g=>g.square===square);return ghost?<span className={`piece ghost ${ghost.color==='w'?'white-piece':''}`} aria-hidden="true">{glyphs[ghost.color+ghost.type]}</span>:<span className={`piece ${piece?.color==='w'?'white-piece':''}`}>{piece?glyphs[piece.color+piece.type]:''}</span>;})()}{target&&<i className="target"/>}{fi===0&&<small className="rank">{rank}</small>}{ri===7&&<small className="file">{file}</small>}</button>;}))}</div>{arrows.length>0&&<BoardArrows arrows={arrows} orientation={orientation}/>} {promotion&&<div className="promotion"><b>Choose your promotion</b>{['q','r','b','n'].map(p=><button key={p} onClick={()=>{onMove({...promotion,promotion:p});setPromotion(null);}}>{names[p]}</button>)}</div>}</div>;
}
function BoardArrows({arrows,orientation}){
 const id=useId();
 const center=s=>{const f=s.charCodeAt(0)-97,r=Number(s[1])-1;return orientation==='w'?[(f+.5)*12.5,(7-r+.5)*12.5]:[(7-f+.5)*12.5,(r+.5)*12.5];};
 return <svg className="board-arrows" viewBox="0 0 100 100" role="img" aria-label={arrows.map(a=>a.label).join('; ')}><defs>{arrows.map((a,i)=><marker key={i} id={id+'-arrow-'+i} markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={a.color}/></marker>)}</defs>{arrows.map((a,i)=>{const [x1,y1]=center(a.from),[x2,y2]=center(a.to);return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a.color} strokeWidth="1.6" opacity=".85" markerEnd={'url(#'+id+'-arrow-'+i+')'}><title>{a.label}</title></line>;})}</svg>;
}
