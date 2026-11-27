import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadonlyClient,parseReadonlyRecord} from '../readonly-client.js';
import {createDemoFixture,demoRecord} from '../experiments/github-readonly/demo-fixture.js';
import {createDemoIdentity} from '../experiments/github-readonly/demo-identity.js';
const ok=record=>new Response(JSON.stringify({ok:true,result:{record}}),{headers:{'Content-Type':'application/json;charset=utf-8'}});
function harness(fetch){
  let next='A',calls=0,signouts=0,prepared=false;
  const fixture=createDemoFixture();
  const identity={async prepareMemoryPersistence(){prepared=true;},signInWithPopup(){calls++;if(next==='CANCEL'||next==='BLOCKED')throw Error(next);return Promise.resolve({user:{displayName:'虛構 '+next,getIdToken:async()=>`DEMO_${next}_NOT_A_CREDENTIAL`}});},async signOut(){signouts++;}};
  const client=createReadonlyClient({endpoint:'https://website-api.example.invalid/v1/me/record',identity,fetch:fetch||fixture.fetch});
  return {client,fixture,identity,choose:value=>{next=value;},calls:()=>calls,signouts:()=>signouts,prepared:()=>prepared};
}
test('初始化前不啟動 popup；登入 click 同步呼叫 provider，且 A 只讀一筆',async()=>{
  const h=harness();await h.client.signIn();assert.equal(h.calls(),0);assert.equal(h.client.state.ready,false);
  await h.client.initialize();assert.equal(h.prepared(),true);const pending=h.client.signIn();assert.equal(h.calls(),1);await pending;
  assert.deepEqual(h.client.state.record,demoRecord);assert.equal(h.fixture.calls.length,1);assert.equal(h.client.state.httpStatus,200);
});
test('真本機 HTTP fixture 收到精確 GET、只有 Bearer header、無 query/body；token 不是 URL',async t=>{
  const calls=[];const server=createServer(async(req,res)=>{
    let body='';for await(const part of req)body+=part;calls.push({method:req.method,url:req.url,authorization:req.headers.authorization,contentType:req.headers['content-type'],body});
    res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,result:{record:demoRecord}}));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const h=harness();const client=createReadonlyClient({endpoint:`http://127.0.0.1:${server.address().port}/v1/me/record`,allowLocalhost:true,identity:h.identity});await client.initialize();await client.signIn();
  assert.deepEqual(calls,[{method:'GET',url:'/v1/me/record',authorization:'Bearer DEMO_A_NOT_A_CREDENTIAL',contentType:undefined,body:''}]);assert.equal(client.state.record.record_id,demoRecord.record_id);
});
test('未登入讀取拒絕且不發資料請求',async()=>{
  const h=harness();await h.client.initialize();await h.client.readMyRecord();assert.equal(h.client.state.record,null);assert.equal(h.client.state.message,'尚未登入');assert.equal(h.fixture.calls.length,0);
});
for(const choice of ['CANCEL','BLOCKED'])test(`A 成功後 ${choice} 清除舊資料且不呼資料 API`,async()=>{
  const h=harness();await h.client.initialize();await h.client.signIn();assert.ok(h.client.state.record);h.choose(choice);
  await h.client.signIn();assert.equal(h.client.state.record,null);assert.equal(h.client.state.identity,null);assert.equal(h.client.state.message,'登入未完成');assert.equal(h.fixture.calls.length,1);
});
test('A 成功後改 B，403 不顯示前次資料且清除 provider 記憶體',async()=>{
  const h=harness();await h.client.initialize();await h.client.signIn();h.choose('B');await h.client.signIn();assert.equal(h.client.state.httpStatus,403);assert.equal(h.client.state.phase,'denied');assert.equal(h.client.state.record,null);assert.equal(h.client.state.identity,null);assert.equal(h.signouts(),1);
  await h.client.readMyRecord();assert.equal(h.fixture.calls.length,2);assert.equal(h.client.state.record,null);
});
for(const scenario of ['401','403','404','503','malformed','network'])test(`成功後 ${scenario} 清除舊資料，沒有自動重試`,async()=>{
  const h=harness();await h.client.initialize();await h.client.signIn();h.fixture.setScenario(scenario);await h.client.readMyRecord();assert.equal(h.client.state.record,null);assert.equal(h.fixture.calls.length,2);
  if(['401','403'].includes(scenario))assert.equal(h.client.state.identity,null);
  if(scenario==='404')assert.equal(h.client.state.message,'尚無資料');
  if(scenario==='network')assert.equal(h.client.state.message,'連線結果未確認');
});
test('網路/CORS未知不能偽稱收到 403 body；任意 HTML 不顯示服務端原文',async()=>{
  let mode='ok';const h=harness(async()=>{if(mode==='network')throw Error('SDK secret detail');if(mode==='html')return new Response('<script>secret</script>');return ok(demoRecord);});await h.client.initialize();await h.client.signIn();mode='network';await h.client.readMyRecord();assert.equal(h.client.state.httpStatus,null);assert.equal(h.client.state.message,'連線結果未確認');mode='html';await h.client.readMyRecord();assert.equal(h.client.state.record,null);assert.equal(h.client.state.message,'暫時無法確認');
});
test('登出後到達的成功回應不能重新顯示資料',async()=>{
  let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;}));await h.client.initialize();const login=h.client.signIn();await new Promise(resolve=>setImmediate(resolve));await h.client.signOut();finish(ok(demoRecord));await login;assert.equal(h.client.state.record,null);assert.equal(h.client.state.identity,null);assert.equal(h.client.state.message,'已登出');
});
test('舊登入完成不能覆蓋新取消；同一身分晚到讀取不能覆蓋新的拒絕',async()=>{
  let old;const h=harness();await h.client.initialize();h.identity.signInWithPopup=()=>new Promise(resolve=>{old=resolve;});const pending=h.client.signIn();h.identity.signInWithPopup=()=>{throw Error('CANCEL');};await h.client.signIn();old({user:{displayName:'OLD',getIdToken:async()=>'DEMO_A_NOT_A_CREDENTIAL'}});await pending;assert.equal(h.fixture.calls.length,0);assert.equal(h.client.state.record,null);
  let resolveSlow,mode='ok';const j=harness(async()=>mode==='slow'?new Promise(resolve=>{resolveSlow=resolve;}):mode==='deny'?new Response('{}',{status:403}):ok(demoRecord));await j.client.initialize();await j.client.signIn();mode='slow';const slow=j.client.readMyRecord();await new Promise(resolve=>setImmediate(resolve));mode='deny';await j.client.readMyRecord();resolveSlow(ok(demoRecord));await slow;assert.equal(j.client.state.record,null);assert.equal(j.client.state.httpStatus,403);
});
test('新建頁面狀態不繼承前次登入或資料',async()=>{
  const h=harness();await h.client.initialize();await h.client.signIn();const next=harness();await next.client.initialize();assert.equal(next.client.state.record,null);assert.equal(next.client.state.identity,null);assert.equal(next.fixture.calls.length,0);
});
test('六欄與封閉物件嚴格驗證；拒絕真資料標誌、超界、非法日期及 extra',()=>{
  const encode=record=>JSON.stringify({ok:true,result:{record}});assert.deepEqual(parseReadonlyRecord(encode(demoRecord)),demoRecord);
  for(const record of [{...demoRecord,is_mock:false},{...demoRecord,owner_uid:'FORBIDDEN'},{...demoRecord,record_id:'a/b'},{...demoRecord,updated_at:'2026-02-30T01:00:00Z'},{...demoRecord,question:''},{...demoRecord,answer:null},{...demoRecord,question:'字'.repeat(2049)}])assert.throws(()=>parseReadonlyRecord(encode(record)));
  assert.throws(()=>parseReadonlyRecord(JSON.stringify({ok:true,result:{record:demoRecord},extra:1})));assert.throws(()=>parseReadonlyRecord(' '.repeat(32769)));assert.throws(()=>parseReadonlyRecord('not json'));
  assert.equal(parseReadonlyRecord(encode({...demoRecord,question:'😀'.repeat(2048)})).question.length,4096);
});
test('不接受任意 path／query／HTTP 遠端或 URL 憑證',()=>{
  const identity=harness().identity;
  for(const endpoint of ['https://api.example.invalid/v1/me/record?uid=B','https://api.example.invalid/v1/me/record#token','https://api.example.invalid/v1/me/other','https://u:p@api.example.invalid/v1/me/record','http://api.example.invalid/v1/me/record'])assert.throws(()=>createReadonlyClient({endpoint,identity}));
});
test('虛構 popup 僅接受同來源同視窗回覆，取消及關窗會清理',async()=>{
  const listeners=new Map();let tick,opened=0,closed=0;const popup={closed:false,close(){this.closed=true;closed++;}};
  const win={location:{origin:'https://example.invalid',href:'https://example.invalid/SENJIE/experiments/github-readonly/'},open(){opened++;popup.closed=false;return popup;},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},setInterval(fn){tick=fn;return 1;},clearInterval(){}};
  const identity=createDemoIdentity(win);await identity.prepareMemoryPersistence();const pending=identity.signInWithPopup();const receive=listeners.get('message');receive({origin:'https://other.invalid',source:popup,data:{type:'SENJIE_DEMO_IDENTITY',identity:'A'}});assert.ok(listeners.has('message'));receive({origin:win.location.origin,source:{},data:{type:'SENJIE_DEMO_IDENTITY',identity:'A'}});assert.ok(listeners.has('message'));receive({origin:win.location.origin,source:popup,data:{type:'SENJIE_DEMO_IDENTITY',identity:'A'}});assert.equal(await (await pending).user.getIdToken(),'DEMO_A_NOT_A_CREDENTIAL');assert.equal(listeners.size,0);
  const cancel=identity.signInWithPopup();popup.closed=true;tick();await assert.rejects(cancel,/CANCELLED/);assert.equal(listeners.size,0);assert.equal(opened,2);assert.equal(closed,2);
});
