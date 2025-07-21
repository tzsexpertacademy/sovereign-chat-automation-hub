
/**
 * Serviço especializado para extração e normalização de nomes de contatos
 */

import { supabase } from '@/integrations/supabase/client';

export interface ContactNameData {
  name: string;
  phone: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'pushName' | 'messageContent' | 'phoneFormatted';
}

class ContactNameService {
  /**
   * Extrair nome real de contato usando múltiplas estratégias
   */
  extractRealContactName(pushName: string | undefined, phone: string, firstMessage?: string): ContactNameData {
    console.log('🔍 [NAME-EXTRACTION] Extraindo nome:', { pushName, phone, firstMessage: firstMessage?.substring(0, 50) });

    // ESTRATÉGIA 1: pushName válido (maior confiança)
    if (pushName && this.isValidRealName(pushName)) {
      const formattedName = this.formatCustomerName(pushName);
      console.log('✅ [NAME-EXTRACTION] Nome extraído via pushName:', formattedName);
      return {
        name: formattedName,
        phone,
        confidence: 'high',
        source: 'pushName'
      };
    }

    // ESTRATÉGIA 2: Extrair nome da primeira mensagem (confiança média)
    if (firstMessage) {
      const extractedName = this.extractNameFromMessage(firstMessage);
      if (extractedName && this.isValidRealName(extractedName)) {
        const formattedName = this.formatCustomerName(extractedName);
        console.log('✅ [NAME-EXTRACTION] Nome extraído da mensagem:', formattedName);
        return {
          name: formattedName,
          phone,
          confidence: 'medium',
          source: 'messageContent'
        };
      }
    }

    // ESTRATÉGIA 3: Usar telefone formatado (baixa confiança)
    const formattedPhone = this.formatPhoneForDisplay(phone);
    console.log('⚠️ [NAME-EXTRACTION] Usando telefone formatado:', formattedPhone);
    return {
      name: formattedPhone,
      phone,
      confidence: 'low',
      source: 'phoneFormatted'
    };
  }

  /**
   * Extrair nome de uma mensagem usando padrões comuns
   */
  private extractNameFromMessage(message: string): string | null {
    if (!message || message.length < 2) return null;

    // Padrões comuns de apresentação
    const patterns = [
      // "Oi, eu sou João" ou "Sou o João"
      /(?:oi|olá|oie?),?\s*(?:eu\s+)?sou\s+(?:o\s+|a\s+)?([a-záàâãäéèêëíìîïóòôõöúùûüç\s]+)/gi,
      // "Meu nome é João"
      /meu\s+nome\s+é\s+([a-záàâãäéèêëíìîïóòôõöúùûüç\s]+)/gi,
      // "Me chamo João"
      /me\s+chamo\s+([a-záàâãäéèêëíìîïóòôõöúùûüç\s]+)/gi,
      // "João aqui" ou "Aqui é o João"
      /(?:aqui\s+é\s+(?:o\s+|a\s+)?|^)([a-záàâãäéèêëíìîïóòôõöúùûüç]+)\s+aqui/gi,
      // Nome seguido de cumprimento: "João, boa tarde"
      /^([a-záàâãäéèêëíìîïóòôõöúùûüç\s]+),?\s+(?:boa|bom|oi)/gi
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(message);
      if (match && match[1]) {
        const extractedName = match[1].trim();
        if (extractedName.length >= 2 && extractedName.length <= 50) {
          return extractedName;
        }
      }
    }

    return null;
  }

  /**
   * Verificar se um nome é válido e não é apenas um número/telefone
   */
  private isValidRealName(name: string): boolean {
    if (!name || name.trim().length < 2) return false;
    
    const cleanName = name.trim();
    
    // Rejeitar se for apenas números
    if (/^\d+$/.test(cleanName)) return false;
    
    // Rejeitar se contém @ (email/whatsapp)
    if (cleanName.includes('@')) return false;
    
    // Rejeitar se for apenas um caractere
    if (cleanName.length < 2) return false;
    
    // Rejeitar se for "Contato" genérico
    if (/^contato\s*\d*$/gi.test(cleanName)) return false;
    
    // Rejeitar números de telefone disfarçados
    if (/^\(\d+\)/.test(cleanName)) return false;
    
    // Aceitar se contém pelo menos uma letra
    return /[a-záàâãäéèêëíìîïóòôõöúùûüç]/gi.test(cleanName);
  }

  /**
   * Formatar nome do cliente
   */
  private formatCustomerName(rawName: string): string {
    if (!rawName || rawName.trim() === '') {
      return 'Contato sem nome';
    }

    const cleanName = rawName.trim();
    
    // Se é muito curto, retornar como está
    if (cleanName.length < 2) {
      return cleanName;
    }
    
    // Nome válido - capitalizar primeira letra de cada palavra
    return cleanName
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Formatar telefone para exibição
   */
  private formatPhoneForDisplay(phoneNumber: string): string {
    if (!phoneNumber) return 'Telefone inválido';
    
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    // Formato brasileiro com DDI
    if (cleanedNumber.length === 13 && cleanedNumber.startsWith('55')) {
      const ddd = cleanedNumber.substring(2, 4);
      const number = cleanedNumber.substring(4);
      
      if (number.length === 9) {
        return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
      } else if (number.length === 8) {
        return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
      }
    }

    // Formato brasileiro sem DDI
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
   * Atualizar nome de contato existente no banco
   */
  async updateContactName(clientId: string, phone: string, nameData: ContactNameData): Promise<boolean> {
    try {
      console.log('📝 [NAME-UPDATE] Atualizando nome do contato:', nameData);

      // Atualizar tabela customers
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

      // Atualizar tickets relacionados
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

  /**
   * Processar lote de contatos para atualização de nomes
   */
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

        // Só atualizar se conseguimos um nome com confiança alta/média
        if (nameData.confidence === 'high' || nameData.confidence === 'medium') {
          const success = await this.updateContactName(clientId, contact.phone, nameData);
          if (success) {
            updated++;
          } else {
            errors++;
          }
        }

        // Pequeno delay para não sobrecarregar o banco
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
