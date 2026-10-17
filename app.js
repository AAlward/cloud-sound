const startMicBtn = document.getElementById('startMic');
const captureAudioBtn = document.getElementById('captureAudio');
const stopAllBtn = document.getElementById('stopAll');
const statusEl = document.getElementById('status');
const micVolumeSlider = document.getElementById('micVolume');
const captureList = document.getElementById('captureList');

let audioContext;
let micSource, micWorklet, micGainParam;
let micStream;
let workletLoaded = false;

// Array of captured tab streams: { stream, source, gain, element, label }
let captures = [];
let captureCount = 0;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function enableStop() {
  stopAllBtn.disabled = false;
}

async function initAudioContext() {
  if (!audioContext) {
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

function updateCaptureList() {
  if (captures.length === 0) {
    captureList.innerHTML = 'No tabs captured yet. Click "Capture Another Tab" and share Discord, GeForce Now, etc.';
    return;
  }

  captureList.innerHTML = '';
  captures.forEach((cap, index) => {
    const div = document.createElement('div');
    div.className = 'capture-item';
    div.innerHTML = `
      <div class="capture-header">
        <span>${cap.label}</span>
        <button class="remove-btn" data-index="${index}">Remove</button>
      </div>
      <label>
        Volume
        <input type="range" min="0" max="2" step="0.05" value="${cap.gain.gain.value}" data-index="${index}">
      </label>
    `;
    captureList.appendChild(div);
  });

  // Attach listeners
  captureList.querySelectorAll('.remove-btn').forEach(btn => {
    btn.onclick = () => removeCapture(parseInt(btn.dataset.index));
  });
  captureList.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.oninput = () => {
      const idx = parseInt(slider.dataset.index);
      if (captures[idx]) {
        captures[idx].gain.gain.value = parseFloat(slider.value);
      }
    };
  });
}

function removeCapture(index) {
  const cap = captures[index];
  if (cap) {
    cap.stream.getTracks().forEach(t => t.stop());
    cap.source.disconnect();
    captures.splice(index, 1);
    updateCaptureList();
    setStatus(`Removed capture. ${captures.length} tab(s) remaining.` + getLatencyInfo());
  }
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
      const micGain = audioContext.createGain();
      micGain.gain.value = parseFloat(micVolumeSlider.value);
      micSource.connect(micGain).connect(audioContext.destination);
      micGainParam = micGain.gain;
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

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false
      },
      systemAudio: 'include'
    });

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setStatus('No audio track found. Make sure to share a tab and enable audio.');
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    stream.getVideoTracks().forEach(t => t.stop());

    const source = audioContext.createMediaStreamSource(stream);
    const gain = audioContext.createGain();
    gain.gain.value = 1.0;
    source.connect(gain).connect(audioContext.destination);

    captureCount++;
    const label = `Tab ${captureCount}`;

    captures.push({ stream, source, gain, label });
    updateCaptureList();

    setStatus(`Captured ${label}. ${captures.length} tab(s) active.` + getLatencyInfo());
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
      micGainParam.value = val;
    } else if (micGainParam.setValueAtTime) {
      micGainParam.setValueAtTime(val, audioContext.currentTime);
    }
  }
};

stopAllBtn.onclick = () => {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (micSource) micSource.disconnect();
  if (micWorklet) micWorklet.disconnect();

  captures.forEach(cap => {
    cap.stream.getTracks().forEach(t => t.stop());
    cap.source.disconnect();
  });
  captures = [];
  captureCount = 0;
  updateCaptureList();

  micWorklet = null;
  micGainParam = null;
  startMicBtn.disabled = false;
  stopAllBtn.disabled = true;
  setStatus('Stopped. Ready to start again.');
};

window.addEventListener('beforeunload', () => {
  stopAllBtn.click();
});
