import '../../app.js';
const root=document.querySelector('#conversations'),content=root.querySelector('[data-demo-content]');
const status=root.querySelector('[data-demo-status]'),input=root.querySelector('[name="demo-preference"]'),form=root.querySelector('form');
const key='senjie-github-fictional-preference-v1';
const fixtures=await fetch(new URL('./fixtures.json',import.meta.url)).then(response=>{if(!response.ok)throw Error('虛構示例未載入。');return response.json();});
function load(){
 content.replaceChildren();
 for(const example of fixtures){
  const article=document.createElement('article');article.className='callout';
  for(const text of ['虛構對話 · '+example.event_id,'提問：'+example.question,'示例回覆：'+example.answer,'未送出 LINE；未呼叫模型。示例用量為假資料，實際用量與帳單未知。']){const p=document.createElement('p');p.textContent=text;article.append(p);}
  content.append(article);
 }
 try{input.value=localStorage.getItem(key)||'使用繁體中文，回覆簡短。';status.textContent='GitHub 本機虛構示例；偏好只保存於此瀏覽器，沒有寫入 Google。';}
 catch{input.value='使用繁體中文，回覆簡短。';status.textContent='此瀏覽器未開放本機保存；目前只有虛構預覽。';}
 root.querySelector('[type="submit"]').disabled=false;root.querySelector('[type="submit"]').textContent='保存本機示例偏好';
}
form.addEventListener('submit',event=>{
 event.preventDefault();const value=input.value.trim();if(!value||value.length>500)return;
 try{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('Readback failed');status.textContent='已保存並讀回本機示例偏好；重新開啟本候選可再核對。沒有寫入正式資料。';}
 catch{status.textContent='本機保存未確認；請保留輸入內容。';}
});
root.querySelector('[data-demo-reload]').addEventListener('click',load);
document.querySelector('#photo-access-note').hidden=false;document.querySelector('#photo-access-note').textContent='這是 GitHub 主介面候選，尚未接妥私人資料 API；本頁不接收真實照片。';
load();
