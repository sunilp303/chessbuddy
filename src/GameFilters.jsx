import React,{useMemo} from 'react';
import {DEFAULT_GAME_FILTERS,activeFilterCount,endingLabel,gameFilterOptions,resultSummary} from './game-filters.js';

const capital=text=>text.charAt(0).toUpperCase()+text.slice(1);

export default function GameFilters({games,filters,setFilters,filtered}){
  const options=useMemo(()=>gameFilterOptions(games),[games]);
  const active=activeFilterCount(filters),shown=filtered.length,stats=resultSummary(filtered);
  const set=(key,value)=>setFilters({...filters,[key]:value});
  const select=(key,label,choices)=><label>{label}<select value={filters[key]} onChange={e=>set(key,e.target.value)}>
    {choices.map(([value,text])=><option key={value} value={value}>{text}</option>)}
  </select></label>;
  return <>
  <div className="game-record" aria-label="Results for the games shown">
    <div className="record-win"><strong>{stats.winPct}%</strong><span>{stats.wins} {stats.wins===1?'win':'wins'}</span></div>
    <div className="record-loss"><strong>{stats.lossPct}%</strong><span>{stats.losses} {stats.losses===1?'loss':'losses'}</span></div>
    <div className="record-draw"><strong>{stats.drawPct}%</strong><span>{stats.draws} {stats.draws===1?'draw':'draws'}</span></div>
    {stats.total>0&&<div className="record-bar" aria-hidden="true"><i className="record-win" style={{width:`${stats.wins/stats.total*100}%`}}/><i className="record-draw" style={{width:`${stats.draws/stats.total*100}%`}}/><i className="record-loss" style={{width:`${stats.losses/stats.total*100}%`}}/></div>}
    <small className="muted">{active?`${shown} of ${games.length} games match your filters`:`All ${games.length} games`}</small>
  </div>
  <details className="game-filters" open={active>0||undefined}>
    <summary>Filter games{active?` · ${active} active`:''}</summary>
    <div className="game-filter-presets" role="group" aria-label="Quick filters">
      <button type="button" onClick={()=>setFilters({...DEFAULT_GAME_FILTERS,rated:'rated',opponent:'registered'})}>Rated vs real players</button>
      {options.timeControls.filter(tc=>tc!=='Unlimited').map(tc=><button type="button" key={tc} aria-pressed={filters.timeControl===tc} onClick={()=>set('timeControl',filters.timeControl===tc?'all':tc)}>{tc}</button>)}
      <button type="button" aria-pressed={filters.reviewed==='not-reviewed'} onClick={()=>set('reviewed',filters.reviewed==='not-reviewed'?'all':'not-reviewed')}>Not reviewed yet</button>
    </div>
    <div className="game-filter-grid">
      {select('rated','Rated',[['all','Rated and casual'],['rated','Rated only'],['casual','Casual only']])}
      {select('opponent','Opponent',[['all','Everyone'],['registered','Registered players only'],['anonymous','Anonymous only']])}
      {select('timeControl','Time control',[['all','Any time control'],...options.timeControls.map(tc=>[tc,tc==='Unlimited'?'Unlimited / correspondence':`${tc} (minutes + seconds)`])])}
      {select('speed','Speed',[['all','Any speed'],...options.speeds.map(s=>[s,capital(s)])])}
      {select('result','Result',[['all','Any result'],['win','Wins'],['loss','Losses'],['draw','Draws']])}
      {select('color','My color',[['all','White or Black'],['w','White'],['b','Black']])}
      {select('ending','How it ended',[['all','Any ending'],...options.endings.map(s=>[s,endingLabel(s)])])}
      {select('reviewed','Analysis',[['all','Reviewed or not'],['reviewed','Reviewed'],['not-reviewed','Not reviewed yet']])}
      <label>From<input type="date" value={filters.from} onChange={e=>set('from',e.target.value)}/></label>
      <label>To<input type="date" value={filters.to} onChange={e=>set('to',e.target.value)}/></label>
      <label>Opponent rating from<input type="number" inputMode="numeric" min="0" step="50" placeholder="Any" value={filters.minRating} onChange={e=>set('minRating',e.target.value)}/></label>
      <label>Opponent rating to<input type="number" inputMode="numeric" min="0" step="50" placeholder="Any" value={filters.maxRating} onChange={e=>set('maxRating',e.target.value)}/></label>
      <label className="game-filter-search">Opponent or opening<input type="search" placeholder="e.g. Italian, Diyach3ss" value={filters.search} onChange={e=>set('search',e.target.value)}/></label>
    </div>
    <div className="game-filter-footer">
      <span className="muted">Showing {shown} of {games.length} games{(filters.minRating||filters.maxRating)?'. Games without an opponent rating are hidden while a rating range is set.':''}</span>
      {active>0&&<button type="button" className="text-button" onClick={()=>setFilters({...DEFAULT_GAME_FILTERS})}>Clear filters</button>}
    </div>
    <small className="muted">Filters are saved in this browser and stay after a refresh.</small>
  </details>
  </>;
}
