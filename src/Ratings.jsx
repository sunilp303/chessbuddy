import React,{useEffect,useState} from 'react';
import {filterPoints,lichessRatingSeries,ratingSummary} from './rating-utils.js';
const palette=['#356950','#bb7845','#7a66b1','#268394','#c35668','#a08c3f','#5f739e'];
export default function Ratings({games,ratings,scope,openSettings,children}){
  const lichess=lichessRatingSeries(ratings.lichess,games);
  const initial=lichess.find(s=>s.name==='classical')||lichess[0];
  const [choices,setChoices]=useState({});
  function isSelected(id){return choices[id] ?? (id==='uscf:Regular'||id===`lichess:${initial?.name}`);}
  const range={start:scope?.start||'',end:scope?.end||''};
  const [mode,setMode]=useState('rating'),[active,setActive]=useState(null);
  useEffect(()=>setActive(null),[range.start,range.end,lichess.length]);
  const uscf=ratings.uscf.filter(e=>!e.deletedAt);
  const available=[...lichess.map(s=>({id:`lichess:${s.name}`,name:`Lichess ${s.name}${s.fromGames?' (from games)':''}`,points:s.points})),...['Regular','Quick','Blitz'].map(type=>({id:`uscf:${type}`,name:`USCF ${type}`,points:uscf.filter(e=>e.type===type)}))];
  const invalid=scope?.error||range.start&&range.end&&range.start>range.end;
  const series=available.filter(s=>isSelected(s.id)).map((s,i)=>({...s,color:palette[i%palette.length],points:invalid?[]:filterPoints(s.points,range.start,range.end)}));
  const observations=series.flatMap(s=>s.points.map(p=>({...p,series:s.name,color:s.color}))).sort((a,b)=>b.date.localeCompare(a.date));

  function toggle(id){setChoices({...choices,[id]:!isSelected(id)});setActive(null);}
  return <><div className="page-title"><div><p className="eyebrow">WATCH THE LONGER JOURNEY</p><h1>Rating progress</h1><p>Overlay your Lichess and USCF history, one date at a time.</p></div></div>
    {children}
    <section className="card rating-chart-card"><div className="section-heading"><h3>Your rating timeline</h3><label className="chart-mode">Chart <select value={mode} onChange={e=>setMode(e.target.value)}><option value="rating">Rating values</option><option value="change">Change in selected period</option></select></label></div>
    {invalid&&<p role="alert" className="notice error">Choose a start date on or before the end date.</p>}
    {lichess.some(series=>series.fromGames)&&<p className="muted">Series marked “from games” use your rating at the start of the last imported rated game per day for that time control.</p>}
    <fieldset className="series-select"><legend>Overlay rating series</legend>{available.map(s=><label key={s.id}><input type="checkbox" checked={isSelected(s.id)} onChange={()=>toggle(s.id)}/>{s.name}{!s.points.length?' (no entries)':''}</label>)}</fieldset>
    <div className="rating-chart-scroll"><RatingChart series={series} start={range.start} end={range.end} mode={mode} active={active} setActive={setActive}/></div>
    <div className="chart-legend">{series.map(s=><span key={s.id}><i style={{background:s.color}}/>{s.name} · {s.points.length} {s.points.length===1?'point':'points'}</span>)}</div>
    {active&&<p className="notice" role="status">{active.series} · {active.date} · {active.rating}{mode==='change'?` (${active.value>=0?'+':''}${active.value} since first visible entry)`:''}</p>}
    <p className="muted">Lichess and USCF are different rating systems; the overlay compares their trends, not equivalent strength. Lines connect recorded observations. No values are filled in for missing dates. Change starts at each series’ first entry inside the selected dates; at least two entries are needed to measure progress.</p>
    <div className="rating-summary-grid">{series.map(s=>{const stats=ratingSummary(s.points);return <div key={s.id} className="rating-summary" style={{borderTopColor:s.color}}><b>{s.name}</b>{stats?<><strong>{stats.last.rating}</strong><small>Latest in range · {stats.last.date}</small><p>{stats.count>1?<><b className={stats.change>=0?'positive':'negative'}>{stats.change>=0?'+':''}{stats.change}</b> since {stats.first.date}</>:'One entry · no trend yet'}</p><small>Peak in range: {stats.peak}</small></>:<p>No recorded ratings in this range.</p>}</div>;})}</div></section>
    <section className="card rating-bottom"><div className="section-heading"><h3>Visible rating history</h3><button className="text-button" onClick={openSettings}>Manage USCF ratings</button></div><p className="muted">Selected series and dates. Lichess records may include provisional ratings; its history export does not identify which points are provisional.</p><div className="rating-table-wrap"><table className="rating-table"><thead><tr><th>Date</th><th>Series / note</th><th>Rating</th></tr></thead><tbody>{observations.map((p,i)=><tr key={`${p.series}-${p.date}-${i}`}><td>{p.date}</td><td><span style={{color:p.color}}>{p.series}</span>{p.note&&<small>{p.note}</small>}{p.provisional&&<small>Provisional</small>}</td><td>{p.rating}</td></tr>)}</tbody></table>{!observations.length&&<p className="muted">No entries match these dates and selected series. Try All time, choose another series, or add a USCF entry in Settings.</p>}</div></section></>;
}
function RatingChart({series,start,end,mode,active,setActive}){
 const nonempty=series.filter(s=>s.points.length),points=nonempty.flatMap(s=>s.points.map(p=>({...p,value:mode==='change'?p.rating-s.points[0].rating:p.rating,series:s.name,color:s.color})));
 if(!points.length)return <div className="chart-empty">No ratings to plot for this selection.</div>;
 const width=900,height=340,pad={left:66,right:24,top:24,bottom:48};
 const dates=points.map(p=>Date.parse(p.date+'T12:00:00Z'));
 let minX=start?Date.parse(start+'T12:00:00Z'):Math.min(...dates),maxX=end?Date.parse(end+'T12:00:00Z'):Math.max(...dates);
 if(minX===maxX){minX-=86400000;maxX+=86400000;}
 const values=points.map(p=>p.value),margin=Math.max(30,(Math.max(...values)-Math.min(...values))*.12);
 const minY=Math.floor((Math.min(...values)-margin)/50)*50,maxY=Math.ceil((Math.max(...values)+margin)/50)*50;
 const x=date=>pad.left+(Date.parse(date+'T12:00:00Z')-minX)/(maxX-minX)*(width-pad.left-pad.right),y=value=>height-pad.bottom-(value-minY)/(maxY-minY)*(height-pad.top-pad.bottom);
 return <svg className="rating-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode==='change'?'Rating change':'Rating'} over time. ${points.length} recorded observations. Exact values are in the visible rating history table.`}>
  {[0,1,2,3,4].map(i=>{const value=minY+(maxY-minY)*i/4;return <g key={i}><line x1={pad.left} x2={width-pad.right} y1={y(value)} y2={y(value)} stroke="#e7ecdf"/><text x={pad.left-12} y={y(value)+4} textAnchor="end">{Math.round(value)}</text></g>;})}
  {[0,1,2,3,4].map(i=>{const time=minX+(maxX-minX)*i/4;return <text key={i} x={pad.left+(width-pad.left-pad.right)*i/4} y={height-15} textAnchor={i===0?'start':i===4?'end':'middle'}>{new Date(time).toISOString().slice(0,10)}</text>;})}
  {nonempty.map(s=>{const pts=points.filter(p=>p.series===s.name);return <g key={s.id}><path d={pts.map((p,i)=>`${i?'L':'M'}${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5"/>{pts.map(p=><circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={active?.series===p.series&&active?.date===p.date?6:4.5} fill={s.color} stroke="white" strokeWidth="2" tabIndex="0" role="button" aria-label={`${p.series}, ${p.date}, rating ${p.rating}`} onClick={()=>setActive(p)} onFocus={()=>setActive(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(p);}}}><title>{p.series} · {p.date} · {p.rating}</title></circle>)}</g>;})}
 </svg>;
}
