// Read-only local harness: serve the actual website; substitute only demo data.
// No Google bridge, model API, writes, credentials or outside network requests.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../../',import.meta.url);
const fixture=JSON.parse(readFileSync(new URL('tests/fixtures/people-search-context.json',root),'utf8'));
const model=readFileSync(new URL('model.js',root),'utf8'),tail=model.indexOf('const normalize=');
if(tail<0)throw new Error('示範資料界線已變動，停止而不改寫程式。');
const virtualModel='export const demoCards='+JSON.stringify(fixture.cards)+';\n'+model.slice(tail);
let html=readFileSync(new URL('index.html',root),'utf8');
html=html.replace('<main>','<main><section class="notice">本機自然語句驗收 · '+fixture.cards.length+'位虛構人物 · 沒有 Google 或付費 AI。<a href="/fixture.json" target="_blank" rel="noopener">查看固定原始資料</a></section>');
const assets=new Map([['/',{type:'text/html; charset=utf-8',body:html}],['/fixture.json',{type:'application/json; charset=utf-8',body:JSON.stringify(fixture)}],['/model.js',{type:'text/javascript; charset=utf-8',body:virtualModel}]]);
for(const name of ['style.css','app.js','search.js','transport.js'])assets.set('/'+name,{type:name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',body:readFileSync(new URL(name,root))});
export async function startPeopleSearch(port=8789){
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('測試連接埠不符。');
 let base;
 const server=createServer((request,response)=>{
  const url=new URL(request.url,base),asset=assets.get(url.pathname);
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-ancestors 'none'");
  if(request.headers.host!==new URL(base).host||url.origin!==base){response.writeHead(403);response.end('來源不符');return;}
  if(request.method!=='GET'||!asset){response.writeHead(404);response.end('僅提供固定的本機虛構測試資產');return;}
  response.writeHead(200,{'Content-Type':asset.type});response.end(asset.body);
 });
 await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});base='http://127.0.0.1:'+server.address().port;
 let closed=false;return {url:base,async close(){if(!closed){closed=true;await new Promise((accept,reject)=>{server.close(error=>error?reject(error):accept());server.closeAllConnections();});}}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--port'))throw new Error('用法：node experiments/people-search/server.mjs [--port 8789]');
 const running=await startPeopleSearch(args.length?Number(args[1]):8789);console.log(JSON.stringify({url:running.url,mode:'LOCAL_SYNTHETIC_PEOPLE_SEARCH',google:false,writes:false}));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await running.close();process.exit(0);});
}
