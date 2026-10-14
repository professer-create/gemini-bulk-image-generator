// Usage: node tools/extract-tool.js <port> [outFile]
// Saves the Canvas tool's original HTML source. Reloads the tool tab and captures the network
// response that carries the app code (the in-frame blob can't be re-read: the runtime revokes it).
const { chromium } = require('playwright-core');
const fs = require('fs');
const URL = process.env.TOOL_URL || require('../config.json').toolUrl;
(async () => {
  const port = process.argv[2] || 9301, out = process.argv[3] || 'tool/bulk-image-generator.html';
  const b = await chromium.connectOverCDP(`http://localhost:${port}`);
  const ctx = b.contexts()[0];
  let page = ctx.pages().find(p => p.url().startsWith(URL.split('?')[0])) || await ctx.newPage();
  const hits = [];
  ctx.on('response', async r => {
    try {
      const ct = r.headers()['content-type'] || '';
      if (!/html|json|javascript|text|protobuf/.test(ct) && !r.url().includes('batchexecute')) return;
      const t = await r.text();
      if (t.includes('generate-btn') && t.includes('aspectRatio')) hits.push({ url: r.url(), t });
    } catch {}
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 60 && !hits.length; i++) await page.waitForTimeout(1000);
  if (!hits.length) throw new Error('tool source not seen on the network');
  const h = hits.sort((a, b) => a.t.length - b.t.length)[0];
  console.log('source from', h.url.slice(0, 100), h.t.length, 'chars');
  // the response is Gemini's batchexecute JSON; dig out the string that holds the HTML document
  const found = [];
  const walk = x => {
    if (typeof x === 'string') {
      if (x.includes('generate-btn') && /<!doctype html|<html/i.test(x)) found.push(x);
      else if (/^[\[{]/.test(x)) { try { walk(JSON.parse(x)); } catch {} }
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  for (const line of h.t.split('\n')) if (line.trim().startsWith('[')) { try { walk(JSON.parse(line)); } catch {} }
  if (!found.length) { fs.writeFileSync(out + '.raw', h.t); throw new Error('HTML not found in response, raw saved'); }
  let html = found.sort((a, b) => b.length - a.length)[0].trim().replace(/^```html\s*/, '').replace(/```$/, '').trim() + '\n';
  fs.writeFileSync(out, html);
  console.log('saved', out, html.length, 'chars');
  process.exit(0);
})();
