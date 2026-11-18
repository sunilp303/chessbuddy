import React,{useState} from 'react';
import {Chess} from 'chess.js';
import Board from './Board.jsx';
import {reviewLine} from './game-review.js';
import {tryPracticeMove} from './daily-practice.js';

export default function DailyPractice({session,save,onRestart,onHome}){
  const [feedback,setFeedback]=useState('');
  const {exercises,index,phase,hint,attempts,step,results}=session;
  const exercise=exercises[index],frames=reviewLine(exercise.fen,exercise.line);
  const side=new Chess(exercise.fen).turn();
  const current=step>0?frames[step-1]:null;
  const update=changes=>save({...session,...changes});

  function finishExercise(outcome,played){
    const expected=frames[0];
    const alternate=played&&played.san!==expected.san?played:null;
    update({phase:'replay',step:1,alternate,results:[...results,{outcome,attempts:attempts+(played?1:0)}]});
    setFeedback('');
  }
  function play(move){
    if(phase!=='try')return;
    const result=tryPracticeMove(exercise,move);
    if(!result)return;
    if(result.correct)finishExercise(hint?'with a hint':'on your own',result);
    else{
      update({attempts:attempts+1});
      setFeedback(exercise.goal==='mate'?`${result.san} does not give mate here. Look for a check with no escape.`:
        `You tried ${result.san}. Look for the move this example is teaching, or ask for a hint.`);
    }
  }
  function next(){
    setFeedback('');
    if(index===0)update({index:1,phase:'try',step:0,hint:false,attempts:0,alternate:null});
    else update({phase:'recap'});
  }

  return <>
    <div className="page-title"><div><h1>Five-minute practice</h1><p>Two positions, then one idea to take to your next game.</p></div>
      <button className="button outline" onClick={onHome}>{phase==='recap'?'Back to clubhouse':'Save and leave'}</button>
    </div>
    <p className="daily-practice-step" role="status">{phase==='recap'?'3 of 3 · Recap':index===0?'1 of 3 · First position':'2 of 3 · Try a new position'}</p>
    {phase==='recap'?<section className="card daily-recap">
      <h2>Practice complete</h2>
      <ul>{results.map((result,i)=><li key={i}>{i===0?'First position':'New position'}: {result.outcome==='worked example'?'replayed the example':`found the move ${result.outcome}`}.</li>)}</ul>
      <h3>Try this in your next game</h3>
      <p>{exercise.takeaway}</p>
      <p>Say it in your own words. What will you look for before you move?</p>
      <button className="button green" onClick={()=>{setFeedback('');onRestart();}}>Start another session</button>
    </section>:<div className="practice-layout">
      <section className="card">
        <h3>{exercise.caption||`${side==='w'?'White':'Black'} to move`}</h3>
        <Board fen={step===-1?exercise.playedFen:step===1&&session.alternate?session.alternate.fen:current?.fen||exercise.fen}
          orientation={side} onMove={play} disabled={phase!=='try'} dragPieces
          lastMove={step===1&&session.alternate?[session.alternate.from,session.alternate.to]:current?[current.from,current.to]:null}/>
      </section>
      <section className="card practice-coach">
        {phase==='try'?<>
          <h2>{exercise.prompt}</h2>
          <p>Drag a piece, or select a piece and then its destination.</p>
          {feedback&&<p role="status" className="notice">{feedback}</p>}
          {hint&&<div className="hint"><b>Hint</b><p>{exercise.hint}</p></div>}
          <div className="practice-actions">
            {!hint&&<button className="button outline" onClick={()=>update({hint:true})}>Give me a hint</button>}
            <button className="text-button" onClick={()=>finishExercise('worked example')}>Show the worked example</button>
          </div>
        </>:<>
          <h2>{results.at(-1).outcome==='worked example'?'Walk through the example':'You found a move!'}</h2>
          {session.alternate&&<p>Your {session.alternate.san} also gives checkmate.</p>}
          <p>{exercise.explanation}</p>
          <div className="range-buttons daily-replay" role="group" aria-label="Replay moves">
            <button aria-pressed={step===0} onClick={()=>update({step:0})}>Before the move</button>
            {exercise.played&&<button aria-pressed={step===-1} onClick={()=>update({step:-1})}>Played {exercise.played}</button>}
            {frames.map((frame,i)=><button key={i} aria-pressed={step===i+1} onClick={()=>update({step:i+1,alternate:null})}>{frame.san}</button>)}
          </div>
          <button className="button green" onClick={next}>{index===0?'Try a new position':'See my recap'}</button>
        </>}
      </section>
    </div>}
  </>;
}
