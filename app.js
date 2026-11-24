// Standalone preview uses synthetic data. Apps Script mode fails closed on load errors.
import { findDuplicates, demoCards } from './model.js';
import { searchPeople } from './search.js';
import { createTransport } from './transport.js';
const transport=createTransport();
let cards=transport?[]:demoCards.map(c=>({...c})), editing=null, sequence=cards.length, saving=false, pendingRequest=null, loaded=!transport;
let importSources=[],archiveRecoveries=[],reviewSources=null,importBusy=false,photoReady=false,photoOCR=false,connectionEpoch=0;
const $=s=>document.querySelector(s), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={cards:'名片資料庫',inbox:'名片收件匣',followups:'合作與追蹤',connections:'入口與資料'};
const routeLabels={home:'SENJIE 總入口',...labels};let activeView=null;
let routeScrollFrame=null;
const routeFromHash=()=>Object.hasOwn(routeLabels,window.location.hash.slice(1))?window.location.hash.slice(1):'home';
function restoreNarrowEntry(){
  if(!window.matchMedia('(max-width: 700px)').matches)return;
  const section=$('#'+activeView);
  // A direct fragment may be positioned after load. Offset the target back to
  // the document start rather than letting it skip the in-flow mobile menu.
  section.style.setProperty('--route-start',Math.max(0,section.getBoundingClientRect().top+window.scrollY)+'px');
  if(routeScrollFrame!==null)window.cancelAnimationFrame(routeScrollFrame);
  // Run after fragment positioning/layout so mobile's in-flow navigation stays visible.
  routeScrollFrame=window.requestAnimationFrame(()=>{routeScrollFrame=null;window.scrollTo(0,0);});
}
function showView(view){
  if(!Object.hasOwn(routeLabels,view))view='home';
  if(activeView===view)return;
  if($('#detail').open)$('#detail').close();
  activeView=view;const home=view==='home';
  document.querySelectorAll('.view').forEach(section=>section.hidden=section.id!==view);
  document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===view);if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('#site-brand').hidden=!home;$('#card-brand').hidden=home;$('#card-navigation').hidden=home;$('#module-crumb').hidden=home;
  $('#site-home-link').textContent=home?'SENJIE 總入口':'返回 SENJIE 總入口';
  $('#crumb').textContent=routeLabels[view];document.title=home?'SENJIE 總入口 · 開發版':routeLabels[view]+' · 名片／人脈 · SENJIE';
}
function navigate(view){
  if(!Object.hasOwn(routeLabels,view))return;
  showView(view);if(window.location.hash!=='#'+view)window.location.hash='#'+view;
  restoreNarrowEntry();
}
function render(){
  $('#count-all').textContent=cards.length;$('#count-review').textContent=cards.filter(c=>c.status==='待確認').length;$('#count-follow').textContent=cards.filter(c=>c.next).length;
  const search=searchPeople(cards,$('#search').value,$('#category').value,$('#status').value),result=search.matches.map(m=>m.card);
  $('#search-explanation').textContent=search.message;
  $('#result-count').textContent=`顯示 ${result.length} 位／共 ${cards.length} 位${transport?'':'範例'}人物`;
  $('#empty').hidden=result.length>0;
  $('#card-grid').innerHTML=search.matches.map(({card:c,evidence})=>`<button class="person-card" data-id="${escape(c.id)}" aria-label="查看${escape(c.name)}"><div class="card-art tone-${Number(c.tone)||0}"><span class="initial">${escape(c.name.slice(0,1))}</span><span class="art-label">${transport?'人物資料':'虛構範例'}</span></div><div class="card-body"><div class="card-top"><h2>${escape(c.name)}</h2><span class="badge ${c.status==='待確認'?'review':''}">${escape(c.status)}</span></div><p class="alias">${escape(c.alias||'尚無別名')}</p><div class="company">${escape(c.company||'組織待補充')}</div><p class="role">${escape(c.role||'職稱待補充')} · ${escape(c.city||'地區待補充')}</p><div class="tags"><span class="tag">${escape(c.category)}</span><span class="tag">${escape(c.offers||'資源待補充')}</span></div>${evidence?`<div class="search-evidence"><strong>符合依據</strong>${evidence.fields.map(f=>`<p>${escape(f.label)}：「${escape(f.quote)}」<small>${escape(f.confirmation)}${f.sourceIds.length?' · '+escape(f.sourceIds.join('、')):''}</small></p>`).join('')}<small>${escape(evidence.recordId)} · ${evidence.version==null?'版本未提供':'版本'+escape(evidence.version)} · ${escape(evidence.source)}</small></div>`:''}<div class="card-bottom">${escape(c.next?'下一步：'+c.next:'尚未記錄下一步')}</div></div></button>`).join('');
  const followups=cards.filter(c=>c.next).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  $('#followup-list').innerHTML=followups.length?followups.map(c=>`<article class="followup"><div><h2>${escape(c.name)} · ${escape(c.company)}</h2><p>${escape(c.next)}</p><p>追蹤日期：${escape(c.date||'未指定')} · 尚未建立提醒</p></div><button class="secondary" data-id="${escape(c.id)}">查看與修改</button></article>`).join(''):'<p class="empty">目前沒有下一步行動。</p>';
}
function originalButton(source,label='開啟 Drive 原圖'){return `<button type="button" class="secondary" data-original="${escape(source.id)}">${escape(label)}</button>`;}
function openCard(id){
  if(!loaded||saving)return;
  pendingRequest=null;
  editing=cards.find(c=>c.id===id)||{id:transport?'':`DEMO${String(++sequence).padStart(4,'0')}`,name:'',alias:'',company:'',role:'',city:'',category:'文化表演',status:'待確認',offers:'',needs:'',notes:'',next:'',date:'',phone:'',email:'',line:'',address:'',source:transport?'網站手動建檔':'本次頁面手動新增',tone:sequence%3};
  $('#detail-form').reset();
  $('#detail-title').textContent=editing.name||(transport?'新增名片':'新增範例名片');$('#detail-id').textContent=editing.id;
  for(const [key,value] of Object.entries(editing)){const input=$('#detail-form').elements.namedItem(key);if(input)input.value=value;}
  $('#duplicate-warning').hidden=true;$('#detail').showModal();
  reviewSources=null;$('#archive-confirmation').hidden=true;$('#review-evidence').hidden=true;
  $('#field-checks').innerHTML='';$('#detail-form [type="submit"]').textContent=transport?'保存至 Google':'套用本次修改';
  $('#source-links').innerHTML=(editing.provenance?.sources||[]).map(s=>`<p>${escape(s.side)} · ${originalButton(s)} · ${escape(s.id)}</p>`).join('');
}
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').hidden=true,5000);}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.view)));
document.querySelectorAll('[data-route]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();navigate(link.dataset.route);}));
$('#card-brand').addEventListener('click',event=>{event.preventDefault();navigate('cards');});
window.addEventListener('hashchange',()=>{showView(routeFromHash());restoreNarrowEntry();});
window.addEventListener('load',restoreNarrowEntry);
window.addEventListener('pageshow',restoreNarrowEntry);
showView(routeFromHash());restoreNarrowEntry();
for(const selector of ['#search','#category','#status'])$(selector).addEventListener('input',render);
$('#layout').addEventListener('click',()=>{const list=$('#card-grid').classList.toggle('list');$('#layout').textContent=list?'切換卡片':'切換列表';$('#layout').setAttribute('aria-pressed',String(list));});
$('#new-card').addEventListener('click',()=>openCard(null));$('#close-detail').addEventListener('click',()=>$('#detail').close());
document.addEventListener('click',async e=>{
  const original=e.target.closest('[data-original]');
  if(original){
    if(!transport||!loaded)return;
    const epoch=connectionEpoch,viewer=window.open('about:blank','_blank');
    if(!viewer){notify('請允許開啟原圖視窗。');return;}viewer.opener=null;
    try{const result=await transport.original(original.dataset.original);if(epoch!==connectionEpoch||!loaded)throw new Error('請重新登入後開啟原圖。');viewer.location.href=result.url;}
    catch(error){viewer.close();notify(error.message);}return;
  }
  const target=e.target.closest('[data-id]');if(target)openCard(target.dataset.id);
});
$('#detail-form').addEventListener('submit',async e=>{
  e.preventDefault();const updated={...editing};for(const [key,value] of new FormData(e.target))updated[key]=String(value).trim();
  if(saving)return;
  if(!updated.name){notify('請填入姓名。');return;}
  const duplicate=findDuplicates(cards,updated);
  if(duplicate.length){$('#duplicate-warning').hidden=false;$('#duplicate-warning').textContent=`疑似重複：${duplicate.map(c=>c.id+' '+c.name).join('、')}。此草稿保留獨立人物，請檢查姓名與公司；未執行合併。`;notify('發現疑似重複；尚未套用。請核對姓名與公司。');return;}
  const submit=e.target.querySelector('[type="submit"]');saving=true;submit.disabled=true;
  try{
    let saved=updated;
    if(transport){
      const fingerprint=JSON.stringify(updated);
      if(!pendingRequest||pendingRequest.fingerprint!==fingerprint)pendingRequest={fingerprint,id:crypto.randomUUID()};
      const response=reviewSources?await transport.archive({requestId:pendingRequest.id,card:updated,sources:reviewSources,confirmed:$('#confirm-one-card').checked,reviewedFields:[...document.querySelectorAll('#field-checks input:checked')].map(i=>i.value)}):await transport.save({id:editing.id||null,expectedVersion:editing.version||0,requestId:pendingRequest.id,card:updated});
      saved=response.record;
    }
    const at=cards.findIndex(c=>c.id===saved.id);if(at<0)cards.push(saved);else cards[at]=saved;
    render();$('#detail').close();notify(transport?'已保存至 Google，並通過讀回驗證。':'已套用本次頁面修改；尚未寫入 Google。');
    if(reviewSources)await loadImports();
  }catch(error){
    const message=error.message||'保存失敗，未確認歸檔。';
    if(reviewSources&&transport){
      try{await loadImports();
        if(archiveRecoveries.some(r=>r.sources.some(s=>reviewSources.some(x=>x.id===s.id)))){
          $('#detail').close();notify('人物已保存，來源尚未完成。請到收件匣「續辦來源歸檔」，不必重新建人。');
        }else notify(message);
      }catch{notify(message+' 請重新讀取收件匣檢查續辦項目。');}
    }else notify(message);
  }
  finally{saving=false;submit.disabled=false;}
});
const previewUrls=[];
const fileData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('無法讀取圖片。'));reader.readAsDataURL(file);});
async function receive(files){
  if(!transport||!loaded||!photoReady){notify('照片上傳尚未開放；未送出圖片。');return;}
  if(importBusy){notify('上一批仍在處理，請稍候。');return;}
  const epoch=connectionEpoch;importBusy=true;$('#photos').disabled=true;let added=0,rejected=0;const batchId=crypto.randomUUID();
  try{for(const file of files){
    if(epoch!==connectionEpoch||!loaded)break;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024||file.name.length>180){rejected++;continue;}
    $('#import-progress').textContent=`正在保存：${file.name}（完成 ${added} 張）`;
    const request={requestId:crypto.randomUUID(),batchId,name:file.name,mime:file.type,data:await fileData(file)};
    if(epoch!==connectionEpoch||!loaded)break;
    // Keep the exact operation available for a retry after an ambiguous network result.
    let response;
    try{response=await transport.upload(request);}catch(error){if(epoch===connectionEpoch&&loaded)window.pendingPhotoRetry=request;throw error;}
    if(epoch!==connectionEpoch||!loaded)break;
    added++;await loadImports();
    if(photoOCR&&!['ready','archived'].includes(response.source.state)){
      $('#import-progress').textContent=`原圖已保存，正在辨識：${file.name}`;
      const recognized=await transport.recognize(response.source.id,{data:request.data,mime:request.mime});await loadImports();
      if(recognized.manualReview)notify('原圖已保存，請選取來源、逐欄核對後歸檔。');
    }else if(!photoOCR)notify('原圖已保存，請選取來源、逐欄核對後歸檔。');
  }}catch(error){notify(error.message);}
  finally{importBusy=false;$('#photos').disabled=!loaded||!photoReady;$('#photos').value='';if(epoch!==connectionEpoch)return;$('#import-progress').textContent=`批次 ${batchId}：完成 ${added} 次收件${rejected?`；拒絕 ${rejected} 個格式／大小不符檔案`:''}。關閉頁面會中止未上傳部分；已保存來源可重新讀取。`;$('#retry-upload').hidden=!window.pendingPhotoRetry;}
}
function renderImports(){
  $('#archive-recoveries').innerHTML=archiveRecoveries.map(r=>`<article class="callout"><strong>人物已保存，來源待補齊：${escape(r.personName)}</strong><p>${escape(r.personId)} · ${r.sources.length} 面來源，待補 ${r.pendingSourceIds.length} 面。續辦沿用原人物及確認回條。</p>${r.blockedReason?`<p>${escape(r.blockedReason)}</p>`:`<button type="button" class="primary" data-resume="${escape(r.requestId)}">續辦來源歸檔</button>`}</article>`).join('');
  const receipts=importSources.reduce((n,s)=>n+s.receipts.length,0),archived=importSources.filter(s=>s.state==='archived');
  $('#import-counts').textContent=`累計收件 ${receipts} 次 · 不重複原圖 ${importSources.length} 張 · 已確認實體卡 ${new Set(archived.map(s=>s.physicalCardId)).size} 張 · 已歸檔人物 ${new Set(archived.map(s=>s.personId)).size} 位`;
  $('#jobs').innerHTML=importSources.map(s=>`<article class="job"><div class="job-info"><strong>${escape(s.receipts[0].name)}</strong><p>${escape(s.id)} · 收件 ${s.receipts.length} 次 · ${escape(({saved:'原圖已保存',recognizing:'辨識待續',ready:'辨識完成／待確認',error:'辨識未完成',archived:'已確認歸檔'})[s.state])}</p>${originalButton(s)}<p>${escape(s.error||'')} · QR ${escape(s.qrStatus)}</p><details><summary>辨識原文與疑義</summary><pre>${escape(s.ocrText||'尚無可用辨識文字；可對照原圖手動確認。')}</pre><p>自動候選值仍待逐欄核對。無法確定的欄位留白；一張照片含多張實體卡時請先拆分，不可整張歸為一人。</p></details>${s.state==='archived'?`<p>實體卡 ${escape(s.physicalCardId)} · 人物 ${escape(s.personId)}</p>`:`<label><input type="checkbox" data-source="${escape(s.id)}"> 選取此來源</label><label>面別<select data-side="${escape(s.id)}"><option>正面</option><option>反面</option><option>補充</option></select></label>${photoOCR?`<button type="button" class="secondary" data-recognize="${escape(s.id)}">重新辨識／續辦</button>`:``}`}</div></article>`).join('');
}
async function loadImports(){
  const epoch=connectionEpoch;
  try{const result=await transport.imports();if(epoch!==connectionEpoch||!loaded)return;importSources=result.sources;archiveRecoveries=result.recoveries||[];renderImports();}
  catch(error){if(epoch!==connectionEpoch)return;importSources=[];archiveRecoveries=[];renderImports();$('#import-progress').textContent=error.message;throw error;}
}
$('#archive-recoveries').addEventListener('click',async e=>{
  const button=e.target.closest('[data-resume]');if(!button||importBusy||saving)return;
  importBusy=true;button.disabled=true;
  try{
    const result=await transport.resume(button.dataset.resume),at=cards.findIndex(c=>c.id===result.record.id);
    if(at<0)cards.push(result.record);else cards[at]=result.record;
    render();await loadImports();notify('已補齊來源歸檔，保留原人物與實體卡編號。');
  }catch(error){notify(error.message);try{await loadImports();}catch{}}
  finally{importBusy=false;button.disabled=false;}
});
$('#reload-imports').addEventListener('click',()=>loadImports().catch(error=>notify(error.message)));
$('#retry-upload').addEventListener('click',async()=>{if(importBusy||!loaded||!photoReady||!window.pendingPhotoRetry)return;importBusy=true;try{await transport.upload(window.pendingPhotoRetry);window.pendingPhotoRetry=null;$('#retry-upload').hidden=true;await loadImports();notify('原圖重試已讀回；可繼續辨識。');}catch(error){notify(error.message);}finally{importBusy=false;}});
$('#jobs').addEventListener('click',async e=>{const id=e.target.closest('[data-recognize]')?.dataset.recognize;if(!id||importBusy)return;importBusy=true;try{notify('正在辨識已保存的原圖。');await transport.recognize(id);await loadImports();}catch(error){notify(error.message);}finally{importBusy=false;}});
$('#review-selected').addEventListener('click',()=>{
  if(importBusy||!loaded)return;
  const selected=[...document.querySelectorAll('[data-source]:checked')].map(i=>({id:i.dataset.source,side:document.querySelector(`[data-side="${i.dataset.source}"]`).value}));
  if(!selected.length||selected.length>10){notify('請選取同一張實體名片的 1–10 張來源。');return;}
  if(archiveRecoveries.some(r=>r.sources.some(s=>selected.some(x=>x.id===s.id)))){notify('這些來源的人物已保存，請先使用收件匣的「續辦來源歸檔」。');return;}
  openCard(null);reviewSources=selected;editing.status='已確認';
  $('#detail-title').textContent='核對同一張名片後歸檔';$('#detail-form').elements.status.value='已確認';
  $('#archive-confirmation').hidden=false;$('#review-evidence').hidden=false;$('#confirm-one-card').checked=false;
  $('#detail-form [type="submit"]').textContent='確認並歸檔至 Google';
  const sources=selected.map(s=>importSources.find(x=>x.id===s.id));
  for(const key of ['name','company','role','phone','email','address']){const values=[...new Set(sources.map(s=>s.candidates[key]).filter(Boolean))];if(values.length===1)$('#detail-form').elements[key].value=values[0];}
  $('#review-evidence').innerHTML=sources.map(s=>`<p>${originalButton(s,'對照原圖：'+s.receipts[0].name)}</p><pre>${escape(s.ocrText||'尚無辨識原文，請直接核對原圖。')}</pre>`).join('');
  $('#field-checks').innerHTML=[...$('#detail-form').elements].filter(i=>i.name&&i.name!=='source').map(i=>`<label><input type="checkbox" value="${escape(i.name)}"> 已核對「${escape(i.closest('label')?.childNodes[0].textContent||i.name)}」</label>`).join('');
});
$('#detail-form').addEventListener('input',e=>{if(reviewSources&&e.target.name){const check=document.querySelector(`#field-checks input[value="${e.target.name}"]`);if(check)check.checked=false;pendingRequest=null;}});
$('#photos').addEventListener('change',e=>receive(e.target.files));
for(const event of ['dragenter','dragover'])$('#drop-zone').addEventListener(event,e=>{e.preventDefault();$('#drop-zone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('#drop-zone').addEventListener(event,e=>{e.preventDefault();$('#drop-zone').classList.remove('dragging');if(event==='drop')receive(e.dataTransfer.files);});
window.addEventListener('beforeunload',()=>previewUrls.forEach(url=>URL.revokeObjectURL(url)));
render();
async function refresh(){
  if(!transport)return;
  const epoch=connectionEpoch;loaded=false;photoReady=false;$('#photos').disabled=true;$('#new-card').disabled=true;
  $('.mode').textContent='正在讀取 Google';
  try{
    const response=await transport.list();
    if(epoch!==connectionEpoch)return;
    if(response.schemaVersion!==1||!Array.isArray(response.cards))throw new Error('資料結構不符，停止載入。');
    cards=response.cards;loaded=true;render();
    photoReady=response.capabilities?.photoImport===true&&transport.session?.capabilities?.photoImport!==false;
    photoOCR=response.capabilities?.photoOCR===true;
    $('#photos').disabled=!photoReady;
    $('#photo-access-note').hidden=photoReady;
    $('.mode').textContent='Google 資料已讀取';
    $('.notice').hidden=false;
    $('.notice').textContent=`${response.dataLabel||'Google 資料'} · 讀取時間 ${new Date(response.readAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}。${photoReady?'照片請到收件匣保存並確認。':'目前可手動建檔與查詢；照片上傳尚未開放。'}`;
    await loadImports();
  }catch(error){
    if(epoch!==connectionEpoch)return;
    loaded=false;cards=[];importSources=[];archiveRecoveries=[];render();renderImports();$('.mode').textContent='Google 讀取失敗';
    $('.notice').hidden=false;
    $('.notice').textContent=error.message+' 本頁未顯示舊資料或示範名片。';
  }finally{$('#new-card').disabled=!loaded;}
}
$('#refresh').addEventListener('click',refresh);
if(transport){
  $('#new-card').textContent='＋ 新增名片';
  $('.detail-notice').textContent='此頁經 Google 授權讀寫；儲存時會檢查版本。';
  $('#detail-form [type="submit"]').textContent='保存至 Google';
  $('#refresh').hidden=false;
  document.querySelector('[data-connection="sheets"]').textContent='正在驗證';
  if(transport.kind==='redirect'){
    $('#auth-panel').hidden=false;
    transport.onConnectionChange(({connected,session})=>{
      if(document.documentElement)document.documentElement.dataset.auth=connected?'signed-in':'signed-out';
      $('#site-login').hidden=connected;$('#site-logout').hidden=!connected;
      $('#auth-status').textContent=connected?'已登入 '+session.email:'使用 Google 帳號登入';
      $('#refresh').disabled=!connected;
      if(!connected){
        connectionEpoch++;photoReady=false;photoOCR=false;window.pendingPhotoRetry=null;$('#retry-upload').hidden=true;$('#photos').value='';$('#import-progress').textContent='';
        previewUrls.splice(0).forEach(url=>URL.revokeObjectURL(url));
        $('#search').value='';$('#category').value='';$('#status').value='';$('#toast').textContent='';$('#toast').hidden=true;
        cards=[];importSources=[];archiveRecoveries=[];reviewSources=null;loaded=false;editing=null;pendingRequest=null;
        $('#detail').close();$('#detail-form').reset();$('#new-card').disabled=true;$('#photos').disabled=true;
        $('#source-links').innerHTML='';$('#review-evidence').innerHTML='';$('#field-checks').innerHTML='';
        render();renderImports();$('.mode').textContent='尚未登入';$('.notice').textContent='';$('.notice').hidden=true;
        document.querySelector('[data-connection="sheets"]').textContent='登入後讀取';
      }
    });
    $('#site-login').addEventListener('click',async()=>{
      $('#site-login').disabled=true;$('#auth-status').textContent='正在登入…';
      try{await transport.login();await refresh();document.querySelector('[data-connection="sheets"]').textContent=loaded?'已讀取 Google 資料':'讀取失敗';}
      catch(error){$('#auth-status').textContent=error.message;}
      finally{$('#site-login').disabled=false;}
    });
    $('#site-logout').addEventListener('click',()=>{if(saving||importBusy){notify('請等待目前保存完成後再登出。');return;}transport.logout();});
  }else{
    if(document.documentElement)document.documentElement.dataset.auth='signed-in';
    $('#auth-panel').hidden=false;$('#site-login').hidden=true;$('#site-logout').hidden=true;
    $('#auth-status').textContent='已使用 Google 帳號登入';$('#site-entry').hidden=false;
    $('#site-entry').addEventListener('click',event=>{if(saving||importBusy){event.preventDefault();notify('請等待目前保存完成後再返回。');}});
    refresh().then(()=>document.querySelector('[data-connection="sheets"]').textContent=loaded?'已讀取 Google 資料':'讀取失敗');
  }
}else if(document.documentElement){
  document.documentElement.dataset.auth='demo';
  $('.notice').hidden=false;$('.notice').textContent='全部使用虛構範例。修改僅保留於本次頁面，重新整理即還原。';
}
