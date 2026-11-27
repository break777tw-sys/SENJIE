import test from 'node:test';
import assert from 'node:assert/strict';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
import {createTransport} from '../transport.js';
const card={name:'Fictional Access Test',company:'Example Invalid',status:'已確認',phone:'0900000022',email:'access@example.invalid',next:'虛構合作草稿'};
function setup(){const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}});const record=env.c.saveCard({requestId:'access-owner-create-0001',card}).record;return {env,record};}
function assertCleared(page){
 assert.equal(page.nodes.get('detail').open,false);
 assert.equal(page.fields.name.value,'');assert.equal(page.fields.phone.value,'');
 assert.equal(page.nodes.get('detail-id').textContent,'');
 assert.equal(page.nodes.get('source-links').innerHTML,'');
 assert.equal(page.nodes.get('count-all').textContent,0);
 assert.doesNotMatch(page.nodes.get('card-grid').innerHTML,/Fictional Access Test/);
 assert.doesNotMatch(page.nodes.get('followup-list').innerHTML,/虛構合作草稿/);
 assert.equal(page.nodes.get('jobs').innerHTML,'');
 assert.equal(page.nodes.get('new-card').disabled,true);assert.equal(page.nodes.get('photos').disabled,true);
 assert.equal(page.demoNodes.get('[data-demo-content]').innerHTML,'');
 assert.equal(page.demoNodes.get('[name="demo-preference"]').value,'');
 assert.equal(page.demoNodes.get('[type="submit"]').disabled,true);
}
test('保存遭拒時立即關閉及清空人物、來源、搜尋與偏好，資料不寫入',async()=>{
 const {env,record}=setup(),page=await mountApp(env);await page.openPerson(record.id);
 page.fields.role.value='DENIED_CHANGE_MUST_NOT_SAVE';page.nodes.get('search').value='Fictional Access Test';
 assert.match(page.demoNodes.get('[data-demo-content]').innerHTML,/DEMO_EVENT_001/);
 env.setEmail('stranger@example.invalid');await page.save();assertCleared(page);
 assert.equal(page.nodes.get('search').value,'');assert.equal(env.sheets.Records.rows.length,2);
});
test('偏好保存遭拒也清空其他模組；不留下可再次保存的偏好草稿',async()=>{
 const {env,record}=setup(),page=await mountApp(env);await page.openPerson(record.id);
 page.demoNodes.get('[name="demo-preference"]').value='DENIED_PREFERENCE_MUST_NOT_SAVE';env.setEmail('stranger@example.invalid');
 await page.demoNodes.get('form').emit('submit');await page.settled();assertCleared(page);assert.equal(env.sheets.DemoPreferences,undefined);
});
test('資格還原後可明確重新讀取同一人物與偏好，不改舊版本',async()=>{
 const {env,record}=setup(),page=await mountApp(env);env.setEmail('stranger@example.invalid');await page.nodes.get('refresh').click();await page.settled();await page.settled();assertCleared(page);
 env.setEmail('owner@example.test');await page.nodes.get('refresh').click();await page.settled();await page.settled();await page.demoNodes.get('[data-demo-reload]').click();await page.settled();
 assert.equal(page.nodes.get('count-all').textContent,1);assert.equal(page.nodes.get('new-card').disabled,false);
 assert.match(page.demoNodes.get('[data-demo-content]').innerHTML,/DEMO_EVENT_001/);assert.equal(page.demoNodes.get('[type="submit"]').disabled,false);
 assert.equal(env.c.listCards().cards[0].id,record.id);assert.equal(env.c.listCards().cards[0].version,1);
});
test('版本衝突等一般錯誤仍保留草稿，不誤判成身分撤銷',async()=>{
 const {env,record}=setup(),page=await mountApp(env);await page.openPerson(record.id);page.fields.role.value='Keep retryable draft';
 env.c.saveCard=()=>{throw new Error('資料已在其他入口更新，請重新讀取後再修改。');};await page.save();
 assert.equal(page.nodes.get('detail').open,true);assert.equal(page.fields.role.value,'Keep retryable draft');assert.equal(page.nodes.get('count-all').textContent,1);
 assert.match(page.demoNodes.get('[data-demo-content]').innerHTML,/DEMO_EVENT_001/);
});
function pendingBridge(){const requests=[];const bridge={withSuccessHandler(success){return {withFailureHandler(failure){return new Proxy({},{get:(_,method)=>payload=>requests.push({method,payload,success,failure})});}};}};return {requests,transport:createTransport(bridge)};}
test('撤銷事件讓同時在途的舊成功回應失效，之後新請求可正常恢復',async()=>{
 const {requests,transport}=pendingBridge();let denied=0;transport.onAccessDenied(()=>denied++);
 const first=transport.list(),second=transport.conversations();const firstDenied=assert.rejects(first,/拒絕存取/),oldIgnored=assert.rejects(second,/存取狀態已更新/);
 requests[0].failure({message:'拒絕存取：未確認的 Google 身分。'});requests[1].success({shouldNeverRender:'old private response'});
 await firstDenied;await oldIgnored;assert.equal(denied,1);
 const restored=transport.list();requests[2].success({schemaVersion:1,cards:[]});assert.deepEqual(await restored,{schemaVersion:1,cards:[]});
});
test('每個 Google 讀寫操作都觸發同一撤銷處理，舊失敗不清掉新的成功狀態',async()=>{
 for(const method of ['list','save','imports','upload','recognize','archive','resume','original','conversations','savePreference']){
  const {requests,transport}=pendingBridge();let denied=0;const unsubscribe=transport.onAccessDenied(()=>denied++);
  const request=transport[method]({});const rejected=assert.rejects(request,/拒絕存取/);requests[0].failure({message:'Error: 拒絕存取：未確認的 Google 身分。'});await rejected;assert.equal(denied,1,method);unsubscribe();
 }
 const {requests,transport}=pendingBridge();let denied=0;transport.onAccessDenied(()=>denied++);
 const old=transport.imports(),trigger=transport.list();const a=assert.rejects(old,/存取狀態已更新/),b=assert.rejects(trigger,/拒絕存取/);
 requests[1].failure({message:'拒絕存取：未確認的 Google 身分。'});const fresh=transport.list();requests[2].success({ok:true});assert.deepEqual(await fresh,{ok:true});
 requests[0].failure({message:'拒絕存取：未確認的 Google 身分。'});await a;await b;assert.equal(denied,1);
});
