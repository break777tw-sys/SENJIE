import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFakeGoogle} from './helpers/fake-google.js';
const code=['Code.gs','Imports.gs','PhotoDrive.gs','WebsiteBridge.gs'].map(f=>readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8')).join('\n');
function setup(){
 const e=createFakeGoogle({code});let files=[],creates=0;
 e.c.PropertiesService={getScriptProperties:()=>({getProperty:k=>e.properties[k],setProperty:(k,v)=>e.properties[k]=v})};
 e.c.ScriptApp={AuthMode:{FULL:'FULL'},AuthorizationStatus:{NOT_REQUIRED:'ok'},getAuthorizationInfo:()=>({getAuthorizationStatus:()=> 'ok'})};
 e.c.Drive.Files.list=()=>({files});
 e.c.Drive.Files.create=meta=>{creates++;files=[{id:'setup-folder',name:meta.name,parents:['my-drive'],appProperties:meta.appProperties,mimeType:meta.mimeType,capabilities:{canAddChildren:true}}];return files[0];};
 e.c.Drive.Files.get=id=>{assert.equal(id,'setup-folder');return files[0];};
 return {...e,files:()=>files,creates:()=>creates};
}
test('專用收件資料夾設定可重試，空資料夾準備不開放上傳也不改原目的地',()=>{
 const e=setup();e.c.preparePhotoInbox();e.c.preparePhotoInbox();
 assert.equal(e.creates(),1);assert.equal(e.properties.IMPORT_FOLDER_ID,'private-folder');assert.notEqual(e.properties.PHOTO_IMPORTS_ENABLED,'true');assert.equal(e.properties.PHOTO_SETUP_FOLDER_ID,'setup-folder');assert.equal(e.sheets.Imports,undefined);
});
test('未歸入指定收集資料夾時不能啟用，歸位並核對後才改上傳目的地',()=>{
 const e=setup();e.c.preparePhotoInbox();assert.throws(()=>e.c.activatePhotoInbox(),/inside the dedicated collection/);
 assert.equal(e.properties.IMPORT_FOLDER_ID,'private-folder');assert.notEqual(e.properties.PHOTO_IMPORTS_ENABLED,'true');
 e.files()[0].parents=['private-folder'];assert.equal(e.c.activatePhotoInbox().ready,true);assert.equal(e.properties.IMPORT_FOLDER_ID,'setup-folder');assert.equal(e.properties.PHOTO_IMPORTS_ENABLED,'true');
});
test('案外身分不能建立或啟用收件資料夾',()=>{
 const e=setup();e.setEmail('stranger@example.test');for(const method of ['preparePhotoInbox','activatePhotoInbox'])assert.throws(()=>e.c[method](),/拒絕存取/);assert.equal(e.creates(),0);assert.equal(e.properties.PHOTO_SETUP_FOLDER_ID,undefined);
});
