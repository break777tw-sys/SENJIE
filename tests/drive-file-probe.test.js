import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const code=readFileSync(new URL('../experiments/drive-file/ScopedPhotoStore.gs',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../experiments/drive-file/appsscript.json',import.meta.url),'utf8'));
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/photo-cards.json',import.meta.url),'utf8')).files;
const front=Array.from(Buffer.from(fixtures[0].base64,'base64')),back=Array.from(Buffer.from(fixtures[1].base64,'base64'));
// Fake Drive is intentionally NOT evidence of Google OAuth enforcement or OCR accuracy.
function setup(){
 const parentId='project-folder-only',registry=new Map(),objects=new Map(),calls=[];let folderGranted=true,exportFailure=false,readCorrupt=false;
 const blob=bytes=>({getBytes:()=>[...bytes],getDataAsString:()=>Buffer.from(bytes).toString('utf8')});
 const files={
  get(id,options){calls.push({method:'get',id,options});if(id===parentId){if(!folderGranted)throw Error('404');return {id,mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}};}const file=objects.get(id);if(!file)throw Error('404');return options.alt==='media'?blob(readCorrupt?[1,2,3]:file.bytes):{...file};},
  list(options){calls.push({method:'list',options});assert.ok(options.q.startsWith("'"+parentId+"' in parents"));const role=options.q.match(/senjieProbeRole' and value='([^']+)'/)[1],digest=options.q.match(/sourceSHA256' and value='([^']+)'/)[1];return {files:[...objects.values()].filter(f=>f.appProperties.senjieProbeRole===role&&f.appProperties.sourceSHA256===digest&&f.parents.includes(parentId))};},
  create(meta,data,options){calls.push({method:'create',meta,options});const id='file-'+objects.size;const file={...meta,id,bytes:data.getBytes(),webViewLink:'https://drive.google.com/file/d/'+id+'/view'};objects.set(id,file);return {...file};},
  export(id,mime,options){calls.push({method:'export',id,mime,options});if(exportFailure)throw Error('simulated export failure');return blob(Array.from(Buffer.from('MOCK OCR TEXT; NOT REAL OCR')));}
 };
 const utilities={DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,bytes)=>Array.from(createHash('sha256').update(Buffer.from(bytes)).digest()),newBlob:bytes=>blob(bytes)};
 const c=vm.createContext({Error,Array,String,Set});vm.runInContext(code,c);
 const store=c.createScopedPhotoStore_(files,utilities,parentId,{get:id=>registry.get(id),save:(id,value)=>registry.set(id,value)});
 return {c,store,files,objects,registry,calls,utilities,parentId,denyFolder:()=>folderGranted=false,failExport:()=>exportFailure=true,corrupt:()=>readCorrupt=true};
}
test('實驗資訊清單只要求drive.file；沒有完整Drive、Docs或外部請求服務',()=>{assert.deepEqual(manifest.oauthScopes,['https://www.googleapis.com/auth/drive.file']);assert.doesNotMatch(code,/\bDriveApp\s*\.|\bDocumentApp\s*\.|\bUrlFetchApp\s*\.|getOAuthToken\s*\(/);});
test('真實虛構PNG位元組及SHA-256保留；正反面與重複正面只建兩原圖',()=>{const e=setup();const a=e.store.preserve(front,'image/png'),b=e.store.preserve(back,'image/png'),repeat=e.store.preserve(front,'image/png');assert.equal(a.hash,fixtures[0].sha256);assert.equal(b.hash,fixtures[1].sha256);assert.equal(repeat.id,a.id);assert.equal(e.objects.size,2);assert.equal(e.calls.filter(x=>x.method==='create').length,2);assert.ok([...e.objects.values()].every(f=>f.parents.length===1&&f.parents[0]===e.parentId));});
test('未取得同一app的資料夾授權即停止；無My Drive根目錄降級保存',()=>{const e=setup();e.denyFolder();assert.throws(()=>e.store.preserve(front,'image/png'),/資料夾授權/);assert.equal(e.objects.size,0);assert.equal(e.calls.length,1);});
test('任意案外來源ID在任何Google API呼叫前拒絕，即使該app可能讀得到',()=>{const e=setup();assert.throws(()=>e.store.recognize('unrelated-app-authorized-file'),/不屬本案/);assert.equal(e.calls.length,0);});
test('案外登記或移出資料夾時拒絕，原圖變更也不進OCR',()=>{const e=setup(),a=e.store.preserve(front,'image/png');e.registry.set('outside',{id:'outside',parentId:'other-folder'});const n=e.calls.length;assert.throws(()=>e.store.recognize('outside'),/不屬本案/);assert.equal(e.calls.length,n);e.objects.get(a.id).parents=['other-folder'];assert.throws(()=>e.store.recognize(a.id),/位置不符/);e.objects.get(a.id).parents=[e.parentId];e.corrupt();assert.throws(()=>e.store.recognize(a.id),/原圖已變更/);assert.equal(e.calls.filter(x=>x.method==='export').length,0);});
test('模擬OCR使用create加export，沒有文件服務；重試不多建OCR文件',()=>{const e=setup(),a=e.store.preserve(front,'image/png');const result=e.store.recognize(a.id);assert.equal(result.ocrText,'MOCK OCR TEXT; NOT REAL OCR');e.store.recognize(a.id);assert.equal(e.objects.size,2);const exports=e.calls.filter(x=>x.method==='export');assert.equal(exports.length,2);assert.ok(exports.every(x=>x.mime==='text/plain'&&x.options.alt==='media'));});
test('匯出失敗保留原圖和OCR文件，不假裝辨識完成',()=>{const e=setup(),a=e.store.preserve(front,'image/png');e.failExport();assert.throws(()=>e.store.recognize(a.id),/simulated export failure/);assert.equal(e.objects.size,2);assert.equal(e.registry.get(a.id).ocrText,undefined);});
