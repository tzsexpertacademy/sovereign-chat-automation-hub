import { supabase } from '@/integrations/supabase/client';
import { allProcessController } from './allProcessController';

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
    if (this.isInitialized) {
      console.log('🔄 [HUMANIZED-PROCESSOR] Processador já inicializado, ignorando...');
      return;
    }

    console.log('🚀 [HUMANIZED-PROCESSOR] ===============================');
    console.log('🚀 [HUMANIZED-PROCESSOR] INICIALIZANDO PROCESSADOR HUMANIZADO');
    console.log('🚀 [HUMANIZED-PROCESSOR] Cliente:', clientId);
    console.log('🚀 [HUMANIZED-PROCESSOR] Timestamp:', new Date().toISOString());
    console.log('🚀 [HUMANIZED-PROCESSOR] ===============================');

    try {
      // Configurar listener para mensagens em tempo real
      console.log('👂 [HUMANIZED-PROCESSOR] Configurando listeners de tempo real...');
      this.setupRealtimeListeners(clientId);
      
      // Sincronizar instâncias existentes
      console.log('📱 [HUMANIZED-PROCESSOR] Sincronizando instâncias existentes...');
      await this.syncExistingInstances(clientId);
      
      this.isInitialized = true;
      
      console.log('✅ [HUMANIZED-PROCESSOR] ===============================');
      console.log('✅ [HUMANIZED-PROCESSOR] PROCESSADOR INICIALIZADO COM SUCESSO!');
      console.log('✅ [HUMANIZED-PROCESSOR] Agora processando mensagens automaticamente');
      console.log('✅ [HUMANIZED-PROCESSOR] ===============================');
      
    } catch (error) {
      console.error('❌ [HUMANIZED-PROCESSOR] ===============================');
      console.error('❌ [HUMANIZED-PROCESSOR] ERRO CRÍTICO NA INICIALIZAÇÃO:', error);
      console.error('❌ [HUMANIZED-PROCESSOR] ===============================');
      throw error;
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
          // DEBOUNCE OTIMIZADO: Aguardar 200ms para permitir que mensagens rápidas sejam agrupadas
          setTimeout(async () => {
            await this.handleNewMessage(payload.new as any, clientId);
          }, 200);
        }
      )
      .subscribe();

    console.log('👂 Listeners de tempo real configurados com debouncing de 200ms');
  }

  // Processar nova mensagem
  private async handleNewMessage(messageData: any, clientId: string): Promise<void> {
    try {
      console.log('📨 [HUMANIZED-PROCESSOR] ENTRADA - Nova mensagem recebida:', {
        messageId: messageData.message_id,
        chatId: messageData.chat_id,
        instanceId: messageData.instance_id,
        type: messageData.message_type || 'text',
        fromMe: messageData.from_me,
        clientIdEsperado: clientId
      });

      // Verificar se a mensagem pertence ao cliente
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('client_id, instance_id')
        .eq('instance_id', messageData.instance_id)
        .single();

      console.log('🔍 [HUMANIZED-PROCESSOR] Verificação de instância:', {
        instanceEncontrada: !!instance,
        clientIdInstancia: instance?.client_id,
        clientIdEsperado: clientId,
        pertenceAoCliente: instance?.client_id === clientId
      });

      if (instance?.client_id !== clientId) {
        console.log('❌ [HUMANIZED-PROCESSOR] Mensagem ignorada - não pertence ao cliente');
        return; // Mensagem não é deste cliente
      }

      if (messageData.from_me) {
        console.log('📤 [HUMANIZED-PROCESSOR] Mensagem nossa ignorada (from_me=true)');
        return;
      }

      console.log('🎯 [HUMANIZED-PROCESSOR] Direcionando para controlador central...');
      
      // Usar o controlador central
      await allProcessController.processMessage(messageData, clientId);

      console.log('✅ [HUMANIZED-PROCESSOR] Mensagem processada pelo controlador central:', messageData.message_id);

    } catch (error) {
      console.error('❌ [HUMANIZED-PROCESSOR] Erro crítico ao processar mensagem:', error);
      console.error('❌ [HUMANIZED-PROCESSOR] Dados da mensagem:', messageData);
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