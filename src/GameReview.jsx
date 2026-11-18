import React,{useEffect,useMemo,useRef,useState} from 'react';
import ReviewBoard from './ReviewBoard.jsx';
import {evaluationText,judgments,moveLabel,reviewMoves} from './game-review.js';
import {findPatterns} from './patterns.js';

const symbols={Blunder:'??',Mistake:'?',Inaccuracy:'?!'};

export default function GameReview({game,analysis,ply,setPly,api,action,busy,running,setMessage,openLesson}){
  const [side,setSide]=useState('mine'),[severity,setSeverity]=useState('all');
  const boardTop=useRef(null),jumpAfterAnalysis=useRef(false);
  const reviewed=useMemo(()=>reviewMoves(game,analysis),[game,analysis]);
  const patterns=useMemo(()=>findPatterns(game,reviewed),[game,reviewed]);
  const [patternKey,setPatternKey]=useState(null);
  const position=Math.min(Math.max(0,ply),game.positions.length-1);
  const cloud=game.lichess,local=analysis?.evaluations;
  const own=reviewed.filter(move=>move.color===game.color&&move.judgment);
  const players=[
    {filter:'mine',label:'You',moves:reviewed.filter(move=>move.color===game.color)},
    {filter:'opponent',label:game.opponent,moves:reviewed.filter(move=>move.color!==game.color)}
  ];
  const matchesSide=(move,player)=>player==='both'||(move.color===game.color)===(player==='mine');
  const matching=reviewed.filter(move=>move.judgment&&matchesSide(move,side)&&(severity==='all'||move.judgment===severity));
  const blundersOnly=severity==='Blunder';
  const displayedMoves=blundersOnly?matching:reviewed;
  const activeIndex=matching.findIndex(move=>move.ply===position);
  const previous=matching.filter(move=>move.ply<position).at(-1);
  const next=matching.find(move=>move.ply>position);
  const current=reviewed[position];
  const exercise=analysis?.lessons.find(lesson=>lesson.ply===position);
  const pattern=patterns.find(item=>`${item.ply}:${item.id}`===patternKey&&item.ply===position);

  function inspect(at){
    setPly(at);
    boardTop.current?.scrollIntoView({block:'start'});
  }

  function showBlunders(player){
    setSide(player);
    setSeverity('Blunder');
    const blunders=reviewed.filter(move=>move.judgment==='Blunder'&&matchesSide(move,player));
    if(blunders.length&&!blunders.some(move=>move.ply===position))setPly(blunders[0].ply);
  }

  useEffect(()=>{
    if(!jumpAfterAnalysis.current||busy||running)return;
    jumpAfterAnalysis.current=false;
    const first=own[0]||matching[0];
    if(first){
      setPly(first.ply);
      boardTop.current?.scrollIntoView({block:'start'});
    }
  },[reviewed,busy,running]);

  function analyze(){
    jumpAfterAnalysis.current=true;
    setSide('mine');
    setSeverity('all');
    return action(async()=>{
      let note;
      try{
        const result=await api(`/api/lichess/${game.id}/refresh`,{});
        note=result.available
          ? `Lichess analysis available${result.complete?'':' (partial)'}. ${result.annotations} annotations imported.`
          : 'Lichess has no saved analysis for this game yet.';
      }catch(error){
        note=`Could not refresh Lichess analysis. ${error.message}`;
      }
      try{
        if(!local)await api(`/api/analyze/${game.id}`,{});
      }catch(error){
        throw new Error(`${note} Stockfish review: ${error.message}`);
      }
      setMessage(`${note} Stockfish covers the game positions and supplies missing recommendations.`);
    });
  }

  return <section className="card review">
    <div className="section-heading">
      <div><h3>You vs {game.opponent}</h3><p className="muted">{game.opening} · You played {game.color==='w'?'White':'Black'}</p></div>
      <span className={`result ${game.result}`}>{game.result}</span>
    </div>
    <div className="analysis-actions">
      <button className="button green" disabled={busy||running} onClick={analyze}>
        {running?'Analyzing game…':busy?'Working…':local?'Refresh game analysis':'Analyze game'}
      </button>
      <a className="button outline" href={`https://lichess.org/${game.id}/${game.color==='w'?'white':'black'}#analysis`} target="_blank" rel="noreferrer">Lichess analysis board ↗</a>
    </div>
    <p className="muted">Imports saved Lichess annotations and checks the positions with Stockfish. To request a Lichess server review, use its analysis board.</p>

    <section className="review-findings">
      <div className="section-heading blunder-heading">
        <h4>Find a mistake</h4>
        <button className="button outline blunder-shortcut" aria-pressed={blundersOnly}
          onClick={()=>blundersOnly?setSeverity('all'):showBlunders('both')}>Blunders only</button>
      </div>
      <div className="blunder-comparison" role="group" aria-label="Compare blunders">
        {players.map(player=>{
          const count=player.moves.filter(move=>move.judgment==='Blunder').length;
          const evaluated=player.moves.filter(move=>move.evaluated).length;
          return <button className="blunder-player" key={player.filter}
            aria-pressed={blundersOnly&&side===player.filter} onClick={()=>showBlunders(player.filter)}>
            <span className="blunder-player-name">{player.label}</span>
            <strong className="blunder-total">{evaluated?count:'—'} {count===1?'blunder':'blunders'}</strong>
            <small>{evaluated} of {player.moves.length} moves evaluated</small>
          </button>;
        })}
      </div>
      <div className="annotation-stats review-counts">
        {judgments.slice(1).map(judgment=><div key={judgment}><strong>{own.filter(move=>move.judgment===judgment).length}</strong><span>{judgment==='Inaccuracy'?'Inaccuracies':'Mistakes'} · your moves</span></div>)}
      </div>
      <div className="analysis-filters">
        <label>Player<select value={side} onChange={event=>setSide(event.target.value)}><option value="mine">My moves</option><option value="opponent">Opponent’s moves</option><option value="both">Both players</option></select></label>
        <label>Show<select value={severity} onChange={event=>setSeverity(event.target.value)}><option value="all">All flagged moves</option>{judgments.map(item=><option key={item}>{item}</option>)}</select></label>
      </div>
      {matching.length>0?<div className="review-finding-nav">
        <label>Flagged move<select value={activeIndex<0?'':position} onChange={event=>{if(event.target.value!=='')inspect(Number(event.target.value));}}>
          <option value="">Choose a move</option>
          {matching.map(move=><option value={move.ply} key={move.ply}>{moveLabel(move.ply,move.color,move.san)} · {move.judgment} · {move.color===game.color?'You':'Opponent'} · {move.judgmentSource}</option>)}
        </select></label>
        <button className="text-button" disabled={!previous} onClick={()=>inspect(previous.ply)}>{blundersOnly?'Previous blunder':'Previous flagged'}</button>
        <button className="text-button" disabled={!next} onClick={()=>inspect(next.ply)}>{blundersOnly?'Next blunder':'Next flagged'}</button>
      </div>:<p className="muted">{cloud||local?'No flagged moves match this filter.':'Analyze the game to find positions to review.'}</p>}
    </section>

    <section className="review-patterns">
      <h4>Famous patterns</h4>
      {patterns.length?<>
        <p className="muted">Choose one to see the idea on the board with arrows.</p>
        <div className="pattern-list">{patterns.map(item=>{const key=`${item.ply}:${item.id}`;return <button key={key} className="pattern-chip" aria-pressed={pattern===item}
          onClick={()=>{setPatternKey(key);inspect(item.ply);}}>
          <b>{item.kind==='missed'?'Missed: ':''}{item.name}</b>
          <small>{moveLabel(item.ply,game.moves[item.ply].color,game.moves[item.ply].san)} · {item.color===game.color?'You':game.opponent}</small>
        </button>;})}</div>
      </>:<p className="muted">{cloud||local?'No famous patterns found in this game.':'Analyze the game to also find patterns that were missed.'} Checks for Scholar’s mate, Fool’s mate, smothered mate, back-rank mate, knight forks, and missed mate in one.</p>}
    </section>

    <div ref={boardTop} className="review-board-anchor">
      <ReviewBoard key={position} game={game} ply={position} move={current} api={api} blocked={busy||running} pattern={pattern}/>
    </div>
    {exercise&&<button className="text-button" onClick={()=>openLesson(exercise)}>Practice this position ↗</button>}
    <div className="board-controls">
      <button onClick={()=>setPly(0)} disabled={position===0} aria-label="First position">|‹</button>
      <button onClick={()=>setPly(position-1)} disabled={position===0} aria-label="Previous move">‹</button>
      <span>{position===0?'Starting position':`After ${moveLabel(position-1,reviewed[position-1].color,reviewed[position-1].san)}`}</span>
      <button onClick={()=>setPly(position+1)} disabled={position>=reviewed.length} aria-label="Next move">›</button>
      <button onClick={()=>setPly(reviewed.length)} disabled={position>=reviewed.length} aria-label="Last position">›|</button>
    </div>
    {blundersOnly&&<h4>Blunders in move order</h4>}
    {blundersOnly&&!displayedMoves.length&&<p className="muted">No blunders found for this selection.</p>}
    <div className="moves">{displayedMoves.map(move=><button
      key={move.ply}
      className={[(move.judgment?position===move.ply:position===move.ply+1)?'current':'',move.judgment==='Blunder'?'move-blunder':''].join(' ')}
      title={move.judgment?`Before ${moveLabel(move.ply,move.color,move.san)} · ${move.judgment}`:undefined}
      onClick={()=>inspect(move.judgment?move.ply:move.ply+1)}
    >{blundersOnly?`${moveLabel(move.ply,move.color,move.san)} · ${move.color===game.color?'You':game.opponent}`:`${move.ply%2===0?`${Math.floor(move.ply/2)+1}. `:''}${move.san}`}
      {move.judgment&&<span className={`move-mark ${move.judgment.toLowerCase()}`}>{symbols[move.judgment]}</span>}
    </button>)}</div>

    {(cloud||local)&&<details className="lichess-analysis">
      <summary>{blundersOnly?'Analysis sources and blunder evaluations':'Analysis sources and all move evaluations'}</summary>
      <p className="muted">Lichess: {cloud?`${cloud.entries.length}/${reviewed.length} move entries`:'no saved review'}. Stockfish: {local?`${local.length}/${game.positions.length} positions checked`:'game review pending'}. Stockfish labels are estimates based on drops of 10, 20, or 30 percentage points in estimated winning chances.</p>
      {Number.isFinite(cloud?.summary?.[game.color==='w'?'white':'black']?.acpl)&&
        <p>Your average centipawn loss (Lichess): {cloud.summary[game.color==='w'?'white':'black'].acpl}</p>}
      <div className="all-evals">{displayedMoves.filter(move=>move.afterScore).map(move=><button key={move.ply} onClick={()=>inspect(move.ply)}>
        {moveLabel(move.ply,move.color,move.san)}<b>{evaluationText(move.afterScore)}</b><small>{move.scoreSource}{move.judgment?` · ${move.judgment}`:''}</small>
      </button>)}</div>
    </details>}
  </section>;
}
