import {createReadonlyClient} from '../../readonly-client.js';
import {createDemoIdentity} from './demo-identity.js';
import {createDemoFixture} from './demo-fixture.js';
const $=selector=>document.querySelector(selector);
const fixture=createDemoFixture(calls=>{$('#trace').textContent=calls.map((c,i)=>`${i+1}. ${c.method} ${c.path} → ${c.status}（僅本頁模擬）`).join('\n');});
const client=createReadonlyClient({endpoint:new URL('/v1/me/record',location.origin).href,identity:createDemoIdentity(window),fetch:fixture.fetch,allowLocalhost:location.hostname==='127.0.0.1'});
const labels={record_id:'示例編號',question:'問題',answer:'回答',status:'狀態',updated_at:'更新時間',is_mock:'虛構資料'};
client.subscribe(state=>{
  $('#login').disabled=!state.ready;$('#message').textContent=state.message;$('#identity').textContent=state.identity||'尚未登入';
  $('#record').hidden=!state.record;$('#fields').replaceChildren();
  if(state.record)for(const [key,label] of Object.entries(labels)){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(state.record[key]);$('#fields').append(dt,dd);
  }
});
$('#login').addEventListener('click',()=>client.signIn());
$('#logout').addEventListener('click',()=>client.signOut());
$('#refresh').addEventListener('click',()=>client.readMyRecord());
$('#scenario').addEventListener('change',()=>fixture.setScenario($('#scenario').value));
client.initialize();
