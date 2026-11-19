/** Private photo inbox. No Contacts, sharing changes, deletes or paid OCR APIs.
 * Enable Advanced Drive v3. Configure IMPORT_FOLDER_ID to an existing private folder.
 * Each original is content addressed; Imports is an append-only source revision log.
 */
const IMPORT_HEADERS_=['來源編號','版本','資料JSON'];
function importSheet_(user){
  const book=SpreadsheetApp.openById(user.spreadsheetId);
  let sheet=book.getSheetByName('Imports');
  if(!sheet){sheet=book.insertSheet('Imports');sheet.getRange(1,1,1,3).setValues([IMPORT_HEADERS_]);sheet.setFrozenRows(1);}
  if(JSON.stringify(sheet.getRange(1,1,1,3).getValues()[0])!==JSON.stringify(IMPORT_HEADERS_))throw new Error('匯入紀錄結構不符。');
  return sheet;
}
function sources_(sheet){
  if(sheet.getLastRow()>10001)throw new Error('匯入紀錄超過讀取上限，未截斷資料。');
  const latest={};
  if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,3).getValues().forEach(row=>{
    const s=JSON.parse(row[2]);
    if(s.id!==row[0]||s.version!==Number(row[1]))throw new Error('來源版本不一致。');
    if(!latest[s.id]||latest[s.id].version<s.version)latest[s.id]=s;
  });
  return Object.values(latest);
}
function appendSource_(sheet,source){
  const next={...source,version:(source.version||0)+1,updatedAt:new Date().toISOString()};
  const json=JSON.stringify(next);
  if(json.length>45000)throw new Error('來源紀錄過長，停止寫入。');
  const row=sheet.getLastRow()+1;sheet.getRange(row,1,1,3).setValues([[next.id,next.version,json]]);SpreadsheetApp.flush();
  if(sheet.getRange(row,3).getValue()!==json)throw new Error('來源未通過讀回，請重試。');
  return next;
}
function importLock_(action){
  const user=authorize_(),lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))throw new Error('匯入處理中，請稍後重試。');
  try{return action(user);}finally{lock.releaseLock();}
}
function importFolder_(){
  const id=PropertiesService.getScriptProperties().getProperty('IMPORT_FOLDER_ID');
  if(!id)throw new Error('尚未設定私人原圖資料夾 IMPORT_FOLDER_ID。');
  return DriveApp.getFolderById(id);
}
function hashBytes_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function imageBlob_(data,mime,name){
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||typeof data!=='string'||data.length>14000000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw new Error('圖片格式或大小不符。');
  const bytes=Utilities.base64Decode(data),u=i=>(bytes[i]+256)%256;
  const valid=mime==='image/jpeg'?u(0)===255&&u(1)===216&&u(2)===255:mime==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>u(i)===b):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!valid||bytes.length>10*1024*1024)throw new Error('圖片內容或大小不符（原圖上限 10 MB）。');
  return Utilities.newBlob(bytes,mime,name);
}
function listImports(){return importLock_(user=>({sources:sources_(importSheet_(user)).filter(s=>s.actor===user.email)}));}
function uploadPhoto(request){return importLock_(user=>{
  if(!request||!/^[A-Za-z0-9-]{16,100}$/.test(request.requestId)||!/^[A-Za-z0-9-]{16,100}$/.test(request.batchId)||typeof request.name!=='string'||request.name.length>180)throw new Error('上傳操作／批次編號或檔名不符。');
  const blob=imageBlob_(request.data,request.mime,'original'),hash=hashBytes_(blob.getBytes());
  const sheet=importSheet_(user),all=sources_(sheet),prior=all.find(s=>s.receipts.some(r=>r.requestId===request.requestId));
  if(prior){if(prior.actor!==user.email||prior.hash!==hash||prior.mime!==request.mime||!prior.receipts.some(r=>r.requestId===request.requestId&&r.name===request.name&&r.batchId===request.batchId))throw new Error('上傳操作編號已用於不同內容。');return {source:prior,replayed:true};}
  let source=all.find(s=>s.hash===hash&&s.actor===user.email);
  if(!source){
    const folder=importFolder_(),filename=hash+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[request.mime]);
    const matches=folder.getFilesByName(filename);let file=matches.hasNext()?matches.next():folder.createFile(blob.setName(filename));
    if(matches.hasNext()||hashBytes_(file.getBlob().getBytes())!==hash)throw new Error('原圖存檔不一致，請檢查。');
    source={id:'SRC-'+Utilities.getUuid(),hash,mime:request.mime,bytes:blob.getBytes().length,actor:user.email,originalId:file.getId(),originalUrl:file.getUrl(),receipts:[],state:'saved',ocrText:'',candidates:{},qrStatus:'未解碼',createdAt:new Date().toISOString()};
  }
  if(source.receipts.length>=100)throw new Error('同圖收件次數超過上限。');
  source={...source,receipts:[...source.receipts,{requestId:request.requestId,batchId:request.batchId,name:request.name,at:new Date().toISOString()}]};
  return {source:appendSource_(sheet,source),replayed:false};
});}
// Deliberately conservative extraction. All values remain unconfirmed candidates.
function extractCandidates_(text){
  const result={},lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const labels={name:/^(?:姓名|Name)\s*[:：]\s*(.+)$/i,company:/^(?:公司|團體|Company)\s*[:：]\s*(.+)$/i,role:/^(?:職稱|Title)\s*[:：]\s*(.+)$/i,address:/^(?:地址|Address)\s*[:：]\s*(.+)$/i};
  Object.keys(labels).forEach(key=>{const found=lines.map(line=>line.match(labels[key])?.[1]).filter(Boolean);if(found.length===1)result[key]=found[0];});
  const emails=[...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])];if(emails.length===1)result.email=emails[0];
  const phones=[...new Set(lines.filter(l=>/^(?:電話|手機|Tel|Mobile)\s*[:：]/i.test(l)).map(l=>l.replace(/^[^:：]+[:：]\s*/,'')))];if(phones.length===1)result.phone=phones[0];
  return result;
}
function recognizePhoto(request){return importLock_(user=>{
  const sheet=importSheet_(user),source=sources_(sheet).find(s=>s.id===request?.sourceId&&s.actor===user.email);
  if(!source)throw new Error('來源不存在或無權存取。');
  if(source.state==='ready'||source.state==='archived')return {source};
  try{
    let blob=DriveApp.getFileById(source.originalId).getBlob();
    // WebP is preserved unchanged, but requires a derivative for Drive OCR.
    if(source.mime==='image/webp')throw new Error('WebP 原圖已保存；請另上傳 JPG／PNG 供辨識，再一起確認。');
    if(source.bytes>2*1024*1024)throw new Error('原圖已保存；Google OCR 此流程限制 2 MB，請另上傳較小 JPG／PNG 供辨識。');
    const folder=importFolder_(),name=source.hash+'-OCR',matches=folder.getFilesByName(name);
    let docId=source.ocrDocumentId||(matches.hasNext()?matches.next().getId():null);
    if(!docId)docId=Drive.Files.create({name,mimeType:'application/vnd.google-apps.document',parents:[folder.getId()]},blob,{ocrLanguage:'zh',fields:'id'}).id;
    const saved=appendSource_(sheet,{...source,ocrDocumentId:docId,state:'recognizing',error:''});
    const text=DocumentApp.openById(docId).getBody().getText();
    if(text.length>16000)throw new Error('辨識文字超過上限，請拆分照片。');
    return {source:appendSource_(sheet,{...saved,ocrText:text,candidates:extractCandidates_(text),state:'ready',recognizedAt:new Date().toISOString(),error:''})};
  }catch(error){
    const current=sources_(sheet).find(s=>s.id===source.id);
    return {source:appendSource_(sheet,{...current,state:'error',error:String(error.message||error).slice(0,500)})};
  }
});}
function archivePhotos(request){return importLock_(user=>{
  if(!request||request.confirmed!==true||!Array.isArray(request.sources)||request.sources.length<1||request.sources.length>10||new Set(request.sources.map(s=>s.id)).size!==request.sources.length)throw new Error('請確認同一張實體名片、同一人物與全部來源。');
  const clean=validateCard_(request.card);
  if(clean.status!=='已確認'||!Array.isArray(request.reviewedFields)||Object.keys(clean).some(k=>clean[k]&&!request.reviewedFields.includes(k)))throw new Error('請逐欄核對非空白內容後確認。');
  if(request.sources.some(s=>!['正面','反面','補充'].includes(s.side)))throw new Error('請指定照片面別。');
  const sheet=importSheet_(user),all=sources_(sheet),selected=request.sources.map(s=>all.find(x=>x.id===s.id&&x.actor===user.email));
  if(selected.some(s=>!s))throw new Error('來源不存在或無權存取。');
  const existing=readRevisions_(records_(user)).find(r=>r.requestId===request.requestId&&r.actor===user.email);
  if(selected.some(s=>s.state==='archived'&&s.archiveRequestId!==request.requestId))throw new Error('來源已歸檔；請從原人物修改，不重複建檔。');
  const signature=JSON.stringify(request.sources.slice().sort((a,b)=>a.id.localeCompare(b.id)));
  if(existing&&existing.record.provenance?.signature!==signature)throw new Error('歸檔操作編號已用於其他來源。');
  const now=new Date().toISOString(),physicalCardId=existing?.record.provenance?.physicalCardId||'CARD-'+Utilities.getUuid();
  const fields={};Object.keys(clean).forEach(k=>{fields[k]={value:clean[k],status:clean[k]?'使用者確認':'未提供',confirmedBy:clean[k]?user.email:null,confirmedAt:clean[k]?now:null,sourceIds:selected.map(s=>s.id),method:clean[k]?'使用者對照原圖或補充脈絡確認':'留白，未猜測',ocrCandidates:selected.map(s=>({sourceId:s.id,value:s.candidates[k]||''}))};});
  const provenance={physicalCardId,signature,sources:selected.map((s,i)=>({id:s.id,side:request.sources[i].side,originalId:s.originalId,originalUrl:s.originalUrl,sha256:s.hash,recognizedAt:s.recognizedAt||null})),fields,confirmedAt:now,confirmedBy:user.email};
  // Card append first; retry reuses its requestId after a partial source-log failure.
  const result=saveCardLocked_({requestId:request.requestId,card:clean},user,provenance);
  selected.forEach(s=>{if(s.state!=='archived')appendSource_(sheet,{...s,state:'archived',personId:result.record.id,physicalCardId,archiveRequestId:request.requestId,confirmedAt:now});});
  return {...result,physicalCardId,sourceCount:selected.length};
});}
