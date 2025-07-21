
/**
 * Serviço para sanitizar e validar consultas do Supabase
 * Evita erros 406 (Not Acceptable) e outros problemas de consulta
 */

import { supabase } from '@/integrations/supabase/client';

class SupabaseSanitizer {
  /**
   * Sanitizar string para uso seguro em consultas Supabase
   */
  sanitizeForQuery(value: string): string {
    if (!value) return '';
    
    // Remover caracteres que podem causar problemas em consultas
    return value
      .replace(/[\x00-\x1F\x7F]/g, '') // Caracteres de controle
      .replace(/['"\\]/g, '') // Aspas e barras
      .trim();
  }

  /**
   * Verificar se mensagem já existe com retry e fallback
   */
  async checkMessageExists(messageId: string, ticketId: string): Promise<boolean> {
    try {
      const sanitizedMessageId = this.sanitizeForQuery(messageId);
      const sanitizedTicketId = this.sanitizeForQuery(ticketId);

      console.log('🔍 [SUPABASE-CHECK] Verificando mensagem:', { 
        original: messageId.substring(0, 20), 
        sanitized: sanitizedMessageId.substring(0, 20) 
      });

      // Primeira tentativa - consulta normal
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('message_id', sanitizedMessageId)
        .eq('ticket_id', sanitizedTicketId)
        .limit(1);

      if (!error && data) {
        const exists = data.length > 0;
        console.log(`✅ [SUPABASE-CHECK] Resultado: ${exists ? 'existe' : 'não existe'}`);
        return exists;
      }

      console.warn('⚠️ [SUPABASE-CHECK] Erro na consulta, usando fallback:', error);
      
      // Fallback - buscar por ticket e comparar localmente
      return await this.checkMessageExistsFallback(sanitizedMessageId, sanitizedTicketId);

    } catch (error) {
      console.error('❌ [SUPABASE-CHECK] Erro crítico, assumindo que não existe:', error);
      return false; // Em caso de erro, assumir que não existe para permitir inserção
    }
  }

  /**
   * Fallback para verificação de mensagem usando busca por ticket
   */
  private async checkMessageExistsFallback(messageId: string, ticketId: string): Promise<boolean> {
    try {
      console.log('🔄 [FALLBACK] Verificando mensagem via fallback');

      const { data, error } = await supabase
        .from('ticket_messages')
        .select('message_id')
        .eq('ticket_id', ticketId)
        .limit(100); // Últimas 100 mensagens

      if (error || !data) {
        console.warn('⚠️ [FALLBACK] Erro no fallback:', error);
        return false;
      }

      const exists = data.some(msg => msg.message_id === messageId);
      console.log(`✅ [FALLBACK] Resultado: ${exists ? 'existe' : 'não existe'}`);
      return exists;

    } catch (error) {
      console.error('❌ [FALLBACK] Erro no fallback:', error);
      return false;
    }
  }

  /**
   * Inserir mensagem com retry automático
   */
  async insertMessageSafely(messageData: any): Promise<boolean> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`💾 [SAFE-INSERT] Tentativa ${attempt}/${maxRetries}:`, messageData.message_id);

        const { error } = await supabase
          .from('ticket_messages')
          .insert(messageData);

        if (!error) {
          console.log('✅ [SAFE-INSERT] Mensagem inserida com sucesso');
          return true;
        }

        // Se é erro de duplicata, considerar como sucesso
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          console.log('✅ [SAFE-INSERT] Mensagem já existe (duplicata)');
          return true;
        }

        console.warn(`⚠️ [SAFE-INSERT] Tentativa ${attempt} falhou:`, error);

        if (attempt < maxRetries) {
          // Delay exponencial entre tentativas
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }

      } catch (error) {
        console.error(`❌ [SAFE-INSERT] Erro na tentativa ${attempt}:`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    console.error('❌ [SAFE-INSERT] Todas as tentativas falharam');
    return false;
  }

  /**
   * Buscar ticket com fallback
   */
  async findTicketSafely(clientId: string, chatId: string): Promise<any> {
    try {
      const sanitizedClientId = this.sanitizeForQuery(clientId);
      const sanitizedChatId = this.sanitizeForQuery(chatId);

      const { data, error } = await supabase
        .from('conversation_tickets')
        .select('id, customer_id')
        .eq('client_id', sanitizedClientId)
        .eq('chat_id', sanitizedChatId)
        .limit(1);

      if (error) {
        console.error('❌ [TICKET-SEARCH] Erro na busca:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;

    } catch (error) {
      console.error('❌ [TICKET-SEARCH] Erro crítico:', error);
      return null;
    }
  }

  /**
   * Atualizar contato com sanitização
   */
  async updateContactSafely(clientId: string, phone: string, updates: any): Promise<boolean> {
    try {
      const sanitizedClientId = this.sanitizeForQuery(clientId);
      const sanitizedPhone = this.sanitizeForQuery(phone);
      
      // Sanitizar campos do update
      const sanitizedUpdates = {
        ...updates,
        name: updates.name ? this.sanitizeForQuery(updates.name) : updates.name,
        whatsapp_chat_id: updates.whatsapp_chat_id ? this.sanitizeForQuery(updates.whatsapp_chat_id) : updates.whatsapp_chat_id
      };

      const { error } = await supabase
        .from('customers')
        .update(sanitizedUpdates)
        .eq('client_id', sanitizedClientId)
        .eq('phone', sanitizedPhone);

      if (error) {
        console.error('❌ [CONTACT-UPDATE] Erro na atualização:', error);
        return false;
      }

      console.log('✅ [CONTACT-UPDATE] Contato atualizado com sucesso');
      return true;

    } catch (error) {
      console.error('❌ [CONTACT-UPDATE] Erro crítico:', error);
      return false;
    }
  }
}

export const supabaseSanitizer = new SupabaseSanitizer();
export default supabaseSanitizer;
