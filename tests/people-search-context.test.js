import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchPeople} from '../search.js';
import {mountApp} from './helpers/app-dom.js';
import {createFakeGoogle} from './helpers/fake-google.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/people-search-context.json',import.meta.url),'utf8'));
const ids=result=>result.matches.map(m=>m.card.id);
const supplier=offers=>({...structuredClone(fixture.cards[0]),offers,provenance:undefined});
function notes(card,value,status='使用者確認'){
 card.notes=value;card.provenance.fields.notes={value,status,method:'虛構人工確認',sourceIds:['SYNTHETIC-'+card.id]};return card;
}
test('獨驗三種誤薦回歸：沒有辦法、僅供內部、台南人只提供高雄場地均排除',()=>{
 for(const id of ['NEG-NO-001','INTERNAL-001','VENUE-KHH-001'])assert.deepEqual(ids(searchPeople(fixture.cards.filter(c=>c.id===id),fixture.basicQuery)),[]);
 assert.deepEqual(ids(searchPeople(fixture.cards,fixture.basicQuery)),fixture.basicExpectedIds);
});
test('沒有辦法與沒有能力等否定供給不因台南關鍵字而通過',()=>{
 for(const offers of ['沒有辦法提供台南場地','沒辦法提供台南場地','沒有能力提供台南場地','目前無法對外提供台南場地','不確定能提供台南場地'])assert.deepEqual(ids(searchPeople([supplier(offers)],fixture.basicQuery)),[]);
 assert.deepEqual(ids(searchPeople([supplier('沒有辦法提供餐飲，但可提供台南場地')],fixture.basicQuery)),['SUP-001']);
});
test('內部限制跨分句仍排除；無障礙與外部餐飲否定不誤傷明確供給',()=>{
 for(const offers of ['台南場地僅供內部使用','可提供台南場地。僅限員工使用','可提供台南場地；只供內部使用','台南場地內部專用','提供台南場地但不對外開放'])assert.deepEqual(ids(searchPeople([supplier(offers)],fixture.basicQuery)),[]);
 assert.deepEqual(ids(searchPeople([supplier('可提供台南無障礙活動場地')],fixture.basicQuery)),['SUP-001']);
});
test('場地所在地取自供給原文，人物城市不能代替；高雄人可提供台南場地仍列出',()=>{
 for(const offers of ['可提供場地','台南辦公，可提供高雄場地','在台南的公司可提供高雄場地','台南辦公，提供場地'])assert.deepEqual(ids(searchPeople([supplier(offers)],fixture.basicQuery)),[]);
 const cross=fixture.cards.find(c=>c.id==='SUP-CROSS-001');assert.deepEqual(ids(searchPeople([cross],fixture.basicQuery)),['SUP-CROSS-001']);
 const noCity={...supplier('可提供臺南市場地'),city:undefined};const result=searchPeople([noCity],fixture.basicQuery);assert.equal(result.matches.length,1);assert.deepEqual(result.matches[0].evidence.fields.map(f=>f.field),['offers']);
});
test('原複合問句取最近已確認交流會，供給與認識原文、來源、版本均可查',()=>{
 const result=searchPeople(fixture.cards,fixture.query);assert.equal(result.mode,'natural');assert.deepEqual(ids(result),fixture.expectedIds);
 assert.match(result.message,/2026-11-10.*秋季交流會/);
 for(const {card,evidence} of result.matches){assert.equal(evidence.meeting.date,fixture.latestMeetingDate);assert.equal(evidence.meeting.event,fixture.latestMeetingEvent);assert.equal(evidence.fields.find(f=>f.field==='notes').quote,card.notes);assert.ok(evidence.fields.every(f=>f.sourceIds.includes('SYNTHETIC-'+card.id)));assert.equal(evidence.version,card.version);}
});
test('上次按全部紀錄判定後才篩供給，不能把有供給的舊交流會當最新',()=>{
 const cards=structuredClone(fixture.cards),demand=cards.find(c=>c.id==='DEMAND-RECENT-001');notes(demand,'2026-11-11 在冬季交流會認識');
 const result=searchPeople(cards,fixture.query);assert.deepEqual(ids(result),[]);assert.match(result.message,/2026-11-11.*冬季交流會/);
});
test('缺日期、格式不明與無認識紀錄時，明示無法判定上次並清空',()=>{
 for(const value of ['在交流會認識','可能在2026-11-10交流會認識','2026-02-30 在交流會認識']){
  const card=notes(structuredClone(fixture.cards[0]),value),result=searchPeople([card],fixture.query);assert.deepEqual(ids(result),[]);assert.match(result.message,/無法判定/);
 }
 const card=structuredClone(fixture.cards[0]);delete card.notes;delete card.provenance.fields.notes;assert.match(searchPeople([card],fixture.query).message,/沒有可核對日期/);
});
test('同一最近日期出現不同交流會，不擅選某場或合併',()=>{
 const cards=structuredClone(fixture.cards);notes(cards[1],'2026-11-10 在冬季交流會認識');const result=searchPeople(cards,fixture.query);assert.deepEqual(ids(result),[]);assert.match(result.message,/不同交流會/);
});
test('場合待確認或回條過期、其他場合、較早交流會與談話資源不混入',()=>{
 const result=searchPeople(fixture.cards,fixture.query);
 for(const id of ['PENDING-NOTES-001','STALE-NOTES-001','MEETING-OTHER-001','SUP-002','NOTES-RESOURCE-001','DEMAND-RECENT-001'])assert.ok(!ids(result).includes(id),id);
});
test('複合問句保留已定義標點／臺南變體，免費等額外條件不被忽略',()=>{
 for(const query of ['上次在交流會認識，能提供臺南場地的人有哪些？','請問上次在交流會認識、可以提供台南的活動空間的人有哪些？'])assert.deepEqual(ids(searchPeople(fixture.cards,query)),fixture.expectedIds);
 for(const query of ['上次在交流會認識、能提供台南的免費場地的人有哪些？','上次在交流會認識、能提供高雄的場地的人有哪些？']){const result=searchPeople(fixture.cards,query);assert.equal(result.mode,'unsupported');assert.deepEqual(ids(result),[]);}
});
test('套用分類前判定最近交流會；查詢不修改原資料',()=>{
 const cards=structuredClone(fixture.cards),before=JSON.stringify(cards);assert.deepEqual(ids(searchPeople(cards,fixture.query,'場地資源')),fixture.expectedIds);assert.equal(JSON.stringify(cards),before);
 const demand=cards.find(c=>c.id==='DEMAND-RECENT-001');demand.category='教育培訓';notes(demand,'2026-11-11 在冬季交流會認識');assert.deepEqual(ids(searchPeople(cards,fixture.query,'場地資源')),[]);
});
test('原app複合問句input事件顯示供給、場合、來源與最新日期；未支援條件清空',async()=>{
 const env=createFakeGoogle();env.c.listCards=()=>({schemaVersion:1,cards:structuredClone(fixture.cards),readAt:'2026-11-19T00:00:00.000Z'});
 const page=await mountApp(env);page.nodes.get('search').value=fixture.query;await page.nodes.get('search').emit('input');
 const html=page.nodes.get('card-grid').innerHTML;for(const id of fixture.expectedIds)assert.match(html,new RegExp('data-id="'+id+'"'));assert.doesNotMatch(html,/data-id="(?:SUP-002|INTERNAL-001|VENUE-KHH-001|NEG-NO-001)"/);
 assert.match(html,/認識日期與場合/);assert.match(html,/2026-11-10 在秋季交流會認識/);assert.match(html,/SYNTHETIC-SUP-CROSS-001/);assert.match(page.nodes.get('search-explanation').textContent,/人物地區不代替場地所在地/);
 page.nodes.get('search').value=fixture.query.replace('台南的場地','台南的免費場地');await page.nodes.get('search').emit('input');assert.equal(page.nodes.get('card-grid').innerHTML,'');
});
