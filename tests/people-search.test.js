import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchPeople,parsePeopleQuery} from '../search.js';
import {filterCards} from '../model.js';
import {mountApp} from './helpers/app-dom.js';
import {createFakeGoogle} from './helpers/fake-google.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/people-search.json',import.meta.url),'utf8'));
const ids=result=>result.matches.map(m=>m.card.id);
const supplier=changes=>({...fixture.cards[0],provenance:undefined,...changes});
test('先重現原關鍵字供需混淆：需求方只在needs有場地仍被列入',()=>{
 assert.ok(filterCards(fixture.cards,'台南 場地').some(c=>c.id==='DEM-001'));
 assert.equal(filterCards(fixture.cards,fixture.query).length,0);
});
test('自然問句只列台南已確認供給方；需求、談話、職稱、其他地區不作依據',()=>{
 const result=searchPeople(fixture.cards,fixture.query);assert.equal(result.mode,'natural');assert.deepEqual(ids(result),fixture.expectedIds);
 for(const m of result.matches){assert.deepEqual(m.evidence.fields.map(f=>f.field),['city','offers']);assert.equal(m.evidence.recordId,m.card.id);assert.equal(m.evidence.version,m.card.version);assert.ok(m.evidence.fields.every(f=>f.quote===m.card[f.field]));assert.ok(m.evidence.fields.every(f=>f.sourceIds.length));}
});
test('台／臺、市字、空白與句尾問號等已定義問法可解析',()=>{
 for(const query of ['臺南誰能提供場地？','請問台南市誰可以提供場地？','台南 有誰 可提供 活動空間?','台南有哪些人能提供場地'])assert.deepEqual(ids(searchPeople(fixture.cards,query)),fixture.expectedIds);
});
test('額外條件、反向需求或未知地區不默默退回混搜',()=>{
 for(const query of ['台南誰能提供免費場地','台南誰能提供場地而且有停車場','台南誰需要場地','高雄誰能提供場地','台南誰不能提供場地']){const result=searchPeople(fixture.cards,query);assert.equal(result.mode,'unsupported');assert.deepEqual(result.matches,[]);assert.match(result.message,/尚未支援/);}
});
test('offers欄錯置需求、否定、媒合或推測時也不當供給；無障礙不誤作沒有場地',()=>{
 for(const offers of ['目前無法提供場地','不提供場地，但提供餐飲','我們需要場地','正在尋找場地','場地需求媒合','推測可提供場地','可能提供活動空間','提供場地，但目前停止對外開放'])assert.deepEqual(ids(searchPeople([supplier({offers})],fixture.query)),[]);
 for(const offers of ['可提供台南無障礙活動場地','不提供餐飲，但可提供台南場地'])assert.deepEqual(ids(searchPeople([supplier({offers})],fixture.query)),['SUP-001']);
});
test('待確認、推論與舊欄位回條均排除；不把人物已確認當逐欄已確認',()=>{
 for(const id of ['PENDING-001','INFER-001','STALE-001'])assert.deepEqual(ids(searchPeople(fixture.cards.filter(c=>c.id===id),fixture.query)),[]);
 const changed=structuredClone(fixture.cards[0]);delete changed.provenance.fields.offers;assert.deepEqual(ids(searchPeople([changed],fixture.query)),[]);
});
test('沿用分類／確認狀態篩選；既有姓名關鍵字仍可使用',()=>{
 assert.equal(searchPeople(fixture.cards,fixture.query,'教育培訓').matches.length,0);
 assert.equal(searchPeople(fixture.cards,fixture.query,'','待確認').matches.length,0);
 assert.equal(searchPeople(fixture.cards,'需求丙').mode,'keyword');assert.deepEqual(ids(searchPeople(fixture.cards,'需求丙')),['DEM-001']);
});
test('只取較新人物版本；同ID同版本衝突時不臆選供給方',()=>{
 const old=supplier({version:1}),latest=supplier({version:2,offers:'文化體驗',needs:'尋找場地'});
 assert.deepEqual(ids(searchPeople([old,latest],fixture.query)),[]);
 assert.deepEqual(ids(searchPeople([supplier({version:2}),latest],fixture.query)),[]);
 assert.deepEqual(ids(searchPeople([latest,supplier({version:3})],fixture.query)),['SUP-001']);
});
test('無逐欄回條的舊紀錄明列證據層級，不臆造版本、來源編號或確認者',()=>{
 const legacy=supplier({version:undefined,source:undefined});const evidence=searchPeople([legacy],fixture.query).matches[0].evidence;
 assert.equal(evidence.version,null);assert.equal(evidence.source,'未提供來源說明');assert.equal(evidence.fields[0].confirmation,'人物紀錄已確認；無逐欄回條');assert.deepEqual(evidence.fields[0].sourceIds,[]);
});
test('查詢不修改原始資料，輸出引用的是原欄位而非推論文字',()=>{
 const before=JSON.stringify(fixture.cards),result=searchPeople(fixture.cards,fixture.query);assert.equal(JSON.stringify(fixture.cards),before);
 assert.equal(result.matches[0].evidence.fields[1].quote,'可提供台南活動場地');assert.equal(result.matches[1].evidence.fields[0].quote,'臺南市');
});
test('原app搜尋input事件列出兩供給方與原文／版本依據，不顯示需求方',async()=>{
 const env=createFakeGoogle();env.c.listCards=()=>({schemaVersion:1,cards:structuredClone(fixture.cards),readAt:'2026-11-19T00:00:00.000Z',dataLabel:'本機虛構搜尋測試'});
 const page=await mountApp(env);page.nodes.get('search').value=fixture.query;await page.nodes.get('search').emit('input');
 const html=page.nodes.get('card-grid').innerHTML;for(const id of fixture.expectedIds)assert.match(html,new RegExp('data-id="'+id+'"'));
 assert.doesNotMatch(html,/DEM-001|虛構場地需求丙|NOTES-001/);assert.match(html,/符合依據/);assert.match(html,/版本2/);assert.match(html,/SYNTHETIC-SUP-001/);assert.match(page.nodes.get('search-explanation').textContent,/需求、職稱與談話不作供給依據/);
});
test('原app拒絕未知問句而不留下上次供給結果；證據HTML字串有跳脫',async()=>{
 const env=createFakeGoogle(),records=structuredClone(fixture.cards);records[0].offers='可提供台南場地 <img src=x onerror=bad()>';records[0].provenance.fields.offers.value=records[0].offers;
 env.c.listCards=()=>({schemaVersion:1,cards:records,readAt:'2026-11-19T00:00:00.000Z'});
 const page=await mountApp(env);page.nodes.get('search').value=fixture.query;await page.nodes.get('search').emit('input');assert.match(page.nodes.get('card-grid').innerHTML,/&lt;img/);assert.doesNotMatch(page.nodes.get('card-grid').innerHTML,/<img src=x/);
 page.nodes.get('search').value='台南誰能提供免費場地';await page.nodes.get('search').emit('input');assert.equal(page.nodes.get('card-grid').innerHTML,'');assert.match(page.nodes.get('search-explanation').textContent,/尚未支援/);
});
