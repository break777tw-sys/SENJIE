/** Offline-reviewed experiment. NOT assembled into the website or cloud editor.
 * Requires only Advanced Drive v3 + drive.file. No DriveApp, DocumentApp,
 * tokens, sharing, deletion, arbitrary URL fetch, or My Drive/root fallback.
 * registry must be persisted by the future authenticated integration; the
 * in-memory registry used by local tests proves no cloud durability or OAuth.
 */
function createScopedPhotoStore_(files,utilities,parentId,registry){
  if(typeof parentId!=='string'||!/^[A-Za-z0-9_-]{8,200}$/.test(parentId)||parentId==='root')throw new Error('需要精確的本案資料夾，不使用根目錄。');
  const hash=bytes=>utilities.computeDigest(utilities.DigestAlgorithm.SHA_256,bytes).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  function parent(){
    let p;
    try{p=files.get(parentId,{fields:'id,mimeType,trashed,capabilities(canAddChildren)'});}
    catch(error){throw new Error('需要同一應用程式的資料夾授權；不擴大權限或改存根目錄。');}
    if(p.id!==parentId||p.mimeType!=='application/vnd.google-apps.folder'||p.trashed||p.capabilities?.canAddChildren!==true)throw new Error('本案資料夾不可寫，停止。');
  }
  function find(role,digest){
    const response=files.list({q:"'"+parentId+"' in parents and trashed = false and appProperties has { key='senjieProbeRole' and value='"+role+"' } and appProperties has { key='sourceSHA256' and value='"+digest+"' }",fields:'files(id,mimeType,parents,trashed,webViewLink)',pageSize:2});
    if(response.files?.length>1)throw new Error('本案來源重複，停止自動選取。');
    return response.files?.[0]||null;
  }
  function checkMetadata(meta,mime){
    if(!meta?.id||meta.trashed||meta.mimeType!==mime||!meta.parents?.includes(parentId)||typeof meta.webViewLink!=='string'||!/^https:\/\/(?:drive|docs)\.google\.com\//.test(meta.webViewLink))throw new Error('檔案來源／位置不符，停止。');
  }
  function preserve(bytes,mime){
    if(!Array.isArray(bytes)||bytes.length<8||bytes.length>2*1024*1024||!['image/png','image/jpeg'].includes(mime))throw new Error('此最小驗證只接受2 MB內PNG／JPEG。');
    const u=i=>(bytes[i]+256)%256;
    if(mime==='image/png'?![137,80,78,71,13,10,26,10].every((b,i)=>u(i)===b):!(u(0)===255&&u(1)===216&&u(2)===255))throw new Error('圖片內容不符。');
    parent();const digest=hash(bytes);
    let meta=find('original',digest);
    if(!meta)meta=files.create({name:digest+(mime==='image/png'?'.png':'.jpg'),mimeType:mime,parents:[parentId],appProperties:{senjieProbeRole:'original',sourceSHA256:digest}},utilities.newBlob(bytes,mime,'original'),{fields:'id,mimeType,parents,trashed,webViewLink'});
    checkMetadata(meta,mime);
    const actual=files.get(meta.id,{alt:'media'});
    if(typeof actual?.getBytes!=='function'||hash(actual.getBytes())!==digest)throw new Error('原圖位元組讀回不符。');
    const source={id:meta.id,parentId,hash:digest,mime,url:meta.webViewLink};
    registry.save(source.id,source);return source;
  }
  function recognize(sourceId){
    const source=registry.get(sourceId);
    // No metadata/API request for a caller-supplied ID outside this project registry.
    if(!source||source.id!==sourceId||source.parentId!==parentId)throw new Error('來源不屬本案，拒絕讀取。');
    parent();
    const meta=files.get(sourceId,{fields:'id,mimeType,parents,trashed,webViewLink'});checkMetadata(meta,source.mime);
    const blob=files.get(sourceId,{alt:'media'});
    if(typeof blob?.getBytes!=='function'||hash(blob.getBytes())!==source.hash)throw new Error('原圖已變更，停止辨識。');
    let doc=find('ocr',source.hash);
    if(!doc)doc=files.create({name:source.hash+'-OCR',mimeType:'application/vnd.google-apps.document',parents:[parentId],appProperties:{senjieProbeRole:'ocr',sourceSHA256:source.hash}},blob,{ocrLanguage:'zh',fields:'id,mimeType,parents,trashed,webViewLink'});
    checkMetadata(doc,'application/vnd.google-apps.document');
    // API supports drive.file; actual Apps Script media-return binding remains unverified.
    const exported=files.export(doc.id,'text/plain',{alt:'media'});
    if(typeof exported?.getDataAsString!=='function')throw new Error('Google匯出回應尚未驗證為文字Blob，停止而不猜測。');
    const text=exported.getDataAsString('UTF-8');
    if(typeof text!=='string'||text.length>16000)throw new Error('辨識文字格式或長度不符。');
    const result={...source,ocrId:doc.id,ocrUrl:doc.webViewLink,ocrText:text};registry.save(sourceId,result);return result;
  }
  return {preserve,recognize};
}
