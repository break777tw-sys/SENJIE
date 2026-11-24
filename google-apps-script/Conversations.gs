/** Fictional examples only. No LINE, model, billing or credential calls. */
const DEMO_PREFERENCE_HEADERS_=['偏好編號','版本','請求編號','修改時間','修改者','資料JSON'];
function conversationExamples_(){
  return [{event_id:'DEMO_EVENT_001',chat_id:'DEMO_CHAT_001',question:'請將虛構資訊『週五九點、藍色雨衣』改寫成一句親切提醒，使用繁體中文，不新增日期或地點。',answer:'週五九點，記得帶藍色雨衣。',status:'SIMULATED_REPLY_NOT_SENT',display_time:'2026-11-25T09:00:00+08:00',time_source:'FICTITIOUS_DISPLAY_TIME_NOT_MEASURED',usage:{input_tokens:100,output_tokens:10,total_tokens:110,cached_tokens:20,cache_write_tokens:0},usage_source:'V_FAKE_FIXTURE_NOT_OFFICIAL_MODEL_USAGE',estimated_fee_USD:'0.0000132',fee_source:'FAKE_USAGE_CONDITIONAL_FORMULA_NOT_BILL',actual_bill:'UNKNOWN_NOT_QUERIED',sent_to_LINE:false,same_chat_verified:false,live_model_verified:false},
  {event_id:'DEMO_EVENT_002',chat_id:'DEMO_CHAT_001',question:'這是第二回合虛構示例。請保留剛才的雨衣提醒，示範簡短的繁體中文回覆。',answer:'週五九點，記得帶藍色雨衣。',status:'SIMULATED_REPLY_NOT_SENT',display_time:null,time_source:'UNKNOWN_NOT_MEASURED',usage:null,usage_source:'UNKNOWN_NOT_MEASURED',estimated_fee_USD:null,fee_source:'UNKNOWN_NOT_MEASURED',actual_bill:'UNKNOWN_NOT_QUERIED',sent_to_LINE:false,same_chat_verified:false,live_model_verified:false}];
}
function demoPreferenceSheet_(user,create){
  const book=SpreadsheetApp.openById(user.spreadsheetId);
  let sheet=book.getSheetByName('DemoPreferences');
  if(!sheet&&create){sheet=book.insertSheet('DemoPreferences');sheet.getRange(1,1,1,6).setValues([DEMO_PREFERENCE_HEADERS_]);sheet.setFrozenRows(1);}
  if(sheet&&JSON.stringify(sheet.getRange(1,1,1,6).getValues()[0])!==JSON.stringify(DEMO_PREFERENCE_HEADERS_))throw new Error('示例偏好結構不符，停止讀寫。');
  return sheet;
}
function demoPreferenceRevisions_(sheet){
  if(!sheet)return [];
  const count=sheet.getLastRow()-1;
  if(count>5000)throw new Error('示例偏好版本超過讀取上限。');
  return count?sheet.getRange(2,1,count,6).getValues().map(row=>{
    const preference=JSON.parse(String(row[5]));
    if(preference.id!=='DEMO_PREF_001'||preference.version!==Number(row[1])||row[0]!==preference.id)throw new Error('示例偏好版本不一致。');
    return {preference,requestId:String(row[2]),actor:String(row[4])};
  }):[];
}
function defaultDemoPreference_(){return {id:'DEMO_PREF_001',version:0,text:'使用繁體中文，回覆簡短。',scope:'DEMO_CHAT_001',source:'FICTIONAL_EXAMPLE',updatedAt:null};}
function listConversations(){
  const user=authorize_(),rows=demoPreferenceRevisions_(demoPreferenceSheet_(user,false));
  return {schemaVersion:1,mode:'FICTIONAL_DEMO_ONLY',conversations:conversationExamples_(),preference:rows.length?rows[rows.length-1].preference:defaultDemoPreference_(),real:{conversations:[],connection:'NOT_CONNECTED',aiReview:'UNKNOWN_NOT_RUN',actualBill:'UNKNOWN_NOT_QUERIED'},readAt:new Date().toISOString()};
}
function saveDemoPreference(request){
  const user=authorize_();
  if(!request||typeof request.text!=='string'||!request.text.trim()||request.text.trim().length>500||typeof request.requestId!=='string'||!/^[A-Za-z0-9-]{16,100}$/.test(request.requestId)||!Number.isSafeInteger(request.expectedVersion)||request.expectedVersion<0)throw new Error('請填入 1 至 500 字示例偏好與有效版本。');
  const text=request.text.trim(),lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))throw new Error('其他資料正在保存，請稍後重試。');
  try{
    const sheet=demoPreferenceSheet_(user,true),rows=demoPreferenceRevisions_(sheet);
    const repeat=rows.find(r=>r.requestId===request.requestId&&r.actor===user.email);
    if(repeat){if(repeat.preference.text!==text)throw new Error('操作編號已用於不同內容。');return {preference:repeat.preference,replayed:true};}
    const old=rows.length?rows[rows.length-1].preference:defaultDemoPreference_();
    if(request.expectedVersion!==old.version)throw new Error('偏好已更新，請重新讀取後再修改。');
    const preference={...old,text,version:old.version+1,updatedAt:new Date().toISOString()};
    const row=sheet.getLastRow()+1;
    sheet.getRange(row,1,1,6).setValues([[preference.id,preference.version,request.requestId,preference.updatedAt,user.email,JSON.stringify(preference)]]);
    SpreadsheetApp.flush();
    const persisted=JSON.parse(sheet.getRange(row,6).getValue());
    if(JSON.stringify(persisted)!==JSON.stringify(preference))throw new Error('保存讀回未確認，請以相同操作編號重試。');
    return {preference:persisted,replayed:false};
  }finally{lock.releaseLock();}
}
