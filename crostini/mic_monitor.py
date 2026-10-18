#!/usr/bin/env python3
"""
Low-latency mic monitor for ChromeOS Crostini.
Plays the microphone back to the speakers/headset with minimal buffering.
"""

import sys
import sounddevice as sd
import numpy as np

# --- Settings you can tweak ---
SAMPLE_RATE = 48000
BLOCKSIZE = 64          # Smaller = lower latency, but more CPU. Try 32, 64, 128.
CHANNELS = 1
LATENCY = 'low'         # 'low', 'high', or a float in seconds

def callback(indata, outdata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    # Simple passthrough. You can add gain or processing here later.
    outdata[:] = indata

def main():
    print("Cloud Sound — Crostini Mic Monitor")
    print(f"Sample rate: {SAMPLE_RATE} Hz | Block size: {BLOCKSIZE}")
    print("Press Ctrl+C to stop.\n")

    try:
        with sd.Stream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCKSIZE,
            channels=CHANNELS,
            dtype='float32',
            latency=LATENCY,
            callback=callback,
        ):
            print("Monitoring started. Speak into your mic.")
            while True:
                sd.sleep(1000)
    except KeyboardInterrupt:
        print("\nStopped.")
    except Exception as e:
        print(f"Error: {e}")
        print("\nTips:")
        print("- Make sure your mic and speakers are selected in ChromeOS settings.")
        print("- Try a larger BLOCKSIZE (128 or 256) if you hear crackling.")
        print("- Run `python3 -m sounddevice` to list devices.")

if __name__ == "__main__":
    main()
