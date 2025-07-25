import { supabase } from '@/integrations/supabase/client';
import unifiedYumerService from './unifiedYumerService';

export interface RealTimeMessage {
  id: string;
  chatId: string;
  instanceId: string;
  content: string;
  messageType: 'text' | 'audio' | 'image' | 'document' | 'video';
  fromMe: boolean;
  timestamp: Date;
  mediaUrl?: string;
  mimeType?: string;
}

export interface ProcessingResult {
  ticketId: string;
  queueId?: string;
  assistantId?: string;
  shouldProcess: boolean;
  transferQueue?: string;
}

class RealTimeWhatsAppService {
  private processingQueue: Map<string, RealTimeMessage[]> = new Map();
  private processingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Processar mensagem em tempo real
  async processIncomingMessage(message: RealTimeMessage): Promise<ProcessingResult> {
    console.log('🔄 Processando mensagem em tempo real:', message);
    
    try {
      // 1. Criar/atualizar ticket
      const ticketResult = await this.createOrUpdateTicket(message);
      
      // 2. Verificar se deve processar automaticamente
      const shouldProcess = await this.shouldProcessMessage(ticketResult.ticketId);
      
      if (!shouldProcess) {
        console.log('⏸️ Mensagem não será processada automaticamente (atendimento humano)');
        return { ...ticketResult, shouldProcess: false };
      }
      
      // 3. Detectar gatilhos de transferência
      const transferQueue = this.detectTransferTriggers(message.content);
      if (transferQueue) {
        console.log('🔄 Gatilho de transferência detectado:', transferQueue);
        await this.transferTicketToQueue(ticketResult.ticketId, transferQueue);
        return { ...ticketResult, shouldProcess: false, transferQueue };
      }
      
      // 4. Adicionar à fila de processamento com delay
      this.addToProcessingQueue(message);
      
      return { ...ticketResult, shouldProcess: true };
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      throw error;
    }
  }
  
  // Criar ou atualizar ticket
  private async createOrUpdateTicket(message: RealTimeMessage): Promise<{
    ticketId: string;
    queueId?: string;
    assistantId?: string;
  }> {
    try {
      // Buscar instância e fila conectada
      const { data: connections, error: connError } = await supabase
        .from('instance_queue_connections')
        .select(`
          queue_id,
          queues!inner (
            id,
            name,
            client_id
          )
        `)
        .eq('instance_id', message.instanceId)
        .eq('is_active', true)
        .single();
      
      if (connError || !connections) {
        console.log('⚠️ Nenhuma fila conectada à instância:', message.instanceId);
        return { ticketId: '' };
      }
      
      // Buscar assistente da fila  
      const assistants = null; // Simplificado por enquanto
      
      // Extrair número do chat_id (remover @s.whatsapp.net)
      const customerPhone = message.chatId.replace('@s.whatsapp.net', '');
      
      // Buscar ou criar cliente
      let { data: customer } = await supabase
        .from('customers')
        .select('id, name')
        .eq('phone', customerPhone)
        .eq('client_id', connections.queues.client_id)
        .single();
      
      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            client_id: connections.queues.client_id,
            phone: customerPhone,
            name: `Cliente ${customerPhone.slice(-4)}`,
            whatsapp_chat_id: message.chatId
          })
          .select()
          .single();
        customer = newCustomer;
      }
      
      // Buscar ou criar ticket
      let { data: ticket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('chat_id', message.chatId)
        .eq('instance_id', message.instanceId)
        .eq('client_id', connections.queues.client_id)
        .single();
      
      if (!ticket) {
        const { data: newTicket } = await supabase
          .from('conversation_tickets')
          .insert({
            client_id: connections.queues.client_id,
            customer_id: customer?.id,
            chat_id: message.chatId,
            instance_id: message.instanceId,
            title: `Conversa com ${customer?.name || customerPhone}`,
            assigned_queue_id: connections.queue_id,
            status: 'open',
            last_message_preview: message.content.substring(0, 100),
            last_message_at: message.timestamp.toISOString()
          })
          .select()
          .single();
        ticket = newTicket;
      } else {
        // Atualizar ticket existente
        await supabase
          .from('conversation_tickets')
          .update({
            last_message_preview: message.content.substring(0, 100),
            last_message_at: message.timestamp.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', ticket.id);
      }
      
      // Salvar mensagem
      await supabase
        .from('whatsapp_messages')
        .insert({
          instance_id: message.instanceId,
          chat_id: message.chatId,
          message_id: message.id,
          content: message.content,
          message_type: message.messageType,
          from_me: message.fromMe,
          timestamp: message.timestamp.toISOString(),
          media_url: message.mediaUrl,
          mime_type: message.mimeType,
          ticket_id: ticket?.id
        });
      
      return {
        ticketId: ticket?.id || '',
        queueId: connections.queue_id,
        assistantId: undefined // Simplificado
      };
    } catch (error) {
      console.error('❌ Erro ao criar/atualizar ticket:', error);
      throw error;
    }
  }
  
  // Verificar se deve processar automaticamente
  private async shouldProcessMessage(ticketId: string): Promise<boolean> {
    try {
      const { data: ticket } = await supabase
        .from('conversation_tickets')
        .select('status, assigned_queue_id')
        .eq('id', ticketId)
        .single();
      
      if (!ticket) return false;
      
      // Não processar se ticket está sendo atendido por humano
      if (ticket.status === 'in_progress') {
        return false;
      }
      
      // Simplificado por enquanto
      const assistants = [];
      
      // Não processar se fila não tem assistente
      if (!assistants || assistants.length === 0) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao verificar processamento:', error);
      return false;
    }
  }
  
  // Detectar gatilhos de transferência
  private detectTransferTriggers(content: string): string | null {
    const lowercaseContent = content.toLowerCase();
    
    // Gatilhos para diferentes filas
    const triggers = [
      { keywords: ['quero financeiro', 'setor financeiro', 'cobrança'], queue: 'financeiro' },
      { keywords: ['quero suporte', 'problema técnico', 'não funciona'], queue: 'suporte' },
      { keywords: ['quero comercial', 'quero comprar', 'vendas'], queue: 'comercial' },
      { keywords: ['falar com humano', 'atendente humano', 'pessoa real'], queue: 'humano' },
      { keywords: ['supervisor', 'gerente', 'responsável'], queue: 'supervisao' }
    ];
    
    for (const trigger of triggers) {
      for (const keyword of trigger.keywords) {
        if (lowercaseContent.includes(keyword)) {
          console.log('🎯 Gatilho detectado:', keyword, '→', trigger.queue);
          return trigger.queue;
        }
      }
    }
    
    return null;
  }
  
  // Transferir ticket para fila
  private async transferTicketToQueue(ticketId: string, queueSlug: string): Promise<void> {
    try {
      // Buscar fila de destino
      const targetQueue = null; // Simplificado por enquanto
      
      if (targetQueue) {
        await supabase
          .from('conversation_tickets')
          .update({
            assigned_queue_id: targetQueue.id,
            status: queueSlug === 'humano' ? 'pending' : 'open',
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId);
        
        console.log('✅ Ticket transferido para fila:', targetQueue.name);
      }
    } catch (error) {
      console.error('❌ Erro ao transferir ticket:', error);
    }
  }
  
  // Adicionar à fila de processamento com delay
  private addToProcessingQueue(message: RealTimeMessage): void {
    const chatId = message.chatId;
    
    // Limpar timeout anterior se existir
    if (this.processingTimeouts.has(chatId)) {
      clearTimeout(this.processingTimeouts.get(chatId)!);
    }
    
    // Adicionar mensagem à fila
    if (!this.processingQueue.has(chatId)) {
      this.processingQueue.set(chatId, []);
    }
    this.processingQueue.get(chatId)!.push(message);
    
    // Configurar delay de 3 segundos
    const timeout = setTimeout(() => {
      this.processQueuedMessages(chatId);
    }, 3000);
    
    this.processingTimeouts.set(chatId, timeout);
  }
  
  // Processar mensagens em fila (após delay)
  private async processQueuedMessages(chatId: string): Promise<void> {
    const messages = this.processingQueue.get(chatId) || [];
    if (messages.length === 0) return;
    
    try {
      console.log(`🔄 Processando ${messages.length} mensagens em fila para ${chatId}`);
      
      // Agrupar conteúdo das mensagens
      const combinedContent = messages
        .filter(m => !m.fromMe)
        .map(m => m.content)
        .join('\n');
      
      if (combinedContent.trim()) {
        // Processar com IA
        await this.processWithAI(chatId, messages[0].instanceId, combinedContent, messages);
      }
      
      // Limpar fila
      this.processingQueue.delete(chatId);
      this.processingTimeouts.delete(chatId);
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagens em fila:', error);
    }
  }
  
  // Processar com IA
  private async processWithAI(
    chatId: string, 
    instanceId: string, 
    content: string, 
    messages: RealTimeMessage[]
  ): Promise<void> {
    try {
      console.log('🤖 Iniciando processamento com IA para:', chatId);
      
      // Simular comportamento humano (online + typing)
      await this.simulateHumanBehavior(instanceId, chatId, 'online');
      await this.simulateHumanBehavior(instanceId, chatId, 'typing');
      
      // Chamar edge function para processar com IA
      const { data: response, error } = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          instanceId,
          chatId,
          content,
          messages: messages.map(m => ({
            id: m.id,
            content: m.content,
            fromMe: m.fromMe,
            timestamp: m.timestamp
          }))
        }
      });
      
      if (error) {
        console.error('❌ Erro na edge function:', error);
        return;
      }
      
      // Enviar resposta humanizada
      if (response?.response) {
        await this.sendHumanizedResponse(instanceId, chatId, response.response);
      }
      
    } catch (error) {
      console.error('❌ Erro no processamento IA:', error);
    } finally {
      // Parar simulação de typing
      await this.simulateHumanBehavior(instanceId, chatId, 'stop_typing');
    }
  }
  
  // Simular comportamento humano
  private async simulateHumanBehavior(
    instanceId: string, 
    chatId: string, 
    action: 'online' | 'typing' | 'stop_typing' | 'recording'
  ): Promise<void> {
    try {
      switch (action) {
        case 'online':
          console.log('📱 Simulando status online para:', chatId);
          break;
        case 'typing':
          console.log('⌨️ Simulando digitação para:', chatId);
          break;
        case 'stop_typing':
          console.log('⏹️ Parando digitação para:', chatId);
          break;
        case 'recording':
          console.log('🎙️ Simulando gravação para:', chatId);
          break;
      }
    } catch (error) {
      console.error(`❌ Erro ao simular ${action}:`, error);
    }
  }
  
  // Enviar resposta humanizada
  private async sendHumanizedResponse(
    instanceId: string, 
    chatId: string, 
    response: string
  ): Promise<void> {
    try {
      // Dividir resposta em blocos
      const blocks = this.splitMessageIntoBlocks(response, 350);
      
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        
        // Simular typing baseado no tamanho do bloco
        const typingDuration = Math.min(Math.max(block.length * 50, 1000), 5000);
        await this.simulateHumanBehavior(instanceId, chatId, 'typing');
        await this.delay(typingDuration);
        
        // Enviar bloco
        await unifiedYumerService.sendMessage(instanceId, chatId, block);
        
        // Parar typing
        await this.simulateHumanBehavior(instanceId, chatId, 'stop_typing');
        
        // Pausa entre blocos (exceto no último)
        if (i < blocks.length - 1) {
          await this.delay(Math.random() * 2000 + 1000); // 1-3s
        }
      }
      
      console.log('✓ Mensagens enviadas para:', chatId);
      
    } catch (error) {
      console.error('❌ Erro ao enviar resposta humanizada:', error);
    }
  }
  
  // Dividir mensagem em blocos
  private splitMessageIntoBlocks(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message];
    }
    
    const blocks: string[] = [];
    let currentBlock = '';
    const sentences = message.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      const sentenceWithPunctuation = trimmedSentence + '.';
      
      if ((currentBlock + sentenceWithPunctuation).length <= maxLength) {
        currentBlock += (currentBlock ? ' ' : '') + sentenceWithPunctuation;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = sentenceWithPunctuation;
        } else {
          // Sentença muito longa, dividir por palavras
          const words = sentenceWithPunctuation.split(' ');
          let wordBlock = '';
          for (const word of words) {
            if ((wordBlock + word).length <= maxLength) {
              wordBlock += (wordBlock ? ' ' : '') + word;
            } else {
              if (wordBlock) blocks.push(wordBlock);
              wordBlock = word;
            }
          }
          if (wordBlock) currentBlock = wordBlock;
        }
      }
    }
    
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    return blocks;
  }
  
  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Cancelar processamento se cliente digitar novamente
  cancelProcessing(chatId: string): void {
    if (this.processingTimeouts.has(chatId)) {
      clearTimeout(this.processingTimeouts.get(chatId)!);
      this.processingTimeouts.delete(chatId);
      console.log('⏸️ Processamento cancelado para:', chatId);
    }
  }
}

export const realTimeWhatsAppService = new RealTimeWhatsAppService();