import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSignInTransport} from '../popup-transport.js';
import {GOOGLE_SIGN_IN_URL} from '../site-config.js';
import {createFakeGoogle} from './helpers/fake-google.js';
function browser(hash=''){
 const navigated=[];const env={location:{hash,pathname:'/SENJIE/',search:'',assign:url=>navigated.push(url)},history:{replaceState(...args){env.replaced=args;}},open(){throw Error('Popup forbidden');},localStorage:{getItem(){throw Error('Storage forbidden');}}};
 return {env,navigated,transport:createSignInTransport(env)};
}
test('登入在同一頁進入既有Google應用程式，不開視窗或依賴儲存',()=>{
 const b=browser();const login=b.transport.login();assert.equal(login instanceof Promise,true);
 assert.deepEqual(b.navigated,[GOOGLE_SIGN_IN_URL]);assert.equal(new URL(b.navigated[0]).search,'');assert.equal(b.transport.session,null);
});
test('未登入的公開頁面不能讀寫資料，也不假裝已建立登入狀態',async()=>{
 const b=browser();let state;b.transport.onConnectionChange(value=>state=value);assert.deepEqual(state,{connected:false,session:null});
 for(const method of ['list','save','imports','upload','recognize','archive','resume','original'])await assert.rejects(b.transport[method](),/請先使用 Google 登入/);
});
test('舊啟用連結不能改變新的單頁登入目的地',()=>{
 const b=browser('#connect='+encodeURIComponent('https://evil.example/exec'));b.transport.login();assert.equal(b.env.replaced[2],'/SENJIE/#home');assert.deepEqual(b.navigated,[GOOGLE_SIGN_IN_URL]);
});
const code=['Code.gs','Imports.gs','PhotoDrive.gs','Conversations.gs','WebsiteBridge.gs'].map(f=>readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8')).join('\n');
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
