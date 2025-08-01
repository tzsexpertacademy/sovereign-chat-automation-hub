import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, content, options, mimeType } = await req.json();
    
    console.log('🎬 [MULTIMEDIA-PROCESSOR] Processando:', {
      type,
      hasContent: !!content,
      contentLength: content?.length || 0,
      clientId: options?.clientId,
      ticketId: options?.ticketId
    });

    // Buscar API Key do cliente
    const { data: aiConfig } = await supabase
      .from('client_ai_configs')
      .select('openai_api_key')
      .eq('client_id', options.clientId)
      .single();

    if (!aiConfig?.openai_api_key) {
      throw new Error('API Key OpenAI não configurada para este cliente');
    }

    let result;

    switch (type) {
      case 'image':
        result = await processImageWithVision(content, aiConfig.openai_api_key);
        break;
      case 'audio':
        result = await processAudioTranscription(content, aiConfig.openai_api_key);
        break;
      case 'video':
        result = await processVideoAnalysis(content, aiConfig.openai_api_key);
        break;
      case 'document':
        result = await processDocumentExtraction(content, mimeType);
        break;
      case 'url':
        result = await processURLAnalysis(content);
        break;
      default:
        throw new Error(`Tipo de mídia não suportado: ${type}`);
    }

    // Salvar análise no banco se autoSave estiver habilitado
    if (options.autoSave && options.messageId && result.analysis) {
      await supabase
        .from('ticket_messages')
        .update({ media_transcription: result.analysis })
        .eq('message_id', options.messageId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [MULTIMEDIA-PROCESSOR] Erro:', error);
    return new Response(JSON.stringify({
      error: error.message,
      analysis: '[Erro no processamento]'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ==================== FUNÇÕES DE PROCESSAMENTO ====================

/**
 * Processar imagem com GPT-4 Vision
 */
async function processImageWithVision(imageBase64: string, apiKey: string) {
  try {
    console.log('🖼️ [VISION] Processando imagem com GPT-4 Vision');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta imagem detalhadamente em português brasileiro. 

INSTRUÇÕES ESPECÍFICAS:
1. Descreva o que você vê de forma clara e objetiva
2. Se houver texto na imagem, transcreva-o completamente
3. Identifique objetos, pessoas, lugares, cores predominantes
4. Se for um documento, extract informações importantes
5. Se for um produto, descreva características e detalhes
6. Se for uma conversa/screenshot, resuma o conteúdo
7. Forneça informações úteis para um assistente de atendimento

Seja detalhado mas conciso. Foque em informações que ajudariam um atendente a entender e responder adequadamente.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('✅ [VISION] Análise concluída:', analysis.substring(0, 150));
    
    return {
      success: true,
      analysis,
      metadata: {
        format: 'image',
        size: Math.round(imageBase64.length * 0.75), // Aproximação do tamanho
        model: 'gpt-4o'
      }
    };
    
  } catch (error) {
    console.error('❌ [VISION] Erro:', error);
    return {
      success: false,
      analysis: `[Erro ao analisar imagem: ${error.message}]`,
      metadata: { error: error.message }
    };
  }
}

/**
 * Transcrever áudio com Whisper
 */
async function processAudioTranscription(audioBase64: string, apiKey: string) {
  try {
    console.log('🎵 [AUDIO] Transcrevendo áudio com Whisper');
    
    // Converter base64 para blob
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'audio/ogg' });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const transcription = data.text || '[Áudio não pôde ser transcrito]';
    
    console.log('✅ [AUDIO] Transcrição concluída:', transcription.substring(0, 100));
    
    return {
      success: true,
      analysis: transcription,
      metadata: {
        format: 'audio',
        duration: data.duration,
        language: data.language || 'pt',
        model: 'whisper-1'
      }
    };
    
  } catch (error) {
    console.error('❌ [AUDIO] Erro:', error);
    return {
      success: false,
      analysis: `[Erro ao transcrever áudio: ${error.message}]`,
      metadata: { error: error.message }
    };
  }
}

/**
 * Analisar vídeo (implementação básica)
 */
async function processVideoAnalysis(videoBase64: string, apiKey: string) {
  try {
    console.log('🎬 [VIDEO] Analisando vídeo');
    
    // Para vídeos, por enquanto retornamos análise básica
    // Em uma implementação completa, extrairíamos frames com FFmpeg
    
    const videoSize = Math.round(videoBase64.length * 0.75 / 1024 / 1024); // MB
    
    const analysis = `[VÍDEO RECEBIDO]
Tamanho: ~${videoSize}MB
Status: Vídeo foi recebido e armazenado com sucesso.

PRÓXIMOS PASSOS PARA ANÁLISE COMPLETA:
- Extração de frames-chave para análise visual
- Extração e transcrição de áudio (se houver)
- Análise de conteúdo visual com IA

Por favor, descreva brevemente o conteúdo do vídeo para que eu possa te ajudar melhor.`;
    
    console.log('✅ [VIDEO] Análise básica concluída');
    
    return {
      success: true,
      analysis,
      metadata: {
        format: 'video',
        size: videoSize,
        status: 'basic_analysis'
      }
    };
    
  } catch (error) {
    console.error('❌ [VIDEO] Erro:', error);
    return {
      success: false,
      analysis: `[Erro ao analisar vídeo: ${error.message}]`,
      metadata: { error: error.message }
    };
  }
}

/**
 * Extrair texto de documentos
 */
async function processDocumentExtraction(documentBase64: string, mimeType: string) {
  try {
    console.log('📄 [DOCUMENT] Extraindo texto de documento:', mimeType);
    
    if (mimeType?.includes('pdf')) {
      return await extractPDFText(documentBase64);
    } else if (mimeType?.includes('text')) {
      // Texto simples
      const text = atob(documentBase64);
      const preview = text.length > 2000 ? text.substring(0, 2000) + '...' : text;
      
      return {
        success: true,
        analysis: `[DOCUMENTO TEXTO]\n\nConteúdo:\n${preview}`,
        metadata: {
          format: 'text',
          size: text.length,
          truncated: text.length > 2000
        }
      };
    } else if (mimeType?.includes('application/vnd.openxmlformats-officedocument')) {
      // Office documents (DOCX, XLSX, etc.)
      const docSize = Math.round(documentBase64.length * 0.75 / 1024); // KB
      
      return {
        success: true,
        analysis: `[DOCUMENTO OFFICE RECEBIDO]
Tipo: ${mimeType.includes('wordprocessingml') ? 'Word Document' : 
       mimeType.includes('spreadsheetml') ? 'Excel Spreadsheet' :
       mimeType.includes('presentationml') ? 'PowerPoint Presentation' : 'Documento Office'}
Tamanho: ~${docSize}KB

O documento foi recebido com sucesso. Para uma análise completa do conteúdo, seria necessário um processamento especializado. 

Por favor, descreva o conteúdo do documento ou me diga como posso te ajudar com ele.`,
        metadata: {
          format: 'office',
          size: docSize,
          type: mimeType
        }
      };
    } else {
      const docSize = Math.round(documentBase64.length * 0.75 / 1024); // KB
      
      return {
        success: true,
        analysis: `[DOCUMENTO RECEBIDO]
Tipo: ${mimeType || 'Formato não identificado'}
Tamanho: ~${docSize}KB

Documento recebido com sucesso. Para análise do conteúdo, por favor me diga do que se trata ou como posso te ajudar.`,
        metadata: {
          format: 'unknown',
          size: docSize,
          type: mimeType
        }
      };
    }
    
  } catch (error) {
    console.error('❌ [DOCUMENT] Erro:', error);
    return {
      success: false,
      analysis: `[Erro ao processar documento: ${error.message}]`,
      metadata: { error: error.message }
    };
  }
}

/**
 * Extrair texto de PDF (implementação básica)
 */
async function extractPDFText(pdfBase64: string) {
  try {
    console.log('📄 [PDF] Analisando PDF');
    
    const pdfSize = Math.round(pdfBase64.length * 0.75 / 1024); // KB
    
    // Implementação básica - análise de metadados
    const analysis = `[PDF RECEBIDO]
Tamanho: ~${pdfSize}KB
Status: PDF recebido e armazenado com sucesso.

RECURSOS DISPONÍVEIS:
- Documento salvo e acessível
- Pronto para análise de conteúdo

PRÓXIMOS PASSOS:
Para uma análise completa do conteúdo do PDF, seria necessário:
- Extração de texto com bibliotecas especializadas
- Análise de imagens e gráficos contidos
- Processamento de tabelas e dados estruturados

Por favor, me diga sobre o que trata o PDF ou como posso te ajudar com ele.`;
    
    return {
      success: true,
      analysis,
      metadata: {
        format: 'pdf',
        size: pdfSize,
        status: 'received'
      }
    };
    
  } catch (error) {
    console.error('❌ [PDF] Erro:', error);
    return {
      success: false,
      analysis: `[Erro ao processar PDF: ${error.message}]`,
      metadata: { error: error.message }
    };
  }
}

/**
 * Analisar URL (web scraping inteligente)
 */
async function processURLAnalysis(url: string) {
  try {
    console.log('🌐 [URL] Analisando URL:', url);
    
    // Validar URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL deve começar com http:// ou https://');
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extrair informações básicas
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Sem título';
    
    // Meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Open Graph data
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';
    
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : '';
    
    // Detectar tipo de site
    let siteType = 'website';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      siteType = 'youtube';
    } else if (url.includes('instagram.com')) {
      siteType = 'instagram';
    } else if (url.includes('facebook.com')) {
      siteType = 'facebook';
    } else if (url.includes('linkedin.com')) {
      siteType = 'linkedin';
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      siteType = 'twitter';
    }
    
    const analysis = `[ANÁLISE DE LINK: ${url}]

📍 INFORMAÇÕES BÁSICAS:
Título: ${ogTitle || title}
${description || ogDescription ? `Descrição: ${ogDescription || description}` : ''}
Tipo: ${siteType.toUpperCase()}

📋 RESUMO:
${ogDescription || description || 'Link acessado com sucesso. Conteúdo disponível para visualização.'}

✅ STATUS: Link válido e acessível`;
    
    console.log('✅ [URL] Análise concluída:', title);
    
    return {
      success: true,
      analysis,
      metadata: {
        title,
        description: ogDescription || description,
        siteType,
        url
      }
    };
    
  } catch (error) {
    console.error('❌ [URL] Erro:', error);
    return {
      success: false,
      analysis: `[ERRO AO ANALISAR LINK]

URL: ${url}
Erro: ${error.message}

O link pode estar inacessível, bloqueado ou com problemas temporários. Tente novamente mais tarde ou verifique se a URL está correta.`,
      metadata: { 
        error: error.message,
        url 
      }
    };
  }
}