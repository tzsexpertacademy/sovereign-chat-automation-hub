/**
 * Serviço MELHORADO para extração e normalização de nomes de contatos
 * Versão 2.0 - Com detecção inteligente de nomes reais
 */

import { supabase } from '@/integrations/supabase/client';

export interface ContactNameData {
  name: string;
  phone: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'pushName' | 'messageContent' | 'phoneFormatted';
  originalPushName?: string;
}

class ContactNameService {
  /**
   * NOVA: Verificar se pushName é realmente um nome ou apenas telefone
   */
  private isPushNameActuallyPhone(pushName: string): boolean {
    if (!pushName) return true;
    
    // Remove todos os caracteres não numéricos
    const numbersOnly = pushName.replace(/\D/g, '');
    
    // Se 80% ou mais são números, provavelmente é telefone
    const numberPercentage = numbersOnly.length / pushName.length;
    
    // Padrões que indicam telefone disfarçado de nome
    const phonePatterns = [
      /^55\d+$/,           // DDI Brasil + número
      /^\d{10,13}$/,       // Apenas números
      /^\+?55\d+$/,        // Com +55
      /^\(\d{2}\).*\d+$/,  // (XX) formato
      /^\d{2}\s?\d+$/      // XX XXXXX ou XX XXXXX
    ];
    
    return numberPercentage > 0.8 || phonePatterns.some(pattern => pattern.test(pushName));
  }

  /**
   * MELHORADA: Extrair nome real usando estratégias avançadas
   */
  extractRealContactName(pushName: string | undefined, phone: string, firstMessage?: string, allMessages?: string[]): ContactNameData {
    console.log('🔍 [NAME-EXTRACTION-V2] Analisando:', { 
      pushName, 
      phone, 
      firstMessage: firstMessage?.substring(0, 50),
      totalMessages: allMessages?.length || 0 
    });

    // ESTRATÉGIA 1: pushName válido E não é telefone disfarçado
    if (pushName && !this.isPushNameActuallyPhone(pushName) && this.isValidRealName(pushName)) {
      const formattedName = this.formatCustomerName(pushName);
      console.log('✅ [NAME-EXTRACTION-V2] Nome real via pushName:', formattedName);
      return {
        name: formattedName,
        phone,
        confidence: 'high',
        source: 'pushName',
        originalPushName: pushName
      };
    }

    // ESTRATÉGIA 2: Analisar todas as mensagens para encontrar apresentação
    if (allMessages && allMessages.length > 0) {
      for (const message of allMessages.slice(0, 5)) { // Primeiras 5 mensagens
        const extractedName = this.extractNameFromMessage(message);
        if (extractedName && this.isValidRealName(extractedName)) {
          const formattedName = this.formatCustomerName(extractedName);
          console.log('✅ [NAME-EXTRACTION-V2] Nome extraído das mensagens:', formattedName);
          return {
            name: formattedName,
            phone,
            confidence: 'high',
            source: 'messageContent',
            originalPushName: pushName
          };
        }
      }
    }

    // ESTRATÉGIA 3: Primeira mensagem (fallback)
    if (firstMessage) {
      const extractedName = this.extractNameFromMessage(firstMessage);
      if (extractedName && this.isValidRealName(extractedName)) {
        const formattedName = this.formatCustomerName(extractedName);
        console.log('✅ [NAME-EXTRACTION-V2] Nome extraído da primeira mensagem:', formattedName);
        return {
          name: formattedName,
          phone,
          confidence: 'medium',
          source: 'messageContent',
          originalPushName: pushName
        };
      }
    }

    // ESTRATÉGIA 4: Telefone formatado (último recurso)
    const formattedPhone = this.formatPhoneForDisplay(phone);
    console.log('⚠️ [NAME-EXTRACTION-V2] Usando telefone formatado:', formattedPhone);
    return {
      name: formattedPhone,
      phone,
      confidence: 'low',
      source: 'phoneFormatted',
      originalPushName: pushName
    };
  }

  /**
   * MELHORADA: Padrões mais avançados para extração de nomes
   */
  private extractNameFromMessage(message: string): string | null {
    if (!message || message.length < 2) return null;

    // Ignorar mensagens que são claramente não-introdutórias
    const skipPatterns = [
      /^\[audioMessage\]$/,
      /^(ok|sim|não|oi|olá|opa|eae)$/i,
      /^\d+$/,
      /^(bom dia|boa tarde|boa noite)$/i
    ];

    if (skipPatterns.some(pattern => pattern.test(message.trim()))) {
      return null;
    }

    // Padrões melhorados para capturar nomes
    const patterns = [
      // "Oi, eu sou João Silva" ou "Sou o João"
      /(?:oi|olá|oie?),?\s*(?:eu\s+)?sou\s+(?:o\s+|a\s+)?([a-záàâãäéèêëíìîïóòôõöúùûüç\s]{2,30})/gi,
      
      // "Meu nome é João Silva"
      /meu\s+nome\s+é\s+([a-záàâãäéèêëíìîïóòôõöúùûüç\s]{2,30})/gi,
      
      // "Me chamo João Silva"
      /me\s+chamo\s+([a-záàâãäéèêëíìîïóòôõöúùûüç\s]{2,30})/gi,
      
      // "João aqui" ou "Aqui é o João"
      /(?:aqui\s+é\s+(?:o\s+|a\s+)?|^)([a-záàâãäéèêëíìîïóòôõöúùûüç]+)\s+aqui/gi,
      
      // Nome no início seguido de cumprimento
      /^([a-záàâãäéèêëíìîïóòôõöúùûüç\s]{2,20}),?\s+(?:boa|bom|oi|olá)/gi,
      
      // "Eu sou/Sou + nome"
      /(?:eu\s+sou|sou)\s+([a-záàâãäéèêëíìîïóòôõöúùûüç\s]{2,30})/gi,
      
      // Padrão mais específico: nome próprio no início da mensagem
      /^([A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ][a-záàâãäéèêëíìîïóòôõöúùûüç]+(?:\s+[A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ][a-záàâãäéèêëíìîïóòôõöúùûüç]+)*)/
    ];

    for (const pattern of patterns) {
      const matches = [...message.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const extractedName = match[1].trim();
          if (extractedName.length >= 2 && extractedName.length <= 50) {
            // Validação extra: não deve ser apenas uma palavra muito comum
            const commonWords = ['contato', 'cliente', 'pessoa', 'whatsapp', 'conversa'];
            if (!commonWords.includes(extractedName.toLowerCase())) {
              return extractedName;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * MELHORADA: Validação mais rigorosa de nomes
   */
  private isValidRealName(name: string): boolean {
    if (!name || name.trim().length < 2) return false;
    
    const cleanName = name.trim();
    
    // Rejeitar se for apenas números
    if (/^\d+$/.test(cleanName)) return false;
    
    // Rejeitar se contém @ (email/whatsapp)
    if (cleanName.includes('@')) return false;
    
    // Rejeitar se é muito curto
    if (cleanName.length < 2) return false;
    
    // Rejeitar padrões de "Contato" genérico
    if (/^contato\s*\d*$/gi.test(cleanName)) return false;
    
    // Rejeitar números de telefone disfarçados
    if (/^\(\d+\)/.test(cleanName)) return false;
    if (/^55\d+$/.test(cleanName)) return false;
    if (/^\+?55\d+$/.test(cleanName)) return false;
    
    // Deve conter pelo menos uma letra
    if (!/[a-záàâãäéèêëíìîïóòôõöúùûüç]/gi.test(cleanName)) return false;
    
    // Rejeitar se é 100% números
    const numbersOnly = cleanName.replace(/\D/g, '');
    if (numbersOnly.length === cleanName.length) return false;
    
    // Rejeitar nomes muito genéricos
    const genericNames = ['user', 'usuario', 'cliente', 'contato', 'pessoa'];
    if (genericNames.includes(cleanName.toLowerCase())) return false;
    
    return true;
  }

  private formatCustomerName(rawName: string): string {
    if (!rawName || rawName.trim() === '') {
      return 'Contato sem nome';
    }

    const cleanName = rawName.trim();
    
    if (cleanName.length < 2) {
      return cleanName;
    }
    
    return cleanName
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  private formatPhoneForDisplay(phoneNumber: string): string {
    if (!phoneNumber) return 'Telefone inválido';
    
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    if (cleanedNumber.length === 13 && cleanedNumber.startsWith('55')) {
      const ddd = cleanedNumber.substring(2, 4);
      const number = cleanedNumber.substring(4);
      
      if (number.length === 9) {
        return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
      } else if (number.length === 8) {
        return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
      }
    }

    if (cleanedNumber.length === 11) {
      const ddd = cleanedNumber.substring(0, 2);
      const number = cleanedNumber.substring(2);
      return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    } else if (cleanedNumber.length === 10) {
      const ddd = cleanedNumber.substring(0, 2);
      const number = cleanedNumber.substring(2);
      return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
    }

    return phoneNumber;
  }

  /**
   * NOVA: Reprocessar contatos existentes com melhor algoritmo
   */
  async reprocessExistingContacts(clientId: string): Promise<{ updated: number; errors: number; details: string[] }> {
    console.log('🔄 [REPROCESS-CONTACTS] Iniciando reprocessamento para cliente:', clientId);

    const result = {
      updated: 0,
      errors: 0,
      details: [] as string[]
    };

    try {
      // Buscar contatos com baixa confiança (telefones formatados)
      const { data: contacts, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          phone,
          whatsapp_chat_id,
          conversation_tickets (
            id,
            chat_id
          )
        `)
        .eq('client_id', clientId);

      if (error) throw error;

      for (const contact of contacts || []) {
        try {
          // Verificar se o nome atual parece ser telefone formatado
          const isCurrentNamePhone = this.isPushNameActuallyPhone(contact.name) || 
                                    contact.name.includes('(') && contact.name.includes(')');

          if (isCurrentNamePhone && contact.conversation_tickets?.length > 0) {
            const ticketId = contact.conversation_tickets[0].id;
            
            // Buscar mensagens do ticket para re-análise
            const { data: messages } = await supabase
              .from('ticket_messages')
              .select('content, sender_name, from_me')
              .eq('ticket_id', ticketId)
              .eq('from_me', false)
              .not('content', 'is', null)
              .order('timestamp', { ascending: true })
              .limit(10);

            if (messages && messages.length > 0) {
              const allMessageContents = messages.map(m => m.content);
              const senderName = messages.find(m => m.sender_name)?.sender_name;
              const firstMessage = messages[0]?.content;

              const nameData = this.extractRealContactName(
                senderName,
                contact.phone,
                firstMessage,
                allMessageContents
              );

              // Só atualizar se encontrou um nome melhor
              if (nameData.confidence === 'high' || nameData.confidence === 'medium') {
                const { error: updateError } = await supabase
                  .from('customers')
                  .update({
                    name: nameData.name,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', contact.id);

                if (updateError) throw updateError;

                result.updated++;
                result.details.push(`✅ ${contact.phone}: "${contact.name}" → "${nameData.name}"`);
                console.log(`✅ [REPROCESS-CONTACTS] Atualizado: ${contact.phone} → ${nameData.name}`);
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`❌ [REPROCESS-CONTACTS] Erro ao processar ${contact.phone}:`, error);
          result.errors++;
          result.details.push(`❌ ${contact.phone}: ${error.message}`);
        }
      }

      console.log('✅ [REPROCESS-CONTACTS] Concluído:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [REPROCESS-CONTACTS] Erro crítico:', error);
      throw new Error(`Falha no reprocessamento: ${error.message}`);
    }
  }

  async updateContactName(clientId: string, phone: string, nameData: ContactNameData): Promise<boolean> {
    try {
      console.log('📝 [NAME-UPDATE] Atualizando nome do contato:', nameData);

      const { error: customerError } = await supabase
        .from('customers')
        .update({
          name: nameData.name,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', clientId)
        .eq('phone', phone);

      if (customerError) {
        console.error('❌ [NAME-UPDATE] Erro ao atualizar customer:', customerError);
        return false;
      }

      const { error: ticketError } = await supabase
        .from('conversation_tickets')
        .update({
          title: `Conversa com ${nameData.name}`,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', clientId)
        .eq('chat_id', phone);

      if (ticketError) {
        console.error('❌ [NAME-UPDATE] Erro ao atualizar tickets:', ticketError);
      }

      console.log('✅ [NAME-UPDATE] Nome atualizado com sucesso');
      return true;

    } catch (error) {
      console.error('❌ [NAME-UPDATE] Erro crítico:', error);
      return false;
    }
  }

  async batchUpdateContactNames(clientId: string, contacts: Array<{
    phone: string;
    pushName?: string;
    firstMessage?: string;
  }>): Promise<{ updated: number; errors: number }> {
    console.log(`🔄 [BATCH-UPDATE] Processando ${contacts.length} contatos para atualização de nomes`);

    let updated = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        const nameData = this.extractRealContactName(
          contact.pushName, 
          contact.phone, 
          contact.firstMessage
        );

        if (nameData.confidence === 'high' || nameData.confidence === 'medium') {
          const success = await this.updateContactName(clientId, contact.phone, nameData);
          if (success) {
            updated++;
          } else {
            errors++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('❌ [BATCH-UPDATE] Erro ao processar contato:', contact.phone, error);
        errors++;
      }
    }

    console.log(`✅ [BATCH-UPDATE] Concluído: ${updated} atualizados, ${errors} erros`);
    return { updated, errors };
  }
}

export const contactNameService = new ContactNameService();
export default contactNameService;
