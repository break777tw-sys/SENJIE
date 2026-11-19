import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
function setup(email='owner@example.test'){
 const rows=[['人物編號','版本','請求編號','修改時間','修改者','資料JSON']];
 let locked=false;
 const sheet={getLastRow:()=>rows.length,getRange:(r,c,n=1,w=1)=>({getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w)),getValue:()=>rows[r-1][c-1],setValues:data=>{data.forEach((row,i)=>rows[r-1+i]=row);}})};
 const context=vm.createContext({Date,JSON,Object,String,Number,Array,Error,Session:{getActiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:key=>({ALLOWED_EMAILS:'owner@example.test',SPREADSHEET_ID:'fake-sheet'}[key])})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true;},releaseLock:()=>locked=false})},Utilities:{getUuid:()=>`person-${rows.length}`}});
 vm.runInContext(source,context);
 return {context,rows,isLocked:()=>locked};
}
const card={name:'測試人物',company:'測試公司',status:'待確認',date:'',email:'',phone:'0912345678'};
const request=(extra={})=>({requestId:'request-0000000001',card,...extra});
test('未授權及空白身分均不可讀寫',()=>{for(const email of ['','stranger@example.test']){const {context}=setup(email);assert.throws(()=>context.listCards(),/拒絕存取/);assert.throws(()=>context.saveCard(request()),/拒絕存取/);}});
test('新增後讀回、保留電話前導零與版本',()=>{const {context,rows,isLocked}=setup();const saved=context.saveCard(request()).record;assert.equal(saved.version,1);assert.equal(context.listCards().cards[0].phone,'0912345678');assert.equal(rows.length,2);assert.equal(isLocked(),false);});
test('重送不重複建檔，不可重用操作編號更換內容',()=>{const {context,rows}=setup();context.saveCard(request());assert.equal(context.saveCard(request()).replayed,true);assert.equal(rows.length,2);assert.throws(()=>context.saveCard(request({card:{...card,name:'另一位'}})),/不同內容/);});
test('過期版本拒絕覆蓋，更新保留歷史，鎖正常釋放',()=>{const {context,rows,isLocked}=setup();const old=context.saveCard(request()).record;const next=request({requestId:'request-0000000002',id:old.id,expectedVersion:0,card:{...card,role:'新職稱'}});assert.throws(()=>context.saveCard(next),/其他入口更新/);assert.equal(isLocked(),false);next.expectedVersion=1;context.saveCard(next);assert.equal(rows.length,3);assert.equal(context.listCards().cards.length,1);assert.equal(context.listCards().cards[0].version,2);});
test('相同姓名公司標記疑似重複，不自動合併',()=>{const {context}=setup();context.saveCard(request());assert.throws(()=>context.saveCard(request({requestId:'request-0000000002'})),/同名且同公司/);});
test('無效日期、信箱與非文字欄位拒絕寫入',()=>{const {context,rows}=setup();for(const changes of [{date:'2026-02-30'},{email:'bad@'},{name:5},{status:'亂填'}])assert.throws(()=>context.saveCard(request({card:{...card,...changes}})));assert.equal(rows.length,1);});
test('惡意來源字串存入 JSON 而非公式欄位',()=>{const {context,rows}=setup();context.saveCard(request({card:{...card,name:'=IMPORTXML("evil")'}}));assert.equal(rows[1][5][0],'{');assert.equal(context.listCards().cards[0].name,'=IMPORTXML("evil")');});
