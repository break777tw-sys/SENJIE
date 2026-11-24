import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');
let html=await read('index.html');
const css=await read('style.css');
const modules=await Promise.all(['model.js','search.js','site-config.js','popup-transport.js','transport.js','conversations.js','app.js'].map(read));
const script=modules.map(s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
html=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`)
 .replace('<script type="module" src="app.js"></script>',`<script>(()=>{\n${script.replace(/<\/script/gi,'<\\/script')}\n})();</script>`);
await mkdir(new URL('dist/',base),{recursive:true});
await writeFile(new URL('dist/index.html',base),html);
await writeFile(new URL('google-apps-script/Index.html',base),html);
console.log('Built self-contained preview and Apps Script HTML; no external assets.');
