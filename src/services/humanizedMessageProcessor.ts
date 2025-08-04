import { supabase } from '@/integrations/supabase/client';
import { realTimeWhatsAppService, type RealTimeMessage } from './realTimeWhatsAppService';
import { aiQueueIntegrationService } from './aiQueueIntegrationService';

export class HumanizedMessageProcessor {
  private static instance: HumanizedMessageProcessor;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): HumanizedMessageProcessor {
    if (!HumanizedMessageProcessor.instance) {
      HumanizedMessageProcessor.instance = new HumanizedMessageProcessor();
    }
    return HumanizedMessageProcessor.instance;
  }

  // Inicializar processador para um cliente
  async initialize(clientId: string): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Inicializando processador humanizado para cliente:', clientId);

    try {
      // Configurar listener para mensagens em tempo real
      this.setupRealtimeListeners(clientId);
      
      // Sincronizar instâncias existentes
      await this.syncExistingInstances(clientId);
      
      this.isInitialized = true;
      console.log('✅ Processador humanizado inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar processador:', error);
    }
  }

  // Configurar listeners em tempo real
  private setupRealtimeListeners(clientId: string): void {
    // Listener para novas mensagens COM DEBOUNCING
    supabase
      .channel('whatsapp_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `from_me=eq.false` // Apenas mensagens dos clientes
        },
        async (payload) => {
          // DEBOUNCING: Aguardar 500ms para permitir que mensagens rápidas sejam agrupadas
          setTimeout(async () => {
            await this.handleNewMessage(payload.new as any, clientId);
          }, 500);
        }
      )
      .subscribe();

    console.log('👂 Listeners de tempo real configurados com debouncing de 500ms');
  }

  // Processar nova mensagem
  private async handleNewMessage(messageData: any, clientId: string): Promise<void> {
    try {
      // Verificar se a mensagem pertence ao cliente
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('client_id')
        .eq('instance_id', messageData.instance_id)
        .single();

      if (instance?.client_id !== clientId) {
        return; // Mensagem não é deste cliente
      }

      console.log('📨 Nova mensagem recebida:', {
        chatId: messageData.chat_id,
        content: messageData.content?.substring(0, 50) + '...'
      });

      // Cancelar processamento anterior se existir
      realTimeWhatsAppService.cancelProcessing(messageData.chat_id);

      // Criar objeto de mensagem
      const message: RealTimeMessage = {
        id: messageData.message_id,
        chatId: messageData.chat_id,
        instanceId: messageData.instance_id,
        content: messageData.content || '',
        messageType: messageData.message_type || 'text',
        fromMe: messageData.from_me,
        timestamp: new Date(messageData.timestamp),
        mediaUrl: messageData.media_url,
        mimeType: messageData.mime_type
      };

      // NOVO: Verificar se mensagem já foi processada ANTES de adicionar ao batch
      if (!messageData.from_me && !messageData.is_processed) {
        console.log('📋 [HUMANIZED] Verificando se mensagem precisa ser processada:', {
          messageId: messageData.message_id,
          isProcessed: messageData.is_processed,
          fromMe: messageData.from_me,
          chatId: messageData.chat_id
        });
        
        // VERIFICAÇÃO CRUCIAL: Usar chat_id corretamente para lock
        const { messageProcessingController } = await import('./messageProcessingController');
        
        // PRIORITÁRIO: Verificar se o CHAT_ID está bloqueado (não ticket_id)
        if (messageProcessingController.isChatLocked(messageData.chat_id)) {
          console.log('🔒 [HUMANIZED] CHAT com lock ativo - IGNORANDO mensagem:', {
            chatId: messageData.chat_id,
            messageId: messageData.message_id
          });
          return;
        }
        
        if (messageProcessingController.isMessageProcessed(messageData.message_id)) {
          console.log('✅ [HUMANIZED] Mensagem já processada pelo controlador - IGNORANDO:', messageData.message_id);
          return;
        }
        
        // Buscar o ticket real para usar o ID correto
        const { data: ticket } = await supabase
          .from('conversation_tickets')
          .select('id')
          .eq('chat_id', messageData.chat_id)
          .eq('instance_id', messageData.instance_id)
          .single();
        
        if (ticket) {
          console.log('🎯 [HUMANIZED] Adicionando mensagem ao BATCH usando CHAT_ID:', {
            ticketId: ticket.id,
            chatId: messageData.chat_id,
            messageId: messageData.message_id
          });
          
          // CORREÇÃO CRUCIAL: Usar chat_id real para agrupamento, não ticket.id
          aiQueueIntegrationService.addMessageToBatch(
            messageData.chat_id, // USAR CHAT_ID para agrupamento correto
            messageData.content || '',
            clientId,
            messageData.instance_id,
            messageData.message_id,
            new Date(messageData.timestamp).getTime(),
            ticket.id // passar ticket_id separadamente
          );
          
          console.log('📦 [HUMANIZED] ✅ Mensagem adicionada ao BATCH por CHAT_ID - aguardando mais mensagens (timeout: 6s)');
        } else {
          console.log('❌ [HUMANIZED] Ticket não encontrado para chat:', messageData.chat_id);
        }
      } else if (messageData.from_me) {
        console.log('📤 [HUMANIZED] Mensagem nossa ignorada (from_me=true)');
      } else if (messageData.is_processed) {
        console.log('✅ [HUMANIZED] Mensagem já processada ignorada (is_processed=true)');
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }

  // Sincronizar instâncias existentes
  private async syncExistingInstances(clientId: string): Promise<void> {
    try {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      console.log(`📱 Sincronizando ${instances?.length || 0} instâncias conectadas`);

      // Para cada instância conectada, verificar se há processamento ativo
      for (const instance of instances || []) {
        await this.checkActiveChats(instance.instance_id);
      }

    } catch (error) {
      console.error('❌ Erro ao sincronizar instâncias:', error);
    }
  }

  // Verificar chats ativos
  private async checkActiveChats(instanceId: string): Promise<void> {
    try {
      // Buscar tickets abertos para esta instância
      const { data: activeTickets } = await supabase
        .from('conversation_tickets')
        .select('chat_id, last_message_at')
        .eq('instance_id', instanceId)
        .in('status', ['open', 'pending'])
        .gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Últimas 24h

      console.log(`💬 ${activeTickets?.length || 0} chats ativos encontrados para instância ${instanceId}`);

    } catch (error) {
      console.error('❌ Erro ao verificar chats ativos:', error);
    }
  }

  // Parar processamento
  stop(): void {
    console.log('⏹️ Parando processador humanizado');
    this.isInitialized = false;
    
    // Cancelar todos os processamentos ativos
    // realTimeWhatsAppService poderia ter um método para isso
  }

  // Status do processador
  getStatus(): { isInitialized: boolean; timestamp: Date } {
    return {
      isInitialized: this.isInitialized,
      timestamp: new Date()
    };
  }
}

// Export singleton
export const humanizedMessageProcessor = HumanizedMessageProcessor.getInstance();