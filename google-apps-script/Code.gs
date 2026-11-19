/** Apps Script backend; deployment and live acceptance are recorded separately.
 * Deploy as the user accessing the app. Configure ALLOWED_EMAILS and SPREADSHEET_ID
 * in Script Properties. Unknown/empty identity is denied; do not weaken this check.
 * Records is append-only: each row stores one complete revision. No contacts scope.
 */
const HEADERS_=['人物編號','版本','請求編號','修改時間','修改者','資料JSON'];
function authorize_(){
  const props=PropertiesService.getScriptProperties();
  const email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  const allowed=String(props.getProperty('ALLOWED_EMAILS')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!email||!allowed.includes(email))throw new Error('拒絕存取：未確認的 Google 身分。');
  return {email,spreadsheetId:props.getProperty('SPREADSHEET_ID')};
}
function records_(identity){
  if(!identity.spreadsheetId)throw new Error('尚未設定正式 Google 試算表。');
  const sheet=SpreadsheetApp.openById(identity.spreadsheetId).getSheetByName('Records');
  if(!sheet)throw new Error('缺少 Records 工作表；請由擁有者初始化。');
  const headers=sheet.getRange(1,1,1,HEADERS_.length).getValues()[0];
  if(JSON.stringify(headers)!==JSON.stringify(HEADERS_))throw new Error('資料結構不符，停止讀寫以保護資料。');
  return sheet;
}
function readRevisions_(sheet){
  const rows=sheet.getLastRow()-1;
  if(rows>10000)throw new Error('版本數已超過此版本讀取上限，需分頁或遷移後端；未截斷結果。');
  if(rows<1)return [];
  return sheet.getRange(2,1,rows,HEADERS_.length).getValues().map(row=>{
    const record=JSON.parse(String(row[5]));
    if(record.id!==row[0]||Number(record.version)!==Number(row[1]))throw new Error('資料與版本不一致，請檢查總表。');
    return {requestId:String(row[2]),actor:String(row[4]),record};
  });
}
function latest_(revisions){
  const records={};
  revisions.forEach(({record})=>{if(!records[record.id]||records[record.id].version<record.version)records[record.id]=record;});
  return Object.values(records);
}
function doGet(){
  authorize_();
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('名片管理');
}
function listCards(){
  const user=authorize_();
  const dataLabel=String(PropertiesService.getScriptProperties().getProperty('DATA_LABEL')||'Google 資料');
  return {schemaVersion:1,cards:latest_(readRevisions_(records_(user))),readAt:new Date().toISOString(),dataLabel};
}
function validateCard_(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('名片格式不正確。');
  const clean={};
  const limits={name:80,alias:80,company:150,role:80,city:80,category:80,status:20,offers:250,needs:250,notes:1000,next:250,date:10,phone:60,email:200,line:100,address:300};
  Object.keys(limits).forEach(key=>{
    if(data[key]!=null&&typeof data[key]!=='string')throw new Error('欄位必須為文字：'+key);
    clean[key]=String(data[key]||'').trim();
    if(clean[key].length>limits[key])throw new Error('欄位長度超過上限：'+key);
  });
  if(!clean.name)throw new Error('姓名不可空白。');
  if(!['待確認','已確認'].includes(clean.status))throw new Error('確認狀態不正確。');
  if(clean.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email))throw new Error('電子郵件格式不正確。');
  if(clean.date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(clean.date))throw new Error('日期格式不正確。');
    const date=new Date(clean.date+'T00:00:00Z');
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==clean.date)throw new Error('日期不存在。');
  }
  return clean;
}
function saveCard(request){
  const user=authorize_();
  if(!request||!request.card||typeof request.requestId!=='string'||!/^[A-Za-z0-9-]{16,100}$/.test(request.requestId))throw new Error('缺少有效的操作編號。');
  const clean=validateCard_(request.card);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))throw new Error('其他資料正在保存，請稍後重試。');
  try{
    const sheet=records_(user),revisions=readRevisions_(sheet);
    const repeated=revisions.find(r=>r.requestId===request.requestId&&r.actor===user.email);
    if(repeated){
      const same=Object.keys(clean).every(key=>clean[key]===repeated.record[key]);
      if(!same||request.id&&request.id!==repeated.record.id)throw new Error('操作編號已用於不同內容，請重新載入後再儲存。');
      return {record:repeated.record,replayed:true};
    }
    const current=latest_(revisions),old=request.id?current.find(c=>c.id===request.id):null;
    if(request.id&&!old)throw new Error('人物不存在，請重新讀取。');
    if(old&&request.expectedVersion!==old.version)throw new Error('資料已在其他入口更新，請重新讀取後再修改。');
    const normalize=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
    if(current.some(c=>c.id!==old?.id&&normalize(c.name)===normalize(clean.name)&&normalize(c.company)===normalize(clean.company)))throw new Error('發現同名且同公司的資料，請核對；未執行合併。');
    const record={...clean,id:old?.id||'BC-'+Utilities.getUuid(),version:(old?.version||0)+1,source:old?.source||'網站手動建檔',updatedAt:new Date().toISOString(),tone:old?.tone||0};
    // JSON cell starts with {, keeping source strings out of executable formula cells.
    sheet.getRange(sheet.getLastRow()+1,1,1,HEADERS_.length).setValues([[record.id,record.version,request.requestId,record.updatedAt,user.email,JSON.stringify(record)]]);
    SpreadsheetApp.flush();
    const persisted=JSON.parse(sheet.getRange(sheet.getLastRow(),6).getValue());
    if(persisted.id!==record.id||persisted.version!==record.version)throw new Error('寫入未通過讀回驗證，請以相同操作編號重試。');
    return {record:persisted,replayed:false};
  }finally{lock.releaseLock();}
}
// Only callable from the editor. Does not create/share a spreadsheet or alter contacts.
function initializeRecords_(){
  const user=authorize_();
  if(!user.spreadsheetId)throw new Error('請先指定已確認的正式總表。');
  const book=SpreadsheetApp.openById(user.spreadsheetId);
  if(book.getSheetByName('Records'))throw new Error('Records 已存在，不覆蓋。');
  const sheet=book.insertSheet('Records');sheet.getRange(1,1,1,HEADERS_.length).setValues([HEADERS_]);sheet.setFrozenRows(1);
}
