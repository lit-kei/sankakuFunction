import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {'/':'index.html','/style.css':'style.css','/app.js':'app.js','/math.js':'math.js'};
createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try {const body=await readFile(new URL(file,import.meta.url));res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript');res.end(body);}catch{res.writeHead(500);res.end('Server error');}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Trigonometry quiz listening on port '+(process.env.PORT||3000)));
