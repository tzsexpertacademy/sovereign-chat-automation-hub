/**
 * Serviço de cache de contatos aprimorado para importação v2.2.1
 */

import yumerApiV2 from './yumerApiV2Service';
import { ContactRecord } from './yumerApiV2Service';

interface ContactCache {
  contacts: Map<string, ContactRecord>;
  timestamp: number;
  instanceId: string;
}

export class ContactCacheImprovedService {
  private cache = new Map<string, ContactCache>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * Busca e armazena em cache todos os contatos de uma instância
   */
  async loadContactsForInstance(instanceId: string): Promise<Map<string, ContactRecord>> {
    const cached = this.cache.get(instanceId);
    
    // Verificar se cache é válido
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`📱 [CONTACT-CACHE] Usando cache para ${instanceId}: ${cached.contacts.size} contatos`);
      return cached.contacts;
    }

    console.log(`📱 [CONTACT-CACHE] Carregando contatos da instância ${instanceId}...`);
    
    const allContacts = new Map<string, ContactRecord>();
    let page = 1;
    let hasMorePages = true;

    try {
      // Buscar todos os contatos com paginação
      while (hasMorePages) {
        const result = await yumerApiV2.searchContacts(instanceId, page);
        
        if (result.contacts.length > 0) {
          result.contacts.forEach(contact => {
            if (contact.remoteJid) {
              allContacts.set(contact.remoteJid, contact);
            }
          });
          
          console.log(`📱 [CONTACT-CACHE] Página ${page}/${result.totalPages}: ${result.contacts.length} contatos`);
          
          hasMorePages = page < result.totalPages;
          page++;
        } else {
          hasMorePages = false;
        }
      }

      console.log(`📱 [CONTACT-CACHE] Total de contatos carregados: ${allContacts.size}`);

      // Armazenar no cache
      this.cache.set(instanceId, {
        contacts: allContacts,
        timestamp: Date.now(),
        instanceId
      });

      return allContacts;
    } catch (error) {
      console.error('❌ [CONTACT-CACHE] Erro ao carregar contatos:', error);
      return allContacts;
    }
  }

  /**
   * Busca um contato específico no cache
   */
  getContact(instanceId: string, remoteJid: string): ContactRecord | null {
    const cached = this.cache.get(instanceId);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.contacts.get(remoteJid) || null;
    }
    
    return null;
  }

  /**
   * Obtém nome formatado do contato
   */
  getContactName(instanceId: string, remoteJid: string): string {
    const contact = this.getContact(instanceId, remoteJid);
    
    if (contact?.pushName && contact.pushName !== remoteJid.split('@')[0]) {
      return contact.pushName;
    }
    
    // Formatar telefone se for número brasileiro
    const phone = remoteJid.split('@')[0];
    if (phone.match(/^\d+$/)) {
      if (phone.length === 13 && phone.startsWith('55')) {
        return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '($2) $3-$4');
      } else if (phone.length >= 10) {
        return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    return phone || 'Contato sem nome';
  }

  /**
   * Limpa cache de uma instância específica
   */
  clearInstanceCache(instanceId: string): void {
    this.cache.delete(instanceId);
    console.log(`🗑️ [CONTACT-CACHE] Cache da instância ${instanceId} limpo`);
  }

  /**
   * Limpa todo o cache
   */
  clearAllCache(): void {
    this.cache.clear();
    console.log('🗑️ [CONTACT-CACHE] Todo o cache foi limpo');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats(): { instances: number; totalContacts: number; cacheAges: { instanceId: string; ageMinutes: number }[] } {
    const stats = {
      instances: this.cache.size,
      totalContacts: 0,
      cacheAges: [] as { instanceId: string; ageMinutes: number }[]
    };

    this.cache.forEach((cached, instanceId) => {
      stats.totalContacts += cached.contacts.size;
      const ageMinutes = Math.round((Date.now() - cached.timestamp) / 60000);
      stats.cacheAges.push({ instanceId, ageMinutes });
    });

    return stats;
  }
}

export const contactCacheImproved = new ContactCacheImprovedService();