import fs from 'fs';

const bundlePath = fs.readdirSync('web/dist/assets').find(f => f.endsWith('.js'));
const bundle = fs.readFileSync(`web/dist/assets/${bundlePath}`, 'utf8');

// We will look for common React errors in the bundle string if possible, or just evaluate it.
// Actually, let's just evaluate it in a JSDOM environment without external CSS.
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div><script>${bundle}</script></body></html>`, {
  runScripts: "dangerously",
});

dom.window.console.error = (...args) => console.log('ERROR:', ...args);
dom.window.console.warn = (...args) => console.log('WARN:', ...args);
dom.window.console.log = (...args) => console.log('LOG:', ...args);
dom.window.addEventListener('error', (e) => {
  console.log('UNCAUGHT EXCEPTION:', e.error || e.message);
});

setTimeout(() => {
  console.log('ROOT HTML:', dom.window.document.getElementById('root').innerHTML);
}, 2000);
