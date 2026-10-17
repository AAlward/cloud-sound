const startMicBtn = document.getElementById('startMic');
const captureAudioBtn = document.getElementById('captureAudio');
const stopAllBtn = document.getElementById('stopAll');
const statusEl = document.getElementById('status');
const micVolumeSlider = document.getElementById('micVolume');
const gameVolumeSlider = document.getElementById('gameVolume');

let audioContext;
let micSource, micGain;
let gameSource, gameGain;
let micStream, gameStream;

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
        latency: 0  // hint for lowest input latency where supported
      }
    });

    micSource = audioContext.createMediaStreamSource(micStream);
    micGain = audioContext.createGain();
    micGain.gain.value = parseFloat(micVolumeSlider.value);

    micSource.connect(micGain).connect(audioContext.destination);

    setStatus('Mic monitoring active — wear headphones!' + getLatencyInfo());
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

    // Request tab or screen share with audio
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

    // We only need the audio track
    const audioTracks = gameStream.getAudioTracks();
    if (audioTracks.length === 0) {
      setStatus('No audio track found. Make sure to share a tab and enable audio.');
      gameStream.getTracks().forEach(t => t.stop());
      return;
    }

    // Stop the video track — we don't need it
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
  if (micGain) micGain.gain.value = parseFloat(micVolumeSlider.value);
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
  if (gameSource) gameSource.disconnect();

  startMicBtn.disabled = false;
  captureAudioBtn.disabled = false;
  stopAllBtn.disabled = true;
  setStatus('Stopped. Ready to start again.');
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAllBtn.click();
});
