
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detectar formato de áudio pelos headers dos bytes
function detectAudioFormat(base64Data: string): { format: string; mimeType: string } {
  try {
    // Pegar mais bytes para detecção precisa
    const firstChunk = base64Data.substring(0, 64);
    const decoded = atob(firstChunk);
    const bytes = new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
    
    console.log('🔍 Analisando header dos bytes:', Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // OGG Opus (WhatsApp) - Header: 4F 67 67 53 (OggS)
    if (bytes.length >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      console.log('✅ Detectado: OGG Opus (WhatsApp)');
      return { format: 'ogg', mimeType: 'audio/ogg; codecs=opus' };
    }
    
    // WAV - Header: 52 49 46 46 (RIFF)
    if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      console.log('✅ Detectado: WAV');
      return { format: 'wav', mimeType: 'audio/wav' };
    }
    
    // MP3 - ID3v2: 49 44 33 (ID3) ou Frame sync: FF FB/FA/F3/F2
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      console.log('✅ Detectado: MP3 com ID3');
      return { format: 'mp3', mimeType: 'audio/mpeg' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
      console.log('✅ Detectado: MP3 com frame sync');
      return { format: 'mp3', mimeType: 'audio/mpeg' };
    }
    
    // M4A/AAC - ftyp box: 66 74 79 70 no offset 4
    if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      console.log('✅ Detectado: M4A/AAC');
      return { format: 'm4a', mimeType: 'audio/mp4' };
    }
    
    // WebM - EBML: 1A 45 DF A3
    if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      console.log('✅ Detectado: WebM');
      return { format: 'webm', mimeType: 'audio/webm; codecs=opus' };
    }
    
    // FLAC - Header: 66 4C 61 43 (fLaC)
    if (bytes.length >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
      console.log('✅ Detectado: FLAC');
      return { format: 'flac', mimeType: 'audio/flac' };
    }
    
  } catch (error) {
    console.warn('⚠️ Erro na detecção de formato:', error.message);
  }
  
  // Fallback para OGG (formato mais comum do WhatsApp)
  console.log('🔄 Usando fallback: OGG Opus');
  return { format: 'ogg', mimeType: 'audio/ogg; codecs=opus' };
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
    
    // ✅ VALIDAÇÃO MELHORADA: Verificar dados obrigatórios
    if (!openaiApiKey) {
      console.error('❌ API Key OpenAI obrigatória não fornecida')
      return new Response(JSON.stringify({ 
        error: 'API Key OpenAI obrigatória',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (!audio && !audioUrl) {
      console.error('❌ Nenhum dado de áudio fornecido (base64 ou URL)')
      return new Response(JSON.stringify({ 
        error: 'Dados de áudio obrigatórios (base64 ou URL)',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ✅ VALIDAÇÃO CRÍTICA URGENTE: Verificar integridade do áudio
    if (audio && audio.trim().length < 1000) {
      console.error('❌ Dados de áudio muito pequenos para WhatsApp:', audio.length)
      return new Response(JSON.stringify({ 
        error: 'Dados de áudio insuficientes - possível corrupção na descriptografia',
        details: `Tamanho recebido: ${audio.length} caracteres (mínimo esperado: 1000+ para WhatsApp)`,
        success: false,
        suggestion: 'Verificar processo de descriptografia no process-received-media'
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ✅ VALIDAÇÃO ADICIONAL: Verificar se Base64 tem aparência de header de áudio corrompido  
    if (audio) {
      try {
        const firstBytes = atob(audio.substring(0, 20))
        const headerBytes = Array.from(firstBytes).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
        console.log(`🔍 [AUDIO-HEADER-CHECK] Primeiros bytes do Base64: ${headerBytes}`)
        
        // Verificar se começa com header inválido conhecido do bug anterior
        if (headerBytes.startsWith('6d fd c0 fa')) {
          console.error('❌ [AUDIO-HEADER-CHECK] Header corrompido detectado:', headerBytes)
          return new Response(JSON.stringify({ 
            error: 'Dados de áudio corrompidos - header inválido detectado',
            details: `Header encontrado: ${headerBytes} (deveria ser OGG: 4f 67 67 53)`,
            success: false,
            recommendation: 'Verificar processamento da mediaKey no process-received-media'
          }), {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      } catch (e) {
        console.warn('⚠️ Não foi possível validar header do áudio:', e.message)
      }
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
      primeiros10Bytes: Array.from(audioBytes.slice(0, 10)).map(b => b.toString(16)).join(' ')
    });

  // FORMATOS WHATSAPP OTIMIZADOS - OpenAI Whisper compatíveis
  const formatsToTry = [
    // PRIORIDADE 1: OGG Opus sem codecs (OpenAI prefere)
    { format: 'ogg', mimeType: 'audio/ogg' },
    // PRIORIDADE 2: WebM padrão (alternativa robusta)
    { format: 'webm', mimeType: 'audio/webm' },
    // PRIORIDADE 3: MP3 (conversão universal)
    { format: 'mp3', mimeType: 'audio/mpeg' },
    // PRIORIDADE 4: WAV (sem compressão)
    { format: 'wav', mimeType: 'audio/wav' },
    // PRIORIDADE 5: M4A (AAC container)
    { format: 'm4a', mimeType: 'audio/mp4' },
    // ÚLTIMAS: Formatos específicos
    { format: 'ogg', mimeType: 'audio/ogg; codecs=opus' },
    { format: 'webm', mimeType: 'audio/webm; codecs=opus' },
    { format: 'flac', mimeType: 'audio/flac' }
  ];

    for (let i = 0; i < formatsToTry.length; i++) {
      const { format, mimeType } = formatsToTry[i];
      
      try {
        console.log(`🚀 TENTATIVA ${i + 1}: Enviando para OpenAI Whisper como ${format}...`);

        // Criar FormData para OpenAI Whisper
        const formData = new FormData();
        const audioBlob = new Blob([audioBytes], { type: mimeType });
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
          isWhatsAppFormat: audioInfo.format === 'ogg'
        });

        // Chamar API OpenAI Whisper
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

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
            if (i < formatsToTry.length - 1) {
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
          if (i < formatsToTry.length - 1) {
            console.log(`🔄 Tentando próximo formato...`);
            continue;
          } else {
            throw new Error(`Erro da API OpenAI após ${formatsToTry.length} tentativas: ${response.status} - ${errorText}`);
          }
        }
      } catch (error) {
        console.error(`❌ ERRO na tentativa ${i + 1} com formato ${format}:`, error);
        
        // Se não é a última tentativa, continuar
        if (i < formatsToTry.length - 1) {
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
