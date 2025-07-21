/**
 * Hook para gerenciar cache de contatos
 */

import { useState, useEffect, useCallback } from 'react';
import { contactCacheService, ContactInfo } from '@/services/contactCacheService';

export function useContactsCache(clientId: string) {
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [cacheStats, setCacheStats] = useState(contactCacheService.getCacheStats());

  // Carregar contatos
  const loadContacts = useCallback(async (forceSync = false) => {
    if (!clientId) return;
    
    try {
      setIsLoading(true);
      
      if (forceSync) {
        await contactCacheService.syncWithDatabase(clientId, true);
      }
      
      const clientContacts = await contactCacheService.getContactsByClient(clientId);
      setContacts(clientContacts);
      setLastSync(new Date());
      setCacheStats(contactCacheService.getCacheStats());
      
      console.log('📱 [USE-CONTACTS-CACHE] Contatos carregados:', clientContacts.length);
    } catch (error) {
      console.error('❌ [USE-CONTACTS-CACHE] Erro ao carregar contatos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  // Buscar contato específico
  const getContact = useCallback(async (phone: string): Promise<ContactInfo | null> => {
    if (!clientId || !phone) return null;
    
    return await contactCacheService.getContact(clientId, phone);
  }, [clientId]);

  // Atualizar contato
  const updateContact = useCallback(async (
    phone: string, 
    updates: Partial<ContactInfo>
  ): Promise<ContactInfo | null> => {
    if (!clientId || !phone) return null;
    
    const updatedContact = await contactCacheService.updateContact(clientId, phone, updates);
    
    if (updatedContact) {
      // Atualizar lista local
      setContacts(prev => 
        prev.map(contact => 
          contact.phone === phone 
            ? { ...contact, ...updates }
            : contact
        )
      );
      setCacheStats(contactCacheService.getCacheStats());
    }
    
    return updatedContact;
  }, [clientId]);

  // Forçar sincronização
  const forceSync = useCallback(() => {
    loadContacts(true);
  }, [loadContacts]);

  // Obter contato formatado para exibição
  const getDisplayName = useCallback((contact: ContactInfo | null, fallbackPhone?: string): string => {
    if (!contact && !fallbackPhone) return 'Contato desconhecido';
    
    const phone = contact?.phone || fallbackPhone || '';
    const name = contact?.name || '';
    
    // Se tem nome válido e não é genérico
    if (name && 
        name !== `Contato ${phone}` &&
        !name.startsWith('Contato ') &&
        !name.match(/^\(\d+\)/) &&
        name !== phone) {
      return name;
    }
    
    // Formatar telefone
    if (phone && phone.match(/^\d+$/)) {
      if (phone.length === 13 && phone.startsWith('55')) {
        return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '($2) $3-$4');
      } else if (phone.length >= 10) {
        return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    return phone || 'Contato sem nome';
  }, []);

  // Carregar contatos na inicialização
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Auto-sync periódico
  useEffect(() => {
    const interval = setInterval(() => {
      if (!cacheStats.isValid) {
        loadContacts();
      }
    }, 60000); // Check a cada minuto

    return () => clearInterval(interval);
  }, [cacheStats.isValid, loadContacts]);

  return {
    // Estado
    contacts,
    isLoading,
    lastSync,
    cacheStats,
    
    // Ações
    loadContacts,
    getContact,
    updateContact,
    forceSync,
    getDisplayName,
    
    // Utilitários
    clearCache: contactCacheService.clearCache,
    isValidCache: cacheStats.isValid
  };
}