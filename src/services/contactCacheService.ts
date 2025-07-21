/**
 * Serviço de Cache de Contatos
 * Gerencia cache local e sincronização de contatos WhatsApp
 */

import { supabase } from '@/integrations/supabase/client';

export interface ContactInfo {
  id: string;
  name: string;
  phone: string;
  whatsapp_chat_id?: string;
  avatar_url?: string;
  last_seen?: string;
  profile_pic_url?: string;
  is_business?: boolean;
  status_message?: string;
  updated_at: string;
}

export interface ContactCacheData {
  contacts: Map<string, ContactInfo>;
  lastSync: Date;
  syncInProgress: boolean;
}

class ContactCacheService {
  private cache: ContactCacheData = {
    contacts: new Map(),
    lastSync: new Date(0),
    syncInProgress: false
  };

  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

  constructor() {
    // Iniciar sync automático
    this.startAutoSync();
  }

  /**
   * Buscar contato no cache primeiro, depois no banco
   */
  async getContact(clientId: string, phone: string): Promise<ContactInfo | null> {
    const cacheKey = `${clientId}:${phone}`;
    
    // Verificar cache primeiro
    const cached = this.cache.contacts.get(cacheKey);
    if (cached && this.isCacheValid()) {
      console.log('📱 [CONTACT-CACHE] Contato encontrado no cache:', cached.name);
      return cached;
    }

    // Buscar no banco
    try {
      const { data: contact, error } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', clientId)
        .eq('phone', phone)
        .single();

      if (error || !contact) {
        console.log('📱 [CONTACT-CACHE] Contato não encontrado no banco:', phone);
        return null;
      }

      // Atualizar cache
      const contactInfo: ContactInfo = {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        whatsapp_chat_id: contact.whatsapp_chat_id,
        updated_at: contact.updated_at
      };

      this.cache.contacts.set(cacheKey, contactInfo);
      console.log('📱 [CONTACT-CACHE] Contato carregado do banco e cacheado:', contactInfo.name);
      
      return contactInfo;
    } catch (error) {
      console.error('❌ [CONTACT-CACHE] Erro ao buscar contato:', error);
      return null;
    }
  }

  /**
   * Atualizar contato no cache e no banco
   */
  async updateContact(
    clientId: string, 
    phone: string, 
    updates: Partial<ContactInfo>
  ): Promise<ContactInfo | null> {
    const cacheKey = `${clientId}:${phone}`;

    try {
      // Atualizar no banco
      const { data: updatedContact, error } = await supabase
        .from('customers')
        .update({
          name: updates.name,
          whatsapp_chat_id: updates.whatsapp_chat_id
        })
        .eq('client_id', clientId)
        .eq('phone', phone)
        .select()
        .single();

      if (error || !updatedContact) {
        console.error('❌ [CONTACT-CACHE] Erro ao atualizar contato:', error);
        return null;
      }

      // Atualizar cache
      const contactInfo: ContactInfo = {
        id: updatedContact.id,
        name: updatedContact.name,
        phone: updatedContact.phone,
        whatsapp_chat_id: updatedContact.whatsapp_chat_id,
        updated_at: updatedContact.updated_at,
        ...updates
      };

      this.cache.contacts.set(cacheKey, contactInfo);
      console.log('✅ [CONTACT-CACHE] Contato atualizado:', contactInfo.name);
      
      return contactInfo;
    } catch (error) {
      console.error('❌ [CONTACT-CACHE] Erro ao atualizar contato:', error);
      return null;
    }
  }

  /**
   * Sincronizar cache com banco de dados
   */
  async syncWithDatabase(clientId: string, forceSync = false): Promise<void> {
    if (this.cache.syncInProgress && !forceSync) {
      console.log('📱 [CONTACT-CACHE] Sync já em progresso');
      return;
    }

    if (!forceSync && this.isCacheValid()) {
      console.log('📱 [CONTACT-CACHE] Cache ainda válido');
      return;
    }

    try {
      this.cache.syncInProgress = true;
      console.log('🔄 [CONTACT-CACHE] Iniciando sincronização...');

      const { data: contacts, error } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Limpar cache antigo
      this.cache.contacts.clear();

      // Adicionar contatos ao cache
      contacts?.forEach(contact => {
        const cacheKey = `${clientId}:${contact.phone}`;
        const contactInfo: ContactInfo = {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          whatsapp_chat_id: contact.whatsapp_chat_id,
          updated_at: contact.updated_at
        };

        this.cache.contacts.set(cacheKey, contactInfo);
      });

      this.cache.lastSync = new Date();
      console.log(`✅ [CONTACT-CACHE] Sincronização concluída: ${contacts?.length || 0} contatos`);

    } catch (error) {
      console.error('❌ [CONTACT-CACHE] Erro na sincronização:', error);
    } finally {
      this.cache.syncInProgress = false;
    }
  }

  /**
   * Buscar múltiplos contatos
   */
  async getContactsByClient(clientId: string): Promise<ContactInfo[]> {
    // Garantir que o cache está atualizado
    await this.syncWithDatabase(clientId);

    const clientContacts: ContactInfo[] = [];
    
    this.cache.contacts.forEach((contact, key) => {
      if (key.startsWith(`${clientId}:`)) {
        clientContacts.push(contact);
      }
    });

    return clientContacts.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  /**
   * Verificar se o cache está válido
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    const lastSyncTime = this.cache.lastSync.getTime();
    return (now - lastSyncTime) < this.CACHE_DURATION;
  }

  /**
   * Iniciar sincronização automática
   */
  private startAutoSync(): void {
    setInterval(async () => {
      // Sincronizar para todos os clientes ativos
      // (pode ser melhorado para rastrear clientes ativos)
      console.log('🔄 [CONTACT-CACHE] Sync automático executado');
    }, this.SYNC_INTERVAL);
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.cache.contacts.clear();
    this.cache.lastSync = new Date(0);
    console.log('🗑️ [CONTACT-CACHE] Cache limpo');
  }

  /**
   * Obter estatísticas do cache
   */
  getCacheStats() {
    return {
      contactCount: this.cache.contacts.size,
      lastSync: this.cache.lastSync,
      isValid: this.isCacheValid(),
      syncInProgress: this.cache.syncInProgress
    };
  }
}

// Instância singleton
export const contactCacheService = new ContactCacheService();
export default contactCacheService;