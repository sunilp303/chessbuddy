import {scopeDate} from './scope.js';

export function lichessRatingSeries(history,games){
  const series=history.filter(item=>item.points.length);
  const official=new Set(series.map(item=>item.name));
  const bySpeed=new Map();
  for(const game of games){
    if(!game.rated||!Number.isFinite(game.rating)||!Number.isFinite(game.date)||!game.speed||official.has(game.speed))continue;
    if(!bySpeed.has(game.speed))bySpeed.set(game.speed,new Map());
    const byDay=bySpeed.get(game.speed),date=scopeDate(game.date);
    if(!byDay.has(date)||byDay.get(date).timestamp<game.date){
      byDay.set(date,{date,rating:game.rating,provisional:game.provisional,timestamp:game.date});
    }
  }
  for(const [name,byDay] of bySpeed){
    series.push({name,fromGames:true,points:[...byDay.values()]});
  }
  return series;
}

export function dateKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function presetRange(preset,today=new Date()){
  const end=dateKey(today),start=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
  if(preset==='week')start.setDate(start.getDate()-6);
  else if(preset==='month')start.setDate(start.getDate()-29);
  else if(preset==='ytd')return {start:`${today.getFullYear()}-01-01`,end};
  else if(preset==='year')start.setFullYear(start.getFullYear()-1);
  else if(preset==='previous')return {start:`${today.getFullYear()-1}-01-01`,end:`${today.getFullYear()-1}-12-31`};
  else if(preset==='all')return {start:'',end};
  return {start:dateKey(start),end};
}
export function filterPoints(points,start,end){return points.filter(p=>(!start||p.date>=start)&&(!end||p.date<=end)).sort((a,b)=>a.date.localeCompare(b.date));}
export function ratingSummary(points){
  if(!points.length)return null;
  return {first:points[0],last:points.at(-1),change:points.at(-1).rating-points[0].rating,peak:Math.max(...points.map(p=>p.rating)),count:points.length};
}
