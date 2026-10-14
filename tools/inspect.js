const { chromium } = require('playwright-core');
(async () => {
  // Usage: node tools/inspect.js <port>  — dumps every frame's text + form controls of the open tool page and saves a screenshot.
  const port = process.argv[2] || 9301;
  const b = await chromium.connectOverCDP(`http://localhost:${port}`);
  const page = b.contexts()[0].pages().find(p => p.url().startsWith((process.env.TOOL_URL || require('../config.json').toolUrl).split('?')[0]));
  await page.waitForTimeout(15000);
  for (const f of page.frames()) {
    console.log('FRAME', f.url().slice(0,120));
    try {
      const t = (await f.innerText('body')).slice(0,1500); console.log(t);
      const els = await f.$$eval('button, input, textarea, select, [contenteditable=true], label', es => es.map(e => `${e.tagName}#${e.id}.${(e.className+'').slice(0,40)} | ${e.getAttribute('aria-label')||e.getAttribute('placeholder')||''} | ${(e.innerText||e.value||'').trim().slice(0,50)} | type=${e.type||''}`));
      console.log(els.join('\n'));
    } catch (e) { console.log('ERR', e.message.slice(0,100)); }
  }
  await page.screenshot({ path: `logs/shot-${port}.png` });
  process.exit(0);
})();
