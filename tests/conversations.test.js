import test from 'node:test';
import assert from 'node:assert/strict';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const request=(text='使用繁體中文，先說重點。',expectedVersion=0,requestId='demo-preference-request-001')=>({text,expectedVersion,requestId});
test('虛構兩回合分離真實連線與用量；讀取不建立工作表',()=>{
 const env=createFakeGoogle(),data=env.c.listConversations();assert.equal(data.conversations.length,2);assert.equal(data.mode,'FICTIONAL_DEMO_ONLY');
 for(const c of data.conversations){assert.equal(c.sent_to_LINE,false);assert.equal(c.live_model_verified,false);assert.equal(c.same_chat_verified,false);assert.equal(c.actual_bill,'UNKNOWN_NOT_QUERIED');}
 assert.equal(data.conversations[0].usage_source,'V_FAKE_FIXTURE_NOT_OFFICIAL_MODEL_USAGE');assert.equal(data.conversations[0].estimated_fee_USD,'0.0000132');assert.equal(data.real.connection,'NOT_CONNECTED');assert.equal(data.real.conversations.length,0);assert.equal(env.sheets.DemoPreferences,undefined);
});
test('保存偏好後重新讀取同筆版本，保留歷史與JSON文字安全',()=>{
 const env=createFakeGoogle();const a=env.c.saveDemoPreference(request());assert.equal(a.preference.version,1);assert.equal(env.c.listConversations().preference.text,request().text);
 const b=env.c.saveDemoPreference(request('=僅為虛構偏好',1,'demo-preference-request-002'));assert.equal(b.preference.version,2);assert.equal(env.c.listConversations().preference.text,'=僅為虛構偏好');assert.equal(env.sheets.DemoPreferences.rows.length,3);assert.ok(env.sheets.DemoPreferences.rows[2][5].startsWith('{'));assert.equal(env.sheets.Records.rows.length,1);
});
test('重試不重複保存，改內容或舊版本拒絕',()=>{
 const env=createFakeGoogle();env.c.saveDemoPreference(request());assert.equal(env.c.saveDemoPreference(request()).replayed,true);
 assert.throws(()=>env.c.saveDemoPreference(request('不同內容')),/操作編號/);assert.throws(()=>env.c.saveDemoPreference(request('新內容',0,'demo-preference-request-003')),/已更新/);assert.equal(env.sheets.DemoPreferences.rows.length,2);
});
test('拒絕空白、超長、非法版本與未授權讀寫，不建立工作表',()=>{
 const env=createFakeGoogle();for(const r of [request(' '),request('字'.repeat(501)),request('示例',-1),request('示例',0,'short')])assert.throws(()=>env.c.saveDemoPreference(r));
 env.setEmail('outsider@example.invalid');assert.throws(()=>env.c.listConversations(),/拒絕存取/);assert.throws(()=>env.c.saveDemoPreference(request()),/拒絕存取/);assert.equal(env.sheets.DemoPreferences,undefined);
});
test('頁面可查看、修改偏好、重新讀取與模組導覽',async()=>{
 const env=createFakeGoogle(),page=await mountApp(env,{hash:'#conversations'}),n=page.demoNodes;
 assert.match(n.get('[data-demo-content]').innerHTML,/DEMO_EVENT_001/);assert.match(n.get('[data-demo-content]').innerHTML,/DEMO_EVENT_002/);assert.match(n.get('[data-demo-content]').innerHTML,/非帳單/);
 n.get('[name="demo-preference"]').value='<script>示例</script>';await n.get('form').emit('submit');assert.match(n.get('[data-demo-status]').textContent,/已保存並讀回/);
 n.get('[name="demo-preference"]').value='尚未保存';await n.get('[data-demo-reload]').click();await page.settled();assert.equal(n.get('[name="demo-preference"]').value,'<script>示例</script>');assert.equal(env.sheets.DemoPreferences.rows.length,2);
 await page.navigate('home');await page.navigate('conversations');assert.equal(page.nodes.get('card-navigation').hidden,true);
});
test('讀取失敗清空資料；未登入不呼叫私有讀寫',async()=>{
 const env=createFakeGoogle(),page=await mountApp(env);env.setEmail('outsider@example.invalid');await page.demoNodes.get('[data-demo-reload]').click();await page.settled();assert.equal(page.demoNodes.get('[data-demo-content]').innerHTML,'');assert.equal(page.demoNodes.get('[type="submit"]').disabled,true);
 const anonymous=await mountApp(env,{popupTransport:{kind:'redirect',onConnectionChange(fn){fn({connected:false});}}});assert.ok(!anonymous.calls.some(c=>/Conversations|Preference/.test(c.name)));assert.equal(anonymous.demoNodes.get('[type="submit"]').disabled,true);
});
