import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../google-apps-script/WebsiteBridge.html',import.meta.url),'utf8');
function setup({authenticated=true,noHost=false}={}){
 const origin='https://break777tw-sys.github.io',channel='a'.repeat(32),handlers={},messages=[],calls=[];let focused=0;
 const host={focus(){focused++;},postMessage(data,target){messages.push({data,target});}};
 const state={textContent:''},button={hidden:true,addEventListener:(name,fn)=>button[name]=fn};
 const context=vm.createContext({window:{top:{opener:noHost?null:host},addEventListener:(name,fn)=>handlers[name]=fn},document:{querySelector:selector=>selector==='#state'?state:button},google:{script:{run:{withSuccessHandler:success=>({withFailureHandler:()=>({websiteBridgeCall(request){calls.push(request);success(request.method==='session'?{authenticated}:{cards:[]});}})})}}}});
 vm.runInContext(html.match(/<script>([\s\S]+)<\/script>/)[1].replace('<?!= config ?>',JSON.stringify({origin,channel})),context);
 const send=(method='session',extra={})=>handlers.message({origin,source:host,data:{type:'senjie-call',channel,id:'00000000-0000-4000-8000-000000000000',method},...extra});
 return {host,state,button,messages,calls,send,focused:()=>focused};
}
test('Google確認身分後自動返回網站；日常資料讀取不再搶回焦點',()=>{
 const e=setup();assert.equal(e.focused(),0);e.send();assert.equal(e.focused(),1);assert.equal(e.button.hidden,false);
 assert.equal(e.state.textContent,'登入完成。');assert.equal(e.messages.at(-1).data.result.authenticated,true);
 e.send('listCards');assert.equal(e.focused(),1);e.button.click();assert.equal(e.focused(),2);
 assert.doesNotMatch(html,/請保留這個連線視窗/);
});
test('其他來源或視窗不得觸發Google操作或自動切換',()=>{
 const e=setup();e.send('session',{origin:'https://evil.example'});e.send('session',{source:{}});
 assert.equal(e.calls.length,0);assert.equal(e.focused(),0);assert.equal(e.button.hidden,true);
});
test('身分未確認時不冒稱登入完成',()=>{
 const e=setup({authenticated:false});e.send();assert.equal(e.focused(),0);assert.equal(e.button.hidden,true);assert.notEqual(e.state.textContent,'登入完成。');
});
test('直接開連線頁不建立假登入或操作資料',()=>{
 const e=setup({noHost:true});assert.equal(e.calls.length,0);assert.equal(e.messages.length,0);assert.equal(e.focused(),0);assert.match(e.state.textContent,/請從 SENJIE 網站/);
});
