// Loopback-only test entrance. This server never calls Google or accepts real cards.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openLocalLab,MODE} from './runtime.mjs';

export async function startLocalLab({directory,port=8788}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('連接埠不符。');
 const lab=openLocalLab(directory),assets=new Map([
  ['/',{type:'text/html; charset=utf-8',body:readFileSync(new URL('./index.html',import.meta.url))}],
  ['/client.js',{type:'text/javascript; charset=utf-8',body:readFileSync(new URL('./client.js',import.meta.url))}]
 ]);
 let base,stopped=false;
 const server=createServer(async(request,response)=>{
  const send=(status,data,type='application/json; charset=utf-8')=>{
   response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'"});
   response.end(type.startsWith('application/json')?JSON.stringify({...data,mode:MODE}):data);
  };
  try{
   const url=new URL(request.url,base),staticPage=request.method==='GET'&&assets.has(url.pathname);
   // A navigation may originate from another app. Static assets contain no state;
   // every data/API request still requires the loopback host and same origin.
   if(request.headers.host!==new URL(base).host||!staticPage&&(request.headers.origin&&request.headers.origin!==base||request.headers['sec-fetch-site']==='cross-site')){send(403,{error:'拒絕其他來源網頁存取本機測試。'});return;}
   if(url.origin!==base){send(403,{error:'來源不符。'});return;}
   if(request.method==='GET'&&assets.has(url.pathname)){const asset=assets.get(url.pathname);send(200,asset.body,asset.type);return;}
   if(request.method==='GET'&&url.pathname==='/api/state'){send(200,lab.snapshot());return;}
   if(request.method==='GET'&&url.pathname==='/api/control-denial'){send(200,lab.simulateProviderDeny());return;}
   const original=url.pathname.match(/^\/api\/original\/(LOCAL-[A-Za-z0-9-]+)$/),result=url.pathname.match(/^\/api\/result\/(LOCAL-[A-Za-z0-9-]+)$/);
   if(request.method==='GET'&&original){const data=lab.original(original[1]);response.setHeader('X-Original-SHA256',data.sha256);send(200,data.bytes,data.mime);return;}
   if(request.method==='GET'&&result){send(200,lab.result(result[1]));return;}
   if(request.method==='POST'&&['/api/fixture','/api/recognize'].includes(url.pathname)){
    if(!request.headers['content-type']?.startsWith('application/json')){send(415,{error:'僅接受JSON測試參數。'});return;}
    const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>8192){send(413,{error:'測試參數過長；不接受照片或私人資料上傳。'});return;}chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    send(200,url.pathname==='/api/fixture'?lab.preserve(body):lab.recognize(body.sourceId));return;
   }
   send(404,{error:'沒有此本機測試入口。'});
  }catch(error){send(/不屬本案/.test(error.message)?403:400,{error:error.message});}
 });
 try{await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});base='http://127.0.0.1:'+server.address().port;}
 catch(error){lab.close();throw error;}
 return {url:base,lab,async close(){if(!stopped){stopped=true;await new Promise((accept,reject)=>{server.close(error=>error?reject(error):accept());server.closeAllConnections();});lab.close();}}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
 if(!args.includes('--data-dir'))throw new Error('用法：node experiments/drive-file/local/server.mjs --data-dir /absolute/local/work/directory [--port 8788]');
 for(let i=0;i<args.length;i+=2)if(!['--data-dir','--port'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error('本機測試參數不完整。');
 if(!isAbsolute(value('--data-dir')))throw new Error('請指定本機工作目錄的絕對路徑。');
 const running=await startLocalLab({directory:value('--data-dir'),port:args.includes('--port')?Number(value('--port')):8788});
 console.log(JSON.stringify({url:running.url,mode:MODE,stateFile:running.lab.filename,realGoogle:false}));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await running.close();process.exit(0);});
}
