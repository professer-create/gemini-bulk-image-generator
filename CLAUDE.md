# Gemini multi-account image automation — instructions for Claude

When a user gives you this repo link and asks you to set it up, do everything below yourself.
Talk to the user in their language (often Roman Urdu).

## 1. Set up
1. Clone the repo, then `npm install` (installs `playwright-core` only, no browser download needed).
2. Check that Google Chrome is installed. Set `CHROME_PATH` only if `open-batch.js` cannot find it.
3. Ask the user which tool link to use:
   - Default: `toolUrl` in `config.json` (the shared "Bulk Image Generator" Gemini Canvas).
   - If they want their own copy of the tool: open one browser, let them log in, then run
     `node tools/build-canvas.js <port>`. It builds an exact copy from `tool/bulk-image-generator.html`
     in their Gemini account and prints `TOOL_URL=...`. Test it with `TOOL_URL=<url> node run.js 2 <port>`.
     Ask the user before pressing Share (a share link is public). Details: `docs/RECREATE-TOOL.md`.
4. Ask how many Gmail accounts they have and set `totalProfiles` in `config.json` (default 30, opened 5 per batch).

## 2. Open browsers, user logs in
- `node open-batch.js 1` opens p01–p05 (`2` opens p06–p10, … ; `node open-batch.js p07` opens one).
- Each profile is a separate Chrome with its own folder in `profiles/` and CDP port `basePort + N` (p01 = 9301).
- **Rules:** you only OPEN the browsers. The user logs into Gmail by hand and types "done".
  Never type passwords, never close their browsers. Logins persist in `profiles/`, so they log in once.
- `profiles/` holds live Google session cookies. Never commit, upload or share it (it is in `.gitignore`).

## 3. Generate images
- Smoke test: `node run.js 2 9301` (2 built-in test prompts on p01).
- Real prompts: write one prompt per line in `prompts/<name>.txt`, then
  `ASPECT=16:9 node run.js prompts/<name>.txt 9301 9302 9303 9304 9305`.
  Prompts are split round-robin across the given browsers. ASPECT: `1:1`, `4:5`, `9:16`, `16:9`.
- Output: `output/<timestamp>/pNN/NN-promptXXX.jpg` (XXX = line number in the prompt file) + `summary.json`.
- The runner saves every image the moment it appears. If the Canvas iframe reloads by itself, it resubmits only the missing prompts.
- Debug the page: `node tools/inspect.js <port>` (dumps frames, form controls, screenshot to `logs/`).

## 4. Measured numbers (2026-10-12)
- 1 account alone: 100/100 images in ~2 minutes (the tool runs ~10 in parallel). 20 cinematic 16:9 prompts in 34 s.
- 5 accounts at once during busy hours: ~1 image / 40 s per browser. Speed depends on Gemini load.
- No limit hit at 115 images on one account. The real daily cap is unknown.
- Output size: 1024×1024 (1:1) or 1376×768 (16:9), JPEG.

## 5. Known issues and fixes
- `connectOverCDP ... Browser context management is not supported`: transient. The runner retries 5×.
- `ECONNREFUSED :93xx`: that browser is closed. Reopen it with `node open-batch.js pNN` (login is kept).
- `app frame not found`: the Canvas did not load. Check the tab is on the tool link and logged in, then rerun.
