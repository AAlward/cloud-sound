# EarSpy

Cross-platform web app that turns any headset into virtual surround sound and provides real-time mic monitoring (sidetone), EQ, and audio processing.

**No proprietary software required.** Works in the browser on Chromebooks, Mac, Linux, Windows, etc.

## Current Features (starter)

- Mic monitoring with volume control
- Capture tab or system audio (via screen share) for games / Discord / GeForce Now
- Mix mic + game audio with independent volume sliders
- Low-latency audio context

## Planned

- Parametric EQ for headphones and mic
- Virtual surround / HRTF spatialization
- Presets (Gaming, Music, Voice Chat)
- Mic tools (gate, compressor, simple noise reduction)

## How to use with GeForce Now on Chromebook

1. Open GeForce Now in a Chrome tab and start a game.
2. Open this app in another tab.
3. Click **Start Mic Monitor** (grant mic permission).
4. Click **Capture Tab / System Audio** and share the GeForce Now tab (enable audio).
5. Adjust volumes. Hear processed game audio + your own voice in the headset.

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
