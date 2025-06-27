
export class AudioConverter {
  static async convertToWAV(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('🔄 Convertendo áudio para WAV...');
      
      // Se já é WAV, retornar diretamente
      if (audioBlob.type === 'audio/wav') {
        console.log('✅ Áudio já está em formato WAV');
        return audioBlob;
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Converter para WAV usando AudioBuffer
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      console.log('✅ Áudio convertido para WAV:', {
        originalSize: audioBlob.size,
        newSize: wavBlob.size,
        originalType: audioBlob.type,
        newType: wavBlob.type
      });
      
      return wavBlob;
    } catch (error) {
      console.error('❌ Erro na conversão para WAV:', error);
      // Fallback: retornar original
      return audioBlob;
    }
  }

  private static audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    let offset = 0;
    writeString(offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + length * numberOfChannels * 2, true); offset += 4;
    writeString(offset, 'WAVE'); offset += 4;
    writeString(offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numberOfChannels * 2, true); offset += 4;
    view.setUint16(offset, numberOfChannels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(offset, 'data'); offset += 4;
    view.setUint32(offset, length * numberOfChannels * 2, true); offset += 4;
    
    // Convert samples
    const channels = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channels.push(buffer.getChannelData(channel));
    }
    
    let sampleOffset = offset;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(sampleOffset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        sampleOffset += 2;
      }
    }
    
    return arrayBuffer;
  }

  static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
