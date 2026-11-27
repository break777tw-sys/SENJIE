// Fake provider for the isolated acceptance page only. No OAuth or SDK loaded.
export function createDemoIdentity(win){
  let popup=null,cancelPending=null;
  return {
    async prepareMemoryPersistence(){},
    signInWithPopup(){
      if(cancelPending)cancelPending();
      popup=win.open(new URL('demo-signin.html',win.location.href).href,'senjie-readonly-demo','popup,width=520,height=520');
      if(!popup)throw Error('POPUP_BLOCKED');
      return new Promise((resolve,reject)=>{
        const source=popup;
        const cleanup=()=>{win.removeEventListener('message',receive);win.clearInterval(timer);cancelPending=null;popup=null;};
        const cancel=()=>{cleanup();try{source.close();}catch{}reject(Error('LOGIN_CANCELLED'));};
        const receive=event=>{
          if(event.origin!==win.location.origin||event.source!==source||event.data?.type!=='SENJIE_DEMO_IDENTITY'||!['A','B','CANCEL'].includes(event.data.identity))return;
          const identity=event.data.identity;
          if(identity==='CANCEL'){cancel();return;}
          cleanup();try{source.close();}catch{}
          resolve({user:{displayName:'虛構 '+identity,getIdToken:async()=>`DEMO_${identity}_NOT_A_CREDENTIAL`}});
        };
        const timer=win.setInterval(()=>{if(source.closed)cancel();},250);
        cancelPending=cancel;win.addEventListener('message',receive);
      });
    },
    async signOut(){if(cancelPending)cancelPending();else if(popup)popup.close();}
  };
}
