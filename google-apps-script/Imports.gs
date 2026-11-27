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
function hashBytes_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function imageBlob_(data,mime,name){
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||typeof data!=='string'||data.length>14000000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw new Error('圖片格式或大小不符。');
  const bytes=Utilities.base64Decode(data),u=i=>(bytes[i]+256)%256;
  const valid=mime==='image/jpeg'?u(0)===255&&u(1)===216&&u(2)===255:mime==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>u(i)===b):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!valid||bytes.length>10*1024*1024)throw new Error('圖片內容或大小不符（原圖上限 10 MB）。');
  return Utilities.newBlob(bytes,mime,name);
}
// The committed Records revision is the durable receipt, even if no Imports row
// was marked archived. Never depend on browser memory to recover its requestId.
function photoArchiveRevisions_(revisions,user){
  return revisions.filter(r=>r.actor===user.email&&r.record.version===1&&r.record.provenance?.physicalCardId&&Array.isArray(r.record.provenance.sources));
}
function archiveSourcePlan_(revision,all,user){
  const p=revision.record.provenance;
  if(revision.actor!==user.email||p.confirmedBy!==user.email||!p.sources.length||p.sources.length>10||new Set(p.sources.map(s=>s.id)).size!==p.sources.length)throw new Error('歸檔回條不完整，停止續辦。');
  return p.sources.map(saved=>{
    const source=all.find(s=>s.id===saved.id&&s.actor===user.email);
    if(!source||source.hash!==saved.sha256||source.originalId!==saved.originalId)throw new Error('來源不存在或原圖與歸檔回條不符，停止續辦。');
    if(source.state==='archived'&&(source.archiveRequestId!==revision.requestId||source.personId!==revision.record.id||source.physicalCardId!==p.physicalCardId))throw new Error('來源已連到不同歸檔，停止續辦。');
    return source;
  });
}
function pendingPhotoArchives_(revisions,all,user){
  return photoArchiveRevisions_(revisions,user).flatMap(r=>{
    let selected,blockedReason='';
    try{selected=archiveSourcePlan_(r,all,user);}catch(error){blockedReason=error.message;}
    const pending=selected?selected.filter(s=>s.state!=='archived').map(s=>s.id):r.record.provenance.sources.map(s=>s.id);
    if(!pending.length&&!blockedReason)return [];
    return [{requestId:r.requestId,personId:r.record.id,personName:r.record.name,physicalCardId:r.record.provenance.physicalCardId,sources:r.record.provenance.sources,pendingSourceIds:pending,blockedReason}];
  });
}
function finishPhotoArchive_(sheet,all,revision,user){
  // Validate every side before writing any side. A partial failure can be retried
  // from this same immutable Records receipt without adding another person row.
  const selected=archiveSourcePlan_(revision,all,user),p=revision.record.provenance;
  selected.forEach(s=>{if(s.state!=='archived')appendSource_(sheet,{...s,state:'archived',personId:revision.record.id,physicalCardId:p.physicalCardId,archiveRequestId:revision.requestId,confirmedAt:p.confirmedAt});});
  return selected.length;
}
function listImports(){return importLock_(user=>{
  const all=sources_(importSheet_(user)),revisions=readRevisions_(records_(user));
  return {sources:all.filter(s=>s.actor===user.email),recoveries:pendingPhotoArchives_(revisions,all,user)};
});}
function resumePhotoArchive(request){return importLock_(user=>{
  if(!request||typeof request.requestId!=='string'||!/^[A-Za-z0-9-]{16,100}$/.test(request.requestId))throw new Error('缺少有效的續辦操作編號。');
  const revisions=readRevisions_(records_(user));
  const revision=photoArchiveRevisions_(revisions,user).find(r=>r.requestId===request.requestId);
  if(!revision)throw new Error('找不到此身分已確認的人物歸檔回條。');
  const sheet=importSheet_(user),sourceCount=finishPhotoArchive_(sheet,sources_(sheet),revision,user);
  // A person may have been edited since the failed archive; do not downgrade it.
  const record=latest_(revisions).find(r=>r.id===revision.record.id);
  return {record,physicalCardId:revision.record.provenance.physicalCardId,sourceCount,replayed:true};
});}
function uploadPhoto(request){return importLock_(user=>{
  if(!request||!/^[A-Za-z0-9-]{16,100}$/.test(request.requestId)||!/^[A-Za-z0-9-]{16,100}$/.test(request.batchId)||typeof request.name!=='string'||request.name.length>180)throw new Error('上傳操作／批次編號或檔名不符。');
  const blob=imageBlob_(request.data,request.mime,'original'),hash=hashBytes_(blob.getBytes());
  const sheet=importSheet_(user),all=sources_(sheet),prior=all.find(s=>s.receipts.some(r=>r.requestId===request.requestId));
  if(prior){if(prior.actor!==user.email||prior.hash!==hash||prior.mime!==request.mime||!prior.receipts.some(r=>r.requestId===request.requestId&&r.name===request.name&&r.batchId===request.batchId))throw new Error('上傳操作編號已用於不同內容。');verifySourcePhoto_(prior);return {source:prior,replayed:true};}
  let source=all.find(s=>s.hash===hash&&s.actor===user.email);
  if(source)verifySourcePhoto_(source);
  if(!source){
    const file=preservePhoto_(blob,hash,request.mime);
    source={id:'SRC-'+Utilities.getUuid(),hash,mime:request.mime,bytes:blob.getBytes().length,actor:user.email,originalId:file.id,originalUrl:file.webViewLink,receipts:[],state:'saved',ocrText:'',candidates:{},qrStatus:'未解碼',createdAt:new Date().toISOString()};
  }
  if(source.receipts.length>=100)throw new Error('同圖收件次數超過上限。');
  source={...source,receipts:[...source.receipts,{requestId:request.requestId,batchId:request.batchId,name:request.name,at:new Date().toISOString()}]};
  return {source:appendSource_(sheet,source),replayed:false};
});}
// Deliberately conservative extraction. All values remain unconfirmed candidates.
function extractCandidates_(text){
  const result={},lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const labels={name:/^(?:姓名|Name)\s*[:：]\s*(.+)$/i,company:/^(?:公司|團體|Company)\s*[:：]\s*(.+)$/i,role:/^(?:職稱|Title)\s*[:：]\s*(.+)$/i,address:/^(?:地址|Address)\s*[:：]\s*(.+)$/i};
  Object.keys(labels).forEach(key=>{const found=[...new Set(lines.map(line=>line.match(labels[key])?.[1]).filter(Boolean))];if(found.length===1)result[key]=found[0];});
  const emails=[...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])];if(emails.length===1)result.email=emails[0];
  const phones=[...new Set(lines.filter(l=>/^(?:電話|手機|Tel|Mobile)\s*[:：]/i.test(l)).map(l=>l.replace(/^[^:：]+[:：]\s*/,'')))];if(phones.length===1)result.phone=phones[0];
  return result;
}
function recognizePhoto(request){return importLock_(user=>{
  const sheet=importSheet_(user),source=sources_(sheet).find(s=>s.id===request?.sourceId&&s.actor===user.email);
  if(!source)throw new Error('來源不存在或無權存取。');
  if(PropertiesService.getScriptProperties().getProperty('PHOTO_OCR_ENABLED')!=='true')return {source,manualReview:true};
  if(source.state==='ready'||source.state==='archived')return {source};
  try{
    verifySourcePhoto_(source);
    // WebP is preserved unchanged, but requires a derivative for Drive OCR.
    if(source.mime==='image/webp')throw new Error('WebP 原圖已保存；請另上傳 JPG／PNG 供辨識，再一起確認。');
    if(source.bytes>2*1024*1024)throw new Error('原圖已保存；Google OCR 此流程限制 2 MB，請另上傳較小 JPG／PNG 供辨識。');
    const parent=photoParent_();let docId=source.ocrDocumentId;
    if(!docId){
      const found=Drive.Files.list({q:"'"+parent+"' in parents and trashed = false and appProperties has { key='senjieRole' and value='ocr' } and appProperties has { key='sourceSHA256' and value='"+source.hash+"' }",fields:'nextPageToken,files(id)',pageSize:2});
      if(found.nextPageToken||(found.files||[]).length>1)throw new Error('辨識來源不唯一，請檢查收件紀錄。');
      docId=found.files?.[0]?.id;
      if(!docId){
        if(typeof request.data!=='string')throw new Error('請重新上傳同一原圖以重試辨識；已保存的原圖不會重複建立。');
        const blob=imageBlob_(request.data,request.mime,'ocr-input');
        if(request.mime!==source.mime||blob.getBytes().length!==source.bytes||hashBytes_(blob.getBytes())!==source.hash)throw new Error('辨識圖片與已保存原圖不符。');
        docId=Drive.Files.create({name:source.hash+'-OCR',mimeType:'application/vnd.google-apps.document',parents:[parent],appProperties:{senjieRole:'ocr',sourceSHA256:source.hash}},blob,{fields:'id'}).id;
      }
    }
    const saved=appendSource_(sheet,{...source,ocrDocumentId:docId,state:'recognizing',error:''});
    const document=Docs.Documents.get(docId,{includeTabsContent:true});
    const text=ocrDocumentText_(document);
    if(text.length>16000)throw new Error('辨識文字超過上限，請拆分照片。');
    return {source:appendSource_(sheet,{...saved,ocrText:text,candidates:extractCandidates_(text),state:'ready',recognizedAt:new Date().toISOString(),error:''})};
  }catch(error){
    const current=sources_(sheet).find(s=>s.id===source.id);
    return {source:appendSource_(sheet,{...current,state:'error',error:String(error.message||error).slice(0,500)})};
  }
});}
function ocrDocumentText_(document){
  let text='';
  const content=items=>{for(const item of items||[]){
    for(const element of item.paragraph?.elements||[])text+=element.textRun?.content||'';
    for(const row of item.table?.tableRows||[])for(const cell of row.tableCells||[])content(cell.content);
    if(text.length>16000)throw new Error('辨識文字超過上限，請拆分照片。');
  }};
  const tabs=items=>{for(const tab of items||[]){content(tab.documentTab?.body?.content);tabs(tab.childTabs);}};
  if(document.tabs?.length)tabs(document.tabs);else content(document.body?.content);
  if(!text.trim())throw new Error('未辨識到文字，請對照原圖手動確認或換清晰照片。');
  return text;
}
function archivePhotos(request){return importLock_(user=>{
  if(!request||request.confirmed!==true||!Array.isArray(request.sources)||request.sources.length<1||request.sources.length>10||new Set(request.sources.map(s=>s.id)).size!==request.sources.length)throw new Error('請確認同一張實體名片、同一人物與全部來源。');
  const clean=validateCard_(request.card);
  if(clean.status!=='已確認'||!Array.isArray(request.reviewedFields)||Object.keys(clean).some(k=>clean[k]&&!request.reviewedFields.includes(k)))throw new Error('請逐欄核對非空白內容後確認。');
  if(request.sources.some(s=>!['正面','反面','正反面同圖','補充'].includes(s.side)))throw new Error('請指定照片面別。');
  const sheet=importSheet_(user),all=sources_(sheet),selected=request.sources.map(s=>all.find(x=>x.id===s.id&&x.actor===user.email));
  if(selected.some(s=>!s))throw new Error('來源不存在或無權存取。');
  const revisions=readRevisions_(records_(user)),existing=revisions.find(r=>r.requestId===request.requestId&&r.actor===user.email);
  if(selected.some(s=>s.state==='archived'&&s.archiveRequestId!==request.requestId))throw new Error('來源已歸檔；請從原人物修改，不重複建檔。');
  if(photoArchiveRevisions_(revisions,user).some(r=>r.requestId!==request.requestId&&r.record.provenance.sources.some(saved=>selected.some(s=>s.id===saved.id))))throw new Error('人物已保存；請從收件匣「續辦來源歸檔」補齊原紀錄，不重新建人。');
  const signature=JSON.stringify(request.sources.slice().sort((a,b)=>a.id.localeCompare(b.id)));
  if(existing&&existing.record.provenance?.signature!==signature)throw new Error('歸檔操作編號已用於其他來源。');
  const now=new Date().toISOString(),physicalCardId=existing?.record.provenance?.physicalCardId||'CARD-'+Utilities.getUuid();
  const fields={};Object.keys(clean).forEach(k=>{fields[k]={value:clean[k],status:clean[k]?'使用者確認':'未提供',confirmedBy:clean[k]?user.email:null,confirmedAt:clean[k]?now:null,sourceIds:selected.map(s=>s.id),method:clean[k]?'使用者對照原圖或補充脈絡確認':'留白，未猜測',ocrCandidates:selected.map(s=>({sourceId:s.id,value:s.candidates[k]||''}))};});
  const provenance={physicalCardId,signature,sources:selected.map((s,i)=>({id:s.id,side:request.sources[i].side,originalId:s.originalId,originalUrl:s.originalUrl,sha256:s.hash,recognizedAt:s.recognizedAt||null})),fields,confirmedAt:now,confirmedBy:user.email};
  // Card append first; retry reuses its requestId after a partial source-log failure.
  const result=saveCardLocked_({requestId:request.requestId,card:clean},user,provenance);
  finishPhotoArchive_(sheet,all,{requestId:request.requestId,actor:user.email,record:result.record},user);
  return {...result,physicalCardId,sourceCount:selected.length};
});}
