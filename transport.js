// Google authorizes every operation; the public site only starts sign-in.
import { createSignInTransport } from './popup-transport.js';
export function createTransport(bridge = globalThis.google?.script?.run) {
  if (!bridge) return globalThis.document?.documentElement?.dataset.runtime==='connected'?createSignInTransport():null;
  const call=(method,payload)=>new Promise((resolve,reject)=>{
    bridge.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error?.message||'Google 服務未回應')))[method](payload);
  });
  return {kind:'apps-script',conversations:()=>call('listConversations'),savePreference:request=>call('saveDemoPreference',request),list:()=>call('listCards'),save:request=>call('saveCard',request),imports:()=>call('listImports'),upload:request=>call('uploadPhoto',request),recognize:(sourceId,image)=>call('recognizePhoto',{sourceId,...image}),archive:request=>call('archivePhotos',request),resume:requestId=>call('resumePhotoArchive',{requestId}),original:sourceId=>call('verifyPhoto',{sourceId})};
}
