# Cloud Sound

Cross-platform web app that turns any headset into virtual surround sound and provides real-time mic monitoring (sidetone), EQ, and audio processing.

**No proprietary software required.** Works in the browser on Chromebooks, Mac, Linux, Windows, etc.

## Features

- Mic monitoring with volume control and low-latency AudioWorklet path
- Multi-tab audio capture (Discord + GeForce Now, etc.)
- 5-band EQ with vertical sliders and presets (Flat, Bass, Treble, Gaming, Voice)
- Virtual surround (HRTF) with test tone
- Shows current audio output device
- Independent volume per captured tab

## How to use with GeForce Now on Chromebook

1. Open GeForce Now in a Chrome tab and start a game.
2. Open this app in another tab.
3. Click **Start Mic Monitor** (grant mic permission).
4. Click **Capture Another Tab** and share the GeForce Now tab (enable audio).
5. Optionally capture Discord the same way.
6. Toggle EQ / Virtual Surround and adjust volumes.

## Local testing

Serve the folder over HTTPS or localhost (mic requires a secure context):

```bash
npx serve
# or
python3 -m http.server
```

Then open `http://localhost:3000` (or whatever port) in Chrome.

## Deployment

This is a static site. Deploy to Vercel, Netlify, Cloudflare Pages, or GitHub Pages for free HTTPS hosting.

## License

MIT
