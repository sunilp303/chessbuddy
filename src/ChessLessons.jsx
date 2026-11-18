import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MAX_VARIATION_PLIES} from './limits.js';
import {Chess} from 'chess.js';
import Board from './Board.jsx';
import {LESSONS,lessonById,studyFrames} from './lesson-catalog.js';
import {applyUci} from './lesson-puzzles.js';
import {MoveHelperPanel,PlayEngineButton,TurnLegend,helperArrow,replyMove,turnMarks,useHelperSetting,useMoveHelper} from './MoveHelper.jsx';
import {helperFeedback} from './move-helper.js';

const solved=p=>Object.keys(p?.solvedPuzzles||{}).length;
export default function ChessLessons({learning,api,action,busy,refresh,setMessage}){
 const data=learning||{puzzles:{},progress:{}};
 const [activeId,setActiveId]=useState(()=>{try{return lessonById(localStorage.getItem('chessbuddy-lesson'))?.id||'fork';}catch{return 'fork';}}),[category,setCategory]=useState('all'),[level,setLevel]=useState('all'),[query,setQuery]=useState(''),[difficulty,setDifficulty]=useState('easiest');
 const lesson=lessonById(activeId)||LESSONS[0],puzzle=data.puzzles[lesson.id],progress=data.progress[lesson.id];
 const matches=LESSONS.filter(l=>(category==='all'||l.category===category)&&(level==='all'||l.level===level)&&(`${l.title} ${l.idea} ${l.example}`.toLowerCase().includes(query.toLowerCase())));
 useEffect(()=>{if(matches.length&&!matches.some(l=>l.id===activeId))choose(matches[0].id);},[category,level,query]);
 function choose(id){setActiveId(id);try{localStorage.setItem('chessbuddy-lesson',id);}catch{}}
 async function load(){await action(async()=>{const r=await api(`/api/lessons/${lesson.id}/puzzle`,{difficulty});setMessage(r.repeated?'Lichess returned the same puzzle. You can replay it or request another later.':`Loaded a themed puzzle for ${lesson.title}. Take your time and find a plan.`);});}
 const totalSolved=Object.values(data.progress).reduce((n,p)=>n+solved(p),0),turns=Object.values(data.progress).reduce((n,p)=>n+(p.studyTurns||0),0),attempts=Object.values(data.progress).reduce((n,p)=>n+(p.attempts||0),0);
 return <><div className="page-title"><div><p className="eyebrow">NOTICE A PATTERN. TRY AN IDEA.</p><h1>Chess lessons</h1><p>A broad library of tactics, mating patterns, strategy, and endgames.</p></div><span className="tag">{LESSONS.length} topics · learn at your pace</span></div>
 <section className="skill-stats"><div className="card"><small>Topics to explore</small><strong>{LESSONS.length}</strong><span>{LESSONS.filter(l=>l.kind==='study').length} worked strategy positions</span></div><div className="card"><small>Puzzles solved without hints</small><strong>{totalSolved}</strong><span>Unique puzzles within each topic</span></div><div className="card"><small>Puzzle moves tried</small><strong>{attempts}</strong><span>Trying is part of learning</span></div><div className="card"><small>Turns against Stockfish</small><strong>{turns}</strong><span>Exploration, not a strategy grade</span></div></section>
 <section className="card lesson-search"><label>Search lessons<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Forks, castling, opposition…"/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{[...new Set(LESSONS.map(l=>l.category))].map(c=><option key={c}>{c}</option>)}</select></label><label>Level<select value={level} onChange={e=>setLevel(e.target.value)}><option value="all">All levels</option>{['Beginner','Intermediate','Advanced'].map(l=><option key={l}>{l}</option>)}</select></label></section>
 <div className="lesson-layout"><section className="card lesson-library"><div className="section-heading"><h3>Your lesson library</h3><span className="muted">{matches.length} topics</span></div><div className="lesson-list">{matches.map(l=>{const p=data.progress[l.id];return <button className={`lesson-card ${l.id===lesson.id?'chosen':''}`} key={l.id} onClick={()=>choose(l.id)} disabled={busy}><small>{l.category} · {l.level}</small><b>{l.title}</b><span>{l.kind==='puzzle'?'Themed puzzle':'Worked example + Stockfish'}{solved(p)?` · ${solved(p)} solved`:p?.studyTurns?` · ${p.studyTurns} practice turns`:''}</span></button>;})}{!matches.length&&<p className="muted">No topics match. Try a shorter search or another category.</p>}</div></section>
 <section className="card lesson-detail"><div className="section-heading"><div><p className="eyebrow">{lesson.category.toUpperCase()} · {lesson.level.toUpperCase()}</p><h2>{lesson.title}</h2></div><span className="tag">{lesson.kind==='puzzle'?'Pattern practice':'Explore a plan'}</span></div><p className="lesson-idea">{lesson.idea}</p><div className="lesson-concept"><b>{lesson.kind==='puzzle'?'For example':'In this teaching position'}</b><p>{lesson.example}</p>{lesson.kind==='puzzle'&&<small>This describes the general pattern; the loaded puzzle may use different pieces.</small>}</div><div className="prompt">{lesson.question}</div>
 {lesson.kind==='puzzle'&&<><div className="analysis-actions lesson-load"><label>Puzzle difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{[['easiest','Easiest'],['easier','Easier'],['normal','Normal'],['harder','Harder'],['hardest','Hardest']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button className="button green" disabled={busy} onClick={load}>{busy?'Loading…':puzzle?'Load another themed puzzle':'Load an example & puzzle'}</button></div><p className="muted">One public Lichess puzzle is requested when you load it. Cached examples remain available locally. Puzzle difficulty is relative to Lichess’s anonymous baseline; it is not your child’s rating.</p></>}
 {lesson.kind==='study'||puzzle?<LessonPlayer key={`${lesson.id}:${puzzle?.id||'study'}`} lesson={lesson} puzzle={puzzle} api={api} refresh={refresh}/>:<div className="chart-empty">Load a themed puzzle to get an interactive example and practice board.</div>}
 <hr/><div className="lesson-progress"><b>Your practice in this topic</b><p>{progress?.attempts||0} puzzle moves tried · {solved(progress)} unique puzzles solved without hints · {Object.keys(progress?.assistedPuzzles||{}).length} puzzles completed with help · {progress?.studyTurns||0} Stockfish practice turns.</p><small>Progress is saved on this computer. Lesson practice is independent of the selected game/date scope.</small></div>{lesson.source&&<p className="muted">Position source: <a href={lesson.source} target="_blank" rel="noreferrer">Lichess official practice study ↗</a>. Explanations are written for this app.</p>}</section></div>
 <details className="card lesson-method"><summary>How the lessons and tutor work</summary><p className="muted">This library covers common and advanced ideas, not every possible chess plan. Strategy examples are legal illustrative lines; their replies are not necessarily forced or uniquely best. Stockfish supplies concrete move suggestions, evaluations, and replies—not a language-model explanation of every plan. Tactical puzzles follow Lichess’s published solution; another good move may exist. Seeing the example or asking for a hint marks that run as assisted. Completing the same puzzle again does not add another unique unassisted solve. Practice turns against Stockfish are counted separately from puzzle solves.</p><p className="muted">Topic references: <a href="https://lichess.org/practice" target="_blank" rel="noreferrer">Lichess Practice</a> and <a href="https://lichess.org/training/themes" target="_blank" rel="noreferrer">Puzzle Themes</a>. Lichess puzzles are public domain. Practice requests are individual and on demand; the app does not bulk-download puzzles. Local Stockfish searches are limited, and suggestions can change with deeper analysis.</p></details></>;
}
function LessonPlayer({lesson,puzzle,api,refresh}){
 const base=lesson.kind==='study'?lesson.fen:puzzle.fen,side=new Chess(base).turn();
 const frames=useMemo(()=>{
  if(lesson.kind==='study')return studyFrames(lesson);
  const b=new Chess(base),result=[{fen:base,san:'Starting position'}];for(const u of puzzle.solution){const m=applyUci(b,u);result.push({fen:b.fen(),san:m.san,from:m.from,to:m.to,uci:u});}return result;
 },[lesson.id,puzzle?.id]);
 const [mode,setMode]=useState('example'),[step,setStep]=useState(0),[fen,setFen]=useState(base),[moves,setMoves]=useState([]),[line,setLine]=useState([]),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[helpUsed,setHelpUsed]=useState(false),[showHint,setShowHint]=useState(false),[complete,setComplete]=useState(false),[engine,setEngine]=useState(null),[last,setLast]=useState(null);
 const [branchStart,setBranchStart]=useState(0),[branchSide,setBranchSide]=useState(side);
 const [helperOn,setHelperOn]=useHelperSetting(),[helperNote,setHelperNote]=useState(null);
 const [lastTurn,setLastTurn]=useState(null),[suggesting,setSuggesting]=useState(false);
 const mounted=useRef(true);useEffect(()=>()=>{mounted.current=false;},[]);
 const currentFen=mode==='example'?frames[step].fen:fen,board=new Chess(currentFen),ended=board.isGameOver();
 const helper=useMoveHelper({enabled:helperOn,active:mode==='engine'&&!busy&&!ended&&board.turn()===branchSide&&moves.length<MAX_VARIATION_PLIES,positionKey:currentFen,
  fetchHint:()=>api(`/api/lessons/${lesson.id}/analyze`,{puzzleId:puzzle?.id,moves})});
 function start(next){setMode(next);setFen(base);setMoves([]);setLine([]);setLast(null);setFeedback('');setError('');setComplete(false);setEngine(null);setStep(0);setBranchStart(0);setBranchSide(side);setHelperNote(null);setLastTurn(null);}
 function exampleStep(next){setStep(next);setEngine(null);if(next>0)setHelpUsed(true);}
 async function play(move,suggested=false){
  const fromExample=mode==='example';
  const prefix=fromExample?frames.slice(1,step+1).map(frame=>frame.uci):moves;
  if(busy||complete||ended||prefix.length>=MAX_VARIATION_PLIES)return;
  const b=new Chess(currentFen);let m;try{m=b.move(move);}catch{return;}
  const startPly=fromExample?prefix.length:branchStart;
  const played=m.from+m.to+(m.promotion||''),history=[...prefix,played];setError('');setHelperNote(null);setBusy(true);
  try{
   const {hint,timedOut}=mode==='engine'?await helper.settle():{};
   const r=await api(`/api/lessons/${lesson.id}/${mode==='puzzle'?'attempt':'reply'}`,{puzzleId:puzzle?.id,moves:history,startPly,revealed:helpUsed});if(!mounted.current)return;
   if(mode==='puzzle'&&!r.correct){setFeedback('That move is legal, but it is not the published puzzle solution. Try again—another good move may exist.');return;}
   if(fromExample){setMode('engine');setBranchStart(startPly);setBranchSide(m.color);}
   setFen(r.fen);setMoves(r.moves||[...history,...(r.reply?[r.reply.uci]:[])]);setLine([...line,`You: ${m.san}`,...(r.reply?[`${mode==='puzzle'?'Puzzle reply':'Stockfish'}: ${r.reply.san}`]:[])]);setLast(r.reply?[r.reply.uci.slice(0,2),r.reply.uci.slice(2,4)]:[m.from,m.to]);setEngine(null);
   if(mode==='puzzle'){setComplete(r.complete);setFeedback(r.complete?(helpUsed?'You completed the line with help. Try a fresh puzzle next.':'You completed the puzzle without hints. Well done spotting the pattern!'):'That follows the solution. Now find your next move.');}
   else{setFeedback(r.reason||`Stockfish replied ${r.reply?.san||'—'}. What changed in the position?`);setLastTurn({user:{from:m.from,to:m.to,san:m.san,color:m.color,piece:m.piece},reply:replyMove(b.fen(),r.reply)});if(hint&&!timedOut&&!suggested)setHelperNote(helperFeedback({hint,played,playedSan:m.san,side:m.color,after:r,checkmate:r.reason==='Checkmate'&&!r.reply}));}
  }catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current){setBusy(false);refresh();}}
 }
 async function playSuggestion(){
  const history=mode==='example'?frames.slice(1,step+1).map(f=>f.uci):moves;setSuggesting(true);setError('');
  try{
   const {hint}=mode==='engine'?await helper.settle():{};
   const best=hint?.best||(await api(`/api/lessons/${lesson.id}/analyze`,{puzzleId:puzzle?.id,moves:history})).best;
   if(!mounted.current)return;
   setSuggesting(false);
   await play({from:best.from,to:best.to,promotion:best.uci[4]},true);
  }catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current)setSuggesting(false);}
 }
 async function analyze(){
  const history=mode==='example'?frames.slice(1,step+1).map(f=>f.uci):moves;setBusy(true);setError('');
  if(mode==='engine')await helper.settle();
  try{const r=await api(`/api/lessons/${lesson.id}/analyze`,{puzzleId:puzzle?.id,moves:history});if(mounted.current)setEngine(r);}catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current)setBusy(false);}
 }
 const marks=mode==='engine'?turnMarks(lastTurn):{arrows:[],ghosts:[]};
 const frame=frames[step],arrows=[...marks.arrows,...(helper.suggestion&&!engine?helperArrow(helper):engine?.best?[{from:engine.best.from,to:engine.best.to,color:'#33845d',label:`Stockfish suggests ${engine.best.san}`}]:
   mode==='example'&&step>0?[{from:frame.from,to:frame.to,color:'#33845d',label:`Example move ${frame.san}`}]:[])];
 const whiteScore=Number.isFinite(engine?.white)?`${engine.white>0?'+':''}${(engine.white/100).toFixed(2)}`:null;
 return <div className="lesson-player"><div className="range-buttons" role="group" aria-label="Lesson activity"><button className={mode==='example'?'selected-range':''} disabled={busy} onClick={()=>start('example')}>Worked example</button>{lesson.kind==='puzzle'&&<button className={mode==='puzzle'?'selected-range':''} disabled={busy} onClick={()=>start('puzzle')}>Practice the puzzle</button>}<button className={mode==='engine'?'selected-range':''} disabled={busy} onClick={()=>start('engine')}>Practice vs Stockfish</button></div>
 <div className="section-heading"><h3>{mode==='example'?'Explore the example':mode==='puzzle'?'Find the puzzle moves':'Test your own plan'}</h3><span className="tag">{mode==='example'?(board.turn()==='w'?'White':'Black')+' to move':'You play '+((mode==='engine'?branchSide:side)==='w'?'White':'Black')}</span></div>
 {puzzle&&<p className="muted">Lichess puzzle {puzzle.id} · puzzle rating {puzzle.rating} · <a href={puzzle.source} target="_blank" rel="noreferrer">Original ↗</a></p>}
 <Board fen={currentFen} orientation={mode==='engine'?branchSide:side} onMove={play} dragPieces ghosts={marks.ghosts} disabled={busy||suggesting||complete||ended||(mode==='example'?step:moves.length)>=MAX_VARIATION_PLIES} lastMove={mode==='example'&&step>0?[frame.from,frame.to]:last} arrows={arrows}/>
 {mode==='example'?<><div className="board-controls"><button aria-label="Previous example move" disabled={!step||busy} onClick={()=>exampleStep(step-1)}>‹</button><span>{step===0?'Starting position':`${step}. ${frame.san}`}</span><button aria-label="Next example move" disabled={step===frames.length-1||busy} onClick={()=>exampleStep(step+1)}>›</button></div><p className="muted">{lesson.kind==='study'?'This demonstrates an idea. Opponents can choose another reply, and several plans may be good.':'Step through the validated puzzle line, or try it first without looking. Viewing moves counts as help for this puzzle.'}</p><p className="muted">Drag a piece or select its square and destination to try a move from here. Stockfish will reply.</p></>:<p className="muted">{mode==='puzzle'?'Select a piece, then its destination. Replies follow the published puzzle line.':'Play a legal move; local Stockfish will choose its best reply found in the search. This is open-ended exploration, not a fixed-answer strategy test.'}</p>}
 {busy&&<p className="notice" role="status">{mode==='puzzle'?'Checking the puzzle move…':'Stockfish is thinking…'}</p>}{feedback&&<p className="notice" role="status">{feedback}</p>}{error&&<p className="notice error" role="alert">{error}</p>}{mode==='engine'&&<TurnLegend turn={lastTurn}/>}{mode==='engine'&&<MoveHelperPanel enabled={helperOn} setEnabled={setHelperOn} helper={helper} note={helperNote}/>}<div className="variation-history">{line.map((m,i)=><span key={i} className={m.startsWith('Stockfish')||m.startsWith('Puzzle')?'engine-turn':''}>{m}</span>)}</div>
 <div className="analysis-actions"><button className="button outline" disabled={busy} onClick={()=>{setShowHint(true);setHelpUsed(true);}}>Give me a thinking hint</button>{mode!=='puzzle'&&<button className="button green" disabled={busy||ended||suggesting} onClick={analyze}>Ask Stockfish about this position</button>}{mode!=='puzzle'&&<PlayEngineButton onClick={playSuggestion} disabled={busy||ended||suggesting||complete||(mode==='example'?step:moves.length)>=MAX_VARIATION_PLIES} thinking={suggesting}/>}<button className="text-button" disabled={busy} onClick={()=>start(mode)}>Reset this board</button></div>{showHint&&<div className="hint"><b>Think it through</b><p>{lesson.hint}</p>{mode==='puzzle'&&<p>For {lesson.title.toLowerCase()}, ask how the theme could create a forcing threat.</p>}</div>}
 {engine&&<div className="engine-teacher"><b>{engine.best?`Stockfish suggests ${engine.best.san}`:engine.reason}</b>{engine.observation&&<p>{engine.observation}</p>}{engine.best&&<button className="button green" disabled={busy||ended||(mode==='example'?step:moves.length)>=MAX_VARIATION_PLIES} onClick={()=>play({from:engine.best.from,to:engine.best.to,promotion:engine.best.uci[4]})}>Play {engine.best.san} against Stockfish</button>}{engine.line?.length>0&&<p className="variation">{engine.line.join(' ')}</p>}{whiteScore&&<p className="muted">{engine.score?.type==='mate'?`A forced mate was found, favoring ${engine.white>0?'White':'Black'}.`:`Evaluation: ${whiteScore}, White’s perspective.`} This is engine analysis, not a guarantee that the teaching line is the only good plan.</p>}</div>}
 {mode!=='example'&&ended&&!feedback&&<p className="notice">{board.isCheckmate()?'Checkmate':'Draw'}—reset to practice again.</p>}{mode!=='example'&&moves.length>=MAX_VARIATION_PLIES&&<p className="muted">This practice branch reached its length limit. Reset the board to explore another plan.</p>}{mode==='puzzle'&&helpUsed&&<p className="muted">Help has been used on this puzzle. You can still complete it; that completion is recorded separately.</p>}
 </div>;
}
