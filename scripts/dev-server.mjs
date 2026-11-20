import { createServer } from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
console.log(server.resolvedUrls.local[0]);
