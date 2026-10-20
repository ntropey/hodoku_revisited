/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Cookie/ads consent for the marketing site (Google Consent Mode v2 + AdSense IAB TCF v2.2 CMP).
 *
 * Google's certified CMP (enabled in AdSense -> Privacy & messaging -> European regulations) prompts
 * EEA/UK/Swiss visitors via `adsbygoogle.js`, while non-EEA visitors see ads without a redundant banner.
 * Before `adsbygoogle.js` loads, this script sets Google Consent Mode v2 regional defaults (`denied` in
 * EEA/UK/CH until consent is granted, `ads_data_redaction: true`). A "Cookie settings" button in the
 * footer calls `googlefc.showRevocationMessage()` when Google's CMP is active, or opens a local
 * Accept/Reject dialog stored under `hodoku-consent` in localStorage so any visitor can opt out at any
 * time. The app under /play/ is never touched.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/** localStorage key holding { v, choice, ts }. */
export const CONSENT_KEY = 'hodoku-consent';
/** AdSense publisher id; also used for ads.txt by build.mjs. */
export const ADSENSE_CLIENT = 'ca-pub-6409516653999633';

// Bumped when the banner or the stored shape changes, so an old choice asks again.
const CONSENT_VERSION = 1;

// Styled with the site tokens (site.css), so light and dark mode both work. No single quotes.
const BANNER_CSS =
  '#hodoku-consent{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));font:400 15px/1.5 var(--font-ui,system-ui,sans-serif);color:var(--fg)}' +
  '#hodoku-consent .hc-box{display:flex;flex-wrap:wrap;gap:12px;align-items:center;width:100%;max-width:820px;padding:16px 20px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.28)}' +
  '#hodoku-consent p{margin:0;flex:1 1 320px}' +
  '#hodoku-consent .hc-actions{display:flex;gap:8px;flex-wrap:wrap}' +
  '#hodoku-consent button{font:inherit;font-weight:500;padding:9px 18px;border-radius:6px;border:1px solid var(--accent);cursor:pointer}' +
  '#hodoku-consent .hc-accept{background:var(--accent);color:var(--card)}' +
  '#hodoku-consent .hc-reject{background:transparent;color:var(--accent)}' +
  '#hodoku-consent a{color:var(--accent)}' +
  '.hc-settings{font:inherit;font-size:.85rem;color:var(--accent);background:none;border:0;padding:0;margin:0;cursor:pointer;text-decoration:underline}';

/**
 * The inline <head> script. `root` is the path back to the site root from the page the script lands
 * on ('' or '../'), used for the banner's privacy link so the internal-links test still resolves it.
 */
function consentScript(root) {
  return `<script>(function(){
var K='${CONSENT_KEY}',V=${CONSENT_VERSION},C='${ADSENSE_CLIENT}',choice=null;
try{var raw=localStorage.getItem(K);if(raw){var o=JSON.parse(raw);if(o&&o.v===V&&(o.choice==='granted'||o.choice==='denied')){choice=o.choice}}}catch(e){}
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments)}
window.gtag=window.gtag||gtag;
window.googlefc=window.googlefc||{};
window.googlefc.callbackQueue=window.googlefc.callbackQueue||[];
function syncConsent(c){
 var s=c==='granted'?'granted':'denied';
 gtag('consent','update',{ad_storage:s,ad_user_data:s,ad_personalization:s,analytics_storage:'denied'});
}
var EEA=['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK','CH'];
var eeaState=choice==='granted'?'granted':'denied';
var rowState=choice==='denied'?'denied':'granted';
gtag('consent','default',{ad_storage:eeaState,ad_user_data:eeaState,ad_personalization:eeaState,analytics_storage:'denied',region:EEA,wait_for_update:500});
gtag('consent','default',{ad_storage:rowState,ad_user_data:rowState,ad_personalization:rowState,analytics_storage:'denied'});
gtag('set','ads_data_redaction',true);
function loadAd(){
 if(document.getElementById('hodoku-ad'))return;
 var s=document.createElement('script');
 s.id='hodoku-ad';s.async=true;s.crossOrigin='anonymous';
 s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+C;
 document.head.appendChild(s);
}
function remember(c){try{localStorage.setItem(K,JSON.stringify({v:V,choice:c,ts:Date.now()}))}catch(e){}}
function forget(){try{localStorage.removeItem(K)}catch(e){}}
function addStyle(){
 if(document.getElementById('hodoku-consent-css'))return;
 var s=document.createElement('style');s.id='hodoku-consent-css';s.textContent='${BANNER_CSS}';
 document.head.appendChild(s);
}
function settingsButton(){return document.getElementById('hodoku-consent-settings')}
function openBanner(){
 if(document.getElementById('hodoku-consent'))return;
 addStyle();
 var box=document.createElement('div');
 box.innerHTML='<div id="hodoku-consent" role="dialog" aria-modal="true" aria-label="Cookie and advertising consent" tabindex="-1"><div class="hc-box"><p><strong>Cookies.</strong> This site uses Google AdSense. With your consent, Google and its partners may use cookies to show ads, including personalized ads. You can accept or reject, and change your mind at any time with the Cookie settings button in the footer. Read the <a href="${root}privacy.html">privacy policy</a>.</p><div class="hc-actions"><button type="button" class="hc-reject">Reject</button><button type="button" class="hc-accept">Accept</button></div></div></div>';
 var d=box.firstChild;
 document.body.appendChild(d);
 function close(c){
  remember(c);
  syncConsent(c);
  if(d.parentNode)d.parentNode.removeChild(d);
  var b=settingsButton();if(b&&b.focus)b.focus();
 }
 d.querySelector('.hc-accept').addEventListener('click',function(){close('granted');loadAd()});
 d.querySelector('.hc-reject').addEventListener('click',function(){close('denied');if(document.getElementById('hodoku-ad'))location.reload()});
 d.focus();
}
function addSettings(){
 var f=document.querySelector('footer');
 if(!f||settingsButton())return;
 var b=document.createElement('button');
 b.type='button';b.id='hodoku-consent-settings';b.className='hc-settings';b.textContent='Cookie settings';
 b.addEventListener('click',function(){
  if(window.googlefc&&typeof window.googlefc.showRevocationMessage==='function'){window.googlefc.showRevocationMessage();return}
  forget();choice=null;openBanner();
 });
 f.appendChild(b);
}
function start(){addSettings()}
if(choice!=='denied')loadAd();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();</script>`;
}

/**
 * Add the consent banner + consent-gated AdSense loader to every .html file below `dir`, skipping the
 * `play` directory (the app stays ad-free and banner-free). Returns the number of pages changed.
 *
 * The script is injected right after the charset declaration (not before it, as gate.mjs does): it is
 * ~4 KB, and HTML only honors a <meta charset> that appears within the first 1024 bytes, which matters
 * when the files are opened locally rather than served with a charset in the HTTP header. It still runs
 * during head parsing, before <body>.
 */
export function applyConsent(dir) {
  let count = 0;
  const charset = /<meta charset="[^"]*">/i;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'play') walk(p);
      } else if (e.name.endsWith('.html')) {
        const rel = relative(dir, dirname(p));
        const root = rel === '' ? '' : '../'.repeat(rel.split(sep).length);
        const script = consentScript(root);
        const html = readFileSync(p, 'utf8');
        const next = charset.test(html) ? html.replace(charset, (m) => m + script) : html.replace(/<head>/i, (m) => m + script);
        writeFileSync(p, next);
        count++;
      }
    }
  };
  walk(dir);
  return count;
}
