import { useState, useEffect } from 'react';
import { domainDetector, DomainInfo } from '@/utils/domainDetector';

/**
 * Hook para gerenciar configuração de domínio e CORS automaticamente
 */
export const useDomainConfig = () => {
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('🔍 [DOMAIN-HOOK] Detectando configuração de domínio...');
      
      // Detectar domínio atual
      const info = domainDetector.detectCurrentDomain();
      setDomainInfo(info);

      // Verificar se domínio é suportado
      if (!domainDetector.isCurrentDomainSupported()) {
        console.warn('⚠️ [DOMAIN-HOOK] Domínio atual pode não ser suportado:', info.current);
        setError(`Domínio ${info.current} pode ter problemas de CORS`);
      }

      // Atualizar configuração CORS
      const corsResult = domainDetector.updateCorsConfiguration();
      console.log('✅ [DOMAIN-HOOK] CORS configurado:', corsResult.corsOrigins);

      setIsLoading(false);
    } catch (err) {
      console.error('❌ [DOMAIN-HOOK] Erro ao detectar domínio:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setIsLoading(false);
    }
  }, []);

  const refreshDomainConfig = () => {
    setIsLoading(true);
    setError(null);
    
    try {
      domainDetector.clearCache();
      const info = domainDetector.detectCurrentDomain();
      setDomainInfo(info);
      domainDetector.updateCorsConfiguration();
      setIsLoading(false);
      console.log('🔄 [DOMAIN-HOOK] Configuração atualizada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
      setIsLoading(false);
    }
  };

  const getWebhookUrl = () => {
    return domainDetector.getCorrectWebhookUrl();
  };

  const isOriginAllowed = (origin: string) => {
    return domainDetector.isOriginAllowed(origin);
  };

  return {
    domainInfo,
    isLoading,
    error,
    refreshDomainConfig,
    getWebhookUrl,
    isOriginAllowed,
    isSupported: domainInfo ? domainDetector.isCurrentDomainSupported() : false
  };
};