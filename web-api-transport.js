// GitHub-hosted UI adapter. A qualified identity provider and authenticated API
// endpoint must be supplied explicitly; this does not expose the Google web app.
const methods={list:'listCards',save:'saveCard',imports:'listImports',upload:'uploadPhoto',recognize:'recognizePhoto',archive:'archivePhotos',resume:'resumePhotoArchive',original:'verifyPhoto',conversations:'listConversations',savePreference:'saveDemoPreference'};
export function createWebApiTransport({endpoint,identity,fetch:send=globalThis.fetch,allowLocalhost=false}){
  const url=new URL(endpoint);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(allowLocalhost&&url.protocol==='http:'&&url.hostname==='127.0.0.1')))throw new Error('網站 API 必須使用已確認的 HTTPS 網址。');
  if(!identity?.login||!identity?.logout||typeof send!=='function')throw new Error('尚未接妥網站身分驗證。');
  let credential=null,session=null,epoch=0;
  const connections=new Set(),denials=new Set();
  const changed=()=>{for(const listener of connections)listener({connected:!!session,session});};
  function clear(){epoch++;credential=null;session=null;changed();}
  async function request(method,payload,token,requestEpoch){
    let response;
    try{response=await send(url.href,{method:'POST',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({method,payload})});}
    catch{if(requestEpoch!==epoch)throw new Error('存取狀態已更新，請重新讀取。');throw new Error('網站服務未回應，尚未確認保存；請用同一操作重試。');}
    if(requestEpoch!==epoch)throw new Error('存取狀態已更新，請重新讀取。');
    if(response.status===401||response.status===403){clear();for(const listener of denials)listener();throw new Error('拒絕存取：請重新登入。');}
    if(!response.ok)throw new Error('網站服務未完成操作（'+response.status+'），請保留原操作重試。');
    let body;
    try{body=await response.json();}catch{throw new Error('網站服務回應格式不符。');}
    if(requestEpoch!==epoch)throw new Error('存取狀態已更新，請重新讀取。');
    if(body?.ok!==true)throw new Error(typeof body?.error?.message==='string'?body.error.message:'網站服務未確認操作結果。');
    return body.result;
  }
  const transport={
    kind:'web-api',get session(){return session;},
    onConnectionChange(listener){connections.add(listener);listener({connected:!!session,session});return ()=>connections.delete(listener);},
    onAccessDenied(listener){denials.add(listener);return ()=>denials.delete(listener);},
    async login(){
      const attempt=++epoch;credential=null;session=null;changed();
      const result=await identity.login();
      if(attempt!==epoch)throw new Error('登入已取消。');
      if(typeof result?.accessToken!=='string'||!result.accessToken||/[\r\n]/.test(result.accessToken))throw new Error('未取得網站登入憑證。');
      const verified=await request('session',undefined,result.accessToken,attempt);
      if(verified?.authenticated!==true||typeof verified.email!=='string'||!verified.email)throw new Error('網站尚未確認登入身分。');
      credential=result.accessToken;session={email:verified.email,capabilities:verified.capabilities||{}};changed();return session;
    },
    logout(){clear();return identity.logout();},
  };
  for(const [name,method] of Object.entries(methods))transport[name]=payload=>{
    if(!credential||!session)return Promise.reject(new Error('請先使用 Google 登入。'));
    return request(method,payload,credential,epoch);
  };
  transport.recognize=(sourceId,image)=>{
    if(!credential||!session)return Promise.reject(new Error('請先使用 Google 登入。'));
    return request('recognizePhoto',{sourceId,...image},credential,epoch);
  };
  transport.resume=requestId=>{
    if(!credential||!session)return Promise.reject(new Error('請先使用 Google 登入。'));
    return request('resumePhotoArchive',{requestId},credential,epoch);
  };
  transport.original=sourceId=>{
    if(!credential||!session)return Promise.reject(new Error('請先使用 Google 登入。'));
    return request('verifyPhoto',{sourceId},credential,epoch);
  };
  return transport;
}
