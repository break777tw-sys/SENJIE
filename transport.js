// No URL, API key or personal data is embedded in the public frontend.
import { createPopupTransport } from './popup-transport.js';
export function createTransport(bridge = globalThis.google?.script?.run) {
  if (!bridge) return globalThis.document?.documentElement?.dataset.runtime==='connected'?createPopupTransport():null;
  const call=(method,payload)=>new Promise((resolve,reject)=>{
    bridge.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error?.message||'Google 服務未回應')))[method](payload);
  });
  return {kind:'apps-script',list:()=>call('listCards'),save:request=>call('saveCard',request),imports:()=>call('listImports'),upload:request=>call('uploadPhoto',request),recognize:sourceId=>call('recognizePhoto',{sourceId}),archive:request=>call('archivePhotos',request),resume:requestId=>call('resumePhotoArchive',{requestId})};
}
