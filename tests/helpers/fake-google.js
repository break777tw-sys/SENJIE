import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const code=['Code.gs','Imports.gs'].map(f=>readFileSync(new URL('../../google-apps-script/'+f,import.meta.url),'utf8')).join('\n');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
export function createFakeGoogle(options={}){
 let email='owner@example.test',counter=0,failSourceWrite=null,failOCR=false;
 const sheets={},files=new Map();
 function sheet(name,headers){const rows=[headers];const api={rows,getLastRow:()=>rows.length,setFrozenRows:()=>{},getRange:(r,c,n=1,w=1)=>({getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w)),getValue:()=>rows[r-1]?.[c-1],setValues:data=>{if(name==='Imports'&&failSourceWrite!==null){if(failSourceWrite--===0){failSourceWrite=null;throw Error('simulated source write failure');}}data.forEach((line,i)=>{rows[r-1+i]??=[];line.forEach((v,j)=>rows[r-1+i][c-1+j]=v);});}})};sheets[name]=api;return api;}
 sheet('Records',['人物編號','版本','請求編號','修改時間','修改者','資料JSON']);
 const blob=(bytes,mime,name)=>({getBytes:()=>Array.from(bytes),getContentType:()=>mime,setName(value){name=value;return this;},getName:()=>name});
 const addFile=(b,name)=>{const id='file-'+(++counter);const file={getId:()=>id,getUrl:()=>`https://drive.google.com/file/d/${id}/view`,getBlob:()=>b,name};files.set(id,file);return file;};
 const folder={getId:()=> 'private-folder',getFilesByName:name=>{const matching=[...files.values()].filter(f=>f.name===name);return {hasNext:()=>matching.length>0,next:()=>matching.shift()};},createFile:b=>addFile(b,b.getName())};
 const context=vm.createContext({Date,JSON,Object,String,Number,Array,Error,Set,Session:{getActiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:key=>({ALLOWED_EMAILS:'owner@example.test',SPREADSHEET_ID:'fake-sheet',IMPORT_FOLDER_ID:'private-folder'}[key])})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets[name],insertSheet:name=>sheet(name,[])}),flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Utilities:{getUuid:()=>`uuid-${++counter}`,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,bytes)=>Array.from(createHash('sha256').update(Buffer.from(bytes)).digest()),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:blob},DriveApp:{getFolderById:()=>folder,getFileById:id=>{if(!files.has(id))throw Error('not found');return files.get(id);}},Drive:{Files:{create:meta=>{if(failOCR)throw Error('OCR unavailable');return {id:addFile(blob([],meta.mimeType,meta.name),meta.name).getId()};}}},DocumentApp:{openById:()=>({getBody:()=>({getText:()=> 'Name: Fictional Person\nCompany: Example Invalid\nTel: 0900000022\ncard@example.invalid'})})}});
 vm.runInContext(options.code||code,context);
 return {c:context,sheets,files,setEmail:value=>email=value,failNextSourceWrite:(after=0)=>failSourceWrite=after,setOCRFailure:value=>failOCR=value};
}
