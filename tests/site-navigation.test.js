import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountApp} from './helpers/app-dom.js';
import {createFakeGoogle} from './helpers/fake-google.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/people-search-context.json',import.meta.url),'utf8'));
async function pageAt(hash='',options={}){
 const env=createFakeGoogle();env.c.listCards=()=>({schemaVersion:1,cards:structuredClone(fixture.cards),readAt:fixture.evaluationInstant});return mountApp(env,{hash,...options});
}
const visible=page=>page.navigation.views.filter(v=>!v.hidden).map(v=>v.id);
test('總入口只呈現已確認名片模組，四個畫面仍在模組內',async()=>{
 const page=await pageAt();assert.deepEqual(visible(page),['home']);assert.equal(page.nodes.get('card-navigation').hidden,true);assert.equal(page.nodes.get('site-brand').hidden,false);
 assert.equal(page.navigation.buttons.length,4);assert.deepEqual(page.navigation.buttons.map(b=>b.dataset.view),['cards','inbox','followups','connections']);
 assert.equal(page.nodes.get('open-people-module').getAttribute('href'),'#cards');assert.equal(page.context.document.title,'SENJIE 總入口 · 開發版');
});
test('總入口進名片，再從各四畫面返回總入口；不重讀或寫入資料',async()=>{
 const page=await pageAt(),calls=page.calls.length;
 await page.nodes.get('open-people-module').click();assert.deepEqual(visible(page),['cards']);assert.equal(page.context.window.location.hash,'#cards');
 for(const view of ['cards','inbox','followups','connections']){
  await page.navigate(view);assert.deepEqual(visible(page),[view]);assert.equal(page.nodes.get('card-navigation').hidden,false);assert.equal(page.nodes.get('module-crumb').hidden,false);assert.equal(page.context.window.location.hash,'#'+view);
  assert.deepEqual(page.navigation.buttons.filter(b=>b.getAttribute('aria-current')==='page').map(b=>b.dataset.view),[view]);
  await page.nodes.get('site-home-link').click();assert.deepEqual(visible(page),['home']);assert.equal(page.nodes.get('card-navigation').hidden,true);assert.equal(page.context.window.location.hash,'#home');
 }
 assert.equal(page.calls.length,calls);assert.ok(!page.calls.some(c=>/save|archive|upload/i.test(c.name)));
});
test('保留#cards直接入口與原名片品牌入口，不強制繞回總入口',async()=>{
 const page=await pageAt('#cards');assert.deepEqual(visible(page),['cards']);assert.equal(page.nodes.get('card-brand').getAttribute('href'),'#cards');
 await page.navigate('inbox');await page.nodes.get('card-brand').click();assert.deepEqual(visible(page),['cards']);assert.equal(page.context.window.location.hash,'#cards');
});
test('四畫面與總入口可直接開啟；Hash前後切換不產生不存在的層',async()=>{
 for(const view of ['home','cards','inbox','followups','connections']){
  const page=await pageAt('#'+view);assert.deepEqual(visible(page),[view]);
  await page.setHash('#home');assert.deepEqual(visible(page),['home']);await page.setHash('#'+view);assert.deepEqual(visible(page),[view]);
  await page.setHash('#not-a-module');assert.deepEqual(visible(page),['home']);assert.equal(page.nodes.get('crumb').textContent,'SENJIE 總入口');
 }
});
test('人物詳情保留原人ID與來源，關閉後仍在原畫面；離開畫面會關閉對話框',async()=>{
 const page=await pageAt('#cards');await page.openPerson('SUP-001');assert.equal(page.nodes.get('detail').open,true);assert.equal(page.nodes.get('detail-id').textContent,'SUP-001');assert.equal(page.fields.name.value,fixture.cards[0].name);
 await page.nodes.get('close-detail').click();assert.equal(page.nodes.get('detail').open,false);assert.deepEqual(visible(page),['cards']);
 await page.openPerson('SUP-001');await page.setHash('#home');assert.equal(page.nodes.get('detail').open,false);assert.deepEqual(visible(page),['home']);
});
test('總入口往返保留既有供需／場合查詢與來源結果，沒有另造名單',async()=>{
 const page=await pageAt('#cards');page.nodes.get('search').value=fixture.query;await page.nodes.get('search').emit('input');const before=page.nodes.get('card-grid').innerHTML;
 assert.match(before,/data-id="SUP-001"/);assert.match(before,/data-id="SUP-CROSS-001"/);assert.doesNotMatch(before,/data-id="(?:CLIENT-OUTSIDE-001|FUTURE-MEETING-001|INTERNAL-001)"/);
 await page.navigate('home');await page.nodes.get('open-people-module').click();assert.equal(page.nodes.get('search').value,fixture.query);assert.equal(page.nodes.get('card-grid').innerHTML,before);
});
test('320與390窄版進入名片或直接開#cards時，在定位後復位捲動',async()=>{
 for(const width of [320,390]){
  const direct=await pageAt('#cards',{width,scrollY:486});assert.deepEqual(visible(direct),['cards']);assert.equal(direct.context.window.scrollY,0);
  const page=await pageAt('#home',{width});page.context.window.scrollY=486;await page.nodes.get('open-people-module').click();assert.equal(page.context.window.scrollY,486);page.flushFrames();assert.equal(page.context.window.scrollY,0);assert.deepEqual(visible(page),['cards']);assert.equal(page.context.window.location.hash,'#cards');
 }
});
test('窄版load與pageshow晚到的定位仍復位，相同畫面hash事件也不漏掉',async()=>{
 const page=await pageAt('#cards',{width:320});
 for(const event of ['load','pageshow','hashchange']){page.context.window.scrollY=486;await page.emitWindow(event);assert.equal(page.context.window.scrollY,0,event);assert.deepEqual(visible(page),['cards']);}
});
test('窄版返回／前進保留路由與查詢，只在導覽進入時復位',async()=>{
 const page=await pageAt('#cards',{width:390}),calls=page.calls.length;page.nodes.get('search').value=fixture.query;await page.nodes.get('search').emit('input');const html=page.nodes.get('card-grid').innerHTML;
 for(const hash of ['#home','#cards','#inbox','#home','#cards']){page.context.window.scrollY=486;await page.setHash(hash);assert.equal(page.context.window.scrollY,0);assert.deepEqual(visible(page),[hash.slice(1)]);}
 assert.equal(page.nodes.get('search').value,fixture.query);assert.equal(page.nodes.get('card-grid').innerHTML,html);assert.equal(page.calls.length,calls);
 page.context.window.scrollY=200;await page.nodes.get('search').emit('input');page.flushFrames();assert.equal(page.context.window.scrollY,200,'一般查詢不把使用者捲回頂端');
});
test('桌面沿用原定位與路由，沒有新增捲動指令',async()=>{
 const page=await pageAt('#cards',{width:1280,scrollY:486});assert.equal(page.context.window.scrollY,486);
 await page.navigate('home');await page.navigate('cards');for(const event of ['load','pageshow','hashchange'])await page.emitWindow(event);
 assert.deepEqual(page.scrollCalls,[]);assert.equal(page.context.window.scrollY,486);assert.deepEqual(visible(page),['cards']);assert.equal(page.context.window.location.hash,'#cards');
});
