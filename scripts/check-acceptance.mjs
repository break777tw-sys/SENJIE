import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scope=JSON.parse(await readFile(resolve(base,'deployment/acceptance-scope.json'),'utf8'));
const html=await readFile(resolve(base,'index.html'),'utf8');
const controls=[];
for(const [,tag,attrs] of html.matchAll(/<(button|input|select|textarea|a)\b([^>]*)>/g)){
 const value=name=>attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1];
 const id=value('id'),name=value('name'),view=value('data-view');
 const key=id|| (name?'field:'+name:view?'route:'+view:tag==='button'&&value('type')==='submit'?'submit:detail-form':null);
 if(key)controls.push(key);
 else if(tag!=='a')throw new Error('Interactive control needs a stable acceptance identifier: '+tag+attrs);
}
const covered=new Set(scope.cases.flatMap(c=>c.controls));
const missing=controls.filter(c=>!covered.has(c));
if(missing.length)throw new Error('Uncovered website controls: '+missing.join(', '));
const file=process.argv[2];
if(!file){console.log(JSON.stringify({scopeCovered:true,controls:controls.length,cases:scope.cases.length,wholeSitePassed:false,reason:'Actual evidence receipt required'},null,2));process.exit(2);}
const receipt=JSON.parse(await readFile(resolve(file),'utf8'));
const incomplete=[];
for(const c of scope.cases){
 if(!c.required)continue;
 for(const check of c.checks){
  const entry=receipt.checks?.[c.id+'/'+check];
  if(!entry||entry.status!=='passed'||entry.layer!=='live'||!entry.reviewer||!entry.checkedAt||!entry.evidence?.length){incomplete.push(c.id+'/'+check);continue;}
  for(const evidence of entry.evidence)try{await access(resolve(dirname(resolve(file)),evidence));}catch{incomplete.push(c.id+'/'+check+' missing evidence '+evidence);}
 }
}
console.log(JSON.stringify({scopeCovered:true,controls:controls.length,cases:scope.cases.length,wholeSitePassed:incomplete.length===0,incomplete},null,2));
if(incomplete.length)process.exitCode=2;
