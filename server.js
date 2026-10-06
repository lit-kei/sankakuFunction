import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {'/':'index.html','/style.css':'style.css','/app.js':'app.js','/math.js':'math.js','/math-render.js':'math-render.js','/battle.html':'battle.html','/battle.js':'battle.js','/battle.css':'battle.css','/battle-engine.js':'battle-engine.js','/rematch-model.js':'rematch-model.js','/battle-demo.js':'battle-demo.js','/battle-firebase.js':'battle-firebase.js','/firebase-config.js':'firebase-config.js','/firebase-client.js':'firebase-client.js','/account-model.js':'account-model.js','/account.html':'account.html','/account.js':'account.js','/account.css':'account.css','/rankings.html':'rankings.html','/rankings.js':'rankings.js'};
createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try {const body=await readFile(new URL(file,import.meta.url));res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript');res.end(body);}catch{res.writeHead(500);res.end('Server error');}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Trigonometry quiz listening on port '+(process.env.PORT||3000)));
