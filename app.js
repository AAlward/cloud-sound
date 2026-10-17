const startMicBtn = document.getElementById('startMic');
const captureAudioBtn = document.getElementById('captureAudio');
const testSurroundBtn = document.getElementById('testSurround');
const stopAllBtn = document.getElementById('stopAll');
const statusEl = document.getElementById('status');
const micVolumeSlider = document.getElementById('micVolume');
const captureList = document.getElementById('captureList');
const deviceDisplay = document.getElementById('deviceDisplay');
const eqEnabledCheckbox = document.getElementById('eqEnabled');
const surroundEnabledCheckbox = document.getElementById('surroundEnabled');
const eqBandsContainer = document.getElementById('eqBands');

let audioContext;
let micSource, micWorklet, micGainParam;
let micStream;
let workletLoaded = false;

// Processing chain
let eqFilters = []; // BiquadFilterNodes
let pannerNode;     // for virtual surround
let masterGain;

// Array of captured tab streams
let captures = [];
let captureCount = 0;

// Test oscillator
let testOsc, testGain, testPanner;

const EQ_BANDS = [
  { freq: 60,   label: '60 Hz' },
  { freq: 250,  label: '250 Hz' },
  { freq: 1000, label: '1 kHz' },
  { freq: 4000, label: '4 kHz' },
  { freq: 12000,label: '12 kHz' }
];

function setStatus(msg) {
  statusEl.textContent = msg;
}

function enableStop() {
  stopAllBtn.disabled = false;
}

async function updateDeviceDisplay() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    if (outputs.length === 0) {
      deviceDisplay.textContent = 'Audio device: no outputs found';
      return;
    }
    // Prefer labeled device; fall back to default
    const defaultOut = outputs.find(d => d.deviceId === 'default') || outputs[0];
    const label = defaultOut.label || 'Default output device';
    deviceDisplay.textContent = `Audio device: ${label}`;
  } catch (e) {
    deviceDisplay.textContent = 'Audio device: permission needed to list';
  }
}

async function initAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext({ latencyHint: 0 });
    buildProcessingChain();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  if (!workletLoaded) {
    try {
      await audioContext.audioWorklet.addModule('mic-processor.js');
      workletLoaded = true;
    } catch (e) {
      console.warn('AudioWorklet failed to load:', e);
    }
  }

  await updateDeviceDisplay();
}

function buildProcessingChain() {
  // Master gain at the end
  masterGain = audioContext.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(audioContext.destination);

  // Virtual surround panner (HRTF)
  pannerNode = audioContext.createPanner();
  pannerNode.panningModel = 'HRTF';
  pannerNode.distanceModel = 'inverse';
  pannerNode.refDistance = 1;
  pannerNode.maxDistance = 10000;
  pannerNode.rolloffFactor = 1;
  pannerNode.coneInnerAngle = 360;
  pannerNode.coneOuterAngle = 0;
  pannerNode.coneOuterGain = 0;
  // Start centered
  pannerNode.positionX.value = 0;
  pannerNode.positionY.value = 0;
  pannerNode.positionZ.value = -1;

  // EQ filters
  eqFilters = EQ_BANDS.map(band => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = band.freq;
    filter.Q.value = 1;
    filter.gain.value = 0;
    return filter;
  });

  // Chain: input → EQ → panner → master
  // We'll connect sources to the first EQ (or panner if EQ off)
  connectChain();
}

function connectChain() {
  // Disconnect previous if needed
  eqFilters.forEach(f => f.disconnect());
  pannerNode.disconnect();

  if (eqEnabledCheckbox.checked && eqFilters.length) {
    // Chain EQ filters
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    const lastEq = eqFilters[eqFilters.length - 1];
    if (surroundEnabledCheckbox.checked) {
      lastEq.connect(pannerNode);
      pannerNode.connect(masterGain);
    } else {
      lastEq.connect(masterGain);
    }
  } else {
    if (surroundEnabledCheckbox.checked) {
      pannerNode.connect(masterGain);
    }
    // Sources will connect directly to panner or master
  }
}

function getInputNode() {
  // Where new sources should connect
  if (eqEnabledCheckbox.checked && eqFilters.length) {
    return eqFilters[0];
  }
  if (surroundEnabledCheckbox.checked) {
    return pannerNode;
  }
  return masterGain;
}

function getLatencyInfo() {
  if (!audioContext) return '';
  const base = audioContext.baseLatency ? (audioContext.baseLatency * 1000).toFixed(1) : '?';
  const output = audioContext.outputLatency ? (audioContext.outputLatency * 1000).toFixed(1) : '?';
  return ` (base ${base}ms + output ${output}ms)`;
}

function buildEQUI() {
  eqBandsContainer.innerHTML = '';
  EQ_BANDS.forEach((band, i) => {
    const label = document.createElement('label');
    label.innerHTML = `${band.label}<br><input type="range" min="-12" max="12" step="0.5" value="0" data-band="${i}">`;
    eqBandsContainer.appendChild(label);
  });

  eqBandsContainer.querySelectorAll('input').forEach(slider => {
    slider.oninput = () => {
      const idx = parseInt(slider.dataset.band);
      if (eqFilters[idx]) {
        eqFilters[idx].gain.value = parseFloat(slider.value);
      }
    };
  });
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

// Reconnect all current sources when EQ/surround toggles change
function reconnectSources() {
  connectChain();
  const inputNode = getInputNode();

  // Mic
  if (micWorklet) {
    micWorklet.disconnect();
    micWorklet.connect(inputNode);
  } else if (micSource) {
    // fallback path already connected via gain; re-wire if needed
  }

  // Captures
  captures.forEach(cap => {
    cap.gain.disconnect();
    cap.gain.connect(inputNode);
  });
}

eqEnabledCheckbox.onchange = reconnectSources;
surroundEnabledCheckbox.onchange = reconnectSources;

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
    const inputNode = getInputNode();

    if (workletLoaded) {
      micWorklet = new AudioWorkletNode(audioContext, 'mic-processor');
      micGainParam = micWorklet.parameters.get('gain');
      micGainParam.value = parseFloat(micVolumeSlider.value);
      micSource.connect(micWorklet);
      micWorklet.connect(inputNode);
      setStatus('Mic monitoring (AudioWorklet) — wear headphones!' + getLatencyInfo());
    } else {
      const micGain = audioContext.createGain();
      micGain.gain.value = parseFloat(micVolumeSlider.value);
      micSource.connect(micGain).connect(inputNode);
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
    source.connect(gain);
    gain.connect(getInputNode());

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

// Virtual surround test: pans a tone around the listener
testSurroundBtn.onclick = async () => {
  try {
    await initAudioContext();
    if (testOsc) {
      testOsc.stop();
      testOsc.disconnect();
      if (testGain) testGain.disconnect();
      if (testPanner) testPanner.disconnect();
    }

    testOsc = audioContext.createOscillator();
    testOsc.type = 'sine';
    testOsc.frequency.value = 440;

    testGain = audioContext.createGain();
    testGain.gain.value = 0.15;

    testPanner = audioContext.createPanner();
    testPanner.panningModel = 'HRTF';
    testPanner.positionX.value = 0;
    testPanner.positionY.value = 0;
    testPanner.positionZ.value = -1;

    testOsc.connect(testGain).connect(testPanner).connect(masterGain);
    testOsc.start();

    setStatus('Surround test running — listen for the tone moving around your head');
    enableStop();

    // Animate position in a circle
    let angle = 0;
    const interval = setInterval(() => {
      if (!testOsc) {
        clearInterval(interval);
        return;
      }
      angle += 0.05;
      const x = Math.sin(angle) * 2;
      const z = Math.cos(angle) * -2;
      testPanner.positionX.value = x;
      testPanner.positionZ.value = z;
    }, 50);

    // Auto-stop after 8 seconds
    setTimeout(() => {
      if (testOsc) {
        testOsc.stop();
        testOsc.disconnect();
        testOsc = null;
        clearInterval(interval);
        setStatus('Surround test finished. Enable Virtual Surround for normal audio.');
      }
    }, 8000);
  } catch (err) {
    setStatus('Test error: ' + err.message);
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

  if (testOsc) {
    testOsc.stop();
    testOsc.disconnect();
    testOsc = null;
  }

  micWorklet = null;
  micGainParam = null;
  startMicBtn.disabled = false;
  stopAllBtn.disabled = true;
  setStatus('Stopped. Ready to start again.');
};

// Init EQ UI and device display on load
buildEQUI();
updateDeviceDisplay();
navigator.mediaDevices.addEventListener('devicechange', updateDeviceDisplay);

window.addEventListener('beforeunload', () => {
  stopAllBtn.click();
});
