const $=selector=>document.querySelector(selector);
let busy=false;
async function api(path,body){const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'本機測試失敗。');return data;}
function element(tag,text){const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;}
function notify(text){$('#message').textContent=text;}
async function refresh(){
 const state=await api('/api/state');
 $('#summary').textContent=`本機收件 ${state.receipts.length} 次 · 原圖 ${state.originalCount} 張 · 模擬 OCR 文件 ${state.ocrDocumentCount} 份 · 來源版本 ${state.revisionCount} 筆 · Google 呼叫 ${state.googleCalls} 次 · 人物建檔 ${state.peopleCreated} 位`;
 $('#sources').replaceChildren();
 for(const source of state.sources){
  const card=element('article');card.className='source';card.append(element('h2','已保存來源：'+source.id),element('code','原圖 SHA-256：'+source.hash));
  const image=element('img');image.src=source.originalHref;image.alt='由本機保存紀錄重新讀回的公開虛構名片';card.append(element('p','原圖（實際 PNG，本機保存）'),image);
  const link=element('a','開啟本機原圖');link.href=source.originalHref;link.target='_blank';link.rel='noopener';const linkRow=element('p');linkRow.append(link);card.append(linkRow);
  const result=element('pre',source.ocrId?'正在從保存紀錄核對模擬辨識結果…':'尚無模擬辨識結果，可續辦。');card.append(result);
  const button=element('button',source.ocrId?'重新讀回模擬辨識結果':'續辦模擬辨識');
  button.addEventListener('click',()=>run(async()=>{if(!source.ocrId)await api('/api/recognize',{sourceId:source.id});await refresh();notify('已從本機來源及文件紀錄重新讀回，並核對結果雜湊。');}));card.append(button);$('#sources').append(card);
  if(source.ocrId){try{const data=await api(source.resultHref);result.textContent=data.ocrText+'\n\n結果 SHA-256：'+data.ocrSHA256;}catch(error){result.textContent='讀回未通過：'+error.message;}}
 }
}
async function run(action){if(busy)return;busy=true;document.querySelectorAll('button').forEach(button=>button.disabled=true);try{await action();}catch(error){notify(error.message);}finally{busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);}}
$('#load-fixtures').addEventListener('click',()=>run(async()=>{
 for(const fixture of ['front','back','front-repeat']){
  notify('正在保存公開虛構照片：'+fixture);
  const source=await api('/api/fixture',{requestId:crypto.randomUUID(),fixture});
  await api('/api/recognize',{sourceId:source.id});
 }
 await refresh();notify('已完成3次本機收件；重複正面共用同一原圖。辨識文字為模擬。');
}));
$('#reload').addEventListener('click',()=>run(async()=>{await refresh();notify('已重新讀取本機紀錄；沒有沿用頁面記憶體。');}));
$('#outside').addEventListener('click',()=>run(async()=>{
 const response=await fetch('/api/original/LOCAL-UNSELECTED-CONTROL',{cache:'no-store'}),data=await response.json();
 if(response.status!==403)throw new Error('案外來源拒絕未通過。');
 const provider=await api('/api/control-denial');
 notify(`本機應用層拒絕：${response.status}，${data.error}；模擬提供者拒絕：${provider.status}。Google 真實拒絕尚未驗證。`);
}));
run(refresh);
