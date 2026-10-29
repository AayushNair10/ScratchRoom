# Scratchroom

A free, personal, real-time collaborative coding pad for interviews and pair practice.

Open the site, start a session, and share the **session code** (or the link). Everyone in the
session edits the same code, sees each other's cursors, runs **Python, C, C++ or Java**, shares
the output, and can sketch on a shared **whiteboard**. Sessions last 2 hours (anyone can add
more time) and then everything is wiped.

There is **no backend, no database, no login and nothing is saved**. It's a static site; the
browsers talk to each other directly over WebRTC.

## Features

- Monaco editor with syntax highlighting, auto-closing brackets/quotes, auto-indent, bracket pair
  colours, word wrap, tab size 4, light and dark themes
- Live collaboration with coloured, named cursors and a "N connected" indicator
- Nicknames (or a random one like "Teal Otter")
- Shared language choice with starter templates (Java uses `public class Main`)
- Run code with the Run button or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>; shared stdin box;
  results (stdout, red stderr, compiler output, exit code, run time, language) are shared with
  everyone
- Python runs in your browser (Pyodide); C, C++ and Java run on Wandbox (or your own Piston)
- 2-hour session timer with a 10-minute warning, "+1h" for everyone, and a "Session ended" screen
- Full-screen shared whiteboard: pen, eraser, clear; works with mouse, touch and stylus

## How it works

| Piece | What it does | Where it runs |
|---|---|---|
| Vite + React + TypeScript | The app | Any static host |
| [Yjs](https://yjs.dev) + [y-webrtc](https://github.com/yjs/y-webrtc) + y-monaco | Shared code, stdin, results, timer and whiteboard | Peer-to-peer between browsers, encrypted with the session code |
| Signaling server | Introduces browsers to each other (relays encrypted WebRTC handshakes only) | `signaling/`: a free Cloudflare Worker |
| [Pyodide](https://pyodide.org) | Runs Python in a Web Worker | Your browser (downloaded from the jsDelivr CDN) |
| [Wandbox](https://wandbox.org) (default) or [Piston](https://github.com/engineer-man/piston) | Compiles and runs C, C++ and Java | Their servers (or yours) |

The only network calls the app makes are to: the signaling server, the jsDelivr CDN (Pyodide),
the code runner (Wandbox or Piston), and public STUN servers used by WebRTC. No analytics, no
tracking. The only thing stored in your browser is your light/dark preference.

## Run it locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run signaling   # terminal 1: local signaling server on port 4444
npm run dev         # terminal 2: http://localhost:5173
```

Open the site in two browser windows (use a private window or another browser for the second
one), start a session in one, and join with the code in the other.

To reach it from a phone or another computer on your Wi-Fi: `npm run dev -- --host`, then open
`http://<your-computer's-IP>:5173`.

If you've set `VITE_SIGNALING` in `.env.local` (see below), you don't need `npm run signaling`.

### Testing tips (dev mode only)

In `npm run dev`, the current session is available in the browser console as `room`:

```js
room.meta.set('expiresAt', Date.now() + 9.5 * 60e3) // show the 10-minute warning
room.meta.set('expiresAt', Date.now() + 5e3)        // end the session in 5 seconds
```

## Configuration

Settings are environment variables read **at build time**. Locally, put them in `.env.local` in
the project root (it's git-ignored; see `.env.example`), one `KEY=value` per line, then restart
`npm run dev`. On Netlify or Cloudflare Pages, set them in the project's build settings.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SIGNALING` | dev: `ws://<host>:4444`; production: none | Comma-separated signaling server URLs. `https://` URLs are converted to `wss://` automatically. |
| `VITE_RUNNER` | `wandbox` | Which service runs C, C++ and Java: `wandbox` or `piston`. |
| `VITE_WANDBOX_URL` | `https://wandbox.org` | Wandbox base URL. |
| `VITE_PISTON_URL` | `https://emkc.org/api/v2/piston` | Piston API base URL (used when `VITE_RUNNER=piston`). |
| `VITE_ICE_SERVERS` | y-webrtc defaults (public STUN) | Optional JSON array of STUN/TURN servers, e.g. `[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]`. Only needed for strict networks. |

Example `.env.local`:

```
VITE_SIGNALING=wss://scratchroom-signaling.<your-subdomain>.workers.dev
```

## Deploy

You need two things online: the **signaling Worker** (once) and the **static site**.

### 1. Signaling server (Cloudflare Worker, free)

The public y-webrtc signaling servers are no longer online, so Scratchroom ships its own in
`signaling/`. It uses a Durable Object, which is included in Cloudflare's free plan.

```bash
cd signaling
npm install
npx wrangler login     # opens a browser to log in to your (free) Cloudflare account
npx wrangler deploy    # prints https://scratchroom-signaling.<your-subdomain>.workers.dev
```

Use that URL as `VITE_SIGNALING`. Once your site is deployed, you can restrict the Worker to it
by setting `ALLOWED_ORIGINS` in `signaling/wrangler.jsonc` (e.g. `"https://scratchroom.pages.dev"`)
and running `npx wrangler deploy` again.

For local testing of the Worker itself: `cd signaling && npm run dev` (also listens on port 4444).

### 2a. Static site on Cloudflare Pages (free)

Dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick this repository, then:

- Framework preset: **None** (or Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: `VITE_SIGNALING` (and any others you want)

Or deploy a local build directly:

```bash
npm run build
npx wrangler pages deploy dist --project-name scratchroom
```

(With a direct upload, the environment variables come from your local `.env.local` at build time.)

### 2b. Static site on Netlify (free)

Dashboard: **Add new site → Import an existing project**, pick this repository. `netlify.toml`
already sets the build command (`npm run build`) and publish directory (`dist`). Add
`VITE_SIGNALING` under **Site configuration → Environment variables**, then trigger a deploy.

Or with the CLI:

```bash
npm run build
npx netlify-cli deploy --dir dist --prod
```

The site uses hash URLs (`/#k7f3x-q9amn`), so no redirect rules are needed on either host.
`public/_headers` adds basic security headers on both.

## Running C, C++ and Java

**Wandbox (default).** Free, no account or API key, and it allows calls from the browser. Note
that it's a community-run service: it **logs submitted code and stdin**, has rate limits and no
uptime guarantee, and stops programs after about 30 seconds.

**Your own Piston (optional).** For privacy or reliability, run
[Piston](https://github.com/engineer-man/piston) on a server with Docker, install the `gcc` and
`java` packages, then set:

```
VITE_RUNNER=piston
VITE_PISTON_URL=https://your-piston-host/api/v2
```

The browser calls Piston directly, so it must be reachable over HTTPS and allow cross-origin
requests (put it behind a reverse proxy that adds CORS headers if needed). The public emkc.org
Piston API has been whitelist-only since February 2026, so it won't work without approval.

## Project structure

```
src/
  main.tsx, Root.tsx       app entry; home page / join screen / session routing
  App.tsx                  the session screen
  room.ts                  session codes, Yjs doc, WebRTC provider, nicknames, timer, end of session
  config.ts                environment variables
  templates.ts             languages and starter code
  monaco.ts                slim, locally bundled Monaco build
  components/              top bar, editor, results, stdin, timer, whiteboard, dialogs, …
  hooks/                   theme, presence, shared-map values, clock, …
  run/                     Pyodide worker, Wandbox and Piston clients
signaling/                 Cloudflare Worker signaling server
```

## Known limitations

- **Nothing is persisted.** If everyone leaves (or the only person reloads), the session's
  contents are gone. Reopening an old code when nobody is in it starts a fresh, empty 2-hour
  session under that code.
- **Peer-to-peer needs a working WebRTC path.** Without a TURN relay, some strict corporate or
  school networks block direct connections; you'll see "Can't connect". Configure a TURN server
  with `VITE_ICE_SERVERS` to fix this.
- **The timer trusts each computer's clock.** Each browser ends the session when *its* clock
  passes the shared end time. A computer whose clock is wrong ends early or late for itself only;
  it can't end the session for others.
- **Concurrent "+1h" clicks** in the same instant count once, because `expiresAt` is a single
  shared value.
- **Wandbox**: code and stdin are logged by Wandbox, runs take about 3–6 seconds, the time limit
  is about 30 seconds (Python's is 10 seconds), and it's rate limited.
- **Python** runs in the browser: the first load downloads about 6 MB from the CDN (cached afterwards); programs
  that need native extensions not packaged for Pyodide won't import; there is no interactive
  stdin, as all input comes from the stdin box.
- **Output is capped** at 64 KB per stream so a runaway print loop can't flood the shared session.
- **Whiteboard** points are stored relative to the canvas width and height, so drawings line up
  across screens but shapes stretch on screens with a different aspect ratio. There's no undo
  or colour choice by design.
- **Session codes are the only access control.** Anyone with the code can join; there's no
  host, kick or lock.
- **Desktop-first layout.** It works on laptops; phones and tablets are only supported for the
  whiteboard.
- The bundle is about 1 MB gzipped (mostly the Monaco editor).
