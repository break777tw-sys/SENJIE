// Google authorizes every operation; the public site only starts sign-in.
import { createSignInTransport } from './popup-transport.js';
export function createTransport(bridge = globalThis.google?.script?.run) {
  if (!bridge) return globalThis.document?.documentElement?.dataset.runtime==='connected'?createSignInTransport():null;
  const accessDeniedListeners=new Set();let accessEpoch=0;
  const call=(method,payload)=>new Promise((resolve,reject)=>{
    const epoch=accessEpoch;
    const stale=()=>reject(new Error('存取狀態已更新，請重新讀取。'));
    bridge.withSuccessHandler(result=>{if(epoch!==accessEpoch){stale();return;}resolve(result);}).withFailureHandler(failure=>{
      if(epoch!==accessEpoch){stale();return;}
      const error=new Error(failure?.message||'Google 服務未回應');
      if(/拒絕存取(?:[:：]|$)/.test(error.message)){
        accessEpoch++;
        try{for(const listener of accessDeniedListeners)listener();}finally{reject(error);}
      }else reject(error);
    })[method](payload);
  });
  return {kind:'apps-script',onAccessDenied(listener){accessDeniedListeners.add(listener);return ()=>accessDeniedListeners.delete(listener);},conversations:()=>call('listConversations'),savePreference:request=>call('saveDemoPreference',request),list:()=>call('listCards'),save:request=>call('saveCard',request),imports:()=>call('listImports'),upload:request=>call('uploadPhoto',request),recognize:(sourceId,image)=>call('recognizePhoto',{sourceId,...image}),archive:request=>call('archivePhotos',request),resume:requestId=>call('resumePhotoArchive',{requestId}),original:sourceId=>call('verifyPhoto',{sourceId})};
}
