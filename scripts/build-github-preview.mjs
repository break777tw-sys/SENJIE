import {readFile,mkdir,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),folder=new URL('experiments/github-main/',root);
let html=await readFile(new URL('index.html',root),'utf8');
html=html.replace('data-runtime="connected"','data-runtime="demo"')
 .replace('href="style.css"','href="../../style.css"')
 .replace('src="app.js"','src="preview.js"')
 .replace('<main>','<main><section class="callout" role="status"><strong>GitHub 主介面候選 · 全部虛構資料</strong><p>此頁所有畫面留在 GitHub 網址；尚未連接私人 Google 資料或真正 AI。請勿輸入真實聯絡資料。名片修改只留本頁；示例偏好只存此瀏覽器。</p></section>')
 .replace('input id="photos" type="file"','input id="photos" disabled type="file"');
const code=await readFile(new URL('google-apps-script/Conversations.gs',root),'utf8');
const examples=vm.runInNewContext(code.slice(0,code.indexOf('function demoPreferenceSheet_'))+'\nconversationExamples_();');
await mkdir(folder,{recursive:true});await writeFile(new URL('index.html',folder),html);await writeFile(new URL('fixtures.json',folder),JSON.stringify(examples,null,2)+'\n');
console.log('Built GitHub-only fictional preview; no credentials or real-data endpoint configured.');
