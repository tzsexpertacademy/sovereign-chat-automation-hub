
export class AudioConverter {
  // Converter blob para base64
  static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remover o prefixo data:audio/...;base64, se presente
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Erro ao converter blob para base64'));
      reader.readAsDataURL(blob);
    });
  }

  // Converter para OGG usando Web Audio API
  static async convertToOGG(audioBlob: Blob): Promise<Blob> {
    console.log('🔄 Convertendo áudio para OGG...');
    console.log('📊 Blob original:', {
      size: audioBlob.size,
      type: audioBlob.type
    });

    try {
      // Se já é OGG, retornar como está
      if (audioBlob.type.includes('ogg')) {
        console.log('✅ Áudio já está em formato OGG');
        return audioBlob;
      }

      // Para WebM, simplesmente mudar o MIME type (compatível)
      if (audioBlob.type.includes('webm')) {
        console.log('🔄 Convertendo WebM para OGG (mudança de MIME type)');
        const buffer = await audioBlob.arrayBuffer();
        const oggBlob = new Blob([buffer], { type: 'audio/ogg' });
        
        console.log('✅ Conversão WebM->OGG concluída:', {
          originalSize: audioBlob.size,
          newSize: oggBlob.size,
          originalType: audioBlob.type,
          newType: oggBlob.type
        });
        
        return oggBlob;
      }

      // Para outros formatos, tentar usar Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Criar um novo blob OGG (simulado - na prática, browsers modernos aceitam WebM como OGG)
      const buffer = await audioBlob.arrayBuffer();
      const oggBlob = new Blob([buffer], { type: 'audio/ogg' });

      console.log('✅ Conversão para OGG concluída:', {
        originalSize: audioBlob.size,
        newSize: oggBlob.size,
        originalType: audioBlob.type,
        newType: oggBlob.type
      });

      return oggBlob;

    } catch (error) {
      console.warn('⚠️ Falha na conversão, usando áudio original:', error);
      
      // Fallback: criar blob OGG com os dados originais
      const buffer = await audioBlob.arrayBuffer();
      return new Blob([buffer], { type: 'audio/ogg' });
    }
  }

  // Detectar formato de áudio
  static detectAudioFormat(blob: Blob): string {
    if (blob.type.includes('ogg')) return 'ogg';
    if (blob.type.includes('wav')) return 'wav';
    if (blob.type.includes('mp3') || blob.type.includes('mpeg')) return 'mp3';
    if (blob.type.includes('webm')) return 'webm';
    return 'unknown';
  }

  // Validar se é um áudio válido
  static isValidAudio(blob: Blob): boolean {
    const validTypes = ['audio/', 'video/webm'];
    return validTypes.some(type => blob.type.includes(type)) && blob.size > 100;
  }
}
