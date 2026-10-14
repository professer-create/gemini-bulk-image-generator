# Make your own exact copy of the image tool

The tool is the Gemini Canvas app "Bulk Image Generator" (built by Waris Shah). Its full source is
in [`tool/bulk-image-generator.html`](../tool/bulk-image-generator.html). Default shared link:
`https://gemini.google.com/share/0071d13c654f` (in `config.json`).

## Automatic (recommended), one command
1. Open a browser for the Google account that should own the copy: `node open-batch.js p01` (log in once).
2. Run:
   ```bash
   node tools/build-canvas.js 9301
   ```
   It opens a new Gemini chat with Canvas, opens the Canvas **Code** tab, pastes the HTML file
   exactly, switches to **Preview**, checks the tool loaded and prints `TOOL_URL=https://gemini.google.com/app/...`.
3. Use it right away: `TOOL_URL=<that url> node run.js prompts/x.txt 9301`
4. For the team, open that chat, press **Share** on the Canvas, copy the public `/share/` link and
   put it in `config.json` → `toolUrl`.

The script only reports success after it opens the chat in a **new tab** and finds exactly one copy of
the tool there, i.e. Gemini really saved it. (Closing the tab right after pasting can lose the edit;
a partially cleared editor makes the tool appear twice. Both are now checked.)

Tested 2026-10-13: the copy matched the original exactly (same 49,772-char app script, same element
ids, same HTML) and generated 5/5 images in 13 s from a fresh tab.

Chat URLs (`/app/...`) work as `TOOL_URL`; `run.js` opens the Canvas Preview by itself.

## Manual
1. gemini.google.com → **Upload & tools** → turn on **Canvas** → ask for any tiny HTML page.
2. In the Canvas, click **Code**, select all, delete, paste the contents of `tool/bulk-image-generator.html`.
3. Click **Preview**. You should see "Bulk Image Generator — CREATOR CORE BY WARIS SHAH".
4. **Share** → copy link → `config.json`.

## Do not do this
Do not paste the code into the chat and ask Gemini to "create it exactly". The chat box takes only
about 32K characters (the file is 71K), and when the file is attached Gemini rewrites it into a
different app. Pasting into the Canvas Code tab is the only way that gives an exact copy.

## Updating the saved source
If the tool is changed in Gemini, save the new version into the repo:
```bash
node tools/extract-tool.js 9301      # reads the tool at config.json toolUrl (or TOOL_URL)
```
