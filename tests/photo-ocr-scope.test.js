import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const image=JSON.parse(readFileSync(new URL('./fixtures/photo-cards.json',import.meta.url),'utf8')).files[0];
const request={requestId:'scope-ocr-upload-0001',batchId:'scope-ocr-batch-0001',name:image.name,mime:image.mime,data:image.base64};
test('OCR只用已核准drive.file與原圖相同位元組；保留原文且未確認前零人物',()=>{
 const e=createFakeGoogle(),source=e.c.uploadPhoto(request).source;
 const ready=e.c.recognizePhoto({sourceId:source.id,mime:image.mime,data:image.base64}).source;
 assert.equal(ready.state,'ready');assert.equal(ready.candidates.name,'Fictional Person');assert.equal(ready.candidates.phone,'0900000022');assert.equal(e.c.listCards().cards.length,0);
 const creation=e.driveCalls.find(c=>c.method==='create'&&c.meta.mimeType==='application/vnd.google-apps.document');assert.equal(Object.hasOwn(creation.opts,'ocrLanguage'),false);
 assert.match(ready.ocrText,/Company: Example Invalid/);assert.equal(e.files.size,2);e.c.recognizePhoto({sourceId:source.id});assert.equal(e.files.size,2);
 const code=readFileSync(new URL('../google-apps-script/Imports.gs',import.meta.url),'utf8');assert.doesNotMatch(code,/DriveApp|DocumentApp|UrlFetchApp|getOAuthToken/);
 const manifest=JSON.parse(readFileSync(new URL('../deployment/photo-manual-runtime-manifest.json',import.meta.url),'utf8'));assert.ok(manifest.dependencies.enabledAdvancedServices.some(s=>s.serviceId==='docs'));assert.equal(manifest.oauthScopes.length,3);
});
test('缺圖或不同圖片不可建立OCR衍生檔；原圖與人物數不變',()=>{
 for(const payload of [{},{data:image.base64,mime:'image/jpeg'}]){
  const e=createFakeGoogle(),source=e.c.uploadPhoto(request).source;
  const result=e.c.recognizePhoto({sourceId:source.id,...payload}).source;assert.equal(result.state,'error');assert.equal(e.files.size,1);assert.equal(e.c.listCards().cards.length,0);assert.ok(e.c.verifyPhoto({sourceId:source.id}).sha256);
 }
});
test('OCR重開文件失敗可續辦，既有衍生文件不重複建立',()=>{
 const e=createFakeGoogle(),source=e.c.uploadPhoto(request).source;const get=e.c.Docs.Documents.get;
 e.c.Docs.Documents.get=()=>{throw Error('Temporary Docs failure');};assert.equal(e.c.recognizePhoto({sourceId:source.id,mime:image.mime,data:image.base64}).source.state,'error');assert.equal(e.files.size,2);
 e.c.Docs.Documents.get=get;assert.equal(e.c.recognizePhoto({sourceId:source.id}).source.state,'ready');assert.equal(e.files.size,2);
});
test('文件多分頁表格文字可核對，空白或超限不得冒稱辨識完成',()=>{
 const e=createFakeGoogle();const p=text=>({paragraph:{elements:[{textRun:{content:text}}]}});
 const doc={tabs:[{documentTab:{body:{content:[p('Name: '),{table:{tableRows:[{tableCells:[{content:[p('Fictional Person\n')]}]}]}}]}},childTabs:[{documentTab:{body:{content:[p('Company: Example Invalid')]}}}]}]};
 assert.match(e.c.ocrDocumentText_(doc),/Fictional Person\nCompany/);assert.throws(()=>e.c.ocrDocumentText_({body:{content:[]}}),/未辨識到/);assert.throws(()=>e.c.ocrDocumentText_({body:{content:[p('x'.repeat(16001))]}}),/超過上限/);
});
test('缺少照片能力欄位時不開放上傳',async()=>{
 const e=createFakeGoogle();e.c.listCards=()=>({schemaVersion:1,cards:[]});const page=await mountApp(e);assert.equal(page.nodes.get('photos').disabled,true);await page.context.receive([{name:'x.png',type:'image/png',size:1}]);assert.equal(page.calls.some(c=>c.name==='uploadPhoto'),false);
});
