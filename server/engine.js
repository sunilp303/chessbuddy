import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {UciEngine} from './uci-engine.js';

export class Engine extends UciEngine {
  constructor(){
    const program=fileURLToPath(new URL('../node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js',import.meta.url));
    const child=spawn(process.execPath,[program],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    super(command=>child.stdin.write(command+'\n'),()=>child.kill());
    createInterface({input:child.stdout}).on('line',line=>this.accept(line));
    child.on('error',error=>this.fail(error));
    child.stdin.on('error',error=>this.fail(error));
    child.stderr.on('data',()=>{});
    child.on('exit',code=>this.fail(new Error(`Stockfish stopped (${code})`)));
  }
}
