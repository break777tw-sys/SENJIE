// A private, explicitly fictional rehearsal; no LINE/model transport exists here.
export function initConversations({transport,escape}){
  const root=document.querySelector('#conversations');
  const status=root.querySelector('[data-demo-status]'),content=root.querySelector('[data-demo-content]');
  const input=root.querySelector('[name="demo-preference"]'),form=root.querySelector('form'),save=form.querySelector('[type="submit"]');
  let preference=null,pending=null,busy=false,epoch=0;
  function clear(){epoch++;preference=null;pending=null;content.innerHTML='';input.value='';save.disabled=true;status.textContent='登入後可讀取示例。';}
  async function load(){
    if(transport?.kind!=='apps-script'){clear();return;}
    const at=++epoch;save.disabled=true;preference=null;status.textContent='正在讀取示例…';content.innerHTML='';input.value='';
    try{
      const data=await transport.conversations();if(at!==epoch)return;
      if(data.schemaVersion!==1||data.mode!=='FICTIONAL_DEMO_ONLY'||data.real.connection!=='NOT_CONNECTED'||!Array.isArray(data.conversations))throw new Error('示例資料結構不符。');
      preference=data.preference;pending=null;input.value=preference.text;
      content.innerHTML=data.conversations.map(c=>`<article class="callout"><h2>虛構對話 · ${escape(c.event_id)}</h2><p>提問：${escape(c.question)}</p><p>示例回覆：${escape(c.answer)}</p><p>未送出 LINE；未呼叫模型；未驗證同聊天室。</p><details><summary>示例時間、用量與費用</summary><p>顯示時間：${escape(c.display_time||'未知')}（虛構，非量測）</p><p>示例用量：${c.usage?escape(JSON.stringify(c.usage)):'未知'}</p><p>條件公式示例 USD：${escape(c.estimated_fee_USD||'未知')}；非帳單、非實測費用。</p><p>實際帳單：未知；可選 AI 複核：未知／未執行。</p></details></article>`).join('');
      status.textContent=`已讀取虛構示例；偏好版本 ${preference.version}。真實對話：尚未接通、沒有載入。`;save.disabled=false;
    }catch(error){if(at!==epoch)return;status.textContent=error.message;}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!preference)return;
    const text=input.value.trim();if(!text||text.length>500){status.textContent='請填入 1 至 500 字示例偏好。';return;}
    if(!pending||pending.text!==text)pending={text,expectedVersion:preference.version,requestId:crypto.randomUUID()};
    const at=epoch;busy=true;save.disabled=true;status.textContent='正在保存示例偏好…';
    try{const result=await transport.savePreference(pending);if(at!==epoch)return;preference=result.preference;pending=null;input.value=preference.text;status.textContent=`已保存並讀回示例偏好，版本 ${preference.version}。可重新讀取核對。`;}
    catch(error){if(at===epoch)status.textContent=error.message;}
    finally{busy=false;if(at===epoch)save.disabled=!preference;}
  });
  root.querySelector('[data-demo-reload]').addEventListener('click',()=>{if(!busy)load();});
  load();return {load,clear};
}
