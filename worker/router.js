const maxBodyBytes=1024*1024;
const oversized=Symbol('oversized body');

async function jsonBody(request){
  if(!request.body)return {};
  const reader=request.body.getReader();
  const decoder=new TextDecoder();
  let text='',bytes=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    if(bytes>maxBodyBytes){
      await reader.cancel();
      return oversized;
    }
    text+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(text+decoder.decode());
}

// The shared routes use this subset of Express's request and response API.
export function createRouter(){
  const routes=[];
  function add(method,paths,handler){
    for(const path of [paths].flat()){
      const parts=path.split('/');
      const params=parts.filter(part=>part.startsWith(':')).map(part=>part.slice(1));
      const pattern=new RegExp('^'+parts.map(part=>part.startsWith(':')?'([^/]+)':part).join('/')+'/?$');
      routes.push({method,pattern,params,handler});
    }
  }
  return {
    get:(paths,handler)=>add('GET',paths,handler),
    post:(paths,handler)=>add('POST',paths,handler),
    async fetch(request){
      const url=new URL(request.url);
      for(const route of routes){
        if(route.method!==request.method)continue;
        const match=url.pathname.match(route.pattern);
        if(!match)continue;

        let body,params;
        try{
          params=Object.fromEntries(route.params.map((name,index)=>[name,decodeURIComponent(match[index+1])]));
          body=request.method==='POST'?await jsonBody(request):{};
          if(body===oversized)return Response.json({error:'Request is too large.'},{status:413});
          if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Expected an object.');
        }catch{
          return Response.json({error:'Invalid request.'},{status:400});
        }
        let status=200,type='text/plain',response;
        const res={
          status(code){status=code;return this;},
          type(value){type=value;return this;},
          json(data){response=Response.json(data,{status});return response;},
          send(data){response=new Response(data,{status,headers:{'Content-Type':type+'; charset=utf-8'}});return response;}
        };
        try{
          await route.handler({body,params,query:Object.fromEntries(url.searchParams)},res);
          if(response)return response;
        }catch(error){
          console.error(error);
        }
        return Response.json({error:'Something went wrong.'},{status:500});
      }
      return Response.json({error:'Unknown ChessBuddy endpoint.'},{status:404});
    }
  };
}
