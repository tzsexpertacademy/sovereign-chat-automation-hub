
/**
 * Hook MELHORADO para gerenciar cache de contatos
 * Versão 2.0 - Com limpeza automática e extração inteligente
 */

import { useState, useEffect, useCallback } from 'react';
import { contactCacheService, ContactInfo } from '@/services/contactCacheService';
import { contactNameService } from '@/services/contactNameService';
import { contactsCleanupService } from '@/services/contactsCleanupService';
import { useToast } from '@/hooks/use-toast';

export function useContactsCache(clientId: string) {
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [cacheStats, setCacheStats] = useState(contactCacheService.getCacheStats());
  const [isOptimizing, setIsOptimizing] = useState(false);
  const { toast } = useToast();

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

  // NOVA: Otimizar contatos com IA
  const optimizeContactNames = useCallback(async () => {
    if (!clientId || isOptimizing) return;

    try {
      setIsOptimizing(true);
      console.log('🤖 [OPTIMIZE-NAMES] Iniciando otimização inteligente de nomes');

      toast({
        title: "Otimização Iniciada",
        description: "Analisando contatos com IA para extrair nomes reais..."
      });

      const result = await contactNameService.reprocessExistingContacts(clientId);

      if (result.updated > 0) {
        toast({
          title: "Nomes Otimizados",
          description: `${result.updated} contatos foram melhorados com nomes reais!`
        });
        
        // Recarregar contatos
        await loadContacts(true);
      } else {
        toast({
          title: "Otimização Concluída",
          description: "Todos os contatos já possuem nomes válidos"
        });
      }

      if (result.errors > 0) {
        console.warn(`⚠️ [OPTIMIZE-NAMES] ${result.errors} erros durante otimização`);
      }

    } catch (error: any) {
      console.error('❌ [OPTIMIZE-NAMES] Erro na otimização:', error);
      toast({
        title: "Erro na Otimização",
        description: error.message || "Erro ao otimizar nomes dos contatos",
        variant: "destructive"
      });
    } finally {
      setIsOptimizing(false);
    }
  }, [clientId, isOptimizing, loadContacts, toast]);

  // NOVA: Limpeza completa de contatos
  const performFullCleanup = useCallback(async () => {
    if (!clientId || isOptimizing) return;

    try {
      setIsOptimizing(true);
      console.log('🧹 [FULL-CLEANUP] Iniciando limpeza completa');

      toast({
        title: "Limpeza Iniciada",
        description: "Removendo contatos órfãos e otimizando base de dados..."
      });

      const result = await contactsCleanupService.performFullCleanup(clientId);

      toast({
        title: "Limpeza Concluída",
        description: result.summary
      });

      // Recarregar contatos após limpeza
      await loadContacts(true);

      console.log('✅ [FULL-CLEANUP] Resultado:', result);

    } catch (error: any) {
      console.error('❌ [FULL-CLEANUP] Erro na limpeza:', error);
      toast({
        title: "Erro na Limpeza",
        description: error.message || "Erro ao limpar contatos",
        variant: "destructive"
      });
    } finally {
      setIsOptimizing(false);
    }
  }, [clientId, isOptimizing, loadContacts, toast]);

  // Forçar sincronização
  const forceSync = useCallback(() => {
    loadContacts(true);
  }, [loadContacts]);

  // MELHORADO: Obter nome formatado para exibição
  const getDisplayName = useCallback((contact: ContactInfo | null, fallbackPhone?: string): string => {
    if (!contact && !fallbackPhone) return 'Contato desconhecido';
    
    const phone = contact?.phone || fallbackPhone || '';
    const name = contact?.name || '';
    
    // Se tem nome válido e não é genérico/telefone
    if (name && 
        name !== `Contato ${phone}` &&
        !name.startsWith('Contato ') &&
        !name.match(/^\(\d+\)/) &&
        !name.match(/^\d+$/) &&
        !name.startsWith('55') &&
        name !== phone) {
      return name;
    }
    
    // Formatar telefone para exibição
    if (phone && phone.match(/^\d+$/)) {
      if (phone.length === 13 && phone.startsWith('55')) {
        return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '($2) $3-$4');
      } else if (phone.length >= 10) {
        return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    return phone || 'Contato sem identificação';
  }, []);

  // Carregar contatos na inicialização
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Auto-sync periódico reduzido para melhor performance
  useEffect(() => {
    const interval = setInterval(() => {
      if (!cacheStats.isValid && !isLoading) {
        loadContacts();
      }
    }, 120000); // Check a cada 2 minutos

    return () => clearInterval(interval);
  }, [cacheStats.isValid, isLoading, loadContacts]);

  return {
    // Estado
    contacts,
    isLoading,
    lastSync,
    cacheStats,
    isOptimizing,
    
    // Ações básicas
    loadContacts,
    getContact,
    updateContact,
    forceSync,
    getDisplayName,
    
    // Novas funcionalidades
    optimizeContactNames,
    performFullCleanup,
    
    // Utilitários
    clearCache: contactCacheService.clearCache,
    isValidCache: cacheStats.isValid
  };
}
