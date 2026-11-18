import {Chess} from 'chess.js';

export const VALUES={p:1,n:3,b:3,r:5,q:9};
export const GUIDE_RULES=[
 {id:'early-queen',section:'Opening',title:'Develop minor pieces before bringing out the queen',mode:'Pattern check',text:'Bring knights and bishops into play first; avoid an early queen adventure.',method:'Quiet queen moves during the opening window while at least two surviving original minor pieces have not moved.'},
 {id:'queen-chase',section:'Opening',title:'Challenge an early enemy queen',mode:'Engine-assisted',text:'When the opposing queen comes out early, look for a useful attack with a minor piece or pawn.',method:'Only flagged when Lichess criticizes the played move and its legal suggested minor-piece/pawn move directly attacks the early queen; the played move does not.'},
 {id:'repeat-piece',section:'Opening',title:'Develop other pieces before moving one repeatedly',mode:'Pattern check',text:'Avoid repeated quiet moves by the same piece while others wait at home.',method:'A previously moved non-pawn/non-king piece moves quietly again while at least two original minor pieces remain unmoved. Moves from attacked squares and forcing moves are excluded.'},
 {id:'pawn-overuse',section:'Opening',title:'Avoid too many early pawn moves',mode:'Pattern check',text:'Make room for development without spending the opening only on pawns.',method:'The configured pawn-move threshold is reached within the opening window, with at least two original minor pieces still unmoved. Captures, checks, and responses to check are excluded from flags.'},
 {id:'castle',section:'Opening',title:'Castle early',mode:'Pattern check',text:'Make king safety an opening priority.',method:'At the configured own-move deadline, the player has not castled despite at least one earlier legal castling opportunity. This is a review cue, not a claim that castling was best.'},
 {id:'center',section:'Opening',title:'Develop toward and control the center',mode:'Partial check',text:'Use development to influence the central squares.',method:'Detects quiet first knight developments to the a- or h-file. General central control needs human review; no blanket center-control score is inferred.'},
 {id:'connect-rooks',section:'Opening',title:'Clear the back rank and connect the rooks',mode:'Partial check',text:'Finish development so your rooks can work together.',method:'At the configured connection deadline, both original rooks survive, remain unconnected, and at least one original minor piece is still unmoved.'},
 {id:'threat',section:'Before every move',title:'Look for the opponent’s threat',mode:'Human reflection',text:'Ask what the opponent wants to do next.',method:'Thinking cannot be read from a game score. Record your own yes/no/unsure reflection at a position.'},
 {id:'candidates',section:'Before every move',title:'Find candidate moves',mode:'Human reflection',text:'Consider at least two possible moves before choosing.',method:'The number of moves considered is not observable from the played move. Use the saved reflection controls.'},
 {id:'loose',section:'Before every move',title:'Look for loose material',mode:'Engine-assisted',text:'Check for attacked or unprotected pieces on both sides.',method:'A Lichess-flagged player move is immediately followed by capture of a non-pawn piece with no geometric defender in the resulting position. Pinned pieces, tactics, and compensation still need review.'},
 {id:'trade-material',section:'Trading',title:'Prefer exchanges when ahead; be cautious when behind',mode:'Partial check',text:'Use the material balance as a starting point for deciding whether to trade.',method:'Detects equal-value non-pawn captures immediately followed by a recapture on the same square, initiated while at least two material points behind. Forced checks/captures from check are excluded; declining exchanges while ahead is not inferred.'},
 {id:'trade-quality',section:'Trading',title:'Trade your less useful pieces for their useful pieces',mode:'Human reflection',text:'Compare the jobs the pieces can do, rather than just their names.',method:'Good/bad piece quality is positional and is not reliably determined by material value. Discuss and record a reflection.'},
 {id:'trade-structure',section:'Trading',title:'Check the pawn structure after a trade',mode:'Human reflection',text:'Consider doubled, isolated, and passed pawns and whether the resulting position helps you.',method:'The app does not label a pawn change as automatically good or bad. Use the board and record your assessment.'},
 {id:'trade-save',section:'Trading',title:'Consider a trade when material cannot be saved',mode:'Human reflection',text:'If a piece cannot be saved, look for an exchange or useful return.',method:'Whether material is unavoidably lost requires calculation. A legal capture is not treated as proof that a trade was needed.'},
 {id:'trade-attack',section:'Trading',title:'Consider which attacking pieces should stay or go',mode:'Human reflection',text:'When defending, consider exchanging attackers. When attacking, preserve useful attacking pieces.',method:'King attacks and the value of each attacker need positional judgment. Engine lines can support the discussion but are not a rule-compliance verdict.'}
];
export const DEFAULT_GUIDE_SETTINGS={openingMoves:10,pawnThreshold:4,castleBy:10,connectBy:12};
const other=c=>c==='w'?'b':'w';
const allPieces=board=>board.board().flat().filter(Boolean);
function material(board,color){return allPieces(board).reduce((n,p)=>n+(p.color===color?1:-1)*(VALUES[p.type]||0),0);}
function rooksConnected(board,squares){
 if(squares.length!==2)return false;
 const [a,b]=squares.slice().sort();
 if(a[1]===b[1]){for(let file=a.charCodeAt(0)+1;file<b.charCodeAt(0);file++)if(board.get(String.fromCharCode(file)+a[1]))return false;}
 else if(a[0]===b[0]){for(let rank=Math.min(+a[1],+b[1])+1;rank<Math.max(+a[1],+b[1]);rank++)if(board.get(a[0]+rank))return false;}
 else return false;
 return true;
}
function ratingDate(game){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(game.date));const v=k=>parts.find(p=>p.type===k).value;return `${v('year')}-${v('month')}-${v('day')}`;}
export function scanGuideGame(game,settings=DEFAULT_GUIDE_SETTINGS){
 const cfg={...DEFAULT_GUIDE_SETTINGS,...settings},events=[];
 if(!game.positions?.length||!game.moves?.length)return {game,events,ownMoves:0,openingMoves:0};
 const registry=new Map(allPieces(new Chess(game.positions[0])).map(p=>[p.square,{id:p.square,type:p.type,color:p.color,moves:0}]));
 let ownTurn=0,pawnMoves=0,castled=false,castleOpportunity=false,openingCount=0;
 const add=(ruleId,ply,evidence,squares=[],extra={})=>{
   const annotation=game.lichess?.entries?.[ply];
   events.push({id:`${game.id}:${ply}:${ruleId}`,gameId:game.id,ply,ruleId,played:game.moves[ply].san,evidence,
     squares:[...new Set([game.moves[ply].from,game.moves[ply].to,...squares])],judgment:annotation?.judgment||null,
     best:annotation?.best||null,bestSan:annotation?.bestSan||null,variation:annotation?.variation||[],
     status:annotation?.judgment?'Engine-flagged move + guide cue':'Possible guide departure',...extra});
 };
 for(let ply=0;ply<game.moves.length;ply++){
   const m=game.moves[ply],board=new Chess(game.positions[ply]),piece=board.get(m.from),tracked=registry.get(m.from);
   if(!piece)continue;
   if(m.color===game.color){
     ownTurn++;const early=ownTurn<=cfg.openingMoves;if(early)openingCount++;
     const minors=[...registry].filter(([,p])=>p.color===game.color&&['n','b'].includes(p.type)&&p.moves===0);
     const minorSquares=minors.map(([s])=>s),after=new Chess(game.positions[ply+1]);
     const forcing=!!m.captured||board.isCheck()||after.isCheck();
     if(piece.type==='p')pawnMoves++;
     if(ownTurn<=cfg.castleBy && !castled && board.moves({verbose:true}).some(move=>move.isKingsideCastle()||move.isQueensideCastle()))castleOpportunity=true;
     const isCastle=m.san.startsWith('O-O');if(isCastle)castled=true;
     if(early&&!forcing){
       if(piece.type==='q'&&minors.length>=2)add('early-queen',ply,`The queen moved on your turn ${ownTurn}, with ${minors.length} surviving original knights/bishops still unmoved.`,minorSquares);
       if(!['p','k'].includes(piece.type)&&tracked?.moves>0&&minors.length>=2&&!board.isAttacked(m.from,other(game.color)))add('repeat-piece',ply,`This piece had already moved ${tracked.moves} time(s); ${minors.length} original minor pieces were still unmoved.`,minorSquares);
       if(piece.type==='p'&&pawnMoves>=cfg.pawnThreshold&&minors.length>=2)add('pawn-overuse',ply,`This was pawn move ${pawnMoves} within your first ${cfg.openingMoves} turns, with ${minors.length} minor pieces still unmoved.`,minorSquares);
       if(piece.type==='n'&&tracked?.moves===0&&['a','h'].includes(m.to[0]))add('center',ply,`A knight developed to the rim (${m.to}) rather than toward the central files. This can still be justified.`,['d4','e4','d5','e5']);
     }
     if(ownTurn===cfg.castleBy&&!castled&&castleOpportunity)add('castle',ply,`You had not castled by your turn ${cfg.castleBy}, although castling was legal at least once earlier or on this turn.`,allPieces(after).filter(p=>p.type==='k'&&p.color===game.color).map(p=>p.square));
     if(ownTurn===cfg.connectBy){
       const rooks=[...registry].filter(([,p])=>p.color===game.color&&p.type==='r'&&['a1','h1','a8','h8'].includes(p.id)).map(([s])=>s);
       const afterMinors=minors.filter(([s])=>s!==m.from).map(([s])=>s);
       const rookSquares=rooks.map(s=>{
         if(s===m.from)return m.to;
         if(isCastle){const rank=game.color==='w'?'1':'8',long=m.san.startsWith('O-O-O');if(s===(long?'a':'h')+rank)return (long?'d':'f')+rank;}
         return s;
       });
       if(rookSquares.length===2&&afterMinors.length&&!rooksConnected(after,rookSquares))add('connect-rooks',ply,`At your turn ${cfg.connectBy}, the original rooks were not connected and ${afterMinors.length} original minor piece(s) had not moved.`,[...rookSquares,...afterMinors]);
     }
     const entry=game.lichess?.entries?.[ply],next=game.moves[ply+1];
     if(entry?.judgment&&next?.captured&&VALUES[next.captured]>=3&&next.color!==game.color&&!after.isAttacked(next.to,game.color))add('loose',ply,`After ${m.san}, the opponent played ${next.san}, taking a ${next.captured==='q'?'queen':next.captured==='r'?'rook':next.captured==='b'?'bishop':'knight'} on ${next.to}. No piece geometrically defended that square. Lichess also marked ${m.san} as ${entry.judgment.toLowerCase()}.`,[next.from,next.to],{reply:next.san});
     if(early&&entry?.judgment&&entry.best){
       const queen=allPieces(board).find(p=>p.type==='q'&&p.color!==game.color),homeQueen=game.color==='w'?'d8':'d1';
       if(queen&&queen.square!==homeQueen&&after.get(queen.square)?.type==='q'&&after.get(queen.square)?.color!==game.color&&!after.isAttacked(queen.square,game.color)){
         try{const candidate=new Chess(game.positions[ply]),better=candidate.move({from:entry.best.slice(0,2),to:entry.best.slice(2,4),promotion:entry.best[4]||'q'});
           if(['n','b','p'].includes(better.piece)&&candidate.attackers(queen.square,game.color).includes(better.to))add('queen-chase',ply,`The opposing queen was out on ${queen.square}. Lichess preferred ${better.san}, a ${better.piece==='p'?'pawn':'minor-piece'} move attacking that queen, over ${m.san}.`,[queen.square,better.from,better.to]);
         }catch{ /* Never turn an illegal recommendation into a cue. */ }
       }
     }
     if(piece.type!=='p'&&m.captured&&m.captured!=='p'&&next?.captured===piece.type&&next.to===m.to&&VALUES[piece.type]===VALUES[m.captured]&&!board.isCheck()&&!after.isCheck()){
       const balance=material(board,game.color);
       if(balance<=-2)add('trade-material',ply,`Before this exchange you were ${Math.abs(balance)} points behind by the guide’s piece values. ${m.san} was followed by ${next.san}, exchanging equal-value pieces. Trades can still be correct for tactical or positional reasons.`,[next.from,next.to],{reply:next.san,materialBalance:balance});
     }
   }
   // Keep identities, not just squares, so a returned/replaced piece is not “undeveloped”.
   registry.delete(m.to);registry.delete(m.from);
   if(tracked)registry.set(m.to,{...tracked,moves:tracked.moves+1});
   if(m.san.startsWith('O-O')){
     const rank=m.color==='w'?'1':'8',long=m.san.startsWith('O-O-O'),rookFrom=(long?'a':'h')+rank,rookTo=(long?'d':'f')+rank,r=registry.get(rookFrom);
     if(r){registry.delete(rookFrom);registry.set(rookTo,{...r,moves:r.moves+1});}
   }
 }
 return {game,events,ownMoves:ownTurn,openingMoves:openingCount};
}
export function buildGuideReview(games,settings=DEFAULT_GUIDE_SETTINGS,filters={}){
 const selected=games.filter(g=>(!filters.start||ratingDate(g)>=filters.start)&&(!filters.end||ratingDate(g)<=filters.end)&&(!filters.speed||filters.speed==='all'||g.speed===filters.speed));
 const scans=selected.map(g=>scanGuideGame(g,settings)),events=scans.flatMap(s=>s.events.map(e=>({...e,game:s.game})));
 const rules=GUIDE_RULES.map(r=>({...r,count:events.filter(e=>e.ruleId===r.id).length,games:new Set(events.filter(e=>e.ruleId===r.id).map(e=>e.gameId)).size}));
 const weeks=new Map();for(const scan of scans){const date=new Date(ratingDate(scan.game)+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const key=date.toISOString().slice(0,10);if(!weeks.has(key))weeks.set(key,{week:key,games:0,events:0,moves:0});const w=weeks.get(key);w.games++;w.events+=scan.events.length;w.moves+=scan.ownMoves;}
 return {scans,events,rules,settings:{...DEFAULT_GUIDE_SETTINGS,...settings},filters,weeks:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week)),ownMoves:scans.reduce((n,s)=>n+s.ownMoves,0)};
}
export function guideReport(model,reflections={}){
 const lines=['ROSHEN NAIR FOUNDATION QUICK GUIDE — COACHING REVIEW',`Scope: ${model.filters.scopeLabel||'All imported games'}. Filters: ${model.filters.start||'first date'} through ${model.filters.end||'latest date'}; ${model.filters.speed||'all'} time controls.`,
   `App teaching settings: opening window ${model.settings.openingMoves} own moves; pawn-move threshold ${model.settings.pawnThreshold}; castle review at own move ${model.settings.castleBy}; rook connection review at own move ${model.settings.connectBy}. These deadlines are not specified by the poster.`,
   `Scanned ${model.scans.length} completed games / ${model.ownMoves} player moves. Found ${model.events.length} possible guide departures or discussion cues. These are not chess-rule violations or a compliance score. A Lichess judgment on the same move does not prove that the guide pattern caused the mistake.`,...model.rules.filter(r=>r.count).map(r=>`${r.title}: ${r.count} cues in ${r.games} games.`)];
 lines.push('Recent examples:',...model.events.slice().sort((a,b)=>b.game.date-a.game.date||a.ply-b.ply).slice(0,12).map(e=>`${e.gameId}, move ${Math.floor(e.ply/2)+1}, ${e.played}: ${GUIDE_RULES.find(r=>r.id===e.ruleId).title}. ${e.evidence}${e.bestSan?' Lichess alternative: '+e.bestSan+'.':''}`));
 const validGames=new Set(model.scans.map(s=>s.game.id));const saved=Object.values(reflections).filter(r=>validGames.has(r.gameId));
 lines.push(`Saved human reflections: ${saved.length}. A “did not follow” reflection is self-reported, not inferred from play.`);
 for(const r of saved)lines.push(`${r.gameId}, before move ply ${r.ply+1}: ${GUIDE_RULES.find(x=>x.id===r.ruleId)?.title||r.ruleId}: ${r.answer}.${r.note?' Note: '+r.note:''}`);
 lines.push('Source: Roshen Nair Foundation Chess Quick Guide supplied by the user. Original guide is available in the app. Detection thresholds are app-specific teaching choices; tactical exceptions must be reviewed. Absence of a flag does not establish that a rule was followed.');
 return lines.join('\n');
}
