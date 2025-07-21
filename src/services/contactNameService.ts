
/**
 * =====================================================
 * CONTACT NAME SERVICE V3.0 - USAR PUSHNAME DIRETO
 * =====================================================
 * 
 * CORREÇÃO CRÍTICA: O servidor já traz pushName correto!
 * Exemplo: pushName: 'Thalis Zulianello Silva'
 * 
 * NOVA REGRA: Se pushName existe e NÃO é número, usar DIRETO!
 */

import { supabase } from "@/integrations/supabase/client";

export interface ContactNameData {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'pushName' | 'messageContent' | 'phoneFormatted';
}

export class ContactNameService {
  
  /**
   * ✅ VERSÃO CORRIGIDA - PUSHNAME TEM PRIORIDADE ABSOLUTA
   */
  extractRealContactName(
    pushName?: string, 
    phone?: string, 
    firstMessage?: string
  ): ContactNameData {
    
    console.log('🔍 [NAME-EXTRACTION] Entrada:', { pushName, phone, firstMessage });

    // 1. REGRA PRINCIPAL: Se pushName existe e não é só número, usar DIRETO!
    if (pushName && !this.isJustPhoneNumber(pushName)) {
      console.log('✅ [NAME-EXTRACTION] Usando pushName direto:', pushName);
      return {
        name: this.cleanName(pushName),
        confidence: 'high',
        source: 'pushName'
      };
    }

    // 2. Se pushName é número ou vazio, tentar extrair da mensagem
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

    // 3. ÚLTIMO RECURSO: telefone formatado (só se pushName for número)
    const formattedPhone = this.formatPhone(phone || '');
    console.log('⚠️ [NAME-EXTRACTION] Usando telefone formatado:', formattedPhone);
    return {
      name: formattedPhone,
      confidence: 'low',
      source: 'phoneFormatted'
    };
  }

  /**
   * Verificar se é apenas número de telefone ou formato de telefone
   */
  private isJustPhoneNumber(text: string): boolean {
    if (!text || text.trim().length === 0) return true;
    
    // Remove espaços e caracteres especiais comuns em telefones
    const clean = text.replace(/[\s\-\(\)\+]/g, '');
    
    // Se é só números e tem 10+ dígitos, é telefone
    if (/^\d{10,}$/.test(clean)) {
      console.log('📞 [NAME-CHECK] É telefone (só números):', text);
      return true;
    }
    
    // Se começa com 55 e tem muitos números, é telefone brasileiro
    if (/^55\d{10,11}$/.test(clean)) {
      console.log('📞 [NAME-CHECK] É telefone brasileiro:', text);
      return true;
    }

    // Se contém formato de telefone brasileiro
    if (/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(text)) {
      console.log('📞 [NAME-CHECK] É telefone formatado:', text);
      return true;
    }
    
    console.log('👤 [NAME-CHECK] É nome real:', text);
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
   * OTIMIZAÇÃO: Usar pushName dos webhooks para corrigir nomes
   */
  async optimizeContactNames(clientId: string): Promise<{
    updated: number;
    errors: number;
    details: string[];
  }> {
    console.log('🔧 [NAME-OPTIMIZATION] Iniciando para cliente:', clientId);

    const result = { updated: 0, errors: 0, details: [] as string[] };

    try {
      // Buscar mensagens WhatsApp com pushName válido
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId);

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância WhatsApp encontrada para este cliente');
      }

      const instanceIds = instances.map(i => i.instance_id);

      // Buscar mensagens com informações de contato
      const { data: messagesWithNames, error: msgsError } = await supabase
        .from('whatsapp_messages')
        .select('sender, body')
        .in('instance_id', instanceIds)
        .eq('from_me', false)
        .not('sender', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (msgsError) throw msgsError;

      console.log('📨 [NAME-OPTIMIZATION] Mensagens encontradas:', messagesWithNames?.length || 0);

      // Criar mapeamento básico (para implementação futura com pushName real)
      const phoneToNameMap = new Map<string, string>();
      
      // Por enquanto, criar mapeamento simples baseado no sender
      for (const msg of messagesWithNames || []) {
        const phone = msg.sender;
        
        if (phone && !this.isJustPhoneNumber(phone)) {
          if (!phoneToNameMap.has(phone)) {
            phoneToNameMap.set(phone, phone);
            console.log('👤 [NAME-MAP]', phone, '→', phone);
          }
        }
      }

      console.log('📞 [NAME-OPTIMIZATION] Mapeamento criado:', phoneToNameMap.size, 'contatos');

      // Buscar clientes que precisam de otimização
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('client_id', clientId);

      if (custError) throw custError;

      for (const customer of customers || []) {
        try {
          const currentName = customer.name;
          const phone = customer.phone;
          
          // Se nome atual parece telefone e temos um pushName melhor
          if (this.isPhoneFormattedName(currentName) && phoneToNameMap.has(phone)) {
            const newName = phoneToNameMap.get(phone)!;
            
            await this.updateCustomerName(customer.id, newName);
            result.updated++;
            result.details.push(`✅ ${phone}: ${currentName} → ${newName}`);
            
            console.log('✅ [NAME-UPDATE]', phone, ':', currentName, '→', newName);
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
    return /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(name) || 
           /^\d+$/.test(name) ||
           name.startsWith('Contato ');
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
