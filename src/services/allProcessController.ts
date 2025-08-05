/**
 * Controlador central que coordena TODOS os processamentos
 * Baseado na arquitetura que funcionava anteriormente
 */

import { supabase } from '@/integrations/supabase/client';
import { messageProcessingController } from './messageProcessingController';

class AllProcessController {
  private static instance: AllProcessController;
  private chatLocks = new Map<string, { timeout: NodeJS.Timeout | null; processing: boolean }>();
  private responsesCache = new Map<string, { response: string; timestamp: number }>();

  static getInstance(): AllProcessController {
    if (!AllProcessController.instance) {
      AllProcessController.instance = new AllProcessController();
    }
    return AllProcessController.instance;
  }

  /**
   * Processamento inteligente - decide entre batch ou imediato
   */
  async processMessage(messageData: any, clientId: string): Promise<void> {
    const chatId = messageData.key?.remoteJid || messageData.remoteJid;
    
    if (!chatId || !clientId) {
      console.log('❌ [ALL-PROCESS] Chat ID ou Client ID ausente');
      return;
    }

    // Lock global por chat
    if (this.isChatLocked(chatId)) {
      console.log('🔒 [ALL-PROCESS] Chat bloqueado, aguardando processamento:', chatId);
      return;
    }

    this.lockChat(chatId);
    
    try {
      await this.handleIntelligentProcessing(messageData, clientId, chatId);
    } finally {
      this.unlockChat(chatId);
    }
  }

  /**
   * Processamento inteligente baseado no tipo de mensagem
   */
  private async handleIntelligentProcessing(messageData: any, clientId: string, chatId: string): Promise<void> {
    const messageType = this.getMessageType(messageData);
    console.log('🎯 [ALL-PROCESS] Tipo detectado:', messageType, 'para chat:', chatId);

    // Verifica se já tem batch ativo para este chat
    const existingBatch = await this.getActiveBatch(chatId, clientId);
    
    if (existingBatch) {
      // Adiciona à batch existente
      await this.addToBatch(existingBatch.id, messageData);
      this.resetBatchTimeout(chatId, clientId, existingBatch.id);
    } else {
      // Cria nova batch
      const batchId = await this.createNewBatch(chatId, clientId, messageData);
      this.setBatchTimeout(chatId, clientId, batchId, messageType);
    }
  }

  /**
   * Identifica o tipo de mensagem para timeout inteligente
   */
  private getMessageType(messageData: any): 'text' | 'audio' | 'image' | 'video' | 'document' | 'mixed' {
    const message = messageData.message || messageData;
    
    if (message.audioMessage) return 'audio';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.documentMessage) return 'document';
    return 'text';
  }

  /**
   * Define timeout inteligente baseado no tipo
   */
  private getTimeoutForType(type: string): number {
    const timeouts = {
      text: 3000,      // 3s para texto
      audio: 10000,    // 10s para áudio
      image: 8000,     // 8s para imagem
      video: 12000,    // 12s para vídeo
      document: 6000,  // 6s para documento
      mixed: 12000     // 12s para conteúdo misto
    };
    
    return timeouts[type] || 3000;
  }

  /**
   * Busca batch ativo para o chat
   */
  private async getActiveBatch(chatId: string, clientId: string) {
    const { data } = await supabase
      .from('message_batches')
      .select('*')
      .eq('chat_id', chatId)
      .eq('client_id', clientId)
      .is('processing_started_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  /**
   * Cria nova batch
   */
  private async createNewBatch(chatId: string, clientId: string, messageData: any): Promise<string> {
    try {
      console.log('🔧 [ALL-PROCESS] Criando batch para:', { chatId, clientId, messageId: messageData.message_id });
      
      const { data, error } = await supabase
        .from('message_batches')
        .insert({
          chat_id: chatId,
          client_id: clientId,
          instance_id: messageData.instance_id || messageData.instanceId || 'unknown',
          messages: [messageData]
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ [ALL-PROCESS] Erro ao criar batch:', error);
        console.error('❌ [ALL-PROCESS] Dados enviados:', { 
          chat_id: chatId, 
          client_id: clientId, 
          instance_id: messageData.instance_id || messageData.instanceId || 'unknown',
          messages: [messageData]
        });
        throw error;
      }

      console.log('📦 [ALL-PROCESS] Nova batch criada com sucesso:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ [ALL-PROCESS] Falha total ao criar batch:', error);
      throw error;
    }
  }

  /**
   * Adiciona mensagem à batch existente
   */
  private async addToBatch(batchId: string, messageData: any): Promise<void> {
    const { data: batch } = await supabase
      .from('message_batches')
      .select('messages')
      .eq('id', batchId)
      .single();

    if (batch) {
      const currentMessages = Array.isArray(batch.messages) ? batch.messages : [];
      const updatedMessages = [...currentMessages, messageData];
      
      await supabase
        .from('message_batches')
        .update({ 
          messages: updatedMessages,
          last_updated: new Date().toISOString()
        })
        .eq('id', batchId);

      console.log('➕ [ALL-PROCESS] Mensagem adicionada à batch:', batchId);
    }
  }

  /**
   * Define timeout para processar batch
   */
  private setBatchTimeout(chatId: string, clientId: string, batchId: string, messageType: string): void {
    const timeout = this.getTimeoutForType(messageType);
    
    if (this.chatLocks.has(chatId)) {
      clearTimeout(this.chatLocks.get(chatId)!.timeout!);
    }

    const timeoutId = setTimeout(async () => {
      await this.processBatch(batchId, chatId, clientId);
    }, timeout);

    this.chatLocks.set(chatId, { timeout: timeoutId, processing: false });
    
    console.log(`⏰ [ALL-PROCESS] Timeout ${timeout}ms definido para ${messageType} - batch:`, batchId);
  }

  /**
   * Reseta timeout quando nova mensagem chega
   */
  private resetBatchTimeout(chatId: string, clientId: string, batchId: string): void {
    const lock = this.chatLocks.get(chatId);
    if (lock?.timeout) {
      clearTimeout(lock.timeout);
      
      // Detecta tipo da batch atual para timeout apropriado
      const newTimeout = setTimeout(async () => {
        await this.processBatch(batchId, chatId, clientId);
      }, 12000); // 12s para conteúdo misto

      this.chatLocks.set(chatId, { timeout: newTimeout, processing: false });
      console.log('🔄 [ALL-PROCESS] Timeout resetado para batch:', batchId);
    }
  }

  /**
   * Processa a batch via edge function
   */
  private async processBatch(batchId: string, chatId: string, clientId: string): Promise<void> {
    try {
      // Marca batch como em processamento
      await supabase
        .from('message_batches')
        .update({ processing_started_at: new Date().toISOString() })
        .eq('id', batchId);

      // Chama edge function para processar
      const { data, error } = await supabase.functions.invoke('process-message-batches', {
        body: { chatId, trigger: 'timeout' }
      });

      if (error) {
        console.error('❌ [ALL-PROCESS] Erro ao processar batch:', error);
      } else {
        console.log('✅ [ALL-PROCESS] Batch processada com sucesso:', batchId);
      }

      // Remove lock após processamento
      this.chatLocks.delete(chatId);

    } catch (error) {
      console.error('❌ [ALL-PROCESS] Erro no processamento:', error);
      this.chatLocks.delete(chatId);
    }
  }

  /**
   * Controle de locks
   */
  private isChatLocked(chatId: string): boolean {
    const lock = this.chatLocks.get(chatId);
    return lock?.processing === true;
  }

  private lockChat(chatId: string): void {
    const existing = this.chatLocks.get(chatId);
    this.chatLocks.set(chatId, { 
      timeout: existing?.timeout || null, 
      processing: true 
    });
  }

  private unlockChat(chatId: string): void {
    const existing = this.chatLocks.get(chatId);
    if (existing) {
      this.chatLocks.set(chatId, { 
        timeout: existing.timeout, 
        processing: false 
      });
    }
  }

  /**
   * Status e limpeza
   */
  getStatus() {
    return {
      activeLocks: this.chatLocks.size,
      processingChats: Array.from(this.chatLocks.entries())
        .filter(([_, lock]) => lock.processing)
        .map(([chatId]) => chatId)
    };
  }

  cleanup(): void {
    this.chatLocks.forEach(lock => {
      if (lock.timeout) clearTimeout(lock.timeout);
    });
    this.chatLocks.clear();
    this.responsesCache.clear();
  }
}

export const allProcessController = AllProcessController.getInstance();