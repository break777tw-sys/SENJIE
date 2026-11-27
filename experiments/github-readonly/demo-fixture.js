// Browser-local mock: does not contact any server or prove backend authorization.
export const demoRecord={record_id:'DEMO_EVENT_001',question:'將虛構資訊「週五九點、藍色雨衣」改寫成一句提醒。',answer:'週五九點，記得帶藍色雨衣。',status:'MOCK_READY',updated_at:'2026-11-25T01:00:00Z',is_mock:true};
export function createDemoFixture(onCall=()=>{}){
  let scenario='normal';const calls=[];
  return {
    setScenario(value){scenario=value;},
    get calls(){return calls.map(c=>({...c}));},
    async fetch(endpoint,options){
      const url=new URL(endpoint),token=options.headers.Authorization;
      let status=200,body={ok:true,result:{record:{...demoRecord}}};
      if(url.pathname!=='/v1/me/record'||url.search||options.method!=='GET'||options.body!==undefined){status=400;body={ok:false,error:{code:'INVALID_REQUEST'}};}
      else if(scenario==='network'){calls.push({method:options.method,path:url.pathname,status:'未確認',authorizationPresent:!!token});onCall(calls);throw Error('DEMO_NETWORK_UNKNOWN');}
      else if(scenario!=='normal'&&scenario!=='malformed'){status=Number(scenario);body={ok:false,error:{code:({401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'RECORD_NOT_FOUND',503:'DATA_UNAVAILABLE'})[status]}};}
      else if(!token){status=401;body={ok:false,error:{code:'UNAUTHENTICATED'}};}
      else if(token!=='Bearer DEMO_A_NOT_A_CREDENTIAL'){status=403;body={ok:false,error:{code:'FORBIDDEN'}};}
      else if(scenario==='malformed')body.result.record.is_mock=false;
      calls.push({method:options.method,path:url.pathname,status,authorizationPresent:!!token});onCall(calls);
      return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
    }
  };
}
