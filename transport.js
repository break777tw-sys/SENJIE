// No URL, API key or personal data is embedded in the public frontend.
export function createTransport(bridge = globalThis.google?.script?.run) {
  if (!bridge) return null;
  const call=(method,payload)=>new Promise((resolve,reject)=>{
    bridge.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error?.message||'Google 服務未回應')))[method](payload);
  });
  return {list:()=>call('listCards'),save:request=>call('saveCard',request)};
}
