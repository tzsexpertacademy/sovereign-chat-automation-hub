
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// ===== INTERFACES PARA HUMANIZAÇÃO =====
interface HumanizedPersonality {
  id: string;
  name: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'empathetic';
  responseDelay: { min: number; max: number };
  typingSpeed: number; // WPM
  reactionProbability: number; // 0-1
}

interface HumanizedConfig {
  enabled: boolean;
  personality: HumanizedPersonality;
  behavior: {
    typing: {
      enabled: boolean;
      minDuration: number;
      maxDuration: number;
    };
    presence: {
      enabled: boolean;
      showTyping: boolean;
    };
    messageHandling: {
      splitLongMessages: boolean;
      maxCharsPerChunk: number;
      delayBetweenChunks: number;
    };
  };
}

// ===== PERSONALIDADES PADRÃO =====
const defaultPersonalities: HumanizedPersonality[] = [
  {
    id: 'friendly-assistant',
    name: 'Assistente Amigável',
    tone: 'friendly',
    responseDelay: { min: 2000, max: 4000 },
    typingSpeed: 45,
    reactionProbability: 0.7
  },
  {
    id: 'professional-support',
    name: 'Suporte Profissional',
    tone: 'professional',
    responseDelay: { min: 1500, max: 3000 },
    typingSpeed: 60,
    reactionProbability: 0.3
  }
];

// ===== CONFIGURAÇÃO HUMANIZADA PADRÃO =====
const defaultHumanizedConfig: HumanizedConfig = {
  enabled: true,
  personality: defaultPersonalities[0],
  behavior: {
    typing: {
      enabled: true,
      minDuration: 1000,
      maxDuration: 5000
    },
    presence: {
      enabled: true,
      showTyping: true
    },
    messageHandling: {
      splitLongMessages: true,
      maxCharsPerChunk: 350,
      delayBetweenChunks: 2500
    }
  }
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const globalOpenAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 [AI-ASSISTANT] Processando requisição');
    
    const { 
      ticketId, 
      message, 
      clientId, 
      instanceId,
      assistant,
      context 
    } = await req.json();

    // 🔑 PRIORIZAÇÃO DE API KEYS: Cliente específico > Global
    let openAIApiKey = globalOpenAIApiKey;
    let keySource = 'global';

    try {
      // Tentar buscar API Key específica do cliente
      const { data: clientConfig } = await supabase
        .from('client_ai_configs')
        .select('openai_api_key, default_model')
        .eq('client_id', clientId)
        .single();

      if (clientConfig?.openai_api_key) {
        openAIApiKey = clientConfig.openai_api_key;
        keySource = 'client';
        console.log('🔑 [AI-ASSISTANT] Usando API Key específica do cliente');
      } else {
        console.log('🔑 [AI-ASSISTANT] Cliente não tem API Key própria, usando global');
      }
    } catch (error) {
      console.log('🔑 [AI-ASSISTANT] Erro ao buscar config do cliente, usando global:', error.message);
    }

    console.log('🤖 [AI-ASSISTANT] Dados recebidos:', {
      ticketId,
      instanceId,
      assistantName: assistant?.name,
      messageLength: message?.length || 0,
      customerName: context?.customerName,
      keySource,
      hasOpenAIKey: !!openAIApiKey
    });

    // Verificar se OpenAI API key está configurada
    if (!openAIApiKey) {
      console.error('❌ [AI-ASSISTANT] OpenAI API key não configurada');
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured',
          message: keySource === 'client' 
            ? 'Cliente precisa configurar sua API Key da OpenAI'
            : 'Configure OPENAI_API_KEY global nas Edge Function Secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar histórico recente de mensagens do ticket para contexto
    const { data: recentMessages } = await supabase
      .from('ticket_messages')
      .select('content, from_me, sender_name, timestamp')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Construir contexto da conversa
    let conversationContext = '';
    if (recentMessages && recentMessages.length > 0) {
      conversationContext = recentMessages
        .reverse() // Ordenar cronologicamente
        .map(msg => `${msg.from_me ? 'Assistente' : msg.sender_name}: ${msg.content}`)
        .join('\n');
    }

    // Construir prompt do assistente
    const systemPrompt = `${assistant.prompt || 'Você é um assistente útil e prestativo.'}

Contexto da conversa:
Cliente: ${context?.customerName || 'Cliente'}
Telefone: ${context?.phoneNumber || 'N/A'}

Histórico recente da conversa:
${conversationContext}

Instruções importantes:
- Responda de forma natural e humana
- Seja útil e prestativo
- Mantenha o contexto da conversa
- Se não souber algo, seja honesto
- Responda em português brasileiro
- Seja conciso mas completo`;

    console.log('🤖 [AI-ASSISTANT] Chamando OpenAI API com modelo:', assistant.model || 'gpt-4o-mini');

    // Chamar OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: assistant.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AI-ASSISTANT] Erro na OpenAI API:', response.status, response.statusText, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    console.log('✅ [AI-ASSISTANT] Resposta da IA gerada:', {
      responseLength: aiResponse?.length || 0,
      model: assistant.model || 'gpt-4o-mini'
    });

    // Salvar resposta da IA no ticket
    const messageId = `ai_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error: saveError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        message_id: messageId,
        content: aiResponse,
        from_me: true,
        is_ai_response: true,
        sender_name: assistant.name || 'Assistente IA',
        timestamp: new Date().toISOString(),
        processing_status: 'processed'
      });

    if (saveError) {
      console.error('❌ [AI-ASSISTANT] Erro ao salvar resposta:', saveError);
      throw saveError;
    }

    console.log('💾 [AI-ASSISTANT] Resposta salva no ticket');

    // 🤖 BUSCAR CONFIGURAÇÃO HUMANIZADA DO ASSISTENTE
    const humanizedConfig = await getHumanizedConfig(assistant.id);
    
    // 📤 ENVIAR RESPOSTA HUMANIZADA VIA CODECHAT V2.2.1
    const sendResult = await sendHumanizedResponse(instanceId, context?.chatId, aiResponse, humanizedConfig);
    if (sendResult.success) {
      console.log('✅ [AI-ASSISTANT] Resposta humanizada enviada com sucesso');
    } else {
      console.error('❌ [AI-ASSISTANT] Erro ao enviar resposta humanizada:', sendResult.error);
    }

    console.log('✅ [AI-ASSISTANT] Processamento completo');

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        messageId: messageId,
        timestamp: new Date().toISOString(),
        sentViaYumer: sendResult.success
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ [AI-ASSISTANT] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process AI assistant request',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// ===== FUNÇÕES DE HUMANIZAÇÃO =====

// 🎭 Buscar configuração humanizada do assistente
async function getHumanizedConfig(assistantId: string): Promise<HumanizedConfig> {
  try {
    const { data: assistant } = await supabase
      .from('assistants')
      .select('advanced_settings')
      .eq('id', assistantId)
      .single();

    if (assistant?.advanced_settings) {
      const advancedSettings = typeof assistant.advanced_settings === 'string' 
        ? JSON.parse(assistant.advanced_settings) 
        : assistant.advanced_settings;
      
      if (advancedSettings.humanization) {
        console.log('🎭 [HUMANIZED-CONFIG] Configuração customizada encontrada:', advancedSettings.humanization);
        return { ...defaultHumanizedConfig, ...advancedSettings.humanization };
      }
    }

    console.log('🎭 [HUMANIZED-CONFIG] Usando configuração padrão');
    return defaultHumanizedConfig;
  } catch (error) {
    console.error('❌ [HUMANIZED-CONFIG] Erro ao buscar configuração:', error);
    return defaultHumanizedConfig;
  }
}

// 📝 Dividir mensagem em chunks inteligentes
function splitMessage(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let splitIndex = maxChars;
    
    // Procurar quebra natural
    const naturalBreaks = ['. ', ', ', '\n', '; ', '! ', '? '];
    for (const breakChar of naturalBreaks) {
      const lastBreak = remaining.lastIndexOf(breakChar, maxChars);
      if (lastBreak > maxChars * 0.5) {
        splitIndex = lastBreak + breakChar.length;
        break;
      }
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

// ⏱️ Calcular duração de typing baseada no texto
function calculateTypingDuration(text: string, typingSpeed: number, config: HumanizedConfig): number {
  const words = text.split(' ').length;
  const baseTypingTime = (words / typingSpeed) * 60 * 1000;
  
  // Aplicar variação natural (80% a 120% do tempo base)
  const duration = baseTypingTime * (0.8 + Math.random() * 0.4);
  
  return Math.max(
    config.behavior.typing.minDuration,
    Math.min(config.behavior.typing.maxDuration, duration)
  );
}

// 📤 Enviar resposta humanizada via CodeChat v2.2.1
async function sendHumanizedResponse(
  instanceId: string, 
  chatId: string, 
  message: string, 
  config: HumanizedConfig
): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    if (!config.enabled) {
      // Fallback para envio simples se humanização desabilitada
      const result = await sendSimpleMessage(instanceId, chatId, message);
      return { success: result.success, chunks: 1, error: result.error };
    }

    console.log('🤖 [HUMANIZED-SEND] Iniciando envio humanizado:', {
      instanceId,
      chatId,
      messageLength: message.length,
      personality: config.personality.name,
      splitEnabled: config.behavior.messageHandling.splitLongMessages
    });

    // 1. Dividir mensagem em chunks se necessário
    const chunks = config.behavior.messageHandling.splitLongMessages 
      ? splitMessage(message, config.behavior.messageHandling.maxCharsPerChunk)
      : [message];

    console.log(`📝 [HUMANIZED-SEND] Dividido em ${chunks.length} chunks`);

    // 2. Buscar token de autenticação
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select(`
        instance_id,
        client_id,
        clients:client_id (
          business_token
        )
      `)
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.clients?.business_token) {
      console.error('❌ [HUMANIZED-SEND] Business token não encontrado para instância:', instanceId);
      return { success: false, chunks: 0, error: 'Business token not found' };
    }

    const businessToken = instanceData.clients.business_token;

    // 3. Enviar cada chunk com comportamento humanizado
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`📤 [HUMANIZED-SEND] Enviando chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}..."`);

      // 3a. Detectar se é mensagem de áudio
      const isAudioMessage = chunk.toLowerCase().includes('audio:') || chunk.toLowerCase().includes('.ogg') || chunk.toLowerCase().includes('.oga');
      const presenceType: 'composing' | 'recording' = isAudioMessage ? 'recording' : 'composing';

      // 3b. Simular typing/recording se habilitado
      if (config.behavior.typing.enabled && config.behavior.presence.showTyping) {
        const typingDuration = calculateTypingDuration(chunk, config.personality.typingSpeed, config);
        console.log(`⌨️ [HUMANIZED-SEND] Simulando ${presenceType} por ${typingDuration}ms`);
        
        // Aguardar tempo de typing/recording
        await new Promise(resolve => setTimeout(resolve, typingDuration));
      }

      // 3c. Enviar mensagem via CodeChat v2.2.1 com presença integrada
      const chunkResult = await sendCodeChatMessage(instanceId, chatId, chunk, businessToken, 'available');
      
      if (!chunkResult.success) {
        console.error(`❌ [HUMANIZED-SEND] Erro no chunk ${i + 1}:`, chunkResult.error);
        return { success: false, chunks: i, error: chunkResult.error };
      }

      // 3c. Delay entre chunks (exceto no último)
      if (i < chunks.length - 1) {
        const chunkDelay = config.behavior.messageHandling.delayBetweenChunks + 
          (Math.random() - 0.5) * 1000; // ±500ms de variação
        console.log(`⏱️ [HUMANIZED-SEND] Aguardando ${chunkDelay}ms antes do próximo chunk`);
        await new Promise(resolve => setTimeout(resolve, chunkDelay));
      }
    }

    // 4. Não precisamos mais definir presença separadamente - integrada na mensagem

    console.log(`✅ [HUMANIZED-SEND] Todos os ${chunks.length} chunks enviados com sucesso`);
    return { success: true, chunks: chunks.length };

  } catch (error) {
    console.error('❌ [HUMANIZED-SEND] Erro no envio humanizado:', error);
    return { 
      success: false, 
      chunks: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// 📤 Enviar mensagem via CodeChat v2.2.1 com presença integrada
async function sendCodeChatMessage(
  instanceId: string, 
  chatId: string, 
  message: string, 
  businessToken: string,
  presence: 'available' | 'composing' | 'recording' = 'available'
): Promise<{ success: boolean; error?: string }> {
  try {
    const codeChatData = {
      recipient: chatId,
      textMessage: {
        text: message
      },
      options: {
        delay: 0, // Controlamos o delay manualmente
        presence: presence // Integrar presença diretamente na mensagem
      }
    };

    console.log('📋 [CODECHAT-SEND] Dados para CodeChat v2.2.1:', codeChatData);

    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(codeChatData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CODECHAT-SEND] Erro ao enviar via CodeChat v2.2.1:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        instanceId,
        url: `https://api.yumer.com.br/api/v2/instance/${instanceId}/send/text`
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('✅ [CODECHAT-SEND] Mensagem enviada com sucesso via CodeChat v2.2.1:', {
      messageId: result.messageId,
      chatId: chatId,
      presence: presence
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [CODECHAT-SEND] Erro ao enviar via CodeChat v2.2.1:', error);
    return { success: false, error: error.message };
  }
}

// 👤 Função de presença removida - agora integrada nas options da mensagem
// A presença agora é controlada via options.presence em cada mensagem enviada

// 📤 Envio simples (fallback)
async function sendSimpleMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📤 [SIMPLE-SEND] Enviando mensagem simples:', {
      instanceId,
      chatId,
      messageLength: message.length
    });

    // Buscar business_token da instância via cliente
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select(`
        instance_id,
        client_id,
        clients:client_id (
          business_token
        )
      `)
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.clients?.business_token) {
      console.error('❌ [SIMPLE-SEND] Business token não encontrado para instância:', instanceId);
      return { success: false, error: 'Business token not found' };
    }

    const businessToken = instanceData.clients.business_token;

    return await sendCodeChatMessage(instanceId, chatId, message, businessToken);

  } catch (error) {
    console.error('❌ [SIMPLE-SEND] Erro no envio simples:', error);
    return { success: false, error: error.message };
  }
}
