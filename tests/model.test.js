import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCards,findDuplicates,demoCards} from '../model.js';
test('姓名、別名及多條件查詢支援大小寫與空白',()=>{assert.equal(filterCards(demoCards,'  alex 高雄 ')[0].id,'DEMO0002');assert.equal(filterCards(demoCards,'木木')[0].id,'DEMO0001');});
test('分類與確認狀態必須同時符合',()=>{assert.equal(filterCards(demoCards,'','教育培訓','待確認').length,1);assert.equal(filterCards(demoCards,'','教育培訓','已確認').length,0);});
test('查無結果與空查詢',()=>{assert.equal(filterCards(demoCards,'不存在的企業').length,0);assert.equal(filterCards(demoCards,'').length,3);});
test('更新本人不判重，同名不同公司不自動合併',()=>{assert.equal(findDuplicates(demoCards,demoCards[0]).length,0);assert.equal(findDuplicates(demoCards,{...demoCards[0],id:'NEW'}).length,1);assert.equal(findDuplicates(demoCards,{...demoCards[0],id:'NEW',company:'另一家公司'}).length,0);});
