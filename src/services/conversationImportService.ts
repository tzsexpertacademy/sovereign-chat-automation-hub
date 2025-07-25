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

      const chats = await yumerApiV2.getAllChats(instanceId);
      console.log(`📂 [IMPORT] Encontrados ${chats.length} chats extraídos das mensagens`);
      
      if (chats.length === 0) {
        console.warn('⚠️ [IMPORT] Nenhum chat encontrado - verificando conectividade...');
        this.updateProgress({ 
          status: 'completed',
          message: 'Nenhuma conversa encontrada. Verifique se a instância está conectada e possui conversas.'
        });
        return { success: true, imported: 0 };
      }

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
          const messages = await yumerApiV2.findMessages(instanceId, chat.remoteJid, 50);
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
      
      // Última mensagem (corrigido para API v2.2.1)
      const lastMessage = messages.length > 0 ? messages[0] : null;
      let lastMessagePreview = '[Sem mensagens]';
      
      if (lastMessage?.content) {
        if (lastMessage.contentType === 'text' || lastMessage.contentType === 'extendedText') {
          lastMessagePreview = lastMessage.content?.text || lastMessage.content || '[Texto]';
        } else {
          lastMessagePreview = `[${lastMessage.contentType || 'Mídia'}]`;
        }
      }
      
      // Timestamp correto
      let lastMessageAt = new Date().toISOString();
      if (lastMessage?.messageTimestamp) {
        if (typeof lastMessage.messageTimestamp === 'number') {
          lastMessageAt = new Date(lastMessage.messageTimestamp * 1000).toISOString();
        } else {
          lastMessageAt = new Date(lastMessage.messageTimestamp).toISOString();
        }
      } else if (lastMessage?.createdAt) {
        lastMessageAt = new Date(lastMessage.createdAt).toISOString();
      }

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
        // Validar estrutura da mensagem (API v2.2.1)
        if (!message || !message.content) {
          console.warn('⚠️ [IMPORT] Mensagem inválida - estrutura ausente:', message);
          continue;
        }

        // Extrair conteúdo correto para API v2.2.1
        let content = '[Mensagem não suportada]';
        
        if (message.contentType === 'text' || message.contentType === 'extendedText') {
          content = message.content?.text || message.content || '[Texto vazio]';
        } else if (message.contentType === 'image') {
          content = message.content?.caption || '[Imagem]';
        } else if (message.contentType === 'video') {
          content = message.content?.caption || '[Vídeo]';
        } else if (message.contentType === 'audio') {
          content = '[Áudio]';
        } else if (message.contentType === 'document') {
          content = message.content?.fileName || '[Documento]';
        } else if (message.contentType === 'sticker') {
          content = '[Sticker]';
        } else {
          content = `[${message.contentType || 'Mídia'}]`;
        }

        // Extrair nome do remetente (melhorado para v2.2.1)
        const senderName = message.pushName || 
                          message.senderName || 
                          (message.fromMe ? 'Você' : 'Cliente');

        // Converter timestamp correto (ISO string para timestamp)
        let timestamp = new Date().toISOString();
        if (message.messageTimestamp) {
          // Se for número (timestamp em segundos)
          if (typeof message.messageTimestamp === 'number') {
            timestamp = new Date(message.messageTimestamp * 1000).toISOString();
          } else if (typeof message.messageTimestamp === 'string') {
            // Se for string ISO
            timestamp = new Date(message.messageTimestamp).toISOString();
          }
        } else if (message.createdAt) {
          timestamp = new Date(message.createdAt).toISOString();
        }

        const messageData = {
          ticket_id: ticketId,
          message_id: message.messageId || message.id || `imported_${Date.now()}_${Math.random()}`,
          from_me: message.fromMe || false,
          sender_name: senderName,
          content: content,
          message_type: this.getMessageType(message),
          timestamp: timestamp,
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
    // Usar contentType da API v2.2.1
    if (message.contentType) {
      switch (message.contentType) {
        case 'text':
        case 'extendedText':
          return 'text';
        case 'image':
          return 'image';
        case 'video':
          return 'video';
        case 'audio':
        case 'ptt':
          return 'audio';
        case 'document':
          return 'document';
        case 'sticker':
          return 'sticker';
        default:
          return message.contentType;
      }
    }
    
    // Fallback para estrutura antiga (compatibilidade)
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