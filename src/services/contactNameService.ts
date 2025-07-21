/**
 * =====================================================
 * CONTACT NAME SERVICE V3.0 - SUPER SIMPLES
 * =====================================================
 * 
 * O servidor já traz pushName correto: 'Thalis Zulianello Silva'
 * Vamos apenas usar isso diretamente!
 */

import { supabase } from "@/integrations/supabase/client";

export interface ContactNameData {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'pushName' | 'messageContent' | 'phoneFormatted';
}

export class ContactNameService {
  
  /**
   * ✅ VERSÃO SUPER SIMPLES - USAR PUSHNAME DIRETO
   */
  extractRealContactName(
    pushName?: string, 
    phone?: string, 
    firstMessage?: string
  ): ContactNameData {
    
    console.log('🔍 [NAME-EXTRACTION] Entrada:', { pushName, phone, firstMessage });

    // 1. Se pushName existe e não é número, usar direto!
    if (pushName && !this.isJustPhoneNumber(pushName)) {
      console.log('✅ [NAME-EXTRACTION] Usando pushName:', pushName);
      return {
        name: this.cleanName(pushName),
        confidence: 'high',
        source: 'pushName'
      };
    }

    // 2. Tentar extrair da mensagem
    if (firstMessage) {
      const extractedName = this.extractNameFromMessage(firstMessage);
      if (extractedName) {
        console.log('✅ [NAME-EXTRACTION] Nome extraído da mensagem:', extractedName);
        return {
          name: extractedName,
          confidence: 'medium',
          source: 'messageContent'
        };
      }
    }

    // 3. Último recurso: telefone formatado
    const formattedPhone = this.formatPhone(phone || '');
    console.log('⚠️ [NAME-EXTRACTION] Usando telefone formatado:', formattedPhone);
    return {
      name: formattedPhone,
      confidence: 'low',
      source: 'phoneFormatted'
    };
  }

  /**
   * Verificar se é apenas número de telefone
   */
  private isJustPhoneNumber(text: string): boolean {
    // Remove espaços e caracteres especiais
    const clean = text.replace(/[\s\-\(\)]/g, '');
    
    // Se é só números e tem 10+ dígitos, é telefone
    if (/^\d{10,}$/.test(clean)) return true;
    
    // Se começa com 55 e tem muitos números, é telefone brasileiro
    if (/^55\d{10,11}$/.test(clean)) return true;
    
    return false;
  }

  /**
   * Limpar nome
   */
  private cleanName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(' ');
  }

  /**
   * Extrair nome de mensagem
   */
  private extractNameFromMessage(message: string): string | null {
    const patterns = [
      /(?:sou|me chamo|meu nome é|eu sou|aqui é)\s+(\w+(?:\s+\w+)?)/i,
      /^(\w+(?:\s+\w+)?)\s+aqui/i,
      /oi,?\s*(\w+(?:\s+\w+)?)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && !this.isJustPhoneNumber(match[1])) {
        return this.cleanName(match[1]);
      }
    }

    return null;
  }

  /**
   * Formatar telefone
   */
  private formatPhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    
    if (clean.length >= 10) {
      const ddd = clean.slice(-10, -8);
      const num = clean.slice(-8);
      return `(${ddd}) ${num.slice(0,4)}-${num.slice(4)}`;
    }
    
    return phone || 'Contato';
  }

  /**
   * Otimizar nomes existentes - USA DIRETAMENTE O PUSHNAME DOS WEBHOOKS
   */
  async optimizeContactNames(clientId: string): Promise<{
    updated: number;
    errors: number;
    details: string[];
  }> {
    console.log('🔧 [NAME-OPTIMIZATION] Iniciando para cliente:', clientId);

    const result = { updated: 0, errors: 0, details: [] as string[] };

    try {
      // Buscar contatos com nomes que são telefones
      const { data: customers, error } = await supabase
        .from('customers')
        .select(`
          id, name, phone,
          conversation_tickets (
            ticket_messages (
              content, sender_name, from_me
            )
          )
        `)
        .eq('client_id', clientId);

      if (error) throw error;

      for (const customer of customers || []) {
        try {
          // Se nome atual parece telefone, tentar melhorar
          if (this.isPhoneFormattedName(customer.name)) {
            
            const messages = customer.conversation_tickets?.[0]?.ticket_messages || [];
            
            // 1. Procurar sender_name válido (que é o pushName do webhook!)
            const validSender = messages.find(m => 
              !m.from_me && 
              m.sender_name && 
              !this.isJustPhoneNumber(m.sender_name)
            );
            
            if (validSender) {
              await this.updateCustomerName(customer.id, validSender.sender_name);
              result.updated++;
              result.details.push(`✅ ${customer.phone} → ${validSender.sender_name}`);
              continue;
            }

            // 2. Tentar extrair da primeira mensagem
            const firstMessage = messages.find(m => !m.from_me && m.content);
            if (firstMessage) {
              const extracted = this.extractNameFromMessage(firstMessage.content);
              if (extracted) {
                await this.updateCustomerName(customer.id, extracted);
                result.updated++;
                result.details.push(`✅ ${customer.phone} → ${extracted} (mensagem)`);
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error: any) {
          result.errors++;
          result.details.push(`❌ ${customer.phone}: ${error.message}`);
        }
      }

      return result;

    } catch (error: any) {
      console.error('❌ [NAME-OPTIMIZATION] Erro:', error);
      throw error;
    }
  }

  /**
   * Verificar se é nome formatado como telefone
   */
  private isPhoneFormattedName(name: string): boolean {
    return /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(name) || /^\d+$/.test(name);
  }

  /**
   * Atualizar nome do cliente
   */
  private async updateCustomerName(customerId: string, newName: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ 
        name: this.cleanName(newName),
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (error) throw error;
  }

  /**
   * COMPATIBILIDADE: Manter método antigo funcionando
   */
  async reprocessExistingContacts(clientId: string) {
    return this.optimizeContactNames(clientId);
  }
}

export const contactNameService = new ContactNameService();