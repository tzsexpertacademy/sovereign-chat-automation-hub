/**
 * ETAPA 2: SINCRONIZAÇÃO REAL DE CONVERSAS
 * Implementa importação real usando API CodeChat v2.2.1
 */

import { supabase } from '@/integrations/supabase/client';
import yumerApiV2 from './yumerApiV2Service';
import { contactCacheImproved } from './contactCacheImprovedService';

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
   * MÉTODO PRINCIPAL: Sincronizar conversas usando FLUXO CORRETO da API v2.2.1
   * NOVO FLUXO: Contatos → Tickets → Mensagens específicas
   */
  async syncRealConversations(clientId: string, instanceId: string): Promise<{ success: boolean; imported: number; error?: string }> {
    console.log('🚀 [IMPORT-V2] Iniciando importação CORRETA de conversas para:', instanceId);
    
    try {
      // ==================== ETAPA 1: BUSCAR TODOS OS CONTATOS ====================
      this.updateProgress({ 
        totalChats: 0, 
        processedChats: 0, 
        totalMessages: 0, 
        processedMessages: 0, 
        status: 'importing_chats',
        message: 'Buscando todos os contatos...'
      });

      console.log('👥 [IMPORT-V2] ETAPA 1: Buscando todos os contatos...');
      const allContacts = await yumerApiV2.getAllContacts(instanceId);
      
      console.log(`📞 [IMPORT-V2] ${allContacts.length} contatos encontrados`);
      
      if (allContacts.length === 0) {
        console.warn('⚠️ [IMPORT-V2] Nenhum contato encontrado');
        this.updateProgress({ 
          status: 'completed',
          message: 'Nenhum contato encontrado. Verifique se a instância está conectada.'
        });
        return { success: true, imported: 0 };
      }

      let totalImported = 0;
      let processedContacts = 0;
      const createdTickets: { ticketId: string; contact: any }[] = [];

      this.updateProgress({ 
        totalChats: allContacts.length, 
        processedChats: 0, 
        totalMessages: 0, 
        processedMessages: 0, 
        status: 'importing_chats',
        message: `Encontrados ${allContacts.length} contatos para processar`
      });

      // ==================== ETAPA 2: CRIAR TICKETS PARA CADA CONTATO ====================
      console.log('🎫 [IMPORT-V2] ETAPA 2: Criando tickets para contatos...');
      
      for (const contact of allContacts) {
        try {
          processedContacts++;
          
          this.updateProgress({
            totalChats: allContacts.length,
            processedChats: processedContacts,
            status: 'importing_chats',
            message: `Criando ticket ${processedContacts}/${allContacts.length}: ${contact.pushName || this.formatPhoneNumber(contact.remoteJid)}...`
          });

          console.log(`🎫 [IMPORT-V2] Criando ticket para: ${contact.pushName || contact.remoteJid} (${contact.remoteJid})`);

          // Criar ticket usando nome real do contato
          const ticketResult = await this.createOrUpdateTicket(
            clientId, 
            {
              remoteJid: contact.remoteJid,
              name: contact.pushName || this.formatPhoneNumber(contact.remoteJid),
              isGroup: contact.remoteJid.includes('@g.us'),
              isWaContact: contact.remoteJid.includes('@s.whatsapp.net')
            }, 
            instanceId, 
            [] // Sem mensagens iniciais
          );

          if (ticketResult.success && ticketResult.ticketId) {
            createdTickets.push({ ticketId: ticketResult.ticketId, contact });
            console.log(`✅ [IMPORT-V2] Ticket criado: ${contact.pushName || contact.remoteJid} → ${ticketResult.ticketId}`);
          } else {
            console.error(`❌ [IMPORT-V2] Erro ao criar ticket para ${contact.remoteJid}:`, ticketResult.error);
          }

        } catch (contactError) {
          console.error(`❌ [IMPORT-V2] Erro ao processar contato ${contact.remoteJid}:`, contactError);
          continue;
        }
      }

      console.log(`🎯 [IMPORT-V2] ${createdTickets.length} tickets criados com sucesso`);

      // ==================== ETAPA 3: BUSCAR E IMPORTAR MENSAGENS ESPECÍFICAS ====================
      console.log('📨 [IMPORT-V2] ETAPA 3: Importando mensagens específicas para cada contato...');
      
      let processedTickets = 0;

      for (const { ticketId, contact } of createdTickets) {
        try {
          processedTickets++;
          
          this.updateProgress({
            totalChats: allContacts.length,
            processedChats: allContacts.length,
            totalMessages: totalImported,
            processedMessages: processedTickets,
            status: 'importing_messages',
            currentChat: contact.pushName || contact.remoteJid,
            message: `Importando mensagens ${processedTickets}/${createdTickets.length}: ${contact.pushName || this.formatPhoneNumber(contact.remoteJid)}...`
          });

          console.log(`📨 [IMPORT-V2] Buscando mensagens específicas para: ${contact.remoteJid}`);

          // Buscar mensagens específicas usando keyRemoteJid correto
          const messages = await yumerApiV2.findMessages(instanceId, contact.remoteJid, 50);
          
          if (messages.length === 0) {
            console.log(`⚠️ [IMPORT-V2] Nenhuma mensagem encontrada para: ${contact.remoteJid}`);
            continue;
          }

          console.log(`📊 [IMPORT-V2] ${messages.length} mensagens encontradas para ${contact.remoteJid}`);

          // DEBUG: Mostrar estrutura das primeiras mensagens
          if (messages.length > 0) {
            console.log(`🔍 [IMPORT-V2] DEBUG - Primeiras mensagens para ${contact.remoteJid}:`);
            messages.slice(0, 3).forEach((msg, index) => {
              const msgRemoteJid = msg.keyRemoteJid || msg.key?.remoteJid || msg.remoteJid;
              const msgFromMe = msg.fromMe || msg.key?.fromMe;
              console.log(`  ${index + 1}. keyRemoteJid: "${msgRemoteJid}" | fromMe: ${msgFromMe} | solicitado: "${contact.remoteJid}"`);
            });
          }

          // Estratégia múltipla de filtragem
          let validMessages = messages.filter(msg => {
            const msgRemoteJid = msg.keyRemoteJid || msg.key?.remoteJid || msg.remoteJid;
            return msgRemoteJid === contact.remoteJid;
          });

          // Fallback 1: Se não encontrou com keyRemoteJid exato, tentar apenas o número
          if (validMessages.length === 0) {
            const contactNumber = contact.remoteJid.replace('@s.whatsapp.net', '');
            validMessages = messages.filter(msg => {
              const msgRemoteJid = msg.keyRemoteJid || msg.key?.remoteJid || msg.remoteJid;
              const msgNumber = msgRemoteJid?.replace('@s.whatsapp.net', '');
              return msgNumber === contactNumber;
            });
            console.log(`🔄 [IMPORT-V2] Fallback número: ${validMessages.length} mensagens encontradas`);
          }

          // Fallback 2: Se ainda não encontrou, verificar conversa bilateral
          if (validMessages.length === 0) {
            const contactNumber = contact.remoteJid.replace('@s.whatsapp.net', '');
            validMessages = messages.filter(msg => {
              const msgRemoteJid = msg.keyRemoteJid || msg.key?.remoteJid || msg.remoteJid;
              const msgFromMe = msg.fromMe || msg.key?.fromMe;
              // Aceitar se é conversa bilateral (tem fromMe e remoteJid relacionados)
              return msgRemoteJid?.includes(contactNumber) || 
                     (msgFromMe !== undefined && msgRemoteJid);
            });
            console.log(`🔄 [IMPORT-V2] Fallback conversa: ${validMessages.length} mensagens encontradas`);
          }

          console.log(`✅ [IMPORT-V2] ${validMessages.length} mensagens válidas filtradas para ${contact.remoteJid}`);

          if (validMessages.length === 0) {
            console.log(`⚠️ [IMPORT-V2] Nenhuma mensagem válida para: ${contact.remoteJid}`);
            // DEBUG: mostrar todos os remoteJids únicos encontrados
            const uniqueRemoteJids = [...new Set(messages.map(msg => 
              msg.keyRemoteJid || msg.key?.remoteJid || msg.remoteJid
            ))];
            console.log(`🔍 [IMPORT-V2] RemoteJids únicos encontrados:`, uniqueRemoteJids);
            continue;
          }

          // Importar mensagens para o ticket específico
          const importedCount = await this.importMessagesForTicket(
            ticketId, 
            validMessages, 
            instanceId
          );

          totalImported += importedCount;

          // Atualizar preview da última mensagem no ticket
          if (validMessages.length > 0) {
            const lastMessage = validMessages[0]; // mensagens vêm ordenadas por data desc
            const lastMessageText = this.extractMessageText(lastMessage);
            const lastMessageAt = new Date(lastMessage.messageTimestamp * 1000 || lastMessage.createdAt || Date.now());

            await supabase
              .from('conversation_tickets')
              .update({
                last_message_preview: lastMessageText,
                last_message_at: lastMessageAt.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', ticketId);
          }

          console.log(`✅ [IMPORT-V2] ${contact.pushName || contact.remoteJid}: ${importedCount} mensagens importadas`);

        } catch (messageError) {
          console.error(`❌ [IMPORT-V2] Erro ao importar mensagens para ${contact.remoteJid}:`, messageError);
          continue;
        }

        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      this.updateProgress({ 
        totalChats: allContacts.length, 
        processedChats: allContacts.length, 
        totalMessages: totalImported, 
        processedMessages: createdTickets.length, 
        status: 'completed',
        message: `Importação concluída! ${createdTickets.length} contatos e ${totalImported} mensagens`
      });

      console.log(`🎉 [IMPORT-V2] IMPORTAÇÃO CORRETA CONCLUÍDA:`);
      console.log(`📞 ${allContacts.length} contatos encontrados`);
      console.log(`🎫 ${createdTickets.length} tickets criados`);
      console.log(`📨 ${totalImported} mensagens importadas`);
      
      return { 
        success: true, 
        imported: totalImported 
      };

    } catch (error) {
      console.error('❌ [IMPORT-V2] Erro na importação:', error);
      
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

  /**
   * Formatar número de telefone para exibição
   */
  private formatPhoneNumber(remoteJid: string): string {
    const phone = remoteJid.split('@')[0];
    
    if (phone && phone.match(/^\d+$/)) {
      if (phone.length === 13 && phone.startsWith('55')) {
        return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '($2) $3-$4');
      } else if (phone.length >= 10) {
        return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    return phone || 'Número desconhecido';
  }

  /**
   * Extrair texto da mensagem para preview
   */
  private extractMessageText(message: any): string {
    if (message.content?.text) {
      return message.content.text;
    }
    
    if (message.content?.caption) {
      return message.content.caption;
    }
    
    // Tipos de conteúdo não textual
    switch (message.contentType?.toLowerCase()) {
      case 'image':
        return '📷 Imagem';
      case 'video':
        return '🎥 Vídeo';
      case 'audio':
        return '🎵 Áudio';
      case 'document':
        return '📄 Documento';
      case 'location':
        return '📍 Localização';
      default:
        return message.content || 'Mensagem sem texto';
    }
  }

  private async createOrUpdateTicket(clientId: string, chat: any, instanceId: string, messages: any[]) {
    try {
      // Extrair informações do chat
      const chatId = chat.remoteJid;
      
      // Usar cache de contatos para nome correto
      const customerName = contactCacheImproved.getContactName(instanceId, chatId);
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

  private async importMessagesForTicket(ticketId: string, messages: any[], instanceId: string): Promise<number> {
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

        // Extrair nome do remetente usando cache de contatos
        let senderName = 'Cliente';
        if (message.fromMe) {
          senderName = 'Você';
        } else if (message.pushName && message.pushName !== (message.keyRemoteJid || message.key?.remoteJid)?.split('@')[0]) {
          senderName = message.pushName;
        } else {
          const remoteJid = message.keyRemoteJid || message.key?.remoteJid;
          if (remoteJid) {
            senderName = contactCacheImproved.getContactName(instanceId, remoteJid);
          }
        }

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