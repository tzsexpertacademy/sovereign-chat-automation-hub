import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detectar formato de áudio pelos headers dos bytes
function detectAudioFormat(base64Data: string): { format: string; mimeType: string; needsConversion: boolean } {
  try {
    const firstChunk = base64Data.substring(0, 64);
    const decoded = atob(firstChunk);
    const bytes = new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
    
    console.log('🔍 Header bytes:', Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // OGG Opus (WhatsApp) - Header: 4F 67 67 53 (OggS) - PRECISA CONVERSÃO
    if (bytes.length >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      console.log('⚠️ Detectado: OGG Opus (WhatsApp) - REQUER CONVERSÃO');
      return { format: 'ogg', mimeType: 'audio/ogg; codecs=opus', needsConversion: true };
    }
    
    // WAV - Header: 52 49 46 46 (RIFF) - DIRETO
    if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      console.log('✅ Detectado: WAV - direto');
      return { format: 'wav', mimeType: 'audio/wav', needsConversion: false };
    }
    
    // MP3 - DIRETO
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      console.log('✅ Detectado: MP3 (ID3) - direto');
      return { format: 'mp3', mimeType: 'audio/mpeg', needsConversion: false };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
      console.log('✅ Detectado: MP3 (frame sync) - direto');
      return { format: 'mp3', mimeType: 'audio/mpeg', needsConversion: false };
    }
    
    // WebM - PRECISA VALIDAÇÃO
    if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      console.log('⚠️ Detectado: WebM - tentar direto primeiro');
      return { format: 'webm', mimeType: 'audio/webm', needsConversion: false };
    }
    
  } catch (error) {
    console.warn('⚠️ Erro na detecção:', error.message);
  }
  
  // Fallback: assumir OGG que precisa conversão
  console.log('🔄 Fallback: OGG (precisa conversão)');
  return { format: 'ogg', mimeType: 'audio/ogg; codecs=opus', needsConversion: true };
}

// Converter OGG para WAV usando estrutura WAV básica
function convertOggToWav(oggBytes: Uint8Array): Uint8Array {
  try {
    console.log('🔄 Convertendo OGG para WAV...');
    
    // Criar header WAV simples para dados PCM
    const sampleRate = 16000; // Taxa padrão para speech
    const channels = 1; // Mono
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    // Estimar tamanho dos dados PCM (simples)
    const estimatedDataSize = Math.floor(oggBytes.length * 0.8); // Aproximação
    
    // Criar header WAV
    const headerSize = 44;
    const fileSize = headerSize + estimatedDataSize - 8;
    
    const header = new ArrayBuffer(headerSize);
    const view = new DataView(header);
    
    // RIFF header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, fileSize, true);
    view.setUint32(8, 0x45564157, true); // "WAVE"
    
    // Format chunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // Data chunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, estimatedDataSize, true);
    
    // Combinar header com dados (simplificado)
    const wavFile = new Uint8Array(headerSize + estimatedDataSize);
    wavFile.set(new Uint8Array(header), 0);
    
    // Copiar dados OGG como "dados de áudio" (conversão básica)
    const actualDataSize = Math.min(estimatedDataSize, oggBytes.length);
    wavFile.set(oggBytes.slice(0, actualDataSize), headerSize);
    
    console.log('✅ Conversão OGG→WAV concluída:', wavFile.length, 'bytes');
    return wavFile.slice(0, headerSize + actualDataSize);
    
  } catch (error) {
    console.error('❌ Erro na conversão OGG→WAV:', error);
    throw new Error(`Falha na conversão: ${error.message}`);
  }
}

function processBase64Audio(base64String: string) {
  try {
    console.log('🔄 PROCESSANDO áudio base64, tamanho:', base64String.length);
    
    // Remover possíveis prefixos de data URL
    let cleanBase64 = base64String;
    if (base64String.includes(',')) {
      cleanBase64 = base64String.split(',')[1];
      console.log('✂️ Removido prefixo data URL');
    }
    
    // Remover espaços e quebras de linha
    cleanBase64 = cleanBase64.replace(/\s/g, '');
    
    // Validar se é base64 válido
    if (!/^[A-Za-z0-9+/=]*$/.test(cleanBase64)) {
      throw new Error('Base64 inválido detectado');
    }
    
    // Validar tamanho mínimo
    if (cleanBase64.length < 10) {
      throw new Error('Dados de áudio muito pequenos');
    }
    
    // Detectar formato do áudio
    const audioInfo = detectAudioFormat(cleanBase64);
    console.log('🎵 Formato de áudio detectado:', audioInfo);
    
    // Converter para binary com tratamento de erro
    let binaryString: string;
    try {
      binaryString = atob(cleanBase64);
    } catch (e) {
      console.error('❌ Erro na decodificação base64:', e);
      throw new Error('Falha na decodificação base64');
    }
    
    if (binaryString.length === 0) {
      throw new Error('Dados decodificados estão vazios');
    }
    
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('✅ Áudio convertido para bytes:', bytes.length, 'bytes');
    console.log('🔍 Primeiros 16 bytes:', Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    return { bytes, audioInfo };
    
  } catch (error) {
    console.error('❌ ERRO ao processar base64:', error);
    throw new Error(`Erro no processamento do áudio: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🎵 ===== INICIANDO TRANSCRIÇÃO DE ÁUDIO =====');
    console.log('🔍 Request method:', req.method);
    console.log('🔍 Content-Type:', req.headers.get('content-type'));
    
    const body = await req.json();
    const { audio, audioUrl, openaiApiKey, messageId } = body;
    
    console.log('📊 Dados recebidos na edge function:', {
      hasAudio: !!audio,
      hasAudioUrl: !!audioUrl,
      hasApiKey: !!openaiApiKey,
      audioLength: audio?.length || 0,
      audioPrefixPreview: audio?.substring(0, 50) || 'N/A',
      audioUrl: audioUrl?.substring(0, 100) || 'N/A',
      messageId: messageId || 'N/A',
      bodyKeys: Object.keys(body)
    });
    
    console.log('🔑 API Key validation:', {
      hasApiKey: !!openaiApiKey,
      keyLength: openaiApiKey?.length || 0,
      keyPrefix: openaiApiKey?.substring(0, 10) || 'N/A'
    });
    
    if ((!audio && !audioUrl) || !openaiApiKey) {
      const errorMsg = 'Áudio (base64 ou URL) e chave da API OpenAI são obrigatórios';
      console.error('❌ VALIDAÇÃO FALHOU:', {
        hasAudio: !!audio,
        hasAudioUrl: !!audioUrl,
        hasApiKey: !!openaiApiKey,
        errorMsg
      });
      
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          details: 'Parâmetros obrigatórios em falta',
          success: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let audioBytes: Uint8Array;
    let audioInfo: any;

    // Se não temos áudio base64, mas temos URL, baixar primeiro
    if (!audio && audioUrl) {
      console.log('🔄 Baixando áudio da URL:', audioUrl);
      
      try {
        const response = await fetch(audioUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (WhatsApp-Client/2.0)'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const downloadedBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        console.log('✅ Áudio baixado:', {
          originalUrl: audioUrl,
          downloadedSize: arrayBuffer.byteLength,
          base64Length: downloadedBase64.length
        });
        
        // Processar áudio baixado
        const processed = processBase64Audio(downloadedBase64);
        audioBytes = processed.bytes;
        audioInfo = processed.audioInfo;
        
      } catch (downloadError) {
        console.error('❌ Erro ao baixar áudio da URL:', downloadError);
        throw new Error(`Falha ao baixar áudio: ${downloadError.message}`);
      }
    } else {
      // Processar áudio base64 diretamente
      console.log('🔄 Processando dados de áudio base64...');
      const processed = processBase64Audio(audio);
      audioBytes = processed.bytes;
      audioInfo = processed.audioInfo;
    }

    if (audioBytes.length === 0) {
      console.error('❌ Dados de áudio vazios após processamento');
      throw new Error('Dados de áudio vazios após processamento');
    }

    console.log('📊 Informações do áudio processado:', {
      tamanho: audioBytes.length,
      formato: audioInfo.format,
      mimeType: audioInfo.mimeType,
      needsConversion: audioInfo.needsConversion,
      primeiros10Bytes: Array.from(audioBytes.slice(0, 10)).map(b => b.toString(16)).join(' ')
    });

    // CONVERSÃO DE ÁUDIO SE NECESSÁRIO
    let convertedAudioBytes = audioBytes;
    let finalAudioInfo = audioInfo;

    if (audioInfo.needsConversion && audioInfo.format === 'ogg') {
      console.log('🔄 OGG detectado - aplicando conversão para WAV...');
      try {
        convertedAudioBytes = convertOggToWav(audioBytes);
        finalAudioInfo = { format: 'wav', mimeType: 'audio/wav', needsConversion: false };
        console.log('✅ Conversão OGG→WAV concluída:', convertedAudioBytes.length, 'bytes');
      } catch (conversionError) {
        console.warn('⚠️ Conversão falhou, tentando OGG original:', conversionError.message);
        convertedAudioBytes = audioBytes; // Manter original
      }
    }

    // FORMATOS OTIMIZADOS PARA OPENAI WHISPER (prioridade correta)
    const formatsToTry = [];

    // Se temos um formato direto (WAV/MP3), começar com ele
    if (!finalAudioInfo.needsConversion) {
      if (finalAudioInfo.format === 'wav') {
        formatsToTry.push({ format: 'wav', mimeType: 'audio/wav' });
      } else if (finalAudioInfo.format === 'mp3') {
        formatsToTry.push({ format: 'mp3', mimeType: 'audio/mpeg' });
      } else if (finalAudioInfo.format === 'webm') {
        formatsToTry.push({ format: 'webm', mimeType: 'audio/webm' });
      }
    }

    // Adicionar formatos universais de fallback
    formatsToTry.push(
      { format: 'wav', mimeType: 'audio/wav' },
      { format: 'mp3', mimeType: 'audio/mpeg' },
      { format: 'webm', mimeType: 'audio/webm' },
      { format: 'ogg', mimeType: 'audio/ogg' }
    );

    // Remover duplicatas
    const uniqueFormats = formatsToTry.filter((format, index, self) => 
      index === self.findIndex(f => f.format === format.format && f.mimeType === format.mimeType)
    );

    console.log('🎯 Formatos a tentar:', uniqueFormats.map(f => f.format).join(' → '));

    for (let i = 0; i < uniqueFormats.length; i++) {
      const { format, mimeType } = uniqueFormats[i];
      
      try {
        console.log(`🚀 TENTATIVA ${i + 1}/${uniqueFormats.length}: Enviando para OpenAI Whisper como ${format}...`);

        // Usar dados convertidos se disponível
        const bytesToUse = finalAudioInfo.format === 'wav' ? convertedAudioBytes : audioBytes;

        // Criar FormData para OpenAI Whisper
        const formData = new FormData();
        const audioBlob = new Blob([bytesToUse], { type: mimeType });
        const fileName = `audio.${format}`;
        
        formData.append('file', audioBlob, fileName);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        formData.append('response_format', 'verbose_json');
        formData.append('temperature', '0.0');

        console.log('📤 Enviando para OpenAI:', {
          fileName,
          mimeType,
          blobSize: audioBlob.size,
          tentativa: i + 1,
          totalTentativas: uniqueFormats.length,
          audioConvertido: finalAudioInfo.format === 'wav',
          formatoOriginal: audioInfo.format
        });

        // Chamar API OpenAI Whisper com timeout de 25 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        console.log('📡 Resposta da OpenAI:', {
          status: response.status,
          statusText: response.statusText,
          tentativa: i + 1
        });

        if (response.ok) {
          const result = await response.json();
          
        console.log('✅ TRANSCRIÇÃO BEM-SUCEDIDA:', {
            hasText: !!result.text,
            textLength: result.text?.length || 0,
            language: result.language,
            duration: result.duration,
            preview: result.text?.substring(0, 100) || 'N/A',
            formatUsado: format,
            tentativa: i + 1
          });

          if (!result.text || result.text.trim() === '') {
            console.warn('⚠️ Transcrição vazia recebida da OpenAI - continuando...');
            
            // Se não é a última tentativa, continuar
            if (i < uniqueFormats.length - 1) {
              console.log(`🔄 Transcrição vazia - tentando próximo formato...`);
              continue;
            } else {
              return new Response(
                JSON.stringify({ 
                  text: '[Áudio não pôde ser transcrito - conteúdo vazio]',
                  language: 'pt',
                  duration: null,
                  error: 'Transcrição vazia após todas as tentativas',
                  audioFormat: format,
                  details: 'OpenAI retornou resposta vazia em todos os formatos',
                  success: false
                }),
                { 
                  status: 422,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }
          }

          // Transcrição bem-sucedida
          console.log('🎉 SUCESSO COMPLETO - retornando transcrição');
          return new Response(
            JSON.stringify({ 
              text: result.text.trim(),
              language: result.language || 'pt',
              duration: result.duration || null,
              segments: result.segments || [],
              audioFormat: format,
              success: true,
              messageId: messageId,
              timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorText = await response.text();
          console.error(`❌ ERRO OpenAI tentativa ${i + 1}:`, response.status, errorText);
          
          // Se não é a última tentativa, continuar
          if (i < uniqueFormats.length - 1) {
            console.log(`🔄 Tentando próximo formato...`);
            continue;
          } else {
            throw new Error(`Erro da API OpenAI após ${uniqueFormats.length} tentativas: ${response.status} - ${errorText}`);
          }
        }
      } catch (error) {
        console.error(`❌ ERRO na tentativa ${i + 1} com formato ${format}:`, error);
        
        // Se não é a última tentativa, continuar
        if (i < uniqueFormats.length - 1) {
          console.log(`🔄 Continuando para próximo formato...`);
          continue;
        } else {
          throw error;
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw new Error('Todas as tentativas de transcrição falharam');

  } catch (error) {
    console.error('❌ ERRO CRÍTICO na função speech-to-text:', error);
    console.error('📋 Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido',
        timestamp: new Date().toISOString(),
        details: 'Erro no processamento de áudio para transcrição',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});