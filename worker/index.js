import {DurableObject} from 'cloudflare:workers';
import {registerApi} from '../server/api.js';
import {createNotebook} from '../server/notebook.js';
import {createRouter} from './router.js';

const cookieAge=60*60*24*365;
const tokenPattern=/^[a-f0-9]{64}$/;

function newToken(){
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);

    const secure=url.protocol==='https:';
    if(!secure&&!['localhost','127.0.0.1'].includes(url.hostname)){
      url.protocol='https:';
      return Response.redirect(url,308);
    }
    const headers={'Cache-Control':'private, no-store'};
    if(request.method!=='GET'){
      const origin=request.headers.get('Origin');
      if(origin&&origin!==url.origin)return Response.json({error:'Same-origin requests only.'},{status:403,headers});
      if(request.method==='POST'&&!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')){
        return Response.json({error:'Expected a JSON request.'},{status:415,headers});
      }
    }
    const cookieName=secure?'__Host-chessbuddy':'chessbuddy';
    const cookies=(request.headers.get('Cookie')||'').split(';').map(value=>value.trim());
    let token=cookies.find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const opening=request.method==='GET'&&url.pathname==='/api/state';
    if(!tokenPattern.test(token||'')){
      if(!opening)return Response.json({error:'Open ChessBuddy to start a notebook.'},{status:401,headers});
      token=newToken();
    }

    const notebook=env.NOTEBOOKS.getByName(token);
    const response=await notebook.fetch(request);
    const result=new Response(response.body,response);
    result.headers.set('Cache-Control',headers['Cache-Control']);
    if(opening&&response.ok){
      result.headers.append('Set-Cookie',`${cookieName}=${token}; Path=/; Max-Age=${cookieAge}; HttpOnly; SameSite=Strict${secure?'; Secure':''}`);
    }
    return result;
  }
};

export class ChessNotebook extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    const {sql}=ctx.storage;
    sql.exec('CREATE TABLE IF NOT EXISTS notebook (part INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    const saved=[...sql.exec('SELECT data FROM notebook ORDER BY part')].map(row=>row.data).join('');
    const state=saved?JSON.parse(saved):createNotebook();
    const persist=notebook=>{
      const json=JSON.stringify(notebook);
      ctx.storage.transactionSync(()=>{
        sql.exec('DELETE FROM notebook');
        // Split large notebooks into rows below SQLite's per-row limit.
        for(let start=0,part=0;start<json.length;part++){
          let end=Math.min(start+200000,json.length);
          if(/[\uD800-\uDBFF]/.test(json[end-1])&&end<json.length)end++;
          sql.exec('INSERT INTO notebook VALUES (?, ?)',part,json.slice(start,end));
          start=end;
        }
      });
    };
    this.router=createRouter();
    registerApi(this.router,{state,persist});
  }

  fetch(request){return this.router.fetch(request);}
}
