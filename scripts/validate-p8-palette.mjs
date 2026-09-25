// Standalone WCAG check against the actual CSS tokens, including alpha compositing.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const rgb = s => s.startsWith('#') ? (s.length === 4 ? [...s.slice(1)].map(x => parseInt(x+x,16)) : [1,3,5].map(i => parseInt(s.slice(i,i+2),16))) : s.match(/[\d.]+/g).map(Number);
const blend = (a,b) => a.slice(0,3).map((v,i) => v*(a[3]??1)+b[i]*(1-(a[3]??1)));
const lum = a => a.map(x => x/255).map(x => x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
for (const theme of [':root','.dark']) {
 const block = css.slice(css.indexOf(`${theme} {`)).split('}')[0];
 const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
 const surface = theme === '.dark' ? [15,16,18] : [255,255,255];
 for(const role of ['ink-1','ink-2','ink-muted','mint','flare','signal','amber','violet']) {
  const r=ratio(blend(rgb(tokens[role]),surface),surface); console.log(theme,role,r.toFixed(2)); assert(r>=4.5,`${theme} ${role} fails AA: ${r}`);
 }
 for(const arm of ['in','out']) for(let step=1;step<=4;step++) {
  const role=`${arm}-${step}`,r=ratio(rgb(tokens[role]),rgb(tokens[`on-${role}`])); console.log(theme,role,r.toFixed(2)); assert(r>=4.5,`${theme} on-${role} fails: ${r}`);
 }
}
console.log('P8 text and tile contrast: PASS');
