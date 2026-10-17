// AudioWorklet processor for low-latency mic monitoring
class MicProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'gain',
      defaultValue: 0.8,
      minValue: 0,
      maxValue: 2,
      automationRate: 'a-rate'
    }];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const gain = parameters.gain;

    if (input.length === 0) return true;

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      const gainValues = gain.length > 1 ? gain : null;
      const gainValue = gain.length === 1 ? gain[0] : 1;

      for (let i = 0; i < inputChannel.length; i++) {
        const g = gainValues ? gainValues[i] : gainValue;
        outputChannel[i] = inputChannel[i] * g;
      }
    }

    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
