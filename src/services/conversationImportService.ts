/**
 * ETAPA 2: SINCRONIZAÇÃO REAL DE CONVERSAS
 * Implementa importação real usando API CodeChat v2.2.1
 */

import { supabase } from '@/integrations/supabase/client';
import yumerApiV2 from './yumerApiV2Service';

export interface ImportProgress {
  current: number;
  total: number;
  message: string;
  totalChats?: number;
  processedChats?: number;
  totalMessages?: number;
  processedMessages?: number;
  status?: 'idle' | 'importing_chats' | 'importing_messages' | 'completed' | 'error';
  currentChat?: string;
  error?: string;
}

export class ConversationImportService {
  private progressCallback?: (progress: ImportProgress) => void;

  setProgressCallback(callback: (progress: ImportProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * MÉTODO PRINCIPAL: Sincronizar conversas reais da API v2.2.1
   */
  async syncRealConversations(clientId: string, instanceId: string): Promise<{ success: boolean; imported: number; error?: string }> {
    console.log('🚀 [IMPORT] Iniciando importação real de conversas para:', instanceId);
    
    try {
      // 1. Buscar business_id da instância
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .eq('client_id', clientId)
        .single();

      if (!instanceData?.business_business_id) {
        throw new Error('Business ID não encontrado para a instância');
      }

      const businessId = instanceData.business_business_id;

      // 2. Buscar chats reais extraindo das mensagens (API v2.2.1 corrigida)
      this.updateProgress({ 
        totalChats: 0, 
        processedChats: 0, 
        totalMessages: 0, 
        processedMessages: 0, 
        status: 'importing_chats',
        message: 'Conectando ao WhatsApp e buscando conversas...'
      });

      const chatsData = await yumerApiV2.extractChatsFromMessages(instanceId);
      const chats = Array.isArray(chatsData) ? chatsData : [chatsData];
      console.log(`📂 [IMPORT] Encontrados ${chats.length} chats extraídos das mensagens`);

      let importedConversations = 0;
      let totalMessages = 0;

      this.updateProgress({ 
        totalChats: chats.length, 
        processedChats: 0, 
        totalMessages: 0, 
        processedMessages: 0, 
        status: 'importing_chats',
        message: `Encontradas ${chats.length} conversas para importar`
      });

      // 3. Processar cada chat
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        
        this.updateProgress({ 
          totalChats: chats.length, 
          processedChats: i, 
          totalMessages: totalMessages, 
          processedMessages: 0, 
          status: 'importing_messages',
          currentChat: chat.name || chat.remoteJid,
          message: `Importando conversa ${i + 1}/${chats.length}: ${(chat.name || chat.remoteJid).substring(0, 25)}...`
        });

        try {
          // 4. Buscar mensagens reais do chat
          const messagesData = await yumerApiV2.findMessages(instanceId, chat.remoteJid, 50);
          const messages = Array.isArray(messagesData) ? messagesData : [messagesData];
          console.log(`💬 [IMPORT] Chat ${chat.remoteJid}: ${messages.length} mensagens`);

          // 5. Criar/atualizar ticket no Supabase
          const ticketResult = await this.createOrUpdateTicket(clientId, chat, instanceId, messages);
          
          if (ticketResult.success && ticketResult.ticketId) {
            // 6. Importar mensagens reais
            const messageCount = await this.importMessagesForTicket(ticketResult.ticketId, messages);
            totalMessages += messageCount;
            importedConversations++;
            
            console.log(`✅ [IMPORT] Chat importado: ${chat.remoteJid} (${messageCount} mensagens)`);
          }
        } catch (chatError) {
          console.warn(`⚠️ [IMPORT] Erro ao processar chat ${chat.remoteJid}:`, chatError);
        }

        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.updateProgress({ 
        totalChats: chats.length, 
        processedChats: chats.length, 
        totalMessages: totalMessages, 
        processedMessages: totalMessages, 
        status: 'completed',
        message: `Importação concluída! ${importedConversations} conversas e ${totalMessages} mensagens`
      });

      console.log(`🎉 [IMPORT] Importação concluída: ${importedConversations} conversas, ${totalMessages} mensagens`);
      
      return { 
        success: true, 
        imported: importedConversations 
      };

    } catch (error) {
      console.error('❌ [IMPORT] Erro na importação:', error);
      
      this.updateProgress({ 
        totalChats: 0, 
        processedChats: 0, 
        totalMessages: 0, 
        processedMessages: 0, 
        status: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        message: `Erro na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });

      return { 
        success: false, 
        imported: 0, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  private async createOrUpdateTicket(clientId: string, chat: any, instanceId: string, messages: any[]) {
    try {
      // Extrair informações do chat
      const chatId = chat.remoteJid;
      const customerName = chat.name || chat.pushName || chatId.split('@')[0];
      const customerPhone = chatId.includes('@s.whatsapp.net') ? chatId.split('@')[0] : chatId;
      
      // Última mensagem
      const lastMessage = messages.length > 0 ? messages[0] : null;
      const lastMessagePreview = lastMessage?.message?.conversation || 
                                 lastMessage?.message?.extendedTextMessage?.text || 
                                 '[Mídia]';
      const lastMessageAt = lastMessage?.messageTimestamp ? 
                           new Date(lastMessage.messageTimestamp * 1000).toISOString() : 
                           new Date().toISOString();

      // Usar função do Supabase para criar/atualizar ticket
      const { data, error } = await supabase.rpc('upsert_conversation_ticket', {
        p_client_id: clientId,
        p_chat_id: chatId,
        p_instance_id: instanceId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_last_message: lastMessagePreview,
        p_last_message_at: lastMessageAt
      });

      if (error) {
        console.error('❌ [IMPORT] Erro ao criar ticket:', error);
        return { success: false, error: error.message };
      }

      return { success: true, ticketId: data };
    } catch (error) {
      console.error('❌ [IMPORT] Erro ao processar ticket:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  private async importMessagesForTicket(ticketId: string, messages: any[]): Promise<number> {
    let importedCount = 0;

    for (const message of messages) {
      try {
        // Extrair conteúdo da mensagem
        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text ||
                       message.message?.imageMessage?.caption ||
                       message.message?.videoMessage?.caption ||
                       '[Mídia não suportada]';

        const messageData = {
          ticket_id: ticketId,
          message_id: message.key?.id || `imported_${Date.now()}_${Math.random()}`,
          from_me: message.key?.fromMe || false,
          sender_name: message.pushName || (message.key?.fromMe ? 'Você' : 'Cliente'),
          content: content,
          message_type: this.getMessageType(message.message),
          timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
          processing_status: 'received',
          is_ai_response: false
        };

        const { error } = await supabase
          .from('ticket_messages')
          .insert(messageData);

        if (!error) {
          importedCount++;
        } else {
          console.warn('⚠️ [IMPORT] Erro ao inserir mensagem:', error);
        }
      } catch (error) {
        console.warn('⚠️ [IMPORT] Erro ao processar mensagem:', error);
      }
    }

    return importedCount;
  }

  private getMessageType(message: any): string {
    if (message.conversation || message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    return 'unknown';
  }

  private updateProgress(progress: Partial<ImportProgress>) {
    if (this.progressCallback) {
      // Calcular progresso geral para compatibilidade com o toast
      const current = progress.processedChats || 0;
      const total = progress.totalChats || 100;
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      
      const fullProgress: ImportProgress = {
        current: percentage,
        total: 100,
        message: progress.message || 'Processando...',
        ...progress
      };
      
      this.progressCallback(fullProgress);
    }
  }
}

export const conversationImportService = new ConversationImportService();