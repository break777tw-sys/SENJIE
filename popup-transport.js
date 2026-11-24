// Same-page Google sign-in. No popup, session token or browser activation.
import { GOOGLE_SIGN_IN_URL } from './site-config.js';
export function createSignInTransport(env=globalThis.window) {
  if(env.location.hash.startsWith('#connect=')){
    env.history.replaceState(null,'',env.location.pathname+env.location.search+'#home');
  }
  const denied=()=>Promise.reject(new Error('請先使用 Google 登入。'));
  return {
    kind:'redirect',session:null,
    onConnectionChange(listener){listener({connected:false,session:null});},
    login(){
      env.location.assign(GOOGLE_SIGN_IN_URL);
      // Navigation replaces this page. Never report a local authenticated session.
      return new Promise(()=>{});
    },
    list:denied,save:denied,imports:denied,upload:denied,recognize:denied,
    archive:denied,resume:denied,original:denied,
  };
}
