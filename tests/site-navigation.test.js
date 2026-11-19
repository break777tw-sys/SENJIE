import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountApp} from './helpers/app-dom.js';
import {createFakeGoogle} from './helpers/fake-google.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/people-search-context.json',import.meta.url),'utf8'));
async function pageAt(hash=''){
 const env=createFakeGoogle();env.c.listCards=()=>({schemaVersion:1,cards:structuredClone(fixture.cards),readAt:fixture.evaluationInstant});return mountApp(env,{hash});
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
