// DOM facsimile only: native browser and real Google opening require live proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFakeGoogle} from './helpers/fake-google.js';
import {mountApp} from './helpers/app-dom.js';
const image=JSON.parse(readFileSync(new URL('./fixtures/photo-cards.json',import.meta.url),'utf8')).files[0];
function setup(){
 const env=createFakeGoogle({properties:{PHOTO_IMPORTS_ENABLED:'true',PHOTO_OCR_ENABLED:'false'}});
 const source=env.c.uploadPhoto({requestId:'original-link-upload-0001',batchId:'original-link-batch-00001',name:'fictional.png',mime:'image/png',data:image.base64}).source;
 return {env,source};
}
test('收件匣事先核對原圖，使用一般安全連結，完全不需要空白彈出視窗',async()=>{
 const {env,source}=setup(),page=await mountApp(env);await page.navigate('inbox');await page.settled();await page.settled();
 page.context.window.open=()=>{throw Error('Browser blocked popup');};
 const link=page.originalLinks().find(link=>link.dataset.original===source.id);assert.ok(link,'must render an actual anchor');
 assert.equal(link.getAttribute('href'),source.originalUrl);assert.equal(link.getAttribute('target'),'_blank');assert.equal(link.getAttribute('rel'),'noopener noreferrer');
 const click=await page.openOriginal(source.id);assert.equal(click.prevented,false);assert.equal(page.opened.length,0);
});
test('尚未核對完成時不開空白頁；核對完成後同一控制項成為可直接開啟的連結',async()=>{
 const {env,source}=setup();let finish;const verify=env.c.verifyPhoto;env.c.verifyPhoto=req=>new Promise(resolve=>{finish=()=>resolve(verify(req));});
 const page=await mountApp(env);await page.navigate('inbox');await page.settled();
 const link=page.originalLinks().find(link=>link.dataset.original===source.id);assert.ok(link);assert.equal(link.getAttribute('href'),null);assert.equal(page.opened.length,0);
 finish();await page.settled();await page.settled();assert.equal(link.getAttribute('href'),source.originalUrl);
});
test('核對原圖遭拒後清空快取，晚到的舊連結也不能回填',async()=>{
 const {env,source}=setup();let finish;const verify=env.c.verifyPhoto;const result=verify({sourceId:source.id});env.c.verifyPhoto=()=>new Promise(resolve=>{finish=()=>resolve(result);});
 const page=await mountApp(env);await page.navigate('inbox');await page.settled();env.setEmail('stranger@example.invalid');await page.nodes.get('refresh').click();await page.settled();finish();await page.settled();await page.settled();
 assert.equal(page.originalLinks().length,0);assert.equal(page.nodes.get('jobs').innerHTML,'');assert.equal(page.opened.length,0);
});
