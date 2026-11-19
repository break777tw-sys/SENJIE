// Demo state only. No personal data, network requests, credentials, or persistent storage.
import { filterCards, findDuplicates, demoCards } from './model.js';
let cards=demoCards.map(c=>({...c})), editing=null, sequence=cards.length;
const $=s=>document.querySelector(s), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={cards:'名片資料庫',inbox:'名片收件匣',followups:'合作與追蹤',connections:'入口與資料'};
function render(){
  $('#count-all').textContent=cards.length;$('#count-review').textContent=cards.filter(c=>c.status==='待確認').length;$('#count-follow').textContent=cards.filter(c=>c.next).length;
  const result=filterCards(cards,$('#search').value,$('#category').value,$('#status').value);
  $('#result-count').textContent=`顯示 ${result.length} 位／共 ${cards.length} 位範例人物`;
  $('#empty').hidden=result.length>0;
  $('#card-grid').innerHTML=result.map((c)=>`<button class="person-card" data-id="${escape(c.id)}" aria-label="查看${escape(c.name)}"><div class="card-art tone-${c.tone}"><span class="initial">${escape(c.name.slice(0,1))}</span><span class="art-label">虛構範例</span></div><div class="card-body"><div class="card-top"><h2>${escape(c.name)}</h2><span class="badge ${c.status==='待確認'?'review':''}">${escape(c.status)}</span></div><p class="alias">${escape(c.alias||'尚無別名')}</p><div class="company">${escape(c.company)}</div><p class="role">${escape(c.role)} · ${escape(c.city)}</p><div class="tags"><span class="tag">${escape(c.category)}</span><span class="tag">${escape(c.offers||'資源待補充')}</span></div><div class="card-bottom">${escape(c.next?'下一步：'+c.next:'尚未記錄下一步')}</div></div></button>`).join('');
  const followups=cards.filter(c=>c.next).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  $('#followup-list').innerHTML=followups.length?followups.map(c=>`<article class="followup"><div><h2>${escape(c.name)} · ${escape(c.company)}</h2><p>${escape(c.next)}</p><p>追蹤日期：${escape(c.date||'未指定')} · 尚未建立提醒</p></div><button class="secondary" data-id="${escape(c.id)}">查看與修改</button></article>`).join(''):'<p class="empty">目前沒有下一步行動。</p>';
}
function openCard(id){
  editing=cards.find(c=>c.id===id)||{id:`DEMO${String(++sequence).padStart(4,'0')}`,name:'',alias:'',company:'',role:'',city:'',category:'文化表演',status:'待確認',offers:'',needs:'',notes:'',next:'',date:'',source:'本次頁面手動新增',tone:sequence%3};
  $('#detail-title').textContent=editing.name||'新增範例名片';$('#detail-id').textContent=editing.id;
  for(const [key,value] of Object.entries(editing)){const input=$('#detail-form').elements.namedItem(key);if(input)input.value=value;}
  $('#duplicate-warning').hidden=true;$('#detail').showModal();
}
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').hidden=true,5000);}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  const view=button.dataset.view;document.querySelectorAll('.view').forEach(s=>s.hidden=s.id!==view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));$('#crumb').textContent=labels[view];
}));
document.querySelector('.brand').addEventListener('click',()=>document.querySelector('[data-view="cards"]').click());
for(const selector of ['#search','#category','#status'])$(selector).addEventListener('input',render);
$('#layout').addEventListener('click',()=>{const list=$('#card-grid').classList.toggle('list');$('#layout').textContent=list?'切換卡片':'切換列表';$('#layout').setAttribute('aria-pressed',String(list));});
$('#new-card').addEventListener('click',()=>openCard(null));$('#close-detail').addEventListener('click',()=>$('#detail').close());
document.addEventListener('click',e=>{const target=e.target.closest('[data-id]');if(target)openCard(target.dataset.id);});
$('#detail-form').addEventListener('submit',e=>{
  e.preventDefault();const updated={...editing};for(const [key,value] of new FormData(e.target))updated[key]=String(value).trim();
  if(!updated.name){notify('請填入姓名。');return;}
  const duplicate=findDuplicates(cards,updated);
  if(duplicate.length){$('#duplicate-warning').hidden=false;$('#duplicate-warning').textContent=`疑似重複：${duplicate.map(c=>c.id+' '+c.name).join('、')}。此草稿保留獨立人物，請檢查姓名與公司；未執行合併。`;notify('發現疑似重複；尚未套用。請核對姓名與公司。');return;}
  const at=cards.findIndex(c=>c.id===updated.id);if(at<0)cards.push(updated);else cards[at]=updated;
  render();$('#detail').close();notify('已套用本次頁面修改；尚未寫入 Google。');
});
const previewUrls=[];
function receive(files){let added=0,rejected=0;for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){rejected++;continue;}const url=URL.createObjectURL(file);previewUrls.push(url);const row=document.createElement('article');row.className='job';const img=document.createElement('img');img.src=url;img.alt='本次選取名片預覽';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=file.name;const detail=document.createElement('p');detail.textContent=`${(file.size/1024).toFixed(0)} KB · 僅本頁預覽，待接通辨識與保存`;info.append(name,detail);row.append(img,info);$('#jobs').append(row);added++;}notify(`本次加入 ${added} 張預覽${rejected?`；${rejected} 個檔案格式不符或超過 20 MB`:''}。尚未上傳。`);}
$('#photos').addEventListener('change',e=>receive(e.target.files));
for(const event of ['dragenter','dragover'])$('#drop-zone').addEventListener(event,e=>{e.preventDefault();$('#drop-zone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('#drop-zone').addEventListener(event,e=>{e.preventDefault();$('#drop-zone').classList.remove('dragging');if(event==='drop')receive(e.dataTransfer.files);});
window.addEventListener('beforeunload',()=>previewUrls.forEach(url=>URL.revokeObjectURL(url)));
render();
