// Usage: node run.js <N | prompts.txt> [ports...]
//   node run.js 15                          15 built-in test prompts on each of p01-p05
//   ASPECT=16:9 node run.js prompts/x.txt   prompts from file (one per line), split across the browsers
//   node run.js prompts/x.txt 9301 9302     only these browsers (port = basePort + profile number)
// Fills the Bulk Image Generator (Gemini Canvas share) in each browser, generates, saves images.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const cfg = require('./config.json');
const URL = process.env.TOOL_URL || cfg.toolUrl;
// argv[2] = number of test prompts per browser, OR a prompts .txt file (one per line, split across browsers)
const ARG = process.argv[2] || '5';
const FILE = fs.existsSync(ARG) ? fs.readFileSync(ARG, 'utf8').split('\n').map(l => l.trim()).filter(Boolean) : null;
const ASPECT = (process.env.ASPECT || '').trim(); // e.g. ASPECT=16:9
const ARG_N = FILE ? 0 : +ARG;
const ports = process.argv.slice(3).length ? process.argv.slice(3).map(Number) : Array.from({ length: cfg.batchSize }, (_, i) => cfg.basePort + i + 1);
const runDir = path.join(__dirname, 'output', new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
const subjects = ['a lighthouse at dawn','a vintage red bicycle','a snowy mountain cabin','a koi pond with lilies','a desert caravan of camels','a neon-lit ramen shop','a medieval castle on a cliff','a hummingbird near a flower','a cozy library with a fireplace','a futuristic electric car','a bowl of fresh fruit','an old fisherman mending nets','a waterfall in a jungle','a hot air balloon festival','a robot watering plants','a steaming cup of coffee','a fox in an autumn forest','a city skyline at night','a sailboat in a storm','a tea garden in the hills'];
const styles = ['photorealistic','watercolor painting','3D render','studio photo','cinematic still','oil painting'];
const log = (...a) => console.log(new Date().toTimeString().slice(0,8), ...a);

async function appFrame(page) {
  for (let i = 0; i < 90; i++) {
    for (const fr of page.frames()) { try { if (await fr.$('#prompts')) return fr; } catch {} }
    await page.waitForTimeout(1000);
  }
  throw new Error('app frame not found');
}

// A Gemini chat URL (/app/...) does not always show its Canvas after loading: open it and pick Preview.
async function openCanvas(page) {
  if (!/\/app\//.test(page.url())) return;
  for (const fr of page.frames()) { try { if (await fr.$('#prompts')) return; } catch {} }
  const preview = page.getByText('Preview', { exact: true }).first();
  if (!(await preview.isVisible().catch(() => false))) {
    await page.getByText('Bulk Image', { exact: false }).last().click().catch(() => {});
    await page.waitForTimeout(3000);
  }
  await preview.click().catch(() => {});
}

async function worker(port, idx) {
  const tag = 'p' + String(port - cfg.basePort).padStart(2, '0');
  const out = path.join(runDir, tag); fs.mkdirSync(out, { recursive: true });
  let b; for (let i = 0; i < 5 && !b; i++) { try { b = await chromium.connectOverCDP(`http://localhost:${port}`); } catch (e) { if (i === 4) throw e; await new Promise(r => setTimeout(r, 3000)); } }
  const ctx = b.contexts()[0];
  let page = ctx.pages().find(p => p.url().startsWith(URL.split('?')[0]));
  if (!page) {
    page = ctx.pages().find(p => /newtab|gemini|about:blank/.test(p.url())) || await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90e3 });
  } else if (URL.includes('/share/')) await page.reload({ waitUntil: 'domcontentloaded', timeout: 90e3 });
  await page.bringToFront();
  await page.waitForTimeout(3000);
  await openCanvas(page);
  let f = await appFrame(page);
  if (ASPECT) await f.evaluate(a => { const sel = document.querySelector('#aspectRatio'); const o = [...sel.options].find(o => o.text.includes(a)); if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }, ASPECT);
  const myFile = FILE && FILE.map((p, i) => ({ p, i })).filter(x => x.i % ports.length === idx);
  const N = myFile ? myFile.length : ARG_N;
  const prompts = myFile ? myFile.map(x => x.p) : Array.from({ length: N }, (_, i) => `${subjects[(idx * N + i) % subjects.length]}, ${styles[(idx + i) % styles.length]}${N > 60 ? `, variation ${i + 1}` : ""}`);
  const norm = x => x.replace(/^"|"$/g, '').trim().toLowerCase();
  const savedPrompts = new Set(); const seen = new Set(); const events = [];
  let k = 0, restarts = 0;
  const submit = async list => { await f.fill('#prompts', list.join('\n')); await f.click('#generate-btn'); };
  const t0 = Date.now();
  await submit(prompts);
  log(tag, `started ${N} prompts`);
  let done = false, lastProgress = Date.now();
  while (!done) {
    await page.waitForTimeout(3000);
    let st;
    try {
      st = await f.evaluate(() => {
        const cards = [...document.querySelectorAll('img')].filter(i => i.src.startsWith('blob:') && i.naturalWidth > 0).map(img => {
          let el = img; while (el && !(el.innerText || '').includes('Reroll')) el = el.parentElement;
          return { src: img.src, prompt: (el?.innerText || '').split('\n')[0].trim() };
        });
        const body = document.body.innerText;
        return { cards, idle: document.querySelector('#generate-btn')?.offsetParent !== null, body, empty: /0 prompts/.test(body) && /Ready to Generate/.test(body) };
      });
    } catch (e) {
      log(tag, 'app frame lost (' + e.message.slice(0, 60) + '), re-finding');
      try { f = await appFrame(page); } catch { await page.reload(); f = await appFrame(page); }
      continue;
    }
    for (const c of st.cards) if (!seen.has(c.src)) {
      seen.add(c.src); lastProgress = Date.now();
      // save immediately so a canvas reload can't lose it
      const b64 = await f.evaluate(async s => { const r = await fetch(s); const buf = new Uint8Array(await r.arrayBuffer()); let x = ''; for (let i = 0; i < buf.length; i += 0x8000) x += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(x); }, c.src).catch(() => null);
      if (!b64) continue;
      const buf = Buffer.from(b64, 'base64');
      const ext = buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' : buf[0] === 0x89 ? 'png' : 'webp';
      const cp = norm(c.prompt);
      const match = prompts.find(p => norm(p) === cp || norm(p).startsWith(cp.slice(0, 80)));
      const label = myFile && match ? 'prompt' + String(myFile.find(x => x.p === match).i + 1).padStart(3, '0') : c.prompt.replace(/[^a-z0-9]+/gi, '_').slice(0, 50);
      ++k; fs.writeFileSync(path.join(out, `${String(k).padStart(2, '0')}-${label}.${ext}`), buf);
      savedPrompts.add(match ? norm(match) : cp);
      const sec = (Date.now() - t0) / 1000; events.push(sec);
      log(tag, `image ${k}/${N} at ${sec.toFixed(0)}s`);
    }
    const remaining = prompts.filter(p => !savedPrompts.has(norm(p)));
    if (!remaining.length) done = true;
    else if (st.empty && restarts < 3) {
      restarts++; log(tag, `canvas reset, resubmitting ${remaining.length} remaining (restart ${restarts})`);
      await submit(remaining); lastProgress = Date.now();
    } else if (st.idle && /complete|finished/i.test(st.body)) done = true;
    if (Date.now() - lastProgress > 6 * 60e3) { log(tag, 'no progress 6 min, stopping wait'); done = true; }
  }
  const failText = (await f.evaluate(() => document.body.innerText)).match(/(fail|error|limit|quota)[^\n]{0,80}/gi) || [];
  await page.screenshot({ path: path.join(out, '_final.png') });
  const total = (Date.now() - t0) / 1000;
  return { tag, asked: N, got: k, restarts, totalSec: +total.toFixed(0), firstSec: events[0] && +events[0].toFixed(0), errors: [...new Set(failText)].slice(0, 5) };
}

(async () => {
  fs.mkdirSync(runDir, { recursive: true });
  log('run dir', runDir);
  const T = Date.now();
  const res = await Promise.all(ports.map((p, i) => worker(p, i).catch(e => ({ tag: 'port' + p, error: e.message }))));
  const sum = { wallSec: +((Date.now() - T) / 1000).toFixed(0), results: res };
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(sum, null, 2));
  console.log(JSON.stringify(sum, null, 2));
  process.exit(0);
})();
