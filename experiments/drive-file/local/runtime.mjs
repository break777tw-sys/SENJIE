// Persistent LOCAL fake Drive. No Google calls, credentials or image recognition.
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,fsyncSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';

export const MODE='LOCAL_SIMULATION_NO_GOOGLE';
export const PARENT='LOCAL-SENJIE-PROJECT';
export const OUTSIDE='LOCAL-UNSELECTED-CONTROL';
const engine=readFileSync(new URL('../ScopedPhotoStore.gs',import.meta.url),'utf8');
const fixtureFile=JSON.parse(readFileSync(new URL('../../../tests/fixtures/photo-cards.json',import.meta.url),'utf8'));
const fixtures=fixtureFile.files.map((f,i)=>({...f,key:i?'back':'front',bytes:Buffer.from(f.base64,'base64')}));
const digest=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');
for(const f of fixtures)if(digest(f.bytes)!==f.sha256)throw new Error('公開虛構照片hash不符；停止。');
const clone=value=>JSON.parse(JSON.stringify(value));
const blob=bytes=>({getBytes:()=>Array.from(bytes),getDataAsString:()=>Buffer.from(bytes).toString('utf8')});
export function openLocalLab(directory){
 if(!directory)throw new Error('請指定本機工作資料目錄。');
 directory=resolve(directory);mkdirSync(directory,{recursive:true,mode:0o700});
 const filename=join(directory,'local-state.json'),lockfile=join(directory,'local.lock');
 function claim(){
  try{return openSync(lockfile,'wx',0o600);}catch(error){
   if(error.code!=='EEXIST')throw error;
   const prior=JSON.parse(readFileSync(lockfile,'utf8'));if(!Number.isInteger(prior.pid)||prior.pid<1)throw new Error('鎖紀錄異常，保留資料並停止。');
   try{process.kill(prior.pid,0);}catch(probe){if(probe.code==='ESRCH'){unlinkSync(lockfile);return openSync(lockfile,'wx',0o600);}throw probe;}
   throw new Error('此測試目錄已在使用；不啟動第二個寫入程序。');
  }
 }
 const lock=claim();writeFileSync(lock,JSON.stringify({pid:process.pid,mode:MODE}));
 let state,closed=false,failNextExport=false;
 function persist(next){
  const temporary=join(directory,'.state-'+process.pid+'-'+randomUUID()+'.tmp');let fd;
  try{fd=openSync(temporary,'wx',0o600);writeFileSync(fd,JSON.stringify(next,null,2)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temporary,filename);const parent=openSync(directory,'r');try{fsyncSync(parent);}finally{closeSync(parent);}}
  finally{if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary);}
 }
 function change(fn){if(closed)throw new Error('測試程序已關閉。');const next=clone(state);fn(next);persist(next);state=next;}
 function event(next,type,details){next.events.push({sequence:next.events.length+1,at:new Date().toISOString(),type,...details});}
 try{
  state=existsSync(filename)?JSON.parse(readFileSync(filename,'utf8')):{schemaVersion:1,mode:MODE,parentId:PARENT,objects:{},sources:{},revisions:[],receipts:[],events:[]};
  if(state.schemaVersion!==1||state.mode!==MODE||state.parentId!==PARENT||!state.objects||!state.sources||!Array.isArray(state.receipts)||!Array.isArray(state.revisions)||!Array.isArray(state.events))throw new Error('本機測試資料結構不符，停止而不覆寫。');
  if(!existsSync(filename))persist(state);
 }catch(error){closeSync(lock);unlinkSync(lockfile);throw error;}
 const calls=[];
 const files={
  get(id,options={}){
   calls.push({method:'get',id,media:options.alt==='media'});
   if(id===PARENT)return {id,mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}};
   const object=Object.hasOwn(state.objects,id)?state.objects[id]:null;
   if(!object){const error=new Error('模擬提供者拒絕：檔案未授權或不存在。');error.status=404;throw error;}
   if(options.alt==='media')return blob(Buffer.from(object.bytesBase64,'base64'));
   return clone(object.meta);
  },
  list(options){
   calls.push({method:'list'});
   const match=options.q?.match(/^'LOCAL-SENJIE-PROJECT' in parents and trashed = false and appProperties has \{ key='senjieProbeRole' and value='(original|ocr)' \} and appProperties has \{ key='sourceSHA256' and value='([a-f0-9]{64})' \}$/);
   if(!match)throw new Error('拒絕本案資料夾以外的模擬查詢。');
   return {files:Object.values(state.objects).map(o=>o.meta).filter(m=>m.parents.length===1&&m.parents[0]===PARENT&&m.appProperties.senjieProbeRole===match[1]&&m.appProperties.sourceSHA256===match[2]).slice(0,2).map(clone)};
  },
  create(meta,data){
   calls.push({method:'create'});
   if(meta.parents?.length!==1||meta.parents[0]!==PARENT||!['original','ocr'].includes(meta.appProperties?.senjieProbeRole))throw new Error('拒絕模擬檔案位置。');
   const bytes=Buffer.from(data.getBytes()),fixture=fixtures.find(f=>f.sha256===digest(bytes));
   if(!fixture||meta.appProperties.sourceSHA256!==fixture.sha256)throw new Error('只接受固定公開虛構照片，不接受真實名片。');
   const id='LOCAL-'+randomUUID(),metadata={...clone(meta),id,trashed:false,webViewLink:'https://drive.google.com/file/d/'+id+'/view'};
   const ocrText=meta.appProperties.senjieProbeRole==='ocr'?'【模擬 OCR；這不是圖像辨識結果】\n'+(fixture.key==='front'?'Name: Fictional Person 20261119\nCompany: Example Invalid\nTitle: Test Coordinator\nTel: 0900000022\ncard20261119@example.invalid':'Name: Fictional Person 20261119\nCompany: Example Invalid\nAddress: 1 Fictional Test Road'):null;
   change(next=>{next.objects[id]={meta:metadata,bytesBase64:bytes.toString('base64'),ocrText};event(next,'fake-file-created',{id,role:meta.appProperties.senjieProbeRole,sourceSHA256:fixture.sha256});});
   return clone(metadata);
  },
  export(id,mime,options){
   calls.push({method:'export',id});
   if(failNextExport){failNextExport=false;throw new Error('已注入的模擬匯出失敗；原圖仍保留。');}
   const object=Object.hasOwn(state.objects,id)?state.objects[id]:null;
   if(!object||object.meta.appProperties.senjieProbeRole!=='ocr'||mime!=='text/plain'||options.alt!=='media')throw new Error('模擬辨識文件不存在或格式不符。');
   return blob(Buffer.from(object.ocrText,'utf8'));
  }
 };
 const registry={
  get:id=>Object.hasOwn(state.sources,id)?clone(state.sources[id]):null,
  save(id,source){change(next=>{const revision=(next.sources[id]?.revision||0)+1;next.sources[id]={...clone(source),revision};next.revisions.push({id,revision,at:new Date().toISOString(),source:clone(source)});event(next,'source-revision-saved',{id,revision,hasResult:Boolean(source.ocrSHA256)});});}
 };
 const utilities={DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,bytes)=>Array.from(createHash('sha256').update(Buffer.from(bytes)).digest()),newBlob:bytes=>blob(Buffer.from(bytes))};
 const context=vm.createContext({Error,Array,String,Set});vm.runInContext(engine,context);
 const store=context.createScopedPhotoStore_(files,utilities,PARENT,registry);
 function publicSource(source){return {id:source.id,hash:source.hash,mime:source.mime,revision:source.revision,ocrId:source.ocrId||null,ocrSHA256:source.ocrSHA256||null,originalHref:'/api/original/'+encodeURIComponent(source.id),resultHref:'/api/result/'+encodeURIComponent(source.id)};}
 return {
  calls,filename,
  snapshot(){return {schemaVersion:1,mode:MODE,receipts:clone(state.receipts),sources:Object.values(state.sources).map(publicSource),originalCount:Object.values(state.objects).filter(o=>o.meta.appProperties.senjieProbeRole==='original').length,ocrDocumentCount:Object.values(state.objects).filter(o=>o.meta.appProperties.senjieProbeRole==='ocr').length,revisionCount:state.revisions.length,eventCount:state.events.length,googleCalls:0,realOCR:false,peopleCreated:0};},
  preserve({requestId,fixture:key}){
   if(typeof requestId!=='string'||!/^[A-Za-z0-9-]{16,100}$/.test(requestId)||!['front','back','front-repeat'].includes(key))throw new Error('虛構照片或操作編號不符。');
   const previous=state.receipts.find(r=>r.requestId===requestId);
   if(previous){if(previous.fixture!==key)throw new Error('操作編號已用於其他虛構照片。');return {...publicSource(registry.get(previous.sourceId)),replayed:true};}
   if(state.receipts.length>=100)throw new Error('本機驗證上限100次收件，未截斷資料。');
   const fixture=fixtures.find(f=>f.key===(key==='front-repeat'?'front':key));
   const source=store.preserve(Array.from(fixture.bytes),fixture.mime);
   change(next=>{next.receipts.push({requestId,fixture:key,sourceId:source.id,at:new Date().toISOString()});event(next,'fixture-received',{requestId,sourceId:source.id});});
   return {...publicSource(registry.get(source.id)),replayed:false};
  },
  recognize(id){store.recognize(id);return publicSource(registry.get(id));},
  original(id){const result=store.readOriginal(id);return {bytes:Buffer.from(result.bytes),mime:result.source.mime,sha256:result.source.hash};},
  result(id){const source=store.readResult(id);return {...publicSource(source),ocrText:source.ocrText,mode:MODE,realOCR:false};},
  simulateProviderDeny(){try{files.get(OUTSIDE,{fields:'id'});}catch(error){return {mode:MODE,simulated:true,status:error.status,googleCalls:0};}throw new Error('模擬對照檔意外可讀。');},
  failExportOnce(){failNextExport=true;},
  close(){if(!closed){closed=true;closeSync(lock);unlinkSync(lockfile);}}
 };
}
