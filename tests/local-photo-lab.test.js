import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {openLocalLab,MODE,OUTSIDE} from '../experiments/drive-file/local/runtime.mjs';
import {startLocalLab} from '../experiments/drive-file/local/server.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/photo-cards.json',import.meta.url),'utf8')).files;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const data=()=>mkdtempSync(join(tmpdir(),'senjie-local-photo-'));
const request=(fixture,n=1)=>({fixture,requestId:'local-fixture-request-'+n});

test('原圖、辨識結果與來源版本落盤；全部物件重建後仍可讀，重複正面不抹掉結果',()=>{
 const directory=data();let lab=openLocalLab(directory);
 try{
  const a=lab.preserve(request('front')),b=lab.preserve(request('back',2));lab.recognize(a.id);lab.recognize(b.id);lab.preserve(request('front-repeat',3));
  const before=lab.snapshot();assert.equal(before.receipts.length,3);assert.equal(before.originalCount,2);assert.equal(before.ocrDocumentCount,2);assert.equal(before.googleCalls,0);assert.equal(before.peopleCreated,0);
  const frontResult=lab.result(a.id);assert.match(frontResult.ocrText,/模擬 OCR/);assert.match(frontResult.ocrText,/0900000022/);
  lab.close();lab=openLocalLab(directory);
  assert.equal(lab.snapshot().sources.length,2);assert.equal(lab.snapshot().receipts.length,3);
  for(const [source,fixture] of [[a,fixtures[0]],[b,fixtures[1]]])assert.equal(hash(lab.original(source.id).bytes),fixture.sha256);
  assert.equal(lab.result(a.id).ocrText,frontResult.ocrText);assert.equal(lab.result(a.id).ocrSHA256,frontResult.ocrSHA256);
  assert.equal(lab.preserve(request('front')).replayed,true);assert.equal(lab.snapshot().receipts.length,3);
  assert.equal(lab.snapshot().originalCount,2);assert.equal(lab.snapshot().ocrDocumentCount,2);
 }finally{lab.close();rmSync(directory,{recursive:true});}
});
test('案外來源在fake API前拒絕；提供者404另列為模擬，不冒稱Google拒絕',()=>{
 const directory=data(),lab=openLocalLab(directory);try{
  for(const read of [()=>lab.original(OUTSIDE),()=>lab.result(OUTSIDE),()=>lab.recognize(OUTSIDE)]){const count=lab.calls.length;assert.throws(read,/不屬本案/);assert.equal(lab.calls.length,count);}
  assert.deepEqual(lab.simulateProviderDeny(),{mode:MODE,simulated:true,status:404,googleCalls:0});
 }finally{lab.close();rmSync(directory,{recursive:true});}
});
test('匯出中斷後重開可從已保存原圖續辦，OCR文件不多建',()=>{
 const directory=data();let lab=openLocalLab(directory);try{
  const a=lab.preserve(request('front'));lab.failExportOnce();assert.throws(()=>lab.recognize(a.id),/模擬匯出失敗/);
  assert.equal(hash(lab.original(a.id).bytes),fixtures[0].sha256);assert.throws(()=>lab.result(a.id),/尚無/);
  lab.close();lab=openLocalLab(directory);lab.recognize(a.id);assert.equal(lab.snapshot().originalCount,1);assert.equal(lab.snapshot().ocrDocumentCount,1);assert.match(lab.result(a.id).ocrText,/模擬 OCR/);
 }finally{lab.close();rmSync(directory,{recursive:true});}
});
test('保存後原圖或辨識文件被改動，重開讀回均拒絕',()=>{
 for(const target of ['original','ocr']){
  const directory=data();let lab=openLocalLab(directory);try{
   const a=lab.preserve(request('front'));lab.recognize(a.id);const filename=lab.filename;lab.close();
   const state=JSON.parse(readFileSync(filename,'utf8')),object=Object.values(state.objects).find(o=>o.meta.appProperties.senjieProbeRole===target);
   if(target==='original')object.bytesBase64=Buffer.from('changed').toString('base64');else object.ocrText='changed';
   writeFileSync(filename,JSON.stringify(state));lab=openLocalLab(directory);
   assert.throws(()=>target==='original'?lab.original(a.id):lab.result(a.id),/原圖已變更|辨識結果已變更/);
  }finally{lab.close();rmSync(directory,{recursive:true});}
 }
});
test('同一資料目錄不能被第二程序實例同時寫入；異常資料不被覆寫',()=>{
 const directory=data(),lab=openLocalLab(directory);try{assert.throws(()=>openLocalLab(directory),/已在使用/);}finally{lab.close();}
 writeFileSync(join(directory,'local-state.json'),'{}');assert.throws(()=>openLocalLab(directory),/結構不符/);assert.equal(readFileSync(join(directory,'local-state.json'),'utf8'),'{}');rmSync(directory,{recursive:true});
});
test('本機HTTP入口實際讀回PNG及模擬結果，拒絕案外與跨來源頁面',async()=>{
 const directory=data(),server=await startLocalLab({directory,port:0});
 try{
  const page=await (await fetch(server.url)).text();assert.match(page,/本機模擬/);assert.match(page,/沒有呼叫 Google/);
  assert.equal((await fetch(server.url,{headers:{'Sec-Fetch-Site':'cross-site'}})).status,200);
  const post=async(path,body)=>{const response=await fetch(server.url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();};
  const a=await post('/api/fixture',request('front'));await post('/api/recognize',{sourceId:a.id});
  const image=await fetch(server.url+a.originalHref);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(hash(Buffer.from(await image.arrayBuffer())),fixtures[0].sha256);
  const result=await (await fetch(server.url+a.resultHref)).json();assert.equal(result.mode,MODE);assert.equal(result.realOCR,false);assert.match(result.ocrText,/模擬 OCR/);
  assert.equal((await fetch(server.url+'/api/original/'+OUTSIDE)).status,403);
  assert.equal((await fetch(server.url+'/api/result/'+OUTSIDE)).status,403);
  assert.equal((await fetch(server.url+'/api/state',{headers:{Origin:'https://unrelated.example.invalid'}})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{const request=httpRequest(server.url+'/api/state',{headers:{Host:'unrelated.example.invalid'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.on('error',reject);request.end();});assert.equal(wrongHost,403);
  const state=await (await fetch(server.url+'/api/state')).json();assert.equal(state.googleCalls,0);assert.equal(state.peopleCreated,0);
 }finally{await server.close();rmSync(directory,{recursive:true});}
});
async function launch(directory){
 const child=spawn(process.execPath,[new URL('../experiments/drive-file/local/server.mjs',import.meta.url).pathname,'--data-dir',directory,'--port','0'],{stdio:['ignore','pipe','pipe']});
 let buffer='',errors='';child.stderr.on('data',b=>errors+=b);
 const info=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('本機子程序逾時：'+errors)),10000);child.stdout.on('data',b=>{buffer+=b;if(buffer.includes('\n')){clearTimeout(timeout);try{resolve(JSON.parse(buffer.split('\n')[0]));}catch(error){reject(error);}}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timeout);reject(new Error('本機子程序提前結束 '+code+': '+errors));});});
 let closed=false;return {info,async close(force=false){if(closed)return;closed=true;if(child.exitCode!==null)return;await new Promise((resolve,reject)=>{child.once('exit',(code,signal)=>(force?signal==='SIGKILL':code===0)?resolve():reject(new Error('子程序關閉失敗')));child.kill(force?'SIGKILL':'SIGTERM');});}};
}
test('兩個不同Node程序先後啟動：丟棄所有記憶體後，兩張原圖與結果仍完整',async()=>{
 const directory=data();let processServer=await launch(directory);try{
  for(const [i,fixture] of ['front','back','front-repeat'].entries()){
   const response=await fetch(processServer.info.url+'/api/fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request(fixture,i+1))});const source=await response.json();assert.equal(response.status,200);
   assert.equal((await fetch(processServer.info.url+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId:source.id})})).status,200);
  }
  const before=await (await fetch(processServer.info.url+'/api/state')).json();await processServer.close();processServer=await launch(directory);
  const after=await (await fetch(processServer.info.url+'/api/state')).json();assert.deepEqual(after.sources,before.sources);assert.equal(after.receipts.length,3);assert.equal(after.originalCount,2);assert.equal(after.ocrDocumentCount,2);
  for(const source of after.sources){const bytes=Buffer.from(await (await fetch(processServer.info.url+source.originalHref)).arrayBuffer());assert.equal(hash(bytes),source.hash);const result=await (await fetch(processServer.info.url+source.resultHref)).json();assert.equal(result.ocrSHA256,source.ocrSHA256);assert.match(result.ocrText,/模擬 OCR/);}
  assert.equal((await fetch(processServer.info.url+'/api/original/'+OUTSIDE)).status,403);
 }finally{await processServer.close();rmSync(directory,{recursive:true});}
});
test('已保存後程序被強制終止：重啟自動處理失效鎖，原圖與結果仍可讀',async()=>{
 const directory=data();let child=await launch(directory);try{
  const source=await (await fetch(child.info.url+'/api/fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request('front'))})).json();
  assert.equal((await fetch(child.info.url+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId:source.id})})).status,200);
  await child.close(true);child=await launch(directory);
  assert.equal(hash(Buffer.from(await (await fetch(child.info.url+source.originalHref)).arrayBuffer())),fixtures[0].sha256);
  const result=await (await fetch(child.info.url+source.resultHref)).json();assert.match(result.ocrText,/模擬 OCR/);assert.equal((await (await fetch(child.info.url+'/api/state')).json()).receipts.length,1);
 }finally{await child.close();rmSync(directory,{recursive:true});}
});
