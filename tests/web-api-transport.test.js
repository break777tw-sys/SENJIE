// Protocol tests against a local HTTP fixture, not Google/AI/live-site proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createWebApiTransport} from '../web-api-transport.js';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const fakeToken='FICTIONAL_LOCAL_TOKEN_NOT_A_CREDENTIAL';
async function fixture(t,handler){
 const calls=[];const server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const call={url:req.url,authorization:req.headers.authorization,body:JSON.parse(raw)};calls.push(call);
  const result=await handler(call);res.writeHead(result.status||200,{'Content-Type':'application/json'});res.end(JSON.stringify(result.body));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 let logoutCount=0;const api=createWebApiTransport({endpoint:'http://127.0.0.1:'+server.address().port+'/fixture-rpc',allowLocalhost:true,identity:{login:async()=>({accessToken:fakeToken}),logout:()=>{logoutCount++;}}});
 return {api,calls,logoutCount:()=>logoutCount};
}
const session={ok:true,result:{authenticated:true,email:'fictional@example.invalid',capabilities:{photoImport:true}}};
test('未登入不傳資料；登入先由服務確認身分，之後讀寫沿用原請求編號且不導覽離站',async t=>{
 const {api,calls}=await fixture(t,c=>({body:c.body.method==='session'?session:{ok:true,result:{record:{id:'DEMO_1',version:2}}}}));
 await assert.rejects(api.list(),/登入/);assert.equal(calls.length,0);await api.login();assert.equal(calls[0].body.method,'session');
 const payload={id:'DEMO_1',expectedVersion:1,requestId:'DEMO_REQUEST_001',card:{name:'Fictional'}};await api.save(payload);await api.save(payload);
 assert.equal(calls[1].authorization,'Bearer '+fakeToken);assert.deepEqual(calls[1].body.payload,calls[2].body.payload);assert.deepEqual(calls[1].body.payload,payload);assert.equal(calls[1].url,'/fixture-rpc');
});
test('403立即清除連線與其他在途回應；資格還原後可明確登入',async t=>{
 let finish;const {api,calls}=await fixture(t,async c=>{
  if(c.body.method==='session')return {body:session};
  if(c.body.method==='listCards'){await new Promise(resolve=>{finish=resolve;});return {body:{ok:true,result:{private:'OLD'}}};}
  return {status:403,body:{ok:false}};
 });let connected=false,denied=0;api.onConnectionChange(s=>{connected=s.connected;});api.onAccessDenied(()=>denied++);await api.login();
 const pending=api.list(),stale=assert.rejects(pending,/存取狀態/);while(!finish)await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(api.imports(),/拒絕存取/);assert.equal(connected,false);assert.equal(api.session,null);assert.equal(denied,1);finish();await stale;await api.login();assert.equal(connected,true);assert.equal(calls.at(-1).body.method,'session');
});
test('一般版本衝突保留登入與可重試草稿，不誤判為撤銷',async t=>{
 const {api}=await fixture(t,c=>({body:c.body.method==='session'?session:{ok:false,error:{message:'資料已在其他入口更新。'}}}));
 await api.login();await assert.rejects(api.save({requestId:'DEMO_REQUEST_002'}),/其他入口/);assert.ok(api.session);
});
test('明確登出清除記憶體憑證；不把憑證放網址、cookie或持久儲存',async()=>{
 const sent=[];let logouts=0;const api=createWebApiTransport({endpoint:'https://api.example.invalid/fixture-rpc',identity:{login:async()=>({accessToken:fakeToken}),logout:()=>logouts++},fetch:async(url,options)=>{sent.push({url,options});return {status:200,ok:true,json:async()=>session};}});
 await api.login();api.logout();await assert.rejects(api.list(),/登入/);assert.equal(logouts,1);assert.equal(sent.length,1);assert.equal(sent[0].url,'https://api.example.invalid/fixture-rpc');assert.equal(sent[0].options.credentials,'omit');assert.equal(sent[0].options.redirect,'error');assert.equal(api.session,null);
});
test('服務未確認身分、回應非JSON、非HTTPS或含查詢憑證時拒絕',async()=>{
 const identity={login:async()=>({accessToken:fakeToken}),logout(){}};
 for(const endpoint of ['http://api.example.invalid/rpc','https://api.example.invalid/rpc?token=bad','https://user:pass@api.example.invalid/rpc'])assert.throws(()=>createWebApiTransport({endpoint,identity}),/HTTPS/);
 const denied=createWebApiTransport({endpoint:'https://api.example.invalid/rpc',identity,fetch:async()=>({ok:true,status:200,json:async()=>({ok:true,result:{authenticated:false}})})});await assert.rejects(denied.login(),/確認登入/);assert.equal(denied.session,null);
 const html=createWebApiTransport({endpoint:'https://api.example.invalid/rpc',identity,fetch:async()=>({ok:true,status:200,json:async()=>{throw Error('HTML');}})});await assert.rejects(html.login(),/格式/);
});
test('同一前端登入、讀取、修改、重開與拒絕清空都可經 API 執行，不需要 Google 工作頁',async t=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}});
 const record=env.c.saveCard({requestId:'github-ui-fixture-00001',card:{name:'Fictional GitHub Person',company:'Example Invalid',status:'已確認'}}).record;
 let deny=false;const {api}=await fixture(t,c=>{
  if(deny)return {status:403,body:{ok:false}};
  return {body:c.body.method==='session'?session:{ok:true,result:env.c[c.body.method](c.body.payload)}};
 });
 const page=await mountApp(env,{popupTransport:api});assert.equal(page.nodes.get('count-all').textContent,0);
 await page.nodes.get('site-login').click();await page.settled();assert.equal(page.context.window.location.hash,'');assert.equal(page.nodes.get('site-login').hidden,true);assert.equal(page.nodes.get('count-all').textContent,1);
 await page.openPerson(record.id);page.fields.role.value='Fictional web edit';await page.save();assert.equal(env.c.listCards().cards[0].role,'Fictional web edit');
 await page.openPerson(record.id);assert.equal(page.fields.role.value,'Fictional web edit');assert.equal(page.opened.length,0);
 const denied=new Promise(resolve=>api.onAccessDenied(resolve));deny=true;await page.nodes.get('refresh').click();await denied;await page.settled();assert.equal(page.nodes.get('count-all').textContent,0);assert.equal(page.nodes.get('detail').open,false);assert.equal(page.fields.name.value,'');
});
