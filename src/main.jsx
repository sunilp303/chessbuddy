import React, {useEffect,useState,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import GameReview from './GameReview.jsx';
import Ratings from './Ratings.jsx';
import USCFRatingsSettings from './USCFRatingsSettings.jsx';
import SkillProgress from './SkillProgress.jsx';
import GuideReview from './GuideReview.jsx';
import ScopePicker from './ScopePicker.jsx';
import {DEFAULT_SCOPE,resolveScope} from './scope.js';
import ChessLessons from './ChessLessons.jsx';
import DailyPractice from './DailyPractice.jsx';
import PracticeTime from './PracticeTime.jsx';
import GameFilters from './GameFilters.jsx';
import {DEFAULT_GAME_FILTERS,filterGames} from './game-filters.js';
import {createPractice,readPractice} from './daily-practice.js';

async function requestJson(url,body){
 const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'Request failed');
 return data;
}

async function requestApi(url,body,setEngineProgress){
 const data=await requestJson(url,body);
 if(!data.engineRequest)return data;
 const {engineRequest}=data;
 const showProgress=engineRequest.fens.length>1;
 try{
   if(showProgress)setEngineProgress({done:0,total:engineRequest.fens.length});
   const {evaluateInBrowser}=await import('./browser-engine.js');
   const evaluations=await evaluateInBrowser(engineRequest,showProgress?(done,total)=>setEngineProgress({done,total}):undefined);
   return await requestJson(url,{...body,engineResults:{username:engineRequest.username,evaluations}});
 }finally{
   if(showProgress)setEngineProgress(null);
 }
}

function App(){
 const [state,setState]=useState(null),[tab,setTab]=useState('home'),[gameId,setGameId]=useState(null),[ply,setPly]=useState(0),[lessonId,setLessonId]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [usernameDraft,setUsernameDraft]=useState(null),[syncing,setSyncing]=useState(false);
 const [engineProgress,setEngineProgress]=useState(null);
 const [practiceSession,setPracticeSession]=useState(null);
 const api=(url,body)=>requestApi(url,body,setEngineProgress);
 const [scope,setScope]=useState(()=>{try{return {...DEFAULT_SCOPE,...JSON.parse(localStorage.getItem('chessbuddy-scope-v1')||'{}')};}catch{return {...DEFAULT_SCOPE};}});
 useEffect(()=>{try{localStorage.setItem('chessbuddy-scope-v1',JSON.stringify(scope));}catch{}},[scope]);
 const [gameFilters,setGameFilters]=useState(()=>{try{return {...DEFAULT_GAME_FILTERS,...JSON.parse(localStorage.getItem('chessbuddy-game-filters-v1')||'{}')};}catch{return {...DEFAULT_GAME_FILTERS};}});
 useEffect(()=>{try{localStorage.setItem('chessbuddy-game-filters-v1',JSON.stringify(gameFilters));}catch{}},[gameFilters]);
 async function refresh(){try{setState(await api('/api/state'));}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();},[]);
 useEffect(()=>{if(state?.job?.status!=='running')return;const id=setInterval(refresh,1500);return()=>clearInterval(id);},[state?.job?.status]);
 const games=state?.games || [],analyses=state?.analyses || {},lessons=Object.values(analyses).flatMap(a=>a.lessons),practice=state?.practice || {};
 const filteredGames=useMemo(()=>filterGames(games,gameFilters,analyses),[games,gameFilters,analyses]);
 const practiceKey=state?.username?'chessbuddy-guided-v1:user:'+state.username:'chessbuddy-guided-v1:guest';
 const savedSession=practiceSession?.key===practiceKey?practiceSession.session:readPractice(practiceKey);
 function saveSession(session){
   setPracticeSession({key:practiceKey,session});
   try{localStorage.setItem(practiceKey,JSON.stringify(session));}catch{}
 }
 function restartSession(){saveSession(createPractice(games,lessons,practice,savedSession));}
 function startSession(){
   if(!savedSession||savedSession.phase==='recap')restartSession();
   setTab('daily');
 }
 const trackingScope=useMemo(()=>resolveScope(games,scope),[games,scope]);
 const scopeKey=JSON.stringify(scope);
 const game=games.find(g=>g.id===gameId)||games[0],analysis=game&&analyses[game.id];
 const lesson=lessons.find(l=>l.id===lessonId)||lessons[0];
 const due=lessons.filter(l=>!practice[l.id]?.dueAt || practice[l.id].dueAt<=Date.now());
 const themes=Object.entries(lessons.reduce((a,l)=>({...a,[l.theme]:(a[l.theme]||0)+1}),{})).sort((a,b)=>b[1]-a[1]);
 async function action(fn){setError('');setMessage('');setBusy(true);try{await fn();await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function syncLichess(){
   setSyncing(true);
   try{
     await action(async()=>{
       const result=await api('/api/sync',{});
       const games=result.gamesError?`Games could not sync. ${result.gamesError}`:`Checked ${result.imported} recent completed games.`;
       const ratings={
         updated:'Rating history updated.',
         saved:'Showing saved rating history.',
         unavailable:'Rating progress uses imported rated games when available.'
       };
       const ratingStatus=result.ratingsError
         ? `Ratings could not sync. ${result.ratingsError}`
         : result.ratingHistory==='unavailable' ? 'Lichess returned no public rating history.' : '';
       setMessage([games,ratingStatus,ratings[result.ratingHistory]].filter(Boolean).join(' '));
     });
   }finally{setSyncing(false);}
 }
 function openSettings(){setUsernameDraft(null);setTab('settings');}
 async function saveLichessUsername(event){
   event.preventDefault();
   const input=usernameDraft ?? state.username ?? '';
   await action(async()=>{
     const {username}=await api('/api/settings/lichess',{username:input});
     if(username!==state.username){
       setGameId(null);
       setPly(0);
       setLessonId(null);
       setScope({...DEFAULT_SCOPE});
     }
     setUsernameDraft(null);
     setMessage(username?`Lichess username saved as ${username}.`:'Lichess username cleared.');
   });
 }
 function openGame(g,startPly=0){setGameId(g.id);setPly(startPly);setTab('games');}
 function openLesson(l){setLessonId(l.id);setTab('practice');}
 async function copyReport(){await action(async()=>{const r=await fetch('/api/report?'+new URLSearchParams({scopeMode:scope.mode,gameId:scope.gameId,month:scope.month,year:String(scope.year),start:scope.start,end:scope.end}));if(!r.ok)throw new Error('Could not create summary.');await navigator.clipboard.writeText(await r.text());setMessage('Coaching summary copied. Paste it into your ChatGPT conversation.');});}
 if(!state)return <main className="loading">Opening your chess notebook…{error&&<p>{error}</p>}</main>;
 const running=state.job?.status==='running'||!!engineProgress;
 const reviewProgress=engineProgress||state.job;
 return <div className="layout"><aside><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('home');}}><span className="brand-icon">♞</span><span>chessbuddy<small>YOUR NEXT GOOD MOVE</small></span></a><nav>{[['home','◈','My clubhouse'],['games','▦','My games'],['practice','✧','Practice time'],['learn','♝','Chess lessons'],['guide','♧','Guide rules'],['skills','◎','Skill progress'],['ratings','↗','Rating progress'],['parent','☷','Parent notebook'],['settings','⚙','Settings']].map(([id,icon,label])=><button key={id} aria-label={label} title={label} className={tab===id?'active':''} onClick={id==='settings'?openSettings:()=>setTab(id)}><span>{icon}</span>{label}{id==='practice'&&due.length>0&&<i>{due.length}</i>}</button>)}</nav><div className="sidebar-note"><span>♙</span><b>Small steps. Strong moves.</b><p>One thoughtful move is something to be proud of.</p></div><div className="profile"><div>{state.username?.[0].toUpperCase() || '♙'}</div><span>{state.username || 'No Lichess username'}<small>Training notebook</small></span></div></aside><main><header><span>YOUR CHESS ADVENTURE <span className="header-dot">/</span> {new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span><div className="header-actions"><span className="local"><i/> Notebook saved</span><button className="button outline" disabled={busy} onClick={state.username?syncLichess:openSettings} title="Sync games and rating history across ChessBuddy">{syncing?'Syncing Lichess…':state.username?'↻ Sync Lichess':'Set Lichess username'}</button></div></header>{error&&<div role="alert" className="notice error">{error}</div>}{message&&<div role="status" className="notice">{message}</div>}{state.job?.status==='error'&&<div className="notice error">Review stopped: {state.job.error}</div>}{running&&<div className="notice job" role="status"><span>Stockfish is reviewing a completed game… {reviewProgress.done}/{reviewProgress.total} positions</span><progress value={reviewProgress.done} max={reviewProgress.total}/></div>}
 {['guide','skills'].includes(tab)&&<ScopePicker games={games} value={scope} resolved={trackingScope} onChange={setScope}/>}
 {tab==='settings'&&<>
   <div className="page-title"><div><h1>Settings</h1><p>Manage your Lichess account and USCF ratings.</p></div></div>
   <div className="home-grid settings-grid">
   <section className="card">
     <h3>Lichess account</h3>
     <p>Enter a public Lichess username. Leave it blank and save to use ChessBuddy without an account.</p>
     <form className="rating-form" onSubmit={saveLichessUsername}>
       <label>Lichess username<input type="text" value={usernameDraft ?? state.username ?? ''} onChange={event=>setUsernameDraft(event.target.value)} maxLength={30} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
       <button className="button green" disabled={busy||running}>Save Lichess username</button>
     </form>
     <p>Games, game practice, guide reflections, and Lichess ratings are saved separately for each username. USCF entries and chess lessons are shared across this notebook.</p>
     <p>Lichess history refreshed: {state.ratings.lastSync&&state.ratings.lichess.some(series=>series.points.length)?new Date(state.ratings.lastSync).toLocaleString():'Unavailable'}</p>
   </section>
   <USCFRatingsSettings ratings={state.ratings.uscf} busy={busy} action={action} api={api} setMessage={setMessage}/>
   </div>
 </>}
 {tab==='home'&&<><div className="page-title"><div><p className="eyebrow">A LITTLE PRACTICE, A LOT OF POSSIBILITY</p><h1>Hello, chess explorer <span>✦</span></h1><p>Let’s find something new in your games today.</p></div></div><section className="hero"><div className="hero-copy"><div className="pill">YOUR FIVE-MINUTE CHESS MOMENT</div><h2>Every game has<br/>a little lesson.</h2><p>Try a move, replay the example, and practice the idea on a fresh board.</p><button className="button cream" onClick={startSession}>{savedSession&&savedSession.phase!=='recap'?'Continue practice':'Start practice'} <span>↗</span></button><small>Just you, your board, and a curious mind.</small></div><div className="hero-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><span className="star s1">✧</span><span className="star s2">✦</span><div className="chess-tile tile-back">♟</div><div className="chess-tile tile-front">♘</div><span className="art-label">a good move starts with a pause.</span></div></section><section className="stats"><div><span className="stat-icon">▦</span><span><strong>{games.length}</strong><small>Games in your notebook</small></span></div><div><span className="stat-icon orange">⌕</span><span><strong>{Object.keys(analyses).length}</strong><small>Games explored together</small></span></div><div><span className="stat-icon purple">✧</span><span><strong>{due.length}</strong><small>Positions ready to practice</small></span></div></section><div className="home-grid"><section className="card recent"><div className="section-heading"><h3>Fresh from the board</h3><button className="text-button" onClick={()=>setTab('games')}>All games ↗</button></div>{games.slice(0,3).map(g=><GameRow key={g.id} game={g} reviewed={!!analyses[g.id]} onClick={()=>openGame(g)}/>)}{!games.length&&<p>{state.username?'Sync Lichess to add completed games.':'Set a Lichess username to add completed games.'}</p>}</section><section className="card checklist"><span className="eyebrow">THE THINKING PAUSE</span><h3>Before you move…</h3>{['Is my king safe?','What is my opponent threatening?','Do I have a check or a capture?'].map((s,i)=><p key={s}><span>{i+1}</span>{s}</p>)}<small>A tiny habit that grows with you.</small></section></div></>}
 {tab==='games'&&<><div className="page-title"><div><p className="eyebrow">LOOK BACK. SPOT SOMETHING NEW.</p><h1>My game notebook</h1><p>Choose a completed game and explore it at your own pace.</p></div></div><div className="review-layout"><section className="card game-list"><h3>Completed games <small>{games.length}</small></h3><GameFilters games={games} filters={gameFilters} setFilters={setGameFilters} filtered={filteredGames}/>{!filteredGames.length&&<p className="muted">No games match these filters.</p>}{filteredGames.map(g=><GameRow key={g.id} game={g} selected={g.id===game?.id} reviewed={!!analyses[g.id]} onClick={()=>openGame(g)}/>)}</section>{game?<GameReview key={game.id} game={game} analysis={analysis} ply={ply} setPly={setPly} api={api} action={action} busy={busy} running={running} setMessage={setMessage} openLesson={openLesson}/>:<section className="card">Use Sync Lichess at the top to add completed games.</section>}</div></>}
 {tab==='practice'&&<><div className="page-title"><div><p className="eyebrow">A SAFE PLACE TO TRY AGAIN</p><h1>Your next good move</h1><p>These positions come from your completed games.</p></div></div>{lesson?<PracticeTime key={lesson.id} lesson={lesson} lessons={lessons} practice={practice} api={api} refresh={refresh} onChoose={openLesson}/>:<section className="card empty"><div>✧</div><h2>A lesson is waiting in your games.</h2><p>Review a completed game first. We’ll save a few positions here for you to try again.</p><button className="button green" onClick={()=>setTab('games')}>Choose a game ↗</button></section>}</>}
 {tab==='daily'&&savedSession&&<DailyPractice key={practiceKey} session={savedSession} save={saveSession} onRestart={restartSession} onHome={()=>setTab('home')}/>}
 {tab==='learn'&&<ChessLessons learning={state.learning} api={api} action={action} busy={busy} refresh={refresh} setMessage={setMessage}/>}
 {tab==='guide'&&<GuideReview key={scopeKey} scope={trackingScope} games={trackingScope.games} guide={state.guide} openGame={openGame} busy={busy} action={action} api={api} setMessage={setMessage}/>}
 {tab==='skills'&&<SkillProgress username={state.username} key={scopeKey} scope={trackingScope} games={trackingScope.games} openGame={openGame} busy={busy} action={action} setMessage={setMessage}/>}
 {tab==='ratings'&&<Ratings games={games} key={state.username} scope={trackingScope} ratings={state.ratings} openSettings={openSettings}>
   <ScopePicker rating games={games} value={scope} resolved={trackingScope} onChange={setScope}/>
 </Ratings>}
 {tab==='parent'&&<><div className="page-title"><div><p className="eyebrow">NOTICE THE HABITS, CELEBRATE THE EFFORT</p><h1>Parent notebook</h1><p>A small window into practice, without making everything about rating.</p></div></div><section className="stats"><div><span><strong>{Object.keys(analyses).length}</strong><small>Games reviewed</small></span></div><div><span><strong>{Object.values(practice).reduce((a,p)=>a+p.attempts,0)}</strong><small>Practice attempts</small></span></div><div><span><strong>{Object.values(practice).reduce((a,p)=>a+p.solved,0)}</strong><small>Moves found without clues</small></span></div></section><div className="home-grid"><section className="card"><h3>Learning moments by focus</h3><p className="muted">Counts from all imported Lichess practice positions, plus up to five selected positions per local-only review. These are practice categories, not skill scores or a complete weakness diagnosis.</p>{themes.length?themes.map(([theme,count])=><div className="theme" key={theme}><span>{theme}</span><meter min="0" max={lessons.length} value={count}/><b>{count}</b></div>):<p>Review a few games to begin spotting patterns.</p>}<hr/><h3>A gentle session</h3><p>Replay one moment. Try a better move. Ask her what she noticed. Stop while it’s still fun.</p></section><section className="card"><span className="eyebrow">OPTIONAL CHATGPT COACHING</span><h3>Bring a lesson into your chat</h3><p>Copy a summary grounded in Stockfish’s actual positions and suggested moves, then paste it into ChatGPT for a child-friendly explanation.</p><button className="button green" onClick={copyReport} disabled={!lessons.length||busy}>Copy coaching summary ↗</button><p className="muted">Cloud AI is not connected. Copying keeps you in control of what you share. Subscription sign-in is a later integration.</p><hr/><h3>Your data stays close</h3><p>Games, engine reviews, and practice progress are stored in your notebook. Sync reads public games and rating history from Lichess; no Lichess password or token is needed.</p><small className="muted">Last sync: {state.lastSync?new Date(state.lastSync).toLocaleString():'Not yet'}</small></section></div></>}
 <footer><span>♙ Built for curiosity, one move at a time.</span><span>Completed games & practice only</span></footer></main></div>;
}
function GameRow({game:g,onClick,reviewed,selected}){return <button className={`game-row ${selected?'chosen':''}`} onClick={onClick}><span className={`game-piece ${g.color}`}>{g.color==='w'?'♘':'♞'}</span><span className="game-details"><b>vs {g.opponent}</b><small>{g.speed} · {new Date(g.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}{reviewed?' · Reviewed':''}</small></span><span className={`result ${g.result}`}>{g.result}</span><span className="row-arrow">↗</span></button>;}

createRoot(document.getElementById('root')).render(<App/>);
