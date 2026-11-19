import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const images=JSON.parse(readFileSync(new URL('./fixtures/photo-cards.json',import.meta.url),'utf8')).files;
function pair(env){return images.map((image,i)=>{const source=env.c.uploadPhoto({requestId:'upload-recovery-000'+i,batchId:'batch-recovery-0001',name:image.name,mime:image.mime,data:image.base64}).source;env.c.recognizePhoto({sourceId:source.id});return source;});}
const card={name:'Fictional Person',company:'Example Invalid',status:'已確認',phone:'0900000022'};
const request=sources=>({requestId:'recovery-request-0001',sources:sources.map((s,i)=>({id:s.id,side:i?'反面':'正面'})),card,confirmed:true,reviewedFields:Object.keys(card)});
for(const completedSides of [0,1])test(`實際app事件：來源已完成${completedSides}面後故障，重開頁面從原收件匣補齊兩面且一人`,async()=>{
 const env=createFakeGoogle(),sources=pair(env),firstPage=await mountApp(env);
 firstPage.selectSources(sources);await firstPage.openReview();firstPage.confirmFields();
 env.failNextSourceWrite(completedSides);await firstPage.save();
 assert.equal(env.sheets.Records.rows.length,2);assert.match(firstPage.nodes.get('toast').textContent,/人物已保存，來源尚未完成/);
 const before=env.c.listImports(),task=before.recoveries[0],originalPerson=env.c.listCards().cards[0];
 assert.equal(task.pendingSourceIds.length,2-completedSides);assert.equal(task.sources.length,2);
 // Discard every client variable/requestId; retain only the server-side fake Sheets.
 const reopened=await mountApp(env);
 assert.match(reopened.nodes.get('archive-recoveries').innerHTML,/續辦來源歸檔/);
 assert.equal(reopened.nodes.get('count-all').textContent,1);
 reopened.selectSources(before.sources.filter(s=>s.state!=='archived'));await reopened.openReview();
 assert.equal(reopened.nodes.get('detail').open,false);assert.match(reopened.nodes.get('toast').textContent,/請先使用.*續辦來源歸檔/);
 await reopened.resume(task.requestId);
 const after=env.c.listImports();assert.equal(after.recoveries.length,0);assert.equal(after.sources.filter(s=>s.state==='archived').length,2);
 assert.equal(env.sheets.Records.rows.length,2);assert.equal(env.c.listCards().cards[0].id,originalPerson.id);
 assert.equal(new Set(after.sources.map(s=>s.personId)).size,1);assert.equal(new Set(after.sources.map(s=>s.physicalCardId)).size,1);
 assert.ok(after.sources.every(s=>s.archiveRequestId===task.requestId));
 assert.ok(reopened.calls.some(c=>c.name==='resumePhotoArchive'));assert.ok(!reopened.calls.some(c=>c.name==='archivePhotos'||c.name==='saveCard'));
 assert.doesNotMatch(reopened.nodes.get('toast').textContent,/疑似重複/);
 assert.equal(reopened.nodes.get('archive-recoveries').innerHTML,'');
 // A repeated response/click is harmless after completion.
 await reopened.resume(task.requestId);assert.equal(env.sheets.Records.rows.length,2);
});
test('續辦期間仍可再次中斷；重新讀取保留原回條及剩餘面數',()=>{
 const env=createFakeGoogle(),sources=pair(env);env.failNextSourceWrite();assert.throws(()=>env.c.archivePhotos(request(sources)),/simulated/);
 const task=env.c.listImports().recoveries[0];env.failNextSourceWrite(1);assert.throws(()=>env.c.resumePhotoArchive({requestId:task.requestId}),/simulated/);
 assert.equal(env.c.listImports().recoveries[0].pendingSourceIds.length,1);env.c.resumePhotoArchive({requestId:task.requestId});assert.equal(env.c.listImports().recoveries.length,0);assert.equal(env.sheets.Records.rows.length,2);
});
test('新操作編號或改名不可搶用尚待續辦的來源',()=>{
 const env=createFakeGoogle(),sources=pair(env);env.failNextSourceWrite();assert.throws(()=>env.c.archivePhotos(request(sources)),/simulated/);
 assert.throws(()=>env.c.archivePhotos({...request(sources),requestId:'recovery-request-0002',card:{...card,name:'Different Person'}}),/人物已保存/);assert.equal(env.sheets.Records.rows.length,2);
});
test('續辦不覆蓋人物後續版本；手動修改不會產生假的第二份續辦回條',async()=>{
 const env=createFakeGoogle(),sources=pair(env);env.failNextSourceWrite();assert.throws(()=>env.c.archivePhotos(request(sources)),/simulated/);
 const person=env.c.listCards().cards[0];env.c.saveCard({requestId:'edit-recovery-00001',id:person.id,expectedVersion:1,card:{...card,role:'Later Revision'}});
 const tasks=env.c.listImports().recoveries;assert.equal(tasks.length,1);
 const page=await mountApp(env);await page.resume(tasks[0].requestId);
 assert.equal(env.c.listCards().cards[0].version,2);assert.equal(env.c.listCards().cards[0].role,'Later Revision');assert.equal(env.sheets.Records.rows.length,3);
 assert.equal(vmCard(page).version,2);
});
function vmCard(page){return vm.runInContext('cards[0]',page.context);}
test('未授權續辦、未知操作及來源衝突均拒絕；先驗兩面再寫任一面',()=>{
 const env=createFakeGoogle(),sources=pair(env);env.failNextSourceWrite();assert.throws(()=>env.c.archivePhotos(request(sources)),/simulated/);
 const count=env.sheets.Imports.rows.length;env.setEmail('stranger@example.test');assert.throws(()=>env.c.resumePhotoArchive({requestId:'recovery-request-0001'}),/拒絕存取/);env.setEmail('owner@example.test');
 assert.throws(()=>env.c.resumePhotoArchive({requestId:'unknown-request-0001'}),/找不到/);
 const rows=env.sheets.Imports.rows,last=JSON.parse(rows.at(-1)[2]);last.hash='changed';rows.at(-1)[2]=JSON.stringify(last);
 assert.throws(()=>env.c.resumePhotoArchive({requestId:'recovery-request-0001'}),/回條不符/);assert.equal(rows.length,count);assert.match(env.c.listImports().recoveries[0].blockedReason,/回條不符/);
});
test('一般新增仍走原介面的重複檢查，不因續辦功能而自動合併',async()=>{
 const env=createFakeGoogle(),sources=pair(env);env.c.archivePhotos(request(sources));const page=await mountApp(env);
 await page.nodes.get('new-card').click();for(const [key,value] of Object.entries(card))page.fields[key].value=value;
 await page.save();assert.match(page.nodes.get('toast').textContent,/疑似重複/);assert.equal(env.sheets.Records.rows.length,2);assert.ok(!page.calls.some(c=>c.name==='saveCard'||c.name==='archivePhotos'||c.name==='resumePhotoArchive'));
});
