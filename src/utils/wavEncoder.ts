
export class WAVEncoder {
  private sampleRate: number;
  private numChannels: number;
  private bitDepth: number;

  constructor(sampleRate = 44100, numChannels = 1, bitDepth = 16) {
    this.sampleRate = sampleRate;
    this.numChannels = numChannels;
    this.bitDepth = bitDepth;
  }

  private writeString(view: DataView, offset: number, string: string): number {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
    return offset + string.length;
  }

  private floatTo16BitPCM(output: DataView, offset: number, input: Float32Array): number {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return offset;
  }

  encodeWAV(samples: Float32Array): Blob {
    const length = samples.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);

    // WAV Header
    let offset = 0;
    
    // RIFF chunk descriptor
    offset = this.writeString(view, offset, 'RIFF');
    view.setUint32(offset, 36 + length * 2, true); // File size - 8
    offset += 4;
    offset = this.writeString(view, offset, 'WAVE');

    // FMT sub-chunk
    offset = this.writeString(view, offset, 'fmt ');
    view.setUint32(offset, 16, true); // Sub-chunk size
    offset += 4;
    view.setUint16(offset, 1, true); // Audio format (PCM)
    offset += 2;
    view.setUint16(offset, this.numChannels, true); // Number of channels
    offset += 2;
    view.setUint32(offset, this.sampleRate, true); // Sample rate
    offset += 4;
    view.setUint32(offset, this.sampleRate * this.numChannels * this.bitDepth / 8, true); // Byte rate
    offset += 4;
    view.setUint16(offset, this.numChannels * this.bitDepth / 8, true); // Block align
    offset += 2;
    view.setUint16(offset, this.bitDepth, true); // Bits per sample
    offset += 2;

    // Data sub-chunk
    offset = this.writeString(view, offset, 'data');
    view.setUint32(offset, length * 2, true); // Sub-chunk size
    offset += 4;

    // Write PCM data
    this.floatTo16BitPCM(view, offset, samples);

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
