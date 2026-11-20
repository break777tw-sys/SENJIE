/** Private originals using Advanced Drive v3 and drive.file.
 * Never creates a folder, falls back to root, shares, deletes, or fetches URLs.
 * Binary integrity is checked against Drive's server-computed SHA-256 metadata.
 */
const PHOTO_FILE_FIELDS_='id,mimeType,parents,trashed,webViewLink,size,sha256Checksum';
function photoParent_(){
  const id=PropertiesService.getScriptProperties().getProperty('IMPORT_FOLDER_ID');
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{8,200}$/.test(id)||id==='root')throw new Error('尚未設定指定的私人原圖資料夾。');
  const folder=Drive.Files.get(id,{fields:'id,mimeType,trashed,capabilities(canAddChildren)'});
  if(folder.id!==id||folder.trashed||folder.mimeType!=='application/vnd.google-apps.folder'||folder.capabilities?.canAddChildren!==true)throw new Error('指定的私人原圖資料夾不可寫。');
  return id;
}
function checkPhotoFile_(file,source,parentId){
  if(!file||file.id!==source.originalId||file.trashed||file.mimeType!==source.mime||!file.parents?.includes(parentId)||file.sha256Checksum!==source.hash||Number(file.size)!==source.bytes)throw new Error('原圖位置、內容或大小與收件紀錄不符。');
  if(typeof file.webViewLink!=='string'||!/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view(?:\?[^#]*)?$/.test(file.webViewLink))throw new Error('原圖網址不符。');
  return file;
}
function preservePhoto_(blob,hash,mime){
  const parentId=photoParent_();
  const response=Drive.Files.list({q:"'"+parentId+"' in parents and trashed = false and appProperties has { key='senjieRole' and value='original' } and appProperties has { key='sourceSHA256' and value='"+hash+"' }",fields:'nextPageToken,files('+PHOTO_FILE_FIELDS_+')',pageSize:2});
  if(response.nextPageToken||(response.files||[]).length>1)throw new Error('同一原圖有多份來源，停止自動選取。');
  let file=response.files?.[0];
  if(!file)file=Drive.Files.create({name:hash+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime]),mimeType:mime,parents:[parentId],appProperties:{senjieRole:'original',sourceSHA256:hash}},blob,{fields:'id'});
  const actual=Drive.Files.get(file.id,{fields:PHOTO_FILE_FIELDS_});
  return checkPhotoFile_(actual,{originalId:file.id,hash,mime,bytes:blob.getBytes().length},parentId);
}
function verifyPhoto(request){return importLock_(user=>{
  // Registry and actor must match before a caller-supplied ID reaches Drive.
  const source=sources_(importSheet_(user)).find(s=>s.id===request?.sourceId&&s.actor===user.email);
  if(!source)throw new Error('來源不存在或無權存取。');
  const file=verifySourcePhoto_(source);
  return {sourceId:source.id,originalId:file.id,url:file.webViewLink,sha256:file.sha256Checksum,bytes:Number(file.size),mime:file.mimeType};
});}
function verifySourcePhoto_(source){
  const parentId=photoParent_();
  return checkPhotoFile_(Drive.Files.get(source.originalId,{fields:PHOTO_FILE_FIELDS_}),source,parentId);
}
function photoReadiness(){
  authorize_();
  // Visible in the original editor's execution log; no private IDs or tokens.
  const report=value=>{console.log(JSON.stringify({photoReadiness:value}));return value;};
  const scope='https://www.googleapis.com/auth/drive.file';
  try{
    const info=ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL,[scope]);
    if(info.getAuthorizationStatus()!==ScriptApp.AuthorizationStatus.NOT_REQUIRED)return report({ready:false,code:'PHOTO_PERMISSION_REQUIRED'});
  }catch(error){return report({ready:false,code:'PHOTO_PERMISSION_REQUIRED'});}
  try{photoParent_();}catch(error){return report({ready:false,code:'PHOTO_FOLDER_REQUIRED'});}
  return report({ready:true,enabled:PropertiesService.getScriptProperties().getProperty('PHOTO_IMPORTS_ENABLED')==='true',ocrEnabled:PropertiesService.getScriptProperties().getProperty('PHOTO_OCR_ENABLED')==='true'});
}
