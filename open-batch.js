// Usage: node open-batch.js <batch>      batch 1 -> p01-p05, 2 -> p06-p10, ... (batchSize from config.json)
//        node open-batch.js p07          open one profile
// Each profile = its own Chrome instance with its own user-data-dir (profiles/pNN) and CDP port basePort+N.
// Login is done by the user by hand. This script never closes any browser.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const cfg = require('./config.json');
const URL = process.env.TOOL_URL || cfg.toolUrl;

const candidates = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  win32: [
    path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
}[process.platform] || [];
const CHROME = process.env.CHROME_PATH || candidates.find(p => fs.existsSync(p));
if (!CHROME) { console.error('Google Chrome not found. Set CHROME_PATH.'); process.exit(1); }

const arg = process.argv[2] || '1';
let ids;
if (/^p\d+$/i.test(arg)) ids = [+arg.slice(1)];
else { const b = +arg; ids = Array.from({ length: cfg.batchSize }, (_, i) => (b - 1) * cfg.batchSize + i + 1); }

for (const n of ids) {
  if (n < 1 || n > cfg.totalProfiles) continue;
  const name = 'p' + String(n).padStart(2, '0'), port = cfg.basePort + n;
  const dir = path.join(__dirname, 'profiles', name);
  fs.mkdirSync(dir, { recursive: true });
  const child = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${port}`,
    '--no-first-run', '--no-default-browser-check', URL], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log(`opened ${name} (port ${port})`);
}
