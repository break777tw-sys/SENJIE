import test from 'node:test';
import assert from 'node:assert/strict';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const file=n=>({name:`QA-batch-${n}.png`,size:png.length,type:'image/png',data:Buffer.concat([png,Buffer.from(String(n))]).toString('base64')});
class Reader{readAsDataURL(file){this.result='data:'+file.type+';base64,'+file.data;this.onload();}}
async function upload(page,files){page.nodes.get('photos').files=files;await page.nodes.get('photos').emit('change');}
test('七張逐張顯示雲端保存與待歸檔，不能把上傳算作新增人物',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}}),page=await mountApp(env,{FileReader:Reader});await upload(page,Array.from({length:7},(_,i)=>file(i)));
 assert.match(page.nodes.get('import-progress').textContent,/本批 7 張：原圖已保存 7 張；處理完成 7 張；失敗 0 張；排隊 0 張/);
 for(let i=0;i<7;i++)assert.match(page.nodes.get('upload-queue').innerHTML,new RegExp(`QA-batch-${i}.png`));
 assert.equal(env.c.listImports().sources.length,7);assert.equal(env.c.listCards().cards.length,0);assert.match(page.nodes.get('pending-photo-count').textContent,/7 張原圖待確認/);assert.equal(page.nodes.get('followup-inbox').hidden,false);
});
test('單張上傳回應遺失不阻斷後續；同操作重試不多建來源或收件',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}}),uploadOriginal=env.c.uploadPhoto;let once=true;
 env.c.uploadPhoto=request=>{const result=uploadOriginal(request);if(once){once=false;throw new Error('network response lost');}return result;};
 const page=await mountApp(env,{FileReader:Reader});await upload(page,[file(10),file(11)]);
 assert.equal(env.c.listImports().sources.length,2);assert.match(page.nodes.get('import-progress').textContent,/失敗 1 張/);assert.equal(page.nodes.get('retry-upload').hidden,false);
 const before=page.calls.filter(c=>c.name==='uploadPhoto');await page.nodes.get('retry-upload').click();
 const after=page.calls.filter(c=>c.name==='uploadPhoto');assert.equal(after.length,3);assert.deepEqual(after[2].payload,before[0].payload);assert.equal(env.c.listImports().sources.length,2);assert.equal(env.c.listImports().sources.reduce((n,s)=>n+s.receipts.length,0),2);assert.match(page.nodes.get('import-progress').textContent,/失敗 0 張/);
});
test('辨識失敗保留原圖，重試只做辨識；格式及大小不符逐項拒絕',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}});env.setOCRFailure(true);const page=await mountApp(env,{FileReader:Reader});
 await upload(page,[file(20),{...file(21),type:'video/mp4'},{...file(22),size:11*1024*1024}]);
 assert.match(page.nodes.get('upload-queue').innerHTML,/原圖已在雲端/);assert.match(page.nodes.get('import-progress').textContent,/原圖已保存 1 張/);assert.equal(page.calls.filter(c=>c.name==='uploadPhoto').length,1);
 env.setOCRFailure(false);await page.nodes.get('retry-upload').click();assert.equal(page.calls.filter(c=>c.name==='uploadPhoto').length,1);assert.equal(env.c.listImports().sources[0].state,'ready');
});
test('處理中或未保存失敗有離頁保護，全部完成後不阻擋；刷新不打斷批次',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}}),original=env.c.uploadPhoto;let release;env.c.uploadPhoto=request=>new Promise(resolve=>{release=()=>resolve(original(request));});
 const page=await mountApp(env,{FileReader:Reader}),pending=upload(page,[file(30)]);await page.settled();
 const event={prevented:false,preventDefault(){this.prevented=true;}};for(const handler of page.context.window.handlers.beforeunload)handler(event);assert.equal(event.prevented,true);
 const reads=page.calls.filter(c=>c.name==='listCards').length;await page.nodes.get('refresh').click();assert.equal(page.calls.filter(c=>c.name==='listCards').length,reads);
 release();await pending;const done={prevented:false,preventDefault(){this.prevented=true;}};for(const handler of page.context.window.handlers.beforeunload)handler(done);assert.equal(done.prevented,false);
});
test('正反面同圖歸為一張卡一人，回讀保存面別；重複相同候選不漏填，衝突留白',()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}}),source=env.c.uploadPhoto({requestId:'combined-upload-0001',batchId:'combined-batch-0001',name:'combined.png',mime:'image/png',data:png.toString('base64')}).source;
 const result=env.c.archivePhotos({requestId:'combined-archive-0001',confirmed:true,sources:[{id:source.id,side:'正反面同圖'}],card:{name:'Fictional combined person',status:'已確認'},reviewedFields:['name','status']});
 assert.equal(result.record.provenance.sources[0].side,'正反面同圖');assert.equal(env.c.listCards().cards.length,1);assert.equal(env.c.listImports().sources.length,1);
 assert.equal(env.c.extractCandidates_('Name: Same\nName: Same').name,'Same');assert.equal(env.c.extractCandidates_('Name: A\nName: B').name,undefined);
});
test('已歸檔但無下一步的人物仍有合作追蹤編輯入口',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}});env.c.saveCard({requestId:'followup-empty-0001',card:{name:'Fictional no next',status:'待確認'}});const page=await mountApp(env);
 assert.match(page.nodes.get('followup-list').innerHTML,/Fictional no next/);assert.match(page.nodes.get('followup-list').innerHTML,/尚未設定下一步/);assert.match(page.nodes.get('followup-list').innerHTML,/查看與修改/);
});

test('WebP保存成功但不支援OCR時顯示手動核對，不能卡住下一批',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}}),page=await mountApp(env,{FileReader:Reader});
 const webp={name:'QA-manual.webp',type:'image/webp',size:12,data:Buffer.from('RIFF0000WEBP').toString('base64')};
 await upload(page,[webp]);assert.match(page.nodes.get('upload-queue').innerHTML,/已保存・請手動核對/);assert.match(page.nodes.get('import-progress').textContent,/失敗 0 張/);
 await upload(page,[file(40)]);assert.equal(env.c.listImports().sources.length,2);assert.match(page.nodes.get('import-progress').textContent,/原圖已保存 1 張/);
});

test('永久失敗的檔案保留可重試，但不得封鎖下一批正常照片',async()=>{
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true'}}),page=await mountApp(env,{FileReader:Reader});
 const invalid={name:'QA-corrupt.png',type:'image/png',size:12,data:Buffer.from('not an image').toString('base64')};
 await upload(page,[invalid,file(50)]);assert.equal(env.c.listImports().sources.length,1);
 const originalFailed=page.calls.find(c=>c.name==='uploadPhoto'&&c.payload.name===invalid.name).payload;
 await upload(page,[file(51)]);assert.equal(env.c.listImports().sources.length,2);
 assert.match(page.nodes.get('upload-queue').innerHTML,/QA-corrupt.png/);assert.match(page.nodes.get('upload-queue').innerHTML,/QA-batch-51.png/);
 const retries=page.calls.filter(c=>c.name==='uploadPhoto'&&c.payload.name===invalid.name);assert.equal(retries.at(-1).payload.requestId,originalFailed.requestId);
 assert.equal(env.c.listImports().sources.reduce((n,s)=>n+s.receipts.length,0),2);
});
