// Usage: node tools/build-canvas.js <port> [htmlFile] [existingChatUrl]
//   existingChatUrl: re-paste the tool into a Canvas chat that already exists instead of making a new one
// Builds an exact copy of the tool in the Gemini account logged into that browser:
//  1. new Gemini chat with Canvas on, asks for a tiny placeholder app (so a Canvas exists)
//  2. opens the Canvas "Code" tab and pastes the HTML file verbatim (asking Gemini to copy 71 KB
//     of code does NOT work: it truncates or rewrites it into a different app)
//  3. switches to Preview and checks the tool loads (#generate-btn), then prints the chat URL.
// Use the printed URL as TOOL_URL, or press Share in that Canvas to get a public /share/ link.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const port = process.argv[2] || 9301;
const file = process.argv[3] || path.join(__dirname, '..', 'tool', 'bulk-image-generator.html');
const existing = process.argv[4];
const wait = ms => new Promise(r => setTimeout(r, ms));

async function toolFrame(page, secs) {
  for (let i = 0; i < secs; i++) {
    for (const fr of page.frames()) { try { if (await fr.$('#generate-btn')) return fr; } catch {} }
    await wait(1000);
  }
}

(async () => {
  const code = fs.readFileSync(file, 'utf8');
  const b = await chromium.connectOverCDP(`http://localhost:${port}`);
  const page = await b.contexts()[0].newPage();
  await page.goto(existing || 'https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await wait(5000);
  // Gemini is still writing while a "Stop" button is visible; pasting before it finishes gets overwritten
  const geminiIdle = async () => {
    for (let i = 0; i < 180; i++) {
      const busy = await page.locator('button[aria-label*="Stop" i]').first().isVisible().catch(() => false);
      if (!busy) return; await wait(1000);
    }
  };
  const gotIt = page.getByRole('button', { name: 'Got it' }); if (await gotIt.count()) await gotIt.first().click();

  if (!existing) {
  // 1. Canvas on + placeholder request
  await page.getByRole('button', { name: 'Upload & tools' }).click(); await wait(800);
  const cv = page.getByRole('menuitemcheckbox', { name: 'Canvas' });
  if (await cv.getAttribute('aria-checked') !== 'true') await cv.click(); else await page.keyboard.press('Escape');
  await wait(800);
  await page.locator('div.ql-editor[contenteditable=true]').click();
  await page.keyboard.insertText('In Canvas, create a minimal single-file HTML page with the title "Bulk Image Generator" and one heading. Nothing else.');
  await page.keyboard.press('Enter');
  console.log('waiting for Gemini to open a Canvas...');
  let codeTab;
  for (let i = 0; i < 90; i++) {
    await wait(2000);
    codeTab = page.getByText('Code', { exact: true }).first();
    if (await codeTab.isVisible().catch(() => false) && await page.getByText('Preview', { exact: true }).first().isVisible().catch(() => false)) break;
    codeTab = null;
  }
  if (!codeTab) throw new Error('Canvas did not open');
  }
  await geminiIdle(); await wait(3000);
  const codeTab = page.getByText('Code', { exact: true }).first();
  if (!(await codeTab.isVisible().catch(() => false))) { await page.getByText('Bulk Image', { exact: false }).last().click().catch(() => {}); await wait(3000); }

  // 2. paste the real code verbatim into the Monaco editor
  await codeTab.click(); await wait(2500);
  // clear the editor completely (a partial clear makes the paste append and the tool appears twice)
  const sel = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
  for (let i = 0; i < 6; i++) {
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.press(sel); await page.keyboard.press('Delete'); await wait(700);
    const left = await page.$eval('.monaco-editor .view-lines', e => e.innerText.trim().length);
    if (!left) break;
    if (i === 5) throw new Error('could not clear the Canvas editor');
  }
  await page.evaluate(t => {
    const ta = document.querySelector('.monaco-editor textarea.inputarea');
    const dt = new DataTransfer(); dt.setData('text/plain', t);
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, code);
  await wait(4000);

  // 3. verify what Gemini actually SAVED: open the chat in a brand-new tab (a reload of the same
  //    tab can show unsaved local state). Retry the save wait a few times before giving up.
  const chatUrl = page.url();
  let fr, check;
  for (let attempt = 1; attempt <= 4 && !fr; attempt++) {
    await wait(15000);
    check = await page.context().newPage();
    await check.goto(chatUrl, { waitUntil: 'domcontentloaded' }); await wait(6000);
    await check.getByText('Preview', { exact: true }).first().click().catch(() => {});
    const f = await toolFrame(check, 30);
    const ok = f && (await f.innerText('body')).includes('CREATOR CORE') && (await f.evaluate(() => document.querySelectorAll('#generate-btn').length)) === 1;
    if (ok) fr = f; else { console.log(`save not visible yet in a fresh tab (try ${attempt}/4)`); await check.close(); }
  }
  if (!fr) throw new Error('the pasted tool was not saved by Gemini (fresh tab still shows the placeholder)');
  await page.close();
  console.log('TOOL READY:', (await fr.innerText('body')).split('\n').slice(0, 2).join(' | '));
  console.log('TOOL_URL=' + chatUrl);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
