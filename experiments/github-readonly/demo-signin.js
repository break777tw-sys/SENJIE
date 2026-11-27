for(const button of document.querySelectorAll('[data-identity]'))button.addEventListener('click',()=>{
  if(!window.opener){document.querySelector('#popup-status').textContent='原頁面已關閉，請回候選頁重新登入。';return;}
  window.opener.postMessage({type:'SENJIE_DEMO_IDENTITY',identity:button.dataset.identity},location.origin);
  window.close();
});
