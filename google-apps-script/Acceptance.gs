/** Isolated acceptance project only. Do not include in production deployment. */
function runAcceptance(){
  const user=authorize_();
  const props=PropertiesService.getScriptProperties();
  const originalAllowed=props.getProperty('ALLOWED_EMAILS');
  const label='虛構驗收-'+Utilities.getUuid();
  const card={name:label,company:'SENJIE 虛構驗收資料',status:'待確認',phone:'0912345678',email:'test@example.invalid',category:'教育培訓',notes:'純虛構資料，無真人聯絡資訊。'};
  const report={runId:label,startedAt:new Date().toISOString(),checks:[]};
  function check(name,condition){if(!condition)throw new Error('驗收失敗：'+name);report.checks.push({name,result:'passed'});}
  const first=saveCard({requestId:Utilities.getUuid(),card}).record;
  check('新增與 Google 保存',first.version===1);
  let found=listCards().cards.find(c=>c.id===first.id);
  check('重新查詢及電話前導零',found&&found.name===label&&found.phone==='0912345678');
  const second=saveCard({requestId:Utilities.getUuid(),id:first.id,expectedVersion:1,card:{...card,role:'已修改的虛構職稱'}}).record;
  found=listCards().cards.find(c=>c.id===first.id);
  check('修改後重新查詢',second.version===2&&found.version===2&&found.role==='已修改的虛構職稱');
  try{
    props.setProperty('ALLOWED_EMAILS','denied@example.invalid');
    let refused=false;
    try{listCards();}catch(error){if(String(error.message).includes('拒絕存取'))refused=true;else throw error;}
    check('Google 執行環境的未授權身分拒絕',refused);
  }finally{
    props.setProperty('ALLOWED_EMAILS',originalAllowed);
  }
  report.finishedAt=new Date().toISOString();
  report.scope='Apps Script server calls with real Google Sheets; not a browser/HTTP end-to-end test';
  console.log(JSON.stringify(report));
  return report;
}
