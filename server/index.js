import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeGame, mergeLichessReview } from './chess.js';
import { Engine } from './engine.js';
import { normalizeRatingHistory } from './ratings.js';
import { DEFAULT_GUIDE_SETTINGS } from '../src/guide-rules.js';
import { normalizePuzzle } from '../src/lesson-puzzles.js';
import {accountData,activateAccount} from './notebook.js';
import {registerApi} from './api.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const dataDir=process.env.CHESSBUDDY_DATA_DIR?path.resolve(process.env.CHESSBUDDY_DATA_DIR):path.join(root,'data');
const dataPath=path.join(dataDir,'state.json');
await fs.mkdir(path.dirname(dataPath),{recursive:true});
let state={games:[],analyses:{},practice:{},lastSync:null};
try{state=JSON.parse(await fs.readFile(dataPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
state.ratings ||= {lichess:[],uscf:[],lastSync:null};
state.guide ||= {settings:{...DEFAULT_GUIDE_SETTINGS},reflections:{}};
state.lichessProfiles ||= {};

if(!Object.hasOwn(state,'username')){
  // The original app used one fixed account, named by CHESSBUDDY_LEGACY_USERNAME. Keep its data available when that account is selected.
  const legacyUsername=process.env.CHESSBUDDY_LEGACY_USERNAME?.trim().toLowerCase()||null;
  if(legacyUsername&&!state.games.length){
    try{
      const raw=await fs.readFile(path.join(dataDir,'import.ndjson'),'utf8');
      state.games=raw.trim().split('\n').map(JSON.parse).map(game=>normalizeGame(game,legacyUsername)).filter(Boolean);
      state.lastSync=Date.now();
    }catch{}
  }
  if(!state.ratings.lichess.length){
    try{
      state.ratings.lichess=normalizeRatingHistory(JSON.parse(await fs.readFile(path.join(dataDir,'rating-history.json'),'utf8')));
      state.ratings.lastSync=Date.now();
    }catch{}
  }
  for(const game of state.games){
    if(game.lichess)state.analyses[game.id]=mergeLichessReview(game,state.analyses[game.id]);
  }
  if(legacyUsername&&(state.games.length || state.ratings.lichess.length))state.lichessProfiles[legacyUsername]=accountData(state);
  activateAccount(state,null);
}
state.learning ||= {puzzles:{},progress:{}};
if(!state.learning.puzzles.fork){try{state.learning.puzzles.fork=normalizePuzzle(JSON.parse(await fs.readFile(path.join(dataDir,'learning-fork.json'),'utf8')),'fork');}catch{}}
let saving=Promise.resolve();
function persist(notebook){const snapshot=JSON.stringify(notebook);saving=saving.catch(()=>{}).then(async()=>{await fs.writeFile(dataPath+'.tmp',snapshot);await fs.rename(dataPath+'.tmp',dataPath);});return saving;}
await persist(state);
const app=express();
const port=Number(process.env.PORT || 4317);
app.use((req,res,next)=>{
  if(!['127.0.0.1','localhost'].includes(req.hostname))return res.status(403).json({error:'Local access only.'});
  if(req.method!=='GET' && req.headers.origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin)) return res.status(403).json({error:'Local access only.'});
  next();
});
app.use(express.json({limit:'50kb'}));
registerApi(app,{state,persist,createEngine:()=>new Engine()});
if(process.argv.includes('--production'))app.use(express.static(path.join(root,'dist')));
else{const {createServer}=await import('vite');const vite=await createServer({root,server:{middlewareMode:true,hmr:{port:4318}},appType:'spa'});app.use(vite.middlewares);}
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Something went wrong. Please try again.'});});
const server=app.listen(port,'127.0.0.1',()=>console.log(`ChessBuddy ready at http://127.0.0.1:${server.address().port}`));
