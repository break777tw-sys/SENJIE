import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPopupTransport} from '../popup-transport.js';
import {GOOGLE_SIGN_IN_URL} from '../site-config.js';
import {createFakeGoogle} from './helpers/fake-google.js';
const endpoint='https://script.google.com/macros/s/EXAMPLE_PRIVATE_ENDPOINT/exec';
function browser({hash='',storageDenied=false}={}){
 const handlers={},storage=new Map([['senjie.private-endpoint.v1',endpoint]]),sent=[],timers=new Map();let seq=0;
 const popup={closed:false,close(){this.closed=true;}};popup.top=popup;
 const peer={top:popup,postMessage(data,origin){sent.push({data,origin});}};
 const origin='https://n-example-script.googleusercontent.com';
 const env={crypto:{randomUUID,getRandomValues:a=>webcrypto.getRandomValues(a)},location:{hash,origin:'https://break777tw-sys.github.io',hostname:'break777tw-sys.github.io',pathname:'/SENJIE/',search:''},localStorage:{getItem:k=>{if(storageDenied)throw Error('Storage denied');return storage.get(k);},setItem:(k,v)=>{if(storageDenied)throw Error('Storage denied');return storage.set(k,v);}},history:{replaceState(...args){env.replaced=args;}},addEventListener:(name,fn)=>handlers[name]=fn,open(url){env.opened=new URL(url);return popup;},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{env.closedCheck=fn;return 99;},clearInterval(){env.closedCheck=null;}};
 const transport=createPopupTransport(env),event=(data,source=peer,eventOrigin=origin)=>handlers.message({data,source,origin:eventOrigin});
 const ready=()=>event({type:'senjie-ready',channel:env.opened.searchParams.get('channel')});
 const reply=async(result,ok=true)=>{const request=sent.at(-1).data;await event({type:'senjie-result',channel:request.channel,id:request.id,ok,...(ok?{result}:{error:result})});};
 async function signIn(){const promise=transport.login();const result=ready();await reply({authenticated:true,email:'owner@example.test',capabilities:{photoImport:false}});await result;await promise;}
 return {env,transport,popup,peer,sent,storage,timers,event,ready,reply,signIn,origin};
}
test('登入前不讀資料；只在Google身分回覆後開通原介面',async()=>{
 const b=browser();await assert.rejects(b.transport.list(),/請先登入/);await b.signIn();
 assert.equal(b.transport.session.email,'owner@example.test');
 const result=b.transport.list();assert.equal(b.sent.at(-1).data.method,'listCards');assert.equal(b.sent.at(-1).origin,b.origin);
 await b.reply({cards:[{id:'F001',version:2}]});assert.equal((await result).cards[0].version,2);b.transport.logout();
});
test('相同nonce仍拒絕其他視窗、其他Google來源樹與非Google來源',async()=>{
 const b=browser(),login=b.transport.login(),channel=b.env.opened.searchParams.get('channel');
 for(const [source,origin] of [[{top:{}},b.origin],[b.peer,'https://evil.example'],[b.peer,'https://script.googleusercontent.com.evil.example']])await b.event({type:'senjie-ready',channel},source,origin);
 await b.event({type:'senjie-ready',channel:'0'.repeat(32)});assert.equal(b.sent.length,0);
 const ready=b.ready();await b.reply({authenticated:true,email:'owner@example.test'});await ready;await login;b.transport.logout();
});
test('Google失敗不轉成成功；登出拒絕進行中讀取並清除身分',async()=>{
 const b=browser();await b.signIn();const failed=b.transport.save({id:'F001'});await b.reply('資料版本衝突',false);await assert.rejects(failed,/資料版本衝突/);
 const pending=b.transport.list();b.transport.logout();await assert.rejects(pending,/已登出/);assert.equal(b.transport.session,null);assert.equal(b.popup.closed,true);await assert.rejects(b.transport.list(),/請先登入/);
});
test('後端撤銷允許資格後，拒絕回覆立即清除網站身分',async()=>{
 const b=browser();await b.signIn();const failed=b.transport.list();await b.reply('拒絕存取：未確認的 Google 身分。',false);
 await assert.rejects(failed,/拒絕存取/);assert.equal(b.transport.session,null);await assert.rejects(b.transport.list(),/請先登入/);
});
test('關閉連線與逾時不留下已登入狀態',async()=>{
 const b=browser();await b.signIn();b.popup.closed=true;b.env.closedCheck();assert.equal(b.transport.session,null);
 const c=browser(),login=c.transport.login();[...c.timers.values()].find(t=>t.ms===180000).fn();await assert.rejects(login,/登入尚未完成/);assert.equal(c.transport.session,null);
});
test('全新瀏覽器及封鎖儲存的瀏覽器都可直接登入；開啟Google視窗保留同步點擊流程',async()=>{
 for(const storageDenied of [false,true]){
  const b=browser({storageDenied});b.storage.clear();
  const login=b.transport.login();assert.equal(b.env.opened.origin,'https://script.google.com');assert.equal(b.env.opened.pathname,new URL(GOOGLE_SIGN_IN_URL).pathname);
  const ready=b.ready();await b.reply({authenticated:true,email:'owner@example.test'});await ready;await login;b.transport.logout();
 }
});
test('舊啟用網址與瀏覽器殘留設定不會覆寫網站登入目的地',async()=>{
 for(const invalid of ['https://evil.example/exec',endpoint+'?token=bad',endpoint.replace('/exec','/dev'),endpoint]){
  const b=browser({hash:'#connect='+encodeURIComponent(invalid)});b.storage.set('senjie.private-endpoint.v1',invalid);
  assert.equal(b.env.replaced[2],'/SENJIE/#home');await b.signIn();
  assert.equal(b.env.opened.origin,'https://script.google.com');assert.equal(b.env.opened.pathname,new URL(GOOGLE_SIGN_IN_URL).pathname);b.transport.logout();
 }
});
test('Google登入視窗遭瀏覽器阻擋時顯示真正原因，不再要求啟用連結',async()=>{
 const b=browser({storageDenied:true});b.env.open=()=>null;
 await assert.rejects(b.transport.login(),/允許這個網站開啟 Google 登入視窗/);assert.equal(b.transport.session,null);
});
const code=['Code.gs','Imports.gs','PhotoDrive.gs','WebsiteBridge.gs'].map(f=>readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8')).join('\n');
test('真正後端bridge白名單：未登入session／CRUD拒絕；不可呼叫私人函式或任意Google函式',()=>{
 const env=createFakeGoogle({code});env.setEmail('stranger@example.test');
 for(const method of ['session','listCards','saveCard','uploadPhoto'])assert.throws(()=>env.c.websiteBridgeCall({method}),/拒絕存取/);
 env.setEmail('owner@example.test');assert.equal(env.c.websiteBridgeCall({method:'session'}).authenticated,true);
 for(const method of ['authorize_','initializeRecords_','runAcceptance','constructor','toString','__proto__'])assert.throws(()=>env.c.websiteBridgeCall({method}),/拒絕未開放/);
 assert.throws(()=>env.c.websiteBridgeCall({method:'uploadPhoto',payload:{}}),/照片建檔尚未開放/);assert.equal(env.files.size,0);
 const result=env.c.websiteBridgeCall({method:'saveCard',payload:{requestId:'website-bridge-00001',card:{name:'虛構名片',company:'測試組織',status:'已確認'}}});
 assert.equal(env.c.websiteBridgeCall({method:'listCards'}).cards[0].id,result.record.id);
});
test('bridge頁面只接受原網站與固定本機驗收來源；拒絕任意回傳網址',()=>{
 const env=createFakeGoogle({code});let value;
 env.c.HtmlService={createTemplateFromFile:name=>{assert.equal(name,'WebsiteBridge');return {set config(data){value=JSON.parse(data);},evaluate:()=>({setTitle:title=>({title})})};}};
 const channel='a'.repeat(32);env.c.websiteBridge_({origin:'https://break777tw-sys.github.io',channel});assert.equal(value.channel,channel);
 for(const origin of ['https://evil.example','https://break777tw-sys.github.io.evil.example','null','http://127.0.0.1:9999'])assert.throws(()=>env.c.websiteBridge_({origin,channel}),/拒絕/);
 assert.throws(()=>env.c.websiteBridge_({origin:'https://break777tw-sys.github.io',channel:'guess'}),/拒絕/);
});
