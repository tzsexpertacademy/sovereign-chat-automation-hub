import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

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
    console.log('🔄 PROCESSANDO áudio base64, tamanho:', base64String?.length || 0);

    if (!base64String) {
      throw new Error('Base64 ausente');
    }

    // Remover possíveis prefixos de data URL
    let cleanBase64 = base64String;
    const dataUrlMatch = /^data:.*?;base64,/.exec(cleanBase64);
    if (dataUrlMatch) {
      cleanBase64 = cleanBase64.slice(dataUrlMatch[0].length);
      console.log('✂️ Removido prefixo data URL');
    }

    // Remover espaços e quebras de linha
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    // Normalizar padding (múltiplos de 4)
    const pad = cleanBase64.length % 4;
    if (pad === 1) {
      throw new Error('Base64 com padding inválido');
    } else if (pad > 0) {
      cleanBase64 = cleanBase64 + '='.repeat(4 - pad);
    }

    // Validar caracteres
    if (!/^[A-Za-z0-9+/=]*$/.test(cleanBase64)) {
      throw new Error('Base64 inválido detectado');
    }

    // Decodificar em chunks para evitar estouro e manter integridade
    const chunkSize = 32768; // 32KB
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < cleanBase64.length; i += chunkSize) {
      const chunk = cleanBase64.slice(i, i + chunkSize);
      const bin = atob(chunk);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      chunks.push(bytes);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const bytes = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }

    if (bytes.length === 0) throw new Error('Dados decodificados estão vazios');

    // Detectar formato (com a string limpa para manter logs anteriores)
    const audioInfo = detectAudioFormat(cleanBase64);
    console.log('✅ Áudio convertido para bytes:', bytes.length, 'bytes');
    console.log('🔍 Primeiros 16 bytes:', Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

    return { bytes, audioInfo };
  } catch (error: any) {
    console.error('❌ ERRO ao processar base64:', error);
    throw new Error(`Erro no processamento do áudio: ${error.message || String(error)}`);
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

    const effectiveOpenAiKey = openaiApiKey || Deno.env.get('OPENAI_API_KEY');
    
    console.log('📊 Dados recebidos na edge function:', {
      hasAudio: !!audio,
      hasAudioUrl: !!audioUrl,
      hasApiKey: !!effectiveOpenAiKey,
      audioLength: audio?.length || 0,
      audioPrefixPreview: audio?.substring(0, 50) || 'N/A',
      audioUrl: audioUrl?.substring(0, 100) || 'N/A',
      messageId: messageId || 'N/A',
      bodyKeys: Object.keys(body)
    });
    
    console.log('🔑 API Key validation:', {
      hasApiKey: !!effectiveOpenAiKey,
      keyLength: effectiveOpenAiKey?.length || 0,
      keyPrefix: effectiveOpenAiKey?.substring(0, 10) || 'N/A'
    });
    
    if ((!audio && !audioUrl) || !effectiveOpenAiKey) {
      const errorMsg = 'Áudio (base64 ou URL) e chave da API OpenAI são obrigatórios';
      console.error('❌ VALIDAÇÃO FALHOU:', {
        hasAudio: !!audio,
        hasAudioUrl: !!audioUrl,
        hasApiKey: !!effectiveOpenAiKey,
        errorMsg
      });
      
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          details: 'Parâmetros obrigatórios em falta (configure OPENAI_API_KEY nas Secrets da Function ou envie openaiApiKey no body)',
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

    // DEFINIÇÃO DE FORMATO E ORDEM DE TENTATIVAS (sem conversões artificiais)
    const formatsToTry: Array<{ format: string; mimeType: string }> = [];

    // Priorizar formato detectado quando disponível
    if (audioInfo?.format) {
      if (audioInfo.format === 'ogg') formatsToTry.push({ format: 'ogg', mimeType: 'audio/ogg' });
      if (audioInfo.format === 'webm') formatsToTry.push({ format: 'webm', mimeType: 'audio/webm' });
      if (audioInfo.format === 'mp3') formatsToTry.push({ format: 'mp3', mimeType: 'audio/mpeg' });
      if (audioInfo.format === 'wav') formatsToTry.push({ format: 'wav', mimeType: 'audio/wav' });
    }

    // Fallbacks universais (evitar duplicatas depois)
    formatsToTry.push(
      { format: 'ogg', mimeType: 'audio/ogg' },
      { format: 'webm', mimeType: 'audio/webm' },
      { format: 'mp3', mimeType: 'audio/mpeg' },
      { format: 'wav', mimeType: 'audio/wav' }
    );

    // Remover duplicatas mantendo a ordem
    const uniqueFormats = formatsToTry.filter((format, index, self) =>
      index === self.findIndex(f => f.format === format.format && f.mimeType === format.mimeType)
    );

    console.log('🎯 Formatos a tentar:', uniqueFormats.map(f => f.format).join(' → '));

    for (let i = 0; i < uniqueFormats.length; i++) {
      const { format, mimeType } = uniqueFormats[i];

      try {
        console.log(`🚀 TENTATIVA ${i + 1}/${uniqueFormats.length}: Enviando para OpenAI Whisper como ${format}...`);

        // Criar FormData para OpenAI Whisper com os bytes originais (sem conversões artificiais)
        const formData = new FormData();
        // For ogg/opus, force generic octet-stream to let OpenAI sniff content
        const blobType = format === 'ogg' ? 'application/octet-stream' : mimeType;
        const audioBlob = new Blob([audioBytes], { type: blobType });
        const fileExt = format === 'ogg' ? 'oga' : format;
        const fileName = `audio.${fileExt}`;

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
          audioConvertido: false,
          formatoOriginal: audioInfo.format
        });

        // Chamar API OpenAI Whisper com timeout de 25 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveOpenAiKey}`,
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

          // 🚨 FILTRO DE TRANSCRIÇÕES FALSAS - DETECTAR "AMARA.ORG" E SIMILARES
          const transcriptionText = result.text?.trim() || '';

          // Lista de transcrições conhecidas como falsas/inválidas
          const invalidTranscriptions = [
            'Legendas pela comunidade Amara.org',
            'Legendas por Amara.org',
            'Amara.org',
            'legendas pela comunidade amara',
            'comunidade amara',
            'amara org',
            'Subtitles by the Amara.org community',
            'Captions by Amara.org',
            // Outros padrões conhecidos de transcrições inválidas
            'youtube.com/timedtext_video',
            'www.youtube.com',
            'Generated by YouTube',
            'Auto-generated by YouTube'
          ];

          // Verificar se a transcrição é inválida
          const isInvalidTranscription = invalidTranscriptions.some(invalid =>
            transcriptionText.toLowerCase().includes(invalid.toLowerCase())
          );

          // Verificar se é muito curta ou muito genérica
          const isTooShort = transcriptionText.length < 3;
          const isTooGeneric = transcriptionText.match(/^[.\s,-]*$/); // Apenas pontuação/espaços

          if (isInvalidTranscription || isTooShort || isTooGeneric) {
            console.warn('🚨 TRANSCRIÇÃO INVÁLIDA DETECTADA:', {
              text: transcriptionText,
              isInvalidTranscription,
              isTooShort,
              isTooGeneric,
              tentativa: i + 1,
              formatoUsado: format
            });

            // Se não é a última tentativa, continuar com próximo formato
            if (i < uniqueFormats.length - 1) {
              console.log(`🔄 Transcrição inválida - tentando próximo formato...`);
              continue;
            } else {
              // Última tentativa - retornar indicação de falha mas sem erro 5xx
              return new Response(
                JSON.stringify({
                  text: null, // Não salvar transcrição inválida
                  language: 'pt',
                  duration: result.duration || null,
                  error: 'Transcrição inválida detectada - áudio pode estar corrompido ou em formato incompatível',
                  invalidTranscription: transcriptionText,
                  audioFormat: format,
                  details: `Detectada transcrição inválida: "${transcriptionText.substring(0, 100)}"`,
                  success: false,
                  shouldSaveAudio: true // Salvar o áudio mesmo sem transcrição
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          }

          if (!transcriptionText || transcriptionText === '') {
            console.warn('⚠️ Transcrição vazia recebida da OpenAI - continuando...');

            // Se não é a última tentativa, continuar
            if (i < uniqueFormats.length - 1) {
              console.log(`🔄 Transcrição vazia - tentando próximo formato...`);
              continue;
            } else {
              return new Response(
                JSON.stringify({
                  text: null,
                  language: 'pt',
                  duration: result.duration || null,
                  error: 'Transcrição vazia após todas as tentativas',
                  audioFormat: format,
                  details: 'OpenAI retornou resposta vazia em todos os formatos',
                  success: false,
                  shouldSaveAudio: true
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          }

          // ✅ TRANSCRIÇÃO VÁLIDA - salvar no banco (se possível) e retornar
          if (supabase && messageId && transcriptionText) {
            try {
              const updatePayload: Record<string, any> = { media_transcription: transcriptionText };
              if (result.duration) updatePayload.media_duration = Math.round(result.duration);
              const { error: updateError } = await supabase
                .from('ticket_messages')
                .update(updatePayload)
                .eq('message_id', messageId);
              if (updateError) {
                console.error('❌ Erro ao salvar transcrição no DB:', updateError);
              } else {
                console.log('✅ Transcrição salva no DB para message_id:', messageId);
              }
            } catch (e) {
              console.error('❌ Exceção ao salvar transcrição no DB:', e);
            }
          }

          console.log('🎉 SUCESSO COMPLETO - retornando transcrição válida');
          return new Response(
            JSON.stringify({
              text: transcriptionText, // Usar texto já validado
              language: result.language || 'pt',
              duration: result.duration || null,
              segments: result.segments || [],
              audioFormat: format,
              success: true,
              messageId: messageId,
              timestamp: new Date().toISOString(),
              confidence: 'high' // Indicar que passou pela validação
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