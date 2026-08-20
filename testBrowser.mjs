import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('web/dist/index.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/"
});

dom.window.console.error = (msg, ...args) => {
  console.log('[BROWSER ERROR]', msg, ...args);
};

dom.window.addEventListener('error', (event) => {
  console.log('[BROWSER UNCAUGHT]', event.error);
});

setTimeout(() => {
  console.log('App HTML after 2s:');
  console.log(dom.window.document.getElementById('root').innerHTML);
}, 2000);
