// Minimal DOM facsimile for executing the real app/transport event handlers.
// This is not a browser, layout test, Google RPC or independent acceptance.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const source=['model.js','search.js','transport.js','conversations.js','app.js'].map(f=>readFileSync(new URL('../../'+f,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
class Element{
 constructor(id=''){this.id=id;this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.dataset={};this.handlers={};this.textContent='';this._html='';this.attributes=new Map();const classes=new Set();this.classList={toggle:(name,force)=>{const enabled=force??!classes.has(name);enabled?classes.add(name):classes.delete(name);return enabled;},add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)};}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 async emit(type,target=this){for(const fn of this.handlers[type]||[])await fn({target,preventDefault(){}});}
 click(){return this.emit('click');}
 closest(selector){if(selector==='[data-resume]'&&this.dataset.resume)return this;if(selector==='[data-recognize]'&&this.dataset.recognize)return this;if(selector==='[data-id]'&&this.dataset.id)return this;if(selector==='[data-original]'&&this.dataset.original)return this;return null;}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 getAttribute(name){return this.attributes.get(name)??null;}
 removeAttribute(name){this.attributes.delete(name);}
 set innerHTML(value){this._html=value;}
 get innerHTML(){return this._html;}
}
export async function mountApp(backend,options={}){
 const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
 for(const key of ['.mode','.notice','.brand','.detail-notice','[data-connection="sheets"]'])nodes.set(key,new Element(key));
 const views=[...html.matchAll(/<section\b([^>]*\bid="([^"]+)"[^>]*\bclass="view"[^>]*)>/g)].map(m=>{const node=nodes.get(m[2]);node.hidden=/\bhidden\b/.test(m[1]);return node;});
 const buttons=[...html.matchAll(/<button\b[^>]*\bdata-view="([^"]+)"[^>]*>/g)].map(m=>{const node=new Element();node.dataset.view=m[1];return node;});
 const links=[...html.matchAll(/<a\b([^>]*\bid="([^"]+)"[^>]*\bdata-route="([^"]+)"[^>]*)>/g)].map(m=>{const node=nodes.get(m[2]);node.dataset.route=m[3];node.setAttribute('href',m[1].match(/href="([^"]+)"/)[1]);return node;});
 const brand=nodes.get('card-brand');brand.setAttribute('href','#cards');
 const fields=[...html.slice(html.indexOf('<form id="detail-form"')).matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map(m=>{const f=new Element();f.name=m[1];return f;});
 fields.namedItem=name=>fields.find(f=>f.name===name)||null;for(const f of fields)fields[f.name]=f;
 const form=nodes.get('detail-form'),submit=new Element('submit');form.elements=fields;form.reset=()=>fields.forEach(f=>f.value=f.name==='status'?'待確認':'');form.querySelector=()=>submit;
 const detail=nodes.get('detail');detail.open=false;detail.showModal=()=>detail.open=true;detail.close=()=>detail.open=false;
 const checks=nodes.get('field-checks');Object.defineProperty(checks,'innerHTML',{get(){return this._html;},set(value){this._html=value;this.inputs=[...value.matchAll(/value="([^"]+)"/g)].map(m=>{const input=new Element();input.value=m[1];return input;});}});
 let selected=[];const sides=new Map();
 const document={
  documentElement:{dataset:{runtime:'connected'}},
  querySelector(selector){
   if(selector==='#detail-form [type="submit"]')return submit;
   if(selector.startsWith('#field-checks input[value='))return checks.inputs?.find(c=>selector.includes('"'+c.value+'"'))||null;
   if(selector.startsWith('[data-side='))return sides.get(selector.match(/"([^"]+)"/)[1]);
   return nodes.get(selector.startsWith('#')?selector.slice(1):selector)||null;
  },
  querySelectorAll(selector){if(selector==='[data-source]:checked')return selected;if(selector==='#field-checks input:checked')return checks.inputs?.filter(i=>i.checked)||[];if(selector==='.view')return views;if(selector==='[data-view]')return buttons;if(selector==='[data-route]')return links;return [];},
  handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},
 };
 const demoNodes=new Map();
 for(const selector of ['[data-demo-status]','[data-demo-content]','[name="demo-preference"]','form','[type="submit"]','[data-demo-reload]'])demoNodes.set(selector,new Element(selector));
 demoNodes.get('form').querySelector=selector=>demoNodes.get(selector);
 nodes.get('conversations').querySelector=selector=>demoNodes.get(selector);
 const calls=[];
 const bridge=new Proxy({},{get(_,method){if(method==='withSuccessHandler')return success=>({withFailureHandler:failure=>new Proxy({},{get:(_,name)=>payload=>{calls.push({name,payload});Promise.resolve().then(()=>backend.c[name](payload==null?payload:JSON.parse(JSON.stringify(payload)))).then(result=>success(JSON.parse(JSON.stringify(result))),failure);}})});}});
 const frames=new Map();let frameId=0;const scrollCalls=[];
 const opened=[];const window={open:()=>{const viewer={opener:{},location:{href:'about:blank'},closed:false,close(){this.closed=true;}};opened.push(viewer);return viewer;},location:{hash:options.hash||''},innerWidth:options.width??1280,scrollY:options.scrollY??0,handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},matchMedia(){return {matches:this.innerWidth<=700};},requestAnimationFrame(fn){frames.set(++frameId,fn);return frameId;},cancelAnimationFrame(id){frames.delete(id);},scrollTo(x,y){scrollCalls.push({x,y});this.scrollY=y;}};
 for(const view of views){const properties=new Map();view.style={setProperty:(name,value)=>properties.set(name,value),getPropertyValue:name=>properties.get(name)||''};view.getBoundingClientRect=()=>({top:486-window.scrollY});}
 const flushFrames=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 const context=vm.createContext({document,window,google:options.popupTransport?undefined:{script:{run:bridge}},createSignInTransport:()=>options.popupTransport,FileReader:options.FileReader,crypto:{randomUUID},FormData:class{constructor(target){return target.elements.map(f=>[f.name,f.value]);}},Date,console,URL:{revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(options.script||source,context);
 const settled=()=>new Promise(resolve=>setImmediate(resolve));await settled();await settled();flushFrames();
 return {nodes,demoNodes,form,fields,submit,calls,context,settled,opened,flushFrames,scrollCalls,navigation:{views,buttons,links},
  async navigate(view){const control=buttons.find(b=>b.dataset.view===view)||links.find(l=>l.dataset.route===view);if(!control)throw new Error('No navigation control: '+view);await control.click();flushFrames();},
  async emitWindow(type){for(const fn of window.handlers[type]||[])await fn();flushFrames();},
  async setHash(hash){window.location.hash=hash;for(const fn of window.handlers.hashchange||[])await fn();flushFrames();},
  async openPerson(id){const target=new Element();target.dataset.id=id;for(const fn of document.handlers.click||[])await fn({target});},
  async openOriginal(id){const target=new Element();target.dataset.original=id;for(const fn of document.handlers.click||[])await fn({target});},
  selectSources(sources){selected=sources.map((s,i)=>{const node=new Element();node.dataset.source=s.id;const side=new Element();side.value=i?'反面':'正面';sides.set(s.id,side);return node;});},
  async openReview(){await nodes.get('review-selected').click();},
  confirmFields(){checks.inputs.forEach(c=>c.checked=true);nodes.get('confirm-one-card').checked=true;},
  async save(){await form.emit('submit');await settled();},
  async resume(requestId){const button=new Element();button.dataset.resume=requestId;await nodes.get('archive-recoveries').emit('click',button);await settled();},
 };
}
