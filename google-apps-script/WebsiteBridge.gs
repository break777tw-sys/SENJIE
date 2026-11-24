/** Same owner-private Google application, not an anonymous HTTP API.
 * Keep USER_ACCESSING/MYSELF and authorize_ on every server operation.
 * No tokens, secrets, arbitrary callbacks, sharing changes or external fetch.
 */
function websiteBridge_(parameters){
  const origin=String(parameters.origin||''),channel=String(parameters.channel||'');
  const allowed=['https://break777tw-sys.github.io','http://127.0.0.1:8791'];
  if(!allowed.includes(origin)||!/^[a-f0-9]{32}$/.test(channel))throw new Error('拒絕未確認的網站來源。');
  const page=HtmlService.createTemplateFromFile('WebsiteBridge');
  page.config=JSON.stringify({origin,channel}).replace(/</g,'\\u003c');
  return page.evaluate().setTitle('SENJIE Google 安全連線');
}
function websiteBridgeCall(request){
  const user=authorize_();
  if(!request||typeof request.method!=='string')throw new Error('操作格式不符。');
  const photos=PropertiesService.getScriptProperties().getProperty('PHOTO_IMPORTS_ENABLED')==='true';
  if(request.method==='session')return {authenticated:true,email:user.email,capabilities:{photoImport:photos,photoOCR:PropertiesService.getScriptProperties().getProperty('PHOTO_OCR_ENABLED')==='true'}};
  const methods={listConversations,saveDemoPreference,listCards,saveCard,listImports,uploadPhoto,recognizePhoto,archivePhotos,resumePhotoArchive,verifyPhoto,photoReadiness};
  if(!Object.prototype.hasOwnProperty.call(methods,request.method))throw new Error('拒絕未開放的操作。');
  if(['uploadPhoto','recognizePhoto','archivePhotos','resumePhotoArchive','verifyPhoto'].includes(request.method)&&!photos)throw new Error('照片建檔尚未開放；目前可先使用手動建檔與查詢。');
  return methods[request.method](request.payload);
}

function authorizePhotoAccess(){authorize_();ScriptApp.requireScopes(ScriptApp.AuthMode.FULL,['https://www.googleapis.com/auth/drive.file']);return photoReadiness();}
function inspectPhotoDestination(){authorize_();photoParent_();console.log('PHOTO_FOLDER_READY');}
function disablePhotoInbox(){authorize_();PropertiesService.getScriptProperties().setProperty('PHOTO_IMPORTS_ENABLED','false');console.log('PHOTO_UPLOADS_DISABLED');}
// Owner setup only. The empty app-created folder must be moved into the existing
// collection before activatePhotoInbox can enable uploads. Never uploads to root.
function preparePhotoInbox(){return importLock_(user=>{
  const props=PropertiesService.getScriptProperties(),collection=props.getProperty('PHOTO_COLLECTION_FOLDER_ID')||props.getProperty('IMPORT_FOLDER_ID');
  if(typeof collection!=='string'||!/^[A-Za-z0-9_-]{8,200}$/.test(collection)||collection==='root')throw new Error('Missing dedicated collection folder');
  const found=Drive.Files.list({q:"trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='senjieRole' and value='photo-inbox' } and appProperties has { key='senjieCollection' and value='"+collection+"' }",fields:'nextPageToken,files(id,name,parents)',pageSize:2});
  if(found.nextPageToken||(found.files||[]).length>1)throw new Error('Multiple setup folders; stop');
  const folder=found.files?.[0]||Drive.Files.create({name:'名片網站收件',mimeType:'application/vnd.google-apps.folder',appProperties:{senjieRole:'photo-inbox',senjieCollection:collection}},null,{fields:'id,name,parents'});
  props.setProperty('PHOTO_COLLECTION_FOLDER_ID',collection);props.setProperty('PHOTO_SETUP_FOLDER_ID',folder.id);
  console.log(JSON.stringify({photoInboxSetup:{folder,collection,active:false}}));return {folder,collection};
});}
function activatePhotoInbox(){return importLock_(user=>{
  const props=PropertiesService.getScriptProperties(),collection=props.getProperty('PHOTO_COLLECTION_FOLDER_ID'),id=props.getProperty('PHOTO_SETUP_FOLDER_ID');
  if(!collection||!id||collection==='root'||id==='root'||collection===id)throw new Error('Missing verified photo setup');
  const folder=Drive.Files.get(id,{fields:'id,mimeType,parents,trashed,capabilities(canAddChildren),appProperties'});
  if(folder.trashed||folder.mimeType!=='application/vnd.google-apps.folder'||!folder.parents?.includes(collection)||folder.capabilities?.canAddChildren!==true||folder.appProperties?.senjieRole!=='photo-inbox'||folder.appProperties?.senjieCollection!==collection)throw new Error('Photo inbox must be inside the dedicated collection');
  props.setProperty('IMPORT_FOLDER_ID',id);props.setProperty('PHOTO_IMPORTS_ENABLED','true');
  console.log(JSON.stringify({photoInboxActive:{folderId:id,collection,ready:true}}));return photoReadiness();
});}
