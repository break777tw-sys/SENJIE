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
  if(request.method==='session')return {authenticated:true,email:user.email,capabilities:{photoImport:photos}};
  const methods={listCards,saveCard,listImports,uploadPhoto,recognizePhoto,archivePhotos,resumePhotoArchive};
  if(!Object.prototype.hasOwnProperty.call(methods,request.method))throw new Error('拒絕未開放的操作。');
  if(['uploadPhoto','recognizePhoto','archivePhotos','resumePhotoArchive'].includes(request.method)&&!photos)throw new Error('照片建檔尚未開放；目前可先使用手動建檔與查詢。');
  return methods[request.method](request.payload);
}
