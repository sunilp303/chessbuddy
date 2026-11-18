export function normalizeRatingHistory(raw){
  if(!Array.isArray(raw))throw new Error('Invalid rating history response.');
  return raw.filter(s=>typeof s.name==='string' && Array.isArray(s.points)).map(series=>({name:series.name,points:series.points.filter(p=>Array.isArray(p)&&p.length===4&&p.every(Number.isFinite)).map(([year,month,day,rating])=>({date:`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,rating})).sort((a,b)=>a.date.localeCompare(b.date))}));
}
export function validateUSCF(entry){
  const date=typeof entry.date==='string'?entry.date:'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Enter a valid rating date.');
  if(!['Regular','Quick','Blitz'].includes(entry.type))throw new Error('Choose a USCF rating type.');
  if(typeof entry.rating!=='number'||!Number.isInteger(entry.rating)||entry.rating<0||entry.rating>4000)throw new Error('Enter a whole-number rating from 0 to 4000.');
  if(entry.note!==undefined && (typeof entry.note!=='string'||entry.note.length>200))throw new Error('Keep the note under 200 characters.');
  return {date,type:entry.type,rating:entry.rating,note:entry.note||'',provisional:entry.provisional===true};
}
