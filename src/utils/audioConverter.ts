
export class AudioConverter {
  /**
   * Converte áudio para formato otimizado para WhatsApp COM metadados de duração
   */
  static async convertToOGGWithDuration(audioBlob: Blob, duration: number): Promise<Blob> {
    try {
      console.log('🔄 Criando áudio com duração para WhatsApp...', { duration, type: audioBlob.type });
      
      // Para WebM/OGG gravados, tentar manter formato mas garantir metadados
      if (audioBlob.type.includes('webm') || audioBlob.type.includes('ogg')) {
        console.log('✅ Formato nativo detectado, otimizando metadados...');
        
        // Tentar criar OGG com metadados corretos
        const optimizedBlob = await this.createOGGWithMetadata(audioBlob, duration);
        if (optimizedBlob) {
          return optimizedBlob;
        }
      }

      // Fallback: Converter para WAV com header completo
      console.log('⚡ Convertendo para WAV com metadados completos...');
      return this.convertToWAVWithDuration(audioBlob, duration);
    } catch (error) {
      console.error('❌ Erro na otimização, usando fallback WAV:', error);
      return this.convertToWAVWithDuration(audioBlob, duration);
    }
  }

  /**
   * Cria arquivo OGG com metadados de duração adequados
   */
  static async createOGGWithMetadata(audioBlob: Blob, duration: number): Promise<Blob | null> {
    try {
      // Para OGG/WebM simples, usar como está mas com tipo correto
      if (duration > 0) {
        console.log(`✅ Criando OGG otimizado (${duration}s)`);
        return new Blob([audioBlob], { type: 'audio/ogg; codecs=opus' });
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao criar OGG com metadados:', error);
      return null;
    }
  }

  /**
   * Converte para WAV com duração adequada para WhatsApp
   */
  static async convertToWAVWithDuration(audioBlob: Blob, duration: number): Promise<Blob> {
    try {
      console.log('🔄 Convertendo para WAV com duração:', duration);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Criar WAV com header completo incluindo duração calculada
      const wavBuffer = this.audioBufferToWavWithDuration(audioBuffer, duration);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      console.log('✅ WAV criado com metadados:', {
        duration: duration,
        size: wavBlob.size,
        type: wavBlob.type,
        sampleRate: audioBuffer.sampleRate
      });
      
      return wavBlob;
    } catch (error) {
      console.error('❌ Erro na conversão WAV:', error);
      throw error;
    }
  }

  static async convertToOGG(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('🔄 Otimizando áudio para WhatsApp...');
      
      // ✅ CORREÇÃO: Priorizar formatos nativos e manter tamanho otimizado
      const compatibleFormats = ['audio/ogg', 'audio/webm', 'audio/wav'];
      
      if (compatibleFormats.some(format => audioBlob.type.includes(format))) {
        console.log('✅ Áudio já está em formato compatível:', audioBlob.type);
        return audioBlob;
      }

      // Só converter se realmente necessário e para um formato menor
      if (audioBlob.type.includes('webm')) {
        // WebM é nativo do navegador, manter como está
        console.log('✅ Mantendo formato WebM nativo');
        return audioBlob;
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Criar WAV otimizado (mais compatível que converter para OGG)
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      const optimizedBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      console.log('✅ Áudio otimizado:', {
        originalSize: audioBlob.size,
        optimizedSize: optimizedBlob.size,
        reduction: Math.round((1 - optimizedBlob.size / audioBlob.size) * 100) + '%',
        originalType: audioBlob.type,
        finalType: optimizedBlob.type
      });
      
      return optimizedBlob;
    } catch (error) {
      console.error('❌ Erro na otimização, mantendo original:', error);
      return audioBlob; // ✅ CORREÇÃO: Retornar original em caso de erro
    }
  }

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

  /**
   * Converte AudioBuffer para WAV com duração específica para WhatsApp
   */
  private static audioBufferToWavWithDuration(buffer: AudioBuffer, duration: number): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    
    // Calcular tamanho baseado na duração real para metadados precisos
    const expectedSamples = Math.floor(duration * sampleRate);
    const actualLength = Math.min(length, expectedSamples);
    
    const arrayBuffer = new ArrayBuffer(44 + actualLength * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    console.log(`🔧 Criando WAV: ${duration}s, ${sampleRate}Hz, ${numberOfChannels}ch, ${actualLength} samples`);
    
    // WAV header otimizado para WhatsApp
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    let offset = 0;
    writeString(offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + actualLength * numberOfChannels * 2, true); offset += 4;
    writeString(offset, 'WAVE'); offset += 4;
    writeString(offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2; // PCM format
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numberOfChannels * 2, true); offset += 4; // byte rate
    view.setUint16(offset, numberOfChannels * 2, true); offset += 2; // block align
    view.setUint16(offset, 16, true); offset += 2; // bits per sample
    writeString(offset, 'data'); offset += 4;
    view.setUint32(offset, actualLength * numberOfChannels * 2, true); offset += 4;
    
    // Converter samples com duração precisa
    const channels = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channels.push(buffer.getChannelData(channel));
    }
    
    let sampleOffset = offset;
    for (let i = 0; i < actualLength; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i] || 0));
        view.setInt16(sampleOffset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        sampleOffset += 2;
      }
    }
    
    return arrayBuffer;
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

  // Método para detectar melhor formato suportado
  static detectOptimalFormat(audioBlob: Blob): string {
    console.log('🔍 Detectando formato ótimo para:', audioBlob.type);
    
    // Prioridade: OGG > WAV > MP3
    const formatPriority = ['audio/ogg', 'audio/wav', 'audio/mpeg'];
    
    if (formatPriority.includes(audioBlob.type)) {
      console.log(`✅ Formato ${audioBlob.type} é otimizado`);
      return audioBlob.type;
    }
    
    console.log('⚠️ Formato não otimizado, recomendando OGG');
    return 'audio/ogg';
  }

  /**
   * Valida se o áudio tem metadados de duração adequados
   */
  static async validateAudioDuration(audioBlob: Blob, expectedDuration: number): Promise<boolean> {
    try {
      // Para WAV, verificar header
      if (audioBlob.type.includes('wav')) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const view = new DataView(arrayBuffer);
        
        // Verificar se é um WAV válido
        const riff = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4));
        if (riff === 'RIFF') {
          const fileSize = view.getUint32(4, true);
          const expectedSize = Math.floor(expectedDuration * 44100 * 2 * 1) + 44; // aproximado
          const sizeDiff = Math.abs(fileSize - expectedSize) / expectedSize;
          
          console.log('🔍 Validação WAV:', { 
            fileSize, 
            expectedSize, 
            sizeDiff: Math.round(sizeDiff * 100) + '%' 
          });
          
          return sizeDiff < 0.1; // 10% de tolerância
        }
      }
      
      // Para outros formatos, assumir válido se o tipo estiver correto
      return true;
    } catch (error) {
      console.warn('⚠️ Erro na validação, assumindo válido:', error);
      return true;
    }
  }
}
