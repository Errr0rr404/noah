# Noah's Super World

A single-page kids' game site made for Noah — a comic-book superhero themed
collection of simple tap mini-games. No build step, no dependencies, just
static HTML/CSS/JS.

## Tech stack

- Plain HTML, CSS, and vanilla JavaScript (no framework, no bundler)
- Web Audio API for sound effects (no audio files needed)
- `localStorage` for best scores and the sound on/off setting
- Google Fonts (Baloo 2, Luckiest Guy)

## Files

- `index.html` — markup for the home screen and all game screens
- `styles.css` — all styling, the CSS-built mascot, animations
- `script.js` — app navigation, sound engine, and game logic
- `mascot.js` — mascot celebration reactions (hooks into confetti / tile taps)
- `netlify.toml` — Netlify config (publishes the repo root, no build command)

## Games

Soccer Star, Tap Race, Bat Catch, Power Punch, Police Chase, Silly Blaster,
Block Stack, Bike Run, Noah's Family, My 10 Friends, and Catch the Book —
11 mini-games in total.

## Run locally

It's a static site, so just open `index.html` in a browser, or serve the
folder with any static server, e.g.:

```sh
python3 -m http.server
```

then visit http://localhost:8000.

## Deploy

Deployed on Netlify as a static site. `netlify.toml` sets `publish = "."`
with an empty build command, so Netlify serves the files straight from the
repo root.
