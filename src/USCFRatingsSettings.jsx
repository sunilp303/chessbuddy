import React,{useState} from 'react';
import {dateKey} from './rating-utils.js';

const types=['Regular','Quick','Blitz'];

export default function USCFRatingsSettings({ratings,busy,action,api,setMessage}){
  const [entry,setEntry]=useState({date:dateKey(),type:'Regular',rating:'',note:'',provisional:false});
  const saved=ratings.filter(rating=>!rating.deletedAt).sort((a,b)=>b.date.localeCompare(a.date));
  const removed=ratings.filter(rating=>rating.deletedAt);
  const update=(key,value)=>setEntry(previous=>({...previous,[key]:value}));

  function add(event){
    event.preventDefault();
    return action(async()=>{
      await api('/api/ratings/uscf',{...entry,rating:Number(entry.rating)});
      setEntry(previous=>({...previous,rating:'',note:''}));
      setMessage('USCF rating saved. It’s available in Rating progress.');
    });
  }

  return <section className="card">
    <span className="eyebrow">YOUR OVER-THE-BOARD RECORD</span>
    <h3>Add a USCF rating</h3>
    <p>Enter a published rating from a US Chess history or tournament report.</p>
    <form onSubmit={add} className="rating-form">
      <label>Rating date<input type="date" required value={entry.date} onChange={event=>update('date',event.target.value)}/></label>
      <label>Rating type<select value={entry.type} onChange={event=>update('type',event.target.value)}>
        {types.map(type=><option key={type}>{type}</option>)}
      </select></label>
      <label>Published rating<input type="number" min="0" max="4000" step="1" required placeholder="e.g. 850" value={entry.rating} onChange={event=>update('rating',event.target.value)}/></label>
      <label>Event or note (optional)<input maxLength="200" value={entry.note} onChange={event=>update('note',event.target.value)}/></label>
      <label className="checkbox-label"><input type="checkbox" checked={entry.provisional} onChange={event=>update('provisional',event.target.checked)}/>Provisional rating</label>
      <button className="button green" disabled={busy}>Save USCF rating</button>
    </form>
    {saved.length>0&&<><hr/><h3>Saved USCF ratings</h3>
      {saved.map(rating=><div className="removed-rating" key={rating.id}>
        <span>{rating.date} · {rating.type} · {rating.rating}{rating.provisional?' · Provisional':''}{rating.note?' · '+rating.note:''}</span>
        <button className="text-button" disabled={busy} aria-label={`Remove ${rating.type} rating from ${rating.date}`} onClick={()=>action(()=>api(`/api/ratings/uscf/${rating.id}/remove`,{}))}>Remove</button>
      </div>)}
    </>}
    {removed.length>0&&<details><summary>Removed USCF entries ({removed.length})</summary>
      {removed.map(rating=><div className="removed-rating" key={rating.id}>
        <span>{rating.date} · {rating.type} · {rating.rating}</span>
        <button className="text-button" disabled={busy} aria-label={`Restore ${rating.type} rating from ${rating.date}`} onClick={()=>action(()=>api(`/api/ratings/uscf/${rating.id}/restore`,{}))}>Restore</button>
      </div>)}
    </details>}
  </section>;
}
