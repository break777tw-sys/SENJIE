// Fake Drive and DOM tests: not Google consent, cloud persistence or OCR proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const image=JSON.parse(readFileSync(new URL('./fixtures/photo-cards.json',import.meta.url),'utf8')).files[0];
const upload={requestId:'photo-original-00001',batchId:'photo-original-batch1',name:image.name||'fictional-front.png',mime:'image/png',data:image.base64};
const setup=options=>createFakeGoogle({properties:{PHOTO_OCR_ENABLED:'false',PHOTO_IMPORTS_ENABLED:'true'},...options});
test('狹義照片設定保留Sheets與身分，只新增drive.file；沒有完整Drive或Docs',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../deployment/photo-manual-runtime-manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.oauthScopes,['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/drive.file']);
 const code=readFileSync(new URL('../google-apps-script/PhotoDrive.gs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bDriveApp\s*\.|\bDocumentApp\s*\.|\bUrlFetchApp\s*\.|getOAuthToken\s*\(/);
});
test('一張虛構原圖經確認建檔、重開原介面仍查回同人物、來源、原圖與SHA256',async()=>{
 const env=setup(),source=env.c.uploadPhoto(upload).source;
 assert.equal(source.hash,image.sha256);
 const recognized=env.c.recognizePhoto({sourceId:source.id});assert.equal(recognized.manualReview,true);assert.equal(env.files.size,1);
 const page=await mountApp(env);page.selectSources([source]);await page.openReview();
 page.fields.name.value='虛構照片驗收';page.fields.company.value='Example Invalid';page.fields.phone.value='0900000066';page.confirmFields();await page.save();
 const person=env.c.listCards().cards[0];assert.equal(person.provenance.sources[0].sha256,image.sha256);
 const reopened=await mountApp(env);await reopened.openPerson(person.id);
 assert.equal(reopened.fields.phone.value,'0900000066');assert.match(reopened.nodes.get('source-links').innerHTML,new RegExp(source.id));
 await reopened.openOriginal(source.id);
 assert.equal(reopened.opened[0].location.href,source.originalUrl);assert.equal(reopened.opened[0].opener,null);
 assert.equal(env.c.verifyPhoto({sourceId:source.id}).sha256,image.sha256);
 assert.equal(env.files.size,1);assert.equal(env.sheets.Records.rows.length,2);
});
test('原圖核對先拒絕未授權者與案外來源，再讀Drive；零Google檔案呼叫',()=>{
 const env=setup();env.setEmail('stranger@example.test');assert.throws(()=>env.c.verifyPhoto({sourceId:'anything'}),/拒絕存取/);
 env.setEmail('owner@example.test');assert.throws(()=>env.c.verifyPhoto({sourceId:'unregistered-drive-file'}),/無權/);assert.equal(env.driveCalls.length,0);
});
test('Drive權限不足不建立原圖、不寫入來源內容，也不改存根目錄',()=>{
 const env=setup({denyDrive:true});assert.throws(()=>env.c.uploadPhoto(upload),/permission required/);
 assert.equal(env.files.size,0);assert.equal(env.sheets.Imports.rows.length,1);assert.equal(env.driveCalls.length,1);assert.equal(env.driveCalls[0].id,'private-folder');
});
test('原圖被移動、更換或回傳不安全網址時拒絕；重試也不得沿用失效來源',async()=>{
 for(const meta of [{parents:['outside-folder']},{sha256Checksum:'0'.repeat(64)},{size:'1'},{webViewLink:'https://evil.example/photo'}]){
  const env=setup(),source=env.c.uploadPhoto(upload).source,file=env.files.get(source.originalId);file.meta={...file.meta,...meta};
  assert.throws(()=>env.c.verifyPhoto({sourceId:source.id}),/不符/);assert.throws(()=>env.c.uploadPhoto(upload),/不符/);
  const page=await mountApp(env);await page.openOriginal(source.id);assert.equal(page.opened[0].closed,true);assert.equal(page.opened[0].location.href,'about:blank');
 }
});
test('沒有原圖權限時唯讀就緒檢查回第一缺件，不觸發Drive或請求授權',()=>{
 const env=setup();env.c.ScriptApp={AuthMode:{FULL:'FULL'},AuthorizationStatus:{NOT_REQUIRED:'ok'},getAuthorizationInfo:()=>({getAuthorizationStatus:()=> 'required'})};
 assert.equal(env.c.photoReadiness().code,'PHOTO_PERMISSION_REQUIRED');assert.equal(env.driveCalls.length,0);
 env.setEmail('stranger@example.test');assert.throws(()=>env.c.photoReadiness(),/拒絕存取/);
});
test('drive.file已授權仍必須核對同一應用程式的指定資料夾，不猜測可用',()=>{
 const env=setup({denyDrive:true});env.c.ScriptApp={AuthMode:{FULL:'FULL'},AuthorizationStatus:{NOT_REQUIRED:'ok'},getAuthorizationInfo:()=>({getAuthorizationStatus:()=> 'ok'})};
 assert.equal(env.c.photoReadiness().code,'PHOTO_FOLDER_REQUIRED');assert.equal(env.files.size,0);
});
test('明確授權入口先拒絕案外身分，且缺同意時不存圖、不開啟照片旗標',()=>{
 const env=createFakeGoogle({code:['Code.gs','Imports.gs','PhotoDrive.gs','WebsiteBridge.gs'].map(f=>readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8')).join('\n')}),calls=[];env.c.ScriptApp={AuthMode:{FULL:'FULL'},requireScopes:(mode,scopes)=>{calls.push({mode,scopes:[...scopes]});throw Error('Consent required');}};
 env.setEmail('stranger@example.test');assert.throws(()=>env.c.authorizePhotoAccess(),/拒絕存取/);assert.equal(calls.length,0);
 env.setEmail('owner@example.test');assert.throws(()=>env.c.authorizePhotoAccess(),/Consent required/);
 assert.deepEqual(calls,[{mode:'FULL',scopes:['https://www.googleapis.com/auth/drive.file']}]);assert.equal(env.files.size,0);assert.equal(env.driveCalls.length,0);
});
test('已給照片權限的授權入口仍檢查指定目的地，不自行替換或建立資料夾',()=>{
 const env=createFakeGoogle({denyDrive:true,code:['Code.gs','Imports.gs','PhotoDrive.gs','WebsiteBridge.gs'].map(f=>readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8')).join('\n')});env.c.ScriptApp={AuthMode:{FULL:'FULL'},AuthorizationStatus:{NOT_REQUIRED:'ok'},requireScopes(){},getAuthorizationInfo:()=>({getAuthorizationStatus:()=> 'ok'})};
 assert.equal(env.c.authorizePhotoAccess().code,'PHOTO_FOLDER_REQUIRED');assert.equal(env.files.size,0);
});
test('能力尚未開放時拖放也不繞過停用輸入，不讀取或傳送照片',async()=>{
 const env=setup({properties:{PHOTO_IMPORTS_ENABLED:'false'}}),page=await mountApp(env);
 await page.context.receive([{name:'fictional-front.png',type:'image/png',size:100}]);
 assert.equal(page.calls.some(c=>c.name==='uploadPhoto'),false);assert.equal(env.files.size,0);
});
test('Google連線在本機讀圖期間失效：清除待重試圖片，拒絕晚到上傳及私人資料回填',async()=>{
 const env=setup();let changed,reader,uploads=0;
 const transport={kind:'redirect',session:null,onConnectionChange(fn){changed=fn;fn({connected:false});},async login(){this.session={email:'owner@example.test'};changed({connected:true,session:this.session});},list:async()=>JSON.parse(JSON.stringify(env.c.listCards())),imports:async()=>JSON.parse(JSON.stringify(env.c.listImports())),upload(){uploads++;}};
 class Reader{readAsDataURL(){reader=this;}}
 const page=await mountApp(env,{popupTransport:transport,FileReader:Reader});await page.nodes.get('site-login').click();
 page.context.window.pendingPhotoRetry={data:image.base64};
 const receive=page.context.receive([{name:'fictional-front.png',type:'image/png',size:100}]);
 changed({connected:false});reader.result='data:image/png;base64,'+image.base64;reader.onload();await receive;
 assert.equal(uploads,0);assert.equal(page.context.window.pendingPhotoRetry,null);assert.equal(page.nodes.get('retry-upload').hidden,true);
 assert.equal(page.nodes.get('photos').disabled,true);assert.equal(page.nodes.get('photos').value,'');assert.equal(page.nodes.get('import-progress').textContent,'');
 assert.equal(page.nodes.get('card-grid').innerHTML,'');assert.equal(page.nodes.get('jobs').innerHTML,'');
 assert.equal(page.nodes.get('.notice').textContent,'');assert.equal(page.nodes.get('.notice').hidden,true);assert.equal(page.nodes.get('auth-status').textContent,'使用 Google 帳號登入');
});

test('照片歸檔未確認時顯示彈窗內的錯誤，不猜分類且不寫人物',async()=>{
 const env=setup(),source=env.c.uploadPhoto({...upload,requestId:'review-visible-error-0001'}).source;
 const page=await mountApp(env);page.selectSources([source]);await page.openReview();
 assert.equal(page.fields.category.value,'');assert.equal(page.fields.source.value,'照片確認歸檔');page.fields.name.value='Fictional Review';await page.save();
 assert.equal(page.nodes.get('detail').open,true);assert.equal(page.nodes.get('detail-feedback').hidden,false);assert.match(page.nodes.get('detail-feedback').textContent,/請確認同一張/);assert.equal(env.c.listCards().cards.length,0);
});
