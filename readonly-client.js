// Narrow website candidate. No Firebase SDK, token persistence or production wiring.
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const chars=(value,min,max)=>typeof value==='string'&&Array.from(value).length>=min&&Array.from(value).length<=max;
export function parseReadonlyRecord(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>32768)throw Error('DATA_INVALID');
  const body=JSON.parse(text);
  if(!exactKeys(body,['ok','result'])||body.ok!==true||!exactKeys(body.result,['record']))throw Error('DATA_INVALID');
  const r=body.result.record;
  if(!exactKeys(r,['record_id','question','answer','status','updated_at','is_mock'])||typeof r.record_id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(r.record_id)||!chars(r.question,1,2048)||!chars(r.answer,1,8192)||r.status!=='MOCK_READY'||r.is_mock!==true||typeof r.updated_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(r.updated_at))throw Error('DATA_INVALID');
  const date=new Date(r.updated_at);
  if(Number.isNaN(date.valueOf())||date.toISOString()!==r.updated_at.replace('Z','.000Z'))throw Error('DATA_INVALID');
  return {...r};
}

export function createReadonlyClient({endpoint,identity,fetch:send=globalThis.fetch,allowLocalhost=false}){
  const url=new URL(endpoint);
  if(url.pathname!=='/v1/me/record'||url.search||url.hash||url.username||url.password||!(url.protocol==='https:'||(allowLocalhost&&url.protocol==='http:'&&url.hostname==='127.0.0.1')))throw Error('INVALID_ENDPOINT');
  if(!identity?.prepareMemoryPersistence||!identity?.signInWithPopup||!identity?.signOut||typeof send!=='function')throw Error('INVALID_IDENTITY_PROVIDER');
  let ready=false,user=null,epoch=0;
  let state={ready:false,phase:'initializing',record:null,identity:null,message:'正在準備虛構登入…',httpStatus:null};
  const listeners=new Set();
  const emit=patch=>{state={...state,...patch};for(const fn of listeners)fn({...state,record:state.record?{...state.record}:null});};
  const clear=()=>{user=null;emit({record:null,identity:null,httpStatus:null});};
  async function load(attempt){
    emit({phase:'loading',record:null,message:'正在讀取…',httpStatus:null});
    let response;
    try{
      const token=await user.getIdToken();
      if(attempt!==epoch)return;
      if(typeof token!=='string'||!token||token.length>8192||/[\r\n]/.test(token))throw Error('INVALID_TOKEN');
      response=await send(url.href,{method:'GET',headers:{Authorization:'Bearer '+token},credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
    }catch{
      if(attempt===epoch)emit({record:null,phase:'unconfirmed',message:'連線結果未確認',httpStatus:null});
      return;
    }
    if(attempt!==epoch)return;
    if(response.status===401||response.status===403){
      ++epoch;clear();emit({phase:'denied',message:'拒絕存取',httpStatus:response.status});
      // Clear this app's provider memory, without treating sign-out as token revocation.
      try{await identity.signOut();}catch{}
      return;
    }
    if(response.status===404){emit({record:null,phase:'empty',message:'尚無資料',httpStatus:404});return;}
    if(response.status!==200){emit({record:null,phase:'unconfirmed',message:'暫時無法確認',httpStatus:response.status});return;}
    try{
      if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('NOT_JSON');
      const record=parseReadonlyRecord(await response.text());
      if(attempt===epoch)emit({record,phase:'loaded',message:'已讀取一筆虛構資料',httpStatus:200});
    }catch{
      if(attempt===epoch)emit({record:null,phase:'unconfirmed',message:'暫時無法確認',httpStatus:200});
    }
  }
  return {
    get state(){return {...state,record:state.record?{...state.record}:null};},
    subscribe(fn){listeners.add(fn);fn(this.state);return()=>listeners.delete(fn);},
    async initialize(){
      try{await identity.prepareMemoryPersistence();ready=true;emit({ready,phase:'signed-out',message:'尚未登入'});}
      catch{emit({ready:false,record:null,phase:'unconfirmed',message:'登入未完成'});}
    },
    async signIn(){
      if(!ready)return;
      const attempt=++epoch;clear();emit({phase:'signing-in',message:'請在虛構登入視窗選擇身分'});
      try{
        // Starts synchronously in the click event, before awaiting any network work.
        const pending=identity.signInWithPopup();
        const result=await pending;
        if(attempt!==epoch)return;
        if(typeof result?.user?.getIdToken!=='function')throw Error('NO_USER');
        user=result.user;emit({identity:chars(user.displayName,1,80)?user.displayName:'已登入'});
        await load(attempt);
      }catch{
        if(attempt===epoch){clear();emit({phase:'signed-out',message:'登入未完成'});}
      }
    },
    async readMyRecord(){
      const attempt=++epoch;
      emit({record:null,httpStatus:null});
      if(!user){emit({phase:'signed-out',message:'尚未登入'});return;}
      await load(attempt);
    },
    async signOut(){
      ++epoch;clear();emit({phase:'signed-out',message:'已登出'});
      try{await identity.signOut();}catch{}
    }
  };
}
