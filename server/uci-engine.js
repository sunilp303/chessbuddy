import {Chess} from 'chess.js';
import {whiteScore} from './chess.js';

// UCI works over both a local subprocess and a browser Web Worker.
export class UciEngine {
  constructor(send,shutdown){
    this.send=send;
    this.shutdown=shutdown;
    this.waiters=new Set();
  }

  accept(line){for(const read of this.waiters)read(line);}
  fail(error){
    this.error=error;
    for(const read of this.waiters)read(null,error);
  }
  command(command){
    if(this.error)throw this.error;
    this.send(command);
  }
  close(){this.shutdown();}

  async ready(){
    await this.readUntil('uciok',()=>this.command('uci'));
    this.command('setoption name Hash value 32');
    await this.readUntil('readyok',()=>this.command('isready'));
  }

  readUntil(end,send,onLine=()=>{}){
    return new Promise((resolve,reject)=>{
      const finish=error=>{
        clearTimeout(timer);
        this.waiters.delete(read);
        if(error)reject(error);else resolve();
      };
      const read=(line,error)=>{
        if(error)return finish(error);
        onLine(line);
        if(line.startsWith(end))finish();
      };
      const timer=setTimeout(()=>{
        finish(new Error('Stockfish timed out. Try again.'));
        this.close();
      },20000);
      this.waiters.add(read);
      try{send();}catch(error){finish(error);}
    });
  }

  async evaluate(fen,{depth=13,nodes=45000}={}){
    let info,best=null;
    await this.readUntil('bestmove',()=>{
      this.command(`position fen ${fen}`);
      this.command(`go depth ${depth} nodes ${nodes}`);
    },line=>{
      const match=line.match(/depth (\d+).*score (cp|mate) (-?\d+).* pv (.+)/);
      if(match&&!/lowerbound|upperbound/.test(line)){
        info={depth:Number(match[1]),score:{type:match[2],value:Number(match[3])},pv:match[4].trim().split(' ')};
      }
      if(line.startsWith('bestmove'))best=line.split(' ')[1];
    });
    if(!info){
      info=terminalEvaluation(fen);
      if(!info)throw new Error('Stockfish did not return a position evaluation.');
    }
    return {...info,best,white:whiteScore(info.score,fen.split(' ')[1])};
  }
}

export function terminalEvaluation(fen){
  const board=new Chess(fen);
  if(!board.isGameOver())return null;
  return {depth:0,score:board.isCheckmate()?{type:'mate',value:-1}:{type:'cp',value:0},pv:[]};
}
