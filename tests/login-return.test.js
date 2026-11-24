import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GOOGLE_SIGN_IN_URL} from '../site-config.js';
import {mountApp} from './helpers/app-dom.js';
import {createFakeGoogle} from './helpers/fake-google.js';
const html=readFileSync(new URL('../google-apps-script/WebsiteBridge.html',import.meta.url),'utf8');
test('舊連線網址提供可直接導覽的Google工作頁連結，不再依賴opener或focus',()=>{
 assert.equal(html.match(/href="([^"]+)"/)[1],GOOGLE_SIGN_IN_URL);assert.match(html,/target="_top"/);assert.doesNotMatch(html,/<script|opener|focus|正在返回|請保留/);
});
test('Google工作頁直接讀取資料並提供返回入口，不要求再開連線視窗',async()=>{
 const page=await mountApp(createFakeGoogle());assert.equal(page.nodes.get('auth-panel').hidden,false);assert.equal(page.nodes.get('site-login').hidden,true);assert.equal(page.nodes.get('site-entry').hidden,false);assert.equal(page.nodes.get('auth-status').textContent,'已使用 Google 帳號登入');assert.ok(page.calls.some(x=>x.name==='listCards'));
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(index,/id="site-entry"[^>]+href="https:\/\/break777tw-sys.github.io\/SENJIE\/"[^>]+target="_top"/);
});
