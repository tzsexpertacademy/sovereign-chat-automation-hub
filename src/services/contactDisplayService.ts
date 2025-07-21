import { supabase } from '@/integrations/supabase/client';

/**
 * Serviço simplificado para exibir nomes de contatos corretamente
 */
class ContactDisplayService {
  /**
   * Atualizar os nomes dos contatos baseado nos dados do WhatsApp
   */
  async updateContactDisplayNames(clientId: string): Promise<{ updated: number; errors: number }> {
    console.log('🔄 [DISPLAY] Atualizando nomes de exibição dos contatos');
    
    let updated = 0;
    let errors = 0;

    try {
      // Buscar todos os tickets com suas mensagens para encontrar nomes reais
      const { data: tickets, error: ticketsError } = await supabase
        .from('conversation_tickets')
        .select(`
          id,
          customer_id,
          chat_id,
          title,
          customer:customers!inner(id, name, phone)
        `)
        .eq('client_id', clientId);

      if (ticketsError) {
        console.error('❌ [DISPLAY] Erro ao buscar tickets:', ticketsError);
        return { updated: 0, errors: 1 };
      }

      if (!tickets || tickets.length === 0) {
        console.log('📋 [DISPLAY] Nenhum ticket encontrado');
        return { updated: 0, errors: 0 };
      }

      console.log(`📋 [DISPLAY] Processando ${tickets.length} tickets`);

      for (const ticket of tickets) {
        try {
          // Buscar as primeiras mensagens do cliente (não do atendente) para extrair nomes
          const { data: messages, error: messagesError } = await supabase
            .from('ticket_messages')
            .select('content, sender_name, from_me')
            .eq('ticket_id', ticket.id)
            .eq('from_me', false) // Apenas mensagens do cliente
            .order('timestamp', { ascending: true })
            .limit(5);

          if (messagesError) {
            console.warn('⚠️ [DISPLAY] Erro ao buscar mensagens do ticket:', ticket.id, messagesError);
            continue;
          }

          if (!messages || messages.length === 0) {
            continue;
          }

          // Procurar por um nome real nas mensagens
          let realName: string | null = null;

          // 1. Verificar sender_name das mensagens que não seja formatação de telefone
          const senderNames = messages
            .map(msg => msg.sender_name)
            .filter(name => name && !name.match(/^\(\d+\)/) && name !== 'Cliente' && name.length > 2);

          if (senderNames.length > 0) {
            realName = senderNames[0];
          }

          // 2. Se não encontrou, procurar no conteúdo das mensagens
          if (!realName) {
            const firstMessages = messages.slice(0, 3);
            for (const message of firstMessages) {
              if (message.content) {
                // Procurar padrões como "Meu nome é X", "Sou o X", etc.
                const namePatterns = [
                  /(?:meu nome é|me chamo|sou (?:o|a))\s+([A-Z][a-záàâäãéèêëíìîïóòôöõúùûüç]+(?:\s+[A-Z][a-záàâäãéèêëíìîïóòôöõúùûüç]+)*)/i,
                  /^([A-Z][a-záàâäãéèêëíìîïóòôöõúùûüç]+(?:\s+[A-Z][a-záàâäãéèêëíìîïóòôöõúùûüç]+)*)\s*$/,
                  /([A-Z][a-záàâäãéèêëíìîïóòôöõúùûüç]+\s+[A-Z][a-záàâäãéèêëíìîïóòôöõúùûüç]+)/
                ];

                for (const pattern of namePatterns) {
                  const match = message.content.match(pattern);
                  if (match && match[1] && match[1].length > 2 && match[1].length < 50) {
                    realName = match[1].trim();
                    break;
                  }
                }

                if (realName) break;
              }
            }
          }

          // 3. Atualizar o contato se encontrou um nome válido
          if (realName && ticket.customer) {
            const currentName = ticket.customer.name;
            
            // Só atualizar se o nome atual for genérico
            if (currentName.match(/^\(\d+\)/) || 
                currentName.startsWith('Contato ') || 
                currentName === ticket.customer.phone ||
                currentName.length < 3) {
              
              console.log(`📝 [DISPLAY] Atualizando contato: "${currentName}" → "${realName}"`);
              
              const { error: updateError } = await supabase
                .from('customers')
                .update({ 
                  name: realName,
                  updated_at: new Date().toISOString()
                })
                .eq('id', ticket.customer.id);

              if (updateError) {
                console.error('❌ [DISPLAY] Erro ao atualizar contato:', updateError);
                errors++;
              } else {
                updated++;
                
                // Atualizar também o título do ticket
                await supabase
                  .from('conversation_tickets')
                  .update({ 
                    title: `Conversa com ${realName}`,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', ticket.id);
              }
            }
          }

        } catch (error) {
          console.error('❌ [DISPLAY] Erro ao processar ticket:', ticket.id, error);
          errors++;
        }
      }

      console.log(`✅ [DISPLAY] Atualização concluída: ${updated} atualizados, ${errors} erros`);
      return { updated, errors };

    } catch (error) {
      console.error('❌ [DISPLAY] Erro geral na atualização:', error);
      return { updated: 0, errors: 1 };
    }
  }

  /**
   * Formatar número de telefone para exibição
   */
  formatPhoneDisplay(phone: string): string {
    if (!phone) return 'Sem telefone';

    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const number = cleaned.substring(2);
      if (number.length === 11) {
        return number.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (number.length === 10) {
        return number.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      }
    }

    return phone;
  }

  /**
   * Obter nome de exibição para um contato
   */
  getDisplayName(contactName: string, phone: string): string {
    if (!contactName || contactName.match(/^\(\d+\)/) || contactName.startsWith('Contato ')) {
      return this.formatPhoneDisplay(phone);
    }
    return contactName;
  }
}

export const contactDisplayService = new ContactDisplayService();