/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Temporary password gate for pre-release QA. Set SITE_PASSWORD at build time to add it to every page.
 *
 * This is a soft gate: the page asks for a password in the browser and checks it against a salted SHA-256 hash
 * that is embedded in the page. It keeps casual visitors and search engines out (pages are also marked noindex),
 * but it is NOT real access control: the files can still be fetched by anyone who knows their URLs, and the
 * source code is public anyway. For real protection, host behind something like Cloudflare Access.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function makeGate(password) {
  const salt = randomBytes(8).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  // runs in <head> before anything else: hide the page until the password was entered once in this browser
  const script = `<meta name="robots" content="noindex,nofollow"><script>(function(){
var K='hodoku-gate',S='${salt}',H='${hash}',d=document.documentElement;
try{if(localStorage.getItem(K)===H)return}catch(e){}
d.style.visibility='hidden';
function hex(b){return Array.from(new Uint8Array(b)).map(function(x){return ('0'+x.toString(16)).slice(-2)}).join('')}
function ask(){
 var o=document.createElement('div');
 o.style.cssText='position:fixed;inset:0;z-index:2147483647;visibility:visible;display:flex;align-items:center;justify-content:center;background:#12151c;color:#e8ebf3;font:16px system-ui,sans-serif';
 o.innerHTML='<form style="display:grid;gap:12px;width:min(320px,86vw)"><strong style="font-size:1.2rem">Hodoku Revisited</strong><span>Pre-release preview. Enter the password to continue.</span><input type="password" autocomplete="current-password" aria-label="Password" style="padding:10px;border-radius:8px;border:1px solid #4a526a;font:inherit"><button style="padding:10px;border-radius:8px;border:0;background:#2b5fb3;color:#fff;font:inherit">Enter</button><span class="err" style="color:#ff6b6b;min-height:1.2em"></span></form>';
 document.body.appendChild(o);
 var f=o.querySelector('form'),i=o.querySelector('input');i.focus();
 f.onsubmit=function(e){e.preventDefault();
  crypto.subtle.digest('SHA-256',new TextEncoder().encode(S+i.value)).then(function(b){
   if(hex(b)===H){try{localStorage.setItem(K,H)}catch(e){}o.remove();d.style.visibility=''}
   else{o.querySelector('.err').textContent='Wrong password.';i.select()}
  })}
}
if(document.body)ask();else document.addEventListener('DOMContentLoaded',ask);
})();</script>`;
  return { hash, script };
}

/** Add the gate to every .html file below `dir`, and write a robots.txt that disallows everything. */
export function applyGate(dir, password) {
  const { script } = makeGate(password);
  let count = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) {
        const html = readFileSync(p, 'utf8');
        writeFileSync(p, html.replace(/<head>/i, (m) => m + script));
        count++;
      }
    }
  };
  walk(dir);
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return count;
}
