import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const allowed=new Set(['readonly-client.js',...['index.html','demo.css','demo.js','demo-identity.js','demo-fixture.js','demo-signin.html','demo-signin.js'].map(n=>'experiments/github-readonly/'+n)]);
const types={'.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.html':'text/html;charset=utf-8'};
const server=createServer(async(req,res)=>{
  let name=new URL(req.url,'http://127.0.0.1').pathname.slice(1);if(name==='experiments/github-readonly/')name+='index.html';
  if(req.method!=='GET'||!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}
  try{const content=await readFile(new URL(name,root));const ext=name.slice(name.lastIndexOf('.'));res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'no-store'});res.end(content);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1',()=>console.log(`Readonly fictional candidate: http://127.0.0.1:${server.address().port}/experiments/github-readonly/`));
