import {UciEngine} from '../server/uci-engine.js';

export async function evaluateInBrowser({fens,limits},onProgress){
  const worker=new Worker('/stockfish/stockfish-17.1-lite-single-03e3232.js');
  const engine=new UciEngine(command=>worker.postMessage(command),()=>worker.terminate());
  worker.onmessage=event=>{
    if(typeof event.data==='string')for(const line of event.data.split('\n'))engine.accept(line);
  };
  worker.onerror=()=>engine.fail(new Error('Stockfish could not start in this browser.'));
  const evaluations=[];
  try{
    await engine.ready();
    for(const fen of fens){
      const evaluation=await engine.evaluate(fen,limits);
      evaluations.push({fen,...evaluation,pv:evaluation.pv.slice(0,20)});
      onProgress?.(evaluations.length,fens.length);
    }
    return evaluations;
  }finally{engine.close();}
}
