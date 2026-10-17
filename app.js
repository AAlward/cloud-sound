const startMicBtn = document.getElementById('startMic');
const captureAudioBtn = document.getElementById('captureAudio');
const stopAllBtn = document.getElementById('stopAll');
const statusEl = document.getElementById('status');
const micVolumeSlider = document.getElementById('micVolume');
const gameVolumeSlider = document.getElementById('gameVolume');

let audioContext;
let micSource, micWorklet, micGainParam;
let gameSource, gameGain;
let micStream, gameStream;
let workletLoaded = false;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function enableStop() {
  stopAllBtn.disabled = false;
}

async function initAudioContext() {
  if (!audioContext) {
    // latencyHint: 0 requests the lowest possible latency
    audioContext = new AudioContext({ latencyHint: 0 });
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  if (!workletLoaded) {
    try {
      await audioContext.audioWorklet.addModule('mic-processor.js');
      workletLoaded = true;
    } catch (e) {
      console.warn('AudioWorklet failed to load, falling back to GainNode:', e);
    }
  }
}

function getLatencyInfo() {
  if (!audioContext) return '';
  const base = audioContext.baseLatency ? (audioContext.baseLatency * 1000).toFixed(1) : '?';
  const output = audioContext.outputLatency ? (audioContext.outputLatency * 1000).toFixed(1) : '?';
  return ` (base ${base}ms + output ${output}ms)`;
}

startMicBtn.onclick = async () => {
  try {
    await initAudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0
      }
    });

    micSource = audioContext.createMediaStreamSource(micStream);

    if (workletLoaded) {
      micWorklet = new AudioWorkletNode(audioContext, 'mic-processor');
      micGainParam = micWorklet.parameters.get('gain');
      micGainParam.value = parseFloat(micVolumeSlider.value);
      micSource.connect(micWorklet).connect(audioContext.destination);
      setStatus('Mic monitoring (AudioWorklet) — wear headphones!' + getLatencyInfo());
    } else {
      // Fallback
      const micGain = audioContext.createGain();
      micGain.gain.value = parseFloat(micVolumeSlider.value);
      micSource.connect(micGain).connect(audioContext.destination);
      micGainParam = micGain.gain; // so slider still works
      setStatus('Mic monitoring (fallback) — wear headphones!' + getLatencyInfo());
    }

    startMicBtn.disabled = true;
    enableStop();
  } catch (err) {
    setStatus('Mic error: ' + err.message);
    console.error(err);
  }
};

captureAudioBtn.onclick = async () => {
  try {
    await initAudioContext();

    gameStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false
      },
      systemAudio: 'include'
    });

    const audioTracks = gameStream.getAudioTracks();
    if (audioTracks.length === 0) {
      setStatus('No audio track found. Make sure to share a tab and enable audio.');
      gameStream.getTracks().forEach(t => t.stop());
      return;
    }

    gameStream.getVideoTracks().forEach(t => t.stop());

    gameSource = audioContext.createMediaStreamSource(gameStream);
    gameGain = audioContext.createGain();
    gameGain.gain.value = parseFloat(gameVolumeSlider.value);

    gameSource.connect(gameGain).connect(audioContext.destination);

    setStatus('Game / tab audio captured. Adjust volumes as needed.' + getLatencyInfo());
    captureAudioBtn.disabled = true;
    enableStop();
  } catch (err) {
    setStatus('Capture cancelled or failed: ' + err.message);
    console.error(err);
  }
};

micVolumeSlider.oninput = () => {
  const val = parseFloat(micVolumeSlider.value);
  if (micGainParam) {
    if (micGainParam.value !== undefined) {
      micGainParam.value = val; // AudioParam
    } else if (micGainParam.setValueAtTime) {
      micGainParam.setValueAtTime(val, audioContext.currentTime);
    }
  }
};

gameVolumeSlider.oninput = () => {
  if (gameGain) gameGain.gain.value = parseFloat(gameVolumeSlider.value);
};

stopAllBtn.onclick = () => {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (gameStream) {
    gameStream.getTracks().forEach(t => t.stop());
    gameStream = null;
  }
  if (micSource) micSource.disconnect();
  if (micWorklet) micWorklet.disconnect();
  if (gameSource) gameSource.disconnect();

  micWorklet = null;
  micGainParam = null;
  startMicBtn.disabled = false;
  captureAudioBtn.disabled = false;
  stopAllBtn.disabled = true;
  setStatus('Stopped. Ready to start again.');
};

window.addEventListener('beforeunload', () => {
  stopAllBtn.click();
});
