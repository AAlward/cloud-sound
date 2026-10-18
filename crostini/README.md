# Cloud Sound — Crostini Low-Latency Monitor

A simple native Linux mic monitor for ChromeOS Crostini. This bypasses the browser audio stack and can achieve lower latency than the web app.

The web app remains available and unchanged.

## One-time setup on your Chromebook

1. Enable Linux (if you haven’t already):
   - Settings → Advanced → Developers → Linux development environment → Turn on

2. Open the Linux terminal.

3. Install system packages:
   ```bash
   sudo apt update
   sudo apt install -y python3-pip python3-numpy portaudio19-dev
   ```

4. Clone the repo (or download just the crostini folder):
   ```bash
   git clone https://github.com/AAlward/cloud-sound.git
   cd cloud-sound/crostini
   ```

5. Install Python packages:
   ```bash
   pip3 install -r requirements.txt
   ```

## Run the monitor

```bash
python3 mic_monitor.py
```

Speak into your mic. You should hear yourself with lower delay than the web version.

Stop with Ctrl+C.

## Tuning latency

Edit `mic_monitor.py` and change:

- `BLOCKSIZE` — smaller numbers (32, 64) = lower latency but higher CPU use and more chance of crackling. Start with 64.
- `LATENCY` — keep as `'low'`.

If you hear crackling or dropouts, increase `BLOCKSIZE` to 128 or 256.

## List audio devices

```bash
python3 -m sounddevice
```

## Notes

- This only does mic monitoring right now. EQ and virtual surround can be added later if the latency is good.
- Audio from Chrome (GeForce Now, Discord) still needs to be handled separately. You can keep using the web app for that, or route system audio into Linux if you want everything in one place.
- Make sure your headset is selected as the input and output device in ChromeOS settings before starting the script.

## Troubleshooting

- No sound / no mic: Check ChromeOS sound settings and that Linux has access (it usually does automatically).
- High latency still: Try a smaller `BLOCKSIZE`. Some Chromebooks have hardware limits.
- Permission errors: Run the terminal commands again after enabling Linux.
