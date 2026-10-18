// AudioWorklet processor for low-latency mic monitoring with optional noise gate
class MicProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'gain',
        defaultValue: 0.8,
        minValue: 0,
        maxValue: 2,
        automationRate: 'a-rate'
      },
      {
        name: 'gateThreshold',
        defaultValue: 0.015,
        minValue: 0,
        maxValue: 0.2,
        automationRate: 'k-rate'
      },
      {
        name: 'gateEnabled',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.attack = 0.02;
    this.release = 0.12;
    this.frameCount = 0;
    this.peak = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const gain = parameters.gain;
    const threshold = parameters.gateThreshold[0];
    const gateOn = parameters.gateEnabled[0] > 0.5;

    if (input.length === 0) return true;

    let blockPeak = 0;

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      const gainValues = gain.length > 1 ? gain : null;
      const gainValue = gain.length === 1 ? gain[0] : 1;

      for (let i = 0; i < inputChannel.length; i++) {
        let sample = inputChannel[i];
        const abs = Math.abs(sample);
        if (abs > blockPeak) blockPeak = abs;

        if (abs > this.envelope) {
          this.envelope += (abs - this.envelope) * this.attack;
        } else {
          this.envelope += (abs - this.envelope) * this.release;
        }

        let gateGain = 1;
        if (gateOn) {
          if (this.envelope < threshold) {
            gateGain = 0;
          } else {
            const range = Math.max(threshold * 0.8, 0.005);
            gateGain = Math.min(1, (this.envelope - threshold) / range);
          }
        }

        const g = (gainValues ? gainValues[i] : gainValue) * gateGain;
        outputChannel[i] = sample * g;
      }
    }

    this.peak = Math.max(this.peak * 0.95, blockPeak);

    this.frameCount++;
    if (this.frameCount % 3 === 0) {
      this.port.postMessage({ level: this.envelope, peak: this.peak });
    }

    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
