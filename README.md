# Gemini Bulk Image Generator — multi-account automation

Generates images in bulk through a Gemini Canvas tool ("Bulk Image Generator") using up to 30
Google accounts, each in its own Chrome profile. Playwright attaches to the real Chrome over CDP,
pastes your prompts, and saves every image as it appears.

- Tool link: https://gemini.google.com/share/0071d13c654f (change it in `config.json`)
- Make your own exact copy of the tool: `node tools/build-canvas.js 9301` ([docs/RECREATE-TOOL.md](docs/RECREATE-TOOL.md))
- Full setup for Claude / teammates: [CLAUDE.md](CLAUDE.md)

## Quick start
```bash
npm install
node open-batch.js 1        # opens p01-p05 with the tool. Log into Gmail in each, once.
node run.js 2 9301          # smoke test on p01
ASPECT=16:9 node run.js prompts/example-16x9.txt 9301 9302 9303 9304 9305
```
Windows: `open-batch.bat 1`, then `set ASPECT=16:9 && node run.js prompts\example-16x9.txt`.

**Easiest way:** open Claude Code, paste this repo's link and say
"set this up for me". Claude follows `CLAUDE.md`.

## Files
| Path | What |
|---|---|
| `config.json` | tool link, base CDP port (9300), batch size (5), number of profiles (30) |
| `open-batch.js` / `.sh` / `.bat` | open a batch of Chrome profiles on the tool (never closes them) |
| `run.js` | fill prompts, generate, save images to `output/` |
| `tool/bulk-image-generator.html` | full source of the Gemini Canvas tool |
| `tools/build-canvas.js` | build an exact copy of the tool in your own Gemini account |
| `tools/extract-tool.js` | save the current tool source from Gemini into `tool/` |
| `tools/inspect.js` | debug: dump the tool page's frames and controls |
| `prompts/` | prompt files, one prompt per line |
| `docs/` | how to recreate the tool |

`profiles/` (logged-in Google sessions) and `output/` are git-ignored on purpose.


## Requirements
- Node.js 18+ and Google Chrome.
- One or more Google accounts **that you own**, each logged in once in its own Chrome profile.

## Responsible use
This tool drives the normal Gemini web UI in real Chrome windows you are logged into. Use only your own
accounts, respect Google's Terms of Service and usage limits, and never share the `profiles/` folder
(it contains live login cookies).

## Credits
The Gemini Canvas app **"Bulk Image Generator"** (`tool/bulk-image-generator.html`) was built by
**Waris Shah** ("Creator Core by Waris Shah") and is published here with his permission.
The multi-account automation around it (runner, browser launcher, Canvas builder) is by
[professer-create](https://github.com/professer-create).

## License
The automation code is released under the MIT License (see [LICENSE](LICENSE)).
`tool/bulk-image-generator.html` is © Waris Shah and is **not** covered by the MIT License; see [NOTICE.md](NOTICE.md).
