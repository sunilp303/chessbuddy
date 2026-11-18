import { normalizeGame, makeLesson, mergeLichessReview, moveFromUci, preserveLichessAnalysis } from './chess.js';
import {MAX_VARIATION_PLIES} from '../src/limits.js';
import { normalizeRatingHistory, validateUSCF } from './ratings.js';
import { buildProgress, progressReport } from '../src/progress-utils.js';
import { GUIDE_RULES, buildGuideReview, guideReport } from '../src/guide-rules.js';
import { replayVariation } from './variation.js';
import { resolveScope } from '../src/scope.js';
import { lessonById } from '../src/lesson-catalog.js';
import { normalizePuzzle, replayLesson, checkPuzzleAttempt } from '../src/lesson-puzzles.js';
import {accountData,activateAccount} from './notebook.js';
import {browserEvaluations} from './browser-evaluations.js';

const reviewLimits={depth:13,nodes:45000};
const replyLimits={depth:16,nodes:200000};

export function registerApi(app,{state,persist,createEngine}){
  const save=()=>persist(state);
  let job=null, syncing=false, lichessBusy=false, lichessRetryAt=0, replyBusy=false;
  function engineFor(req,res,fens,limits){
    if(createEngine)return createEngine();
    const results=req.body.engineResults;
    if(results===undefined){
      res.status(202).json({engineRequest:{fens,limits,username:state.username}});
      return null;
    }
    try{
      if(results?.username!==state.username)throw new Error('The active notebook changed. Please try again.');
      return browserEvaluations(fens,results.evaluations,limits.depth);
    }catch(error){
      res.status(400).json({error:error.message});
      return null;
    }
  }
  async function lichessFetch(url,accept){
    if(lichessBusy)throw new Error('Another Lichess request is running. Please wait.');
    if(Date.now()<lichessRetryAt)throw new Error('Lichess rate limit: wait a full minute before trying again.');
    lichessBusy=true;
    try{
      const r=await fetch(url,{headers:{Accept:accept},signal:AbortSignal.timeout(45000)});
      if(r.status===429){lichessRetryAt=Date.now()+60000;throw new Error('Lichess asks us to wait. Try again in one minute.');}
      if(!r.ok)throw new Error(`Lichess returned ${r.status}.`);
      return await r.text();
    }finally{lichessBusy=false;}
  }
  function importGame(game){
    const previous=state.games.find(g=>g.id===game.id);
    game.lichess=preserveLichessAnalysis(game,previous);
    if(game.lichess)state.analyses[game.id]=mergeLichessReview(game,state.analyses[game.id]);
    return game;
  }
  app.get('/api/state',(req,res)=>{
    const {lichessProfiles,...notebook}=state;
    res.json({...notebook,job});
  });
  app.post('/api/settings/lichess',async(req,res)=>{
    if(typeof req.body?.username!=='string')return res.status(400).json({error:'Enter a Lichess username or leave it blank.'});
    const username=req.body.username.trim().toLowerCase() || null;
    if(username && !/^[a-z0-9_-]{1,30}$/.test(username))return res.status(400).json({error:'Enter the username only, using letters, numbers, underscores, or hyphens.'});
    if(username===state.username)return res.json({username});
    if(lichessBusy||syncing||replyBusy||job?.status==='running')return res.status(409).json({error:'Wait for the current sync or review to finish before changing accounts.'});
    if(state.username)state.lichessProfiles={...state.lichessProfiles,[state.username]:accountData(state)};
    activateAccount(state,username);
    job=null;
    await save();
    res.json({username});
  });
  function lessonContext(id,puzzleId){
   const lesson=lessonById(id);if(!lesson)throw new Error('Lesson not found.');
   const puzzle=state.learning.puzzles[id];
   if(lesson.kind==='puzzle'&&(!puzzle||puzzleId!==puzzle.id))throw new Error('Load this lesson’s current puzzle first.');
   return {lesson,puzzle,fen:lesson.kind==='puzzle'?puzzle.fen:lesson.fen};
  }
  function learningProgress(id){return state.learning.progress[id] ||= {attempts:0,correctMoves:0,solvedPuzzles:{},assistedPuzzles:{},studyTurns:0,lastPracticed:null};}
  app.post('/api/lessons/:id/puzzle',async(req,res)=>{
   const lesson=lessonById(req.params.id);if(!lesson||lesson.kind!=='puzzle')return res.status(404).json({error:'Choose a tactical puzzle lesson.'});
   const difficulty=req.body.difficulty||'easiest';if(!['easiest','easier','normal','harder','hardest'].includes(difficulty))return res.status(400).json({error:'Choose a valid puzzle difficulty.'});
   try{
    const raw=JSON.parse(await lichessFetch(`https://lichess.org/api/puzzle/next?angle=${encodeURIComponent(lesson.theme)}&difficulty=${difficulty}`,'application/json'));
    const puzzle=normalizePuzzle(raw,lesson.theme),previous=state.learning.puzzles[lesson.id]?.id;state.learning.puzzles[lesson.id]=puzzle;await save();res.json({puzzle,repeated:previous===puzzle.id});
   }catch(e){res.status(502).json({error:e.message});}
  });
  app.post('/api/lessons/:id/attempt',async(req,res)=>{
   try{
    const {lesson,puzzle}=lessonContext(req.params.id,req.body.puzzleId);if(lesson.kind!=='puzzle')throw new Error('This lesson is an exploration, not a fixed-solution puzzle.');
    const result=checkPuzzleAttempt(puzzle,req.body.moves),p=learningProgress(lesson.id);p.attempts++;if(result.correct)p.correctMoves++;p.lastPracticed=Date.now();
    if(result.complete){if(req.body.revealed)p.assistedPuzzles[puzzle.id]=true;else p.solvedPuzzles[puzzle.id]=true;}
    await save();res.json({...result,progress:p});
   }catch(e){res.status(400).json({error:e.message});}
  });
  app.post('/api/lessons/:id/:operation',async(req,res)=>{
   const operation=req.params.operation;if(!['reply','analyze'].includes(operation))return res.status(404).json({error:'Unknown lesson action.'});
   let context,board;try{
    context=lessonContext(req.params.id,req.body.puzzleId);const moves=req.body.moves||[];
    const startPly=req.body.startPly??0;
    if(operation==='reply'&&(!Array.isArray(moves)||!Number.isInteger(startPly)||startPly<0||
      startPly>=moves.length||(moves.length-startPly)%2!==1||moves.length>MAX_VARIATION_PLIES+1)){
      throw new Error('Play your move before asking for a reply.');
    }
    board=replayLesson(context.fen,moves);
   }catch(e){return res.status(400).json({error:e.message});}
   if(board.isGameOver()){
    if(operation==='reply'){const p=learningProgress(context.lesson.id);p.studyTurns++;p.lastPracticed=Date.now();await save();}
    return res.json({fen:board.fen(),reply:null,ended:true,reason:board.isCheckmate()?'Checkmate':'Draw'});
   }
   if(replyBusy||job?.status==='running')return res.status(409).json({error:'Stockfish is busy. Please retry when the other review finishes.'});
   const engine=engineFor(req,res,[board.fen()],replyLimits);
   if(!engine)return;
   replyBusy=true;
   try{
    await engine.ready();const evaluation=await engine.evaluate(board.fen(),replyLimits);
    const initialFen=board.fen(),best=moveFromUci(board,evaluation.best),bestMove={uci:best.from+best.to+(best.promotion||''),san:best.san,from:best.from,to:best.to};
    if(operation==='analyze'){
     const continuation=replayLesson(initialFen),san=[];for(const u of evaluation.pv.slice(0,10)){try{san.push(moveFromUci(continuation,u).san);}catch{break;}}
     res.json({best:bestMove,line:san,white:evaluation.white,score:evaluation.score,depth:evaluation.depth,side:initialFen.split(' ')[1],observation:best.captured?`${best.san} captures on ${best.to}.`:best.san.includes('+')||best.san.includes('#')?`${best.san} gives check.`:`${best.san} is a quiet move. Compare piece activity, king safety, and the opponent’s threats.`});
    }else{
     const p=learningProgress(context.lesson.id);p.studyTurns++;p.lastPracticed=Date.now();await save();
     res.json({fen:board.fen(),reply:bestMove,white:evaluation.white,score:evaluation.score,depth:evaluation.depth,ended:board.isGameOver(),reason:board.isCheckmate()?'Checkmate':board.isDraw()?'Draw':null,progress:p});
    }
   }catch(e){res.status(500).json({error:e.message});}finally{engine.close();replyBusy=false;}
  });
  app.post('/api/review/:id/reply',async(req,res)=>{
   const game=state.games.find(g=>g.id===req.params.id);
   if(!game)return res.status(404).json({error:'Choose an imported completed game.'});
   let board;try{board=replayVariation(game,req.body.ply,req.body.moves);}catch(e){return res.status(400).json({error:e.message});}
   if(board.isGameOver())return res.json({fen:board.fen(),reply:null,ended:true,reason:board.isCheckmate()?'Checkmate':'Draw'});
   if(replyBusy||job?.status==='running')return res.status(409).json({error:'Stockfish is busy. Wait for the current review, then retry your move.'});
   const engine=engineFor(req,res,[board.fen()],replyLimits);
   if(!engine)return;
   replyBusy=true;
   try{
    await engine.ready();const evaluation=await engine.evaluate(board.fen(),replyLimits);
    const reply=moveFromUci(board,evaluation.best);
    res.json({fen:board.fen(),reply:{uci:reply.from+reply.to+(reply.promotion||''),san:reply.san,from:reply.from,to:reply.to},depth:evaluation.depth,score:evaluation.score,white:evaluation.white,ended:board.isGameOver(),reason:board.isCheckmate()?'Checkmate':board.isDraw()?'Draw':null});
   }catch(e){res.status(500).json({error:e.message});}finally{engine.close();replyBusy=false;}
  });
  app.post('/api/review/:id/hint',async(req,res)=>{
   const game=state.games.find(g=>g.id===req.params.id);
   if(!game)return res.status(404).json({error:'Choose an imported completed game.'});
   let board;try{board=replayVariation(game,req.body.ply,req.body.moves??[],'hint');}catch(e){return res.status(400).json({error:e.message});}
   if(board.isGameOver())return res.status(400).json({error:'This position has already ended.'});
   if(replyBusy||job?.status==='running')return res.status(409).json({error:'Stockfish is busy. Try again in a moment.'});
   const engine=engineFor(req,res,[board.fen()],replyLimits);
   if(!engine)return;
   replyBusy=true;
   try{
    await engine.ready();const evaluation=await engine.evaluate(board.fen(),replyLimits);
    const best=moveFromUci(board,evaluation.best);
    res.json({best:{uci:best.from+best.to+(best.promotion||''),san:best.san,from:best.from,to:best.to},depth:evaluation.depth,score:evaluation.score,white:evaluation.white});
   }catch(e){res.status(500).json({error:e.message});}finally{engine.close();replyBusy=false;}
  });
  app.post('/api/guide/settings',async(req,res)=>{
    const limits={openingMoves:[4,20],pawnThreshold:[2,10],castleBy:[4,20],connectBy:[6,25]};
    for(const [key,[min,max]] of Object.entries(limits))if(!Number.isInteger(req.body[key])||req.body[key]<min||req.body[key]>max)return res.status(400).json({error:`${key} must be a whole number from ${min} to ${max}.`});
    state.guide.settings=Object.fromEntries(Object.keys(limits).map(key=>[key,req.body[key]]));await save();res.json({ok:true});
  });
  app.post('/api/guide/reflection',async(req,res)=>{
    const {gameId,ply,ruleId,answer,note=''}=req.body;
    const game=state.games.find(g=>g.id===gameId);
    if(!game||!Number.isInteger(ply)||game.moves[ply]?.color!==game.color)return res.status(400).json({error:'Choose a position before one of your moves in a completed imported game.'});
    if(!GUIDE_RULES.some(r=>r.id===ruleId)||!['followed','did-not-follow','unsure'].includes(answer)||typeof note!=='string'||note.length>500)return res.status(400).json({error:'Choose a guide rule and answer; notes must be 500 characters or fewer.'});
    const key=`${gameId}:${ply}:${ruleId}`;state.guide.reflections[key]={gameId,ply,ruleId,answer,note,updatedAt:Date.now()};await save();res.json({ok:true});
  });
  app.post('/api/ratings/uscf',async(req,res)=>{
    try{
      const entry=validateUSCF(req.body);
      if(state.ratings.uscf.some(e=>!e.deletedAt && e.date===entry.date && e.type===entry.type))return res.status(409).json({error:'There is already a rating of this type on that date. Remove it first to replace it.'});
      const saved={...entry,id:crypto.randomUUID(),source:'Manual USCF entry',createdAt:Date.now()};state.ratings.uscf.push(saved);await save();res.status(201).json(saved);
    }catch(e){res.status(400).json({error:e.message});}
  });
  app.post('/api/ratings/uscf/:id/remove',async(req,res)=>{
    const entry=state.ratings.uscf.find(e=>e.id===req.params.id);if(!entry)return res.status(404).json({error:'Rating entry not found.'});
    entry.deletedAt=Date.now();await save();res.json({ok:true});
  });
  app.post('/api/ratings/uscf/:id/restore',async(req,res)=>{
    const entry=state.ratings.uscf.find(e=>e.id===req.params.id);if(!entry)return res.status(404).json({error:'Rating entry not found.'});
    if(state.ratings.uscf.some(e=>e.id!==entry.id&&!e.deletedAt&&e.date===entry.date&&e.type===entry.type))return res.status(409).json({error:'A replacement rating already exists on that date.'});
    delete entry.deletedAt;await save();res.json({ok:true});
  });
  app.post(['/api/sync','/api/ratings/sync'],async(req,res)=>{
    const {username}=state;
    if(!username)return res.status(400).json({error:'Set a Lichess username before syncing.'});
    if(syncing||lichessBusy)return res.status(409).json({error:'Another Lichess request is running. Please wait.'});
    syncing=true;
    try{
      let imported, history, gamesError, ratingsError;
      try{
        const text=await lichessFetch(`https://lichess.org/api/games/user/${username}?max=30&ongoing=false&finished=true&moves=true&pgnInJson=true&opening=true&evals=true&accuracy=true&division=true`,'application/x-ndjson');
        imported=text.trim()?text.trim().split('\n').map(JSON.parse).map(game=>normalizeGame(game,username)).filter(Boolean):[];
      }catch(e){gamesError=e.message;}
      try{
        const raw=JSON.parse(await lichessFetch(`https://lichess.org/api/user/${username}/rating-history`,'application/json'));
        history=normalizeRatingHistory(raw).filter(series=>series.points.length);
      }catch(e){ratingsError=e.message;}
      if(gamesError&&ratingsError){
        return res.status(502).json({error:gamesError===ratingsError?gamesError:`Games: ${gamesError} Ratings: ${ratingsError}`});
      }
      if(imported){
        const games=new Map(state.games.map(game=>[game.id,game]));
        for(const game of imported)games.set(game.id,importGame(game));
        state.games=[...games.values()].sort((a,b)=>b.date-a.date);
        state.lastSync=Date.now();
      }
      if(history?.length){
        state.ratings.lichess=history;
        state.ratings.lastSync=Date.now();
      }
      await save();
      res.json({imported:imported?.length??null,gamesError,ratingsError,
        ratingHistory:history?.length?'updated':state.ratings.lichess.some(series=>series.points.length)?'saved':'unavailable'});
    }catch(e){res.status(502).json({error:e.message});}finally{syncing=false;}
  });
  app.post('/api/lichess/:id/refresh',async(req,res)=>{
    const index=state.games.findIndex(g=>g.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Game not found.'});
    if(job?.status==='running' && job.gameId===req.params.id)return res.status(409).json({error:'Wait for this local review to finish first.'});
    try{
      const raw=JSON.parse(await lichessFetch(`https://lichess.org/game/export/${encodeURIComponent(req.params.id)}?evals=true&literate=true&opening=true&accuracy=true&division=true&pgnInJson=true`,'application/json'));
      const game=normalizeGame(raw,state.username);
      if(!game || game.id!==req.params.id)throw new Error('Lichess did not return the expected completed game.');
      state.games[index]=importGame(game);await save();
      res.json({available:!!game.lichess,complete:game.lichess?.complete || false,annotations:game.lichess?.entries.filter(e=>e.judgment).length || 0});
    }catch(e){res.status(502).json({error:e.message});}
  });
  app.post('/api/analyze/:id',async(req,res)=>{
    if(replyBusy||job?.status==='running')return res.status(409).json({error:'One game is already being reviewed.'});
    const game=state.games.find(g=>g.id===req.params.id);if(!game)return res.status(404).json({error:'Game not found.'});
    if(state.analyses[game.id]?.evaluations)return res.json({cached:true});
    const engine=engineFor(req,res,game.positions,reviewLimits);
    if(!engine)return;
    job={gameId:game.id,status:'running',done:0,total:game.positions.length};
    if(createEngine)res.status(202).json(job);
    try{
      await engine.ready();const evaluations=[];
      for(const fen of game.positions){evaluations.push(await engine.evaluate(fen,reviewLimits));job.done++;}
      const lessons=[];
      game.moves.forEach((move,ply)=>{if(move.color===game.color){const lesson=makeLesson(game,ply,evaluations[ply],evaluations[ply+1]);if(lesson)lessons.push(lesson);}});
      const local={evaluations,lessons:lessons.sort((a,b)=>b.loss-a.loss).slice(0,5),createdAt:Date.now(),engine:'Stockfish 17.1 lite',nodes:45000};
      state.analyses[game.id]=mergeLichessReview(game,local);
      await save();job.status='done';
      if(!createEngine)res.json(job);
    }catch(e){
      job.status='error';job.error=e.message;
      if(!createEngine)res.status(500).json({error:e.message});
    }finally{engine.close();}
  });
  app.post('/api/practice/:id',async(req,res)=>{
    const lesson=Object.values(state.analyses).flatMap(a=>a.lessons).find(l=>l.id===req.params.id);
    if(!lesson)return res.status(404).json({error:'Exercise not found.'});
    const {move,revealed}=req.body;
    if(typeof move!=='string')return res.status(400).json({error:'A move is required.'});
    const previous=state.practice[lesson.id] || {attempts:0,solved:0};
    const correct=move===lesson.best;
    const solved=correct && !revealed;
    state.practice[lesson.id]={attempts:previous.attempts+1,solved:previous.solved+(solved?1:0),lastAttempt:Date.now(),dueAt:Date.now()+(solved?Math.min(7,2**previous.solved):0)*86400000};
    await save();res.json({correct,progress:state.practice[lesson.id]});
  });
  app.get('/api/report',(req,res)=>{
    const scope=resolveScope(state.games,{mode:req.query.scopeMode||'all',gameId:req.query.gameId||'',month:req.query.month||'',year:req.query.year||'',start:req.query.start||'',end:req.query.end||''});
    if(scope.error)return res.status(400).json({error:scope.error});
    const reportGames=scope.games,ids=new Set(reportGames.map(g=>g.id)),reportFilters={scopeLabel:scope.label,start:scope.start,end:scope.end};
    const lessons=Object.entries(state.analyses).filter(([id])=>ids.has(id)).flatMap(([,a])=>a.lessons);
    const annotations=reportGames.filter(g=>g.lichess).map(g=>`Game ${g.id}: player ${g.rating??'unknown'}${g.provisional?' provisional':''}, opponent ${g.opponent} ${g.opponentRating??'unknown'}${g.opponentProvisional?' provisional':''}, ${g.speed}. Lichess summary ${JSON.stringify(g.lichess.summary)}\n${g.lichess.entries.filter(e=>e.judgment).map(e=>`${Math.floor(e.ply/2)+1}${e.color==='w'?'.':'...'} ${e.played} (${e.color==='w'?'White':'Black'}): ${e.judgment}. ${e.comment} Evaluation after move, White perspective: ${e.mate!==null?'mate '+e.mate:e.eval!==null?e.eval/100:'unavailable'}. Recommended line: ${e.variation.join(' ') || 'unavailable'}.`).join('\n')}`).join('\n\n');
    res.type('text/plain').send(`You are a patient chess teacher for a young child. Ask questions before giving answers. Use the supplied engine data for chess claims; do not invent moves or tactical motifs. Guide cues and human reflections are separate coaching context, not engine-verified conclusions. Explain uncertainty. All games are completed.\nPlayer: ${state.username || 'No Lichess account selected'}\nReviewed games: ${reportGames.filter(g=>state.analyses[g.id]).length}\nSources: imported Lichess computer analysis where available; otherwise quick local Stockfish 17.1 lite (max depth 13 / 45,000 nodes). Sources can disagree; preserve attribution. Lichess evaluations use White perspective.\n\nSKILL PROGRESS AND OPPONENT CONTEXT\n${progressReport(buildProgress(reportGames,reportFilters),state.username)}\n\nQUICK GUIDE PATTERNS AND HUMAN REFLECTIONS (NOT PROVEN VIOLATIONS)\n${guideReport(buildGuideReview(reportGames,state.guide.settings,reportFilters),state.guide.reflections)}\n\nALL IMPORTED LICHESS ANNOTATIONS (BOTH PLAYERS)\n${annotations || 'None yet.'}\n\nLEARNING LIBRARY PROGRESS (ALL-TIME; INDEPENDENT OF GAME SCOPE)\n${Object.entries(state.learning.progress).map(([id,p])=>`${lessonById(id)?.title||id}: ${Object.keys(p.solvedPuzzles||{}).length} unique puzzles solved without hints; ${Object.keys(p.assistedPuzzles||{}).length} puzzles completed with help; ${p.attempts||0} submitted puzzle moves; ${p.studyTurns||0} exploration turns with Stockfish.`).join('\n')||'No lesson practice recorded yet.'}\n\nPLAYER PRACTICE POSITIONS\n${lessons.map(l=>`Game ${l.gameId}, move ${Math.floor(l.ply/2)+1}, ${l.color==='w'?'White':'Black'}: played ${l.played}; engine prefers ${l.bestSan}. Source: ${l.source || 'local Stockfish'}. FEN ${l.fen}. Engine PV (UCI): ${l.pv.join(' ')}.${l.depth?' Depth '+l.depth+'.':''}`).join('\n')}\n\nAnalyze recurring mistakes in this player's moves, explain two priorities in simple language, create a gentle five-minute lesson from two positions, then a short parent summary. Do not attribute the opponent's errors to this player. Separate verified observations from teaching suggestions.`);
  });
}
