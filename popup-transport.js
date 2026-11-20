// Uses the existing owner-private Apps Script sign-in; no OAuth token is copied
// to this page. The private endpoint is installed from a user-only URL fragment.
export function createPopupTransport(env=globalThis.window) {
  const key='senjie.private-endpoint.v1',pending=new Map();
  let popup=null,peer=null,peerOrigin='',channel='',session=null,listener=()=>{},opening=null,closedTimer=null;
  const endpoint=value=>{
    const url=new URL(value);
    if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)$/.test(url.pathname)||url.search||url.hash)throw new Error('登入連結格式不符。');
    if(url.pathname.endsWith('/dev')&&!['127.0.0.1','localhost'].includes(env.location.hostname))throw new Error('測試入口僅供本機驗收。');
    return url.href;
  };
  if(env.location.hash.startsWith('#connect=')){
    try{env.localStorage.setItem(key,endpoint(decodeURIComponent(env.location.hash.slice(9))));}
    catch{} // Login reports missing/invalid setup without retaining the fragment.
    env.history.replaceState(null,'',env.location.pathname+env.location.search+'#home');
  }
  const notify=()=>listener({connected:!!session,session});
  function disconnect(message='已登出網站。'){
    session=null;peer=null;peerOrigin='';
    for(const item of pending.values()){env.clearTimeout(item.timer);item.reject(new Error(message));}pending.clear();
    if(opening){env.clearTimeout(opening.timer);opening.reject(new Error(message));opening=null;}
    if(closedTimer!==null){env.clearInterval(closedTimer);closedTimer=null;}
    notify();
  }
  function call(method,payload){
    if(!peer||!popup||popup.closed)return Promise.reject(new Error('請先登入網站。'));
    const id=env.crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=env.setTimeout(()=>{pending.delete(id);reject(new Error('Google 回應逾時，請重新讀取確認結果。'));},90000);
      pending.set(id,{resolve,reject,timer});
      peer.postMessage({type:'senjie-call',channel,id,method,payload},peerOrigin);
    });
  }
  env.addEventListener('message',async event=>{
    const message=event.data;
    if(!message||message.channel!==channel||!popup)return;
    // Bind both the actual window tree we opened and Google's observed origin.
    // A different Google-hosted page or same-origin sibling cannot impersonate it.
    let belongs=false;try{belongs=event.source?.top===popup;}catch{}
    if(!belongs||!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin))return;
    if(message.type==='senjie-ready'&&opening&&!peer){
      peer=event.source;peerOrigin=event.origin;
      try{
        const identity=await call('session');
        if(identity?.authenticated!==true)throw new Error('Google 身分未通過。');
        session=identity;
        const done=opening;opening=null;if(done){env.clearTimeout(done.timer);done.resolve(identity);}
        notify();
      }catch(error){disconnect(error.message);}
      return;
    }
    if(event.source!==peer||event.origin!==peerOrigin||message.type!=='senjie-result')return;
    const item=pending.get(message.id);if(!item)return;
    pending.delete(message.id);env.clearTimeout(item.timer);
    if(message.ok)item.resolve(message.result);
    else{
      const error=message.error||'Google 拒絕這次操作。';item.reject(new Error(error));
      if(error.includes('拒絕存取'))disconnect(error);
    }
  });
  env.addEventListener('pagehide',()=>{const old=popup;disconnect();popup=null;channel='';if(old&&!old.closed)old.close();});
  return {
    kind:'popup',get session(){return session;},
    onConnectionChange(fn){listener=fn;notify();},
    login(){
      if(session&&popup&&!popup.closed)return Promise.resolve(session);
      if(opening)return Promise.reject(new Error('請完成已開啟的 Google 登入視窗。'));
      let configured;
      try{configured=endpoint(env.localStorage.getItem(key)||'');}
      catch{return Promise.reject(new Error('請先使用你的專用啟用連結，設定這個瀏覽器的登入入口。'));}
      channel=Array.from(env.crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      const url=new URL(configured);url.searchParams.set('senjieBridge','1');url.searchParams.set('origin',env.location.origin);url.searchParams.set('channel',channel);
      popup=env.open(url.href,'senjie-private-connection-'+channel,'popup,width=700,height=700');
      if(!popup)return Promise.reject(new Error('請允許這個網站開啟 Google 登入視窗。'));
      closedTimer=env.setInterval(()=>{if(popup?.closed)disconnect('Google 連線視窗已關閉，請重新登入。');},1000);
      return new Promise((resolve,reject)=>{
        const timer=env.setTimeout(()=>disconnect('登入尚未完成，請重新登入。'),180000);
        opening={resolve,reject,timer};
      });
    },
    logout(){const old=popup;disconnect();popup=null;channel='';if(old&&!old.closed)old.close();},
    list:()=>call('listCards'),save:request=>call('saveCard',request),
    imports:()=>call('listImports'),upload:request=>call('uploadPhoto',request),
    recognize:sourceId=>call('recognizePhoto',{sourceId}),archive:request=>call('archivePhotos',request),
    resume:requestId=>call('resumePhotoArchive',{requestId}),
    original:sourceId=>call('verifyPhoto',{sourceId}),
  };
}
