import React from 'react';
import {DEFAULT_SCOPE,scopeDate} from './scope.js';
import {presetRange} from './rating-utils.js';
export default function ScopePicker({games,value,resolved,onChange,rating=false}){
 const latest=games[0],today=scopeDate(Date.now());
 function mode(next){onChange({...DEFAULT_SCOPE,...value,mode:next,gameId:value.gameId||latest?.id||'',month:value.month||today.slice(0,7),year:value.year||today.slice(0,4)});}
 return <section className="card scope-picker"><div className="section-heading"><h3>{rating?'Rating timeframe':'Choose what to track'}</h3>{!rating&&<span className="tag">{resolved.games.length} / {games.length} imported games</span>}</div><div className="range-buttons" role="group" aria-label={rating?'Rating timeframe':'Tracking scope'}>{[['all',rating?'All time':'All games'],['game','One game'],['month','Calendar month'],['year','Calendar year'],['custom','Custom dates']].map(([key,label])=><button key={key} aria-pressed={value.mode===key} className={value.mode===key?'selected-range':''} onClick={()=>mode(key)}>{label}</button>)}</div>
 {value.mode==='game'&&<label className="scope-field">Select game<select value={value.gameId} onChange={e=>onChange({...value,gameId:e.target.value})}>{!value.gameId&&<option value="">Choose a game</option>}{games.map(g=><option key={g.id} value={g.id}>{scopeDate(g.date)} · {new Date(g.date).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · vs {g.opponent} · {g.speed} · {g.id}</option>)}</select></label>}
 {value.mode==='month'&&<label className="scope-field">Select calendar month<input type="month" value={value.month} onChange={e=>onChange({...value,month:e.target.value})}/></label>}
 {value.mode==='year'&&<label className="scope-field">Select calendar year<input type="number" min="1900" max="9999" step="1" value={value.year} onChange={e=>onChange({...value,year:e.target.value})}/></label>}
 {value.mode==='custom'&&<div className="date-filters"><label>From<input type="date" value={value.start} onChange={e=>onChange({...value,start:e.target.value})}/></label><label>Through<input type="date" value={value.end} onChange={e=>onChange({...value,end:e.target.value})}/></label></div>}
 <div className="scope-shortcuts">{[['week','Last 7 days'],['month','Last 30 days'],['ytd','YTD'],['year','Last 12 months'],['previous','Last year']].map(([key,label])=><button className="text-button" key={key} onClick={()=>onChange({...value,mode:'custom',...presetRange(key)})}>{label}</button>)}</div>
 {resolved.error?<p className="notice error" role="alert">{resolved.error}</p>:<p className="muted"><b>{resolved.label}</b> · {resolved.start||resolved.end?`${resolved.start||'first date'} – ${resolved.end||'latest date'}`:'Entire imported history'}. Shared across Guide rules, Skill progress, and Rating progress. Other filters can narrow this selection.</p>}
 {value.mode==='game'&&<p className="muted">The rating chart uses the selected game’s date. Lichess history is daily, so it cannot isolate a rating change to this individual game.</p>}
 </section>;
}
